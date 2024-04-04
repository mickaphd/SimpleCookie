/* SimpleCookie, a minimalist yet efficient cookie manager for Firefox */
/* Made with ❤ by micka */

// Function to fetch and display cookies per website domain
async function displayCookies() {
    // Fetch all cookies and open tabs
    const cookies = await browser.cookies.getAll({});
    const tabs = await browser.tabs.query({});

    // Extract hostnames of open tabs
    const openTabUrls = tabs.map(tab => new URL(tab.url).hostname);

    // Get the container element where cookies will be displayed
    const container = document.getElementById('cookies-container');
    container.innerHTML = '';

    // Count the number of cookies per website domain
    const websiteCounts = cookies.reduce((acc, cookie) => {
        // Extract the main domain from the cookie domain
        const mainDomain = cookie.domain.replace(/^(?:.*\.)?([^.]+\.[^.]+)$/, '\$1');
        acc[mainDomain] = (acc[mainDomain] || 0) + 1;
        return acc;
    }, {});

    // Create elements to display each website domain and cookie count
    const elements = Object.entries(websiteCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([website, count]) => {
            const element = document.createElement('div');
            element.textContent = `${website} (${count})`;

            // Highlight the main domain if it matches an open tab
            if (openTabUrls.some(tabUrl => tabUrl.includes(website))) {
                element.style.color = '#04A65D';
            }

            // Add event listeners for deleting cookies and displaying details
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

    // Append the elements to the container for display
    container.append(...elements);
}

// Function to delete cookies with a specific main domain
async function deleteCookiesWithMainDomain(cookies, mainDomain) {
    // Filter cookies to find those belonging to the main domain
    const cookiesToDelete = cookies.filter(cookie => cookie.domain.includes(mainDomain));

    // Delete each cookie by its name and associated URLs
    await Promise.all(cookiesToDelete.map(async cookie => {
        // Find URLs associated with the cookie
        const urls = cookiesToDelete
            .filter(c => c.name === cookie.name)
            .map(c => (c.secure ? "https://" : "http://") + c.domain + c.path);

        // Remove the cookie from each URL
        await Promise.all(urls.map(url => browser.cookies.remove({ url: url, name: cookie.name })));
  }));
}

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
        { title: 'Size', description: 'An estimated size of the cookie in bytes using a function that encodes the cookie name, value and additional information' },
        { title: 'Domain', description: 'The domain for which the cookie is valid. The cookie will only be sent to the specified domain and its subdomains' },
        { title: 'Expiration Date', description: 'The date and time when the cookie will expire. After this time, the cookie will no longer be sent by the browser to the server. An incorrect date likely signifies a session cookie' },
        { title: 'Secure Flag', description: 'If this flag is set, the cookie will only be sent over secure (HTTPS) connections, adding an extra layer of security' },
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

    // Convert the cookie string to UTF-8 encoded bytes
    const bytes = new TextEncoder().encode(cookieString);

    // Return the size of the cookie in bytes
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

    // Icon 1
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

    // Icon 2
    document.getElementById('icon2').addEventListener('click', async function() {
        await removeBrowsingData({ cookies: true });
    });

    // Icon 3
    document.getElementById('icon3').addEventListener('click', async function() {
        await removeBrowsingData({
            cache: true,
            cookies: true,
            formData: true,
            history: true,
            indexedDB: true,
            localStorage: true,
            downloads: true,
        });
    });
});
