(function () {
  'use strict';

  /**
   * @type {Window & {
   *   __productStoryScrollListeners?: boolean,
   *   productStoryScrollInit?: () => void
   * }}
   */
  var win = window;

  var SEL = {
    section: '.product-story-scroll--curtain',
    scrolly: '[data-product-story-scrolly]',
    panel: '[data-product-story-panel]',
  };

  /**
   * @param {ParentNode} root
   * @param {string} selector
   * @returns {HTMLElement[]}
   */
  function queryAllHtml(root, selector) {
    var list = root.querySelectorAll(selector);
    /** @type {HTMLElement[]} */
    var out = [];
    for (var q = 0; q < list.length; q++) {
      var el = list[q];
      if (el instanceof HTMLElement) {
        out.push(el);
      }
    }
    return out;
  }

  var MQ_DESKTOP = '(min-width: 750px)';
  var MQ_REDUCE = '(prefers-reduced-motion: reduce)';

  /** Fraction of each transition spent on the curtain; then new copy is revealed. */
  var CURTAIN_END = 0.42;

  /** Keep the first story fully visible for a short scroll before the second curtain starts. */
  var INTRO_HOLD_RATIO = 0;
  var INTRO_HOLD_MAX = 0;

  /** Lerp factor for curtain inset only (copy switches instantly when the phase changes). */
  var LERP_INSET = 0.11;

  var SNAP_INSET = 0.03;

  /** @type {WeakMap<HTMLElement, () => void>} */
  var cleanups = new WeakMap();

  /**
   * @param {number} v
   * @param {number} min
   * @param {number} max
   */
  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  /**
   * @param {number} a
   * @param {number} b
   * @param {number} t
   */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * @param {number} t
   */
  function smoothstep(t) {
    var x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
  }

  /**
   * @param {HTMLElement} section
   * @param {string} property
   * @param {number} fallback
   * @returns {number}
   */
  function getSectionPx(section, property, fallback) {
    if (property === '--product-story-effective-top') {
      return getSectionPx(section, '--product-story-sticky-top', fallback) + getSectionPx(section, '--product-story-sticky-gap', 12);
    }

    var raw = getComputedStyle(section).getPropertyValue(property).trim();
    var value = parseFloat(raw);
    if (!isNaN(value)) return value;

    if (property === '--product-story-sticky-top') {
      var bodyStyles = getComputedStyle(document.body);
      var headerGroupHeight = parseFloat(bodyStyles.getPropertyValue('--header-group-height').trim());
      if (!isNaN(headerGroupHeight)) return headerGroupHeight;

      var headerHeight = parseFloat(bodyStyles.getPropertyValue('--header-height').trim());
      if (!isNaN(headerHeight)) return headerHeight;
    }

    return isNaN(value) ? fallback : value;
  }

  /**
   * Scroll progress 0→1 when the user moves through the scrolly region.
   * Progress starts only after the sticky stage has reached the header offset,
   * then waits through a short hold before transitions begin.
   *
   * @param {HTMLElement} scrolly
   * @param {HTMLElement} section
   */
  function getScrollProgress(scrolly, section) {
    var rect = scrolly.getBoundingClientRect();
    var vh = win.innerHeight;
    var stickyTop = Math.max(0, getSectionPx(section, '--product-story-effective-top', 0));
    var visibleHeight = Math.max(1, vh - stickyTop);
    var total = Math.max(1, scrolly.offsetHeight - visibleHeight);
    if (total <= 0) return 0;

    var past = stickyTop - rect.top;
    if (past < 0) return 0;

    return clamp(past / total, 0, 1);
  }

  /**
   * @param {HTMLElement} section
   * @param {boolean} useSmoothing
   * @param {{
   *   inset: number | null,
   *   lastKey: string
   * }} state
   */
  function applyFrame(section, useSmoothing, state) {
    if (!win.matchMedia(MQ_DESKTOP).matches || win.matchMedia(MQ_REDUCE).matches) {
      resetPanels(section);
      return;
    }

    var scrolly = section.querySelector(SEL.scrolly);
    if (!(scrolly instanceof HTMLElement)) return;

    var panels = queryAllHtml(section, SEL.panel);
    var count = panels.length;
    if (count === 0) return;

    var progress = getScrollProgress(scrolly, section);

    if (count === 1) {
      var only = panels[0];
      if (!only) return;
      only.classList.add('is-active');
      only.classList.remove('is-past');
      only.classList.remove('is-future');
      only.classList.remove('is-stacked');
      only.classList.remove('is-copy-revealed');
      only.style.setProperty('--story-curtain-inset-top', '0%');
      only.style.setProperty('--story-copy-opacity', '1');
      only.style.setProperty('--story-copy-bg-opacity', '1');
      only.style.removeProperty('--story-past-copy-opacity');
      only.style.removeProperty('--story-past-copy-bg-opacity');
      only.style.removeProperty('z-index');
      only.setAttribute('aria-hidden', 'false');
      state.inset = null;
      state.lastKey = '';
      return;
    }

    var transitions = count - 1;

    if (progress <= 0.00001) {
      for (var b = 0; b < count; b++) {
        var pb = panels[b];
        if (pb === undefined) continue;
        var onlyFirst = b === 0;
        pb.classList.toggle('is-active', onlyFirst);
        pb.classList.toggle('is-past', false);
        pb.classList.toggle('is-future', b > 0);
        pb.classList.toggle('is-stacked', false);
        pb.classList.toggle('is-copy-revealed', onlyFirst);
        pb.style.setProperty('--story-curtain-inset-top', '0%');
        pb.style.setProperty('--story-copy-opacity', '1');
        pb.style.setProperty('--story-copy-bg-opacity', '1');
        pb.style.removeProperty('--story-past-copy-opacity');
        pb.style.removeProperty('--story-past-copy-bg-opacity');
        pb.style.setProperty('z-index', String(onlyFirst ? 20 : 0));
        pb.setAttribute('aria-hidden', onlyFirst ? 'false' : 'true');
      }
      state.inset = 0;
      state.lastKey = 'start';
      return;
    }

    var segFloat = progress * transitions;
    var ti = Math.min(Math.floor(segFloat), transitions - 1);
    var t = clamp(segFloat - ti, 0, 0.999999);
    var enteringIndex = ti + 1;

    var curtainP = t < CURTAIN_END ? t / CURTAIN_END : 1;
    var insetTarget = (1 - curtainP) * 100;

    var segmentKey = String(ti) + ':' + String(enteringIndex);
    if (state.lastKey !== segmentKey) {
      state.inset = insetTarget;
      state.lastKey = segmentKey;
    }

    var insetApply = insetTarget;

    if (useSmoothing && state.inset !== null) {
      insetApply = lerp(state.inset, insetTarget, LERP_INSET);
      if (Math.abs(insetApply - insetTarget) < SNAP_INSET) insetApply = insetTarget;
      state.inset = insetApply;
    } else {
      state.inset = insetTarget;
      insetApply = insetTarget;
    }

    var copyPhase = insetApply <= 2.25 && t > CURTAIN_END ? smoothstep((t - CURTAIN_END) / (1 - CURTAIN_END)) : 0;
    var coverPhase = Math.min(1, copyPhase * 2.4);
    var enteringCopyOpacity = copyPhase;
    var enteringCopyBgOpacity = coverPhase;
    var copyRevealed = copyPhase >= 0.995;

    for (var i = 0; i < count; i++) {
      var panel = panels[i];
      if (panel === undefined) continue;
      var isPast = i < enteringIndex;
      var isEntering = i === enteringIndex;
      var isFuture = i > enteringIndex;
      var isImmediatePrevious = i === enteringIndex - 1;

      panel.classList.toggle('is-past', isPast);
      panel.classList.toggle('is-active', isEntering);
      panel.classList.toggle('is-future', isFuture);

      if (isEntering) {
        panel.classList.toggle('is-stacked', enteringIndex >= 1);
        panel.classList.toggle('is-copy-revealed', copyRevealed);
        panel.style.setProperty('--story-curtain-inset-top', insetApply.toFixed(2) + '%');
        panel.style.setProperty('--story-copy-opacity', enteringCopyOpacity.toFixed(3));
        panel.style.setProperty('--story-copy-bg-opacity', enteringCopyBgOpacity.toFixed(3));
        panel.style.removeProperty('--story-past-copy-opacity');
        panel.style.removeProperty('--story-past-copy-bg-opacity');
        panel.style.setProperty('z-index', String(40 + enteringIndex));
        panel.setAttribute('aria-hidden', 'false');
      } else if (isPast) {
        panel.classList.remove('is-stacked');
        panel.classList.remove('is-copy-revealed');
        panel.style.setProperty('--story-curtain-inset-top', '0%');
        panel.style.setProperty('--story-copy-opacity', '1');
        panel.style.setProperty('--story-copy-bg-opacity', '1');
        panel.style.setProperty('--story-past-copy-opacity', isImmediatePrevious ? (1 - coverPhase).toFixed(3) : '0');
        panel.style.setProperty('--story-past-copy-bg-opacity', isImmediatePrevious ? '1' : '0');
        panel.style.setProperty('z-index', String(10 + i));
        panel.setAttribute('aria-hidden', 'true');
      } else {
        panel.classList.remove('is-stacked');
        panel.classList.remove('is-copy-revealed');
        panel.style.removeProperty('--story-curtain-inset-top');
        panel.style.removeProperty('--story-copy-opacity');
        panel.style.removeProperty('--story-copy-bg-opacity');
        panel.style.removeProperty('--story-past-copy-opacity');
        panel.style.removeProperty('--story-past-copy-bg-opacity');
        panel.style.setProperty('z-index', '0');
        panel.setAttribute('aria-hidden', 'true');
      }
    }
  }

  /**
   * @param {HTMLElement} section
   * @returns {() => void}
   */
  function bind(section) {
    var scrolly = section.querySelector(SEL.scrolly);
    if (!(scrolly instanceof HTMLElement)) return function () {};

    /** @type {{ inset: number | null, lastKey: string }} */
    var smoothState = {
      inset: null,
      lastKey: '',
    };

    var rafScroll = 0;
    var mqDesktop = win.matchMedia(MQ_DESKTOP);
    var mqReduce = win.matchMedia(MQ_REDUCE);

    function prefersReducedMotion() {
      return mqReduce.matches;
    }

    function tickScroll() {
      rafScroll = 0;
      applyFrame(section, !prefersReducedMotion(), smoothState);
    }

    function onScroll() {
      if (!rafScroll) {
        rafScroll = win.requestAnimationFrame(tickScroll);
      }
    }

    function onResize() {
      onScroll();
    }

    function onMediaChange() {
      if (!mqDesktop.matches || mqReduce.matches) {
        resetPanels(section);
        smoothState.inset = null;
        smoothState.lastKey = '';
      } else {
        applyFrame(section, false, smoothState);
      }
    }

    win.addEventListener('scroll', onScroll, { passive: true });
    win.addEventListener('resize', onResize, { passive: true });
    mqDesktop.addEventListener('change', onMediaChange);
    mqReduce.addEventListener('change', onMediaChange);

    applyFrame(section, !prefersReducedMotion(), smoothState);

    return function () {
      win.removeEventListener('scroll', onScroll);
      win.removeEventListener('resize', onResize);
      mqDesktop.removeEventListener('change', onMediaChange);
      mqReduce.removeEventListener('change', onMediaChange);
      if (rafScroll) win.cancelAnimationFrame(rafScroll);
      resetPanels(section);
    };
  }

  /**
   * @param {HTMLElement} section
   */
  function resetPanels(section) {
    var panels = queryAllHtml(section, SEL.panel);
    for (var i = 0; i < panels.length; i++) {
      var panel = panels[i];
      if (panel === undefined) continue;
      panel.style.removeProperty('--story-curtain-inset-top');
      panel.style.removeProperty('--story-copy-opacity');
      panel.style.removeProperty('--story-copy-bg-opacity');
      panel.style.removeProperty('z-index');
      panel.removeAttribute('aria-hidden');
      panel.classList.remove('is-past');
      panel.classList.remove('is-future');
      panel.classList.remove('is-stacked');
      panel.classList.remove('is-copy-revealed');
    }
  }

  /**
   * @param {ParentNode} [root]
   */
  function initAll(root) {
    var scope = root || document;
    var sections = scope.querySelectorAll(SEL.section);
    for (var i = 0; i < sections.length; i++) {
      var section = sections[i];
      if (!(section instanceof HTMLElement)) continue;

      var prev = cleanups.get(section);
      if (prev) prev();

      var teardown = bind(section);
      cleanups.set(section, teardown);
    }
  }

  /**
   * @param {HTMLElement} section
   */
  function destroy(section) {
    var fn = cleanups.get(section);
    if (fn) {
      fn();
      cleanups.delete(section);
    }
  }

  function attachDocumentListeners() {
    document.addEventListener('DOMContentLoaded', function () {
      initAll(document);
    });

    document.addEventListener('shopify:section:load', function (event) {
      var target = event.target;
      if (target instanceof Element) {
        initAll(target);
      }
    });

    document.addEventListener('shopify:section:unload', function (event) {
      var t = event.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.matches(SEL.section)) {
        destroy(t);
        return;
      }
      var inner = t.querySelector(SEL.section);
      if (inner instanceof HTMLElement) {
        destroy(inner);
      }
    });
  }

  if (!win.__productStoryScrollListeners) {
    win.__productStoryScrollListeners = true;
    attachDocumentListeners();
  } else {
    initAll(document);
  }

  win.productStoryScrollInit = function () {
    initAll(document);
  };
})();
