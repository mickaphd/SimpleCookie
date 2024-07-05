/* SimpleCookie, a minimalist yet efficient cookie manager for Firefox */
/* Made with ❤ by micka */

// Theme
const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

// Set theme styles based on dark mode preference
document.body.style.cssText = `
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
    font-size: 15px;
    background-color: ${isDarkMode ? '#23222B' : '#FFFFFF'};
    color: ${isDarkMode ? '#FCFCFF' : '#000000'};
`;

// Settings
document.addEventListener('DOMContentLoaded', async function() {
  const toggleIcons = document.querySelectorAll('.toggle-icon');

  // Function to handle click events on toggle icons
  const handleClick = async function() {
    const setting = this.getAttribute('data-setting');

    // Retrieve current settings from local storage
    const settings = await browser.storage.local.get(['setting1', 'setting2', 'setting3']);
    const value = !settings[setting];

    // Update the setting in local storage
    await browser.storage.local.set({ [setting]: value });

    // Update the icon appearance based on the new setting value
    this.className = value ? 'fas fa-toggle-on toggle-icon' : 'fas fa-toggle-off toggle-icon';

    // Setting 1: If toggled, update the cookies.onChanged listener
    if (setting === 'setting1') {
      if (value) {
        browser.cookies.onChanged.addListener(handleCookieChangeNotification);
      } else {
        browser.cookies.onChanged.removeListener(handleCookieChangeNotification);
      }
    }
  };

  // Add click event listener to each toggle icon
  toggleIcons.forEach(icon => {
    icon.addEventListener('click', handleClick);
  });

  // Initialize settings based on stored values
  const settings = await browser.storage.local.get(['setting1', 'setting2', 'setting3']);

  // Set the initial state of the icons based on the stored settings
  toggleIcons.forEach((icon, index) => {
    icon.className = settings[`setting${index + 1}`] ? 'fas fa-toggle-on toggle-icon' : 'fas fa-toggle-off toggle-icon';
  });
});