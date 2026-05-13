// @ts-nocheck
/**
 * Custom header: scroll states + mobile drawer (left) / search panel (right).
 * Idempotent init for Shopify section reloads.
 */
(function () {
  'use strict';

  var SCROLL_EPS = 2;
  /**
   * Mobile: wider "at top" band so layout + scroll anchoring does not oscillate scrollTop
   * across the desktop epsilon when --header-height jumps between default and minimized.
   */
  var SCROLL_EPS_MOBILE = 14;
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
   * threshold — or at the true page top (handled by scrollTopEpsilon()).
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
  var announcementBarHeightPx = 0;
  var NON_CRITICAL_IDLE_TIMEOUT_MS = 2000;
  var PERF_DEBUG_SCOPE_PREFIX = '[theme-perf]';
  var perfDebugEnabled = false;
  var hasObservedLongTasks = false;
  var perfRegisteredListeners = typeof WeakMap === 'function' ? new WeakMap() : null;

  try {
    perfDebugEnabled =
      window.__HORIZON_PERF_DEBUG__ === true ||
      new URLSearchParams(window.location.search).get('perf_debug') === 'true';
  } catch (error) {
    perfDebugEnabled = window.__HORIZON_PERF_DEBUG__ === true;
  }

  function observeLongTasks(scope) {
    if (!perfDebugEnabled || hasObservedLongTasks || typeof PerformanceObserver === 'undefined') {
      return;
    }

    try {
      var observer = new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          if (entry.duration <= 50) {
            return;
          }
          console.warn(PERF_DEBUG_SCOPE_PREFIX + '[' + scope + '] long task', {
            name: entry.name || 'longtask',
            duration: Math.round(entry.duration),
            startTime: Math.round(entry.startTime),
          });
        });
      });

      observer.observe({ type: 'longtask', buffered: true });
      hasObservedLongTasks = true;
    } catch (error) {
      console.warn(PERF_DEBUG_SCOPE_PREFIX + '[' + scope + '] failed to observe long tasks', error);
    }
  }

  function logLongTask(scope, label, startTime, extra) {
    if (!perfDebugEnabled) {
      return;
    }

    var duration = performance.now() - startTime;
    if (duration <= 50) {
      return;
    }

    console.warn(PERF_DEBUG_SCOPE_PREFIX + '[' + scope + '] ' + label, Object.assign({
      duration: Math.round(duration),
    }, extra || {}));
  }

  function registerDebugListener(target, scope, key) {
    if (!perfDebugEnabled || !perfRegisteredListeners || !target) {
      return;
    }

    var registrations = perfRegisteredListeners.get(target);
    if (!registrations) {
      registrations = new Set();
      perfRegisteredListeners.set(target, registrations);
    }

    if (registrations.has(key)) {
      console.warn(PERF_DEBUG_SCOPE_PREFIX + '[' + scope + '] duplicate listener registration', {
        key: key,
        target: target,
      });
      return;
    }

    registrations.add(key);
  }

  function unregisterDebugListener(target, key) {
    if (!perfRegisteredListeners || !target) {
      return;
    }

    var registrations = perfRegisteredListeners.get(target);
    if (!registrations) {
      return;
    }

    registrations.delete(key);
    if (!registrations.size) {
      perfRegisteredListeners.delete(target);
    }
  }

  function setCachedStyleProperty(target, property, value) {
    if (!target || !target.style) {
      return;
    }

    var cache = target._themePerfStyleCache;
    if (!cache) {
      cache = {};
      target._themePerfStyleCache = cache;
    }

    if (cache[property] === value) {
      return;
    }

    cache[property] = value;
    target.style.setProperty(property, value);
  }

  function setAnnouncementBarHeightPx(height) {
    var nextHeight = Math.max(0, Math.round(Number(height) || 0));
    announcementBarHeightPx = nextHeight;
    setCachedStyleProperty(document.documentElement, '--announcement-bar-height', nextHeight + 'px');
  }

  function scheduleNonCriticalTask(callback) {
    var idleHandle = null;
    var loadBound = false;

    function run() {
      callback();
    }

    function queueIdle() {
      if (typeof window.requestIdleCallback === 'function') {
        idleHandle = window.requestIdleCallback(run, { timeout: NON_CRITICAL_IDLE_TIMEOUT_MS });
      } else {
        idleHandle = window.setTimeout(run, 1);
      }
    }

    function onLoad() {
      loadBound = false;
      queueIdle();
    }

    if (document.readyState === 'complete') {
      queueIdle();
    } else {
      loadBound = true;
      window.addEventListener('load', onLoad, { once: true });
    }

    return function cancelScheduledTask() {
      if (loadBound) {
        window.removeEventListener('load', onLoad);
        loadBound = false;
      }
      if (idleHandle !== null) {
        if (typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(idleHandle);
        } else {
          window.clearTimeout(idleHandle);
        }
        idleHandle = null;
      }
    };
  }

  function refreshCustomHeaderMetrics(root) {
    var metrics = root._customHeaderMetrics || {};
    var cs = getComputedStyle(root);
    var defaultHeight = parseFloat(cs.getPropertyValue('--custom-header-default-height').trim());
    var minimizedHeight = parseFloat(cs.getPropertyValue('--custom-header-minimized-height').trim());

    if (isNaN(defaultHeight)) {
      defaultHeight = Math.round(root.getBoundingClientRect().height);
    }

    if (isNaN(minimizedHeight)) {
      minimizedHeight = defaultHeight;
    }

    metrics.defaultHeight = Math.round(defaultHeight);
    metrics.minimizedHeight = Math.round(minimizedHeight);
    root._customHeaderMetrics = metrics;

    return metrics;
  }

  function refreshHeaderGroupMeasurements(root) {
    var startTime = performance.now();
    var hg = document.querySelector('#header-group');
    var staticGroupHeight = 0;
    var nextAnnouncementHeight = 0;

    if (hg) {
      for (var i = 0; i < hg.children.length; i++) {
        var section = hg.children[i];
        if (!(section instanceof HTMLElement)) {
          continue;
        }

        var customRoot = section.querySelector('[data-custom-header]');
        if (customRoot && customRoot === root) {
          continue;
        }

        var sectionHeight = section.offsetHeight;
        staticGroupHeight += sectionHeight;

        if (!nextAnnouncementHeight && section.querySelector('.announcement-bar')) {
          nextAnnouncementHeight = sectionHeight;
        }
      }
    }

    root._customHeaderStaticGroupHeight = staticGroupHeight;
    setAnnouncementBarHeightPx(nextAnnouncementHeight);
    logLongTask('custom-header', 'refreshHeaderGroupMeasurements', startTime, {
      staticGroupHeight: staticGroupHeight,
      announcementHeight: nextAnnouncementHeight,
    });
  }

  function scrollTopEpsilon() {
    if (typeof window.matchMedia === 'function' && window.matchMedia(MOBILE_MQ).matches) {
      return SCROLL_EPS_MOBILE;
    }
    return SCROLL_EPS;
  }

  function isMobileViewport() {
    return typeof window.matchMedia === 'function' && window.matchMedia(MOBILE_MQ).matches;
  }

  /** DialogComponent locks scroll with inline body styles; match that so scroll handlers cannot run during cart drawer / modal lock even between attribute and style application. */
  function isDialogBodyScrollLocked() {
    var b = document.body;
    return !!(b && b.style && b.style.position === 'fixed' && b.style.top);
  }

  /** Full / compact header heights from theme CSS vars — avoids getBoundingClientRect feedback loops near scroll top. */
  function getStableCustomHeaderHeightPx(root) {
    var state = root.dataset.headerState;
    var metrics = refreshCustomHeaderMetrics(root);
    if (isMobileViewport()) {
      return metrics.defaultHeight;
    }
    if (state === 'transparent' || state === 'solid') {
      return metrics.defaultHeight;
    }
    if (state === 'minimized' || state === 'hidden') {
      return metrics.minimizedHeight;
    }
    return metrics.defaultHeight;
  }

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
    var epsTop = scrollTopEpsilon();
    if (
      liveScrollTop <= epsTop &&
      lastLockedScrollTop > epsTop &&
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

  function visibleScrollState(root) {
    return topState(root) === 'transparent' ? 'solid' : topState(root);
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

  function updateAnnouncementBarHeight(root) {
    var headerRoot = root || document.querySelector('[data-custom-header]');
    if (headerRoot) {
      refreshHeaderGroupMeasurements(headerRoot);
    } else {
      setAnnouncementBarHeightPx(0);
    }
    syncProductGalleryViewportOffset(headerRoot);
    updateMobilePortalTopInset();
  }

  /**
   * Mobile full-screen portals (overlay, nav drawer, search) use position:fixed; inset:0.
   * At scroll top the announcement bar is visible — offset portals so they start below it.
   * After the user scrolls down, the bar is gone → use full viewport (inset 0).
   */
  function updateMobilePortalTopInset() {
    if (typeof window.matchMedia !== 'function' || !window.matchMedia(MOBILE_MQ).matches) {
      setCachedStyleProperty(document.documentElement, '--custom-header-mobile-portal-top', '0px');
      return;
    }
    var st = getScrollTop();
    var eps = scrollTopEpsilon();
    var inset = st <= eps && announcementBarHeightPx > 0 ? announcementBarHeightPx + 'px' : '0px';
    setCachedStyleProperty(document.documentElement, '--custom-header-mobile-portal-top', inset);
  }

  /**
   * Product gallery max-height uses --viewport-offset → calc(100vh - offset). Live --header-height
   * changes on every transparent/solid/minimized/hidden transition, which makes images resize while scrolling.
   * Reserve a stable offset: announcement bar + max(default, minimized) heights from theme CSS variables.
   */
  function syncProductGalleryViewportOffset(root) {
    var headerRoot = root || document.querySelector('[data-custom-header]');
    if (!headerRoot) {
      return;
    }
    var metrics = refreshCustomHeaderMetrics(headerRoot);
    var reserve = Math.max(metrics.defaultHeight || 72, metrics.minimizedHeight || 56);
    setCachedStyleProperty(
      document.documentElement,
      '--product-gallery-viewport-offset',
      announcementBarHeightPx + reserve + 'px'
    );
  }

  function updateHeaderGroupHeight(root) {
    var staticGroupHeight = root._customHeaderStaticGroupHeight;
    if (typeof staticGroupHeight !== 'number') {
      refreshHeaderGroupMeasurements(root);
      staticGroupHeight = root._customHeaderStaticGroupHeight || 0;
    }
    var total = staticGroupHeight + getStableCustomHeaderHeightPx(root);
    setCachedStyleProperty(document.body, '--header-group-height', total + 'px');
  }

  function updateBodyHeaderHeight(root) {
    var h = getStableCustomHeaderHeightPx(root);
    setCachedStyleProperty(document.body, '--header-height', h + 'px');
    updateHeaderGroupHeight(root);
    syncProductGalleryViewportOffset();
  }

  function applyHeaderState(root, state) {
    /*
     * Never assign transparent on templates where the header is not allowed to be transparent
     * (e.g. product pages). Prevents stray transitions if scroll/lock timing mis-reads position.
     */
    if (state === 'transparent' && topState(root) !== 'transparent') {
      state = 'solid';
    }
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
    if (!root) {
      return;
    }
    if (root.dataset.customHeaderJs === 'initialized') {
      registerDebugListener(root, 'custom-header', 'duplicate-init');
      unregisterDebugListener(root, 'duplicate-init');
      return;
    }
    observeLongTasks('theme');
    registerDebugListener(root, 'custom-header', 'init');

    var mediaMobile = window.matchMedia(MOBILE_MQ);
    var sectionEl = root.closest('.shopify-section');
    var portalRoot = sectionEl ? sectionEl.querySelector('[data-custom-header-portals]') : null;
    var toggle = root.querySelector('[data-custom-header-menu-toggle]');
    var overlay = portalRoot ? portalRoot.querySelector('[data-custom-header-overlay]') : null;
    var drawer = portalRoot ? portalRoot.querySelector('[data-custom-header-mobile-drawer]') : null;
    var drawerClose = portalRoot ? portalRoot.querySelector('[data-custom-header-drawer-close]') : null;

    var mobileTabList = drawer ? drawer.querySelector('[data-custom-header-mobile-tabs]') : null;
    var mobilePanelsScroll = drawer ? drawer.querySelector('[data-custom-header-mobile-panels]') : null;

    function getMobileTabs() {
      return mobileTabList ? mobileTabList.querySelectorAll('[data-custom-header-mobile-tab]') : [];
    }

    function getMobilePanels() {
      return drawer ? drawer.querySelectorAll('[data-custom-header-mobile-panel]') : [];
    }

    function selectMobileDrawerTab(index) {
      var tabs = getMobileTabs();
      var panels = getMobilePanels();
      if (!tabs.length || !panels.length) {
        return;
      }
      var n = tabs.length;
      var i = Math.max(0, Math.min(index, n - 1));
      for (var t = 0; t < n; t++) {
        var selected = t === i;
        tabs[t].setAttribute('aria-selected', selected ? 'true' : 'false');
        tabs[t].tabIndex = selected ? 0 : -1;
        tabs[t].classList.toggle('custom-header__mobile-tab--active', selected);
      }
      for (var p = 0; p < panels.length; p++) {
        var show = p === i;
        if (show) {
          panels[p].removeAttribute('hidden');
          panels[p].classList.remove('custom-header__mobile-panel--hidden');
        } else {
          panels[p].setAttribute('hidden', '');
          panels[p].classList.add('custom-header__mobile-panel--hidden');
        }
      }
      if (mobilePanelsScroll) {
        mobilePanelsScroll.scrollTop = 0;
      }
    }

    function closeSiblingMobileAccordions(opened) {
      if (!drawer || !opened || !opened.open) {
        return;
      }
      var g = opened.getAttribute('data-custom-header-acc-group');
      if (!g) {
        return;
      }
      var all = drawer.querySelectorAll('.custom-header__mobile-details[data-custom-header-acc-group]');
      for (var k = 0; k < all.length; k++) {
        var el = all[k];
        if (el !== opened && el.getAttribute('data-custom-header-acc-group') === g) {
          el.removeAttribute('open');
        }
      }
    }

    var onMobileTabClick = function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-custom-header-mobile-tab]') : null;
      if (!btn || !mobileTabList || !mobileTabList.contains(btn)) {
        return;
      }
      var idx = parseInt(btn.getAttribute('data-tab-index'), 10);
      if (isNaN(idx)) {
        return;
      }
      selectMobileDrawerTab(idx);
    };

    var onMobileTabListKeydown = function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') {
        return;
      }
      var tabs = getMobileTabs();
      if (!tabs.length) {
        return;
      }
      var current = -1;
      for (var j = 0; j < tabs.length; j++) {
        if (tabs[j].getAttribute('aria-selected') === 'true') {
          current = j;
          break;
        }
      }
      if (current < 0) {
        current = 0;
      }
      var next = current;
      if (e.key === 'ArrowRight') {
        next = (current + 1) % tabs.length;
      } else if (e.key === 'ArrowLeft') {
        next = (current - 1 + tabs.length) % tabs.length;
      } else if (e.key === 'Home') {
        next = 0;
      } else if (e.key === 'End') {
        next = tabs.length - 1;
      }
      if (next !== current) {
        e.preventDefault();
        selectMobileDrawerTab(next);
        tabs[next].focus();
      }
    };

    var onMobileAccordionToggle = function (e) {
      var t = e.target;
      if (!t || !t.matches || !t.matches('details.custom-header__mobile-details')) {
        return;
      }
      closeSiblingMobileAccordions(t);
    };

    var prevScrollTop = getScrollTop();
    /** Running total of scroll movement in one direction. Resets on direction reversal.
     * Positive = downward scroll accumulated, negative = upward. */
    var scrollAccum = 0;
    var lastMenuFocus = null;

    function isMobile() {
      return mediaMobile.matches;
    }

    refreshCustomHeaderMetrics(root);
    refreshHeaderGroupMeasurements(root);

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
      updateMobilePortalTopInset();
      if (open && drawer) {
        lastMenuFocus = document.activeElement;
        selectMobileDrawerTab(0);
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

    function updateOverlay() {
      var navOpen = root.dataset.mobileNavOpen === 'true';
      var show = isMobile() && navOpen;
      if (overlay) {
        overlay.classList.toggle('is-open', show);
        overlay.setAttribute('aria-hidden', show ? 'false' : 'true');
      }
    }

    function updateScrollLock() {
      var navOpen = root.dataset.mobileNavOpen === 'true';
      setScrollLock(isMobile() && navOpen);
    }

    function closeAllMobilePanels() {
      setMobileNavOpen(false);
    }

    function onToggleClick() {
      if (!isMobile()) {
        return;
      }
      if (!drawer) {
        return;
      }
      var isOpen = root.dataset.mobileNavOpen === 'true';
      setMobileNavOpen(!isOpen);
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

    if (toggle) {
      toggle.addEventListener('click', onToggleClick);
    }
    if (overlay) {
      overlay.addEventListener('click', onOverlayClick);
    }

    var onDrawerCloseClick = function () {
      setMobileNavOpen(false);
    };
    if (drawerClose) {
      drawerClose.addEventListener('click', onDrawerCloseClick);
    }
    if (mobileTabList) {
      mobileTabList.addEventListener('click', onMobileTabClick);
      mobileTabList.addEventListener('keydown', onMobileTabListKeydown);
    }
    if (drawer) {
      drawer.addEventListener('toggle', onMobileAccordionToggle, true);
    }

    var layoutRaf = null;
    var onScrollFrame = function () {
      var startTime = performance.now();
      var scrollTop = getScrollTop();
      var delta = scrollTop - prevScrollTop;
      prevScrollTop = scrollTop;

      /*
       * While a modal/drawer with [scroll-lock] is open — or body is locked by DialogComponent —
       * freeze header state. Prevents bogus scroll deltas (e.g. cart drawer) from forcing
       * hidden/minimized on product pages.
       */
      if (document.documentElement.hasAttribute('scroll-lock') || isDialogBodyScrollLocked()) {
        scrollAccum = 0;
        return;
      }

      var full = topState(root);
      var visibleState = visibleScrollState(root);
      var curState = root.dataset.headerState || full;

      /* ── Case 1: At true page top → always restore full header ──────────────────────── */
      if (scrollTop <= scrollTopEpsilon()) {
        scrollAccum = 0;
        if (curState !== full) {
          applyHeaderState(root, full);
        }
        return;
      }

      /*
       * Invariant: transparent is allowed only at true top.
       * Demote to hidden (not minimized) so the first scroll down does not flash the slim
       * minimized bar — that bar is reserved for scroll-up-from-hidden (Case 3).
       */
      if (full === 'transparent' && curState === 'transparent') {
        applyHeaderState(root, 'hidden');
        curState = 'hidden';
      }

      /* ── Case 2: Below the scroll_threshold zone ──────────────────────────────────── */
      if (!isPastThreshold(root, scrollTop)) {
        if (curState === full) {
          /*
           * On homepage "full" can be transparent. Transparent must exist only
           * at true top (Case 1). If we're below top, force hidden (same as main demotion).
           */
          scrollAccum = 0;
          if (full === 'transparent') {
            applyHeaderState(root, 'hidden');
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
          /*
           * Safely below the scroll threshold (with buffer) → restore non-scroll "full" state.
           * For non-homepage that is solid; for homepage full === 'transparent' must NOT be
           * applied here — only Case 1 (scrollTop ≈ 0) may show transparent again. Otherwise
           * scrollTop <= revertAt fires while the user has already left the top (e.g. 50–300px),
           * re-applying transparent and fighting the transparent→hidden demotion → flicker.
           */
          scrollAccum = 0;
          if (full !== 'transparent') {
            applyHeaderState(root, full);
          }
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
      if (isMobile()) {
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
          if (scrollAccum <= -SHOW_REQUIRE_PX && curState !== visibleState) {
            applyHeaderState(root, visibleState);
          }
          if (scrollAccum < -SHOW_REQUIRE_PX) {
            scrollAccum = -SHOW_REQUIRE_PX;
          }
        }
        return;
      }

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
      logLongTask('custom-header', 'onScrollFrame', startTime, {
        scrollTop: Math.round(scrollTop),
        headerState: root.dataset.headerState || full,
      });
    };

    function scheduleScrollUpdate() {
      if (layoutRaf !== null) {
        return;
      }
      layoutRaf = requestAnimationFrame(function () {
        layoutRaf = null;
        onScrollFrame();
        updateMobilePortalTopInset();
      });
    }

    root._customHeaderScheduleScroll = scheduleScrollUpdate;

    window.addEventListener('scroll', scheduleScrollUpdate, { passive: true });

    var onMediaChange = function () {
      if (!mediaMobile.matches) {
        closeAllMobilePanels();
      }
      refreshCustomHeaderMetrics(root);
      refreshHeaderGroupMeasurements(root);
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
      }
    };
    document.addEventListener('keydown', onGlobalKeydown);

    var onDialogOpen = function () {
      prevScrollTop = getScrollTop();
      scrollAccum = 0;
    };
    var onDialogClose = function () {
      scrollAccum = 0;
      var sync = function () {
        prevScrollTop = getScrollTop();
        scheduleScrollUpdate();
      };
      sync();
      requestAnimationFrame(sync);
      window.setTimeout(sync, 80);
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
    if (topState(root) === 'transparent' && getScrollTop() > scrollTopEpsilon()) {
      applyHeaderState(root, 'hidden');
    }
    onScrollFrame();
    updateMobilePortalTopInset();

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
      if (overlay) {
        overlay.removeEventListener('click', onOverlayClick);
      }
      if (drawerClose) {
        drawerClose.removeEventListener('click', onDrawerCloseClick);
      }
      if (mobileTabList) {
        mobileTabList.removeEventListener('click', onMobileTabClick);
        mobileTabList.removeEventListener('keydown', onMobileTabListKeydown);
      }
      if (drawer) {
        drawer.removeEventListener('toggle', onMobileAccordionToggle, true);
      }
      closeAllMobilePanels();
      setScrollLock(false);
      unregisterDebugListener(root, 'init');
      root.dataset.customHeaderJs = '';
      delete root._customHeaderScheduleScroll;
      delete root._customHeaderCleanup;
    };

    /* Must be called AFTER root._customHeaderCleanup is assigned so the
     * search cleanup can safely chain onto it. */
    initDesktopSearchDeferred(root);
  }

  function initDesktopSearchDeferred(root) {
    var wrap = root.querySelector('[data-custom-header-search-wrap]');
    if (!wrap || wrap.dataset.customHeaderSearchState === 'initialized') {
      return;
    }

    var cleanupRegistered = false;

    function cleanupDeferredInit() {
      wrap.removeEventListener('focusin', initNow);
      wrap.removeEventListener('pointerenter', initNow);
      wrap.removeEventListener('touchstart', initNow);
    }

    function initNow() {
      if (wrap.dataset.customHeaderSearchState === 'initialized') {
        cleanupDeferredInit();
        return;
      }
      cleanupDeferredInit();
      wrap.dataset.customHeaderSearchState = 'initialized';
      initDesktopSearch(root);
    }

    wrap.addEventListener('focusin', initNow, { once: true });
    wrap.addEventListener('pointerenter', initNow, { once: true });
    wrap.addEventListener('touchstart', initNow, { once: true, passive: true });

    if (!cleanupRegistered) {
      cleanupRegistered = true;
      var prevCleanup = root._customHeaderCleanup;
      root._customHeaderCleanup = function () {
        cleanupDeferredInit();
        wrap.dataset.customHeaderSearchState = '';
        if (typeof prevCleanup === 'function') { prevCleanup(); }
      };
    }
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

  var CH_TYPING_CHAR_MS = 72;
  var CH_TYPING_PAUSE_MS = 2400;

  /**
   * Homepage-only typewriter overlay for the desktop search field (theme editor
   * copy in data-typing-phrase). Native placeholders cannot animate.
   */
  function initHomepageSearchTyping(wrap, form, input) {
    var overlay = wrap.querySelector('[data-custom-header-search-typing]');
    if (!overlay || wrap.getAttribute('data-homepage-search-typing') !== 'true') {
      return function () {};
    }
    var phrase = wrap.getAttribute('data-typing-phrase') || '';
    var loopTyping = wrap.getAttribute('data-typing-loop') !== 'false';
    if (!phrase) {
      return function () {};
    }

    var pos = 0;
    var timer = null;
    var hasCompletedOnce = false;

    function clearTypingTimer() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function shouldRun() {
      if (document.hidden) {
        return false;
      }
      if (form.classList.contains('custom-header__desktop-search-form--has-query')) {
        return false;
      }
      try {
        if (form.matches(':focus-within')) {
          return false;
        }
      } catch (e) {
        return false;
      }
      return true;
    }

    function tick() {
      clearTypingTimer();
      if (!shouldRun()) {
        return;
      }
      if (pos < phrase.length) {
        pos += 1;
        overlay.textContent = phrase.slice(0, pos);
        timer = setTimeout(tick, CH_TYPING_CHAR_MS);
        return;
      }
      hasCompletedOnce = true;
      overlay.textContent = phrase;
      if (!loopTyping) {
        return;
      }
      timer = setTimeout(function () {
        pos = 0;
        overlay.textContent = '';
        tick();
      }, CH_TYPING_PAUSE_MS);
    }

    function onTypingBlur() {
      form.classList.toggle('custom-header__desktop-search-form--has-query', !!input.value.trim());
      if (!input.value.trim()) {
        if (!loopTyping && hasCompletedOnce) {
          pos = phrase.length;
          clearTypingTimer();
          overlay.textContent = phrase;
          return;
        }
        pos = 0;
        clearTypingTimer();
        overlay.textContent = '';
        tick();
      }
    }

    function onVisibilityChange() {
      if (document.hidden) {
        clearTypingTimer();
        return;
      }
      if (!input.value.trim()) {
        if (!loopTyping && hasCompletedOnce) {
          pos = phrase.length;
          overlay.textContent = phrase;
          return;
        }
        pos = 0;
        clearTypingTimer();
        overlay.textContent = '';
        tick();
      }
    }

    input.addEventListener('focus', clearTypingTimer);
    input.addEventListener('blur', onTypingBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);

    form.classList.toggle('custom-header__desktop-search-form--has-query', !!input.value.trim());
    tick();

    return function cleanupHomepageTyping() {
      clearTypingTimer();
      input.removeEventListener('focus', clearTypingTimer);
      input.removeEventListener('blur', onTypingBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      overlay.textContent = '';
    };
  }

  function initDesktopSearch(root) {
    var wrap = root.querySelector('[data-custom-header-search-wrap]');
    if (!wrap) { return; }
    var form = wrap.querySelector('[data-custom-header-search-form]');
    var input = wrap.querySelector('[data-custom-header-search-input]');
    var dropdown = wrap.querySelector('[data-custom-header-search-dropdown]');
    if (!form || !input || !dropdown) { return; }

    var cleanupTyping = initHomepageSearchTyping(wrap, form, input);

    var debTimer = null;
    var activeSearchController = null;
    var resultCache = new Map();
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
    function closeDesktopMegaMenusForSearch() {
      root.querySelectorAll('header-menu').forEach(function (hm) {
        if (typeof hm.closeSubmenusForSearchOverlay === 'function') {
          hm.closeSubmenusForSearchOverlay();
        }
      });
    }

    function open(html) {
      closeDesktopMegaMenusForSearch();
      dropdown.innerHTML = html;
      dropdown.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      currentFocusIdx = -1;
      focusableItems = Array.from(dropdown.querySelectorAll('[data-ch-focusable]'));
      bindInternalEvents();
    }

    function close() {
      if (activeSearchController) {
        activeSearchController.abort();
        activeSearchController = null;
      }
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
      if (resultCache.has(q)) {
        renderResults(resultCache.get(q).queries || [], resultCache.get(q).products || [], q);
        return;
      }

      if (activeSearchController) {
        activeSearchController.abort();
      }
      activeSearchController = new AbortController();

      open('<div class="ch-search-loading">Searching\u2026</div>');
      var predictiveSearchPath = '/search/suggest.json';
      if (window.Shopify && Shopify.routes && Shopify.routes.root) {
        predictiveSearchPath = Shopify.routes.root + 'search/suggest.json';
      }
      var url = new URL(predictiveSearchPath, location.origin);
      url.searchParams.set('q', q);
      url.searchParams.set('resources[type]', 'product,query');
      url.searchParams.set('resources[limit]', '6');
      url.searchParams.set('resources[limit_scope]', 'each');
      url.searchParams.set('resources[options][unavailable_products]', 'last');

      fetch(url.toString(), { signal: activeSearchController.signal })
        .then(function (r) {
          if (!r.ok) {
            var err = new Error('Predictive search request failed');
            err.status = r.status;
            err.retryAfter = parseFloat(r.headers.get('Retry-After') || '0');
            throw err;
          }
          return r.json();
        })
        .then(function (data) {
          activeSearchController = null;
          if (input.value.trim() !== q) { return; }
          var r = (data.resources && data.resources.results) || {};
          resultCache.set(q, { queries: r.queries || [], products: r.products || [] });
          renderResults(r.queries || [], r.products || [], q);
        })
        .catch(function (error) {
          if (error && error.name === 'AbortError') { return; }
          activeSearchController = null;
          if (input.value.trim() !== q) { return; }
          var message = 'Could not load results. ';
          if (error && error.status === 429) {
            message = 'Too many requests. ';
          }
          open('<div class="ch-search-empty">' + message + '<a href="/search?q=' + encodeURIComponent(q) + '&type=product">Try the search page</a></div>');
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
      if (form.classList.contains('custom-header__desktop-search-form--typing')) {
        form.classList.toggle('custom-header__desktop-search-form--has-query', !!input.value.trim());
      }
      clearTimeout(debTimer);
      var q = input.value.trim();
      currentFocusIdx = -1;
      if (!q) { renderEmpty(); return; }
      if (q.length < 2) { close(); return; }
      debTimer = setTimeout(function () {
        if (input.value.trim() === q) { fetchSearch(q); }
      }, 320);
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
      if (typeof cleanupTyping === 'function') {
        cleanupTyping();
      }
      input.removeEventListener('keydown', onKeydown);
      input.removeEventListener('input', onInputEvent);
      input.removeEventListener('focus', onFocus);
      document.removeEventListener('click', onDocClick);
      clearTimeout(debTimer);
      if (activeSearchController) {
        activeSearchController.abort();
        activeSearchController = null;
      }
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
    scheduleNonCriticalTask(function () {
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
    });
  }());

  var headerGroupResizeObserver = null;

  function initAll() {
    var roots = document.querySelectorAll('[data-custom-header]');
    roots.forEach(function (root) {
      initCustomHeader(root);
    });
    if (roots[0]) {
      updateAnnouncementBarHeight(roots[0]);
    } else {
      updateAnnouncementBarHeight();
    }
    var hg = document.querySelector('#header-group');
    if (hg && !headerGroupResizeObserver) {
      headerGroupResizeObserver = new ResizeObserver(function () {
        document.querySelectorAll('[data-custom-header]').forEach(function (r) {
          refreshCustomHeaderMetrics(r);
          refreshHeaderGroupMeasurements(r);
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
      var root = id ? findCustomHeaderRoot(id) : null;
      if (root) {
        if (typeof root._customHeaderCleanup === 'function') {
          root._customHeaderCleanup();
        }
        initCustomHeader(root);
      }
      updateAnnouncementBarHeight(root);
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
    requestAnimationFrame(function () {
      updateAnnouncementBarHeight();
    });
  });
})();
