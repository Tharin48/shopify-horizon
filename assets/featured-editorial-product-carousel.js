(function () {
  'use strict';

  /**
   * @typedef {{
   *   initAll: (container?: ParentNode | Document) => void,
   *   destroy: (root: HTMLElement) => void
   * }} CarouselApi
   */

  /** @type {Window & { FeaturedEditorialProductCarousel?: CarouselApi }} */
  var globalWindow = window;

  if (globalWindow.FeaturedEditorialProductCarousel) {
    globalWindow.FeaturedEditorialProductCarousel.initAll(document);
    return;
  }

  var selectors = {
    root: '[data-featured-editorial-carousel]',
    viewport: '[data-carousel-viewport]',
    prev: '[data-carousel-prev]',
    next: '[data-carousel-next]',
    card: '[data-product-card]',
  };

  var instances = new WeakMap();
  var DESKTOP_MEDIA = '(min-width: 990px)';

  /**
   * @param {MediaQueryList} mediaQueryList
   * @param {(event: MediaQueryListEvent) => void} handler
   */
  function addMediaListener(mediaQueryList, handler) {
    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handler);
      return;
    }

    if (typeof mediaQueryList.addListener === 'function') {
      mediaQueryList.addListener(handler);
    }
  }

  /**
   * @param {MediaQueryList} mediaQueryList
   * @param {(event: MediaQueryListEvent) => void} handler
   */
  function removeMediaListener(mediaQueryList, handler) {
    if (typeof mediaQueryList.removeEventListener === 'function') {
      mediaQueryList.removeEventListener('change', handler);
      return;
    }

    if (typeof mediaQueryList.removeListener === 'function') {
      mediaQueryList.removeListener(handler);
    }
  }

  /**
   * @param {HTMLElement} root
   * @returns {HTMLElement[]}
   */
  function getCards(root) {
    return Array.from(root.querySelectorAll(selectors.card));
  }

  /**
   * @param {HTMLElement} root
   * @param {HTMLElement} viewport
   * @returns {number[]}
   */
  function getScrollTargets(root, viewport) {
    var viewportRect = viewport.getBoundingClientRect();

    return getCards(root).map(function (card) {
      var cardRect = card.getBoundingClientRect();
      return Math.max(0, cardRect.left - viewportRect.left + viewport.scrollLeft);
    });
  }

  /**
   * @param {HTMLElement} root
   */
  function updateButtons(root) {
    var instance = instances.get(root);
    if (!instance) return;

    var viewport = instance.viewport;
    var prev = instance.prevButton;
    var next = instance.nextButton;

    if (!viewport || !prev || !next) return;

    var desktopMode = instance.media.matches;
    var maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    var hasOverflow = maxScroll > 4;

    if (!desktopMode || !hasOverflow) {
      prev.disabled = true;
      next.disabled = true;
      return;
    }

    prev.disabled = viewport.scrollLeft <= 4;
    next.disabled = viewport.scrollLeft >= maxScroll - 4;
  }

  /**
   * @param {HTMLElement} root
   * @param {number} direction
   */
  function scrollToCard(root, direction) {
    var instance = instances.get(root);
    if (!instance || !instance.viewport || !instance.media.matches) return;

    var viewport = instance.viewport;
    var targets = getScrollTargets(root, viewport);
    if (!targets.length) return;

    var current = viewport.scrollLeft;
    var maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    var target = current;

    if (direction > 0) {
      for (var i = 0; i < targets.length; i += 1) {
        var nextTarget = targets[i];
        if (typeof nextTarget === 'number' && nextTarget > current + 8) {
          target = nextTarget;
          break;
        }
      }
      if (target === current) {
        target = targets[targets.length - 1];
      }
    } else {
      target = 0;
      for (var j = targets.length - 1; j >= 0; j -= 1) {
        var prevTarget = targets[j];
        if (typeof prevTarget === 'number' && prevTarget < current - 8) {
          target = prevTarget;
          break;
        }
      }
    }

    target = Math.max(0, Math.min(maxScroll, target));
    viewport.scrollTo({ left: target, behavior: 'smooth' });
  }

  /**
   * @param {HTMLElement} root
   */
  function destroy(root) {
    var instance = instances.get(root);
    if (!instance) return;

    instance.viewport.removeEventListener('scroll', instance.handleScroll);
    instance.prevButton.removeEventListener('click', instance.handlePrev);
    instance.nextButton.removeEventListener('click', instance.handleNext);
    removeMediaListener(instance.media, instance.handleMediaChange);

    if (instance.resizeObserver) {
      instance.resizeObserver.disconnect();
    } else {
      window.removeEventListener('resize', instance.handleResize);
    }
    if (instance.scrollRaf) {
      window.cancelAnimationFrame(instance.scrollRaf);
    }

    root.removeAttribute('data-featured-editorial-carousel-initialized');
    instances.delete(root);
  }

  /**
   * @param {HTMLElement} root
   */
  function init(root) {
    if (!root || root.getAttribute('data-featured-editorial-carousel-initialized') === 'true') {
      return;
    }

    var viewport = root.querySelector(selectors.viewport);
    var prevButton = root.querySelector(selectors.prev);
    var nextButton = root.querySelector(selectors.next);

    if (!viewport || !prevButton || !nextButton) {
      return;
    }

    var media = window.matchMedia(DESKTOP_MEDIA);
    var handleScroll = function () {
      var state = instances.get(root);
      if (!state) return;

      if (state.scrollRaf) return;
      state.scrollRaf = window.requestAnimationFrame(function () {
        var latest = instances.get(root);
        if (!latest) return;

        latest.scrollRaf = 0;
        updateButtons(root);
      });
    };
    var handlePrev = function () {
      scrollToCard(root, -1);
    };
    var handleNext = function () {
      scrollToCard(root, 1);
    };
    var handleResize = function () {
      updateButtons(root);
    };
    var handleMediaChange = function () {
      updateButtons(root);
    };

    var resizeObserver = null;
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(function () {
        updateButtons(root);
      });
      resizeObserver.observe(viewport);
    } else {
      window.addEventListener('resize', handleResize);
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    prevButton.addEventListener('click', handlePrev);
    nextButton.addEventListener('click', handleNext);
    addMediaListener(media, handleMediaChange);

    instances.set(root, {
      viewport: viewport,
      prevButton: prevButton,
      nextButton: nextButton,
      media: media,
      resizeObserver: resizeObserver,
      handleScroll: handleScroll,
      handlePrev: handlePrev,
      handleNext: handleNext,
      handleResize: handleResize,
      handleMediaChange: handleMediaChange,
      scrollRaf: 0,
    });

    root.setAttribute('data-featured-editorial-carousel-initialized', 'true');
    updateButtons(root);
  }

  /**
   * @param {ParentNode | Document} [container]
   */
  function initAll(container) {
    (container || document).querySelectorAll(selectors.root).forEach(function (root) {
      if (root instanceof HTMLElement) {
        init(root);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initAll(document);
  });

  document.addEventListener('shopify:section:load', function (event) {
    if (event.target instanceof HTMLElement) {
      initAll(event.target);
    }
  });

  document.addEventListener('shopify:section:unload', function (event) {
    if (!(event.target instanceof HTMLElement)) return;

    event.target.querySelectorAll(selectors.root).forEach(function (root) {
      if (root instanceof HTMLElement) {
        destroy(root);
      }
    });
  });

  globalWindow.FeaturedEditorialProductCarousel = {
    initAll: initAll,
    destroy: destroy,
  };

  initAll(document);
})();
