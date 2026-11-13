/* SimpleCookie, a minimalist yet efficient cookie manager for Firefox */
/* Made with ❤ by micka from Paris */

// The light/dark theme is handled entirely in CSS (see theme.css),
// showMessage() lives in message.js — shared with settings.js — and
// removeCookie() / getCookieEditUrl() live in common.js.

// ==================== STATE ====================

// The cookie being edited, exactly as Firefox returned it — or null when
// this page is used to create a brand new cookie.
let originalCookie = null;

// Text of the "Expires" field as it was filled in from originalCookie. If
// it's still the same when saving, the cookie's exact original expiration is
// reused instead of being recomputed from that text.
let originalExpirationText = '';


// ==================== VALIDATION & FORMAT HELPERS ====================

/**
 * Validates if a domain is in correct format
 * @param {string} domain - Domain to validate
 * @returns {boolean} True if domain is valid
 */
function isValidDomain(domain) {
    if (!domain) return false;
    if (domain === 'localhost') return true;
    
    const domainToCheck = domain.startsWith('.') ? domain.substring(1) : domain;
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domainToCheck) && domainToCheck.includes('.');
}

/**
 * Converts a cookie expiration (Unix timestamp, in seconds) to the text
 * format of the "Expires" date-and-time field: YYYY-MM-DDTHH:MM:SS, in the
 * user's local time.
 * @param {number} expirationDate - Unix timestamp in seconds
 * @returns {string} Value for the datetime-local field
 */
function toDateTimeFieldValue(expirationDate) {
    const date = new Date(expirationDate * 1000);
    const pad = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Turns what was typed in the "Partition Key" field into the site URL
 * Firefox expects (adds https:// when it's missing).
 * @param {string} text - Content of the field
 * @returns {string} Site URL, or '' if the field is empty
 */
function toTopLevelSite(text) {
    const site = text.trim();
    if (!site) return '';
    return (site.startsWith('http://') || site.startsWith('https://')) ? site : `https://${site}`;
}


// ==================== FIREFOX CONTAINER MANAGEMENT ====================

/**
 * Populates the container dropdown with available Firefox containers
 */
async function populateContainerDropdown() {
    const storeIdSelect = document.getElementById('storeId');
    if (!storeIdSelect) return;

    const addOption = (value, label) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        storeIdSelect.appendChild(option);
    };

    storeIdSelect.innerHTML = '';
    addOption('firefox-default', 'Default (No Container)');

    try {
        const containers = await browser.contextualIdentities.query({});
        containers.sort((a, b) => a.name.localeCompare(b.name));
        containers.forEach(container => addOption(container.cookieStoreId, container.name));
    } catch (error) {
        // Only the default container is offered in that case
        console.error('Error fetching containers:', error);
    }
}


// ==================== EDIT MODE ====================

/**
 * Finds the cookie this page was opened to edit.
 * The page's address only says WHICH cookie it is (name, domain, path,
 * container, partition — see getCookieEditUrl() in common.js), never its
 * value: the cookie itself is read here, straight from Firefox. That keeps
 * cookie values (often login tokens) out of the address bar and of the
 * browsing history, and always shows the cookie as it is right now.
 * @returns {Promise<Object|null>} The cookie, or null when creating a new
 * one or when the cookie no longer exists
 */
async function findCookieToEdit() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('name')) return null; // No cookie to edit: "create" mode

    const candidates = await browser.cookies.getAll({
        name: params.get('name'),
        storeId: params.get('storeId'),
        partitionKey: {},
        firstPartyDomain: null
    });

    const cookie = candidates.find(candidate =>
        candidate.domain === params.get('domain') &&
        candidate.path === params.get('path') &&
        (candidate.partitionKey?.topLevelSite || '') === params.get('partition') &&
        (candidate.firstPartyDomain || '') === params.get('firstPartyDomain')
    );

    if (!cookie) {
        showMessage('This cookie no longer exists (it expired or was deleted). You can create a new one instead.', true);
    }
    return cookie || null;
}

/**
 * Fills the form with the cookie being edited and switches the page's
 * title and button to "edit" wording.
 * @param {Object} cookie - Cookie object, as returned by the cookies API
 */
function populateForm(cookie) {
    originalCookie = cookie;

    document.getElementById('name').value = cookie.name;
    document.getElementById('value').value = cookie.value;
    document.getElementById('domain').value = cookie.domain;
    document.getElementById('path').value = cookie.path;
    document.getElementById('secure').value = String(cookie.secure);
    document.getElementById('httpOnly').value = String(cookie.httpOnly);
    document.getElementById('storeId').value = cookie.storeId;
    document.getElementById('partitionKey').value = cookie.partitionKey?.topLevelSite || '';
    document.getElementById('firstPartyDomain').value = cookie.firstPartyDomain || '';

    // SameSite: Firefox can report a state the dropdown doesn't list (a
    // cookie set without any SameSite attribute). Add it as an extra choice
    // so saving keeps the cookie exactly as it was, instead of silently
    // turning it into "None".
    const sameSiteSelect = document.getElementById('sameSite');
    if (!Array.from(sameSiteSelect.options).some(option => option.value === cookie.sameSite)) {
        const option = document.createElement('option');
        option.value = cookie.sameSite;
        option.textContent = 'Not set';
        sameSiteSelect.appendChild(option);
    }
    sameSiteSelect.value = cookie.sameSite;

    // A session cookie has no expiration date: the field stays empty
    originalExpirationText = cookie.expirationDate !== undefined
        ? toDateTimeFieldValue(cookie.expirationDate)
        : '';
    document.getElementById('expirationDate').value = originalExpirationText;

    document.getElementById('submitButton').textContent = 'Update Cookie';
    document.getElementById('pageTitle').textContent = 'Edit Cookie';
}


