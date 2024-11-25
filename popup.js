/* SimpleCookie, a minimalist yet efficient cookie manager for Firefox */
/* Made with ❤ by micka from Paris */


// ==================== INITIALIZATION OF VARIABLES ====================

// Set to hold the tracking list
let trackingSites = new Set();

// Array to store cookie objects
let cookies = [];

// Array to store tab objects
let tabs = [];

// Array to keep track of cookies that have been deleted for potential undo
let tempDeletedCookies = [];

// Variable to manage the timeout for the undo action
let undoTimeout;

// Load favorites
const favorites = JSON.parse(localStorage.getItem('favorites')) || [];


// ==================== FETCHING THE DATA ====================

// Fetches the list of tracking websites from the local database
async function fetchTrackerDB() {
    if (trackingSites.size > 0) return;
    const response = await fetch(browser.runtime.getURL('resources/trackerdb.txt'));
    const text = await response.text();
    trackingSites = new Set(text.split('\n').map(domain => domain.trim()).filter(Boolean));
}

// Fetches all cookies from a specified store
async function fetchCookiesFromStore(storeId) {
    const normalCookies = await browser.cookies.getAll({ storeId });
    const partitionedCookies = await browser.cookies.getAll({ storeId, partitionKey: {} });
    return [...normalCookies, ...partitionedCookies];
}

// Fetches all cookies from all containers and avoid duplicates
async function fetchAllCookies() {
    const containers = await browser.contextualIdentities.query({});
    const cookiePromises = containers.map(container => fetchCookiesFromStore(container.cookieStoreId));
    cookiePromises.push(fetchCookiesFromStore("")); // Fetch cookies from the default store

    const allCookies = (await Promise.all(cookiePromises)).flat();
    const uniqueCookiesMap = new Map();
    
    allCookies.forEach(cookie => {
        const { name, value, size, domain, partitionKey, storeId, expirationDate, secure, httpOnly, sameSite } = cookie;
        
        // Create a unique key
        const key = `${name}|${value}|${size}|${domain}|${partitionKey}|${storeId}|${expirationDate}|${secure}|${httpOnly}|${sameSite}`;
        
        // Store the cookie in the map if the key is not already present
        if (!uniqueCookiesMap.has(key)) {
            uniqueCookiesMap.set(key, cookie);
        }
    });

    // Return the unique cookies as an array
    return Array.from(uniqueCookiesMap.values());
}

// Fetches all cookies and open tabs
async function fetchCookiesAndTabs() {
    cookies = await fetchAllCookies();
    tabs = await browser.tabs.query({});
}

// Fetches tracking sites, cookies, and tabs
async function fetchData() {
    await Promise.all([fetchTrackerDB(), fetchCookiesAndTabs()]);
}


// ==================== APPLYING THE SETTINGS ====================

// Apply user settings from storage
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
        mycleanerPasswords: false

    };

    // Get settings from storage and merge with defaults
    const storedSettings = await browser.storage.local.get(defaultSettings);
    const settings = { ...defaultSettings, ...storedSettings };
    await browser.storage.local.set(settings);

    const { enableGhostIcon, enableSpecialJarIcon, enablePartitionIcon, enableActiveTabHighlight, 
            mycleanerCookies, mycleanerBrowsingHistory, mycleanerCache, mycleanerAutofill, 
            mycleanerDownloadHistory, mycleanerService, mycleanerPlugin, 
            mycleanerLocal, mycleanerIndexed, mycleanerPasswords } = settings;

    // Display cookies based on user preferences
    displayCookies(enableGhostIcon, enableSpecialJarIcon, enablePartitionIcon);

    // Highlight the active tab domain if enabled
    if (enableActiveTabHighlight) highlightActiveTabDomain();
}

// Initializes the extension by fetching data and applying settings
async function initExtension() {
    await fetchData();
    await applySettings();
}

// Call the initExtension function when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initExtension);


// ==================== DISPLAYING THE DATA ====================

