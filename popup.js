/* SimpleCookie, a minimalist yet efficient cookie manager for Firefox */
/* Made with ❤ by micka */

// Initializing a Set to store tracking websites, arrays to hold cookies, and open browser tabs
let trackingSites = new Set();
let cookies = [];
let tabs = [];

// Fetches the tracker database and populates the trackingSites Set
async function fetchTrackerDB() {
    if (trackingSites.size === 0) {
        const response = await fetch(browser.runtime.getURL('trackerdb.txt'));
        const text = await response.text();
        trackingSites = new Set(text.split('\n').map(domain => domain.trim()));
    }
}

// Fetches the current cookies and tabs data from the browser
async function fetchCookiesAndTabs() {
    cookies = await browser.cookies.getAll({});
    tabs = await browser.tabs.query({});
}

// Initializes the extension by fetching the tracker database and displaying cookies
async function initExtension() {
    await fetchTrackerDB();
    await fetchCookiesAndTabs();

    // Get settings from local storage with default values
    const defaultSettings = {
        enableGhostIcon: true,
        enableActiveTabHighlight: true,
        showIconsContainer: true
    };

    const settings = await browser.storage.local.get(defaultSettings);

    // Save default settings if they don't exist
    await browser.storage.local.set(settings);

    displayCookies(settings.enableGhostIcon);

    if (settings.enableActiveTabHighlight) {
        highlightActiveTabDomain();
    }

    // Check and set the default value for showIconsContainer
    if (settings.showIconsContainer === undefined) {
        settings.showIconsContainer = true;
        await browser.storage.local.set({ showIconsContainer: true });
    }

    // Update the popup UI based on the showIconsContainer setting
    const iconsContainer = document.getElementById('icons-container');
    iconsContainer.style.display = settings.showIconsContainer ? 'block' : 'none';
}

// Call the initExtension function when the popup is opened
initExtension();

// Update the display of cookies to indicate known tracking sites with a ghost icon
function updateCookieDisplay(element, domain) {
    if (trackingSites.has(domain)) {
        const icon = document.createElement('span');
        icon.classList.add('fas', 'fa-ghost', 'ghost-icon');
        element.appendChild(document.createTextNode(' '));
        element.appendChild(icon);
    }
}

// Function to highlight the active tab's domain in the popup
function highlightActiveTabDomain() {
    const activeTab = tabs.find(tab => tab.active);
    if (activeTab) {
        const activeDomain = getMainDomain(new URL(activeTab.url).hostname);
        const container = document.getElementById('cookies-container');
        if (container) {
            for (const element of container.childNodes) {
                const domainText = element.textContent.trim().split(' ')[0];
                const mainDomain = getMainDomain(domainText);
                if (mainDomain === activeDomain) {
                    const icon = document.createElement('i');
                    icon.classList.add('fas', 'fa-play', 'active-tab-icon');
                    icon.style.marginRight = '3px';
                    element.insertBefore(icon, element.firstChild);
                }
            }
        }
    }
}

// Default number of levels for main domain extraction (Check SimpleCookie preferences for options)
let numLevels = -2;

// Function to extract the main domain of each cookie up to the specified number of levels
function getMainDomain(domain) {
    return domain.split('.').filter(part => part && part !== 'www').slice(numLevels).join('.');
}

// Function to get the number of levels from storage and update the variable
async function getNumLevels() {
    const result = await browser.storage.local.get('numLevels');
    if (result.numLevels !== undefined) {
        numLevels = result.numLevels;
    }
}
getNumLevels();

// Function to check for an exact match between two domains or determines if one domain is a subdomain of the other
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

// Function to categorize cookies associated with closed tabs
function getCookiesAssociatedWithClosedTabs(cookies, openTabUrls) {
    return cookies.filter(cookie => {
        const cookieDomain = getMainDomain(cookie.domain);
        return !openTabUrls.some(tabUrl => tabUrl.includes(cookieDomain));
    });
}

