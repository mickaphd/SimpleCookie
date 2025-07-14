/* SimpleCookie, a minimalist yet efficient cookie manager for Firefox */
/* Made with ❤ by micka from Paris */

// ==================== INITIALIZATION OF VARIABLES ====================

// Set to hold the tracking list
let trackingSites = new Set();

// Arrays to store cookie and tab objects
let cookies = [];
let tabs = [];

// Array to keep track of cookies that have been deleted for potential undo
let tempDeletedCookies = [];

// Variable to manage the timeout for the undo action
let undoTimeout;

// Load favorites from localStorage
const favorites = JSON.parse(localStorage.getItem('favorites')) || [];


// ==================== FETCHING THE DATA ====================

/**
 * Fetches the list of tracking websites from the local database
 * Loads the data only once (when the set is empty)
 */
async function fetchTrackerDB() {
    if (trackingSites.size > 0) return;
    
    try {
        const response = await fetch(browser.runtime.getURL('resources/trackerdb.txt'));
        const text = await response.text();
        trackingSites = new Set(text.split('\n').map(domain => domain.trim()).filter(Boolean));
    } catch (error) {
        console.error('Failed to load tracker database:', error);
    }
}

/**
 * Fetches all cookies from all containers and avoids duplicates
 * Retrieves both normal and partitioned cookies
 * @returns {Array} Array of unique cookie objects
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
        
        // More complete uniqueness check using all relevant properties
        const uniqueMap = new Map();
        
        allCookies.forEach(cookie => {
            // Create a comprehensive unique key for each cookie
            const key = `${cookie.name}-${cookie.domain}-${cookie.path}-${cookie.storeId}-${cookie.partitionKey ? JSON.stringify(cookie.partitionKey) : 'null'}-${cookie.value}-${cookie.expirationDate || 'session'}-${cookie.secure}-${cookie.httpOnly}-${cookie.sameSite}`;
            
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
 * Fetches all cookies and open tabs
 * Updates the cookie counter in the UI
 */
async function fetchCookiesAndTabs() {
    // Fetch cookies and store them in the cookies array
    cookies = await fetchAllCookies();
    
    // Update the cookie counter in the UI
    const cookieCounter = document.getElementById('cookie-counter');
    if (cookieCounter) {
        cookieCounter.textContent = cookies.length;
    }
    
    // Fetch all open tabs
    tabs = await browser.tabs.query({});
}

/**
 * Fetches tracking sites, cookies, and tabs concurrently
 */
async function fetchData() {
    await Promise.all([fetchTrackerDB(), fetchCookiesAndTabs()]);
}


// ==================== APPLYING THE SETTINGS ====================

/**
 * Applies user settings from storage
 * Merges stored settings with defaults
 */
async function applySettings() {
    const defaultSettings = {
        enableGhostIcon: true,
        enableSpecialJarIcon: true,
        enablePartitionIcon: true,
        enableActiveTabHighlight: true,
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
        OpenTabsTop: false
    };

    try {
        // Get settings from storage and merge with defaults
        const storedSettings = await browser.storage.local.get(defaultSettings);
        const settings = { ...defaultSettings, ...storedSettings };
        await browser.storage.local.set(settings);

        const { 
            enableGhostIcon, 
            enableSpecialJarIcon, 
            enablePartitionIcon, 
            enableActiveTabHighlight 
        } = settings;

        // Display cookies based on user preferences
        displayCookies(enableGhostIcon, enableSpecialJarIcon, enablePartitionIcon);

        // Highlight the active tab domain if enabled
        if (enableActiveTabHighlight) {
            highlightActiveTabDomain();
        }
    } catch (error) {
        console.error('Error applying settings:', error);
    }
}

/**
 * Initializes the extension by fetching data and applying settings
 * Shows a message and auto-closes if no cookies exist
 */
async function initExtension() {
    try {
        // First, check if any cookies exist
        cookies = await fetchAllCookies();
        
        // If no cookies exist, show message and auto-close
        if (!hasCookiesToDelete()) {
            showNoCoookiesMessage();
            return;
        }
        
        // Otherwise, continue with normal initialization
        await fetchData();
        await applySettings();
    } catch (error) {
        console.error('Error initializing extension:', error);
    }
}

/**
 * Displays a message when no cookies are found and auto-closes
 */
function showNoCoookiesMessage() {
    // Clear document body content
    document.body.innerHTML = '';
    document.body.style.display = 'flex';
    document.body.style.justifyContent = 'center';
    document.body.style.alignItems = 'center';
    document.body.style.padding = '20px';
    document.body.style.textAlign = 'center';
    document.body.style.height = '80px';
    document.body.style.width = '200px';
    
    // Create and add the message
    const messageElement = document.createElement('div');
    messageElement.textContent = 'No cookies found in your browser';
    messageElement.style.fontSize = '14px';
    messageElement.style.color = 'var(--text-color)';
    messageElement.style.fontWeight = '500';
    document.body.appendChild(messageElement);
    
    // Auto-close after 2.5 seconds
    setTimeout(() => {
        window.close();
    }, 2500);
}

/**
 * Updates the display with current cookies and tabs
 * Shows empty message if no cookies remain
 */
async function updateDisplay() {
    try {
        // Fetch cookies first
        cookies = await fetchAllCookies();
        
        // If we now have zero cookies, show message and return
        if (cookies.length === 0) {
            showNoCoookiesMessage();
            return;
        }
        
        // Continue with normal display update
        tabs = await browser.tabs.query({});
        
        // Update cookie counter
        const cookieCounter = document.getElementById('cookie-counter');
        if (cookieCounter) {
            cookieCounter.textContent = cookies.length;
        }
        
        // Get current settings
        const settings = await browser.storage.local.get([
            'enableGhostIcon',
            'enableSpecialJarIcon',
            'enablePartitionIcon',
            'enableActiveTabHighlight'
        ]);

        displayCookies(
            settings.enableGhostIcon, 
            settings.enableSpecialJarIcon, 
            settings.enablePartitionIcon
        );

        // Highlight active tab if enabled
        if (settings.enableActiveTabHighlight) {
            highlightActiveTabDomain();
        }
    } catch (error) {
        console.error('Error updating display:', error);
    }
}

