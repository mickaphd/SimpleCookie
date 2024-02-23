/* SimpleCookie, a minimalist cookie manager for Firefox */
/* Made with ❤ by micka */

async function displayCookies() {
  const cookies = await browser.cookies.getAll({});
  
  const websiteCounts = cookies.reduce((acc, cookie) => {
    const website = cookie.domain.replace(/^www\.|^.*?([^\.]+\.[^\.]+)$/, '\$1');
    acc[website] = (acc[website] || 0) + 1;
    return acc;
  }, {});

  const container = document.getElementById('cookies-container');
  container.innerHTML = '';
  
  const elements = Object.entries(websiteCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([website, count]) => {
      const element = document.createElement('div');
      element.textContent = `${website} (${count})`;
      
      element.addEventListener('click', async (event) => {
        event.stopPropagation();
        const mainDomain = website.split('.')[0];
        await deleteCookiesWithMainDomain(cookies, mainDomain);
        displayCookies();
      });
      
      return element;
    });

  container.append(...elements);
}

async function deleteCookiesWithMainDomain(cookies, mainDomain) {
  const cookiesToDelete = cookies.filter(cookie => cookie.domain.includes(mainDomain));
  
  await Promise.all(cookiesToDelete.map(async cookie => {
    const urls = cookiesToDelete
      .filter(c => c.name === cookie.name)
      .map(c => (c.secure ? "https://" : "http://") + c.domain + c.path);
    
    await Promise.all(urls.map(url => browser.cookies.remove({ url: url, name: cookie.name })));
  }));
}

document.addEventListener('DOMContentLoaded', displayCookies);
