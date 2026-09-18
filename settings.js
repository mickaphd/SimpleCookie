/* SimpleCookie, a minimalist yet efficient cookie manager for Firefox */
/* Made with ❤ by micka from Paris */

// ==================== THEME MANAGEMENT ====================

/**
 * Detects and applies the appropriate theme based on user preference
 */
function applyTheme() {
    // Check if Firefox's theme is dark
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
    }
}

// Apply theme immediately when script loads
applyTheme();

// Listen for theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);


// ==================== UI MESSAGING ====================

/**
 * Shows a message to the user with automatic timeout
 * @param {string} message - The message to display
 * @param {boolean} isError - Whether this is an error message
 */
function showMessage(message, isError = false) {
    const messageBox = document.getElementById('messageBox');
    const messageText = document.getElementById('messageText');
    
    if (!messageBox || !messageText) return;
    
    messageText.textContent = message;
    
    // Remove any existing classes
    messageBox.classList.remove('success-message', 'error-message');
    
    // Add appropriate class based on message type
    messageBox.classList.add(isError ? 'error-message' : 'success-message');
    
    messageBox.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(function() {
        messageBox.style.display = 'none';
    }, 5000);
}


// ==================== SETTINGS MANAGEMENT ====================

// Default settings live in common.js (DEFAULT_SETTINGS) so popup.js and
// settings.js can never disagree about what a "default" is.

/**
 * Saves settings to browser storage
 * @param {Object} settings - Settings to save
 * @returns {Promise} Promise from browser.storage.local.set
 */
const saveSettings = settings => browser.storage.local.set(settings);

/**
 * Loads settings from browser storage
 * @returns {Promise<Object>} Promise resolving to merged settings
 */
async function loadSettings() {
    try {
        const settings = await browser.storage.local.get(Object.keys(DEFAULT_SETTINGS));
        return { ...DEFAULT_SETTINGS, ...settings };
    } catch (error) {
        console.error('Error loading settings:', error);
        return DEFAULT_SETTINGS;
    }
}

/**
 * Initializes settings UI and event handlers
 */
async function initializeSettings() {
    try {
        const settings = await loadSettings();
        
        Object.keys(settings).forEach(key => {
            const element = document.getElementById(key);
            if (element && element.type === 'checkbox') {
                element.checked = settings[key];
                element.addEventListener('change', async function() {
                    const isChecked = this.checked;
                    settings[key] = isChecked;
                    await saveSettings({ [key]: isChecked });
                });
            }
        });

        // Handle sniper domains textarea separately
        const sniperDomainsElement = document.getElementById('sniperDomains');
        if (sniperDomainsElement) {
            try {
                const sniperData = await browser.storage.local.get('sniperDomains');
                sniperDomainsElement.value = sniperData.sniperDomains ? 
                    sniperData.sniperDomains.join(', ') : '';
                
                sniperDomainsElement.addEventListener('change', async function() {
                    const entries = this.value.split(',')
                        .map(d => d.trim().toLowerCase())
                        .filter(d => d);

                    // Keywords that are too short would match an unreasonable
                    // number of unrelated domains (see MIN_SNIPER_KEYWORD_LENGTH
                    // in common.js) — drop them rather than silently nuking cookies
                    // no one meant to touch.
                    const domains = entries.filter(d => d.length >= MIN_SNIPER_KEYWORD_LENGTH);
                    const ignoredCount = entries.length - domains.length;

                    // Saving is all this page does — background.js reacts to this
                    // storage change to sweep away any cookies those keywords
                    // already match, and to auto-delete new ones as they appear.
                    await browser.storage.local.set({ sniperDomains: domains });

                    if (ignoredCount > 0) {
                        // Still say what WAS saved and is now active — otherwise a
                        // user seeing only the "ignored" warning could reasonably
                        // assume nothing happened, when the rest was in fact saved.
                        const ignoredNote = `${ignoredCount} keyword${ignoredCount > 1 ? 's were' : ' was'} shorter than ${MIN_SNIPER_KEYWORD_LENGTH} characters and ignored.`;
                        const savedNote = domains.length > 0
                            ? ` The rest is active: ${domains.join(', ')}.`
                            : ' Nothing else was saved.';
                        showMessage(ignoredNote + savedNote, true);
                    } else {
                        showMessage(domains.length > 0
                            ? `mySniper will now auto-delete cookies from any domain containing: ${domains.join(', ')}.`
                            : 'mySniper list cleared — those keywords are no longer auto-cleaned.');
                    }
                });
            } catch (error) {
                console.error('Error handling sniper domains:', error);
                showMessage('Failed to load your mySniper list', true);
            }
        }
    } catch (error) {
        console.error('Error initializing settings:', error);
        showMessage('Failed to load settings', true);
    }
}


// ==================== KEYBOARD SHORTCUT ====================

// SHORTCUT_COMMAND_NAME lives in common.js — shared with background.js so
// the two can't disagree on which manifest.json command this refers to.

