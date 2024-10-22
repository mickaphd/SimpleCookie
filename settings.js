/* SimpleCookie, a minimalist yet efficient cookie manager for Firefox */
/* Made with ❤ by Micka from Paris */


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
    mycleanerPasswords: false
};

// Function to save settings to storage
async function saveSettings(settings) {
    await browser.storage.local.set(settings);
}

// Function to load settings from storage
async function loadSettings() {
    const settings = await browser.storage.local.get(Object.keys(defaultSettings));
    return { ...defaultSettings, ...settings };
}

// Function to initialize settings
async function initializeSettings() {
    const settings = await loadSettings();
    
    // Set initial values for settings inputs
    document.getElementById('enableGhostIcon').checked = settings.enableGhostIcon;
    document.getElementById('enableSpecialJarIcon').checked = settings.enableSpecialJarIcon;
    document.getElementById('enablePartitionIcon').checked = settings.enablePartitionIcon;
    document.getElementById('enableActiveTabHighlight').checked = settings.enableActiveTabHighlight;
    document.getElementById('mycleanerCookies').checked = settings.mycleanerCookies;
    document.getElementById('mycleanerBrowsingHistory').checked = settings.mycleanerBrowsingHistory;
    document.getElementById('mycleanerCache').checked = settings.mycleanerCache;
    document.getElementById('mycleanerAutofill').checked = settings.mycleanerAutofill;
    document.getElementById('mycleanerDownloadHistory').checked = settings.mycleanerDownloadHistory;
    document.getElementById('mycleanerService').checked = settings.mycleanerService;
    document.getElementById('mycleanerPlugin').checked = settings.mycleanerPlugin;
    document.getElementById('mycleanerLocal').checked = settings.mycleanerLocal;
    document.getElementById('mycleanerIndexed').checked = settings.mycleanerIndexed;
    document.getElementById('mycleanerPasswords').checked = settings.mycleanerPasswords;

    // Event listeners for settings changes
    document.getElementById('enableGhostIcon').addEventListener('change', async function() {
        settings.enableGhostIcon = this.checked;
        await saveSettings({ enableGhostIcon: settings.enableGhostIcon });
    });

    document.getElementById('enableSpecialJarIcon').addEventListener('change', async function() {
        settings.enableSpecialJarIcon = this.checked;
        await saveSettings({ enableSpecialJarIcon: settings.enableSpecialJarIcon });
    });

    document.getElementById('enablePartitionIcon').addEventListener('change', async function() {
        settings.enablePartitionIcon = this.checked;
        await saveSettings({ enablePartitionIcon: settings.enablePartitionIcon });
    });

    document.getElementById('enableActiveTabHighlight').addEventListener('change', async function() {
        settings.enableActiveTabHighlight = this.checked;
        await saveSettings({ enableActiveTabHighlight: settings.enableActiveTabHighlight });
    });

    document.getElementById('mycleanerCookies').addEventListener('change', async function() {
        settings.mycleanerCookies = this.checked;
        await saveSettings({ mycleanerCookies: settings.mycleanerCookies });
    });

    document.getElementById('mycleanerBrowsingHistory').addEventListener('change', async function() {
        settings.mycleanerBrowsingHistory = this.checked;
        await saveSettings({ mycleanerBrowsingHistory: settings.mycleanerBrowsingHistory });
    });

    document.getElementById('mycleanerCache').addEventListener('change', async function() {
        settings.mycleanerCache = this.checked;
        await saveSettings({ mycleanerCache: settings.mycleanerCache });
    });

    document.getElementById('mycleanerAutofill').addEventListener('change', async function() {
        settings.mycleanerAutofill = this.checked;
        await saveSettings({ mycleanerAutofill: settings.mycleanerAutofill });
    });

    document.getElementById('mycleanerDownloadHistory').addEventListener('change', async function() {
        settings.mycleanerDownloadHistory = this.checked;
        await saveSettings({ mycleanerDownloadHistory: settings.mycleanerDownloadHistory });
    });

    document.getElementById('mycleanerService').addEventListener('change', async function() {
        settings.mycleanerService = this.checked;
        await saveSettings({ mycleanerService: settings.mycleanerService });
    });

    document.getElementById('mycleanerPlugin').addEventListener('change', async function() {
        settings.mycleanerPlugin = this.checked;
        await saveSettings({ mycleanerPlugin: settings.mycleanerPlugin });
    });

    document.getElementById('mycleanerLocal').addEventListener('change', async function() {
        settings.mycleanerLocal = this.checked;
        await saveSettings({ mycleanerLocal: settings.mycleanerLocal });
    });

    document.getElementById('mycleanerIndexed').addEventListener('change', async function() {
        settings.mycleanerIndexed = this.checked;
        await saveSettings({ mycleanerIndexed: settings.mycleanerIndexed });
    });

    document.getElementById('mycleanerPasswords').addEventListener('change', async function() {
        settings.mycleanerPasswords = this.checked;
        await saveSettings({ mycleanerPasswords: settings.mycleanerPasswords });
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

// Initialize settings on page load
document.addEventListener('DOMContentLoaded', initializeSettings);