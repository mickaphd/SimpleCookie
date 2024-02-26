/* SimpleCookie, a minimalist cookie manager for Firefox */
/* Made with ❤ by micka */

// Fetches all cookies using the browser API
async function displayCookies() {
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
      
      // Event listener to delete cookies of the main domain on click and refresh the display after deleting
      element.addEventListener('click', async (event) => {
        event.preventDefault();
        const mainDomain = website.split('.')[0];
        await deleteCookiesWithMainDomain(cookies, mainDomain);
        displayCookies(); 
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

// Function to display detailed information of cookies for a specific main domain
async function displayCookieDetails(mainDomain, cookies) {
  // Filter cookies to find those belonging to the main domain
  const cookiesInMainDomain = cookies.filter(cookie => cookie.domain.includes(mainDomain));

  // Create a table to display cookie details
  const table = document.createElement('table');
  // Styling for the table
  table.style.borderCollapse = 'collapse';
  table.style.fontFamily = 'Arial, sans-serif';
  table.style.fontSize = '14px';
  table.style.color = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'white' : 'black'; // Font color based on color scheme

  // Define headers for the table
  const headers = [
    { title: 'Name', description: 'Name of the cookie' },
    { title: 'Value', description: 'Data stored within the cookie' },
    { title: 'Domain', description: 'The domain associated with the cookie' },
    { title: 'Secure Flag', description: 'Indicate whether the cookie is secure or not. Secure cookies are only sent over HTTPS connections, adding an extra layer of security' },
    { title: 'HttpOnly Flag', description: 'Show whether the HttpOnly flag is set for each cookie. HttpOnly cookies cannot be accessed through client-side scripts, enhancing security against cross-site scripting attacks' },
    { title: 'SameSite Attribute', description: 'Include the SameSite attribute value for each cookie. This attribute helps prevent cross-site request forgery (CSRF) attacks by controlling how cookies are sent with cross-site requests' }
  ];

  // Styling for the table headers
  const headerStyle = {
    padding: '12px',
    border: '1px solid #ddd',
    textAlign: 'left',
    backgroundColor: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? '#333' : '#f2f2f2',
    color: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'white' : 'black'
  };

  // Function to create a header cell with specified title and description
  const createHeaderCell = (title, description) => {
    const header = document.createElement('th');
    header.textContent = title;
    header.title = description;
    Object.assign(header.style, headerStyle);
    return header;
  };

  // Function to create a data cell with specified value, type, and extra information
  const createDataCell = (val, isValue, extraInfo) => {
    const cell = document.createElement('td');
    cell.textContent = extraInfo ? extraInfo : val;
    Object.assign(cell.style, headerStyle);
    return cell;
  };

  // Create the header row for the table
  const headerRow = table.insertRow();
  headers.forEach(({ title, description }) => {
    headerRow.appendChild(createHeaderCell(title, description));
  });

  // Populate the table with data for each cookie in the main domain
  cookiesInMainDomain.forEach(cookie => {
    const row = table.insertRow();
    const { name, value, domain, secure, httpOnly, sameSite } = cookie;
    [name, value, domain, secure, httpOnly, sameSite].forEach((val, index) => {
        row.appendChild(createDataCell(val, index === 1, val));
    });
  });

  // Open a new window to display the detailed cookie information
  const newWindow = window.open();
  newWindow.document.body.style.backgroundColor = 'transparent';
  newWindow.document.body.appendChild(table);
}

// Event listener to trigger the display of cookies when the DOM content is loaded
document.addEventListener('DOMContentLoaded', displayCookies);
