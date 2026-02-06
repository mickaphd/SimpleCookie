# SimpleCookie  

<p align="center">
  <img src="https://github.com/mickaphd/SimpleCookie/assets/25211018/64489133-ecae-435e-92d4-53cc79c9302c" width="160" height="160" alt="SimpleCookie Logo" />
  <br />
  <strong>Status:</strong> Maintained
  <br>
  <strong>Version:</strong> 3.4
  <br />
<p align="center">
  <a href="https://addons.mozilla.org/firefox/addon/simplecookie/" target="_blank" rel="noopener">
    <img src="https://blog.mozilla.org/addons/files/2015/11/get-the-addon.png" height="60" alt="Get the Add-on" />
  </a>
</p>

</p>


SimpleCookie is the easiest and fastest way to view, learn about, and delete cookies. It also serves as a configurable cleaner. Remember that cookies and related data are often very useful, so please use this add-on with caution, read the description carefully, and report any bugs or feature requests on GitHub.


## Table of Contents  
[Features](#features) | [Screenshots](#screenshots) | [Usage](#usage) | [Privacy Policy](#privacy-policy) | [Issues](#issues)


## Features

- **Cookie fetching**: SimpleCookie supports all cookie jars (containers) and partitioned cookies (3rd party, CHIPS) and displays a list of websites with the corresponding number of cookies.
- **Domain aggregation**: SimpleCookie consolidates cookie subdomains under a main domain for clarity. It includes hundreds of exceptions for specific Second Level Domains (SLDs) used in various countries (e.g., .co.uk, .gouv.fr).
- **Organized list**: Websites are sorted alphabetically for easy access. Sites storing cookies with an open tab are shown in green and can be displayed at the top. The active tab's domain is highlighted, along with sites in special containers or with partitioned cookies.
- **Detailed view**: Right-clicking on a listed website opens a table with detailed information about its associated cookies. Right-clicking additional sites consolidates this table with more cookies.
- **Effortless cookie removal**: A single click on a website deletes all cookies associated with that domain. Clicking on a specific cookie line in the detailed table removes only that individual cookie.
- **Safety first**: A 'star/favorite' icon allows you to protect cookies from being deleted. A 'backwards' icon appears in the Dock to undo the very last cookie deletion you triggered. A confirmation prompt also appears for the Dock shortcuts. An export/import function (JSON format) allows you to back up your cookies. Many footnotes have been added for educational purposes (icons, table headers, settings, etc.).
- **Cookie editor**: An option in the settings allows you to create a new cookie from scratch. An edit option is available from the detailed table.
- **Dock shortcuts**: The 'broom' icon deletes all cookies from websites with closed tabs while retaining cookies from open tabs (highlighted in green) and your favorites. The 'sniper' icon deletes specific domains from your 'Most Wanted' list, except your favorites. The 'vacuum' icon deletes all cookies stored in Firefox except your favorites. The 'missile target' icon launches the myCleaner feature, allowing you to clear your selected browsing data. The 'gear' icon opens the settings.
- **Cookie counter**: Display the number of cookies for the active tab over the icon.
- **Tab switcher**: Hold Command (Mac) or Ctrl (PC) to enable the Tab Switcher feature so that a left click on one of the open tabs highlighted in green will switch to it.
- **Tracker database**: SimpleCookie uses an internal tracking database derived from Ghostery (trackerdb) to identify organizations/websites known to track behavior (ghost icon). While this does not confirm the collection of data in requests and cookies from these sites, they are known for their impact on user privacy.
- **Theme options**: Light and Dark themes work seamlessly with Firefox's theme settings. The add-on also uses a system font that should be appropriate for the OS it runs on (macOS, Windows, Linux).

## Screenshots

| Main Popup (Light) | Main Popup (Dark) | Detailed Table (Dark) | Settings (Light) |
|:------------------:|:-----------------:|:-----------------:|:-----------------:|
| <img src="https://github.com/user-attachments/assets/c9540aec-028d-44a1-965d-7ffea33f9c80" width="80%" alt="Popup Light" /> | <img src="https://github.com/user-attachments/assets/fcc9ea7b-f53f-4f5e-a678-8b1d94d0cefc" width="80%" alt="Popup Light" /> | <img src="https://github.com/user-attachments/assets/68e304f6-5b75-4ebe-beb7-f2f8f792e0be" width="80%" alt="Table Dark" /> | <img src="https://github.com/user-attachments/assets/b0a67a87-f022-47f6-a4a3-c69615cd0f7a" width="80%" alt="Settings Light" />

## Main Usages

-   Click the SimpleCookie icon to open the main popup showing cookie counts per site.  
-   Right-click a website to display detailed information about all cookies from the clicked domain.  
-   Left-click a website to delete all its cookies, or a cookie line in the table to delete that specific one. 
-   Use the Dock icons for quick cleaning actions:  
    - **Broom:** Clean cookies from closed tabs only (except your favorites)
    - **Sniper:** Delete very specific cookies from your 'Most Wanted' list (except your favorites) 
    - **Vacuum:** Clean all cookies (except your favorites)  
    - **Missile target:** Launch the 'myCleaner' feature  
    - **Gear:** Open settings  
-   Hold Cmd (macOS) or Ctrl (PC) and click a green-highlighted site to switch to it  


## Privacy Policy

SimpleCookie does not collect any data, and there is no analytics or telemetry in the code. This is just an open-source hobby project designed at the begining just for myself, an indie dev (I'm not even a developer; I'm a researcher!) who is concerned about privacy. SimpleCookie uses the following permissions to work properly: all_urls (for domain aggregation), browsingData (to clean up the dust!), cookies (of course!), tabs (to identify the active and closed tabs), contextualIdentities (for the containers), and storage (to store the settings).


## Issues

> **Please report bugs or feature requests here:**  
> https://github.com/mickaphd/SimpleCookie/issues  

<br>

Thank you for using **SimpleCookie**!  
If you enjoy this project, consider starring ⭐ it on the Firefox Add-ons store and GitHub.
