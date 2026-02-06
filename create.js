/* SimpleCookie, a minimalist yet efficient cookie manager for Firefox */
/* Made with ❤ by micka from Paris */

// ==================== CONSTANTS ====================

const MESSAGE_DISPLAY_DURATION = 5000; // ms
const CONTAINER_LOAD_DELAY = 100; // ms

// ==================== THEME MANAGEMENT ====================

/**
 * Applies the appropriate theme based on system preference
 */
function applyTheme() {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
    }
}

applyTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// ==================== UI MESSAGING ====================

/**
 * Displays a message to the user with automatic timeout
 * @param {string} message - The message to display
 * @param {boolean} isError - Whether this is an error message
 */
function showMessage(message, isError = false) {
    const messageBox = document.getElementById('messageBox');
    const messageText = document.getElementById('messageText');
    
    if (!messageBox || !messageText) return;
    
    messageText.textContent = message;
    messageBox.classList.remove('success-message', 'error-message');
    messageBox.classList.add(isError ? 'error-message' : 'success-message');
    messageBox.style.display = 'block';
    
    setTimeout(() => {
        messageBox.style.display = 'none';
    }, MESSAGE_DISPLAY_DURATION);
}

// ==================== VALIDATION HELPERS ====================

/**
 * Month name to number mapping for date parsing
 */
const MONTH_MAP = {
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

/**
 * Validates if a domain is in correct format
 * @param {string} domain - Domain to validate
 * @returns {boolean} True if domain is valid
 */
function isValidDomain(domain) {
    if (!domain) return false;
    if (domain === 'localhost') return true;
    
    const domainToCheck = domain.startsWith('.') ? domain.substring(1) : domain;
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domainToCheck) && domainToCheck.includes('.');
}

/**
 * Parses expiration date in various formats
 * @param {string} dateString - Date string to parse
 * @returns {string|null} Formatted date string (YYYY-MM-DD) or null
 */
function parseExpirationDate(dateString) {
    if (!dateString || dateString === 'Session') return null;
    
    try {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
        
        const dateRegex = /(\\d{1,2})\\s+([A-Za-z]{3,})\\s+(\\d{4})/;
        const match = dateString.match(dateRegex);
        
        if (match) {
            const day = match[1].padStart(2, '0');
            const month = MONTH_MAP[match[2].toLowerCase()] || '01';
            return `${match[3]}-${month}-${day}`;
        }
    } catch (error) {
        console.error('Date parsing error:', error);
    }
    
    return null;
}

/**
 * Maps SameSite attribute values to standard format
 * @param {string} value - SameSite value to map
 * @returns {string} Mapped SameSite value
 */
function mapSameSiteValue(value) {
    if (!value) return 'no_restriction';
    const lowerValue = String(value).toLowerCase();
    return (lowerValue === 'strict' || lowerValue === 'lax') ? lowerValue : 'no_restriction';
}

// ==================== FIREFOX CONTAINER MANAGEMENT ====================

/**
 * Populates the container dropdown with available Firefox containers
 */
