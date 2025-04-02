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


// ==================== VALIDATION HELPERS ====================

/**
 * Validates domain format
 * @param {string} domain - Domain to validate
 * @returns {boolean} True if domain is valid
 */
function isValidDomain(domain) {
    if (!domain) return false;
    
    // Allow localhost
    if (domain === 'localhost') return true;
    
    // Strip leading dot for validation
    const domainToCheck = domain.startsWith('.') ? domain.substring(1) : domain;
    
    // Standard domain validation (letters, numbers, hyphens, dots, and at least one dot)
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domainToCheck) && domainToCheck.includes('.');
}

/**
 * Parses expiration date from various formats
 * @param {string} dateString - Date string to parse
 * @returns {string|null} Formatted date string (YYYY-MM-DD) or null
 */
function parseExpirationDate(dateString) {
    if (!dateString || dateString === 'Session') return null;
    
    try {
        // Try direct Date parsing first
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            // Format as YYYY-MM-DD
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
        
        // Match patterns like "DD Mon YYYY" (12 Sep 2025)
        const dateRegex = /(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/;
        const match = dateString.match(dateRegex);
        
        if (match) {
            const day = match[1].padStart(2, '0');
            const month = getMonthNumber(match[2]);
            const year = match[3];
            
            return `${year}-${month}-${day}`;
        }
    } catch (error) {
        console.error('Date parsing error:', error);
    }
    
    return null;
}

/**
 * Converts month name to number
 * @param {string} monthName - Month name (e.g., 'Jan', 'January')
 * @returns {string} Month number as 2-digit string (e.g., '01')
 */
function getMonthNumber(monthName) {
    const months = {
        'jan': '01', 'january': '01',
        'feb': '02', 'february': '02',
        'mar': '03', 'march': '03',
        'apr': '04', 'april': '04',
        'may': '05',
        'jun': '06', 'june': '06',
        'jul': '07', 'july': '07',
        'aug': '08', 'august': '08',
        'sep': '09', 'september': '09',
        'oct': '10', 'october': '10',
        'nov': '11', 'november': '11',
        'dec': '12', 'december': '12'
    };
    
    const key = monthName.toLowerCase();
    return months[key] || '01';
}

/**
 * Maps SameSite values to browser API values
 * @param {string} value - SameSite value
 * @returns {string} Mapped SameSite value
 */
function mapSameSiteValue(value) {
    if (!value) return 'no_restriction';
    
    const lowerValue = String(value).toLowerCase();
    
    if (lowerValue === 'strict') return 'strict';
    if (lowerValue === 'lax') return 'lax';
    return 'no_restriction';
}


// ==================== FORM HANDLING ====================

/**
 * Populates form fields from URL query parameters
 * Used for editing existing cookies
 */
function populateFormFromQueryParams() {
    // Check if there are query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const encodedData = urlParams.get('data');
    
    if (!encodedData) return; // No data to populate
    
    try {
        // Decode and parse the JSON data
        const cookieData = JSON.parse(decodeURIComponent(encodedData));
        
        // Store original data for reference during updates
        window.originalCookieData = cookieData;
        
        // Populate the form fields
        document.getElementById('name').value = cookieData.name || '';
        document.getElementById('value').value = cookieData.value || '';
        document.getElementById('domain').value = cookieData.domain || '';
        document.getElementById('path').value = cookieData.path || '/';
        
        // Set secure dropdown
        document.getElementById('secure').value = 
            cookieData.secure === true || cookieData.secure === 'true' ? 'true' : 'false';
        
        // Set httpOnly dropdown
        document.getElementById('httpOnly').value = 
            cookieData.httpOnly === true || cookieData.httpOnly === 'true' ? 'true' : 'false';
        
        // Set sameSite dropdown
        const sameSiteValue = mapSameSiteValue(cookieData.sameSite);
        document.getElementById('sameSite').value = sameSiteValue;
        
        // Set partition key if available
        if (cookieData.partition) {
            document.getElementById('partitionKey').value = cookieData.partition;
        }
        
        // Set container ID if available
        if (cookieData.container && cookieData.container !== 'default') {
            document.getElementById('storeId').value = cookieData.container;
        }
        
        // Set first party domain if available
        if (cookieData.firstPartyDomain) {
            document.getElementById('firstPartyDomain').value = cookieData.firstPartyDomain;
        }
        
        // Handle expiration date
        const formattedDate = parseExpirationDate(cookieData.expiration);
        if (formattedDate) {
            document.getElementById('expirationDate').value = formattedDate;
        }
        
        // Change button text to indicate editing
        const submitButton = document.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.textContent = 'Update Cookie';
        }
        
        // Update header to indicate editing
        const header = document.querySelector('h1');
        if (header) {
            header.innerHTML = 'SimpleCookie | <b>Edit Cookie</b>';
        }
    } catch (error) {
        console.error('Error populating form:', error);
        showMessage('Error loading cookie data for editing', true);
    }
}

/**
 * Creates or updates a cookie with the provided parameters
 * @param {Event} event - Form submission event
 */
