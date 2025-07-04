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


// ==================== UI HELPERS ====================

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

// Default settings
const defaultSettings = {
    enableGhostIcon: true,
    enableActiveTabHighlight: true,
    enableSpecialJarIcon: true,
    enablePartitionIcon: true,
    mycleanerCookies: false,
    mycleanerBrowsingHistory: true,
    mycleanerCache: false,
    mycleanerAutofill: false,
    mycleanerDownloadHistory: true,
    mycleanerService: false,
    mycleanerPlugin: false,
    mycleanerLocal: false,
    mycleanerIndexed: false,
    mycleanerPasswords: false,
    OpenTabsTop: false,
};

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
        const settings = await browser.storage.local.get(Object.keys(defaultSettings));
        return { ...defaultSettings, ...settings };
    } catch (error) {
        console.error('Error loading settings:', error);
        return defaultSettings;
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
            if (element) {
                element.checked = settings[key];
                element.addEventListener('change', async function() {
                    const isChecked = this.checked;
                    settings[key] = isChecked;
                    await saveSettings({ [key]: isChecked });
                });
            }
        });
    } catch (error) {
        console.error('Error initializing settings:', error);
        showMessage('Failed to load settings', true);
    }
}


// ==================== COOKIE MANAGEMENT ====================

/**
 * Fetches all cookies from all containers avoiding duplicates
 * @returns {Promise<Array>} Promise resolving to array of unique cookies
 */
async function fetchAllCookies() {
    try {
        // Fetch all containers
        const containers = await browser.contextualIdentities.query({});
        const cookiePromises = [];
        
        // Get all store IDs (containers + default)
        const storeIds = [...containers.map(container => container.cookieStoreId), ""];
        
        // For each store ID, fetch both normal and partitioned cookies
        storeIds.forEach(storeId => {
            // Normal cookies
            cookiePromises.push(browser.cookies.getAll({ storeId }));
            // Partitioned cookies
            cookiePromises.push(browser.cookies.getAll({ storeId, partitionKey: {} }));
        });
        
        // Wait for all promises to resolve and flatten the result
        const allCookies = (await Promise.all(cookiePromises)).flat();
        
        // More efficient way to filter duplicates
        const uniqueMap = new Map();
        
        allCookies.forEach(cookie => {
            // Create a shorter unique key for each cookie
            const key = `${cookie.name}|${cookie.domain}|${cookie.path}|${cookie.storeId}|${cookie.partitionKey ? 'p' : 'n'}`;
            
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, cookie);
            }
        });
        
        return Array.from(uniqueMap.values());
    } catch (error) {
        console.error('Error fetching cookies:', error);
        return [];
    }
}

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
        
        showMessage(`Successfully exported ${allCookies.length} cookies!`);
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
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const cookies = data.cookies || [];
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
                    showMessage(`Successfully imported ${importCount} cookies!`);
                } else {
                    showMessage(`Imported ${importCount} cookies, but ${errorCount} cookies couldn't be imported.`, errorCount === cookies.length);
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
 * Resets all settings and favorites to defaults
 */
async function resetSettingsAndFavorites() {
    try {
        await browser.storage.local.clear();
        localStorage.removeItem('favorites');
        showMessage('Settings and favorites have been reset successfully!');
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

// Reset button
document.getElementById('resetButton')?.addEventListener('click', resetSettingsAndFavorites);

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
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});