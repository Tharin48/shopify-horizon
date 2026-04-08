// @ts-nocheck
/**
 * Custom header: scroll states + mobile drawer (left) / search panel (right).
 * Idempotent init for Shopify section reloads.
 */
(function () {
  'use strict';

  var SCROLL_EPS = 2;
  /**
   * Require this many pixels of *sustained* scroll movement before changing state.
   * This is the primary anti-flicker mechanism: slow/jittery scroll (1–5px per event)
   * near the threshold no longer causes rapid state oscillation.
   */
  var HIDE_REQUIRE_PX = 40;
  var SHOW_REQUIRE_PX = 20;
  var LOCK_RELEASE_GRACE_MS = 220;
  var lastLockedScrollTop = 0;
  var lastLockSeenAt = 0;
  /**
   * Once in minimized/hidden state, do NOT revert to full just because scrollTop dipped
   * slightly below scroll_threshold. Only revert when scrollTop is this many px below the
   * threshold — or at the true page top (handled by SCROLL_EPS check).
   *
   * This eliminates the most common flicker pattern: slow scroll near the threshold boundary
   * causes scrollTop to oscillate ±2px across the threshold → rapid solid↔hidden state flips
   * → 0.35s opacity transitions fire repeatedly → ghost header visible mid-page.
   *
   * Value 100: large enough to cover typical micro-oscillations and touch inertia.
   * If scroll_threshold < 100 the header simply stays minimized until scrollTop ≈ 0.
   */
  var THRESHOLD_BACK_PX = 100;
  var MOBILE_MQ = '(max-width: 749px)';

  function getScrollTop() {
    /*
     * When dialog drawers open, DialogComponent locks the page by setting:
     * body { position: fixed; top: -<scrollY>px; }
     * In that state, scrollingElement.scrollTop often reports 0 even though
     * the user is visually mid-page. Read body.style.top first to preserve
     * the real scroll position for header state logic.
     */
    var body = document.body;
    if (body && body.style && body.style.position === 'fixed' && body.style.top) {
      var lockedTop = parseFloat(body.style.top);
      if (!isNaN(lockedTop)) {
        lastLockedScrollTop = Math.abs(lockedTop);
        lastLockSeenAt = Date.now();
        return lastLockedScrollTop;
      }
    }

    var se = document.scrollingElement;
    var liveScrollTop = se ? se.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0);

    /*
     * Immediately after unlocking a fixed-body dialog, some browsers can report
     * transient scrollTop=0 for a frame before restoring the real position.
     * Reuse the last locked value for a brief grace window to avoid false
     * "at top" detection (which would switch header to transparent).
     */
    if (
      liveScrollTop <= SCROLL_EPS &&
      lastLockedScrollTop > SCROLL_EPS &&
      Date.now() - lastLockSeenAt < LOCK_RELEASE_GRACE_MS
    ) {
      return lastLockedScrollTop;
    }

    return liveScrollTop;
  }

  function topState(root) {
    var mayTransparent = root.dataset.mayTransparent === 'true';
    var isHome = root.dataset.isHomepage === 'true';
    return mayTransparent && isHome ? 'transparent' : 'solid';
  }

  function isPastThreshold(root, scrollTop) {
    var raw = parseInt(root.dataset.scrollThreshold, 10) || 0;
    var doc = document.documentElement;
    var maxScrollY = Math.max(0, doc.scrollHeight - doc.clientHeight);
    if (maxScrollY > 0 && maxScrollY < raw) {
      return scrollTop >= maxScrollY;
    }
    return scrollTop > raw;
  }

  function updateAnnouncementBarHeight() {
    var hg = document.querySelector('#header-group');
    var h = 0;
    if (hg) {
      var annSection = hg.querySelector('.shopify-section:has(.announcement-bar)');
      if (!annSection) {
        var bar = hg.querySelector('.announcement-bar');
        annSection = bar && bar.closest('.shopify-section');
      }
      if (annSection) {
        h = Math.round(annSection.getBoundingClientRect().height);
      }
    }
    document.documentElement.style.setProperty('--announcement-bar-height', h + 'px');
  }

  function updateHeaderGroupHeight(root) {
    var hg = document.querySelector('#header-group');
    if (!hg) {
      return;
    }
    var total = 0;
    var i;
    for (i = 0; i < hg.children.length; i++) {
      var section = hg.children[i];
      var customRoot = section.querySelector('[data-custom-header]');
      if (customRoot && customRoot === root) {
        var state = root.dataset.headerState;
        if (state === 'transparent' || state === 'solid') {
          /*
           * For full-height states, read the *target* height from the CSS
           * variable rather than measuring the DOM. This guards against any
           * future transition on a height-related property causing
           * getBoundingClientRect() to capture a mid-animation value and
           * writing the wrong --header-group-height (which would make the
           * hero section appear shorter after a scroll cycle).
           */
          var cs = getComputedStyle(root);
          var cssH = parseFloat(cs.getPropertyValue('--custom-header-default-height').trim());
          total += isNaN(cssH) ? Math.round(root.getBoundingClientRect().height) : cssH;
        } else {
          total += Math.round(root.getBoundingClientRect().height);
        }
      } else {
        total += section.offsetHeight;
      }
    }
    document.body.style.setProperty('--header-group-height', total + 'px');
  }

  function updateBodyHeaderHeight(root) {
    var h = Math.round(root.getBoundingClientRect().height);
    document.body.style.setProperty('--header-height', h + 'px');
    updateHeaderGroupHeight(root);
  }

  function applyHeaderState(root, state) {
    if (root.dataset.headerState === state) {
      return; /* no change — skip the expensive getBoundingClientRect call */
    }
    root.dataset.headerState = state;
    updateBodyHeaderHeight(root);
  }

  function getFocusable(el) {
    if (!el) {
      return [];
    }
    return Array.from(
      el.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(function (node) {
      return node.offsetParent !== null || node === document.activeElement;
    });
  }

  function setScrollLock(on) {
    document.documentElement.classList.toggle('custom-header-scroll-lock', on);
    document.documentElement.classList.toggle('is-locked', on);
  }

  function initCustomHeader(root) {
    if (!root || root.dataset.customHeaderJs === 'initialized') {
      return;
    }

    var mediaMobile = window.matchMedia(MOBILE_MQ);
    var sectionEl = root.closest('.shopify-section');
    var portalRoot = sectionEl ? sectionEl.querySelector('[data-custom-header-portals]') : null;
    var toggle = root.querySelector('[data-custom-header-menu-toggle]');
    var overlay = portalRoot ? portalRoot.querySelector('[data-custom-header-overlay]') : null;
    var drawer = portalRoot ? portalRoot.querySelector('[data-custom-header-mobile-drawer]') : null;
    var searchPanel = portalRoot ? portalRoot.querySelector('[data-custom-header-mobile-search-panel]') : null;
    var searchTrigger = root.querySelector('[data-custom-header-mobile-search-trigger]');
    var searchInput = portalRoot ? portalRoot.querySelector('[data-custom-header-mobile-search-input]') : null;
    var drawerClose = portalRoot ? portalRoot.querySelector('[data-custom-header-drawer-close]') : null;
    var searchClose = portalRoot ? portalRoot.querySelector('[data-custom-header-search-close]') : null;

    var prevScrollTop = getScrollTop();
    /** Running total of scroll movement in one direction. Resets on direction reversal.
     * Positive = downward scroll accumulated, negative = upward. */
    var scrollAccum = 0;
    var lastMenuFocus = null;
    var lastSearchFocus = null;

    function isMobile() {
      return mediaMobile.matches;
    }

    function setMobileNavOpen(open) {
      root.dataset.mobileNavOpen = open ? 'true' : 'false';
      if (toggle) {
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      if (drawer) {
        drawer.classList.toggle('is-open', open);
        drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
        try {
          drawer.inert = !open;
        } catch (e) {
          /* inert unsupported */
        }
      }
      updateOverlay();
      updateScrollLock();
      if (open && drawer) {
        lastMenuFocus = document.activeElement;
        requestAnimationFrame(function () {
          var f = getFocusable(drawer);
          if (f[0]) {
            f[0].focus();
          }
        });
      } else if (!open && lastMenuFocus && typeof lastMenuFocus.focus === 'function') {
        lastMenuFocus.focus();
        lastMenuFocus = null;
      }
    }

    function setMobileSearchOpen(open) {
      root.dataset.mobileSearchOpen = open ? 'true' : 'false';
      if (searchTrigger) {
        searchTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      if (searchPanel) {
        searchPanel.classList.toggle('is-open', open);
        searchPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
        try {
          searchPanel.inert = !open;
        } catch (e) {
          /* inert unsupported */
        }
      }
      updateOverlay();
      updateScrollLock();
      if (open && searchPanel) {
        lastSearchFocus = document.activeElement;
        requestAnimationFrame(function () {
          if (searchInput) {
            searchInput.focus();
          } else {
            var f = getFocusable(searchPanel);
            if (f[0]) {
              f[0].focus();
            }
          }
        });
      } else if (!open && lastSearchFocus && typeof lastSearchFocus.focus === 'function') {
        lastSearchFocus.focus();
        lastSearchFocus = null;
      }
    }

    function updateOverlay() {
      var navOpen = root.dataset.mobileNavOpen === 'true';
      var searchOpen = root.dataset.mobileSearchOpen === 'true';
      var show = isMobile() && (navOpen || searchOpen);
      if (overlay) {
        overlay.classList.toggle('is-open', show);
        overlay.setAttribute('aria-hidden', show ? 'false' : 'true');
      }
    }

    function updateScrollLock() {
      var navOpen = root.dataset.mobileNavOpen === 'true';
      var searchOpen = root.dataset.mobileSearchOpen === 'true';
      setScrollLock(isMobile() && (navOpen || searchOpen));
    }

    function closeAllMobilePanels() {
      setMobileNavOpen(false);
      setMobileSearchOpen(false);
    }

    function onToggleClick() {
      if (!isMobile()) {
        return;
      }
      var isOpen = root.dataset.mobileNavOpen === 'true';
      if (!isOpen && root.dataset.mobileSearchOpen === 'true') {
        setMobileSearchOpen(false);
      }
      setMobileNavOpen(!isOpen);
    }

    function onSearchTriggerClick() {
      if (!isMobile()) {
        return;
      }
      var isOpen = root.dataset.mobileSearchOpen === 'true';
      if (!isOpen && root.dataset.mobileNavOpen === 'true') {
        setMobileNavOpen(false);
      }
      setMobileSearchOpen(!isOpen);
    }

    function onOverlayClick() {
      if (!isMobile()) {
        return;
      }
      closeAllMobilePanels();
    }

    if (drawer) {
      try {
        drawer.inert = true;
      } catch (e) {
        /* inert unsupported */
      }
    }
    if (searchPanel) {
      try {
        searchPanel.inert = true;
      } catch (e) {
        /* inert unsupported */
      }
    }

    if (toggle) {
      toggle.addEventListener('click', onToggleClick);
    }
    if (searchTrigger) {
      searchTrigger.addEventListener('click', onSearchTriggerClick);
    }
    if (overlay) {
      overlay.addEventListener('click', onOverlayClick);
    }

    var onDrawerCloseClick = function () {
      setMobileNavOpen(false);
    };
    var onSearchCloseClick = function () {
      setMobileSearchOpen(false);
    };
    if (drawerClose) {
      drawerClose.addEventListener('click', onDrawerCloseClick);
    }
    if (searchClose) {
      searchClose.addEventListener('click', onSearchCloseClick);
    }

    var layoutRaf = null;
    var onScrollFrame = function () {
      var scrollTop = getScrollTop();
      var delta = scrollTop - prevScrollTop;
      prevScrollTop = scrollTop;

      /*
       * While a modal/drawer with [scroll-lock] is open, freeze header state.
       * DialogComponent locks body positioning, which can create transient
       * scroll readings during open/close animations.
       */
      if (document.documentElement.hasAttribute('scroll-lock')) {
        scrollAccum = 0;
        return;
      }

      var full = topState(root);
      var curState = root.dataset.headerState || full;

      /* ── Case 1: At true page top → always restore full header ──────────────────────── */
      if (scrollTop <= SCROLL_EPS) {
        scrollAccum = 0;
        if (curState !== full) {
          applyHeaderState(root, full);
        }
        return;
      }

      /*
       * Invariant: transparent is allowed only at true top.
       * If we're below top for any reason (reload restore, drawer close, etc.),
       * immediately demote transparent to minimized before normal threshold logic.
       */
      if (full === 'transparent' && curState === 'transparent') {
        applyHeaderState(root, 'minimized');
        curState = 'minimized';
      }

      /* ── Case 2: Below the scroll_threshold zone ──────────────────────────────────── */
      if (!isPastThreshold(root, scrollTop)) {
        if (curState === full) {
          /*
           * On homepage "full" can be transparent. Transparent must exist only
           * at true top (Case 1). If we're below top, force minimized immediately.
           */
          scrollAccum = 0;
          if (full === 'transparent') {
            applyHeaderState(root, 'minimized');
          }
          return;
        }

        /*
         * In minimized/hidden state but below threshold (user is scrolling back up).
         *
         * HYSTERESIS: do NOT snap back to full just because scrollTop crossed the threshold
         * by a few pixels.  That oscillation is exactly what creates the ghost-header flicker
         * (rapid hidden↔solid state flips trigger the 0.35s opacity transition repeatedly).
         *
         * Instead, only revert to full when scrollTop is significantly below the threshold
         * (THRESHOLD_BACK_PX buffer).  If the threshold is small (< THRESHOLD_BACK_PX)
         * the header simply stays minimized until scrollTop ≈ 0, which is handled by
         * Case 1 above — matching how Shopify's own header behaves.
         */
        var raw = parseInt(root.dataset.scrollThreshold, 10) || 0;
        var docEl = document.documentElement;
        var maxSY = Math.max(0, docEl.scrollHeight - docEl.clientHeight);
        var effectiveThr = (maxSY > 0 && maxSY < raw) ? maxSY : raw;
        var revertAt = Math.max(0, effectiveThr - THRESHOLD_BACK_PX);

        if (scrollTop <= revertAt) {
          /* Safely above the threshold (with buffer) → restore full */
          scrollAccum = 0;
          applyHeaderState(root, full);
        } else {
          /* In the hysteresis zone: maintain current state, reset accumulator */
          scrollAccum = 0;
        }
        return;
      }

      /* ── Case 3: Past threshold — accumulate scroll direction ────────────────────── */
      /*
       * Direction reversal resets the accumulator so the user must scroll a meaningful
       * distance in the new direction before the header changes state.
       */
      if (delta > 0) {
        if (scrollAccum < 0) {
          scrollAccum = 0;
        }
        scrollAccum += delta;
        if (scrollAccum >= HIDE_REQUIRE_PX && curState !== 'hidden') {
          applyHeaderState(root, 'hidden');
        }
        if (scrollAccum > HIDE_REQUIRE_PX) {
          scrollAccum = HIDE_REQUIRE_PX;
        }
      } else if (delta < 0) {
        if (scrollAccum > 0) {
          scrollAccum = 0;
        }
        scrollAccum += delta;
        if (scrollAccum <= -SHOW_REQUIRE_PX && curState !== 'minimized') {
          applyHeaderState(root, 'minimized');
        }
        if (scrollAccum < -SHOW_REQUIRE_PX) {
          scrollAccum = -SHOW_REQUIRE_PX;
        }
      }
      /* delta === 0 (idle): keep current state, no change */
    };

    function scheduleScrollUpdate() {
      if (layoutRaf !== null) {
        return;
      }
      layoutRaf = requestAnimationFrame(function () {
        layoutRaf = null;
        onScrollFrame();
      });
    }

    root._customHeaderScheduleScroll = scheduleScrollUpdate;

    window.addEventListener('scroll', scheduleScrollUpdate, { passive: true });

    var onMediaChange = function () {
      if (!mediaMobile.matches) {
        closeAllMobilePanels();
      }
      scrollAccum = 0;
      prevScrollTop = getScrollTop();
      scheduleScrollUpdate();
    };
    mediaMobile.addEventListener('change', onMediaChange);

    var onGlobalKeydown = function (event) {
      if (event.key !== 'Escape') {
        return;
      }
      if (root.dataset.mobileNavOpen === 'true') {
        setMobileNavOpen(false);
        event.preventDefault();
        return;
      }
      if (root.dataset.mobileSearchOpen === 'true') {
        setMobileSearchOpen(false);
        event.preventDefault();
      }
    };
    document.addEventListener('keydown', onGlobalKeydown);

    var onDialogOpen = function () {
      prevScrollTop = getScrollTop();
      scrollAccum = 0;
    };
    var onDialogClose = function () {
      prevScrollTop = getScrollTop();
      scrollAccum = 0;
      scheduleScrollUpdate();
      requestAnimationFrame(scheduleScrollUpdate);
      window.setTimeout(scheduleScrollUpdate, 80);
    };
    document.addEventListener('dialog:open', onDialogOpen);
    document.addEventListener('dialog:close', onDialogClose);

    /*
     * Browser scroll restoration can happen after initial script execution
     * (especially on reload / bfcache). Re-run the state calculation once
     * those lifecycle points fire so transparent state is only at true top.
     */
    var onWindowLoad = function () {
      scheduleScrollUpdate();
    };
    var onPageShow = function () {
      scheduleScrollUpdate();
    };
    window.addEventListener('load', onWindowLoad, { once: true });
    window.addEventListener('pageshow', onPageShow);
    var delayedRestoreCheck = window.setTimeout(function () {
      scheduleScrollUpdate();
    }, 90);

    /*
     * Guard against deferred script timing + restored scroll position:
     * never start transparent when page is already scrolled.
     */
    if (topState(root) === 'transparent' && getScrollTop() > SCROLL_EPS) {
      applyHeaderState(root, 'minimized');
    }
    onScrollFrame();

    root.dataset.customHeaderJs = 'initialized';

    root._customHeaderCleanup = function () {
      if (layoutRaf !== null) {
        cancelAnimationFrame(layoutRaf);
        layoutRaf = null;
      }
      window.removeEventListener('scroll', scheduleScrollUpdate);
      window.removeEventListener('resize', scheduleScrollUpdate);
      window.removeEventListener('pageshow', onPageShow);
      mediaMobile.removeEventListener('change', onMediaChange);
      document.removeEventListener('keydown', onGlobalKeydown);
      document.removeEventListener('dialog:open', onDialogOpen);
      document.removeEventListener('dialog:close', onDialogClose);
      window.clearTimeout(delayedRestoreCheck);
      if (toggle) {
        toggle.removeEventListener('click', onToggleClick);
      }
      if (searchTrigger) {
        searchTrigger.removeEventListener('click', onSearchTriggerClick);
      }
      if (overlay) {
        overlay.removeEventListener('click', onOverlayClick);
      }
      if (drawerClose) {
        drawerClose.removeEventListener('click', onDrawerCloseClick);
      }
      if (searchClose) {
        searchClose.removeEventListener('click', onSearchCloseClick);
      }
      closeAllMobilePanels();
      setScrollLock(false);
      root.dataset.customHeaderJs = '';
      delete root._customHeaderScheduleScroll;
      delete root._customHeaderCleanup;
    };

    /* Must be called AFTER root._customHeaderCleanup is assigned so the
     * search cleanup can safely chain onto it. */
    initDesktopSearch(root);
  }

  /* ── Desktop search dropdown ────────────────────────────────────────────────
   * Google-style autocomplete: recent searches, recently viewed products, and
   * live results from Shopify's Predictive Search API.
   * ─────────────────────────────────────────────────────────────────────── */
  var CH_RECENT_KEY = 'ch-recent-searches';
  var CH_VIEWED_KEY = 'ch-recently-viewed';

  function chEsc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function chFmtMoney(cents) {
    if (cents == null) { return ''; }
    var n = (cents / 100).toFixed(2);
    var cur = (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || '';
    return cur ? n + '\u00a0' + cur : n;
  }

  function chImgResize(url, w) {
    if (!url) { return ''; }
    return url.replace(/(\.\w+)(\?|$)/, '_' + w + 'x$1$2');
  }

  var CH_SVG_CLOCK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
  var CH_SVG_SEARCH = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

  function initDesktopSearch(root) {
    var wrap = root.querySelector('[data-custom-header-search-wrap]');
    if (!wrap) { return; }
    var form = wrap.querySelector('[data-custom-header-search-form]');
    var input = wrap.querySelector('[data-custom-header-search-input]');
    var dropdown = wrap.querySelector('[data-custom-header-search-dropdown]');
    if (!form || !input || !dropdown) { return; }

    var debTimer = null;
    var focusableItems = [];
    var currentFocusIdx = -1;

    /* ── Storage helpers ─────────────────────────────────────────────────── */
    function getRecent() {
      try { return JSON.parse(localStorage.getItem(CH_RECENT_KEY) || '[]'); } catch (e) { return []; }
    }
    function saveRecent(q) {
      q = q.trim();
      if (!q) { return; }
      var list = getRecent().filter(function (s) { return s !== q; });
      list.unshift(q);
      try { localStorage.setItem(CH_RECENT_KEY, JSON.stringify(list.slice(0, 5))); } catch (e) {}
    }
    function removeRecent(q) {
      var list = getRecent().filter(function (s) { return s !== q; });
      try { localStorage.setItem(CH_RECENT_KEY, JSON.stringify(list)); } catch (e) {}
    }
    function getViewed() {
      try { return JSON.parse(localStorage.getItem(CH_VIEWED_KEY) || '[]'); } catch (e) { return []; }
    }

    /* ── Render helpers ──────────────────────────────────────────────────── */
    function productCard(title, imgUrl, url, price) {
      var imgHtml = imgUrl
        ? '<img class="ch-search-product-img" src="' + chEsc(imgUrl) + '" alt="' + chEsc(title) + '" width="130" height="130" loading="lazy">'
        : '';
      return '<li>'
        + '<a class="ch-search-product-link" href="' + chEsc(url) + '">'
        + '<div class="ch-search-product-img-wrap">' + imgHtml + '</div>'
        + '<div class="ch-search-product-info">'
        + '<p class="ch-search-product-title">' + chEsc(title) + '</p>'
        + (price ? '<span class="ch-search-product-price">' + chEsc(price) + '</span>' : '')
        + '</div>'
        + '</a>'
        + '</li>';
    }

    /* ── Open / close ────────────────────────────────────────────────────── */
    function open(html) {
      dropdown.innerHTML = html;
      dropdown.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      currentFocusIdx = -1;
      focusableItems = Array.from(dropdown.querySelectorAll('[data-ch-focusable]'));
      bindInternalEvents();
    }

    function close() {
      dropdown.hidden = true;
      dropdown.innerHTML = '';
      input.setAttribute('aria-expanded', 'false');
      currentFocusIdx = -1;
      focusableItems = [];
    }

    /* ── Render: empty state ─────────────────────────────────────────────── */
    function renderEmpty() {
      var recent = getRecent();
      var viewed = getViewed();
      if (!recent.length && !viewed.length) { close(); return; }

      var html = '';

      if (recent.length) {
        html += '<div class="ch-search-section">';
        html += '<p class="ch-search-section__title">Recent searches</p>';
        html += '<ul class="ch-search-queries">';
        recent.forEach(function (term) {
          var t = chEsc(term);
          html += '<li>'
            + '<button class="ch-search-suggestion" type="button" data-ch-focusable data-term="' + t + '">'
            + '<span class="ch-search-suggestion__icon">' + CH_SVG_CLOCK + '</span>'
            + '<span class="ch-search-suggestion__text">' + t + '</span>'
            + '<button class="ch-search-suggestion__remove" type="button" aria-label="Remove ' + t + '" data-remove="' + t + '">&times;</button>'
            + '</button>'
            + '</li>';
        });
        html += '</ul></div>';
      }

      if (viewed.length) {
        html += '<div class="ch-search-section">';
        html += '<p class="ch-search-section__title">Recently viewed</p>';
        html += '<ul class="ch-search-products">';
        viewed.slice(0, 4).forEach(function (p) {
          html += productCard(p.title, p.image, p.url, p.price ? chFmtMoney(p.price) : '');
        });
        html += '</ul></div>';
      }

      open(html);
    }

    /* ── Render: predictive results ──────────────────────────────────────── */
    function renderResults(queries, products, q) {
      if (!queries.length && !products.length) {
        open('<div class="ch-search-empty">No results for \u201c' + chEsc(q) + '\u201d</div>');
        return;
      }

      var html = '';

      if (queries.length) {
        html += '<div class="ch-search-section">';
        html += '<ul class="ch-search-queries">';
        queries.slice(0, 5).forEach(function (item) {
          /* styled_text from Shopify contains <em> tags — safe to use as HTML */
          var label = item.styled_text || chEsc(item.text);
          html += '<li>'
            + '<button class="ch-search-suggestion" type="button" data-ch-focusable data-term="' + chEsc(item.text) + '">'
            + '<span class="ch-search-suggestion__icon">' + CH_SVG_SEARCH + '</span>'
            + '<span class="ch-search-suggestion__text">' + label + '</span>'
            + '</button>'
            + '</li>';
        });
        html += '</ul></div>';
      }

      if (products.length) {
        html += '<div class="ch-search-section">';
        html += '<p class="ch-search-section__title">Products</p>';
        html += '<ul class="ch-search-products">';
        products.slice(0, 4).forEach(function (p) {
          var img = p.featured_image ? chImgResize(p.featured_image.url, 130) : '';
          html += productCard(p.title, img, p.url, chFmtMoney(p.price_min));
        });
        html += '</ul></div>';
      }

      html += '<div class="ch-search-footer">'
        + '<a class="ch-search-footer__link" href="/search?q=' + encodeURIComponent(q) + '&type=product">'
        + 'See all results for \u201c' + chEsc(q) + '\u201d \u2192'
        + '</a></div>';

      open(html);
    }

    /* ── Fetch predictive search ─────────────────────────────────────────── */
    function fetchSearch(q) {
      open('<div class="ch-search-loading">Searching\u2026</div>');
      fetch(
        '/search/suggest.json'
        + '?q=' + encodeURIComponent(q)
        + '&resources[type]=product,query'
        + '&resources[limit]=6'
        + '&resources[options][unavailable_products]=last'
      )
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (input.value.trim() !== q) { return; }
          var r = (data.resources && data.resources.results) || {};
          renderResults(r.queries || [], r.products || [], q);
        })
        .catch(function () {
          if (input.value.trim() !== q) { return; }
          open('<div class="ch-search-empty">Could not load results. <a href="/search?q=' + encodeURIComponent(q) + '&type=product">Try the search page</a></div>');
        });
    }

    /* ── Bind events inside the dropdown ────────────────────────────────── */
    function bindInternalEvents() {
      dropdown.querySelectorAll('.ch-search-suggestion[data-term]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          if (e.target.closest('.ch-search-suggestion__remove')) { return; }
          e.preventDefault();
          input.value = btn.dataset.term;
          saveRecent(btn.dataset.term);
          close();
          form.submit();
        });
      });

      dropdown.querySelectorAll('.ch-search-suggestion__remove[data-remove]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          removeRecent(btn.dataset.remove);
          renderEmpty();
        });
      });
    }

    /* ── Keyboard navigation (arrow keys move through focusableItems) ────── */
    function moveFocus(dir) {
      if (!focusableItems.length) { return; }
      currentFocusIdx = Math.max(-1, Math.min(focusableItems.length - 1, currentFocusIdx + dir));
      focusableItems.forEach(function (el, i) {
        if (i === currentFocusIdx) {
          el.setAttribute('data-focused', 'true');
          el.focus();
          var term = el.dataset.term;
          if (term) { input.value = term; }
        } else {
          el.removeAttribute('data-focused');
        }
      });
      if (currentFocusIdx < 0) { input.focus(); }
    }

    /* ── External event listeners ────────────────────────────────────────── */
    var onKeydown = function (e) {
      if (e.key === 'Escape') { close(); input.blur(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1); }
    };

    var onInputEvent = function () {
      clearTimeout(debTimer);
      var q = input.value.trim();
      currentFocusIdx = -1;
      if (!q) { renderEmpty(); return; }
      debTimer = setTimeout(function () {
        if (input.value.trim() === q) { fetchSearch(q); }
      }, 280);
    };

    var onFocus = function () {
      if (!input.value.trim()) { renderEmpty(); }
    };

    var onDocClick = function (e) {
      if (!wrap.contains(e.target)) { close(); }
    };

    input.addEventListener('keydown', onKeydown);
    input.addEventListener('input', onInputEvent);
    input.addEventListener('focus', onFocus);
    document.addEventListener('click', onDocClick);

    form.addEventListener('submit', function () {
      var q = input.value.trim();
      if (q) { saveRecent(q); }
    });

    /* ── Cleanup — chain onto the root's existing cleanup fn ────────────── */
    var prevCleanup = root._customHeaderCleanup;
    root._customHeaderCleanup = function () {
      input.removeEventListener('keydown', onKeydown);
      input.removeEventListener('input', onInputEvent);
      input.removeEventListener('focus', onFocus);
      document.removeEventListener('click', onDocClick);
      clearTimeout(debTimer);
      close();
      if (typeof prevCleanup === 'function') { prevCleanup(); }
    };
  }

  /* ── Recently-viewed product tracking ──────────────────────────────────────
   * Runs on every page. On product pages, saves the product to localStorage
   * so the search dropdown can show it under "Recently viewed".
   * ─────────────────────────────────────────────────────────────────────── */
  (function () {
    if (document.location.pathname.indexOf('/products/') === -1) { return; }
    var handle = document.location.pathname
      .split('/products/')[1]
      .split('?')[0]
      .split('/')[0];
    if (!handle) { return; }
    fetch('/products/' + handle + '.js')
      .then(function (r) { return r.json(); })
      .then(function (p) {
        try {
          var raw = p.featured_image || '';
          var img = raw ? (raw.indexOf('//') === 0 ? 'https:' + raw : raw) : '';
          var list = JSON.parse(localStorage.getItem(CH_VIEWED_KEY) || '[]');
          list = list.filter(function (x) { return x.handle !== p.handle; });
          list.unshift({ handle: p.handle, title: p.title, image: img, url: p.url, price: p.price });
          localStorage.setItem(CH_VIEWED_KEY, JSON.stringify(list.slice(0, 8)));
        } catch (e) {}
      })
      .catch(function () {});
  }());

  var headerGroupResizeObserver = null;

  function initAll() {
    updateAnnouncementBarHeight();
    document.querySelectorAll('[data-custom-header]').forEach(function (root) {
      initCustomHeader(root);
    });
    var hg = document.querySelector('#header-group');
    if (hg && !headerGroupResizeObserver) {
      headerGroupResizeObserver = new ResizeObserver(function () {
        updateAnnouncementBarHeight();
        document.querySelectorAll('[data-custom-header]').forEach(function (r) {
          if (r.dataset.customHeaderJs === 'initialized' && typeof r._customHeaderScheduleScroll === 'function') {
            r._customHeaderScheduleScroll();
          }
        });
      });
      headerGroupResizeObserver.observe(hg);
    }
  }

  function onDomReady() {
    initAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDomReady);
  } else {
    onDomReady();
  }

  function findCustomHeaderRoot(sectionId) {
    var byAttr = document.querySelector('[data-custom-header][data-section-id="' + sectionId + '"]');
    if (byAttr) {
      return byAttr;
    }
    var section = document.getElementById('shopify-section-' + sectionId);
    return section ? section.querySelector('[data-custom-header]') : null;
  }

  document.addEventListener('shopify:section:load', function (event) {
    var id = event.detail && event.detail.sectionId;
    requestAnimationFrame(function () {
      updateAnnouncementBarHeight();
      if (!id) {
        return;
      }
      var root = findCustomHeaderRoot(id);
      if (!root) {
        return;
      }
      if (typeof root._customHeaderCleanup === 'function') {
        root._customHeaderCleanup();
      }
      initCustomHeader(root);
    });
  });

  document.addEventListener('shopify:section:unload', function (event) {
    var id = event.detail && event.detail.sectionId;
    if (!id) {
      return;
    }
    var root = findCustomHeaderRoot(id);
    if (root && typeof root._customHeaderCleanup === 'function') {
      root._customHeaderCleanup();
    }
  });
})();
