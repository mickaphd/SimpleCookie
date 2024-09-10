<p align="center">
<img width="150" src=https://github.com/mickaphd/SimpleCookie/assets/25211018/64489133-ecae-435e-92d4-53cc79c9302c)>
</p>

<h1 align="center">SimpleCookie</h1></p>

<i>A minimalist yet efficient cookie manager for Firefox</i>

<a href="https://addons.mozilla.org/en-US/firefox/addon/simplecookie/"><img src="https://blog.mozilla.org/addons/files/2020/04/get-the-addon-fx-apr-2020.svg" height=50px></a>

<h2>Main popup</h2>

<img width="200" alt="Popup_light" src="https://github.com/user-attachments/assets/80be92ef-9913-49fb-adca-c31ab3ee765e">
<img width="200" alt="Popup_dark" src="https://github.com/user-attachments/assets/19758b8b-c059-4d28-8b6d-b5655fa42fa4">
<img width="200" alt="Popup_minimalist_light" src="https://github.com/user-attachments/assets/144c72ef-423e-4b10-9e73-de0c11b6b6cc">

<h2>Detailed table</h2>

<img width="350" alt="Table_light" src="https://github.com/user-attachments/assets/fb6e7f48-73a7-4626-9af5-c40a0b40e49e">
<img width="350" alt="Table_dark" src="https://github.com/user-attachments/assets/a77f6008-6a72-44c7-b64a-a2ff153a7539">

<h2>Settings</h2>

<img width="350" alt="Settings_light" src="https://github.com/user-attachments/assets/e5d7c2ac-6ae0-4b8b-b714-2045cd20e6e7">
<img width="350" alt="Settings_dark" src="https://github.com/user-attachments/assets/96337635-2914-4503-b91a-368ad4f64928">

<h2>Key features</h2>

1. <b>Cookie fetching:</b> SimpleCookie fetches all cookies stored in Firefox, supporting all cookie jars (containers) and partitioned (3rd party) cookies, and displays a list of websites with the number of cookies associated with them.

1. <b>Domain aggregation:</b> SimpleCookie shows you aggregated cookie domains for clarity. For example, if you have 5 cookies for "mail.proton.me" and 4 cookies for "drive.proton.me", SimpleCookie will show "proton.me (9)", aggregating data from all subdomains under the main domain. Hundreds of exceptions have been added for specific Second Level Domains (SLDs) used in different countries (such as .co.uk or .gouv.fr).

1. <b>Organized list:</b> The list of websites that store cookies is sorted alphabetically for easy navigation and quick access. Websites that are storing cookies and still have a tab open are displayed in green. The domain corresponding to the currently active tab is highlighted. Sites that are opened in special containers or have partitioned cookies are also highlighted.

1. <b>Detailed view:</b> Right-clicking on a domain opens a detailed view table with more information about the cookies associated with that particular website. Right-clicking additional top domains consolidates the detailed table with more cookies.

1. <b>Effortless cookie removal:</b> A single click on a website automatically deletes all cookies associated with that domain (so be careful!). A single click on a cookie line in the detailed table deletes that specific cookie.

1. <b>Quick actions:</b> The "broom" icon at the bottom left deletes all cookies associated with websites whose tabs are closed and keeps those used by open tabs (whose domains are highlighted in green), leaving the cookies "in use" and removing those previously used by tabs that are now closed. The "flame" icon deletes all cookies without exception. The "nuclear" icon deletes much more (all cookies, browsing history, cached images and files, autofill form data, download history, service workers, plugin data, local storage data and indexedDB data)! The fourth icon opens the Settings and Help sections.

1. <b>Tracker database:</b> SimpleCookie uses an internal tracking database derived from the Ghostery tracker database (https://github.com/ghostery/trackerdb) to identify organizations/websites known to track behavior (a ghost icon is displayed near the identified domains). While this does not confirm the collection of data in requests and cookies from these sites, they are known for their impact on user privacy.

1. <b>Theme options:</b> Light and Dark themes work seamlessly with Firefox's theme settings. The add-on also uses a system font that should be appropriate for the OS (macOS, Windows, Linux) it runs on.

1. <b>Lightweight design:</b> Minimalist and efficient UI. No background scripts intentionally. Font Awesome is used as icon library.

1. <b>Privacy policy:</b> SimpleCookie does not collect any data and there is no analytics or telemetry stuff in the code. This is just an open source hobby project by an indie dev (I'm not even a developer, I'm a researcher!) who is concerned about privacy. SimpleCookie uses the following permissions to work properly: 'all_urls' (for the domain aggregation), 'browsingData' (to clean up the dust!), 'cookies' (of course!), 'tabs' (to identify the active and closed tabs), 'contextualIdentities' (for the containers) and 'storage' (to store the settings).
