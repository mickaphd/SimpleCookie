/* SimpleCookie, a minimalist yet efficient cookie manager for Firefox */
/* Made with ❤ by micka from Paris */

/* Shared code loaded by background.js, popup.js and settings.js.               */
/* These three contexts each used to keep their own copy of the functions       */
/* below; that drifted over time (e.g. the badge in the background script no    */
/* longer grouped domains the same way as the popup, and the cookie export in   */
/* settings.js could under-count partitioned cookies). Centralizing them here   */
/* keeps behaviour identical everywhere and removes the risk of them drifting   */
/* apart again. */

// ==================== DOMAIN HELPERS ====================

// Fixed number of levels for domain extraction
const numLevels = -2;

// Object to hold special second-level domains (SLDs) sorted by country, kept
// as a readable grouping for maintenance — getMainDomain() below doesn't use
// this directly, it uses the flattened Set built right after it.
const specialSLDsByCountry = {
    Algeria: ['com.dz', 'gov.dz', 'org.dz', 'edu.dz', 'asso.dz', 'pol.dz', 'art.dz', 'net.dz', 'tm.dz', 'soc.dz'],
    Australia: ['com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'asn.au', 'id.au', 'csiro.au'],
    Austria: ['ac.at', 'gv.at', 'co.at', 'or.at', 'priv.at'],
    Bangladesh: ['com.bd', 'net.bd', 'org.bd', 'edu.bd', 'ac.bd', 'info.bd', 'co.bd', 'gov.bd', 'mil.bd', 'tv.bd'],
    Brazil: ['app.br', 'art.br', 'com.br', 'dev.br', 'eco.br', 'emp.br', 'log.br', 'net.br', 'ong.br', 'seg.br', 'edu.br', 'blog.br', 'flog.br', 'nom.br', 'vlog.br', 'wiki.br', 'agr.br', 'esp.br', 'etc.br', 'far.br', 'imb.br', 'ind.br', 'inf.br', 'radio.br', 'rec.br', 'srv.br', 'tmp.br', 'tur.br', 'tv.br', 'am.br', 'coop.br', 'fm.br', 'g12.br', 'gov.br', 'mil.br', 'org.br', 'psi.br', 'b.br', 'def.br', 'jus.br', 'leg.br', 'mp.br', 'tc.br'],
    France: ['avocat.fr', 'aeroport.fr', 'veterinaire.fr', 'gouv.fr'],
    Hungary: ['2000.hu', 'agrar.hu', 'bolt.hu', 'city.hu', 'co.hu', 'edu.hu', 'film.hu', 'forum.hu', 'games.hu', 'gov.hu', 'hotel.hu', 'info.hu', 'ingatlan.hu', 'jogasz.hu', 'konyvelo.hu', 'lakas.hu', 'media.hu', 'mobi.hu', 'net.hu', 'news.hu', 'org.hu', 'priv.hu', 'reklam.hu', 'shop.hu', 'sport.hu', 'suli.hu', 'tm.hu', 'tozsde.hu', 'utazas.hu', 'video.hu', 'casino.hu', 'erotica.hu', 'erotika.hu', 'sex.hu', 'szex.hu'],
    New_Zealand: ['ac.nz', 'co.nz', 'geek.nz', 'gen.nz', 'kiwi.nz', 'maori.nz', 'net.nz', 'org.nz', 'school.nz', 'cri.nz', 'govt.nz', 'health.nz', 'iwi.nz', 'mil.nz', 'parliament.nz'],
    Nigeria: ['com.ng', 'org.ng', 'gov.ng', 'edu.ng', 'net.ng', 'sch.ng', 'name.ng', 'mobi.ng', 'mil.ng', 'i.ng'],
    Pakistan: ['com.pk', 'org.pk', 'net.pk', 'ac.pk', 'edu.pk', 'res.pk', 'gov.pk', 'mil.pk', 'gok.pk', 'gob.pk', 'gkp.pk', 'gop.pk', 'gos.pk', 'gog.pk', 'ltd.pk', 'web.pk', 'fam.pk', 'biz.pk'],
    India: ['co.in', 'com.in', 'firm.in', 'net.in', 'org.in', 'gen.in', 'ind.in', 'ernet.in', 'ac.in'],
    Israel: ['ac.il', 'co.il', 'org.il', 'net.il', 'k12.il', 'gov.il', 'muni.il', 'idf.il'],
    Japan: ['ac.jp', 'ad.jp', 'co.jp', 'ed.jp', 'go.jp', 'gr.jp', 'lg.jp', 'ne.jp', 'or.jp'],
    Russia: ['ac.ru', 'com.ru', 'edu.ru', 'gov.ru', 'int.ru', 'mil.ru', 'net.ru', 'org.ru', 'pp.ru'],
    South_Africa: ['ac.za', 'co.za', 'edu.za', 'gov.za', 'law.za', 'mil.za', 'net.za', 'nom.za', 'org.za', 'school.za'],
    South_Korea: ['co.kr', 'ne.kr', 'or.kr', 're.kr', 'pe.kr', 'go.kr', 'mil.kr', 'ac.kr', 'hs.kr', 'ms.kr', 'es.kr', 'sc.kr', 'kg.kr', 'seoul.kr', 'busan.kr', 'daegu.kr', 'incheon.kr', 'gwangju.kr', 'daejeon.kr', 'ulsan.kr', 'gyeonggi.kr', 'gangwon.kr', 'chungbuk.kr', 'chungnam.kr', 'jeonbuk.kr', 'jeonnam.kr', 'gyeongbuk.kr', 'gyeongnam.kr', 'jeju.kr'],
    Spain: ['com.es', 'nom.es', 'org.es', 'gob.es', 'edu.es'],
    Sri_Lanka: ['gov.lk', 'ac.lk', 'sch.lk', 'net.lk', 'int.lk', 'com.lk', 'org.lk', 'edu.lk', 'ngo.lk', 'soc.lk', 'web.lk', 'ltd.lk', 'assn.lk', 'grp.lk', 'hotel.lk'],
    Thailand: ['ac.th', 'co.th', 'go.th', 'mi.th', 'or.th', 'net.th', 'in.th'],
    Trinidad_and_Tobago: ['co.tt', 'com.tt', 'org.tt', 'net.tt', 'travel.tt', 'museum.tt', 'aero.tt', 'tel.tt', 'name.tt', 'charity.tt', 'mil.tt', 'edu.tt', 'gov.tt'],
    Türkiye: ['gov.tr', 'mil.tr', 'tsk.tr', 'k12.tr', 'edu.tr', 'av.tr', 'dr.tr', 'bel.tr', 'pol.tr', 'kep.tr', 'com.tr', 'net.tr', 'org.tr', 'info.tr', 'bbs.tr', 'nom.tr', 'tv.tr', 'biz.tr', 'tel.tr', 'gen.tr', 'web.tr', 'name.tr'],
    Ukraine: ['com.ua', 'in.ua', 'org.ua', 'net.ua', 'edu.ua', 'gov.ua'],
    United_Kingdom: ['ac.uk', 'bl.uk', 'co.uk', 'gov.uk', 'judiciary.uk', 'ltd.uk', 'me.uk', 'mod.uk', 'net.uk', 'nhs.uk', 'nic.uk', 'org.uk', 'parliament.uk', 'plc.uk', 'police.uk', 'rct.uk', 'royal.uk', 'sch.uk', 'ukaea.uk'],
    United_States: ['ak.gov', 'al.gov', 'ar.gov', 'az.gov', 'ca.gov', 'co.gov', 'ct.gov', 'de.gov', 'fl.gov', 'ga.gov', 'hi.gov', 'ia.gov', 'id.gov', 'il.gov', 'in.gov', 'ks.gov', 'ky.gov', 'la.gov', 'ma.gov', 'md.gov', 'me.gov', 'mi.gov', 'mn.gov', 'mo.gov', 'ms.gov', 'mt.gov', 'nc.gov', 'nd.gov', 'ne.gov', 'nh.gov', 'nj.gov', 'nm.gov', 'nv.gov', 'ny.gov', 'oh.gov', 'ok.gov', 'or.gov', 'pa.gov', 'ri.gov', 'sc.gov', 'sd.gov', 'tn.gov', 'tx.gov', 'ut.gov', 'va.gov', 'vt.gov', 'wa.gov', 'wi.gov', 'wv.gov', 'wy.gov'],
};

// Flattened once at load time into a Set for O(1) lookup — getMainDomain()
// runs once per cookie in several hot paths (badge counting, every popup
// render, mySniper's sweep), so scanning all ~370 entries across 24 arrays
// on every single call was real, avoidable work.
const specialSLDs = new Set(Object.values(specialSLDsByCountry).flat());

/**
 * Extracts the main domain from a full domain
 * Handles special second-level domains correctly
 * Used everywhere a cookie's domain needs to be grouped under its "site"
 * (the popup's list, the badge counter, mySniper, favorites, etc.) so that
 * all of them agree on what counts as the same site.
 * @param {string} domain - Full domain to extract from
 * @returns {string} Main domain
 */
const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

function getMainDomain(domain) {
    if (!domain) return '';

    try {
        // An IPv4 address is its own "site" — reducing it to its last two
        // dot-separated segments like a normal domain would collapse e.g.
        // 192.168.1.1 and 10.0.1.1 down to the same "1.1". A domain cookie
        // (as opposed to a host-only one) carries a leading dot in Firefox's
        // cookie.domain field, so strip it before testing — otherwise a
        // domain-scoped cookie on an IP host would slip past this check and
        // hit the same collision this exists to prevent.
        if (IPV4_PATTERN.test(domain.startsWith('.') ? domain.substring(1) : domain)) return domain;

        const parts = domain.split('.').filter(part => part && part !== 'www');
        if (parts.length < 2) return domain;

        const lastTwoParts = parts.slice(-2).join('.');

        // Check if domain has a special SLD pattern
        if (specialSLDs.has(lastTwoParts)) {
            return parts.slice(-3).join('.');
        }

        // Default domain extraction
        return parts.slice(numLevels).join('.');
    } catch (error) {
        console.error('Error extracting main domain:', error);
        return domain; // Return original domain as fallback
    }
}


// ==================== COOKIE FETCHING ====================

/**
 * A cookie's identity in Firefox is fully defined by its name, domain, path,
 * storeId (container) and partitionKey (CHIPS) together — this key is used
 * to de-duplicate cookie lists everywhere that matters (fetchAllCookies()
 * below, and background.js's domain-scoped cookie count).
 * @param {Object} cookie - Cookie object
 * @returns {string}
 */
function cookieIdentityKey(cookie) {
    return `${cookie.name}|${cookie.domain}|${cookie.path}|${cookie.storeId}|${cookie.partitionKey ? JSON.stringify(cookie.partitionKey) : ''}`;
}

/**
 * Fetches all cookies from all containers and avoids duplicates
 * Retrieves both normal and partitioned cookies
 * @returns {Promise<Array>} Array of unique cookie objects
 */
async function fetchAllCookies() {
    try {
        // Fetch all containers
        const containers = await browser.contextualIdentities.query({});

        // Get all store IDs (containers + default)
        const storeIds = [...containers.map(container => container.cookieStoreId), ""];

        // For each store ID, fetch both normal and partitioned cookies
        const cookiePromises = storeIds.flatMap(storeId => [
            browser.cookies.getAll({ storeId }),
            browser.cookies.getAll({ storeId, partitionKey: {} })
        ]);

        // Wait for all promises to resolve and flatten the result
        const allCookies = (await Promise.all(cookiePromises)).flat();

        const uniqueMap = new Map();

        allCookies.forEach(cookie => {
            const key = cookieIdentityKey(cookie);

            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, cookie);
            }
        });

        return Array.from(uniqueMap.values());
    } catch (error) {
        console.error('Error fetching cookies:', error);
        return [];
    }
}