// Check Firefox theme 
function getCurrentTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Main function to display cookies, favorites and insights icons
function displayCookies(enableGhostIcon, enableSpecialJarIcon, enablePartitionIcon) {
    const openTabDomains = tabs.map(({ url }) => {
        const hostname = new URL(url).hostname;
        return { hostname, mainDomain: getMainDomain(hostname) };
    });

    const container = document.getElementById('cookies-container');
    container.innerHTML = '';

    const websiteCounts = cookies.reduce((acc, { domain }) => {
        const mainDomain = getMainDomain(domain);
        acc[mainDomain] = (acc[mainDomain] || 0) + 1;
        return acc;
    }, {});

    const fragment = document.createDocumentFragment();

    const nonDefaultContainerDomains = new Set(
        cookies.filter(cookie => cookie.storeId !== 'firefox-default')
               .map(cookie => getMainDomain(cookie.domain))
    );

    const partitionedDomains = new Set(
        cookies.filter(cookie => cookie.partitionKey)
               .map(cookie => getMainDomain(cookie.domain))
    );

    const elements = Object.entries(websiteCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([website, count]) => {
            const element = document.createElement('div');

            const star = document.createElement('i');
            star.className = 'fas fa-star star-icon';
            star.style.cursor = 'pointer';

            // Set star color and opacity based on favorites
            if (favorites.includes(website)) {
                star.style.color = '#F7CA18';
                star.style.opacity = '1';
            } else {
                star.style.color = getCurrentTheme() === 'dark' ? 'white' : 'black';
                star.style.opacity = '0';
            }

            // Toggle star color and opacity on click
            star.addEventListener('click', (event) => {
                event.stopPropagation();
                if (favorites.includes(website)) {
                    star.style.color = getCurrentTheme() === 'dark' ? 'white' : 'black';
                    star.style.opacity = '0';
                    const index = favorites.indexOf(website);
                    if (index !== -1) favorites.splice(index, 1);
                } else {
                    star.style.color = '#F7CA18';
                    star.style.opacity = '1';
                    favorites.push(website);
                }
                // Save favorites to localStorage
                localStorage.setItem('favorites', JSON.stringify(favorites));
            });

            element.textContent = `${website} (${count})`;
            element.prepend(star);

            // Show star on hover
            element.addEventListener('mouseenter', () => {
                if (!favorites.includes(website)) {
                    star.style.opacity = '0.4';
                }
            });

            element.addEventListener('mouseleave', () => {
                if (!favorites.includes(website)) {
                    star.style.opacity = '0';
                }
            });

            // Additional icon updates (if any)
            if (enableGhostIcon) 
                updateIcon(element, website, 'fas fa-ghost ghost-icon', trackingSites.has(website));
                
            if (enableSpecialJarIcon) 
                updateIcon(element, website, 'fas fa-road-barrier container-icon', nonDefaultContainerDomains.has(getMainDomain(website)));
                
            if (enablePartitionIcon) 
                updateIcon(element, website, 'fas fa-code-branch partition-icon', partitionedDomains.has(getMainDomain(website)));

            const isActiveTab = openTabDomains.some(({ mainDomain }) => 
                isDomainOrSubdomain(mainDomain, getMainDomain(website))
            );
            if (isActiveTab) {
                element.style.color = '#04A65D';
            }
            return element;
        });

    fragment.append(...elements);
    container.appendChild(fragment);
}

// Generic function to update the icons
function updateIcon(element, domain, iconClass, condition) {
    if (condition) {
        const icon = document.createElement('span');
        icon.classList.add(...iconClass.split(' '));
        element.appendChild(document.createTextNode(' '));
        element.appendChild(icon);
    }
}

// Function to display an icon for the active tab
function highlightActiveTabDomain() {
    const activeTab = tabs.find(tab => tab.active);
    if (!activeTab) return;

    const activeDomain = getMainDomain(new URL(activeTab.url).hostname);
    const container = document.getElementById('cookies-container');
    if (!container) return;

    container.querySelector('.active-tab-icon')?.remove();

    const activeElement = Array.from(container.childNodes).find(element => {
        return getMainDomain(element.textContent.trim().split(' ')[0]) === activeDomain;
    });

    if (activeElement) {
        const icon = document.createElement('i');
        icon.className = 'fas fa-eye active-tab-icon';
        icon.style.marginLeft = '5px';
        activeElement.appendChild(icon);
    }
}


// ==================== DETAILED TABLE ====================