// Initialize the extension when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initExtension);


// ==================== DISPLAYING THE DATA ====================

/**
 * Gets the current browser theme (dark or light)
 * @returns {string} 'dark' or 'light'
 */
function getCurrentTheme() {
    // Cache the result to avoid multiple DOM queries
    if (!getCurrentTheme.cache) {
        getCurrentTheme.cache = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        
        // Update the cache when the theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            getCurrentTheme.cache = e.matches ? 'dark' : 'light';
        });
    }
    
    return getCurrentTheme.cache;
}

/**
 * Displays cookies with favorites and insight icons
 * @param {boolean} enableGhostIcon - Whether to show tracking site icon
 * @param {boolean} enableSpecialJarIcon - Whether to show container icon
 * @param {boolean} enablePartitionIcon - Whether to show partition icon
 */

async function displayCookies(enableGhostIcon, enableSpecialJarIcon, enablePartitionIcon) {
  // Fetch the "OpenTabsTop" setting to determine sorting behavior
  const { OpenTabsTop = false } = await browser.storage.local.get('OpenTabsTop');

  const container = document.getElementById('cookies-container');
  const starDock = document.querySelector('.star-dock');
  if (!container) return; // Safety check

  // Clear previous content
  container.innerHTML = '';
  if (starDock) starDock.innerHTML = '';

  const fragment = document.createDocumentFragment();
  const starsFragment = document.createDocumentFragment();

  // Build a Set of main domains from open tabs for quick membership checks
  const openTabDomainsSet = new Set(tabs.map(({ url }) => {
    try {
      return getMainDomain(new URL(url).hostname);
    } catch {
      return '';
    }
  }).filter(Boolean));

  // Aggregate cookie info by main domain
  const domainInfo = {};
  cookies.forEach(cookie => {
    const mainDomain = getMainDomain(cookie.domain);
    if (!domainInfo[mainDomain]) {
      domainInfo[mainDomain] = {
        count: 0,
        hasNonDefaultContainer: false,
        hasPartition: false
      };
    }
    domainInfo[mainDomain].count += 1;

    if (cookie.storeId !== 'firefox-default') {
      domainInfo[mainDomain].hasNonDefaultContainer = true;
    }
    if (cookie.partitionKey) {
      domainInfo[mainDomain].hasPartition = true;
    }
  });

  // Convert domain info object to array for sorting
  let domainsArray = Object.entries(domainInfo);

  if (OpenTabsTop) {
    // Separate domains into those with open tabs and others
    const openTabsDomains = [];
    const otherDomains = [];

    domainsArray.forEach(([domain, info]) => {
      if (openTabDomainsSet.has(domain)) {
        openTabsDomains.push([domain, info]);
      } else {
        otherDomains.push([domain, info]);
      }
    });

    // Sort each group alphabetically by domain name
    openTabsDomains.sort(([a], [b]) => a.localeCompare(b));
    otherDomains.sort(([a], [b]) => a.localeCompare(b));

    // Concatenate open tab domains first, then others
    domainsArray = [...openTabsDomains, ...otherDomains];
  } else {
    // Sort all domains alphabetically if setting is disabled
    domainsArray.sort(([a], [b]) => a.localeCompare(b));
  }

  // Create and append DOM elements for each domain entry
  domainsArray.forEach(([website, info], index) => {
    const element = document.createElement('div');
    element.className = 'cookie-item';
    element.dataset.index = index;
    element.dataset.domain = website;
    element.textContent = `${website} (${info.count})`;
    element.title = `Left-click to delete all cookies for ${website}; right-click for detailed cookie information; press Command on macOS or Ctrl on PC to use the Tab Switcher function for the open tabs.`;

    // Favorite star icon
    const star = document.createElement('img');
    star.src = favorites.includes(website) ? 'resources/star_full.svg' : 'resources/star_empty.svg';
    star.alt = 'Favorite Star Icon';
    star.className = 'star-icon';
    star.dataset.website = website;
    star.dataset.index = index;

    star.addEventListener('click', (event) => {
      event.stopPropagation();
      if (favorites.includes(website)) {
        star.src = 'resources/star_empty.svg';
        const idx = favorites.indexOf(website);
        if (idx !== -1) favorites.splice(idx, 1);
      } else {
        star.src = 'resources/star_full.svg';
        favorites.push(website);
      }
      localStorage.setItem('favorites', JSON.stringify(favorites));
    });

    element.insertBefore(star, element.firstChild);
    fragment.appendChild(element);

    // Append insight icons based on settings and domain info
    if (enableGhostIcon && trackingSites.has(website)) {
      appendIcon(element, 'resources/insight_ghost.svg', `${website} tracking icon`);
    }
    if (enableSpecialJarIcon && info.hasNonDefaultContainer) {
      appendIcon(element, 'resources/insight_container.svg', `${website} container icon`);
    }
    if (enablePartitionIcon && info.hasPartition) {
      appendIcon(element, 'resources/insight_partition.svg', `${website} partition icon`);
    }

    // Highlight domains with open tabs in green color
    if (openTabDomainsSet.has(website)) {
      element.style.color = '#05A55D';
    }
  });

  container.appendChild(fragment);
  if (starDock) starDock.appendChild(starsFragment);

  // Position stars aligned with their domain entries after rendering
  requestAnimationFrame(() => positionStarsInDock());

  // Add this function here inside displayCookies
  function highlightActiveTabDomain() {
    const activeTab = tabs.find(tab => tab.active);
    if (!activeTab) return;

    try {
      const activeDomain = getMainDomain(new URL(activeTab.url).hostname);
      const container = document.getElementById('cookies-container');
      if (!container) return;

      // Remove any existing active tab icon
      container.querySelector('.active-tab-icon')?.remove();

      // Find the element for the active domain
      const activeElement = Array.from(container.childNodes).find(element => {
        const elementText = element.textContent.trim().split(' ')[0];
        return elementText && getMainDomain(elementText) === activeDomain;
      });

      if (activeElement) {
        const icon = document.createElement('img');
        icon.src = 'resources/insight_eye.svg';
        icon.alt = 'Active Tab Icon';
        icon.className = 'insight-icon active-tab-icon';

        activeElement.appendChild(document.createTextNode(' '));
        activeElement.appendChild(icon);
      }
    } catch (error) {
      console.error('Error highlighting active tab domain:', error);
    }
  }

  // Call it here at the end of displayCookies
  const settings = await browser.storage.local.get('enableActiveTabHighlight');
  if (settings.enableActiveTabHighlight) {
    highlightActiveTabDomain();
  }
}


