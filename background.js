/* SimpleCookie, a minimalist yet efficient cookie manager for Firefox */
/* Made with ❤ by micka from Paris */

// ==================== CONSTANTS ====================

const BADGE_UPDATE_DEBOUNCE = 300; // ms for debouncing rapid updates
const BADGE_UPDATE_MAX_WAIT = 1500; // ms — force a flush even during a sustained burst

// ==================== STATE ====================

let activeTabId = null;
let activeDomain = null;
let badgeUpdateTimeout = null; // Debounce timer
let badgeUpdateMaxWaitTimeout = null; // Forces a flush during a sustained burst

// In-memory copies of the two storage keys mySniper needs on every single
// cookie change in the whole browser (see enforceSniperOnCookie below). Kept
// in sync by the storage.onChanged listener, so that hot path never has to
// touch browser.storage.local itself.
let cachedSniperDomains = [];
let cachedFavorites = [];

// Derived from cachedFavorites, kept alongside it: enforceSniperOnCookie()
// below runs on every single cookie write in the browser, and used to remap
// cachedFavorites through getMainDomain() from scratch on every one of those
// calls even though favorites only actually change on a storage write. This
// is recomputed only where cachedFavorites itself is (re)assigned below.
let cachedFavoriteMainDomains = new Set();

// Bumped every time cachedSniperDomains/cachedFavorites are written, so the
// slow initial storage read in initializeBackground() below can tell whether
// a faster, more recent write (from storage.onChanged, e.g. the user saving
// a setting right as the page wakes from suspension) already landed while it
// was still in flight — and skip clobbering that fresher value with its own
// stale snapshot.
let cacheGeneration = 0;

// Resolves once the caches above have been populated at least once. This is
// a non-persistent MV3 event page: Firefox suspends it after idle and reruns
// this whole script — caches reset to [] — whenever it wakes the page to
// deliver a queued event. If that waking event is a cookies.onChanged for a
// sniped domain, enforceSniperOnCookie() would otherwise see the not-yet-
// populated cache and skip it (the cookie still gets caught a moment later
// by sweepSniperDomains, but that defeats "react as fast as possible" on
// every wake, not just first install). Awaiting this promise closes that gap.
let backgroundReadyPromise = null;

// ==================== INITIALIZATION ====================

/**
 * Initializes the background script with active tab information
 */
function initializeBackground() {
    backgroundReadyPromise = (async () => {
        try {
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0) {
                activeTabId = tabs[0].id;
                updateActiveDomain(tabs[0].url);
                // Update badge immediately on startup
                await updateBadgeFromBackground();
            }

            // Array.isArray guards: storage is user/JSON-editable (e.g. via
            // about:debugging), so don't assume either key is actually an array.
            const generationBeforeRead = cacheGeneration;
            const stored = await browser.storage.local.get(['sniperDomains', 'favorites']);
            if (cacheGeneration === generationBeforeRead) {
                // Nothing fresher landed while this read was in flight — safe to apply.
                cachedSniperDomains = Array.isArray(stored.sniperDomains) ? stored.sniperDomains : [];
                cachedFavorites = Array.isArray(stored.favorites) ? stored.favorites : [];
                cachedFavoriteMainDomains = new Set(cachedFavorites.map(getMainDomain));
            }

            // Make sure mySniper's keywords don't already have cookies sitting
            // around from before the browser (re)started.
            await sweepSniperDomains(cachedSniperDomains);
        } catch (error) {
            console.error('Error initializing background:', error);
        }
    })();
}

// Initialize on script load
initializeBackground();

// ==================== EVENT LISTENERS ====================

/**
 * Listen for tab changes
 */
browser.tabs.onActivated.addListener(async (activeInfo) => {
    activeTabId = activeInfo.tabId;
    try {
        const tab = await browser.tabs.get(activeTabId);
        updateActiveDomain(tab.url);
        // Ensure badge updates immediately when tab changes
        await updateBadgeFromBackground();
    } catch (error) {
        console.error('Error getting tab info:', error);
        activeDomain = null;
    }
});

/**
 * Listen for URL changes within the active tab
 */
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only update if this is the active tab
    if (tabId === activeTabId && changeInfo.url) {
        updateActiveDomain(changeInfo.url);
        await updateBadgeFromBackground();
    }
});

/**
 * Listen for cookie changes: update the badge (debounced) and enforce
 * mySniper — Firefox has no API to stop a cookie from being stored in the
 * first place, so this reacts as fast as possible instead.
 */
browser.cookies.onChanged.addListener(async (changeInfo) => {
    scheduleBadgeUpdate();

    // Only react to cookies being set, not to removals (that would just
    // re-trigger this same listener with removed:true — nothing to do there).
    if (!changeInfo.removed) {
        await enforceSniperOnCookie(changeInfo.cookie);
    }
});

/**
 * Listen for setting changes
 */
