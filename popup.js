/* SimpleCookie, a minimalist yet efficient cookie manager for Firefox */
/* Made with ❤ by micka from Paris */

// ==================== VARIABLES ====================

// Set to hold the tracking list
let trackingSites = new Set();

// Arrays to store cookie and tab objects
let cookies = [];
let tabs = [];

// Array to keep track of cookies that have been deleted for potential undo
let tempDeletedCookies = [];

// Variable to manage the timeout for the undo action
let undoTimeout;

// Global variable to store favorites
let favorites = [];

// User settings, loaded once each time the popup opens (see loadSettings()).
// Starts as a copy of the defaults (DEFAULT_SETTINGS lives in common.js) so
// everything below can rely on every setting always having a value.
let settings = { ...DEFAULT_SETTINGS };

// True while a destructive action (delete/undo) is in flight. Without this,
// rapid-clicking two different domains — or a domain then Undo — before the
// first click's async work and re-render finish could interleave and clobber
// tempDeletedCookies (a plain reassignment, not a merge) or the cookies array.
let isBusy = false;

/**
 * Runs `action` only if no other destructive action is currently in flight.
 * @param {() => Promise<void>} action
 */
async function withBusyGuard(action) {
    if (isBusy) return;
    isBusy = true;
    try {
        await action();
    } finally {
        isBusy = false;
    }
}


// ==================== STORAGE MANAGEMENT ====================

/**
 * Loads favorites from browser storage
 * @returns {Promise<Array>} Array of favorite domains
 */
async function loadFavorites() {
    try {
        const data = await browser.storage.local.get('favorites');
        favorites = data.favorites || [];
        return favorites;
    } catch (error) {
        console.error('Error loading favorites:', error);
        favorites = [];
        return [];
    }
}

/**
 * Saves favorites to browser storage
 * @param {Array} favList - Array of favorite domains to save
 * @returns {Promise<void>}
 */
async function saveFavorites(favList) {
    try {
        await browser.storage.local.set({ favorites: favList });
        favorites = favList;
    } catch (error) {
        console.error('Error saving favorites:', error);
    }
}

// mySniper is now fully automatic: settings.js saves the domain list, and
// background.js (via cookies.onChanged) is what actually deletes matching
// cookies as soon as they appear — see background.js.


// ==================== DATA FETCHING ====================

/**
 * Fetches the list of tracking websites from the local database
 * Loads the data only once (when the set is empty)
 */
async function fetchTrackerDB() {
    // The list is only used to draw the ghost icon — no need to load and
    // parse ~6000 lines when that icon is turned off in the settings.
    if (!settings.enableGhostIcon || trackingSites.size > 0) return;
    
    try {
        const response = await fetch(browser.runtime.getURL('resources/trackerdb.txt'));
        const text = await response.text();
        trackingSites = new Set(text.split('\n').map(domain => domain.trim()).filter(Boolean));
    } catch (error) {
        console.error('Failed to load tracker database:', error);
    }
}

// fetchAllCookies() lives in common.js — shared with settings.js and
// background.js so they all fetch cookies (including partitioned/CHIPS
// ones) exactly the same way.

/**
 * Fetches all cookies and open tabs (both at the same time)
 * Updates the cookie counter in the UI
 */
async function fetchCookiesAndTabs() {
    [cookies, tabs] = await Promise.all([fetchAllCookies(), browser.tabs.query({})]);

    // Update the cookie counter in the UI
    const cookieCounter = document.getElementById('cookie-counter');
    if (cookieCounter) {
        cookieCounter.textContent = cookies.length;
    }
}

/**
 * Fetches tracking sites, cookies, and tabs concurrently
 */
async function fetchData() {
    await Promise.all([fetchTrackerDB(), fetchCookiesAndTabs()]);
}


// ==================== SETTINGS MANAGEMENT ====================

/**
 * Loads user settings from storage into the `settings` variable.
 * Passing DEFAULT_SETTINGS (see common.js) to storage.local.get() makes
 * Firefox fill in the default value of any setting the user never touched,
 * so nothing needs to be written back to storage here.
 */