/**
 * Helper function to append icon to an element
 * @param {HTMLElement} element - The element to add icon to
 * @param {string} iconSrc - Source of the icon
 * @param {string} altText - Alt text for the icon
 */
function appendIcon(element, iconSrc, altText) {
    const icon = document.createElement('img');
    icon.src = iconSrc;
    icon.alt = altText;
    icon.className = 'insight-icon';
    element.appendChild(document.createTextNode(' '));
    element.appendChild(icon);
}

/**
 * Positions stars in the vertical dock aligned with their domain entries
 */
function positionStarsInDock() {
    const container = document.getElementById('cookies-container');
    const starDock = document.querySelector('.star-dock');
    
    if (!container || !starDock) return;
    
    const stars = starDock.querySelectorAll('.star-icon');
    const domainElements = container.querySelectorAll('div');
    
    // Position each star next to its corresponding domain entry
    domainElements.forEach((element, index) => {
        if (index < stars.length) {
            const rect = element.getBoundingClientRect();
            const top = element.offsetTop + (rect.height / 2) - 7; // Center vertically
            
            stars[index].style.top = `${top}px`;
        }
    });
}

/**
 * Adds an icon to an element if condition is met
 * @param {HTMLElement} element - The element to add the icon to
 * @param {string} domain - The domain name
 * @param {string} iconSrc - The icon source URL
 * @param {boolean} condition - Whether to add the icon
 */
function updateIcon(element, domain, iconSrc, condition) {
    if (condition) {
        const icon = document.createElement('img');
        icon.src = iconSrc;
        icon.alt = `${domain} icon`;
        icon.className = 'insight-icon';
        element.appendChild(document.createTextNode(' '));
        element.appendChild(icon);
    }
}

/**
 * Highlights the domain of the active tab with an icon
 */
function highlightActiveTabDomain() {
    const activeTab = tabs.find(tab => tab.active);
    if (!activeTab) return;

    try {
        const activeDomain = getMainDomain(new URL(activeTab.url).hostname);
        const container = document.getElementById('cookies-container');
        if (!container) return;

        // Remove any existing active tab icon
        container.querySelector('.active-tab-icon')?.remove();

        // Find the element for the active domain
        const activeElement = Array.from(container.childNodes).find(element => {
            const elementText = element.textContent.trim().split(' ')[0];
            return elementText && getMainDomain(elementText) === activeDomain;
        });

        if (activeElement) {
            const icon = document.createElement('img');
            icon.src = 'resources/insight_eye.svg';
            icon.alt = 'Active Tab Icon';
            icon.className = 'insight-icon active-tab-icon';

            activeElement.appendChild(document.createTextNode(' '));
            activeElement.appendChild(icon);
        }
    } catch (error) {
        console.error('Error highlighting active tab domain:', error);
    }
}


// ==================== TAB SWITCHER ====================

/**
 * Highlights domains of open tabs more prominently when the platform-specific key is pressed
 * @param {boolean} isKeyPressed - Whether the modifier key is pressed
 */
function highlightOpenTabDomains(isKeyPressed) {
    const container = document.getElementById('cookies-container');
    if (!container) return;

    // Cache open tab domains
    const openTabDomains = new Set(tabs.map(({ url }) => {
        try {
            return getMainDomain(new URL(url).hostname);
        } catch (e) {
            return '';
        }
    }).filter(Boolean));

    // Loop through all domain elements
    Array.from(container.children).forEach(element => {
        const website = element.textContent.split(' ')[0];
        const mainDomain = getMainDomain(website);

        if (openTabDomains.has(mainDomain)) {
            // Normal appearance (just green text)
            element.style.color = '#05A55D';

            // Enhanced appearance when key is pressed
            if (isKeyPressed) {
                element.style.fontWeight = 'bold';
                element.style.transform = 'translateX(4px)';
                element.style.cursor = 'alias'; // Show 'goto' cursor
            } else {
                element.style.fontWeight = 'normal';
                element.style.transform = '';
                element.style.cursor = 'pointer';
            }
        } else {
            element.style.color = ''; // Reset color if not active
        }
    });
}

/**
 * Finds a tab that matches the given domain and activates it
 * @param {string} domain - Domain to navigate to
 * @returns {Promise<boolean>} - True if a tab was found and activated
 */
async function navigateToTab(domain) {
    const mainDomain = getMainDomain(domain);
    
    for (const tab of tabs) {
        try {
            const tabHostname = new URL(tab.url).hostname;
            const tabMainDomain = getMainDomain(tabHostname);
            
            // If domains match, switch to this tab
            if (isDomainOrSubdomain(tabMainDomain, mainDomain) || 
                isDomainOrSubdomain(mainDomain, tabMainDomain)) {
                
                if (!tab.active) {
                    await browser.tabs.update(tab.id, { active: true });
                    await browser.windows.update(tab.windowId, { focused: true });
                }
                window.close(); // Close popup after navigation
                return true;
            }
        } catch (e) {
            // Skip invalid URLs
            continue;
        }
    }
    
    return false;
}

/**
 * Determines if the platform-specific modifier key is pressed
 * @param {Event} event - The keyboard event
 * @returns {boolean} True if the platform-specific modifier key is pressed
 */
function isModifierKeyPressed(event) {
    const isMacOS = navigator.platform.toLowerCase().includes('mac');
    return isMacOS ? event.metaKey : event.ctrlKey;
}