// Function to delete cookies from closed tabs
async function deleteCookiesFromClosedTabs(cookies) {
    await Promise.all(cookies.map(cookie =>
        browser.cookies.remove({
            url: `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`,
            name: cookie.name
        })
    ));
}

// Function to fetch and display cookies per website domain
function displayCookies(enableGhostIcon) {
    const openTabDomains = tabs.map(tab => {
        const hostname = new URL(tab.url).hostname;
        return {
            hostname,
            mainDomain: getMainDomain(hostname)
        };
    });

    const container = document.getElementById('cookies-container');
    container.innerHTML = '';

    const websiteCounts = cookies.reduce((acc, { domain }) => {
        const mainDomain = getMainDomain(domain);
        acc[mainDomain] = (acc[mainDomain] || 0) + 1;
        return acc;
    }, {});

    const fragment = document.createDocumentFragment();
    const elements = Object.entries(websiteCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([website, count]) => {
            const element = document.createElement('div');
            element.textContent = `${website} (${count})`;
            if (enableGhostIcon) {
                updateCookieDisplay(element, website);
            }
            if (openTabDomains.some(({ mainDomain }) => isDomainOrSubdomain(mainDomain, getMainDomain(website)))) {
                element.style.color = '#04A65D';
            }
            return element;
        });

    fragment.append(...elements);
    container.appendChild(fragment);
}

// Function to delete cookies when clicking on a specific main domain
async function deleteCookiesWithMainDomain(cookies, mainDomain) {
    const cookiesToDelete = cookies.filter(cookie => cookie.domain.includes(mainDomain));
    await Promise.all(cookiesToDelete.map(async cookie => {
        const urls = cookiesToDelete
            .filter(c => c.name === cookie.name)
            .map(c => `http${c.secure ? 's' : ''}://${c.domain}${c.path}`);
        await Promise.all(urls.map(url => browser.cookies.remove({ url, name: cookie.name })));
    }));
}

// Event listener to trigger the initialization of the extension
document.addEventListener('DOMContentLoaded', async function () {
    await initExtension();

    async function removeBrowsingData(options) {
        await browser.browsingData.remove({ since: 0 }, options);
        await fetchCookiesAndTabs();
        const settings = await browser.storage.local.get(['enableGhostIcon', 'enableActiveTabHighlight']);
        displayCookies(settings.enableGhostIcon);
        if (settings.enableActiveTabHighlight) {
            highlightActiveTabDomain();
        }
    }

    document.getElementById('icon1').addEventListener('click', async function () {
        const openTabUrls = tabs.map(tab => new URL(tab.url).hostname);
        const cookiesAssociatedWithClosedTabs = getCookiesAssociatedWithClosedTabs(cookies, openTabUrls);
        await deleteCookiesFromClosedTabs(cookiesAssociatedWithClosedTabs);
        await fetchCookiesAndTabs();
        const settings = await browser.storage.local.get(['enableGhostIcon', 'enableActiveTabHighlight']);
        displayCookies(settings.enableGhostIcon);
        if (settings.enableActiveTabHighlight) {
            highlightActiveTabDomain();
        }
    });

    document.getElementById('icon2').addEventListener('click', async function () {
        await removeBrowsingData({ cookies: true });
    });

    document.getElementById('icon3').addEventListener('click', async function () {
        await removeBrowsingData({
            cache: true,
            cookies: true,
            downloads: true,
            formData: true,
            history: true,
            indexedDB: true,
            localStorage: true,
            passwords: true,
            pluginData: true,
            serviceWorkers: true,
        });
    });

    const cookiesContainer = document.getElementById("cookies-container");

    cookiesContainer.addEventListener('click', async (event) => {
        if (event.target.nodeName === 'DIV') {
            const website = event.target.textContent.split(' ')[0];
            event.preventDefault();
            await deleteCookiesWithMainDomain(cookies, website);
            await fetchCookiesAndTabs();
            const settings = await browser.storage.local.get(['enableGhostIcon', 'enableActiveTabHighlight']);
            displayCookies(settings.enableGhostIcon);
            if (settings.enableActiveTabHighlight) {
                highlightActiveTabDomain();
            }
        }
    });

    cookiesContainer.addEventListener('contextmenu', async (event) => {
        if (event.target.nodeName === 'DIV') {
            const website = event.target.textContent.split(' ')[0];
            event.preventDefault();
            await displayCookieDetails(website, cookies);
        }
    });
});