browser.storage.onChanged.addListener(async (changes) => {
    if (changes.showCookieCountBadge) {
        await updateBadgeFromBackground();
    }
    if (changes.favorites) {
        cachedFavorites = Array.isArray(changes.favorites.newValue) ? changes.favorites.newValue : [];
        cachedFavoriteMainDomains = new Set(cachedFavorites.map(getMainDomain));
        cacheGeneration++;
        // A domain that just lost its favorite status might now need sniping
        // (a domain that just became a favorite needs nothing — enforcement
        // already checks favorites fresh on every event, so it simply stops).
        await sweepSniperDomains(cachedSniperDomains);
    }
    if (changes.sniperDomains) {
        cachedSniperDomains = Array.isArray(changes.sniperDomains.newValue) ? changes.sniperDomains.newValue : [];
        cacheGeneration++;
        await sweepSniperDomains(cachedSniperDomains);
    }
});

/**
 * Listen for the single user-configurable keyboard shortcut (see
 * manifest.json's "commands" key and settings.js's Keyboard Shortcut
 * section, which is what actually assigns/changes the key combination via
 * browser.commands.update()). This only decides WHICH action to run —
 * the key combination itself lives entirely in Firefox's own commands
 * storage, not in browser.storage.local.
 */
browser.commands.onCommand.addListener(async (command) => {
    if (command !== SHORTCUT_COMMAND_NAME) return;

    try {
        // Treat the shortcut as a toggle: since every one of the 4 possible
        // actions opens the popup (even the 3 dock actions — see below), if
        // it's already open, pressing the shortcut again just closes it
        // instead of doing anything else. Lets you glance at your cookies and
        // dismiss with the same key combo instead of needing a second one.
        const openPopupViews = browser.extension.getViews({ type: 'popup' });
        if (openPopupViews.length > 0) {
            openPopupViews[0].close();
            return;
        }

        const { shortcutAction = DEFAULT_SETTINGS.shortcutAction } = await browser.storage.local.get('shortcutAction');

        if (!shortcutAction || shortcutAction === 'openPopup') {
            await browser.action.openPopup();
            return;
        }

        // The other actions are destructive (they delete cookies), and there's
        // no popup UI open yet to show the confirmation modal or arm Undo.
        // Rather than run them headlessly here with no safety net (which would
        // also mean duplicating popup.js's deletion logic), stash which action
        // to run and open the popup — popup.js runs it the moment it's done
        // loading, through the exact same confirm+Undo path as a manual click
        // (see runPendingShortcutAction() in popup.js).
        await browser.storage.local.set({ pendingShortcutAction: shortcutAction });
        await browser.action.openPopup();
    } catch (error) {
        console.error('Error handling keyboard shortcut command:', error);
    }
});

// ==================== MESSAGE HANDLING ====================

/**
 * Listen for messages from popup
 */
browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'updateBadge') {
        await updateBadgeFromBackground();
        sendResponse({ success: true });
    }
});

// ==================== BADGE LOGIC ====================

/**
 * Debounces the badge update, but with a max-wait ceiling: a plain
 * reset-on-every-event debounce can be starved indefinitely by a sustained
 * burst of cookie changes (e.g. mySniper's own sweep removing many cookies
 * in quick succession) — the badge would then stay stale for as long as the
 * burst continues. The max-wait timer isn't reset by new events, so it
 * forces a flush at most BADGE_UPDATE_MAX_WAIT after the burst started.
 */
function scheduleBadgeUpdate() {
    if (badgeUpdateTimeout) {
        clearTimeout(badgeUpdateTimeout);
    }

    const flush = () => {
        clearTimeout(badgeUpdateTimeout);
        clearTimeout(badgeUpdateMaxWaitTimeout);
        badgeUpdateTimeout = null;
        badgeUpdateMaxWaitTimeout = null;
        updateBadgeFromBackground();
    };

    badgeUpdateTimeout = setTimeout(flush, BADGE_UPDATE_DEBOUNCE);

    if (!badgeUpdateMaxWaitTimeout) {
        badgeUpdateMaxWaitTimeout = setTimeout(flush, BADGE_UPDATE_MAX_WAIT);
    }
}

/**
 * Updates badge based on active tab domain
 */
async function updateBadgeFromBackground() {
    try {
        // Fall back to the shared default (see common.js) rather than a
        // hardcoded value here, so the very first run behaves the same
        // whether the badge setting was touched via the popup, settings,
        // or never touched at all.
        const settings = await browser.storage.local.get({
            showCookieCountBadge: DEFAULT_SETTINGS.showCookieCountBadge
        });

        if (!settings.showCookieCountBadge || !activeDomain) {
            await browser.action.setBadgeText({ text: '' });
            return;
        }
        
        const cookieCount = await countCookiesForDomain(activeDomain);
        const badgeText = cookieCount > 0 ? String(cookieCount) : '';
        await browser.action.setBadgeText({ text: badgeText });
        
        // Set badge colors - Dark brown background with white text
        if (badgeText) {
            await browser.action.setBadgeBackgroundColor({ color: '#63280B' });
            
            await browser.action.setBadgeTextColor({ color: '#FFFFFF' });
        }
    } catch (error) {
        console.error('Error updating badge:', error);
    }
}