// Displays detailed cookie information in a table format
function displayCookieDetails(mainDomain, cookies) {
    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

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
        { title: 'Secure', description: 'When this flag is set, the cookie will only be sent over secure (HTTPS) connections, adding an extra layer of security.' },
        { title: 'HttpOnly', description: 'When this flag is set, the cookie is not accessible via JavaScript, which helps prevent certain types of cross-site scripting attacks.' },
        { title: 'SameSite', description: 'This attribute controls when the cookie will be sent in cross-site requests. It can be set to Strict, Lax, or None. Strict means the cookie will only be sent in a first-party context, Lax restricts the cookie to top-level navigation and safe HTTP methods, and None means the cookie will be sent in all contexts.' }
    ];

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

    // Function to add a row for each cookie in the table
    const addRow = (cookie) => {
        const row = table.insertRow();
        const { name, value, domain, partitionKey, storeId, expirationDate, secure, httpOnly, sameSite } = cookie;
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
            sameSiteMap[sameSite] || 'None'
        ];

        // Create and append cells to the row
        cellContents.forEach(content => {
            const cell = document.createElement('td');
            cell.textContent = content;
            cell.className = 'cell';
            row.appendChild(cell);

            // Add tooltip to show full content on hover
            cell.addEventListener('mouseenter', function() {
                cell.title = cell.textContent;
            });
        });

        // Add event listeners for the row
        row.addEventListener('click', async (event) => {
            event.stopPropagation();
	    if (isFavorite) {
                return;
	    }
            await deleteCookie({
                name: cookie.name,
                domain: cookie.domain,
                path: cookie.path,
                secure: cookie.secure,
                storeId: cookie.storeId,
                partitionKey: cookie.partitionKey
            }, `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`);
                row.remove();
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

// Function to delete a cookie
async function deleteCookie(cookie) {
    const isFavorite = favorites.includes(getMainDomain(cookie.domain));
    if (isFavorite) {
        console.log(`Skipping deletion for favorite cookie: ${cookie.name} from domain: ${cookie.domain}`);
        return; // Skip deletion for this cookie
    }

    const cookieUrl = getCookieUrl(cookie);
    const storeId = cookie.storeId || '0';

    await browser.cookies.remove({
        url: cookieUrl,
        name: cookie.name,
        storeId: storeId,
        partitionKey: cookie.partitionKey
    });

    await updateDisplay();
}

// Function to delete cookies based on a filter function
async function deleteCookies(filterFn) {
    const cookiesToDelete = cookies.filter(filterFn);
    await Promise.all(cookiesToDelete.map(deleteCookie));
}

// Function to delete all cookies from a specific domain
async function deleteAllCookiesForDomain(domain) {
    const isFavorite = favorites.includes(getMainDomain(domain));
    if (isFavorite) {
        return; // Skip deletion for this domain if its a favorite
    }
    
    const domainCookies = cookies.filter(cookie => getMainDomain(cookie.domain) === getMainDomain(domain));
    tempDeletedCookies = domainCookies.map(cookie => ({ ...cookie }));
    await deleteCookies(cookie => getMainDomain(cookie.domain) === getMainDomain(domain));
    showUndoIcon();
}

// Function to delete cookies from closed tabs
async function deleteCookiesFromClosedTabs(closedTabsCookies) {
    await deleteCookies(cookie => {
        const isFavorite = favorites.includes(getMainDomain(cookie.domain));
        return closedTabsCookies.includes(cookie) && !isFavorite;
    });
}

// Function to undo the very last cookie deletion
async function undoLastDeletion() {
    if (tempDeletedCookies.length > 0) {
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

        // Update the display after undoing the deletion
        await updateDisplay(); // This will now fetch settings and display cookies correctly

        const settingsIcon = document.getElementById('icon4');
        const undoIcon = document.getElementById('icon5');
        settingsIcon.style.display = 'inline-flex';
        undoIcon.style.display = 'none';
    }
}

// General function to remove browsing data based on options
async function removeBrowsingData(options) {
    await browser.browsingData.remove({ since: 0 }, options);
}

// The myCleaner function to delete browsing data based on settings
async function myCleaner() {
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

    const mycleaner = Object.entries(options)
        .filter(([, value]) => value)
        .reduce((acc, [key]) => {
            acc[key] = true;
            return acc;
        }, {});

    if (Object.keys(mycleaner).length > 0) {
        await browser.browsingData.remove({ since: 0 }, mycleaner);
    }
}


// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', async function () {
    await initExtension();

    const cookiesContainer = document.getElementById("cookies-container");
    const icon1 = document.getElementById('icon1');
    const icon2 = document.getElementById('icon2');
    const icon3 = document.getElementById('icon3');
    const icon5 = document.getElementById('icon5');

    // Event listener for the icon1 to delete cookies associated with closed tabs
    icon1.addEventListener('click', async () => {
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
    icon2.addEventListener('click', async () => {
        if (!hasCookiesToDelete()) return;
        const userConfirmed = await showConfirmationModal(cookies);
        if (userConfirmed) {
            const favoriteDomains = new Set(favorites.map(getMainDomain)); // Create a set of favorite domains
            const cookiesToDelete = cookies.filter(cookie => !favoriteDomains.has(getMainDomain(cookie.domain)));
            if (cookiesToDelete.length > 0) {
                await Promise.all(cookiesToDelete.map(cookie => deleteCookie(cookie)));
            }
            await updateDisplay();
        }
    });

    // Event listener for the icon3 to trigger the myCleaner function
    icon3.addEventListener('click', async () => {
        if (!hasCookiesToDelete()) return;
        const userConfirmed = await showConfirmationModal(cookies);
        if (userConfirmed) {
            await myCleaner();
            await updateDisplay();
        }
    });

    // Event listener for the cookie container left-click: Deletes all cookies for the selected domain
    cookiesContainer.addEventListener('click', async (event) => {
        if (event.target.nodeName === 'DIV') {
            const website = event.target.textContent.split(' ')[0];
            event.preventDefault();
            const domainCookies = cookies.filter(cookie => getMainDomain(cookie.domain) === getMainDomain(website));
            if (domainCookies.length === 0) return;
            await deleteAllCookiesForDomain(website);
            await updateDisplay();
        }
    });

    // Event listener for the cookie container right-click: Displays cookie details for the selected domain
    cookiesContainer.addEventListener('contextmenu', async (event) => {
        if (event.target.nodeName === 'DIV') {
            const website = event.target.textContent.split(' ')[0];
            event.preventDefault();
            await displayCookieDetails(website, cookies);
        }
    });

    // Event listener for the icon5 to undo the very last cookie deletion
    icon5.addEventListener('click', async () => {
        await undoLastDeletion();
    });
});


// ==================== HELPER FUNCTIONS ====================

// Function to handle the undo icon visibility and timeout
function showUndoIcon() {
    const settingsIcon = document.getElementById('icon4');
    const undoIcon = document.getElementById('icon5');

    settingsIcon.style.display = 'none';
    undoIcon.style.display = 'inline-flex';

    clearTimeout(undoTimeout);
    undoTimeout = setTimeout(() => {
        settingsIcon.style.display = 'inline-flex';
        undoIcon.style.display = 'none';
        tempDeletedCookies = [];
    }, 20000);
}

// Function to construct the cookie URL
function getCookieUrl(cookie) {
    return `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`;
}

// Function to update cookies and tabs display
async function updateDisplay() {
    await fetchCookiesAndTabs(); 

    // Fetch settings again to ensure they are current
    const settings = await browser.storage.local.get([
        'enableGhostIcon',
        'enableSpecialJarIcon',
        'enablePartitionIcon',
        'enableActiveTabHighlight'
    ]);

    displayCookies(settings.enableGhostIcon, settings.enableSpecialJarIcon, settings.enablePartitionIcon);

    // Highlight the active tab domain only if the setting is enabled
    if (settings.enableActiveTabHighlight) {
        highlightActiveTabDomain();
    }
}

// Function to check if there are any cookies to be deleted (to avoid the confirmation dialogue if no cookie is listed)
function hasCookiesToDelete() {
    return cookies.length > 0;
}

// Function to ask for confirmation before deletion
function showConfirmationModal() {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmation-modal');
        const yesButton = document.getElementById('confirm-yes');
        const noButton = document.getElementById('confirm-no');

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

// Always use -2 for the number of levels for domain extraction
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

// Extracts the main domain from a full domain
function getMainDomain(domain) {
    const parts = domain.split('.').filter(part => part && part !== 'www');
    const lastTwoParts = parts.slice(-2).join('.');

    for (const country in specialSLDs) {
        if (specialSLDs[country].includes(lastTwoParts)) {
            return parts.slice(-3).join('.');
        }
    }

    return parts.slice(numLevels).join('.');
}

// Checks if one domain is a subdomain of another
function isDomainOrSubdomain(domain1, domain2) {
    const mainDomain1 = getMainDomain(domain1);
    const mainDomain2 = getMainDomain(domain2);
    if (mainDomain1 === mainDomain2) return true;

    const parts1 = domain1.split('.').reverse();
    const parts2 = domain2.split('.').reverse();
    for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
        if (parts1[i] !== parts2[i]) return false;
    }
    return true;
}

// Filters cookies associated with closed tabs
function getCookiesAssociatedWithClosedTabs(cookies, openTabUrls) {
    return cookies.filter(cookie => {
        const cookieDomain = getMainDomain(cookie.domain);
        return !openTabUrls.some(tabUrl => tabUrl.includes(cookieDomain));
    });
}

// Calculates the size of a cookie based on its name and value lengths
function calculateCookieSize(cookie) {
    const nameLength = cookie.name.length;
    const valueLength = cookie.value.length;
    return nameLength + valueLength;
}

// Formats the expiration date of a cookie
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