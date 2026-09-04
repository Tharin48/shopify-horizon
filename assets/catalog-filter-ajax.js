/**
 * catalog-filter-ajax.js
 *
 * Progressively enhances the custom catalog collection page so that clicking
 * any filter link (tea types, format pills, chips, clear-all, and bottom pagination
 * when infinite scroll is off) fetches
 * only the section HTML via the Shopify Section Rendering API and swaps the
 * relevant DOM regions in-place — no full page reload.
 *
 * Progressive enhancement: if JS is absent or the fetch fails, normal link
 * navigation takes over automatically.
 *
 * Swapped regions (identified by data attributes on stable wrapper elements):
 *   [data-catalog-tea-types]      — tea type <ul> (active/inactive states)
 *   [data-catalog-pills-region]   — format pills + active chips bar
 *   [data-catalog-toolbar-region] — toolbar + mobile filter drawer markup
 *   [data-catalog-results-region] — product grid (+ bottom pagination only when infinite scroll is off)
 */

/**
 * CSS selectors whose descendant <a> elements are intercepted for AJAX navigation.
 * Using an array so it is easy to extend.
 * @type {string[]}
 */
const FILTER_LINK_ROOTS = [
  '[data-catalog-tea-types]',
  '[data-catalog-pills-region]',
  '[data-catalog-toolbar]',
  '[data-catalog-mobile-drawer]',
  '[data-catalog-results-region]',
];

/**
 * CSS selectors whose descendant <a> elements are NEVER intercepted.
 * Product card links live inside the results region but must navigate to the PDP,
 * not re-render the section. Takes priority over FILTER_LINK_ROOTS.
 * @type {string[]}
 */
const FILTER_LINK_EXCLUDE = [
  '[data-catalog-product-grid]',
];

/**
 * data-* attribute names for regions that are replaced in the live DOM
 * after each successful fetch. Order does not matter.
 * @type {string[]}
 */
const SWAPPABLE_REGIONS = [
  'data-catalog-tea-types',
  'data-catalog-pills-region',
  'data-catalog-toolbar-region',
  'data-catalog-results-region',
];

class CatalogFilterAjax {
  /** @type {HTMLElement} */
  #root;

  /** @type {string} */
  #sectionId;

  /** @type {boolean} */
  #pageMode;

  /** @type {string} */
  #sourceUrl;

  /** @type {AbortController | null} */
  #inflight = null;

  /** @param {HTMLElement} root */
  constructor(root) {
    this.#root = root;
    this.#sectionId = root.dataset.sectionId ?? '';
    this.#pageMode = root.dataset.catalogPageMode === 'true';
    this.#sourceUrl = root.dataset.catalogSourceUrl ?? '';

    if (this.#root.dataset.catalogAjaxInitialized === 'true') {
      return;
    }

    if (!this.#sectionId) {
      return;
    }

    this.#root.dataset.catalogAjaxInitialized = 'true';
    this.#init();
  }

  #init() {
    // Delegate to the root so re-rendered HTML inside swapped regions is
    // automatically covered without re-binding.
    this.#root.addEventListener('click', (e) => this.#handleClick(e));

    // Support browser back / forward navigation.
    window.addEventListener('popstate', (e) => this.#handlePopState(e));

    // A page template can display collection products, but Shopify only resolves
    // complete native facets in a collection-route request. Hydrate this page-only
    // instance from that route without navigating away from the landing page.
    if (this.#pageMode && this.#sourceUrl) {
      this.#navigate(this.#sourceUrl, false, true);
    }
  }

  /** @param {MouseEvent} e */
  #handleClick(e) {
    // Only handle plain left-click; let modifier-key combos open new tabs normally.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }

    const link = /** @type {Element} */ (e.target).closest('a[href]');
    if (!link) return;

    // Never intercept product card links —
    // those must navigate to the PDP normally. Check this before the filter-root match
    // because [data-catalog-results-region] wraps the product grid.
    if (FILTER_LINK_EXCLUDE.some((sel) => link.closest(sel) !== null)) return;

    // Only intercept links that live inside a recognized filter container.
    const isFilterLink = FILTER_LINK_ROOTS.some((sel) => link.closest(sel) !== null);
    if (!isFilterLink) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

