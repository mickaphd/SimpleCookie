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

// Function to set the number of levels for main domain extraction
async function setNumLevels(levels) {
    numLevels = levels;
    await browser.storage.local.set({ numLevels: levels });
}

// Default number of levels for main domain extraction
let numLevels = -2;

// Function to update the value when the input changes
document.getElementById('num-levels-input').addEventListener('input', function() {
    setNumLevels(this.value);
});

// Function to get the number of levels from storage and update the variable
async function getNumLevels() {
    const result = await browser.storage.local.get('numLevels');
    if (result.numLevels !== undefined) {
        numLevels = result.numLevels;
        document.getElementById('num-levels-input').value = numLevels;
    }
}

// Call getNumLevels function to initialize the value on page load
getNumLevels();