// ==================== DETAILED TABLE ====================

/**
 * Displays detailed cookie information in a table format
 * @param {string} mainDomain - The main domain to display cookies for
 * @param {Array} cookies - Array of cookie objects
 */
function displayCookieDetails(mainDomain, cookies) {
    const isDarkMode = getCurrentTheme() === 'dark';
    
    // Filter and sort cookies for the given main domain
    const sortedCookies = cookies.filter(cookie => getMainDomain(cookie.domain) === mainDomain)
                                .sort((a, b) => a.name.localeCompare(b.name));
    
    const table = document.createElement('table');
    table.className = 'cookie-table';
    
    // Define table headers and their descriptions
    const headers = [
        { title: 'Name', description: 'The name of the cookie, which is used to identify it when sent between the client and the server.' },
        { title: 'Value', description: 'The value of the cookie, which is the data stored within the cookie.' },
        { title: 'Size', description: 'The size of the cookie in bytes using a function that encodes both the cookie name and value, where each character is assumed to be one byte.' },
        { title: 'Domain', description: 'The domain for which the cookie is valid. The cookie will only be sent to the specified domain and its subdomains.' },
        { title: 'Partition', description: 'Partition attribute for Cookies Having Independent Partitioned State (CHIPS). Without cookie partitioning, third-party cookies can track users across the web. CHIPS, on the other hand, are restricted to the specific site on which they are set, preventing cross-site tracking while still allowing useful functions such as maintaining state across a domain and its subdomains.' },
        { title: 'Container', description: 'The container in which the cookie is stored. Containers (also known as stores or jars) are used to separate cookies and other site data for different contexts or identities, allowing users to manage their online activities and privacy by keeping data from different sites separate. With Firefox Total Cookie Protection now enabled by default, most of your cookies are automatically restricted to the sites that created them, whether you use a specific container or not.' },
        { title: 'Expiration', description: 'The date on which the cookie will expire. A session cookie is a type of cookie that does not have an expiration date set. These cookies are stored in temporary memory and are deleted when closing the browser. Persistent cookies have an expiration date and are stored on the device until they expire or are explicitly deleted.' },
        { title: 'Secure', description: 'When this flag is set, the cookie will only be sent over secure (HTTPS) connections.' },
        { title: 'HttpOnly', description: 'When this flag is set, the cookie is not accessible via JavaScript.' },
        { title: 'SameSite', description: 'This attribute controls when the cookie will be sent in cross-site requests. It can be set to Strict, Lax, or None. Strict means the cookie will only be sent in a first-party context, Lax restricts the cookie to top-level navigation and safe HTTP methods, and None means the cookie will be sent in all contexts.' },
        { title: '', description: '' }
    ];
    
    // Create header row
    const headerRow = table.insertRow();
    headers.forEach(({ title, description }) => {
        const headerCell = document.createElement('th');
        headerCell.textContent = title;
        headerCell.title = description;
        headerCell.className = 'header-cell';
        headerRow.appendChild(headerCell);
    });
    
    const sameSiteMap = {
        'no_restriction': 'None',
        'lax': 'Lax',
        'strict': 'Strict'
    };
    
    /**
     * Adds a row for each cookie in the table
     * @param {Object} cookie - Cookie object
     */
    const addRow = (cookie) => {
        const row = table.insertRow();
        const { name, value, domain, partitionKey, storeId, expirationDate, secure, httpOnly, sameSite, path } = cookie;
        const cookieSize = calculateCookieSize(cookie);
        const formattedStoreId = storeId.replace(/^firefox-/, '');
        const expirationDateFormatted = formatExpirationDate(expirationDate);
        const partitionValue = partitionKey?.topLevelSite || '';
        
        // Check if the cookie is a favorite
        const isFavorite = favorites.includes(getMainDomain(cookie.domain));
        if (isFavorite) {
            row.style.opacity = '0.5';
        }
        
        // Prepare cell contents for the row
        const cellContents = [
            name, 
            value,
            cookieSize,
            domain,
            partitionValue,
            formattedStoreId,
            expirationDateFormatted || 'Session',
            secure ? 'Yes' : 'No',
            httpOnly ? 'Yes' : 'No',
            sameSiteMap[sameSite] || 'None',
            '✎' // Edit icon
        ];
        
        // Create and append cells to the row
        cellContents.forEach((content, index) => {
            const cell = document.createElement('td');
            cell.className = 'cell';
            
            if (index === cellContents.length - 1) {
                // This is the edit cell
                cell.textContent = content;
                cell.title = 'Edit this cookie. It is a BETA version so proceed with caution.';
                cell.style.cursor = 'pointer';
                cell.style.textAlign = 'center';
                cell.style.fontSize = '16px';
                
                cell.addEventListener('click', (event) => {
                    event.stopPropagation();

                    const cookieData = {
                        name: cookie.name,
                        value: cookie.value,
                        domain: cookie.domain,
                        path: cookie.path,
                        partition: partitionValue,
                        container: formattedStoreId,
                        expiration: expirationDateFormatted || '',
                        secure: cookie.secure,
                        httpOnly: cookie.httpOnly,
                        sameSite: cookie.sameSite || 'None',
                    };

                    const queryParams = new URLSearchParams();
                    queryParams.set('data', encodeURIComponent(JSON.stringify(cookieData)));
                    browser.tabs.create({ url: `create.html?${queryParams}` });
                });
            } else {
                cell.textContent = content;
                
                // Add tooltip to show full content on hover
                cell.addEventListener('mouseenter', function() {
                    if (!cell.title) {
                        cell.title = cell.textContent;
                    }
                });
            }
            
            // Check if this is the expiration date cell and if the cookie is expired
            if (index === 6 && expirationDate) {
                const now = Math.floor(Date.now() / 1000);
                if (expirationDate < now) {
                    cell.style.color = 'red';
                    cell.title = 'This cookie has expired.';
                }
            }
            
            row.appendChild(cell);
        });
        
        // Add event listeners for the row
        row.addEventListener('click', async (event) => {
            event.stopPropagation();
            if (isFavorite) {
                return; // Skip deletion for favorites
            }
            // Store the deleted cookie for undo functionality
            tempDeletedCookies.push({ ...cookie });
            await deleteCookie({
                name: cookie.name,
                domain: cookie.domain,
                path: cookie.path,
                secure: cookie.secure,
                storeId: cookie.storeId,
                partitionKey: cookie.partitionKey
            }, `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`);
            row.remove();
            showUndoIcon(); // Show undo option after deletion
        });
        
        // Add hover effects for the row
        row.addEventListener('mouseenter', function() {
            row.style.backgroundColor = isDarkMode ? '#5F5E68' : '#DFDFE4';
            row.style.cursor = 'pointer';
        });
        row.addEventListener('mouseleave', function() {
            row.style.backgroundColor = '';
            row.style.cursor = 'default';
        });
    };
    
    sortedCookies.forEach(addRow);
    document.body.appendChild(table);
}