/**
 * Reads Firefox's own record of the shortcut's current key combination
 * (there is no need to keep a copy of it in browser.storage.local — Firefox
 * already persists it, keyed by command name) and reflects it in the page.
 * @param {HTMLElement} shortcutDisplay
 */
async function refreshShortcutDisplay(shortcutDisplay) {
    try {
        const commands = await browser.commands.getAll();
        const current = commands.find(c => c.name === SHORTCUT_COMMAND_NAME);
        shortcutDisplay.textContent = current?.shortcut || 'Not set';
    } catch (error) {
        console.error('Error reading current shortcut:', error);
    }
}

/**
 * Initializes the "Keyboard shortcut" settings section: the action dropdown
 * (saved like any other setting) and a link to Firefox's own native "Manage
 * Extension Shortcuts" page for actually recording the key combination.
 *
 * Two earlier attempts tried to capture the combination ourselves inside
 * this page (listening for raw keydown events, then a plain typed-text
 * field) — both kept running into the same wall: only Firefox's own chrome
 * UI can reliably tell a shortcut it's about to hand to this extension apart
 * from one the OS or the browser itself already owns (Cmd+J for Downloads,
 * etc.), across Mac/Windows/Linux, without guessing. Rather than keep
 * reimplementing that, this just opens Firefox's real shortcuts page via
 * commands.openShortcutSettings() and reflects back whatever the user sets
 * there — one line of code instead of a keyboard-capture engine.
 */
async function initializeShortcutSettings() {
    const shortcutActionSelect = document.getElementById('shortcutAction');
    const shortcutDisplay = document.getElementById('shortcutKeyDisplay');
    const configureShortcutLink = document.getElementById('configureShortcut');
    const clearShortcutLink = document.getElementById('clearShortcut');

    if (shortcutActionSelect) {
        try {
            const { shortcutAction } = await browser.storage.local.get({
                shortcutAction: DEFAULT_SETTINGS.shortcutAction
            });
            shortcutActionSelect.value = shortcutAction;
            shortcutActionSelect.addEventListener('change', async function () {
                await saveSettings({ shortcutAction: this.value });
            });
        } catch (error) {
            console.error('Error loading shortcut action:', error);
        }
    }

    if (shortcutDisplay) {
        await refreshShortcutDisplay(shortcutDisplay);
        // Firefox has no "a shortcut changed" event to listen for, so just
        // re-read it whenever the user comes back to this tab — the most
        // likely reason being that they just set it on the native page.
        window.addEventListener('focus', () => refreshShortcutDisplay(shortcutDisplay));
    }

    configureShortcutLink?.addEventListener('click', async (event) => {
        event.preventDefault();
        try {
            await browser.commands.openShortcutSettings();
        } catch (error) {
            console.error('Error opening shortcut settings:', error);
            showMessage(
                "Couldn't open it automatically — go to about:addons, click the gear icon, then \"Manage Extension Shortcuts\".",
                true
            );
        }
    });

    clearShortcutLink?.addEventListener('click', async (event) => {
        event.preventDefault();
        try {
            await browser.commands.reset(SHORTCUT_COMMAND_NAME);
            if (shortcutDisplay) await refreshShortcutDisplay(shortcutDisplay);
            showMessage('Shortcut cleared.');
        } catch (error) {
            console.error('Error clearing shortcut:', error);
            showMessage(`Error: ${error.message}`, true);
        }
    });
}


// ==================== COOKIE MANAGEMENT ====================

// fetchAllCookies() lives in common.js — shared with popup.js so both
// pages fetch and de-duplicate cookies (including partitioned/CHIPS ones)
// exactly the same way.

/**
 * Pluralizes "cookie" for a given count
 * @param {number} count
 * @returns {string} "cookie" or "cookies"
 */
const cookieWord = count => count === 1 ? 'cookie' : 'cookies';

/**
 * Exports all cookies to a JSON file
 */
async function exportAllCookies() {
    try {
        const allCookies = await fetchAllCookies();
        const version = browser.runtime.getManifest().version;

        // Create metadata object
        const metadata = {
            SimpleCookie_version: version,
            User_agent: navigator.userAgent,
            Total_number_of_cookies: allCookies.length,
            Date_of_export: new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            }),
            cookies: allCookies.map(cookie => ({
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                expirationDate: cookie.expirationDate,
                sameSite: cookie.sameSite,
                storeId: cookie.storeId,
                firstPartyDomain: cookie.firstPartyDomain,
                partitionKey: cookie.partitionKey,
                hostOnly: cookie.hostOnly
            }))
        };

        // Create and trigger download
        const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cookies.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showMessage(`Successfully exported ${allCookies.length} ${cookieWord(allCookies.length)}!`);
    } catch (error) {
        console.error('Error exporting cookies:', error);
        showMessage(`Error exporting cookies: ${error.message}`, true);
    }
}

/**
 * Imports cookies from a selected JSON file
 */