// ==================== COOKIE URL HELPER ====================

/**
 * Constructs the URL used to identify/remove a cookie via the cookies API.
 * Shared by popup.js, settings.js and background.js so a cookie's "identity
 * URL" is always built the exact same way.
 * @param {Object} cookie - Cookie object
 * @returns {string} URL for the cookie
 */
function getCookieUrl(cookie) {
    return `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`;
}


// ==================== MYSNIPER ====================

// A mySniper entry is a plain keyword, not a domain pattern: it matches any
// cookie whose domain contains that keyword anywhere (any subdomain, any
// TLD). This used to distinguish an "exact" domain from a "*wildcard" one,
// but real sites routinely scope cookies to an arbitrary subdomain (e.g.
// LinkedIn uses www.linkedin.com, not the bare domain) — a mode that isn't
// deliberately a subdomain-and-everything match ends up missing exactly the
// cookies someone typing "linkedin.com" would expect to be gone. A plain
// substring match sidesteps that trap entirely.

// Entries shorter than this are rejected (see settings.js) — a 1-2 character
// keyword would match an unreasonable number of unrelated domains.
const MIN_SNIPER_KEYWORD_LENGTH = 3;

/**
 * True if a cookie's domain contains the given mySniper keyword anywhere.
 * @param {Object} cookie - Cookie object
 * @param {string} keyword - Raw mySniper entry
 * @returns {boolean}
 */
