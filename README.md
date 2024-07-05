<p align="center">
<img width="150" src=https://github.com/mickaphd/SimpleCookie/assets/25211018/12ed90c3-2a14-4b9d-8443-13a5846a9950)
</p>
  
<h1 align="center">SimpleCookie</h1></p>
<i>A minimalist yet efficient cookie manager for Firefox</i>

<h2>Main popup</h2>
<img width="200" alt="Screenshot 2024-03-26 at 08 52 55" src="https://github.com/mickaphd/SimpleCookie/assets/25211018/724eb7fc-245e-4d38-90fd-c6fd1c8d1ae3">
<img width="200" alt="Screenshot 2024-03-26 at 08 53 16" src="https://github.com/mickaphd/SimpleCookie/assets/25211018/f5ddf7a9-5c78-4a5f-866a-31e13ffdf519">

<h2>Detailed view</h2>

<img width="450" alt="SimpleCookie_light-theme_detailed information" src="https://github.com/mickaphd/SimpleCookie/assets/25211018/429f7a5c-9e3b-47ce-b010-853631e020ab">
<img width="450" alt="SimpleCookie_dark-theme_detailed information" src="https://github.com/mickaphd/SimpleCookie/assets/25211018/e11d5dea-3e02-4e33-9eb1-a269327ebccc">

<h2>Key features</h2>

1. <b>Domain aggregation:</b> SimpleCookie aggregates cookie data, showing only the main domains for greater clarity. For example, if you have 5 cookies for "mail.proton.me" and 4 cookies for "drive.proton.me", then SimpleCookie will show "proton.me (9)", consolidating data from all subdomains under the main domain. You can also tweak the way SimpleCookie extracts the main domain in the settings.
1. <b>Organized list:</b> The list of websites storing cookies is arranged alphabetically for easy navigation and quick access. Websites that store cookies and still have a tab open are highlighted in green.
1. <b>Effortless cookie removal:</b> A single click on a website automatically deletes all cookies associated with that domain.
1. <b>Real-time updates:</b> The number of cookies associated with each domain is shown in brackets and the pop-up is dynamically updated each time you open it and each time you clear cookies.
1. <b>Tracker database:</b> SimpleCookie uses an internal tracking database derived from the Ghostery Tracker Database (https://github.com/ghostery/trackerdb) to identify organisations/websites known to track behavior (a ghost icon is displayed near the identified domains). While this does not confirm the collection of data in requests and cookies from these sites, they are known for their impact on user privacy.
1. <b>Detailed view:</b> Right-clicking on a domain opens a new window with a table showing more information about the cookies associated with that site.
1. <b>Quick actions:</b> The first icon on the bottom left deletes all cookies from closed tabs and keeps those used by open tabs (whose domains are highlighted in green), keeping the cookies "in use" and removing those previously used by tabs that are now closed. The second icon in the middle deletes all cookies without exception. The third icon on the right deletes all cookies, browsing history, cached images and files, autofill form data, download history, service workers, plugin data, saved passwords, local storage data, and indexedDB data.
1. <b>Theme options:</b> Light and Dark themes work seamlessly with Firefox's theme settings. The addon also uses a system font that is appropriate for the operating system it runs on.
1. <b>Lightweight design:</b> No background scripts. Font Awesome is used as the icon library.