    e.preventDefault();
    this.#closeContainingDialog(link)
      .catch(() => {
        // Ignore close animation/DOM race errors and continue navigation.
      })
      .finally(() => {
        this.#navigate(href, true);
      });
  }

  /** @param {PopStateEvent} e */
  #handlePopState(e) {
    const url =
      /** @type {{ catalogFilterUrl?: string } | null} */ (e.state)?.catalogFilterUrl ??
      (this.#pageMode ? this.#sourceUrl : location.href);

    this.#navigate(url, false);
  }

  /**
   * Fetch the section HTML for the given collection URL, swap regions, update history.
   * Falls back to a full page navigation if anything goes wrong.
   *
   * @param {string} url
   * @param {boolean} push  – whether to push a new history entry
   * @param {boolean} initial – whether this is the page-mode hydration request
   */
  async #navigate(url, push, initial = false) {
    if (this.#inflight) {
      this.#inflight.abort();
    }

    this.#inflight = new AbortController();
    this.#setLoading(true);

    try {
      const fetchUrl = this.#buildFetchUrl(url);

      const res = await fetch(fetchUrl, {
        signal: this.#inflight.signal,
        headers: { 'X-Requested-With': 'fetch' },
      });

      if (!res.ok) {
        throw new Error(`Catalog filter fetch: HTTP ${res.status}`);
      }

      let freshDoc;
      if (this.#pageMode) {
        const pageHtml = await res.text();
        freshDoc = new DOMParser().parseFromString(pageHtml, 'text/html');
      } else {
        const payload = /** @type {Record<string, string>} */ (await res.json());
        const sectionHtml = payload[this.#sectionId];

        if (typeof sectionHtml !== 'string') {
          throw new Error(`Section "${this.#sectionId}" not found in Sections API response`);
        }

        freshDoc = new DOMParser().parseFromString(sectionHtml, 'text/html');
      }

      this.#swapRegions(freshDoc);
      ensureDrawerFacetsOpen(this.#root);
      this.#restoreCatalogProductGridView();

      if (push) {
        // Page-mode filtering must not replace the campaign URL with a collection
        // URL. The state still records the real collection request for back/forward.
        history.pushState(
          { catalogFilterUrl: url },
          '',
          this.#pageMode ? location.href : url
        );
      }

      this.#announceCount();
      if (!initial) this.#maybeScrollGridIntoView();
    } catch (err) {
      // AbortError is expected when a newer request supersedes this one — ignore.
      if (/** @type {Error} */ (err).name === 'AbortError') return;

      // Any other error: fall back to a regular navigation so the user is never stuck.
      location.assign(url);
    } finally {
      this.#inflight = null;
      this.#setLoading(false);
    }
  }

  /**
   * Append `sections=<sectionId>` to the given URL's query string so that
   * Shopify returns only this section's HTML as JSON.
   *
   * @param {string} url
   * @returns {string}
   */
  #buildFetchUrl(url) {
    const u = new URL(url, location.origin);
    if (!this.#pageMode) {
      u.searchParams.set('sections', this.#sectionId);
    }
    return u.toString();
  }

  /**
   * Replace each swappable region in the live DOM with the matching element
   * from the freshly fetched section document.
   *
   * @param {Document} freshDoc
   */
  #swapRegions(freshDoc) {
    const freshRoot = this.#pageMode
      ? freshDoc.querySelector('[data-catalog-ajax]')
      : freshDoc;

    if (!freshRoot) {
      throw new Error('Catalog root not found in collection response');
    }

    for (const attr of SWAPPABLE_REGIONS) {
      const live = this.#root.querySelector(`[${attr}]`);
      const fresh = freshRoot.querySelector(`[${attr}]`);

      if (live && fresh) {
        live.replaceWith(fresh.cloneNode(true));
      }
    }
  }

  /**
   * After swapping results HTML, re-apply grid vs list preference from sessionStorage
   * (same keys as Horizon results-list / product grid).
   */
  #restoreCatalogProductGridView() {
    const resultsList = this.#root.querySelector(
      'results-list.custom-catalog__results-list[id^="custom-catalog-results-"]'
    );
    if (!resultsList) return;

    const grid = resultsList.querySelector('[ref="grid"]');
    if (!(grid instanceof HTMLElement)) return;

    const viewport = window.matchMedia('(min-width: 750px)').matches ? 'desktop' : 'mobile';
    const stored = sessionStorage.getItem(`product-grid-view-${viewport}`) || 'default';
    if (stored !== 'list' && stored !== 'default') return;

    grid.setAttribute('product-grid-view', stored);
    const radio = this.#root.querySelector(
      `input[type="radio"][name="catalog-grid-${this.#sectionId}"][value="${stored}"]`
    );
    if (radio instanceof HTMLInputElement) radio.checked = true;
  }

  /**
   * Toggle the loading attribute on the root element so CSS can dim the grid.
   * @param {boolean} on
   */
  #setLoading(on) {
    this.#root.toggleAttribute('data-catalog-loading', on);
  }

  /**
   * Update the aria-live region with the new item count so screen readers
   * announce the change after each filter swap.
   */
  #announceCount() {
    const liveRegion = this.#root.querySelector('[data-catalog-live-region]');
    if (!liveRegion) return;

    const countText =
      this.#root.querySelector('[data-catalog-item-count]')?.textContent?.trim() ?? '';

    // Clear first so the same text re-triggers an announcement if needed.
    liveRegion.textContent = '';

    requestAnimationFrame(() => {
      liveRegion.textContent = countText;
    });
  }

  /**
   * After a pagination click the grid may have scrolled far down; if the top
   * of the results region is above the viewport, scroll it back into view.
   */
  #maybeScrollGridIntoView() {
    const results = this.#root.querySelector('[data-catalog-results-region]');
    if (!results) return;

    const rect = results.getBoundingClientRect();
    if (rect.top < 0) {
      results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * Close a parent dialog (if any) before replacing DOM regions.
   * This avoids leaving mobile drawer scroll-lock styles behind when
   * a filter link is clicked from inside an open drawer.
   *
   * @param {Element} source
   * @returns {Promise<void>}
   */
  async #closeContainingDialog(source) {
    const dialog = source.closest('dialog[open]');
    if (!(dialog instanceof HTMLDialogElement)) return;

    const dialogComponent = dialog.closest('dialog-component');

    if (
      dialogComponent &&
      'closeDialog' in dialogComponent &&
      typeof dialogComponent.closeDialog === 'function'
    ) {
      await dialogComponent.closeDialog();
      return;
    }

    dialog.close();

    const topOffset = Number.parseInt(document.body.style.top || '0', 10);
    document.body.style.width = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.documentElement.removeAttribute('scroll-lock');

    if (Number.isFinite(topOffset) && topOffset !== 0) {
      window.scrollTo({ top: Math.abs(topOffset), behavior: 'instant' });
    }
  }
}

