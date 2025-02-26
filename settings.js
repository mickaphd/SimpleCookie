/* SimpleCookie, a minimalist yet efficient cookie manager for Firefox */
/* Made with ❤ by micka from Paris */


// Detect if dark mode is enabled
const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

// Set theme styles based on dark mode preference
document.body.style.cssText = `
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
    font-size: 15px;
    background-color: ${isDarkMode ? '#23222B' : '#FFFFFF'};
    color: ${isDarkMode ? '#FCFCFF' : '#000000'};
`;

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
};

// Function to save settings to storage
const saveSettings = settings => browser.storage.local.set(settings);

// Function to load settings from storage
async function loadSettings() {
    const settings = await browser.storage.local.get(Object.keys(defaultSettings));
    return { ...defaultSettings, ...settings };
}

// Function to initialize settings
async function initializeSettings() {
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
}

// Event listener for the tip bolt icon
document.getElementById('tipIcon').addEventListener('click', function() {
    document.getElementById('imagePopup').style.display = 'block';
    document.getElementById('overlay').style.display = 'block';
});

// Close the tip QR code when clicking outside of it
document.getElementById('overlay').addEventListener('click', function() {
    document.getElementById('imagePopup').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
});

// Reset settings and favorites
document.getElementById('resetButton').addEventListener('click', async () => {
    await browser.storage.local.clear();
    localStorage.removeItem('favorites');
    alert('Settings and favorites have been reset!');
    window.location.reload();
});

// Get the add-on version dynamically
const manifest = browser.runtime.getManifest();
const version = manifest.version;   

// Append the version to "SimpleCookie v" in the HTML
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('version-text').textContent += version;
    initializeSettings();
});


// ==================== EXPORT / IMPORT ====================

// Fetches all cookies from all containers and avoid duplicates (same code used in the popup.js file)
async function fetchAllCookies() {
    const containers = await browser.contextualIdentities.query({});
    const cookiePromises = [];

    // Helper function to add cookie fetch promises
    const addCookiePromise = (storeId, partitionKey = null) => {
        const options = { storeId };
        if (partitionKey !== null) {
            options.partitionKey = partitionKey;
        }
        cookiePromises.push(browser.cookies.getAll(options));
    };

    // Fetch cookies for each container and the default store
    containers.forEach(container => {
        addCookiePromise(container.cookieStoreId);
        addCookiePromise(container.cookieStoreId, {});
    });

    // Fetch cookies from the default store
    addCookiePromise("");
    addCookiePromise("", {});

    const allCookies = (await Promise.all(cookiePromises)).flat();

    // Optimizing uniqueness check
    const uniqueCookies = [...new Map(allCookies.map(cookie => [`${cookie.name}-${cookie.value}-${cookie.domain}-${cookie.partitionKey}-${cookie.storeId}-${cookie.path}`, cookie])).values()];

    return uniqueCookies;
}

// Export cookies to a JSON file
async function exportAllCookies() {
    const allCookies = await fetchAllCookies();

    // Create metadata
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

    const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cookies.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

document.getElementById('exportCookies').addEventListener('click', exportAllCookies);

// Import cookies from a JSON file
document.getElementById('importCookies').addEventListener('click', () => {
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

                for (const cookie of cookies) {
                    // Validate the data in case there is a problem with the JSON file
                    if (!cookie || typeof cookie !== 'object' || !cookie.name || !cookie.domain || !cookie.path) {
                        continue; 
                    }

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
                        cookieToSet.domain = domain;
                    }

                    // Attempt to set the cookie
                    await browser.cookies.set(cookieToSet);
                }
            } catch (error) {
                alert("Whoops!!! 😰 Our cookie jar had a little mishap. Your cookie file might have some crumbs out of place. Could you please ensure it's baked following SimpleCookie factory standards and give it another whirl? Those are the cookies we love best!");
            }
        };
        reader.readAsText(file);
    };
    input.click();
});