// ==================== DELETION OF COOKIES ====================

/**
 * Deletes a cookie based on its properties
 * @param {Object} cookie - Cookie object with properties needed for deletion
 * @returns {Promise} Promise that resolves when the cookie is deleted
 */
async function deleteCookie(cookie) {
    const isFavorite = favorites.includes(getMainDomain(cookie.domain));
    if (isFavorite) return; // Skip deletion for favorites

    const cookieUrl = getCookieUrl(cookie);
    const storeId = cookie.storeId || '0';

    try {
        await browser.cookies.remove({
            url: cookieUrl,
            name: cookie.name,
            storeId: storeId,
            partitionKey: cookie.partitionKey
        });

        // Fetch cookies again to see if we've removed the last one
        cookies = await fetchAllCookies();
        
        // If no cookies left, show message and return
        if (cookies.length === 0) {
            showNoCoookiesMessage();
            return;
        }
        
        // Otherwise continue with normal update
        await updateDisplay();
    } catch (error) {
        console.error('Error deleting cookie:', error);
    }
}

/**
 * Deletes cookies based on a filter function
 * @param {Function} filterFn - Function that returns true for cookies to delete
 * @returns {Promise} Promise that resolves when all cookies are deleted
 */
async function deleteCookies(filterFn) {
    const cookiesToDelete = cookies.filter(filterFn);
    await Promise.all(cookiesToDelete.map(deleteCookie));
}

/**
 * Deletes all cookies for a specific domain
 * @param {string} domain - Domain to delete cookies for
 */
async function deleteAllCookiesForDomain(domain) {
    if (favorites.includes(getMainDomain(domain))) return; // Skip deletion for favorites

    try {
        const domainCookies = cookies.filter(cookie => 
            getMainDomain(cookie.domain) === getMainDomain(domain)
        );
        
        // Save for potential undo
        tempDeletedCookies = domainCookies.map(cookie => ({ ...cookie }));
        
        // Delete all cookies for this domain
        await deleteCookies(cookie => 
            getMainDomain(cookie.domain) === getMainDomain(domain)
        );
        
        // Fetch cookies again to see if we've removed everything
        cookies = await fetchAllCookies();
        
        // If no cookies left, show message and return
        if (cookies.length === 0) {
            showNoCoookiesMessage();
            return;
        }
        
        // Otherwise show undo icon and update display
        showUndoIcon();
        await updateDisplay();
    } catch (error) {
        console.error('Error deleting cookies for domain:', error);
    }
}

/**
 * Deletes cookies from tabs that are no longer open
 * @param {Array} closedTabsCookies - Array of cookies from closed tabs
 */
async function deleteCookiesFromClosedTabs(closedTabsCookies) {
    try {
        await deleteCookies(cookie => {
            return closedTabsCookies.includes(cookie) && 
                  !favorites.includes(getMainDomain(cookie.domain));
        });
        
        // Fetch cookies again to see if we've removed everything
        cookies = await fetchAllCookies();
        
        // If no cookies left, show message and return
        if (cookies.length === 0) {
            showNoCoookiesMessage();
            return;
        }
    } catch (error) {
        console.error('Error deleting cookies from closed tabs:', error);
    }
}

/**
 * Undoes the last cookie deletion
 * Restores all cookies from tempDeletedCookies array
 */
async function undoLastDeletion() {
    if (tempDeletedCookies.length === 0) return;
    
    try {
        await Promise.all(tempDeletedCookies.map(cookie => {
            return browser.cookies.set({
                url: getCookieUrl(cookie),
                name: cookie.name,
                value: cookie.value,
                expirationDate: cookie.expirationDate,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                sameSite: cookie.sameSite,
                storeId: cookie.storeId,
                partitionKey: cookie.partitionKey
            });
        }));

        tempDeletedCookies = [];
        await fetchCookiesAndTabs();
        await updateDisplay();

        // Hide only the undo icon
        const undoIcon = document.getElementById('icon5');
        if (undoIcon) {
            undoIcon.style.display = 'none';
        }
        
        // Clear the timeout
        clearTimeout(undoTimeout);
    } catch (error) {
        console.error('Error undoing last deletion:', error);
    }
}

/**
 * Removes browsing data based on options
 * @param {Object} options - Browser data types to remove
 */
async function removeBrowsingData(options) {
    try {
        await browser.browsingData.remove({ since: 0 }, options);
    } catch (error) {
        console.error('Error removing browsing data:', error);
    }
}

/**
 * Cleans browsing data based on user settings
 * Called when user clicks the myCleaner icon
 */