/**
 * Initialize AJAX filtering on every catalog root found on the page.
 */
function initCatalogFilterAjax() {
  const roots = document.querySelectorAll('[data-catalog-ajax][data-section-id]');

  for (const root of roots) {
    if (root instanceof HTMLElement) {
      new CatalogFilterAjax(root);
    }
  }
}

/** @type {boolean} */
let catalogFacetOutsideCloseBound = false;

/** @type {boolean} */
let catalogDrawerFacetsBound = false;

/**
 * Mobile filter drawer facet/sort accordions (toolbar dropdowns are separate).
 *
 * @param {Element} el
 * @returns {boolean}
 */
function isDrawerFacetDetails(el) {
  return el instanceof HTMLDetailsElement && el.classList.contains('custom-catalog__facet-dd--drawer');
}

/**
 * Ensure every mobile-drawer facet/sort accordion stays open.
 *
 * @param {ParentNode} [scope]
 */
function ensureDrawerFacetsOpen(scope = document) {
  scope.querySelectorAll('details.custom-catalog__facet-dd--drawer').forEach((el) => {
    if (el instanceof HTMLDetailsElement) {
      el.open = true;
    }
  });
}

/**
 * Open all drawer accordions when the filter drawer opens (default expanded state).
 */
function ensureCatalogDrawerFacetsDefaultOpen() {
  if (catalogDrawerFacetsBound) return;
  catalogDrawerFacetsBound = true;

  document.addEventListener('dialog:open', (e) => {
    const component = e.target;
    if (!(component instanceof Element)) return;

    const drawer = component.querySelector('.custom-catalog__mobile-filters-drawer');
    if (drawer) ensureDrawerFacetsOpen(drawer);
  });
}

/**
 * Close catalog facet/sort <details> dropdowns when clicking outside or pressing Escape.
 * One document listener so behavior survives Section Rendering API swaps without rebinding.
 */
function ensureCatalogFacetOutsideClose() {
  if (catalogFacetOutsideCloseBound) return;
  catalogFacetOutsideCloseBound = true;

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Node)) return;

    document.querySelectorAll('details.custom-catalog__facet-dd[open]').forEach((el) => {
      if (!isDrawerFacetDetails(el) && !el.contains(target)) {
        el.open = false;
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;

    document.querySelectorAll('details.custom-catalog__facet-dd[open]').forEach((el) => {
      if (!isDrawerFacetDetails(el)) {
        el.open = false;
      }
    });
  });
}

ensureCatalogDrawerFacetsDefaultOpen();
ensureCatalogFacetOutsideClose();

document.addEventListener('DOMContentLoaded', initCatalogFilterAjax);

// Reinitialize when the Shopify theme editor reloads a section.
document.addEventListener('shopify:section:load', (e) => {
  const target = /** @type {CustomEvent & { target: Element | null }} */ (e).target;
  const root = target?.querySelector('[data-catalog-ajax][data-section-id]');

  if (root instanceof HTMLElement) {
    new CatalogFilterAjax(root);
  }
});