async function loadSettings() {
    try {
        settings = await browser.storage.local.get(DEFAULT_SETTINGS);
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

/**
 * Initializes the extension by fetching data and displaying it
 * Shows a message and auto-closes if no cookies exist
 */
async function initExtension() {
    try {
        // Load favorites and settings first (the settings decide whether
        // the tracker list needs to be loaded at all)
        await Promise.all([loadFavorites(), loadSettings()]);

        // Then fetch the cookies, the open tabs and the tracker list
        await fetchData();

        // If no cookies exist, show message and auto-close
        if (!hasCookiesToDelete()) {
            showNoCookiesMessage();
            return;
        }

        displayCookies();
    } catch (error) {
        console.error('Error initializing extension:', error);
    }
}

/**
 * Displays a message when no cookies are found and auto-closes
 */
function showNoCookiesMessage() {
    // Cookies were just deleted and can still be restored: keep the dock
    // (and its Undo icon) on screen, and only show the message in place of
    // the list. Once Undo expires, showUndoIcon()'s timer calls this again
    // to show the normal message below and close the popup.
    if (tempDeletedCookies.length > 0) {
        const container = document.getElementById('cookies-container');
        if (!container) return;

        const messageElement = document.createElement('p');
        messageElement.className = 'empty-message';
        messageElement.textContent = 'No cookies left';
        container.innerHTML = '';
        container.appendChild(messageElement);
        return;
    }

    // Clear document body content
    document.body.innerHTML = '';
    document.body.style.display = 'flex';
    document.body.style.justifyContent = 'center';
    document.body.style.alignItems = 'center';
    document.body.style.padding = '20px';
    document.body.style.textAlign = 'center';
    document.body.style.height = '80px';
    document.body.style.width = '200px';
    
    // Create and add the message
    const messageElement = document.createElement('div');
    messageElement.textContent = 'No cookies found in your browser';
    messageElement.style.fontSize = '14px';
    messageElement.style.color = 'var(--text-color)';
    messageElement.style.fontWeight = '500';
    document.body.appendChild(messageElement);
    
    // Auto-close after 2.5 seconds
    setTimeout(() => {
        window.close();
    }, 2500);
}

/**
 * Updates the display with current cookies and tabs
 * Shows empty message if no cookies remain
 */
async function updateDisplay() {
    try {
        await fetchCookiesAndTabs();

        // If we now have zero cookies, show message and return
        if (!hasCookiesToDelete()) {
            showNoCookiesMessage();
            return;
        }

        displayCookies();
    } catch (error) {
        console.error('Error updating display:', error);
    }
}

// The extension is actually initialized by the consolidated DOMContentLoaded
// handler further down (in the EVENT LISTENERS section), which awaits
// initExtension() itself before wiring up the rest of the popup — a second,
// separate listener registered here used to call initExtension() again,
// running every fetch/render on every popup open twice over.


// ==================== DISPLAY LOGIC ====================

/**
 * Builds the Set of main domains of all open tabs, for quick "does this
 * site have an open tab?" checks.
 * @returns {Set<string>} Main domains of the open tabs
 */
function getOpenTabMainDomains() {
    return new Set(tabs.map(({ url }) => {
        try {
            return getMainDomain(new URL(url).hostname);
        } catch {
            return ''; // Skip invalid URLs
        }
    }).filter(Boolean));
}

// ==================== RISK HEURISTICS ====================

/**
 * Cookie names that commonly hold a session or authentication token.
 * This is a heuristic based on widely used naming conventions
 * (PHPSESSID, JSESSIONID, .ASPXAUTH, connect.sid, auth_token, etc.) —
 * it cannot know how a site actually uses the cookie, only how it looks.
 */
const RISKY_NAME_PATTERN = /sess|auth|token|jwt|login|logged|credential|(^|[_.])sid$/i;

/**
 * Flags a cookie as "at risk" when it looks like it holds session or
 * authentication data but lacks the browser-level protections that would
 * keep it safe from network sniffing (Secure) or client-side script
 * access (HttpOnly).
 * @param {Object} cookie - Cookie object
 * @returns {boolean} True if the cookie looks sensitive and under-protected
 */
function isRiskyCookie(cookie) {
    if (!RISKY_NAME_PATTERN.test(cookie.name)) return false;
    return !cookie.secure || !cookie.httpOnly;
}

/**
 * Displays cookies with favorites and insight icons
 * Which insight icons are shown, and the sorting, come from the user's
 * settings (see loadSettings()).
 */
function displayCookies() {
    const container = document.getElementById('cookies-container');
    if (!container) return; // Safety check

    // Clear previous content
    container.innerHTML = '';

    const fragment = document.createDocumentFragment();

    // Set of main domains from open tabs for quick membership checks
    const openTabDomainsSet = getOpenTabMainDomains();

    // Aggregate cookie info by main domain
    const domainInfo = new Map();
    cookies.forEach(cookie => {
        const mainDomain = getMainDomain(cookie.domain);
        let info = domainInfo.get(mainDomain);
        if (!info) {
            info = {
                count: 0,
                hasNonDefaultContainer: false,
                hasPartition: false,
                hasRiskyCookie: false
            };
            domainInfo.set(mainDomain, info);
        }
        info.count += 1;

        if (cookie.storeId !== 'firefox-default') {
            info.hasNonDefaultContainer = true;
        }
        if (cookie.partitionKey) {
            info.hasPartition = true;
        }
        if (isRiskyCookie(cookie)) {
            info.hasRiskyCookie = true;
        }
    });

    // Convert domain info to an array of [domain, info] pairs for sorting
    let domainsArray = Array.from(domainInfo);

    if (settings.OpenTabsTop) {
        // Separate domains into those with open tabs and others
        const openTabsDomains = [];
        const otherDomains = [];

        domainsArray.forEach(([domain, info]) => {
            if (openTabDomainsSet.has(domain)) {
                openTabsDomains.push([domain, info]);
            } else {
                otherDomains.push([domain, info]);
            }
        });

        // Sort each group alphabetically by domain name
        openTabsDomains.sort(([a], [b]) => a.localeCompare(b));
        otherDomains.sort(([a], [b]) => a.localeCompare(b));

        // Concatenate open tab domains first, then others
        domainsArray = [...openTabsDomains, ...otherDomains];
    } else {
        // Sort all domains alphabetically if setting is disabled
        domainsArray.sort(([a], [b]) => a.localeCompare(b));
    }

    // Create and append DOM elements for each domain entry
    domainsArray.forEach(([website, info]) => {
        const element = document.createElement('div');
        element.className = 'cookie-item';
        element.dataset.domain = website;
        element.textContent = `${website} (${info.count})`;
        element.title = `Left-click to delete all cookies for ${website}; right-click for detailed cookie information; press Command on macOS or Ctrl on PC to use the Tab Switcher function for the open tabs.`;

        // Favorite star icon
        const star = document.createElement('img');
        star.src = favorites.includes(website) ? 'resources/star_full.svg' : 'resources/star_empty.svg';
        star.alt = 'Favorite Star Icon';
        star.className = 'star-icon';

        star.addEventListener('click', (event) => {
            event.stopPropagation();
            if (favorites.includes(website)) {
                star.src = 'resources/star_empty.svg';
                const idx = favorites.indexOf(website);
                if (idx !== -1) favorites.splice(idx, 1);
            } else {
                star.src = 'resources/star_full.svg';
                favorites.push(website);
            }
            saveFavorites(favorites);
        });

        element.insertBefore(star, element.firstChild);
        fragment.appendChild(element);

        // Append insight icons based on settings and domain info
        if (settings.enableGhostIcon && trackingSites.has(website)) {
            appendIcon(element, 'resources/insight_ghost.svg', `${website} tracking icon`);
        }
        if (settings.enableSpecialJarIcon && info.hasNonDefaultContainer) {
            appendIcon(element, 'resources/insight_container.svg', `${website} container icon`);
        }
        if (settings.enablePartitionIcon && info.hasPartition) {
            appendIcon(element, 'resources/insight_partition.svg', `${website} partition icon`);
        }
        if (settings.enableRiskyCookieIcon && info.hasRiskyCookie) {
            appendIcon(element, 'resources/insight_risky.svg', `${website} has a cookie at risk`);
        }

        // Highlight domains with open tabs in green color (see .open-tab in popup.css)
        if (openTabDomainsSet.has(website)) {
            element.classList.add('open-tab');
        }
    });

    container.appendChild(fragment);

    // Highlight the active tab domain if enabled
    if (settings.enableActiveTabHighlight) {
        highlightActiveTabDomain();
    }

    // The list was just rebuilt: hide again what the search bar filters out
    applySearchFilter();
}

/**
 * Filters the list: only the websites whose domain contains the text typed
 * in the search bar stay visible. An empty search bar shows everything.
 * This only hides rows — the dock actions still apply to all cookies.
 */
function applySearchFilter() {
    const searchInput = document.getElementById('search');
    const container = document.getElementById('cookies-container');
    const popup = document.getElementById('popup');
    if (!searchInput || !container || !popup) return;

    const query = searchInput.value.trim().toLowerCase();

    // The cross that clears the search is only shown when there's text
    const clearButton = document.getElementById('search-clear');
    if (clearButton) {
        clearButton.hidden = !searchInput.value;
    }

    // The popup is as wide as its widest row: freeze that width on the
    // first search, so the popup doesn't shrink and grow at every keystroke.
    if (query && !popup.style.minWidth) {
        popup.style.minWidth = `${popup.offsetWidth}px`;
    }

    Array.from(container.children).forEach(element => {
        if (element.dataset.domain) {
            element.hidden = !element.dataset.domain.includes(query);
        }
    });
}

/**
 * Helper function to append icon to an element
 * @param {HTMLElement} element - The element to add icon to
 * @param {string} iconSrc - Source of the icon
 * @param {string} altText - Alt text for the icon
 */
function appendIcon(element, iconSrc, altText) {
    const icon = document.createElement('img');
    icon.src = iconSrc;
    icon.alt = altText;
    icon.className = 'insight-icon';
    // No space text node here: .cookie-item is a flex row with its own
    // `gap`, which already spaces every child evenly — adding a literal
    // space on top of that was stacking two gaps between icons.
    element.appendChild(icon);
}

/**
 * Highlights the domain of the active tab with an icon
 */
function highlightActiveTabDomain() {
    const activeTab = tabs.find(tab => tab.active);
    if (!activeTab) return;

    try {
        const activeDomain = getMainDomain(new URL(activeTab.url).hostname);
        const container = document.getElementById('cookies-container');
        if (!container) return;

        // Remove any existing active tab icon
        container.querySelector('.active-tab-icon')?.remove();

        // Find the element for the active domain
        const activeElement = Array.from(container.children).find(element =>
            getMainDomain(element.dataset.domain) === activeDomain
        );

        if (activeElement) {
            const icon = document.createElement('img');
            icon.src = 'resources/insight_eye.svg';
            icon.alt = 'Active Tab Icon';
            icon.className = 'insight-icon active-tab-icon';

            activeElement.appendChild(icon);
        }
    } catch (error) {
        console.error('Error highlighting active tab domain:', error);
    }
}


// ==================== TAB SWITCHER ====================

/**
 * Highlights domains of open tabs more prominently while the
 * platform-specific key is pressed. The look itself (bold, shifted, "goto"
 * cursor) lives in popup.css under .tab-switcher-active — this only turns
 * that class on or off.
 * @param {boolean} isKeyPressed - Whether the modifier key is pressed
 */
function highlightOpenTabDomains(isKeyPressed) {
    document.getElementById('cookies-container')?.classList.toggle('tab-switcher-active', isKeyPressed);
}

/**
 * Finds a tab that matches the given domain and activates it
 * @param {string} domain - Domain to navigate to
 * @returns {Promise<boolean>} - True if a tab was found and activated
 */
async function navigateToTab(domain) {
    const mainDomain = getMainDomain(domain);
    
    for (const tab of tabs) {
        try {
            // If domains match, switch to this tab
            if (getMainDomain(new URL(tab.url).hostname) === mainDomain) {
                if (!tab.active) {
                    await browser.tabs.update(tab.id, { active: true });
                    await browser.windows.update(tab.windowId, { focused: true });
                }
                window.close(); // Close popup after navigation
                return true;
            }
        } catch (e) {
            // Skip invalid URLs
            continue;
        }
    }
    
    return false;
}


// ==================== DETAILED TABLE ====================

/**
 * Displays detailed cookie information in a table format
 * @param {string} mainDomain - The main domain to display cookies for
 * @param {Array} cookies - Array of cookie objects
 */
function displayCookieDetails(mainDomain, cookies) {
    // Remove any previously-displayed detail table before showing a new one —
    // otherwise right-clicking multiple domains keeps stacking tables (and
    // their listeners, some referencing already-stale cookie data) forever.
    document.querySelectorAll('.cookie-table').forEach(table => table.remove());

    // Filter and sort cookies for the given main domain
    const sortedCookies = cookies.filter(cookie => getMainDomain(cookie.domain) === mainDomain)
                                .sort((a, b) => a.name.localeCompare(b.name));
    
    const table = document.createElement('table');
    table.className = 'cookie-table';
    
    // Define table headers and their descriptions
    const headers = [
        { title: 'Name', description: 'The name of the cookie, which is used to identify it when sent between the client and the server.' },
        { title: 'Value', description: 'The value of the cookie, which is the data stored within the cookie.' },
        { title: 'Size', description: 'The size of the cookie in bytes using a function that encodes both the cookie name and value, where each character is assumed to be one byte.' },
        { title: 'Domain', description: 'The domain for which the cookie is valid. The cookie will only be sent to the specified domain and its subdomains.' },
        { title: 'Partition', description: 'Partition attribute for Cookies Having Independent Partitioned State (CHIPS). Without cookie partitioning, third-party cookies can track users across the web. CHIPS, on the other hand, are restricted to the specific site on which they are set, preventing cross-site tracking while still allowing useful functions such as maintaining state across a domain and its subdomains.' },
        { title: 'Container', description: 'The container in which the cookie is stored. Containers (also known as stores or jars) are used to separate cookies and other site data for different contexts or identities, allowing users to manage their online activities and privacy by keeping data from different sites separate. With Firefox Total Cookie Protection now enabled by default, most of your cookies are automatically restricted to the sites that created them, whether you use a specific container or not.' },
        { title: 'Expiration', description: 'The date on which the cookie will expire. A session cookie is a type of cookie that does not have an expiration date set. These cookies are stored in temporary memory and are deleted when closing the browser. Persistent cookies have an expiration date and are stored on the device until they expire or are explicitly deleted.' },
        { title: 'Secure', description: 'When this flag is set, the cookie will only be sent over secure (HTTPS) connections.' },
        { title: 'HttpOnly', description: 'When this flag is set, the cookie is not accessible via JavaScript.' },
        { title: 'SameSite', description: 'This attribute controls when the cookie will be sent in cross-site requests. It can be set to Strict, Lax, or None. Strict means the cookie will only be sent in a first-party context, Lax restricts the cookie to top-level navigation and safe HTTP methods, and None means the cookie will be sent in all contexts.' },
        { title: '', description: '' }
    ];
    
    // Create header row
    const headerRow = table.insertRow();
    headers.forEach(({ title, description }) => {
        const headerCell = document.createElement('th');
        headerCell.textContent = title;
        headerCell.title = description;
        headerCell.className = 'header-cell';
        headerRow.appendChild(headerCell);
    });
    
    const sameSiteMap = {
        'no_restriction': 'None',
        'lax': 'Lax',
        'strict': 'Strict'
    };
    
    /**
     * Adds a row for each cookie in the table
     * @param {Object} cookie - Cookie object
     */
    const addRow = (cookie) => {
        const row = table.insertRow();
        row.className = 'cookie-row'; // Hover effect lives in popup.css
        const { name, value, domain, partitionKey, storeId, expirationDate, secure, httpOnly, sameSite } = cookie;
        const cookieSize = calculateCookieSize(cookie);
        const formattedStoreId = storeId.replace(/^firefox-/, '');
        const expirationDateFormatted = formatExpirationDate(expirationDate);
        const partitionValue = partitionKey?.topLevelSite || '';
        
        // Check if the cookie is a favorite
        const isFavorite = favorites.includes(getMainDomain(cookie.domain));
        if (isFavorite) {
            row.style.opacity = '0.5';
        }
        
        // Prepare cell contents for the row
        const cellContents = [
            name, 
            value,
            cookieSize,
            domain,
            partitionValue,
            formattedStoreId,
            expirationDateFormatted || 'Session',
            secure ? 'Yes' : 'No',
            httpOnly ? 'Yes' : 'No',
            sameSiteMap[sameSite] || 'None',
            '✎' // Edit icon
        ];
        
        // Create and append cells to the row
        cellContents.forEach((content, index) => {
            const cell = document.createElement('td');
            cell.className = 'cell';
            
            if (index === cellContents.length - 1) {
                // This is the edit cell
                cell.textContent = content;
                cell.title = 'Edit this cookie.';
                cell.style.cursor = 'pointer';
                cell.style.textAlign = 'center';
                cell.style.fontSize = '16px';
                
                cell.addEventListener('click', (event) => {
                    event.stopPropagation();

                    // getCookieEditUrl() lives in common.js — shared with create.js
                    browser.tabs.create({ url: getCookieEditUrl(cookie) });
                });
            } else {
                cell.textContent = content;

                // Tooltip to show full content on hover (cells are truncated)
                cell.title = content;
            }
            
            // Check if this is the expiration date cell and if the cookie is expired
            // (expirationDate !== undefined, not a truthy check: a cookie
            // expiring exactly at the Unix epoch has expirationDate === 0,
            // which is falsy and would otherwise skip the expired highlight)
            if (index === 6 && expirationDate !== undefined) {
                const now = Math.floor(Date.now() / 1000);
                if (expirationDate < now) {
                    cell.style.color = 'red';
                    cell.title = 'This cookie has expired.';
                }
            }

            // Highlight the name of cookies that look like an under-protected session/auth cookie
            if (index === 0 && isRiskyCookie(cookie)) {
                cell.style.color = '#EA4335';
                cell.title = 'This looks like a session/authentication cookie but is missing Secure and/or HttpOnly protection.';
            }

            row.appendChild(cell);
        });
        
        // Add event listeners for the row
        row.addEventListener('click', async (event) => {
            event.stopPropagation();
            if (isFavorite) {
                return; // Skip deletion for favorites
            }
            await withBusyGuard(async () => {
                // Store the deleted cookie for undo functionality
                tempDeletedCookies.push({ ...cookie });
                await deleteCookie(cookie);
                row.remove();
                showUndoIcon(); // Show undo option after deletion

                // deleteCookie() no longer refreshes on its own (see its comment),
                // so refresh the underlying domain list / counter here instead.
                // updateDisplay() already does its own fetchAllCookies() + empty
                // check, so there's no need to duplicate that here.
                await updateDisplay();
            });
        });
    };
    
    sortedCookies.forEach(addRow);
    document.body.appendChild(table);
}


// ==================== COOKIE DELETION ====================

/**
 * Deletes a single cookie based on its properties
 * This is a pure removal: it does NOT refetch cookies or refresh the popup
 * display. It used to do both internally, which meant deleting a whole
 * domain triggered one full cookie refetch and one full re-render PER
 * cookie instead of once for the whole batch. Callers are now responsible
 * for refreshing afterward — see the dock actions below for the batch case,
 * and the cookie-detail table's row click handler for the single-cookie case.
 * @param {Object} cookie - Cookie object with properties needed for deletion
 * @returns {Promise<void>}
 */
async function deleteCookie(cookie) {
    const isFavorite = favorites.includes(getMainDomain(cookie.domain));
    if (isFavorite) return; // Skip deletion for favorites

    try {
        // removeCookie() lives in common.js — shared with background.js
        await removeCookie(cookie);
    } catch (error) {
        console.error('Error deleting cookie:', error);
    }
}

/**
 * Deletes all cookies for a specific domain
 * Pure mutation + arms Undo — same contract as deleteCookie(): the caller
 * refreshes the display (once) afterward, see its click handler below.
 * @param {string} domain - Domain to delete cookies for
 */
async function deleteAllCookiesForDomain(domain) {
    const mainDomain = getMainDomain(domain); // computed once, not per filter call
    if (favorites.includes(mainDomain)) return; // Skip deletion for favorites

    try {
        const domainCookies = cookies.filter(cookie => getMainDomain(cookie.domain) === mainDomain);

        // Save for potential undo
        tempDeletedCookies = domainCookies.map(cookie => ({ ...cookie }));

        // Delete all cookies for this domain (in parallel)
        await Promise.all(domainCookies.map(deleteCookie));

        showUndoIcon();
    } catch (error) {
        console.error('Error deleting cookies for domain:', error);
    }
}

/**
 * Undoes the last cookie deletion
 * Restores all cookies from tempDeletedCookies array
 */
async function undoLastDeletion() {
    if (tempDeletedCookies.length === 0) return;

    try {
        // A cookie that matches an active mySniper keyword would just be
        // deleted again the instant it's restored (background.js reacts to
        // every cookie write) — skip restoring those rather than have them
        // flicker back for an instant and vanish with no explanation.
        const { sniperDomains = [], favorites: currentFavorites = [] } = await browser.storage.local.get(['sniperDomains', 'favorites']);
        const favoriteDomains = new Set((Array.isArray(currentFavorites) ? currentFavorites : []).map(getMainDomain));
        const sniperKeywords = Array.isArray(sniperDomains) ? sniperDomains : [];
        const cookiesToRestore = tempDeletedCookies.filter(cookie =>
            favoriteDomains.has(getMainDomain(cookie.domain)) ||
            !sniperKeywords.some(keyword => cookieMatchesSniperDomain(cookie, keyword))
        );

        // Promise.allSettled: one cookie Firefox refuses to restore shouldn't
        // stop the others, nor the display refresh below.
        // path is passed explicitly: when it's left out, Firefox derives it
        // from the URL's "directory", so a cookie on /account would come
        // back on / instead.
        await Promise.allSettled(cookiesToRestore.map(cookie => {
            return browser.cookies.set({
                url: getCookieUrl(cookie),
                name: cookie.name,
                value: cookie.value,
                path: cookie.path,
                expirationDate: cookie.expirationDate,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                sameSite: cookie.sameSite,
                storeId: cookie.storeId,
                firstPartyDomain: cookie.firstPartyDomain,
                partitionKey: cookie.partitionKey
            });
        }));

        tempDeletedCookies = [];
        await updateDisplay();

        // Hide only the undo icon
        const undoIcon = document.getElementById('icon5');
        if (undoIcon) {
            undoIcon.style.display = 'none';
        }

        // Clear the timeout
        clearTimeout(undoTimeout);
    } catch (error) {
        console.error('Error undoing last deletion:', error);
    }
}

/**
 * Cleans browsing data based on user settings
 * Called when user clicks the myCleaner icon
 */
async function myCleaner() {
    try {
        // Create options object
        const options = {
            cookies: settings.mycleanerCookies,
            history: settings.mycleanerBrowsingHistory,
            cache: settings.mycleanerCache,
            formData: settings.mycleanerAutofill,
            downloads: settings.mycleanerDownloadHistory,
            serviceWorkers: settings.mycleanerService,
            pluginData: settings.mycleanerPlugin,
            localStorage: settings.mycleanerLocal,
            indexedDB: settings.mycleanerIndexed,
            passwords: settings.mycleanerPasswords
        };

        // Filter out disabled options
        const mycleaner = Object.fromEntries(
            Object.entries(options).filter(([, value]) => value)
        );

        if (Object.keys(mycleaner).length > 0) {
            await browser.browsingData.remove({ since: 0 }, mycleaner);
        }
    } catch (error) {
        console.error('Error running myCleaner:', error);
    }
}


// ==================== DOCK ACTIONS ====================

// Each of these is the exact body that used to live inline in its icon's
// click listener (see EVENT LISTENERS below). Pulling them out means the
// keyboard shortcut (see runPendingShortcutAction()) can trigger the same
// confirmation modal + Undo flow as a manual click, instead of needing its
// own separate, unconfirmed deletion path in background.js.

/**
 * Deletes the given cookies in parallel and arms Undo for them — the
 * common part of the two cookie-deleting dock actions below.
 * @param {Array} cookiesToDelete - Cookies to delete
 */
async function deleteCookiesWithUndo(cookiesToDelete) {
    // Save for potential undo
    tempDeletedCookies = cookiesToDelete.map(cookie => ({ ...cookie }));

    await Promise.all(cookiesToDelete.map(deleteCookie));

    showUndoIcon();
}

/**
 * Deletes cookies from closed tabs — same action as clicking icon1.
 */
async function runDeleteClosedTabsCookiesAction() {
    if (!hasCookiesToDelete()) return;
    // Cookies whose site has no open tab, favorites excluded
    const openTabDomains = getOpenTabMainDomains();
    const favoriteDomains = new Set(favorites.map(getMainDomain));
    const cookiesToDelete = cookies.filter(cookie => {
        const mainDomain = getMainDomain(cookie.domain);
        return !openTabDomains.has(mainDomain) && !favoriteDomains.has(mainDomain);
    });
    if (cookiesToDelete.length === 0) return;

    const userConfirmed = await showConfirmationModal();
    if (userConfirmed) {
        await withBusyGuard(async () => {
            await deleteCookiesWithUndo(cookiesToDelete);
            await updateDisplay();
        });
    }
}

/**
 * Deletes all cookies except favorites — same action as clicking icon2.
 */
async function runDeleteAllCookiesAction() {
    if (!hasCookiesToDelete()) return;
    const favoriteDomains = new Set(favorites.map(getMainDomain));
    const cookiesToDelete = cookies.filter(cookie => !favoriteDomains.has(getMainDomain(cookie.domain)));
    if (cookiesToDelete.length === 0) return;

    const userConfirmed = await showConfirmationModal();
    if (userConfirmed) {
        await withBusyGuard(async () => {
            await deleteCookiesWithUndo(cookiesToDelete);
            await updateDisplay();
        });
    }
}

/**
 * Runs myCleaner — same action as clicking icon3.
 */
async function runMyCleanerAction() {
    if (!hasCookiesToDelete()) return;
    const userConfirmed = await showConfirmationModal();
    if (userConfirmed) {
        await withBusyGuard(async () => {
            await myCleaner();
            await updateDisplay();
        });
    }
}

/**
 * Runs the dock action the keyboard shortcut was configured for (see the
 * "Keyboard shortcut" section in settings.js), if background.js left one
 * pending. background.js can't show the confirmation modal or arm Undo
 * itself — there's no popup UI open yet when the shortcut fires — so it
 * just opens the popup and stashes which action to run; this consumes that
 * flag once, right after the popup finishes loading, and runs the exact
 * same function a manual icon click would.
 */
async function runPendingShortcutAction() {
    try {
        const { pendingShortcutAction } = await browser.storage.local.get('pendingShortcutAction');
        if (!pendingShortcutAction) return;

        // Consume the flag before acting on it: a failure below shouldn't
        // leave it behind to fire again (unconfirmed) the next time the
        // popup happens to open.
        await browser.storage.local.remove('pendingShortcutAction');

        // Each of these already guards itself with withBusyGuard — no need
        // to wrap this dispatch in another one too.
        if (pendingShortcutAction === 'deleteClosedTabsCookies') {
            await runDeleteClosedTabsCookiesAction();
        } else if (pendingShortcutAction === 'deleteAllCookies') {
            await runDeleteAllCookiesAction();
        } else if (pendingShortcutAction === 'myCleaner') {
            await runMyCleanerAction();
        }
    } catch (error) {
        console.error('Error running pending shortcut action:', error);
    }
}


// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', async function () {
    try {
        window.focus();
        // Refresh badge when popup opens (not awaited: the popup shouldn't
        // wait for the badge before showing the cookies)
        browser.runtime.sendMessage({ 
            action: 'updateBadge' 
        }).catch(() => {
            // Ignore errors if background script is not ready
        });
        
        await initExtension();

        // If the popup was opened by the keyboard shortcut for a dock action
        // (rather than a normal click), run that action now — see
        // background.js's commands.onCommand listener and
        // runPendingShortcutAction()'s own comment for why this can't just
        // happen headlessly in the background instead.
        await runPendingShortcutAction();

        const cookiesContainer = document.getElementById('cookies-container');
        
        // Search bar: filter the list while typing; the small cross clears
        // it (Escape can't be used for that: Firefox closes the popup on it)
        const searchInput = document.getElementById('search');
        searchInput?.addEventListener('input', applySearchFilter);
        document.getElementById('search-clear')?.addEventListener('click', () => {
            searchInput.value = '';
            applySearchFilter();
            searchInput.focus();
        });
        searchInput?.focus();

        const isMacOS = navigator.platform.toLowerCase().includes('mac');

        // True if the Tab Switcher key (Command on macOS, Ctrl on PC) is
        // held down during the given keyboard or mouse event
        const isModifierPressed = (event) => isMacOS ? event.metaKey : event.ctrlKey;

        // Event listeners for key press / release: show or hide the Tab Switcher hint
        document.addEventListener('keydown', (event) => highlightOpenTabDomains(isModifierPressed(event)));
        document.addEventListener('keyup', (event) => highlightOpenTabDomains(isModifierPressed(event)));

        // Event listener for the cookie container click events
        cookiesContainer?.addEventListener('click', async (event) => {
            if (event.target.nodeName === 'DIV') {
                const website = event.target.dataset.domain;
                event.preventDefault();

                // First check if modifier key is currently pressed
                if (isModifierPressed(event)) {
                    // Tab Switcher: only for domains with an open tab (the green ones)
                    if (event.target.classList.contains('open-tab')) {
                        await navigateToTab(website);
                        return;
                    }
                } else {
                    // Default behavior - delete cookies
                    const mainDomain = getMainDomain(website);
                    const domainCookies = cookies.filter(cookie => getMainDomain(cookie.domain) === mainDomain);

                    if (domainCookies.length === 0) return;

                    await withBusyGuard(async () => {
                        await deleteAllCookiesForDomain(website);
                        await updateDisplay();
                    });
                }
            }
        });

        // Event listener for the cookie container right-click: Displays cookie details for the selected domain
        cookiesContainer?.addEventListener('contextmenu', (event) => {
            try {
                if (event.target.nodeName === 'DIV') {
                    const website = event.target.dataset.domain;
                    event.preventDefault();
                    displayCookieDetails(website, cookies);
                }
            } catch (error) {
                console.error('Error in contextmenu handler:', error);
            }
        });

        const icon1 = document.getElementById('icon1');
        const icon2 = document.getElementById('icon2');
        const icon3 = document.getElementById('icon3');
        const icon5 = document.getElementById('icon5');

        // Event listener for the icon1 to delete cookies associated with closed tabs
        icon1?.addEventListener('click', async () => {
            try {
                await runDeleteClosedTabsCookiesAction();
            } catch (error) {
                console.error('Error in icon1 click handler:', error);
            }
        });

        // Event listener for the icon2 to delete all cookies except favorites
        icon2?.addEventListener('click', async () => {
            try {
                await runDeleteAllCookiesAction();
            } catch (error) {
                console.error('Error in icon2 click handler:', error);
            }
        });

        // Event listener for the icon3 to trigger the myCleaner function
        icon3?.addEventListener('click', async () => {
            try {
                await runMyCleanerAction();
            } catch (error) {
                console.error('Error in icon3 click handler:', error);
            }
        });

        // Event listener for the icon5 to undo the very last cookie deletion
        icon5?.addEventListener('click', async () => {
            try {
                await withBusyGuard(undoLastDeletion);
            } catch (error) {
                console.error('Error in icon5 click handler:', error);
            }
        });
    } catch (error) {
        console.error('Error in DOMContentLoaded handler:', error);
    }
});