/**
 * Counts cookies for a specific domain.
 * This runs on every tab switch and every cookie change in the browser, so
 * unlike the popup (which needs every cookie anyway to build its list), it
 * asks the cookies API to filter by domain server-side
 * (browser.cookies.getAll({ domain })) instead of fetching every cookie in
 * every container via the shared fetchAllCookies() just to keep one count.
 * @param {string} hostname - The hostname to count cookies for
 * @returns {Promise<number>} Number of cookies for the domain
 */
async function countCookiesForDomain(hostname) {
    try {
        if (!hostname) return 0;

        const mainDomain = getMainDomain(hostname);
        const containers = await browser.contextualIdentities.query({});
        const storeIds = [...containers.map(container => container.cookieStoreId), ""];

        const cookiePromises = storeIds.flatMap(storeId => [
            browser.cookies.getAll({ storeId, domain: mainDomain }),
            browser.cookies.getAll({ storeId, domain: mainDomain, partitionKey: {} })
        ]);

        const matchingCookies = (await Promise.all(cookiePromises)).flat();
        const uniqueKeys = new Set(matchingCookies.map(cookieIdentityKey));

        return uniqueKeys.size;
    } catch (error) {
        console.error('Error counting cookies:', error);
        return 0;
    }
}

/**
 * Updates active domain from URL
 * @param {string} url - The URL to extract domain from
 */
function updateActiveDomain(url) {
    try {
        const urlObj = new URL(url);
        activeDomain = urlObj.hostname;
    } catch (error) {
        console.error('Invalid URL:', error);
        activeDomain = null;
    }
}


// ==================== MYSNIPER ====================

// Firefox has no WebExtensions API to actually stop a cookie from being
// stored for a given domain (contentSettings.cookies looks like it should
// do this, but it was never implemented — see Mozilla bug 1291841, open
// since 2016). So mySniper can't truly be "preventive": it can only react
// as fast as possible once a matching cookie is set, via cookies.onChanged
// below, plus a sweep whenever the keyword list changes or the browser
// (re)starts, in case something appeared while nothing was listening.

/**
 * Removes every cookie whose domain currently matches one of mySniper's
 * keywords, except favorites. Called whenever the list changes and once at startup.
 * @param {Array<string>} sniperDomains - Current mySniper keyword list
 */
async function sweepSniperDomains(sniperDomains) {
    try {
        if (!Array.isArray(sniperDomains) || sniperDomains.length === 0) return;

        const allCookies = await fetchAllCookies();

        const cookiesToRemove = allCookies.filter(cookie =>
            !cachedFavoriteMainDomains.has(getMainDomain(cookie.domain)) &&
            sniperDomains.some(domain => cookieMatchesSniperDomain(cookie, domain))
        );

        // Promise.allSettled: one bad cookie shouldn't stop the rest from being removed.
        await Promise.allSettled(cookiesToRemove.map(cookie =>
            browser.cookies.remove({
                url: getCookieUrl(cookie),
                name: cookie.name,
                storeId: cookie.storeId,
                partitionKey: cookie.partitionKey
            })
        ));
    } catch (error) {
        console.error('Error sweeping mySniper domains:', error);
    }
}

/**
 * The real enforcement mechanism: as soon as a cookie whose domain matches a
 * mySniper keyword is set (and it isn't a favorite), remove it again
 * immediately. Runs on every cookie write in the entire browser, so it reads
 * only the in-memory cache (cachedSniperDomains/cachedFavoriteMainDomains) —
 * no browser.storage.local round-trip, and no re-deriving main domains from
 * cachedFavorites from scratch, on this hot path.
 * @param {Object} cookie - The cookie that was just set
 */
async function enforceSniperOnCookie(cookie) {
    try {
        // Make sure the caches are actually populated before trusting them —
        // see backgroundReadyPromise's comment above for why this matters
        // right after the script wakes from suspension. Once warmed up this
        // await resolves immediately (already-settled promise).
        if (backgroundReadyPromise) await backgroundReadyPromise;

        if (cachedSniperDomains.length === 0) return;
        if (cachedFavoriteMainDomains.has(getMainDomain(cookie.domain))) return;
        if (!cachedSniperDomains.some(domain => cookieMatchesSniperDomain(cookie, domain))) return;

        await browser.cookies.remove({
            url: getCookieUrl(cookie),
            name: cookie.name,
            storeId: cookie.storeId,
            partitionKey: cookie.partitionKey
        });
    } catch (error) {
        console.error('Error enforcing mySniper on cookie change:', error);
    }
}
