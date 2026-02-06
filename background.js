/* SimpleCookie, a minimalist yet efficient cookie manager for Firefox */
/* Made with ❤ by micka from Paris */

// ==================== CONSTANTS ====================

const BADGE_UPDATE_DELAY = 100; // ms
const BADGE_UPDATE_DEBOUNCE = 300; // ms for debouncing rapid updates

// ==================== STATE ====================

let activeTabId = null;
let activeDomain = null;
let badgeUpdateTimeout = null; // Debounce timer

// ==================== INITIALIZATION ====================

/**
 * Initializes the background script with active tab information
 */
async function initializeBackground() {
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0) {
            activeTabId = tabs[0].id;
            updateActiveDomain(tabs[0].url);
            // Update badge immediately on startup
            await updateBadgeFromBackground();
        }
    } catch (error) {
        console.error('Error initializing background:', error);
    }
}

// Initialize on script load
initializeBackground();

// ==================== EVENT LISTENERS ====================

/**
 * Listen for tab changes
 */
browser.tabs.onActivated.addListener(async (activeInfo) => {
    activeTabId = activeInfo.tabId;
    try {
        const tab = await browser.tabs.get(activeTabId);
        updateActiveDomain(tab.url);
        // Ensure badge updates immediately when tab changes
        await updateBadgeFromBackground();
    } catch (error) {
        console.error('Error getting tab info:', error);
        activeDomain = null;
    }
});

/**
 * Listen for URL changes within the active tab
 */
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only update if this is the active tab
    if (tabId === activeTabId && changeInfo.url) {
        updateActiveDomain(changeInfo.url);
        await updateBadgeFromBackground();
    }
});

/**
 * Listen for cookie changes and update badge with debouncing
 */
browser.cookies.onChanged.addListener(async () => {
    // Clear existing timeout to avoid rapid updates
    if (badgeUpdateTimeout) {
        clearTimeout(badgeUpdateTimeout);
    }
    
    // Debounce the badge update to avoid excessive calls
    badgeUpdateTimeout = setTimeout(() => {
        updateBadgeFromBackground();
    }, BADGE_UPDATE_DEBOUNCE);
});

/**
 * Listen for setting changes
 */
browser.storage.onChanged.addListener(async (changes) => {
    if (changes.showCookieCountBadge) {
        await updateBadgeFromBackground();
    }
});

// ==================== MESSAGE HANDLING ====================

/**
 * Listen for messages from popup
 */
browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'updateBadge') {
        await updateBadgeFromBackground();
        sendResponse({ success: true });
    }
});

// ==================== BADGE LOGIC ====================

/**
 * Updates badge based on active tab domain
 */
async function updateBadgeFromBackground() {
    try {
        const settings = await browser.storage.local.get({
            showCookieCountBadge: false
        });
        
        if (!settings.showCookieCountBadge || !activeDomain) {
            await browser.action.setBadgeText({ text: '' });
            return;
        }
        
        const cookieCount = await countCookiesForDomain(activeDomain);
        const badgeText = cookieCount > 0 ? String(cookieCount) : '';
        await browser.action.setBadgeText({ text: badgeText });
        
        // Set badge colors - Dark brown background with white text
        if (badgeText) {
            await browser.action.setBadgeBackgroundColor({ color: '#63280B' });
            
            await browser.action.setBadgeTextColor({ color: '#FFFFFF' });
        }
    } catch (error) {
        console.error('Error updating badge:', error);
    }
}

/**
 * Counts cookies for a specific domain - OPTIMIZED VERSION
 * @param {string} hostname - The hostname to count cookies for
 * @returns {Promise<number>} Number of cookies for the domain
 */
async function countCookiesForDomain(hostname) {
    try {
        if (!hostname) return 0;
        
        const mainDomain = extractMainDomain(hostname);
        const containers = await browser.contextualIdentities.query({});
        const storeIds = [...containers.map(c => c.cookieStoreId), ""];
        
        let count = 0;
        const seenCookies = new Set(); // Track seen cookies to avoid duplicates
        
        for (const storeId of storeIds) {
            try {
                const [normalCookies, partitionedCookies] = await Promise.all([
                    browser.cookies.getAll({ storeId }),
                    browser.cookies.getAll({ storeId, partitionKey: {} })
                ]);
                
                // Process all cookies in one array
                const allCookies = [...normalCookies, ...partitionedCookies];
                
                for (const cookie of allCookies) {
                    // Filter by domain immediately (early exit for non-matching domains)
                    if (extractMainDomain(cookie.domain) !== mainDomain) {
                        continue;
                    }
                    
                    // Create shorter key for faster comparisons
                    const key = `${cookie.name}|${cookie.domain}|${cookie.path}`;
                    
                    // Check if this cookie has already been counted
                    if (!seenCookies.has(key)) {
                        seenCookies.add(key);
                        count++;
                    }
                }
            } catch (error) {
                console.error(`Error fetching cookies for store ${storeId}:`, error);
            }
        }
        
        return count;
    } catch (error) {
        console.error('Error counting cookies:', error);
        return 0;
    }
}

/**
 * Updates active domain from URL
 * @param {string} url - The URL to extract domain from
 */
function updateActiveDomain(url) {
    try {
        const urlObj = new URL(url);
        activeDomain = urlObj.hostname;
    } catch (error) {
        console.error('Invalid URL:', error);
        activeDomain = null;
    }
}

/**
 * Extracts main domain from hostname
 * Added handling for special cases
 * @param {string} domain - Domain to extract from
 * @returns {string} Main domain
 */
function extractMainDomain(domain) {
    if (!domain) return '';
    try {
        // Remove 'www.' and filter empty parts
        const parts = domain.split('.').filter(p => p && p !== 'www');
        
        if (parts.length < 2) return domain;
        
        // Handle special cases like localhost
        if (parts[0] === 'localhost') return domain;
        
        // Return last 2 parts (domain.tld)
        return parts.slice(-2).join('.');
    } catch (error) {
        console.error('Error extracting main domain:', error);
        return domain;
    }
}
