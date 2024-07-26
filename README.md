<p align="center">
<img width="150" src=https://github.com/mickaphd/SimpleCookie/assets/25211018/64489133-ecae-435e-92d4-53cc79c9302c)>
</p>

<h1 align="center">SimpleCookie</h1></p>

<i>A minimalist yet efficient cookie manager for Firefox</i>

<a href="https://addons.mozilla.org/en-US/firefox/addon/simplecookie/"><img src="https://blog.mozilla.org/addons/files/2020/04/get-the-addon-fx-apr-2020.svg" height=50px></a>

<h2>Main popup</h2>

<img width="200" alt="Popup_light" src="https://github.com/user-attachments/assets/bc1e2b37-eed7-4303-9294-d498d1375735">
<img width="200" alt="Popup_dark" src="https://github.com/user-attachments/assets/b616c730-3641-4705-ac8f-041e5ee8dc7b">
<img width="200" alt="Popup_minimalist_light" src="https://github.com/user-attachments/assets/d1251d29-0598-4ae9-b0fa-b2e10df7e952">

<h2>Detailed table</h2>

<img width="350" alt="Table_light" src="https://github.com/user-attachments/assets/e492fa47-4ac9-4067-a8a2-0c30db462e6b">
<img width="350" alt="Table_dark" src="https://github.com/user-attachments/assets/9ce272ff-9366-4a4f-9837-18bd9f75a903">

<h2>Settings</h2>

<img width="350" alt="Settings_light" src="https://github.com/user-attachments/assets/da9f58fc-cb78-4b9c-b3ab-c81975d104b5">
<img width="350" alt="Settings_dark" src="https://github.com/user-attachments/assets/5ddc3eb0-0192-45d5-a6e3-7048b6c7d988">

<h2>Key features</h2>

1. <b>Domain aggregation:</b> SimpleCookie aggregates cookie data to show only the main domains for clarity. For example, if you have 5 cookies for "mail.proton.me" and 4 cookies for "drive.proton.me", SimpleCookie will show "proton.me (9)", aggregating data from all subdomains under the main domain. This level of aggregation can be adjusted in the settings.

1. <b>Organized list:</b> The list of sites that store cookies is arranged alphabetically for easy navigation and quick access. Sites that store cookies and still have a tab open in your browser appear in green. The domain corresponding to the currently active tab is highlighted. Sites that are opened in special containers are also highlighted.

1. <b>Detailed view:</b> Right-clicking on a domain opens a detailed view table with more information about the cookies associated with that particular website. Right-clicking additional top domains consolidates the detailed table with more cookies.

1. <b>Effortless cookie removal:</b> A single click on a website automatically deletes all cookies associated with that domain (so please be careful!). A single click on a cookie line in the detailed table deletes that specific cookie. 

1. <b>Real-time updates:</b> The number of cookies associated with each domain is shown in parentheses, and the pop-up is dynamically updated each time you open it.

1. <b>Tracker database:</b> SimpleCookie uses an internal tracking database derived from the Ghostery tracker database (https://github.com/ghostery/trackerdb) to identify organizations/websites known to track behavior (a ghost icon is displayed near the identified domains). While this does not confirm the collection of data in requests and cookies from these sites, they are known for their impact on user privacy.

1. <b>Quick actions:</b> The "broom" icon on the bottom left deletes all cookies associated with websites whose tabs are closed and keeps those used by open tabs (whose domains are highlighted in green), leaving the cookies "in use" and removing those previously used by tabs that are now closed. The "flame" icon deletes all cookies without exception. The "nuclear" icon deletes all cookies, browsing history, cached images and files, autofill form data, download history, service workers, plugin data, saved passwords, local storage data, and indexedDB data. The fourth icon opens the settings.

1. <b>Optional features:</b> The level of main domain aggregation, the Ghostery tracking database feature, the active tab indicator, the special container indicator, and the entire bottom ribbon with all shortcuts can be changed or disabled in the settings.

1. <b>Theme options:</b> Light and Dark themes work seamlessly with Firefox's theme settings. The addon also uses a system font that should be appropriate for the OS it runs on.

1. <b>Lightweight design:</b> No background scripts intentionally. Font Awesome is used as icon library.

1. <b>Privacy policy:</b> SimpleCookie does not collect any data and there is no analytics or telemetry stuff in the code. This is just an open source hobby project by an indie dev (I'm not even a developer, I'm a researcher!) who is concerned about privacy. SimpleCookie uses the following permissions to work properly: 'all_urls', 'browsingData', 'cookies', 'tabs', 'contextualIdentities' (for the containers) and 'storage' (to store the settings). 
