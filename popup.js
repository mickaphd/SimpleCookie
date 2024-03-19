/* SimpleCookie, a minimalist yet efficient cookie manager for Firefox */
/* Made with ❤ by micka */


// Function to fetch and display cookies per website domain
async function displayCookies() {
  
  // Fetch all cookies
  const cookies = await browser.cookies.getAll({});
  
  // Count the number of cookies per website domain
  const websiteCounts = cookies.reduce((acc, cookie) => {
    
    // Extract the main domain from the cookie domain
    const website = cookie.domain.replace(/^www\.|^.*?([^\.]+\.[^\.]+)$/, '\$1');
    acc[website] = (acc[website] || 0) + 1;
    return acc;
  }, {});

  // Get the container element to display cookies
  const container = document.getElementById('cookies-container');
  container.innerHTML = '';
  
  // Create elements to display each website and its cookie count
  const elements = Object.entries(websiteCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([website, count]) => {
      const element = document.createElement('div');
      element.textContent = `${website} (${count})`;
      
      // Event listener to delete cookies of the main domain on left-click and refresh the display after deleting
      element.addEventListener('click', async (event) => {
        event.preventDefault();
        const mainDomain = website.split('.')[0];
        await deleteCookiesWithMainDomain(cookies, mainDomain);
        displayCookies(); // Refresh the display after deleting cookies
      });

      // Event listener to display detailed cookie information on right-click
      element.addEventListener('contextmenu', async (event) => {
        event.preventDefault();
        const mainDomain = website.split('.')[0];
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


// Function to display detailed information of cookies for a specific main domain in a new window
async function displayCookieDetails(mainDomain, cookies) {
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  const table = document.createElement('table');
  table.style.cssText = `
    border-collapse: collapse;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: ${isDarkMode ? 'white' : 'black'};
  `;

  const headers = [
    { title: 'Name', description: 'Name of the cookie' },
    { title: 'Value', description: 'Data stored within the cookie' },
    { title: 'Domain', description: 'The domain associated with the cookie' },
    { title: 'Secure Flag', description: 'Indicate whether the cookie is secure or not.' },
    { title: 'HttpOnly Flag', description: 'Show whether the HttpOnly flag is set for each cookie.' },
    { title: 'SameSite Attribute', description: 'Include the SameSite attribute value for each cookie.' }
  ];

  const headerStyle = {
    padding: '12px',
    border: '1px solid #ddd',
    textAlign: 'left',
    backgroundColor: isDarkMode ? '#333' : '#f2f2f2',
    color: isDarkMode ? 'white' : 'black'
  };

  const createHeaderCell = (title, description) => {
    const header = document.createElement('th');
    header.textContent = title;
    header.title = description;
    Object.assign(header.style, headerStyle);
    return header;
  };

  const createDataCell = (val, isValue, extraInfo) => {
    const cell = document.createElement('td');
    cell.textContent = extraInfo ? extraInfo : val;
    Object.assign(cell.style, headerStyle);
    return cell;
  };

  const fragment = document.createDocumentFragment();
  const headerRow = table.insertRow();
  headers.forEach(({ title, description }) => {
    headerRow.appendChild(createHeaderCell(title, description));
  });

  cookies.filter(cookie => cookie.domain.includes(mainDomain)).forEach(cookie => {
    const row = table.insertRow();
    const { name, value, domain, secure, httpOnly, sameSite } = cookie;
    [name, value, domain, secure, httpOnly, sameSite].forEach((val, index) => {
      row.appendChild(createDataCell(val, index === 1, val));
    });
  });

  const newWindow = window.open();
  newWindow.document.body.style.backgroundColor = 'transparent';
  newWindow.document.body.appendChild(table);
}


// Event listener to trigger the display of cookies when the DOM content is loaded
document.addEventListener('DOMContentLoaded', async function() {
    await displayCookies();
    
    // Function to remove browsing data and refresh the display of cookies
async function removeBrowsingData(options) {
    await browser.browsingData.remove({ since: 0 }, options);
    await displayCookies();
}


document.getElementById('icon1').addEventListener('click', async function() {
    await removeBrowsingData({ history: true, downloads: true });
});

document.getElementById('icon2').addEventListener('click', async function() {
    await removeBrowsingData({ cookies: true });
});

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