// Function to display cookie details in a table format
function displayCookieDetails(mainDomain, cookies) {
    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    const sortedCookies = cookies.filter(cookie => getMainDomain(cookie.domain) === mainDomain)
                                  .sort((a, b) => a.name.localeCompare(b.name));

    const table = document.createElement('table');
    table.className = 'cookie-table';

    const headers = [
        { title: 'Name', description: 'The name of the cookie, which is used to identify it when sent between the client and the server.' },
        { title: 'Value', description: 'The value of the cookie, which is the data stored within the cookie.' },
        { title: 'Size', description: 'The size of the cookie in bytes using a function that encodes both the cookie name and value, where each character is assumed to be one byte.' },
        { title: 'Domain', description: 'The domain for which the cookie is valid. The cookie will only be sent to the specified domain and its subdomains.' },
        { title: 'Expiration', description: 'The date on which the cookie will expire. A session cookie is a type of cookie that does not have an expiration date set. These cookies are stored in temporary memory and are deleted when closing the browser. Persistent cookies have an expiration date and are stored on the device until they expire or are explicitly deleted.'},
        { title: 'Secure Flag', description: 'When this flag is set, the cookie will only be sent over secure (HTTPS) connections, adding an extra layer of security.' },
        { title: 'HttpOnly Flag', description: 'When this flag is set, the cookie is not accessible via JavaScript, which helps prevent certain types of cross-site scripting attacks.' },
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

    const addRow = (cookie) => {
        const row = table.insertRow();
        const { name, value, domain, expirationDate, secure, httpOnly, sameSite } = cookie;
        const cookieSize = calculateCookieSize({ name, value, domain, expirationDate, secure, httpOnly, sameSite });

        // Correctly handle the SameSite attribute
        const sameSiteValue = sameSite === 'no_restriction' ? 'None' : sameSite === 'lax' ? 'Lax' : sameSite === 'strict' ? 'Strict' : 'None';

        let expirationDateFormatted = '';
        if (expirationDate !== undefined) {
            expirationDateFormatted = new Date(expirationDate * 1000).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        }

        const cellContents = [name, value, cookieSize, domain, expirationDateFormatted || 'Session', secure ? 'Yes' : 'No', httpOnly ? 'Yes' : 'No', sameSiteValue];
        cellContents.forEach(content => {
            const cell = document.createElement('td');
            cell.textContent = content;
            cell.className = 'cell';
            row.appendChild(cell);

            // Add tooltip to show full content on hover
            cell.addEventListener('mouseenter', function() {
                cell.title = cell.offsetWidth < cell.scrollWidth ? cell.textContent : '';
            });
        });

        // Add event listeners for the row
        row.addEventListener('click', async function(event) {
            await deleteCookie(cookie);
            table.deleteRow(row.rowIndex); 
        });

        row.addEventListener('mouseenter', function() {
            row.style.backgroundColor = isDarkMode ? '#5F5E68' : '#DFDFE4';
            row.style.cursor = 'pointer'; // Change cursor to hand
        });

        row.addEventListener('mouseleave', function() {
            row.style.backgroundColor = ''; // Reset background color on mouse leave
            row.style.cursor = 'default'; // Reset cursor
        });
    };

    sortedCookies.forEach(addRow);

    document.body.appendChild(table);
}

// Function to delete a cookie
async function deleteCookie(cookie) {
    await browser.cookies.remove({
        url: `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`,
        name: cookie.name
    });
}

// Function to calculate the size of a cookie based on the length of the name and value
function calculateCookieSize(cookie) {
    const nameLength = cookie.name.length;
    const valueLength = cookie.value.length;
    return nameLength + valueLength;
}