function cookieMatchesSniperDomain(cookie, keyword) {
    if (!keyword || !cookie.domain) return false;
    // String(keyword): storage is user/JSON-editable, so guard against a
    // stray non-string entry throwing here and aborting the whole
    // .some()/.filter() pass it's normally called from — one bad entry
    // shouldn't silently disable sniping for every other keyword.
    const normalizedKeyword = String(keyword);
    // Same defensive posture as the length check settings.js applies before
    // ever saving a keyword: enforce it here too, in the one function every
    // sniper match ultimately goes through, in case storage ever holds a
    // too-short entry some other way (a direct edit, a future bug upstream).
    if (normalizedKeyword.length < MIN_SNIPER_KEYWORD_LENGTH) return false;
    return cookie.domain.toLowerCase().includes(normalizedKeyword.toLowerCase());
}


// ==================== KEYBOARD SHORTCUT ====================

// Name of the single command declared in manifest.json's "commands" key.
// Shared by background.js (listens for it) and settings.js (reads/writes
// its key combination via browser.commands), so the two can't drift apart
// on what the command is actually called.
const SHORTCUT_COMMAND_NAME = 'trigger-action';


// ==================== SETTINGS DEFAULTS ====================

/**
 * Single source of truth for every user setting and its default value.
 * Shared by popup.js (applies the settings) and settings.js (edits them),
 * so the two can never silently disagree about what "default" means.
 */
const DEFAULT_SETTINGS = {
    enableGhostIcon: true,
    enableSpecialJarIcon: true,
    enablePartitionIcon: true,
    enableRiskyCookieIcon: false,
    enableActiveTabHighlight: true,
    mycleanerCookies: false,
    mycleanerBrowsingHistory: true,
    mycleanerCache: false,
    mycleanerAutofill: false,
    mycleanerDownloadHistory: true,
    mycleanerService: false,
    mycleanerPlugin: false,
    mycleanerLocal: false,
    mycleanerIndexed: false,
    mycleanerPasswords: false,
    OpenTabsTop: false,
    showCookieCountBadge: true,
    shortcutAction: 'openPopup'
};