async function myCleaner() {
    try {
        // Get user settings
        const settings = await browser.storage.local.get([
            'mycleanerCookies',
            'mycleanerBrowsingHistory',
            'mycleanerCache',
            'mycleanerAutofill',
            'mycleanerDownloadHistory',
            'mycleanerService',
            'mycleanerPlugin',
            'mycleanerLocal',
            'mycleanerIndexed',
            'mycleanerPasswords'
        ]);

        // Create options object
        const options = {
            cookies: settings.mycleanerCookies,
            history: settings.mycleanerBrowsingHistory,
            cache: settings.mycleanerCache,
            formData: settings.mycleanerAutofill,
            downloads: settings.mycleanerDownloadHistory,
            serviceWorkers: settings.mycleanerService,
            pluginData: settings.mycleanerPlugin,
            localStorage: settings.mycleanerLocal,
            indexedDB: settings.mycleanerIndexed,
            passwords: settings.mycleanerPasswords
        };

        // Filter out disabled options
        const mycleaner = Object.fromEntries(
            Object.entries(options).filter(([, value]) => value)
        );

        if (Object.keys(mycleaner).length > 0) {
            await browser.browsingData.remove({ since: 0 }, mycleaner);
            
            // If cookies were cleared, check if we need to show empty message
            if (mycleaner.cookies) {
                cookies = await fetchAllCookies();
                
                if (cookies.length === 0) {
                    showNoCoookiesMessage();
                    return;
                }
            }
        }
    } catch (error) {
        console.error('Error running myCleaner:', error);
    }
}


// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', async function () {
    window.focus();
    await initExtension();
    const cookiesContainer = document.getElementById('cookies-container');
    
    let isModifierPressed = false;
    const isMacOS = navigator.platform.toLowerCase().includes('mac');

    // Event listener for key press
    document.addEventListener('keydown', (event) => {
        isModifierPressed = isMacOS ? event.metaKey : event.ctrlKey;
        if (isModifierPressed) {
            highlightOpenTabDomains(true);
        }
    });

    // Event listener for key release
    document.addEventListener('keyup', (event) => {
        if ((isMacOS && !event.metaKey) || (!isMacOS && !event.ctrlKey)) {
            isModifierPressed = false;
            highlightOpenTabDomains(false);
        }
    });

    // Event listener for the cookie container click events
    cookiesContainer?.addEventListener('click', async (event) => {
        if (event.target.nodeName === 'DIV') {
            const website = event.target.textContent.split(' ')[0];
            event.preventDefault();
            
            // First check if modifier key is currently pressed
            if (isModifierPressed) {
                // Get the color to determine if it's an open tab (green)
                const color = window.getComputedStyle(event.target).color;
                const isGreenDomain = color === 'rgb(5, 165, 93)' || color === '#05A55D';
                
                if (isGreenDomain) {
                    await navigateToTab(website);
                    return;
                }
            } else {
                // Default behavior - delete cookies
                const domainCookies = cookies.filter(cookie => 
                    getMainDomain(cookie.domain) === getMainDomain(website)
                );
                
                if (domainCookies.length === 0) return;
                
                await deleteAllCookiesForDomain(website);
                await updateDisplay();
            }
        }
    });

    // Event listener for the cookie container right-click: Displays cookie details for the selected domain
    cookiesContainer?.addEventListener('contextmenu', async (event) => {
        if (event.target.nodeName === 'DIV') {
            const website = event.target.textContent.split(' ')[0];
            event.preventDefault();
            await displayCookieDetails(website, cookies);
        }
    });

    const icon1 = document.getElementById('icon1');
    const icon2 = document.getElementById('icon2');
    const icon3 = document.getElementById('icon3');
    const icon5 = document.getElementById('icon5');

    // Event listener for the icon1 to delete cookies associated with closed tabs
    icon1?.addEventListener('click', async () => {
        if (!hasCookiesToDelete()) return;
        const userConfirmed = await showConfirmationModal(cookies);
        if (userConfirmed) {
            const openTabUrls = tabs.map(tab => new URL(tab.url).hostname);
            const cookiesAssociatedWithClosedTabs = getCookiesAssociatedWithClosedTabs(cookies, openTabUrls);
            await deleteCookiesFromClosedTabs(cookiesAssociatedWithClosedTabs);
            await updateDisplay();
        }
    });

    // Event listener for the icon2 to delete all cookies except favorites
    icon2?.addEventListener('click', async () => {
        if (!hasCookiesToDelete()) return;
        const userConfirmed = await showConfirmationModal(cookies);
        if (userConfirmed) {
            const favoriteDomains = new Set(favorites.map(getMainDomain));
            const cookiesToDelete = cookies.filter(cookie => 
                !favoriteDomains.has(getMainDomain(cookie.domain))
            );
            
            if (cookiesToDelete.length > 0) {
                await Promise.all(cookiesToDelete.map(cookie => deleteCookie(cookie)));
            }
            
            // Fetch cookies again to check if we've removed everything
            cookies = await fetchAllCookies();
            
            if (cookies.length === 0) {
                showNoCoookiesMessage();
                return;
            }
            
            await updateDisplay();
        }
    });

    // Event listener for the icon3 to trigger the myCleaner function
    icon3?.addEventListener('click', async () => {
        if (!hasCookiesToDelete()) return;
        const userConfirmed = await showConfirmationModal(cookies);
        if (userConfirmed) {
            await myCleaner();
            await updateDisplay();
        }
    });

    // Event listener for the icon5 to undo the very last cookie deletion
    icon5?.addEventListener('click', async () => {
        await undoLastDeletion();
    });

    // Event listener for window resize to reposition stars
    window.addEventListener('resize', positionStarsInDock);
    
    // When popup opens, initialize with default state
    highlightOpenTabDomains(false);
});


// ==================== HELPER FUNCTIONS ====================

/**
 * Checks if the Control key is pressed
 * @param {Event} event - The keyboard event
 * @returns {boolean} True if the Control key is pressed
 */
function isModifierKeyPressed(event) {
    return event.ctrlKey;
}

/**
 * Shows the undo icon and sets a timeout to hide it
 * Temporarily hides the settings icon
 */
function showUndoIcon() {
    const undoIcon = document.getElementById('icon5');
    
    if (!undoIcon) return;

    // Show the undo icon without hiding the settings icon
    undoIcon.style.display = 'flex'; 

    // Clear any existing timeout
    clearTimeout(undoTimeout);
    
    // Set a new timeout to hide the undo icon after 20 seconds
    undoTimeout = setTimeout(() => {
        undoIcon.style.display = 'none';
        tempDeletedCookies = [];
    }, 20000); // 20 seconds to undo
}