// ==================== HELPER FUNCTIONS ====================

/**
 * Shows the undo icon and sets a timeout to hide it
 */
function showUndoIcon() {
    const undoIcon = document.getElementById('icon5');
    
    if (!undoIcon) return;

    // Show the undo icon
    undoIcon.style.display = 'flex'; 

    // Clear any existing timeout
    clearTimeout(undoTimeout);
    
    // Set a new timeout to hide the undo icon after 20 seconds
    undoTimeout = setTimeout(() => {
        undoIcon.style.display = 'none';
        tempDeletedCookies = [];

        // If the popup was only kept open for Undo (no cookies left), it
        // can now show its normal "no cookies" message and close.
        if (!hasCookiesToDelete()) {
            showNoCookiesMessage();
        }
    }, 20000); // 20 seconds to undo
}

// getCookieUrl() and removeCookie() live in common.js — shared with
// background.js, which also needs to remove cookies to enforce mySniper.

/**
 * Checks if there are any cookies to delete
 * Used to avoid showing confirmation dialog when no cookies exist
 * @returns {boolean} True if there are cookies to delete
 */
function hasCookiesToDelete() {
    return cookies.length > 0;
}

/**
 * Shows a confirmation modal dialog
 * Deliberately icon-only, no message text: the popup is narrow enough that
 * a wrapped sentence in the fixed-position overlay looks broken rather than
 * helpful (tried it, it didn't work — see the dock icons' own tooltips for
 * the "what does this do" explanation instead).
 * @returns {Promise<boolean>} Promise resolving to true if confirmed, false if cancelled
 */