async function populateContainerDropdown() {
    try {
        const storeIdSelect = document.getElementById('storeId');
        if (!storeIdSelect) return;
        
        const defaultOption = document.createElement('option');
        defaultOption.value = 'firefox-default';
        defaultOption.textContent = 'Default (No Container)';
        storeIdSelect.innerHTML = '';
        storeIdSelect.appendChild(defaultOption);
        
        const containers = await browser.contextualIdentities.query({});
        containers.sort((a, b) => a.name.localeCompare(b.name));
        
        containers.forEach(container => {
            const option = document.createElement('option');
            option.value = container.cookieStoreId;
            option.textContent = container.name;
            storeIdSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching containers:', error);
        const storeIdSelect = document.getElementById('storeId');
        if (storeIdSelect) {
            storeIdSelect.innerHTML = '<option value="firefox-default">Default Container</option>';
        }
    }
}

// ==================== FORM HANDLING ====================

/**
 * Populates the form with data from URL query parameters
 * Used for editing existing cookies
 */
function populateFormFromQueryParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedData = urlParams.get('data');
    
    if (!encodedData) return;

    try {
        const cookieData = JSON.parse(decodeURIComponent(encodedData));
        window.originalCookieData = cookieData;
        
        document.getElementById('name').value = cookieData.name || '';
        document.getElementById('value').value = cookieData.value || '';
        document.getElementById('domain').value = cookieData.domain || '';
        document.getElementById('path').value = cookieData.path || '/';
        document.getElementById('secure').value = (cookieData.secure === true || cookieData.secure === 'true') ? 'true' : 'false';
        document.getElementById('httpOnly').value = (cookieData.httpOnly === true || cookieData.httpOnly === 'true') ? 'true' : 'false';
        document.getElementById('sameSite').value = mapSameSiteValue(cookieData.sameSite);
        
        if (cookieData.partition) {
            document.getElementById('partitionKey').value = cookieData.partition;
        }
        
        if (cookieData.container) {
            setTimeout(() => {
                const storeIdSelect = document.getElementById('storeId');
                if (storeIdSelect) {
                    const containerValue = cookieData.container.startsWith('firefox-') ? 
                        cookieData.container : `firefox-${cookieData.container}`;
                    for (const option of storeIdSelect.options) {
                        if (option.value === containerValue || 
                            option.textContent.toLowerCase() === cookieData.container.toLowerCase()) {
                            option.selected = true;
                            break;
                        }
                    }
                }
            }, CONTAINER_LOAD_DELAY);
        }
        
        if (cookieData.firstPartyDomain) {
            document.getElementById('firstPartyDomain').value = cookieData.firstPartyDomain;
        }
        
        const formattedDate = parseExpirationDate(cookieData.expiration);
        if (formattedDate) {
            document.getElementById('expirationDate').value = formattedDate;
        }
        
        const submitButton = document.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.textContent = 'Update Cookie';
        }
        
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
 * Handles the form submission to create or update a cookie
 * @param {Event} event - Form submission event
 */
async function createCookie(event) {
    event.preventDefault();
    
    const isEditing = !!window.originalCookieData;
    
    try {
        const name = document.getElementById('name')?.value.trim() || '';
        const value = document.getElementById('value')?.value || '';
        let domain = document.getElementById('domain')?.value.trim() || '';
        const path = document.getElementById('path')?.value.trim() || '/';
        
        if (!name || !domain || !path) {
            throw new Error('Name, domain and path are required fields');
        }
        
        if (!isValidDomain(domain)) {
            throw new Error('Please enter a valid domain (e.g., example.com or .example.com)');
        }
        
        const secure = document.getElementById('secure')?.value === 'true';
        const httpOnly = document.getElementById('httpOnly')?.value === 'true';
        const sameSite = document.getElementById('sameSite')?.value || 'no_restriction';
        
        // Remove original cookie if editing
        if (isEditing) {
            try {
                const originalData = window.originalCookieData;
                const domainToUse = originalData.domain || '';
                const urlDomain = domainToUse.startsWith('.') ? domainToUse.substring(1) : domainToUse;
                const removalUrl = `http${originalData.secure ? 's' : ''}://${urlDomain}${originalData.path}`;
                
                const removeOptions = {
                    url: removalUrl,
                    name: originalData.name,
                    domain: domainToUse || undefined,
                    path: originalData.path || '/',
                };
                
                if (originalData.container && originalData.container !== 'default') {
                    const containerId = originalData.container;
                    removeOptions.storeId = containerId.startsWith('firefox-') ? 
                        containerId : `firefox-${containerId}`;
                }
                
                if (originalData.partition) {
                    let topLevelSite = originalData.partition;
                    if (!topLevelSite.startsWith('http://') && !topLevelSite.startsWith('https://')) {
                        topLevelSite = 'https://' + topLevelSite;
                    }
                    removeOptions.partitionKey = { topLevelSite };
                }
                
                await browser.cookies.remove(removeOptions);
            } catch (error) {
                console.error('Error removing original cookie:', error);
            }
        }
        
        // Create the cookie
        const urlDomain = domain.startsWith('.') ? domain.substring(1) : domain;
        const url = `http${secure ? 's' : ''}://${urlDomain}${path}`;
        
        const cookieData = {
            url: url,
            name: name,
            value: value,
            path: path,
            secure: secure,
            httpOnly: httpOnly,
            sameSite: sameSite
        };
        
        const wantHostOnly = !domain.startsWith('.');
        if (!wantHostOnly) {
            cookieData.domain = domain;
        }
        
        // Add partition key if specified
        const partitionKey = document.getElementById('partitionKey')?.value.trim();
        if (partitionKey) {
            let topLevelSite = partitionKey;
            if (!topLevelSite.startsWith('http://') && !topLevelSite.startsWith('https://')) {
                topLevelSite = 'https://' + topLevelSite;
            }
            cookieData.partitionKey = { topLevelSite };
        }
        
        // Add store ID if specified
        const storeId = document.getElementById('storeId')?.value.trim();
        if (storeId && storeId !== 'default') {
            cookieData.storeId = storeId;
        }
        
        // Add first party domain if specified
        const firstPartyDomain = document.getElementById('firstPartyDomain')?.value.trim();
        if (firstPartyDomain) {
            cookieData.firstPartyDomain = firstPartyDomain;
        }
        
        // Add expiration date if specified
        const expirationDate = document.getElementById('expirationDate')?.value;
        if (expirationDate) {
            const expirationTimestamp = Math.floor(new Date(expirationDate).getTime() / 1000);
            if (!isNaN(expirationTimestamp)) {
                cookieData.expirationDate = expirationTimestamp;
            }
        }
        
        const result = await browser.cookies.set(cookieData);
        
        if (!result) {
            throw new Error('Failed to set cookie. The browser may have rejected it.');
        }
        
        const successMessage = isEditing ? 'Cookie updated successfully!' : 'Cookie created successfully!';
        showMessage(successMessage);
        
        if (!isEditing) {
            document.getElementById('createCookieForm')?.reset();
        }
    } catch (error) {
        console.error(`Failed to ${isEditing ? 'update' : 'create'} cookie:`, error);
        showMessage(`Error: ${error.message}`, true);
    }
}

// ==================== INITIALIZATION ====================

/**
 * Initializes the form when DOM is fully loaded
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await populateContainerDropdown();
        document.getElementById('createCookieForm')?.addEventListener('submit', createCookie);
        document.getElementById('closeMessage')?.addEventListener('click', function() {
            document.getElementById('messageBox').style.display = 'none';
        });
        populateFormFromQueryParams();
    } catch (error) {
        console.error('Error during form initialization:', error);
    }
});