/**
 * Constructs the URL for a cookie
 * @param {Object} cookie - Cookie object
 * @returns {string} URL for the cookie
 */
function getCookieUrl(cookie) {
    return `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`;
}

/**
 * Checks if there are any cookies to delete
 * Used to avoid showing confirmation dialog when no cookies exist
 * @returns {boolean} True if there are cookies to delete
 */
function hasCookiesToDelete() {
    return cookies.length > 0;
}

/**
 * Shows a confirmation modal dialog
 * @returns {Promise<boolean>} Promise resolving to true if confirmed, false if cancelled
 */
function showConfirmationModal() {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmation-modal');
        const yesButton = document.getElementById('confirm-yes');
        const noButton = document.getElementById('confirm-no');
        
        if (!modal || !yesButton || !noButton) {
            resolve(false);
            return;
        }

        modal.style.display = 'block';

        const handleResponse = (response) => {
            modal.style.display = 'none';
            resolve(response);
            yesButton.removeEventListener('click', handleYes);
            noButton.removeEventListener('click', handleNo);
            window.removeEventListener('click', handleClickOutside);
        };

        const handleYes = () => handleResponse(true);
        const handleNo = () => handleResponse(false);

        yesButton.addEventListener('click', handleYes);
        noButton.addEventListener('click', handleNo);

        const handleClickOutside = (event) => {
            if (event.target === modal) handleResponse(false);
        };

        window.addEventListener('click', handleClickOutside);
    });
}


// ==================== DOMAIN HELPERS ====================

// Fixed number of levels for domain extraction
const numLevels = -2;