function showConfirmationModal() {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmation-modal');
        const yesButton = document.getElementById('confirm-yes');
        const noButton = document.getElementById('confirm-no');

        if (!modal || !yesButton || !noButton) {
            resolve(false);
            return;
        }

        modal.style.display = 'block';

        const handleResponse = (response) => {
            modal.style.display = 'none';
            resolve(response);
            yesButton.removeEventListener('click', handleYes);
            noButton.removeEventListener('click', handleNo);
            modal.removeEventListener('click', handleClickOutside);
            document.removeEventListener('keydown', handleKeydown, true);
        };

        const handleYes = () => handleResponse(true);
        const handleNo = () => handleResponse(false);

        yesButton.addEventListener('click', handleYes);
        noButton.addEventListener('click', handleNo);

        // Clicking the dark area around the two buttons cancels. (This used
        // to compare the click target with the modal itself, which could
        // never match: .modal-content covers the whole modal.)
        const handleClickOutside = (event) => {
            if (!event.target.closest('.icon-button')) handleResponse(false);
        };

        modal.addEventListener('click', handleClickOutside);

        // Same convention as the browser's own confirm()/alert() dialogs on
        // both Mac and Windows: Enter approves. Escape is the standard
        // cross-platform "back out" key, and Backspace/Delete are added
        // alongside it (rather than as an alternate approve key) — a stray
        // press of either is far safer misread as "cancel" than as "go ahead
        // and delete", especially right after typing something. Capture
        // phase so this always wins even if focus landed somewhere odd.
        const handleKeydown = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleResponse(true);
            } else if (event.key === 'Escape' || event.key === 'Backspace' || event.key === 'Delete') {
                event.preventDefault();
                handleResponse(false);
            }
        };

        document.addEventListener('keydown', handleKeydown, true);
    });
}


// ==================== FORMAT HELPERS ====================

// getMainDomain() lives in common.js — shared with background.js so the
// popup's domain grouping and the badge's cookie count always agree on what
// counts as the same site.

/**
 * Calculates the size of a cookie based on name and value
 * @param {Object} cookie - Cookie object
 * @returns {number} Size of the cookie in bytes
 */
function calculateCookieSize(cookie) {
    return (cookie.name?.length || 0) + (cookie.value?.length || 0);
}

/**
 * Formats the expiration date of a cookie
 * @param {number} expirationDate - Unix timestamp
 * @returns {string} Formatted date string
 */
function formatExpirationDate(expirationDate) {
    if (expirationDate !== undefined) {
        return new Date(expirationDate * 1000).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }
    return '';
}
