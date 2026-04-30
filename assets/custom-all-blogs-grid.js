/**
 * Custom all blogs grid:
 * - Hub "All" tab: prefetch article cards from each blog URL, merge, sort by date, paginate in-memory (no full reload).
 * - Hub blog tabs: Ajax swap grid + pager from /blogs/{handle}?page=n (targets [data-cabg-blog-listing] in response).
 * - Standalone blog archives: keep native navigation/pagination so each blog page has a real URL.
 */
(function () {
  /** @param {string} html */
  const parseHtml = (html) => new DOMParser().parseFromString(html, 'text/html');

  /**
   * @param {Document | HTMLElement} doc
   * @returns {{ listing: HTMLElement | null, grid: HTMLElement | null, pagerSlot: HTMLElement | null }}
   */
  const resolveCabgListingParts = (doc) => {
    /** @type {HTMLElement | null} */
    let listing =
      doc instanceof HTMLElement && (doc.matches('[data-cabg-blog-listing]') || doc.matches('.custom-all-blogs-grid--listing'))
        ? doc
        : null;
    listing =
      listing ??
      doc.querySelector('[data-cabg-blog-listing]') ??
      doc.querySelector('.custom-all-blogs-grid--listing') ??
      /** @type {HTMLElement | null} */ (
        doc.documentElement?.matches?.('[data-cabg-blog-listing]') ? doc.documentElement : null
      );
    if (!listing || !(listing instanceof HTMLElement)) {
      return { listing: null, grid: null, pagerSlot: null };
    }
    const grid = listing.querySelector('.custom-all-blogs-grid__grid');
    const pagerSlot =
      listing.querySelector('[data-cabg-pager-slot]') ??
      listing.querySelector('[data-cabg-all-pager-slot]');
    return {
      listing,
      grid: grid instanceof HTMLElement ? grid : null,
      pagerSlot: pagerSlot instanceof HTMLElement ? pagerSlot : null,
    };
  };

  /**
   * @param {string} html
   * @returns {{ grid: HTMLElement | null, pagerInnerHtml: string }}
   */
  const extractListingFromFetchedHtml = (html) => {
    const doc = parseHtml(html);
    const { listing, grid, pagerSlot } = resolveCabgListingParts(doc);
    let pagerInnerHtml = '';
    if (pagerSlot) {
      pagerInnerHtml = pagerSlot.innerHTML;
    } else if (listing) {
      const fallback = listing.querySelector('.custom-all-blogs-grid__pagination');
      if (fallback) pagerInnerHtml = fallback.outerHTML;
    }
    return { grid: grid, pagerInnerHtml };
  };

  /** @param {HTMLElement} gridHost @param {HTMLElement | null} pagerSlot @param {HTMLElement | null} nextGrid @param {string} pagerInnerHtml */
  const swapGridAndPagerHtml = (gridHost, pagerSlot, nextGrid, pagerInnerHtml) => {
    if (!nextGrid || nextGrid.children.length === 0) return false;
    gridHost.innerHTML = nextGrid.innerHTML;
    if (pagerSlot) {
      if (pagerInnerHtml) pagerSlot.innerHTML = pagerInnerHtml;
      else pagerSlot.innerHTML = '';
      pagerSlot.hidden = pagerSlot.innerHTML.trim().length === 0;
    }
    const firstFocusable = gridHost.querySelector('a[href], button:not([disabled])');
    if (firstFocusable instanceof HTMLElement) firstFocusable.focus({ preventScroll: true });
    return true;
  };

  /**
   * Clicks on text inside an <a> use a Text node as event.target (not Element), so
   * closest('a') would never run and default navigation would fire.
   * @param {Event} event
   * @returns {HTMLAnchorElement | null}
   */
  const resolveEventAnchor = (event) => {
    let el = event.target;
    if (el instanceof Node && el.nodeType === Node.TEXT_NODE) {
      el = el.parentElement;
    }
    if (!(el instanceof Element)) return null;
    const a = el.closest('a[href]');
    return a instanceof HTMLAnchorElement ? a : null;
  };

  /** @param {HTMLElement} trigger @param {string} url */
  const fetchCabgHtml = async (trigger, url) => {
    trigger?.setAttribute?.('aria-busy', 'true');
    try {
      const response = await fetch(url, {
        credentials: 'same-origin',
        headers: {
          Accept: 'text/html',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      if (!response.ok) throw new Error(String(response.status));
      return await response.text();
    } finally {
      trigger?.removeAttribute?.('aria-busy');
    }
  };

  /** @param {HTMLElement} pane @param {HTMLAnchorElement | null} trigger @param {string} url */
  const fetchAndSwapHubPane = async (pane, trigger, url) => {
    const gridHost = pane.querySelector('.custom-all-blogs-grid__grid');
    let pagerSlot = pane.querySelector('[data-cabg-pager-slot]');
    if (!pagerSlot) pagerSlot = pane.closest('.cabg-remote-pane')?.querySelector('[data-cabg-pager-slot]');
    if (!gridHost) return;

    pane.setAttribute('aria-busy', 'true');
    try {
      const html = await fetchCabgHtml(trigger, url);
      const { grid: nextGrid, pagerInnerHtml } = extractListingFromFetchedHtml(html);
      if (!swapGridAndPagerHtml(gridHost, pagerSlot instanceof HTMLElement ? pagerSlot : null, nextGrid, pagerInnerHtml)) {
        window.location.assign(url);
      }
    } catch {
      window.location.assign(url);
    } finally {
      pane.removeAttribute('aria-busy');
    }
  };

  /** ---------- Hub remote tab panes ---------- */
  const initHubBlogTabAjax = () => {
    const roots = document.querySelectorAll('custom-blog-tabs.custom-all-blogs-grid[data-cabg-hub]');
    for (const root of roots) {
      if (/** @type {HTMLElement} */ (root).dataset.designMode === 'true') continue;

      root.addEventListener(
        'click',
        (event) => {
          const anchor = resolveEventAnchor(event);
          if (!anchor) return;
          if (anchor.closest('[data-cabg-all-pagination]')) return;

          const pane = anchor.closest('[data-cabg-remote-pane]');
          if (!pane || !root.contains(pane)) return;

          const href = anchor.getAttribute('href');
          if (!href || !href.includes('page=') || anchor.getAttribute('target') === '_blank') return;
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

          event.preventDefault();
          event.stopPropagation();

          const absoluteUrl = new URL(href, window.location.href).href;
          fetchAndSwapHubPane(pane, anchor, absoluteUrl);
        },
        true
      );
    }
  };

  /** ---------- Merged "All" tab (hub) ---------- */
  /**
   * @param {number} ts
   * @param {HTMLElement} el
   */
  const normalizeCardTs = (ts, el) => {
    if (Number.isFinite(ts) && ts > 0) return ts;
    const raw = el.getAttribute('data-cabg-published-at');
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  /** @returns {HTMLElement[]} cloned article nodes sorted desc */
  const collectCardsSorted = (parsedDoc, fetchChunkSize) => {
    const cards = [];
    const { listing, grid } = resolveCabgListingParts(parsedDoc);
    const host = grid || listing;
    if (!host) return cards;
    const nodes = host.querySelectorAll('article.custom-blog-card[data-cabg-published-at]');
    nodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const ts = normalizeCardTs(0, node);
      const clone = /** @type {HTMLElement} */ (/** @type {HTMLElement} */ (node).cloneNode(true));
      clone.dataset.cabgTs = String(ts);
      cards.push({ ts, el: clone });
    });
    if (cards.length === 0 && fetchChunkSize > 0) {
      const legacy = host.querySelectorAll('article.custom-blog-card');
      legacy.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const ts = normalizeCardTs(0, node);
        const clone = /** @type {HTMLElement} */ (node.cloneNode(true));
        clone.dataset.cabgTs = String(ts);
        cards.push({ ts, el: clone });
      });
    }
    cards.sort((a, b) => b.ts - a.ts);
    return cards.map((c) => c.el);
  };

  /**
   * @param {string} baseUrl
   * @param {number} articlesCount
   * @param {number} fetchChunk
   */
  const fetchAllPagesForBlog = async (baseUrl, articlesCount, fetchChunk) => {
    const chunk = Math.max(1, Math.min(50, fetchChunk));
    const totalPages = Math.max(1, Math.ceil((articlesCount || 0) / chunk));
    const merged = [];
    for (let p = 1; p <= totalPages; p++) {
      const u = new URL(baseUrl, window.location.origin);
      if (p > 1) u.searchParams.set('page', String(p));
      const response = await fetch(u.toString(), {
        credentials: 'same-origin',
        headers: {
          Accept: 'text/html',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      if (!response.ok) throw new Error(String(response.status));
      const html = await response.text();
      const doc = parseHtml(html);
      const batch = collectCardsSorted(doc, chunk);
      if (batch.length === 0) break;
      merged.push(...batch);
    }
    return merged;
  };

  /**
   * @param {number} totalPages
   * @param {number} currentPage
   * @param {string} navLabel
   */
  const buildAllTabPaginationMarkup = (totalPages, currentPage, navLabelRaw) => {
    if (totalPages <= 1) return '';
    const navLabel = navLabelRaw
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
    const prevDisabled = currentPage <= 1;
    const nextDisabled = currentPage >= totalPages;
    const parts = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === currentPage) {
        parts.push(
          `<li class="pagination__item"><span class="pagination__link pagination__link--page pagination__link--current" aria-current="page">${i}</span></li>`,
        );
      } else {
        parts.push(
          `<li class="pagination__item"><button type="button" class="pagination__link pagination__link--page" data-cabg-all-page="${i}" aria-label="Page ${i}">${i}</button></li>`,
        );
      }
    }
    return `
<nav class="pagination" aria-label="${navLabel}" data-cabg-all-pagination>
  <ul class="pagination__list" role="list">
    <li class="pagination__item">
      ${
        prevDisabled
          ? `<span class="pagination__link pagination__link--arrow pagination__link--disabled" aria-disabled="true" aria-hidden="true">‹</span>`
          : `<button type="button" class="pagination__link pagination__link--arrow" data-cabg-all-page="${currentPage - 1}" aria-label="Previous page">‹</button>`
      }
    </li>
    ${parts.join('')}
    <li class="pagination__item">
      ${
        nextDisabled
          ? `<span class="pagination__link pagination__link--arrow pagination__link--disabled" aria-disabled="true" aria-hidden="true">›</span>`
          : `<button type="button" class="pagination__link pagination__link--arrow" data-cabg-all-page="${currentPage + 1}" aria-label="Next page">›</button>`
      }
    </li>
  </ul>
</nav>
`;
  };

  const initHubMergedAllTab = async () => {
    const hubs = document.querySelectorAll('custom-blog-tabs[data-cabg-hub][data-cabg-per-page]');
    const navFallback = document.querySelector('meta[property="og:site_name"]')?.content || 'Pagination';

    for (const hub of hubs) {
      const root = /** @type {HTMLElement} */ (hub);

      /** @type {HTMLElement | null} */
      const mount = root.querySelector('[data-cabg-all-mount]');
      /** @type {HTMLElement | null} */
      const gridSlot = /** @type {HTMLElement | null} */ (root.querySelector('[data-cabg-all-grid]'));
      /** @type {HTMLElement | null} */
      const pagerSlot = /** @type {HTMLElement | null} */ (root.querySelector('[data-cabg-all-pager-slot]'));
      const loading = root.querySelector('[data-cabg-all-loading]');
      const status = root.querySelector('[data-cabg-all-status]');

      if (!mount || !gridSlot || !pagerSlot) continue;
      if (root.dataset.designMode === 'true') continue;

      const perPage = Number.parseInt(String(root.dataset.cabgPerPage || '12'), 10) || 12;
      const fetchChunk = Number.parseInt(String(root.dataset.cabgFetchChunk || '12'), 10) || 12;

      const metas = root.querySelectorAll('[data-cabg-blog-meta]');
      if (metas.length === 0) continue;

      try {
        const allClones = [];
        for (const meta of metas) {
          if (!(meta instanceof HTMLElement)) continue;
          const baseUrl = meta.dataset.baseUrl;
          const count = Number.parseInt(String(meta.dataset.articlesCount || '0'), 10) || 0;
          if (!baseUrl) continue;
          const batch = await fetchAllPagesForBlog(baseUrl, count, fetchChunk);
          allClones.push(...batch);
        }

        const seen = new Set();
        const deduped = [];
        for (const el of allClones) {
          const key =
            el.querySelector('a.custom-blog-card__title-row, a.custom-blog-card__image-link')?.getAttribute('href') ||
            el.textContent?.slice(0, 80);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          deduped.push(el);
        }

        deduped.sort((a, b) => {
          const ta = Number.parseInt(a.dataset.cabgTs || '0', 10) || 0;
          const tb = Number.parseInt(b.dataset.cabgTs || '0', 10) || 0;
          return tb - ta;
        });

        const renderPage = (page) => {
          const total = deduped.length;
          const totalPages = Math.max(1, Math.ceil(total / perPage));
          const cp = Math.min(Math.max(1, page), totalPages);
          const start = (cp - 1) * perPage;
          const slice = deduped.slice(start, start + perPage);
          gridSlot.replaceChildren(...slice);
          gridSlot.hidden = slice.length === 0;
          pagerSlot.innerHTML = buildAllTabPaginationMarkup(totalPages, cp, navFallback);
          pagerSlot.hidden = totalPages <= 1;
          if (status instanceof HTMLElement) {
            status.hidden = total === 0;
            status.textContent = `${total} article${total === 1 ? '' : 's'} across blogs.`;
          }
          mount.dataset.cabgCurrentPageAll = String(cp);
          mount.dataset.cabgTotalPagesAll = String(totalPages);
        };

        pagerSlot.addEventListener('click', (e) => {
          const btn =
            e.target instanceof Element ? e.target.closest('button[data-cabg-all-page]') : null;
          if (!(btn instanceof HTMLButtonElement) || !pagerSlot.contains(btn)) return;
          const p = Number.parseInt(btn.dataset.cabgAllPage || '1', 10);
          if (!Number.isFinite(p)) return;
          e.preventDefault();
          renderPage(p);
          const fc = gridSlot.querySelector('a[href], button:not([disabled])');
          if (fc instanceof HTMLElement) fc.focus({ preventScroll: true });
        });

        renderPage(1);

        if (loading instanceof HTMLElement) loading.hidden = true;
        mount.setAttribute('aria-busy', 'false');
        mount.removeAttribute('data-cabg-all-busy');
      } catch (err) {
        if (loading instanceof HTMLElement) {
          loading.textContent =
            'Could not load the combined archive. Please try again or refresh the page.';
        }
        mount.setAttribute('aria-busy', 'false');
        console.warn('[cabg]', err);
      }
    }
  };

  /** ---------- Blog listing SPA (real /blogs URLs with cache + loader) ---------- */
  const cabgListingCache = new Map();
  const CABG_LISTING_MAX_CACHE = 12;
  let cabgListingNavigating = false;

  const normalizeCabgUrl = (href) => {
    try {
      const u = new URL(href, window.location.href);
      u.hash = '';
      return u.href;
    } catch {
      return href;
    }
  };

  /** @returns {HTMLElement | null} */
  const getListingRoot = () => {
    const el = document.querySelector('[data-cabg-blog-listing]');
    return el instanceof HTMLElement ? el : null;
  };

  /**
   * @param {Document} doc
   * @returns {{ root: HTMLElement | null, title: string }}
   */
  const extractListingPagePayload = (doc) => {
    const root = doc.querySelector('[data-cabg-blog-listing]');
    const title = doc.querySelector('title')?.textContent?.trim() || document.title;
    return {
      root: root instanceof HTMLElement ? root : null,
      title,
    };
  };

  const updateListingCacheSize = () => {
    while (cabgListingCache.size > CABG_LISTING_MAX_CACHE) {
      const first = cabgListingCache.keys().next().value;
      cabgListingCache.delete(first);
    }
  };

  const cacheCurrentListingSnapshot = () => {
    const root = getListingRoot();
    if (!root) return;
    const key = normalizeCabgUrl(window.location.href);
    cabgListingCache.set(key, {
      rootOuter: root.outerHTML,
      title: document.title,
    });
    updateListingCacheSize();
  };

  /**
   * @param {HTMLElement | null} root
   * @param {boolean} isVisible
   */
  const setListingLoaderVisibility = (root, isVisible) => {
    const loader = root?.querySelector('[data-cabg-listing-loader]');
    if (!(loader instanceof HTMLElement)) return;
    if (isVisible) {
      loader.removeAttribute('hidden');
      loader.setAttribute('aria-hidden', 'false');
      root.setAttribute('aria-busy', 'true');
    } else {
      loader.setAttribute('hidden', '');
      loader.setAttribute('aria-hidden', 'true');
      root.removeAttribute('aria-busy');
    }
  };

  /**
   * @param {HTMLElement | null} root
   */
  const focusListingHeading = (root) => {
    const heading = root?.querySelector('.custom-all-blogs-grid__heading');
    if (!(heading instanceof HTMLElement)) return;
    if (!heading.hasAttribute('tabindex')) {
      heading.setAttribute('tabindex', '-1');
    }
    heading.focus({ preventScroll: true });
  };

  /**
   * @param {string} url
   * @returns {boolean}
   */
  const isListingSpaCandidate = (url) => {
    try {
      const u = new URL(url, window.location.href);
      if (u.origin !== window.location.origin) return false;
      return u.pathname.startsWith('/blogs/');
    } catch {
      return false;
    }
  };

  /**
   * @param {string} url
   * @returns {Promise<{rootOuter: string, title: string} | null>}
   */
  const fetchListingSnapshot = async (url) => {
    const key = normalizeCabgUrl(url);
    const cached = cabgListingCache.get(key);
    if (cached) return cached;

    const response = await fetch(key, {
      credentials: 'same-origin',
      headers: {
        Accept: 'text/html',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (!response.ok) throw new Error(String(response.status));
    const html = await response.text();
    const doc = parseHtml(html);
    const payload = extractListingPagePayload(doc);
    if (!payload.root) return null;

    const snapshot = {
      rootOuter: payload.root.outerHTML,
      title: payload.title,
    };
    cabgListingCache.set(key, snapshot);
    updateListingCacheSize();
    return snapshot;
  };

  /**
   * @param {{rootOuter: string, title: string}} snapshot
   * @returns {HTMLElement | null}
   */
  const replaceListingRoot = (snapshot) => {
    const current = getListingRoot();
    if (!current) return null;
    const shell = document.createElement('div');
    shell.innerHTML = snapshot.rootOuter;
    const next = shell.firstElementChild;
    if (!(next instanceof HTMLElement)) return null;
    current.replaceWith(next);
    document.title = snapshot.title;
    return next;
  };

  const queueListingPrefetch = (url) => {
    const key = normalizeCabgUrl(url);
    if (!isListingSpaCandidate(key) || cabgListingCache.has(key)) return;
    void fetchListingSnapshot(key).catch(() => {});
  };

  const prefetchListingTabs = () => {
    const root = getListingRoot();
    if (!root || root.dataset.designMode === 'true') return;
    const links = Array.from(root.querySelectorAll('.custom-all-blogs-grid__tab-link[href]'));
    const run = () => {
      links.forEach((link) => {
        if (!(link instanceof HTMLAnchorElement)) return;
        if (link.getAttribute('aria-current') === 'page') return;
        queueListingPrefetch(link.href);
      });
    };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 1200 });
    } else {
      window.setTimeout(run, 250);
    }
  };

  /**
   * @param {string} url
   * @param {{ replace?: boolean, scrollToTop?: boolean }} [opts]
   */
  const navigateListingSpa = async (url, opts = {}) => {
    const key = normalizeCabgUrl(url);
    const current = getListingRoot();
    if (!current || cabgListingNavigating) {
      window.location.assign(key);
      return;
    }

    cabgListingNavigating = true;
    cacheCurrentListingSnapshot();
    setListingLoaderVisibility(current, true);

    try {
      const snapshot = await fetchListingSnapshot(key);
      if (!snapshot) {
        window.location.assign(key);
        return;
      }

      const nextRoot = replaceListingRoot(snapshot);
      if (!nextRoot) {
        window.location.assign(key);
        return;
      }

      if (opts.replace) {
        history.replaceState({ cabgListingSpa: true, u: key }, document.title, key);
      } else {
        history.pushState({ cabgListingSpa: true, u: key }, document.title, key);
      }

      requestAnimationFrame(() => {
        focusListingHeading(nextRoot);
      });
      prefetchListingTabs();
    } catch {
      window.location.assign(key);
    } finally {
      const activeRoot = getListingRoot();
      setListingLoaderVisibility(activeRoot, false);
      cabgListingNavigating = false;
    }
  };

  const initListingBlogSpa = () => {
    const root = getListingRoot();
    if (!root || root.dataset.designMode === 'true') return;

    cacheCurrentListingSnapshot();
    history.replaceState({ cabgListingSpa: true, u: normalizeCabgUrl(window.location.href) }, document.title, window.location.href);
    prefetchListingTabs();

    document.addEventListener(
      'mouseover',
      (event) => {
        const anchor = resolveEventAnchor(event);
        if (!(anchor instanceof HTMLAnchorElement)) return;
        if (!anchor.closest('[data-cabg-blog-listing]')) return;
        if (
          !anchor.matches('.custom-all-blogs-grid__tab-link') &&
          !anchor.closest('.custom-all-blogs-grid__pagination')
        ) {
          return;
        }
        queueListingPrefetch(anchor.href);
      },
      { passive: true }
    );

    document.addEventListener(
      'focusin',
      (event) => {
        const anchor = resolveEventAnchor(event);
        if (!(anchor instanceof HTMLAnchorElement)) return;
        if (!anchor.closest('[data-cabg-blog-listing]')) return;
        if (!anchor.matches('.custom-all-blogs-grid__tab-link')) return;
        queueListingPrefetch(anchor.href);
      }
    );

    document.addEventListener(
      'click',
      (event) => {
        const anchor = resolveEventAnchor(event);
        if (!(anchor instanceof HTMLAnchorElement)) return;
        const listing = anchor.closest('[data-cabg-blog-listing]');
        if (!listing || !(listing instanceof HTMLElement)) return;
        if (listing.dataset.designMode === 'true') return;
        if (event.defaultPrevented) return;
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

        const isTabLink = anchor.matches('.custom-all-blogs-grid__tab-link');
        const isPagerLink = !!anchor.closest('.custom-all-blogs-grid__pagination');
        if (!isTabLink && !isPagerLink) return;
        if (!isListingSpaCandidate(anchor.href)) return;

        const targetUrl = normalizeCabgUrl(anchor.href);
        if (isTabLink && anchor.getAttribute('aria-current') === 'page') {
          event.preventDefault();
          return;
        }
        if (targetUrl === normalizeCabgUrl(window.location.href)) {
          event.preventDefault();
          return;
        }

        event.preventDefault();
        void navigateListingSpa(targetUrl, { replace: false, scrollToTop: false });
      },
      true
    );

    window.addEventListener('popstate', (event) => {
      if (cabgListingNavigating) return;
      if (!event.state || !event.state.cabgListingSpa) return;

      const key = normalizeCabgUrl(window.location.href);
      const cached = cabgListingCache.get(key);
      if (!cached) {
        window.location.reload();
        return;
      }

      cabgListingNavigating = true;
      try {
        const nextRoot = replaceListingRoot(cached);
        if (!nextRoot) {
          window.location.reload();
          return;
        }
        requestAnimationFrame(() => {
          focusListingHeading(nextRoot);
        });
        prefetchListingTabs();
      } finally {
        const activeRoot = getListingRoot();
        setListingLoaderVisibility(activeRoot, false);
        cabgListingNavigating = false;
      }
    });
  };

  const boot = () => {
    initHubBlogTabAjax();
    initListingBlogSpa();
    void initHubMergedAllTab();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
