/* SimpleCookie, a minimalist yet efficient cookie manager for Firefox */
/* Made with ❤ by micka from Paris */

/* Shared message box for create.html and settings.html — same idea as      */
/* theme.css for the styles: these two pages each used to keep their own    */
/* copy of this code. */

// ==================== UI MESSAGING ====================

const MESSAGE_DISPLAY_DURATION = 5000; // ms

// Timer that hides the message currently on screen
let messageHideTimeout = null;

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

    // Auto-hide after 5 seconds. The previous message's timer is cancelled
    // first — otherwise a message shown shortly after another one would be
    // hidden early, by the first message's timer.
    clearTimeout(messageHideTimeout);
    messageHideTimeout = setTimeout(() => {
        messageBox.style.display = 'none';
    }, MESSAGE_DISPLAY_DURATION);
}

// Close message box
document.getElementById('closeMessage')?.addEventListener('click', () => {
    document.getElementById('messageBox').style.display = 'none';
});
