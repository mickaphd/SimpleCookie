<p align="center">
<img width="150" src=https://github.com/mickaphd/SimpleCookie/assets/25211018/64489133-ecae-435e-92d4-53cc79c9302c)>
</p>

<h1 align="center">SimpleCookie</h1></p>

<b><i>A minimalist yet efficient cookie manager for Firefox</i></b>

<i>SimpleCookie is the easiest and fastest way to view, learn about and delete cookies. It's also a configurable cleaner, so you can delete the browsing data of your choice. Remember that cookies are not all bad and are often very useful, so please be careful when using this add-on, read the description carefully and report any bugs or feature requests on GitHub.</i>

<a href="https://addons.mozilla.org/en-US/firefox/addon/simplecookie/"><img src="https://blog.mozilla.org/addons/files/2020/04/get-the-addon-fx-apr-2020.svg" height=50px></a>

<h2>Main popup</h2>

<img width="200" alt="Popup_light" src="https://github.com/user-attachments/assets/67156dc7-fd0a-4129-a69d-75045940cd02">
<img width="200" alt="Popup_light_undo" src="https://github.com/user-attachments/assets/41cc8fe8-f4b2-4760-ae54-cbccb4120280">
<img width="200" alt="Popup_dark" src="https://github.com/user-attachments/assets/88a2815d-e12a-41e4-99b0-b32e11bab356">
<img width="200" alt="Popup_light_confirm" src="https://github.com/user-attachments/assets/ff3590b5-0278-4d14-8fe5-c28939c31b1d">

<h2>Detailed table</h2>

<img width="350" alt="Table_light" src="https://github.com/user-attachments/assets/d5a104a4-bc59-4d83-ab81-a22c3ce7469e">
<img width="350" alt="Table_dark" src="https://github.com/user-attachments/assets/d10b93c9-a970-49b2-912c-57356aaa08c9">

<h2>Settings</h2>

<img width="350" alt="Settings_light" src="https://github.com/user-attachments/assets/e3c8284e-7bd8-437f-83cd-e06137e294eb">
<img width="350" alt="Settings_dark_extensions-menu" src="https://github.com/user-attachments/assets/5d0716d3-9b38-4402-9df9-5742d1332295">

<h2>Key features</h2>

1. <b>Cookie fetching:</b> SimpleCookie supports all cookie jars (containers) and partitioned cookies (3rd party, CHIPS) and displays a list of websites with the corresponding number of cookies.

1. <b>Domain aggregation:</b> SimpleCookie consolidates cookie subdomains under a main domain for clarity. It includes hundreds of exceptions for specific Second Level Domains (SLDs) used in various countries (e.g., .co.uk, .gouv.fr).

1. <b>Organized list:</b> Websites are sorted alphabetically for easy access. Sites storing cookies with an open tab are shown in green. The active tab's domain is highlighted, along with sites in special containers or with partitioned cookies.

1. <b>Detailed view:</b> Right-clicking on a listed website opens a table with detailed information about its associated cookies. Right-clicking additional sites consolidates this table with more cookies.

1. <b>Effortless cookie removal:</b> A single click on a website deletes all cookies associated with that domain. Clicking on a specific cookie line in the detailed table removes only that individual cookie.

1. <b>Safety first:</b> A 'backwards' icon appears in the Dock to undo the very last cookie deletion you triggered after clicking a website. A confirmation prompt also appears for the Dock shortcuts. Many footnotes have been added for educational purposes (icons, table headers, settings).

1. <b>Dock shortcuts:</b> The 'broom' icon deletes all cookies from websites with closed tabs, while retaining cookies from open tabs (highlighted in green). The 'trash can' icon deletes all cookies without exception. The 'hand sparkles' icon triggers the myCleaner feature, allowing you to clear your selected browsing data. The 'gear' icon opens the settings.

1. <b>Tracker database:</b> SimpleCookie uses an internal tracking database derived from Ghostery (https://github.com/ghostery/trackerdb) to identify organizations/websites known to track behavior (ghost icon). While this does not confirm the collection of data in requests and cookies from these sites, they are known for their impact on user privacy.

1. <b>Theme options:</b> Light and Dark themes work seamlessly with Firefox's theme settings. The add-on also uses a system font that should be appropriate for the OS it runs on (macOS, Windows, Linux).

1. <b>Lightweight design:</b> Minimalist and efficient UI. No background scripts intentionally. Font Awesome is used as icon library.

1. <b>Privacy policy:</b> SimpleCookie does not collect any data and there is no analytics or telemetry stuff in the code. This is just an open source hobby project by an indie dev (I'm not even a developer, I'm a researcher!) who is concerned about privacy. SimpleCookie uses the following permissions to work properly: 'all_urls' (for the domain aggregation), 'browsingData' (to clean up the dust!), 'cookies' (of course!), 'tabs' (to identify the active and closed tabs), 'contextualIdentities' (for the containers) and 'storage' (to store the settings).
