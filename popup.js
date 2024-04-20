/* SimpleCookie, a minimalist yet efficient cookie manager for Firefox */
/* Made with ❤ by micka */

// Array to store tracking sites
let trackingSites = [];

// Fetches the tracker database and populates the trackingSites array
// Special thanks to Ghostery Tracker Database (https://github.com/ghostery/trackerdb) for providing the data
async function fetchTrackerDB() {
    if (trackingSites.length === 0) {
        const response = await fetch(browser.runtime.getURL('trackerdb.txt'));
        const text = await response.text();
        trackingSites = text.split('\n').map(domain => domain.trim());
    }
    return trackingSites;
}

// Initializes the extension by fetching the tracker database and displaying cookies
async function initExtension() {
    await fetchTrackerDB();
    displayCookies();
}

// Update the display of cookies to indicate tracking sites with a ghost icon
function updateCookieDisplay(element, domain) {
    if (trackingSites.includes(domain)) {
        const icon = document.createElement('span');
        icon.classList.add('fas', 'fa-ghost');
        icon.style.opacity = '0.6';
        icon.style.fontSize = '0.9em';
        element.appendChild(document.createTextNode(' '));
        element.appendChild(icon);
    }
}

// Function to fetch and display cookies per website domain
async function displayCookies() {
    const cookies = await browser.cookies.getAll({});
    const tabs = await browser.tabs.query({});
    const openTabUrls = tabs.map(tab => new URL(tab.url).hostname);
    const container = document.getElementById('cookies-container');
    container.innerHTML = '';

    const websiteCounts = cookies.reduce((acc, cookie) => {
        const mainDomain = cookie.domain.replace(/^(?:.*\.)?([^.]+\.[^.]+)$/, '\$1');
        acc[mainDomain] = (acc[mainDomain] || 0) + 1;
        return acc;
    }, {});

    const elements = Object.entries(websiteCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([website, count]) => {
            const element = document.createElement('div');
            element.textContent = `${website} (${count})`;

            updateCookieDisplay(element, website);

            if (openTabUrls.some(tabUrl => tabUrl.includes(website))) {
                element.style.color = '#04A65D';
            }

            element.addEventListener('click', async (event) => {
                event.preventDefault();
                const mainDomain = website;
                await deleteCookiesWithMainDomain(cookies, mainDomain);
                displayCookies();
            });

            element.addEventListener('contextmenu', async (event) => {
                event.preventDefault();
                const mainDomain = website;
                await displayCookieDetails(mainDomain, cookies);
            });

            return element;
        });

    container.append(...elements);
}

// Event listener to trigger the initialization of the extension
document.addEventListener('DOMContentLoaded', initExtension);

// Function to delete cookies with a specific main domain
async function deleteCookiesWithMainDomain(cookies, mainDomain) {
    const cookiesToDelete = cookies.filter(cookie => cookie.domain.includes(mainDomain));
    await Promise.all(cookiesToDelete.map(async cookie => {
        const urls = cookiesToDelete
            .filter(c => c.name === cookie.name)
            .map(c => (c.secure ? "https://" : "http://") + c.domain + c.path);
        await Promise.all(urls.map(url => browser.cookies.remove({ url: url, name: cookie.name })));
  }));
}

// Function to hide the horizontal separator if the cookie container is empty
document.addEventListener("DOMContentLoaded", function() {
    const cookiesContainer = document.getElementById("cookies-container");
    const separator = document.getElementById("separator");
    const toggleSeparatorVisibility = () => {
        separator.style.display = cookiesContainer.children.length === 0 ? "none" : "block";
    };
    toggleSeparatorVisibility();
    new MutationObserver(toggleSeparatorVisibility).observe(cookiesContainer, { childList: true });
});

