/* SimpleCookie, a minimalist yet efficient cookie manager for Firefox */
/* Made with ❤ by micka */

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
    showIconsContainer: true
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
    const {
        enableGhostIcon,
        enableActiveTabHighlight,
        enableSpecialJarIcon,
        enablePartitionIcon,
        showIconsContainer
    } = settings;

    // Set initial values for settings inputs
    document.getElementById('enableGhostIcon').checked = enableGhostIcon;
    document.getElementById('enableSpecialJarIcon').checked = enableSpecialJarIcon;
    document.getElementById('enablePartitionIcon').checked = enablePartitionIcon;
    document.getElementById('enableActiveTabHighlight').checked = enableActiveTabHighlight;
    document.getElementById('showIconsContainer').checked = showIconsContainer;

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

    document.getElementById('showIconsContainer').addEventListener('change', async function() {
        settings.showIconsContainer = this.checked;
        await saveSettings({ showIconsContainer: settings.showIconsContainer });
    });
}

// Event listener for the tip bolt icon
document.getElementById('tipIcon').addEventListener('click', function() {
    document.getElementById('imagePopup').style.display = 'block';
    document.getElementById('overlay').style.display = 'block';
});

// Close the tip qrcode when clicking outside of it
document.getElementById('overlay').addEventListener('click', function() {
    document.getElementById('imagePopup').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
});

// Initialize settings on page load
document.addEventListener('DOMContentLoaded', initializeSettings);