// ==================== FORM HANDLING ====================

/**
 * Handles the form submission to create or update a cookie
 * @param {Event} event - Form submission event
 */
async function saveCookie(event) {
    event.preventDefault();

    const isEditing = originalCookie !== null;

    try {
        const name = document.getElementById('name').value.trim();
        const value = document.getElementById('value').value;
        const domain = document.getElementById('domain').value.trim().toLowerCase();
        const path = document.getElementById('path').value.trim();

        if (!name || !domain || !path) {
            throw new Error('Name, domain and path are required fields');
        }

        if (!isValidDomain(domain)) {
            throw new Error('Please enter a valid domain (e.g., example.com or .example.com)');
        }

        if (!path.startsWith('/')) {
            throw new Error("The path must start with '/'");
        }

        const secure = document.getElementById('secure').value === 'true';
        const httpOnly = document.getElementById('httpOnly').value === 'true';
        const sameSite = document.getElementById('sameSite').value;

        // Firefox rejects SameSite=None without Secure — check it here with a
        // specific message rather than letting cookies.set() reject it below
        // with only the generic "the browser may have rejected it" error.
        if (sameSite === 'no_restriction' && !secure) {
            throw new Error("SameSite 'None' requires Secure to be 'Yes' — either set Secure to Yes, or choose Lax/Strict.");
        }

        // A leading dot (".example.com") means the cookie is also valid for
        // subdomains; without it, it only belongs to that exact host.
        const isHostOnly = !domain.startsWith('.');
        const host = isHostOnly ? domain : domain.substring(1);
        const storeId = document.getElementById('storeId').value;
        const firstPartyDomain = document.getElementById('firstPartyDomain').value.trim();
        const topLevelSite = toTopLevelSite(document.getElementById('partitionKey').value);

        const newCookie = {
            url: `http${secure ? 's' : ''}://${host}${path}`,
            name: name,
            value: value,
            path: path,
            secure: secure,
            httpOnly: httpOnly,
            sameSite: sameSite,
            storeId: storeId,
            firstPartyDomain: firstPartyDomain
        };

        if (!isHostOnly) {
            newCookie.domain = domain;
        }

        if (topLevelSite) {
            newCookie.partitionKey = { topLevelSite };
        }

        // Expiration: left empty, the cookie is a session cookie. Left
        // untouched while editing, the original expiration is kept as is.
        const expirationText = document.getElementById('expirationDate').value;
        if (expirationText) {
            if (isEditing && expirationText === originalExpirationText) {
                newCookie.expirationDate = originalCookie.expirationDate;
            } else {
                const expirationTimestamp = Math.floor(new Date(expirationText).getTime() / 1000);
                if (isNaN(expirationTimestamp)) {
                    throw new Error('Please enter a valid expiration date and time');
                }
                newCookie.expirationDate = expirationTimestamp;
            }
        }

        // When editing, work out whether this is really a different cookie
        // identity (name/domain/path/container/partition) or just a value/flag
        // change to the same one. Firefox identifies a cookie by exactly those
        // fields, so cookies.set() below already overwrites it in place when
        // the identity is unchanged — removing the "original" afterward in
        // that case would just delete the cookie this call created.
        const identityChanged = isEditing && (
            originalCookie.name !== name ||
            originalCookie.domain !== domain ||
            originalCookie.path !== path ||
            originalCookie.storeId !== storeId ||
            (originalCookie.partitionKey?.topLevelSite || '') !== topLevelSite ||
            (originalCookie.firstPartyDomain || '') !== firstPartyDomain
        );

        // Create (or in-place overwrite) the cookie first. If this throws,
        // nothing has been touched yet — the original, if any, is untouched.
        const savedCookie = await browser.cookies.set(newCookie);

        if (!savedCookie) {
            throw new Error('Failed to set cookie. The browser may have rejected it.');
        }

        // Only now, with the replacement confirmed to exist, clean up the
        // original — and only when its identity actually differs. A failure
        // here is a harmless leftover duplicate (findable and deletable from
        // the popup), never data loss, so it's logged but doesn't affect the
        // success message below.
        if (identityChanged) {
            try {
                await removeCookie(originalCookie);
            } catch (error) {
                console.error('Error removing original cookie after edit (a leftover duplicate may remain):', error);
            }
        }

        if (isEditing) {
            // The saved cookie is now the one being edited: further changes
            // (and a reload of this page) must refer to it, not to the old one.
            originalCookie = savedCookie;
            originalExpirationText = expirationText;
            history.replaceState(null, '', getCookieEditUrl(savedCookie));
            showMessage('Cookie updated successfully!');
        } else {
            document.getElementById('createCookieForm').reset();
            showMessage('Cookie created successfully!');
        }
    } catch (error) {
        console.error(`Failed to ${isEditing ? 'update' : 'create'} cookie:`, error);
        showMessage(`Error: ${error.message}`, true);
    }
}


// ==================== INITIALIZATION ====================

/**
 * Initializes the form when DOM is fully loaded
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // The container list must be ready before the form is filled in,
        // so the cookie's container can be selected in it.
        await populateContainerDropdown();
        document.getElementById('createCookieForm').addEventListener('submit', saveCookie);

        const cookie = await findCookieToEdit();
        if (cookie) {
            populateForm(cookie);
        }
    } catch (error) {
        console.error('Error during form initialization:', error);
        showMessage('Error loading cookie data for editing', true);
    }
});