// Function to display cookie details in a table format
async function displayCookieDetails(mainDomain, cookies) {

    // Check if dark mode is enabled
    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Create the table element and set its style
    const table = document.createElement('table');
    table.style.cssText = `
        border-collapse: collapse;
        font-size: 13.5px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
        color: ${isDarkMode ? 'white' : 'black'};
        table-layout: fixed;
        width: 100%;
    `;

    // Define headers for the table
    const headers = [
        { title: 'Name', description: 'The name of the cookie, which is used to identify it when sent between the client and the server' },
        { title: 'Value', description: 'The value of the cookie, which is the data stored within the cookie' },
        { title: 'Size', description: 'An "estimated" size of the cookie in bytes using a function that encodes the cookie name, value and additional information' },
        { title: 'Domain', description: 'The domain for which the cookie is valid. The cookie will only be sent to the specified domain and its subdomains' },
        { title: 'Expiration Date', description: 'The date and time when the cookie will expire. After this time, the cookie will no longer be sent by the browser to the server. An "invalid date" likely signifies a session cookie' },
        { title: 'Secure Flag', description: 'When this flag is set, the cookie will only be sent over secure (HTTPS) connections, adding an extra layer of security' },
        { title: 'HttpOnly Flag', description: 'When this flag is set, the cookie is not accessible via JavaScript, which helps prevent certain types of cross-site scripting attacks' },
        { title: 'SameSite Attribute', description: 'This attribute controls when the cookie will be sent in cross-site requests. It can be set to Strict, Lax, or None. Strict means the cookie will only be sent in a first-party context, Lax restricts the cookie to top-level navigation and safe HTTP methods, and None means the cookie will be sent in all contexts' }
    ];

    // Define style for table headers
    const headerStyle = {
        padding: '8px',
        border: '1px solid #ddd',
        textAlign: 'left',
        backgroundColor: isDarkMode ? '#333' : '#f2f2f2',
        color: isDarkMode ? 'white' : 'black',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word'
    };

    // Create table headers
    headers.forEach(({ title, description }) => {
        const headerCell = document.createElement('th');
        headerCell.textContent = title;
        headerCell.title = description;
        Object.assign(headerCell.style, headerStyle);
        table.appendChild(headerCell);
    });

    // Filter and display cookies relevant to the main domain
    cookies
        .filter(cookie => cookie.domain.includes(mainDomain))
        .forEach(({ name, value, domain, expirationDate, secure, httpOnly, sameSite }) => {
            const row = table.insertRow();
            const cookieSize = calculateCookieSize({ name, value, domain, expirationDate, secure, httpOnly, sameSite });
            const sameSiteValue = sameSite === 'Strict' ? 'Strict' : sameSite === 'Lax' ? 'Lax' : 'None';
            [name, value, cookieSize, domain, new Date(expirationDate * 1000).toLocaleString(), secure ? 'Yes' : 'No', httpOnly ? 'Yes' : 'No', sameSiteValue]
                .forEach(content => {
                    const cell = document.createElement('td');
                    cell.textContent = content;
                    Object.assign(cell.style, headerStyle);
                    row.appendChild(cell);
                });
        });

    // Create a new window to display the table
    const newWindow = window.open();
    newWindow.document.body.style.backgroundColor = 'transparent';
    newWindow.document.body.appendChild(table);
}

// Function to calculate the size of a cookie in bytes
function calculateCookieSize(cookie) {
    const name = encodeURIComponent(cookie.name);
    const value = encodeURIComponent(cookie.value);
    const metadata = `;domain=${cookie.domain};expires=${cookie.expirationDate};secure=${cookie.secure};httponly=${cookie.httpOnly};samesite=${cookie.sameSite}`;
    const cookieString = `${name}=${value}${metadata}`;
    const bytes = new TextEncoder().encode(cookieString);
    return bytes.length;
}

// Function to categorize cookies associated with closed tabs
function getCookiesAssociatedWithClosedTabs(cookies, openTabUrls) {
    return cookies.filter(cookie => {
        const cookieDomain = cookie.domain.replace(/^www\.|^.*?([^\.]+\.[^\.]+)$/, '\$1');
        return !openTabUrls.some(tabUrl => tabUrl.includes(cookieDomain));
    });
}

// Function to delete cookies
async function deleteCookies(cookies) {
    for (const cookie of cookies) {
        await browser.cookies.remove({ url: "http" + (cookie.secure ? "s" : "") + "://" + cookie.domain + cookie.path, name: cookie.name });
    }
}

// Event listener to trigger the display of cookies when the DOM content is loaded
document.addEventListener('DOMContentLoaded', async function() {
    await displayCookies();

    // Function to remove browsing data and refresh the display of cookies
    async function removeBrowsingData(options) {
        await browser.browsingData.remove({ since: 0 }, options);
        await displayCookies();
    }

    // Icon 1 function
    document.getElementById('icon1').addEventListener('click', async function() {
        const cookies = await browser.cookies.getAll({});
        const tabs = await browser.tabs.query({});
        const openTabUrls = tabs.map(tab => new URL(tab.url).hostname);
        const cookiesAssociatedWithClosedTabs = getCookiesAssociatedWithClosedTabs(cookies, openTabUrls);

        // Delete cookies associated with closed tabs
        await deleteCookies(cookiesAssociatedWithClosedTabs);

        // Refresh the display of cookies
        await displayCookies();
    });

    // Icon 2 function
    document.getElementById('icon2').addEventListener('click', async function() {
        await removeBrowsingData({ cookies: true });
    });

    // Icon 3 function
    document.getElementById('icon3').addEventListener('click', async function() {
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

    // Icon 4 function
    document.getElementById('icon4').addEventListener('click', function() {
    	window.open('https://github.com/mickaphd/SimpleCookie', '_blank');
    });

});