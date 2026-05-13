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
    var prevButtons = instance.prevButtons;
    var nextButtons = instance.nextButtons;

    if (!viewport || !prevButtons.length || !nextButtons.length) return;

    var maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    var hasOverflow = maxScroll > 4;

    var disablePrev = !hasOverflow || viewport.scrollLeft <= 4;
    var disableNext = !hasOverflow || viewport.scrollLeft >= maxScroll - 4;

    prevButtons.forEach(function (button) {
      button.disabled = disablePrev;
    });
    nextButtons.forEach(function (button) {
      button.disabled = disableNext;
    });
  }

  /**
   * @param {HTMLElement} root
   * @param {number} direction
   */
  function scrollToCard(root, direction) {
    var instance = instances.get(root);
    if (!instance || !instance.viewport) return;

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
    instance.prevButtons.forEach(function (button) {
      button.removeEventListener('click', instance.handlePrev);
    });
    instance.nextButtons.forEach(function (button) {
      button.removeEventListener('click', instance.handleNext);
    });

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
    var prevButtons = Array.from(root.querySelectorAll(selectors.prev));
    var nextButtons = Array.from(root.querySelectorAll(selectors.next));

    if (!viewport || !prevButtons.length || !nextButtons.length) {
      return;
    }
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
    prevButtons.forEach(function (button) {
      button.addEventListener('click', handlePrev);
    });
    nextButtons.forEach(function (button) {
      button.addEventListener('click', handleNext);
    });

    instances.set(root, {
      viewport: viewport,
      prevButtons: prevButtons,
      nextButtons: nextButtons,
      resizeObserver: resizeObserver,
      handleScroll: handleScroll,
      handlePrev: handlePrev,
      handleNext: handleNext,
      handleResize: handleResize,
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