// Object to hold special second-level domains (SLDs) sorted by country
const specialSLDs = {
    Algeria: ['com.dz', 'gov.dz', 'org.dz', 'edu.dz', 'asso.dz', 'pol.dz', 'art.dz', 'net.dz', 'tm.dz', 'soc.dz'],
    Australia: ['com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'asn.au', 'id.au', 'csiro.au'],
    Austria: ['ac.at', 'gv.at', 'co.at', 'or.at', 'priv.at'],
    Bangladesh: ['com.bd', 'net.bd', 'org.bd', 'edu.bd', 'ac.bd', 'info.bd', 'co.bd', 'gov.bd', 'mil.bd', 'tv.bd'],
    Brazil: ['app.br', 'art.br', 'com.br', 'dev.br', 'eco.br', 'emp.br', 'log.br', 'net.br', 'ong.br', 'seg.br', 'edu.br', 'blog.br', 'flog.br', 'nom.br', 'vlog.br', 'wiki.br', 'agr.br', 'esp.br', 'etc.br', 'far.br', 'imb.br', 'ind.br', 'inf.br', 'radio.br', 'rec.br', 'srv.br', 'tmp.br', 'tur.br', 'tv.br', 'am.br', 'coop.br', 'fm.br', 'g12.br', 'gov.br', 'mil.br', 'org.br', 'psi.br', 'b.br', 'def.br', 'jus.br', 'leg.br', 'mp.br', 'tc.br'],
    France: ['avocat.fr', 'aeroport.fr', 'veterinaire.fr', 'gouv.fr'],
    Hungary: ['2000.hu', 'agrar.hu', 'bolt.hu', 'city.hu', 'co.hu', 'edu.hu', 'film.hu', 'forum.hu', 'games.hu', 'gov.hu', 'hotel.hu', 'info.hu', 'ingatlan.hu', 'jogasz.hu', 'konyvelo.hu', 'lakas.hu', 'media.hu', 'mobi.hu', 'net.hu', 'news.hu', 'org.hu', 'priv.hu', 'reklam.hu', 'shop.hu', 'sport.hu', 'suli.hu', 'tm.hu', 'tozsde.hu', 'utazas.hu', 'video.hu', 'casino.hu', 'erotica.hu', 'erotika.hu', 'sex.hu', 'szex.hu'],
    New_Zealand: ['ac.nz', 'co.nz', 'geek.nz', 'gen.nz', 'kiwi.nz', 'maori.nz', 'net.nz', 'org.nz', 'school.nz', 'cri.nz', 'govt.nz', 'health.nz', 'iwi.nz', 'mil.nz', 'parliament.nz'],
    Nigeria: ['com.ng', 'org.ng', 'gov.ng', 'edu.ng', 'net.ng', 'sch.ng', 'name.ng', 'mobi.ng', 'mil.ng', 'i.ng'],
    Pakistan: ['com.pk', 'org.pk', 'net.pk', 'ac.pk', 'edu.pk', 'res.pk', 'gov.pk', 'mil.pk', 'gok.pk', 'gob.pk', 'gkp.pk', 'gop.pk', 'gos.pk', 'gog.pk', 'ltd.pk', 'web.pk', 'fam.pk', 'biz.pk'],
    India: ['co.in', 'com.in', 'firm.in', 'net.in', 'org.in', 'gen.in', 'ind.in', 'ernet.in', 'ac.in'],
    Israel: ['ac.il', 'co.il', 'org.il', 'net.il', 'k12.il', 'gov.il', 'muni.il', 'idf.il'],
    Japan: ['ac.jp', 'ad.jp', 'co.jp', 'ed.jp', 'go.jp', 'gr.jp', 'lg.jp', 'ne.jp', 'or.jp'],
    Russia: ['ac.ru', 'com.ru', 'edu.ru', 'gov.ru', 'int.ru', 'mil.ru', 'net.ru', 'org.ru', 'pp.ru'],
    South_Africa: ['ac.za', 'co.za', 'edu.za', 'gov.za', 'law.za', 'mil.za', 'net.za', 'nom.za', 'org.za', 'school.za'],
    South_Korea: ['co.kr', 'ne.kr', 'or.kr', 're.kr', 'pe.kr', 'go.kr', 'mil.kr', 'ac.kr', 'hs.kr', 'ms.kr', 'es.kr', 'sc.kr', 'kg.kr', 'seoul.kr', 'busan.kr', 'daegu.kr', 'incheon.kr', 'gwangju.kr', 'daejeon.kr', 'ulsan.kr', 'gyeonggi.kr', 'gangwon.kr', 'chungbuk.kr', 'chungnam.kr', 'jeonbuk.kr', 'jeonnam.kr', 'gyeongbuk.kr', 'gyeongnam.kr', 'jeju.kr'],
    Spain: ['com.es', 'nom.es', 'org.es', 'gob.es', 'edu.es'],
    Sri_Lanka: ['gov.lk', 'ac.lk', 'sch.lk', 'net.lk', 'int.lk', 'com.lk', 'org.lk', 'edu.lk', 'ngo.lk', 'soc.lk', 'web.lk', 'ltd.lk', 'assn.lk', 'grp.lk', 'hotel.lk'],
    Thailand: ['ac.th', 'co.th', 'go.th', 'mi.th', 'or.th', 'net.th', 'in.th'],
    Trinidad_and_Tobago: ['co.tt', 'com.tt', 'org.tt', 'net.tt', 'travel.tt', 'museum.tt', 'aero.tt', 'tel.tt', 'name.tt', 'charity.tt', 'mil.tt', 'edu.tt', 'gov.tt'],
    Türkiye: ['gov.tr', 'mil.tr', 'tsk.tr', 'k12.tr', 'edu.tr', 'av.tr', 'dr.tr', 'bel.tr', 'pol.tr', 'kep.tr', 'com.tr', 'net.tr', 'org.tr', 'info.tr', 'bbs.tr', 'nom.tr', 'tv.tr', 'biz.tr', 'tel.tr', 'gen.tr', 'web.tr', 'name.tr'],
    Ukraine: ['com.ua', 'in.ua', 'org.ua', 'net.ua', 'edu.ua', 'gov.ua'],
    United_Kingdom: ['ac.uk', 'bl.uk', 'co.uk', 'gov.uk', 'judiciary.uk', 'ltd.uk', 'me.uk', 'mod.uk', 'net.uk', 'nhs.uk', 'nic.uk', 'org.uk', 'parliament.uk', 'plc.uk', 'police.uk', 'rct.uk', 'royal.uk', 'sch.uk', 'ukaea.uk'],
    United_States: ['ak.gov', 'al.gov', 'ar.gov', 'az.gov', 'ca.gov', 'co.gov', 'ct.gov', 'de.gov', 'fl.gov', 'ga.gov', 'hi.gov', 'ia.gov', 'id.gov', 'il.gov', 'in.gov', 'ks.gov', 'ky.gov', 'la.gov', 'ma.gov', 'md.gov', 'me.gov', 'mi.gov', 'mn.gov', 'mo.gov', 'ms.gov', 'mt.gov', 'nc.gov', 'nd.gov', 'ne.gov', 'nh.gov', 'nj.gov', 'nm.gov', 'nv.gov', 'ny.gov', 'oh.gov', 'ok.gov', 'or.gov', 'pa.gov', 'ri.gov', 'sc.gov', 'sd.gov', 'tn.gov', 'tx.gov', 'ut.gov', 'va.gov', 'vt.gov', 'wa.gov', 'wi.gov', 'wv.gov', 'wy.gov'],
};

/**
 * Extracts the main domain from a full domain
 * Handles special second-level domains correctly
 * @param {string} domain - Full domain to extract from
 * @returns {string} Main domain
 */
function getMainDomain(domain) {
    if (!domain) return '';
    
    try {
        const parts = domain.split('.').filter(part => part && part !== 'www');
        if (parts.length < 2) return domain;
        
        const lastTwoParts = parts.slice(-2).join('.');

        // Check if domain has a special SLD pattern
        for (const country in specialSLDs) {
            if (specialSLDs[country].includes(lastTwoParts)) {
                return parts.slice(-3).join('.');
            }
        }
        
        // Default domain extraction
        return parts.slice(numLevels).join('.');
    } catch (error) {
        console.error('Error extracting main domain:', error);
        return domain; // Return original domain as fallback
    }
}

/**
 * Checks if one domain is a subdomain of another
 * @param {string} domain1 - First domain
 * @param {string} domain2 - Second domain
 * @returns {boolean} True if domains match or one is subdomain of the other
 */
function isDomainOrSubdomain(domain1, domain2) {
    if (!domain1 || !domain2) return false;
    
    try {
        const mainDomain1 = getMainDomain(domain1);
        const mainDomain2 = getMainDomain(domain2);
        
        // Quick check for main domain match
        if (mainDomain1 === mainDomain2) return true;

        // Check domain parts from right to left
        const parts1 = domain1.split('.').reverse();
        const parts2 = domain2.split('.').reverse();
        
        for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
            if (parts1[i] !== parts2[i]) return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error checking domain relationship:', error);
        return false;
    }
}

/**
 * Filters cookies associated with closed tabs
 * @param {Array} cookies - Array of cookie objects
 * @param {Array} openTabUrls - Array of URLs from open tabs
 * @returns {Array} Array of cookies from closed tabs
 */
function getCookiesAssociatedWithClosedTabs(cookies, openTabUrls) {
    return cookies.filter(cookie => {
        const cookieDomain = getMainDomain(cookie.domain);
        return !openTabUrls.some(tabUrl => 
            tabUrl && tabUrl.includes(cookieDomain)
        );
    });
}

/**
 * Calculates the size of a cookie based on name and value
 * @param {Object} cookie - Cookie object
 * @returns {number} Size of the cookie in bytes
 */
function calculateCookieSize(cookie) {
    return (cookie.name?.length || 0) + (cookie.value?.length || 0);
}

/**
 * Formats the expiration date of a cookie
 * @param {number} expirationDate - Unix timestamp
 * @returns {string} Formatted date string
 */
function formatExpirationDate(expirationDate) {
    if (expirationDate !== undefined) {
        return new Date(expirationDate * 1000).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }
    return '';
}