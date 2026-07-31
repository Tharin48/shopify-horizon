/**
 * horizon-collection-return.js
 *
 * Progressively enhances collection/search -> product -> back navigation:
 *  - Remembers the exact collection/search URL (path + query, i.e. filters
 *    and sorting are Shopify's own `filter.*` / `sort_by` / `page` params)
 *    and scroll position the customer last saw, in a namespaced
 *    sessionStorage key.
 *  - Restores that scroll position when the customer returns to the exact
 *    same collection/search URL.
 *  - Upgrades `[data-product-back-link]` on product pages to prefer
 *    `history.back()` when the previous same-origin entry is that
 *    collection/search page, otherwise rewrites its `href` to the
 *    remembered URL. The link always keeps a valid server-rendered `href`,
 *    so it is never broken without JavaScript.
 *
 * Namespaced storage key (never a generic name, to avoid collisions with
 * apps or other theme scripts): `horizonCollectionReturnState`.
 *
 * Tolerant of Shopify section re-rendering / Theme Editor reloads: all work
 * is idempotent and re-runs safely via `shopify:section:load`.
 */

const STORAGE_KEY = 'horizonCollectionReturnState';
const MAX_STATE_AGE_MS = 30 * 60 * 1000; // 30 minutes
const COLLECTION_CONTEXT_SELECTOR = 'results-list';
const BACK_LINK_SELECTOR = '[data-product-back-link]';

/** @returns {{ url: string, scrollY: number, savedAt: number } | null} */
function readState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.url !== 'string' ||
      typeof parsed.scrollY !== 'number' ||
      typeof parsed.savedAt !== 'number'
    ) {
      return null;
    }

    if (Date.now() - parsed.savedAt > MAX_STATE_AGE_MS) return null;

    return parsed;
  } catch {
    return null;
  }
}

/** @param {{ url: string, scrollY: number, savedAt: number }} state */
function writeState(state) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable (private mode, quota, etc.) - degrade silently.
  }
}

/** @returns {string} Current pathname + search, used as the comparison key. */
function currentCollectionUrl() {
  return window.location.pathname + window.location.search;
}

function isCollectionContext() {
  return Boolean(document.querySelector(COLLECTION_CONTEXT_SELECTOR));
}

/**
 * Snapshot the current collection/search page's URL and scroll position so
 * it can be restored later, regardless of how the customer navigates away
 * (product card click, quick add, keyboard, back/forward, etc.).
 */
function saveReturnState() {
  if (!isCollectionContext()) return;

  writeState({
    url: currentCollectionUrl(),
    scrollY: window.scrollY,
    savedAt: Date.now(),
  });
}

/**
 * Restore scroll position when landing back on the exact same collection/
 * search URL. Only restores on genuinely fresh loads near the top, so it
 * never fights the browser's own back/forward cache restoration or jumps
 * an unrelated collection.
 */
function restoreScrollIfMatching() {
  if (!isCollectionContext()) return;

  const state = readState();
  if (!state || state.url !== currentCollectionUrl()) return;
  if (state.scrollY <= 0) return;
  if (window.scrollY > 40) return; // Something already scrolled the page; don't fight it.

  requestAnimationFrame(() => {
    window.scrollTo({ top: state.scrollY, left: 0, behavior: 'instant' });
  });
}

function initCollectionReturnTracking() {
  if (!isCollectionContext()) return;

  restoreScrollIfMatching();

  // pagehide covers every way the customer can leave (link click, quick add
  // redirect, back/forward, closing the tab) without needing to know about
  // specific product-card markup. Deliberately not using `beforeunload`,
  // which would disable the browser's back/forward cache.
  window.addEventListener('pagehide', saveReturnState);
}

/**
 * @param {string} href
 * @returns {string | null} Same-origin pathname + search, or null.
 */
function sameOriginUrl(href) {
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

/**
 * Enhance a single back-link: prefer `history.back()` when we can confirm
 * the previous same-origin entry is the collection/search page the customer
 * came from; otherwise upgrade `href` to the remembered collection/search
 * URL. Leaves the server-rendered fallback `href` untouched otherwise.
 *
 * @param {Element} link
 */
function enhanceBackLink(link) {
  if (!(link instanceof HTMLAnchorElement)) return;
  if (link.dataset.productBackLinkEnhanced === 'true') return;
  link.dataset.productBackLinkEnhanced = 'true';

  const state = readState();
  const referrerUrl = document.referrer ? sameOriginUrl(document.referrer) : null;
  const cameFromRememberedCollection = Boolean(state && referrerUrl && referrerUrl === state.url);
  // A duplicated tab (e.g. ctrl/cmd-click) can inherit sessionStorage and
  // document.referrer from its opener without an actual previous entry in
  // this tab's own history stack, so `history.back()` would be a no-op.
  const canGoBack = window.history.length > 1;

  if (cameFromRememberedCollection && canGoBack) {
    link.addEventListener('click', (event) => {
      // Modifier/middle clicks should keep the normal `href` behavior (new tab, etc.).
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.target && link.target.toLowerCase() !== '_self') return;

      event.preventDefault();
      history.back();
    });
    return;
  }

  // No confirmed same-origin referrer match: fall back to the last known
  // collection/search URL (still same-origin, still filters intact) when we
  // have one, otherwise keep the Liquid-rendered fallback href as-is.
  if (state) {
    link.href = state.url;
  }
}

function initBackLinks(root = document) {
  root.querySelectorAll(BACK_LINK_SELECTOR).forEach(enhanceBackLink);
}

function init(root = document) {
  initCollectionReturnTracking();
  initBackLinks(root);
}

init();

// Re-run for content swapped in by the Section Rendering API / Theme Editor.
document.addEventListener('shopify:section:load', (event) => {
  const target = /** @type {CustomEvent & { target: Element | null } } */ (event).target;
  if (target instanceof Element) init(target);
});