async function createCookie(event) {
    event.preventDefault();
    
    // Check if we're editing an existing cookie
    const isEditing = !!window.originalCookieData;
    
    try {
        // Get required values
        const name = document.getElementById('name')?.value.trim() || '';
        const value = document.getElementById('value')?.value || '';
        let domain = document.getElementById('domain')?.value.trim() || '';
        const path = document.getElementById('path')?.value.trim() || '/';
        
        // Basic validation
        if (!name || !domain || !path) {
            throw new Error('Name, domain and path are required fields');
        }
        
        // Validate domain format
        if (!isValidDomain(domain)) {
            throw new Error('Please enter a valid domain (e.g., example.com or .example.com)');
        }
        
        // Get cookie attributes
        const secure = document.getElementById('secure')?.value === 'true';
        const httpOnly = document.getElementById('httpOnly')?.value === 'true';
        const sameSite = document.getElementById('sameSite')?.value || 'no_restriction';
        
        // If editing, first remove the existing cookie
        if (isEditing) {
            try {
                const originalData = window.originalCookieData;
                
                // Determine if domain had leading dot in original cookie
                const domainToUse = originalData.domain || '';
                
                // Create URL for removing the cookie - ensure no leading dot in URL
                const urlDomain = domainToUse.startsWith('.') ? domainToUse.substring(1) : domainToUse;
                const removalUrl = `http${originalData.secure ? 's' : ''}://${urlDomain}${originalData.path}`;
                
                // Basic removal options
                const removeOptions = {
                    url: removalUrl,
                    name: originalData.name,
                };
                
                // Add domain exactly as it was stored
                if (domainToUse) {
                    removeOptions.domain = domainToUse;
                }
                
                // Add storeId if present
                if (originalData.container && originalData.container !== 'default') {
                    // Handle different formats of container IDs
                    const containerId = originalData.container;
                    removeOptions.storeId = containerId.startsWith('firefox-') ? 
                        containerId : `firefox-${containerId}`;
                }
                
                // Add partitionKey if present
                if (originalData.partition) {
                    let topLevelSite = originalData.partition;
                    // Ensure proper URL format
                    if (!topLevelSite.startsWith('http://') && !topLevelSite.startsWith('https://')) {
                        topLevelSite = 'https://' + topLevelSite;
                    }
                    removeOptions.partitionKey = { topLevelSite };
                }
                
                console.log('Removing original cookie with options:', removeOptions);
                const removed = await browser.cookies.remove(removeOptions);
                console.log('Cookie removal result:', removed);
                
                // If removal failed, show message but continue with creation
                if (!removed) {
                    console.warn('Could not find or remove the original cookie. Will attempt to create new cookie anyway.');
                }
            } catch (error) {
                console.warn('Error removing original cookie:', error);
                // Continue with cookie creation regardless
            }
        }
        
        // Prepare URL for setting the cookie (no leading dot)
        const urlDomain = domain.startsWith('.') ? domain.substring(1) : domain;
        const url = `http${secure ? 's' : ''}://${urlDomain}${path}`;
        
        // Build cookie data
        const cookieData = {
            url: url,
            name: name,
            value: value,
            path: path,
            secure: secure,
            httpOnly: httpOnly,
            sameSite: sameSite
        };
        
        // Determine if we should create a host-only cookie or domain cookie
        const wantHostOnly = !domain.startsWith('.');
        if (!wantHostOnly) {
            // If user explicitly entered domain with leading dot, create a domain cookie
            cookieData.domain = domain;
        }
        
        // Add partitionKey if provided
        const partitionKey = document.getElementById('partitionKey')?.value.trim();
        if (partitionKey) {
            let topLevelSite = partitionKey;
            if (!topLevelSite.startsWith('http://') && !topLevelSite.startsWith('https://')) {
                topLevelSite = 'https://' + topLevelSite;
            }
            cookieData.partitionKey = { topLevelSite };
        }
        
        // Add storeId if provided
        const storeId = document.getElementById('storeId')?.value.trim();
        if (storeId && storeId !== 'default') {
            // Ensure proper storeId format
            cookieData.storeId = storeId.startsWith('firefox-') ? 
                storeId : `firefox-${storeId}`;
        }
        
        // Add firstPartyDomain if provided
        const firstPartyDomain = document.getElementById('firstPartyDomain')?.value.trim();
        if (firstPartyDomain) {
            cookieData.firstPartyDomain = firstPartyDomain;
        }
        
        // Handle expiration date
        const expirationDate = document.getElementById('expirationDate')?.value;
        if (expirationDate) {
            const expirationTimestamp = Math.floor(new Date(expirationDate).getTime() / 1000);
            if (!isNaN(expirationTimestamp)) {
                cookieData.expirationDate = expirationTimestamp;
            }
        }
        
        // Log and create cookie
        console.log(`${isEditing ? 'Updating' : 'Creating'} cookie with:`, cookieData);
        const result = await browser.cookies.set(cookieData);
        console.log('Cookie set result:', result);
        
        if (!result) {
            throw new Error('Failed to set cookie. The browser may have rejected it.');
        }
        
        // Show success message
        const successMessage = isEditing ? 'Cookie updated successfully!' : 'Cookie created successfully!';
        showMessage(successMessage);
        
        // Only reset the form if creating new cookie (not editing)
        if (!isEditing) {
            document.getElementById('createCookieForm')?.reset();
        }
    } catch (error) {
        console.error(`Failed to ${isEditing ? 'update' : 'create'} cookie:`, error);
        showMessage(`Error: ${error.message}`, true);
    }
}


// ==================== INITIALIZATION ====================

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Add event listener for form submission
        document.getElementById('createCookieForm')?.addEventListener('submit', createCookie);
        
        // Add event listener for closing message box
        document.getElementById('closeMessage')?.addEventListener('click', function() {
            document.getElementById('messageBox').style.display = 'none';
        });
        
        // Populate form if we're editing a cookie
        populateFormFromQueryParams();
    } catch (error) {
        console.error('Error during form initialization:', error);
    }
});