async function importCookies() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onerror = () => {
            console.error('Error reading cookie file:', reader.error);
            showMessage("Couldn't read that file — it may have moved, or you may not have permission to read it.", true);
        };
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                // A missing/non-array `cookies` field means this almost
                // certainly isn't a SimpleCookie export at all — treat it as
                // a parse error rather than silently "importing" 0 cookies
                // and reporting that as a success.
                if (!Array.isArray(data.cookies)) {
                    throw new Error("This doesn't look like a SimpleCookie export file — no cookies array found.");
                }
                const cookies = data.cookies;
                let importCount = 0;
                let errorCount = 0;

                for (const cookie of cookies) {
                    // Validate the cookie data
                    if (!cookie || typeof cookie !== 'object' || !cookie.name || !cookie.domain || !cookie.path) {
                        errorCount++;
                        continue; 
                    }

                    try {
                        // Prepare the domain (remove leading dot if necessary)
                        const domain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
                        const url = `http${cookie.secure ? 's' : ''}://${domain}${cookie.path}`;
                        
                        const cookieToSet = {
                            url: url,
                            name: cookie.name,
                            value: cookie.value,
                            path: cookie.path,
                            secure: cookie.secure,
                            httpOnly: cookie.httpOnly,
                            expirationDate: cookie.expirationDate,
                            sameSite: cookie.sameSite,
                            storeId: cookie.storeId,
                            firstPartyDomain: cookie.firstPartyDomain,
                            partitionKey: cookie.partitionKey
                        };

                        // Set the domain property only if the cookie is not host-only
                        if (!cookie.hostOnly) {
                            cookieToSet.domain = cookie.domain;
                        }

                        // Attempt to set the cookie
                        await browser.cookies.set(cookieToSet);
                        importCount++;
                    } catch (err) {
                        console.error('Error importing cookie:', err);
                        errorCount++;
                    }
                }

                if (errorCount === 0) {
                    showMessage(`Successfully imported ${importCount} ${cookieWord(importCount)}!`);
                } else {
                    // Red "error" styling once failures are the majority (including
                    // a 100% failure); a mostly-successful import still mentions the
                    // failures in the text, but isn't flagged as if it mostly failed.
                    const isMostlyFailed = errorCount >= importCount;
                    showMessage(
                        `Imported ${importCount} ${cookieWord(importCount)}, but ${errorCount} couldn't be imported.`,
                        isMostlyFailed
                    );
                }
            } catch (error) {
                console.error('Error parsing cookie file:', error);
                showMessage("Whoops! 😰 Our cookie jar had a little mishap. Your cookie file might have some crumbs out of place. Could you please ensure it's baked following SimpleCookie factory standards and give it another whirl?", true);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}


// ==================== RESET FUNCTIONALITY ====================

/**
 * Resets all settings, favorites, and the mySniper keyword list to defaults
 */
async function resetSettingsAndFavorites() {
    try {
        await browser.storage.local.clear();

        // The keyboard shortcut's key combination lives in Firefox's own
        // commands storage, not browser.storage.local, so clear() above
        // doesn't touch it — reset it separately so "reset everything"
        // actually means everything. A failure here (nothing assigned yet)
        // is harmless and shouldn't block the rest of the reset.
        try {
            await browser.commands.reset(SHORTCUT_COMMAND_NAME);
        } catch (error) {
            console.error('Error resetting shortcut:', error);
        }

        showMessage('Settings, favorites, your mySniper list, and your keyboard shortcut have been reset successfully!');
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    } catch (error) {
        console.error('Error resetting settings:', error);
        showMessage(`Error: ${error.message}`, true);
    }
}


// ==================== EVENT LISTENERS ====================

// Handle create cookie button
document.getElementById('createCookie')?.addEventListener('click', () => {
    browser.tabs.create({ url: 'create.html' });
});

// Handle tip icon
document.getElementById('tipIcon')?.addEventListener('click', function() {
    document.getElementById('imagePopup').style.display = 'block';
    document.getElementById('overlay').style.display = 'block';
});

// Close tip popup when clicking overlay
document.getElementById('overlay')?.addEventListener('click', function() {
    document.getElementById('imagePopup').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
});

// Close message box
document.getElementById('closeMessage')?.addEventListener('click', function() {
    document.getElementById('messageBox').style.display = 'none';
});

// Reset button — this is a destructive, irreversible action (it also wipes
// the mySniper keyword list and the keyboard shortcut, not just
// favorites/settings), so confirm first rather than acting on a single
// misclick of a plain link.
document.getElementById('resetButton')?.addEventListener('click', async () => {
    const confirmed = window.confirm(
        'Reset all settings, favorites, your mySniper keyword list, and your keyboard shortcut back to factory defaults? This cannot be undone.'
    );
    if (confirmed) {
        await resetSettingsAndFavorites();
    }
});

// Export and import buttons
document.getElementById('exportCookies')?.addEventListener('click', exportAllCookies);
document.getElementById('importCookies')?.addEventListener('click', importCookies);


// ==================== INITIALIZATION ====================

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Set version number in the UI
        const manifest = browser.runtime.getManifest();
        const versionElement = document.getElementById('version-text');
        if (versionElement && manifest) {
            versionElement.textContent += manifest.version || '';
        }
        
        // Initialize settings
        initializeSettings();
        initializeShortcutSettings();
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});
