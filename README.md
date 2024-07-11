<p align="center">
<img width="150" src=https://github.com/mickaphd/SimpleCookie/assets/25211018/64489133-ecae-435e-92d4-53cc79c9302c)>
</p>

<h1 align="center">SimpleCookie</h1></p>
<i>A minimalist yet efficient cookie manager for Firefox</i>

<h2>Main popup</h2>

<img width="273" alt="Popup_light" src="https://github.com/mickaphd/SimpleCookie/assets/25211018/4706708f-e71b-4b29-ba69-82b1cf63453a">
<img width="273" alt="Popup_dark" src="https://github.com/mickaphd/SimpleCookie/assets/25211018/7c45379e-021d-4f40-b583-b0de3376db16">
<img width="273" alt="Popup_minimalist_light" src="https://github.com/mickaphd/SimpleCookie/assets/25211018/ff0510af-b12f-464b-82b8-4edfe841a9ea">

<h2>Detailed table</h2>

<img width="450" alt="Table_light" src="https://github.com/mickaphd/SimpleCookie/assets/25211018/d1e8ea3d-193d-4888-afe5-f0c2c20bac96">
<img width="500" alt="Table_dark" src="https://github.com/mickaphd/SimpleCookie/assets/25211018/84bc3210-09fe-4537-996a-51ae27386df8">

<h2>Settings</h2>

<img width="500" alt="Settings_light" src="https://github.com/mickaphd/SimpleCookie/assets/25211018/b83687e2-1edf-406a-ac14-4d0193b46c24">

<h2>Key features</h2>

1. <b>Domain aggregation:</b> SimpleCookie aggregates cookie data and shows only the main domains for clarity. For example, if you have 5 cookies for "mail.proton.me" and 4 cookies for "drive.proton.me", SimpleCookie will show "proton.me (9)", aggregating data from all subdomains under the main domain. This level of aggregation can be adjusted in the settings if needed.

1. <b>Organized list:</b> The list of sites that store cookies is arranged alphabetically for easy navigation and quick access. Sites that store cookies and still have a tab open in your browser appear in green. The domain corresponding to the currently active tab is also highlighted.

1. <b>Detailed view:</b> Right-clicking on a domain opens a detailed view table with more information about the cookies associated with that particular website. Right-clicking additional top domains consolidates the detailed table with more cookies.

1. <b>Effortless cookie removal:</b> A single click on a website automatically deletes all cookies associated with that domain. A single click on a cookie line in the detailed table deletes that specific cookie. 

1. <b>Real-time updates:</b> The number of cookies associated with each domain is shown in parentheses, and the pop-up is dynamically updated each time you open it.

1. <b>Tracker database:</b> SimpleCookie uses an internal tracking database derived from the Ghostery tracker database (https://github.com/ghostery/trackerdb) to identify organizations/websites known to track behavior (a ghost icon is displayed near the identified domains). While this does not confirm the collection of data in requests and cookies from these sites, they are known for their impact on user privacy.

1. <b>Quick actions:</b> The first icon on the bottom left deletes all cookies associated with websites whose tabs are closed and keeps those used by open tabs (whose domains are highlighted in green), leaving the cookies "in use" and removing those previously used by tabs that are now closed. The second icon in the middle deletes all cookies without exception. The third icon deletes all cookies, browsing history, cached images and files, autofill form data, download history, service workers, plugin data, saved passwords, local storage data, and indexedDB data. The fourth icon opens the settings.

1. <b>Optional features:</b> The level of main domain aggregation, the Ghostery tracking database feature, the active tab indicator, and the entire bottom ribbon with all icon shortcuts can be modified or disabled at your convenience in the settings.

1. <b>Theme options:</b> Light and Dark themes work seamlessly with Firefox's theme settings. The addon also uses a system font that should be appropriate for the OS it runs on.

1. <b>Lightweight design:</b> No background scripts intentionally. Font Awesome is used as icon library.
