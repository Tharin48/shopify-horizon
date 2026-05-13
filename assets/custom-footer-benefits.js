(function () {
  'use strict';

  /**
   * @typedef {{
   *   root: HTMLElement,
   *   viewport: HTMLElement,
   *   track: HTMLElement,
   *   slides: HTMLElement[],
   *   prevButton: HTMLButtonElement | null,
   *   nextButton: HTMLButtonElement | null,
   *   media: MediaQueryList,
   *   mediaHandler: (event: MediaQueryListEvent) => void,
   *   resizeHandler: () => void,
   *   prevHandler: () => void,
   *   nextHandler: () => void,
   *   interactionHandler: () => void,
   *   currentIndex: number,
   *   autoplayTimer: number | null,
   *   autoplayPausedByInteraction: boolean,
   *   mobileSliderEnabled: boolean,
   *   autoplayEnabled: boolean,
   *   autoplaySpeed: number,
   *   showArrowsMobile: boolean,
   *   isHomepage: boolean,
   *   hidePreviousSectionOnHomepage: boolean,
   *   previousSection: HTMLElement | null,
   *   touchStartX: number | null,
   *   touchDeltaX: number,
   *   touchStartHandler: (event: TouchEvent) => void,
   *   touchMoveHandler: (event: TouchEvent) => void,
   *   touchEndHandler: () => void
   * }} BenefitsInstance
   */

  /** @type {Window & { CustomFooterBenefits?: { initAll: (container?: ParentNode | Document) => void, destroy: (root: HTMLElement) => void } }} */
  var globalWindow = window;

  if (globalWindow.CustomFooterBenefits) {
    globalWindow.CustomFooterBenefits.initAll(document);
    return;
  }

  var DESKTOP_MEDIA = '(min-width: 990px)';
  var selectors = {
    root: '[data-custom-footer-benefits]',
    viewport: '[data-benefits-viewport]',
    track: '[data-benefits-track]',
    slide: '[data-benefit-slide]',
    prev: '[data-benefits-prev]',
    next: '[data-benefits-next]',
  };

  var prefersReducedMotion = globalWindow.matchMedia('(prefers-reduced-motion: reduce)');
  var instances = new WeakMap();

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
   * @param {BenefitsInstance} instance
   * @returns {boolean}
   */
  function isMobileSliderActive(instance) {
    return !instance.media.matches && instance.mobileSliderEnabled && instance.slides.length > 1;
  }

  /**
   * @param {HTMLElement} root
   * @returns {HTMLElement | null}
   */
  function findPreviousSection(root) {
    var wrapper = root.closest('.shopify-section');
    if (!(wrapper instanceof HTMLElement)) return null;

    var sibling = wrapper.previousElementSibling;
    while (sibling) {
      if (sibling instanceof HTMLElement && sibling.classList.contains('shopify-section')) {
        return sibling;
      }

      sibling = sibling.previousElementSibling;
    }

    return null;
  }

  /**
   * @param {BenefitsInstance} instance
   * @param {boolean} shouldHide
   */
  function updatePreviousSectionVisibility(instance, shouldHide) {
    if (!instance.previousSection) return;

    if (shouldHide) {
      if (!instance.previousSection.hasAttribute('data-custom-footer-benefits-original-hidden')) {
        instance.previousSection.setAttribute(
          'data-custom-footer-benefits-original-hidden',
          instance.previousSection.hidden ? 'true' : 'false'
        );
      }

      instance.previousSection.hidden = true;
      instance.previousSection.setAttribute('data-custom-footer-benefits-hidden-by-homepage-toggle', 'true');
      return;
    }

    if (!instance.previousSection.hasAttribute('data-custom-footer-benefits-hidden-by-homepage-toggle')) return;

    instance.previousSection.hidden =
      instance.previousSection.getAttribute('data-custom-footer-benefits-original-hidden') === 'true';
    instance.previousSection.removeAttribute('data-custom-footer-benefits-hidden-by-homepage-toggle');
    instance.previousSection.removeAttribute('data-custom-footer-benefits-original-hidden');
  }

  /**
   * @param {BenefitsInstance} instance
   */
  function stopAutoplay(instance) {
    if (instance.autoplayTimer) {
      globalWindow.clearInterval(instance.autoplayTimer);
      instance.autoplayTimer = null;
    }
  }

  /**
   * @param {BenefitsInstance} instance
   */
  function update(instance) {
    var sliderActive = isMobileSliderActive(instance);
    var hasMultipleSlides = instance.slides.length > 1;

    if (sliderActive) {
      instance.root.removeAttribute('data-mobile-slider-disabled');
    } else {
      instance.root.setAttribute('data-mobile-slider-disabled', '');
    }

    if (sliderActive) {
      instance.track.style.transform = 'translate3d(' + (instance.currentIndex * -100) + '%, 0, 0)';
    } else {
      instance.track.style.transform = '';
      instance.currentIndex = 0;
    }

    instance.slides.forEach(function (slide, index) {
      var active = !sliderActive || index === instance.currentIndex;
      slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      slide.toggleAttribute('data-active', active);
    });

    var showArrows = sliderActive && instance.showArrowsMobile && hasMultipleSlides;
    if (instance.prevButton) instance.prevButton.hidden = !showArrows;
    if (instance.nextButton) instance.nextButton.hidden = !showArrows;
  }

  /**
   * @param {BenefitsInstance} instance
   * @param {number} index
   */
  function goTo(instance, index) {
    if (!instance.slides.length) return;

    var slideCount = instance.slides.length;
    var normalized = ((index % slideCount) + slideCount) % slideCount;
    instance.currentIndex = normalized;
    update(instance);
  }

  /**
   * @param {BenefitsInstance} instance
   */
  function startAutoplay(instance) {
    stopAutoplay(instance);

    if (!isMobileSliderActive(instance)) return;
    if (!instance.autoplayEnabled) return;
    if (instance.autoplayPausedByInteraction) return;
    if (instance.slides.length <= 1) return;
    if (prefersReducedMotion.matches) return;

    instance.autoplayTimer = globalWindow.setInterval(function () {
      goTo(instance, instance.currentIndex + 1);
    }, instance.autoplaySpeed);
  }

  /**
   * @param {BenefitsInstance} instance
   */
  function refresh(instance) {
    update(instance);
    startAutoplay(instance);
  }

  /**
   * @param {HTMLElement} root
   */
  function destroy(root) {
    var instance = instances.get(root);
    if (!instance) return;

    updatePreviousSectionVisibility(instance, false);
    stopAutoplay(instance);
    removeMediaListener(instance.media, instance.mediaHandler);
    if (instance.prevButton) instance.prevButton.removeEventListener('click', instance.prevHandler);
    if (instance.nextButton) instance.nextButton.removeEventListener('click', instance.nextHandler);
    root.removeEventListener('pointerdown', instance.interactionHandler);
    instance.viewport.removeEventListener('touchstart', instance.touchStartHandler);
    instance.viewport.removeEventListener('touchmove', instance.touchMoveHandler);
    instance.viewport.removeEventListener('touchend', instance.touchEndHandler);
    globalWindow.removeEventListener('resize', instance.resizeHandler);
    root.removeAttribute('data-custom-footer-benefits-initialized');
    instances.delete(root);
  }

  /**
   * @param {HTMLElement} root
   */
  function init(root) {
    if (!root || root.getAttribute('data-custom-footer-benefits-initialized') === 'true') return;

    var viewport = root.querySelector(selectors.viewport);
    var track = root.querySelector(selectors.track);
    if (!(viewport instanceof HTMLElement) || !(track instanceof HTMLElement)) return;

    var slides = Array.from(root.querySelectorAll(selectors.slide)).filter(function (slide) {
      return slide instanceof HTMLElement;
    });
    if (!slides.length) return;

    var prevButton = root.querySelector(selectors.prev);
    var nextButton = root.querySelector(selectors.next);
    var media = globalWindow.matchMedia(DESKTOP_MEDIA);

    /** @type {BenefitsInstance} */
    var instance = {
      root: root,
      viewport: viewport,
      track: track,
      slides: slides,
      prevButton: prevButton instanceof HTMLButtonElement ? prevButton : null,
      nextButton: nextButton instanceof HTMLButtonElement ? nextButton : null,
      media: media,
      mediaHandler: function () {
        refresh(instance);
      },
      resizeHandler: function () {
        update(instance);
      },
      prevHandler: function () {
        instance.autoplayPausedByInteraction = true;
        stopAutoplay(instance);
        goTo(instance, instance.currentIndex - 1);
      },
      nextHandler: function () {
        instance.autoplayPausedByInteraction = true;
        stopAutoplay(instance);
        goTo(instance, instance.currentIndex + 1);
      },
      interactionHandler: function () {
        if (!isMobileSliderActive(instance)) return;
        instance.autoplayPausedByInteraction = true;
        stopAutoplay(instance);
      },
      currentIndex: 0,
      autoplayTimer: null,
      autoplayPausedByInteraction: false,
      mobileSliderEnabled: root.getAttribute('data-mobile-slider-enabled') === 'true',
      autoplayEnabled: root.getAttribute('data-autoplay-enabled') === 'true',
      autoplaySpeed: parseInt(root.getAttribute('data-autoplay-speed') || '4000', 10),
      showArrowsMobile: root.getAttribute('data-show-arrows-mobile') === 'true',
      isHomepage: root.getAttribute('data-is-homepage') === 'true',
      hidePreviousSectionOnHomepage: root.getAttribute('data-hide-previous-section-on-homepage') === 'true',
      previousSection: findPreviousSection(root),
      touchStartX: null,
      touchDeltaX: 0,
      touchStartHandler: function (event) {
        if (!isMobileSliderActive(instance)) return;
        if (!event.touches || !event.touches.length) return;
        instance.touchStartX = event.touches[0].clientX;
        instance.touchDeltaX = 0;
      },
      touchMoveHandler: function (event) {
        if (!isMobileSliderActive(instance)) return;
        if (instance.touchStartX === null || !event.touches || !event.touches.length) return;
        instance.touchDeltaX = event.touches[0].clientX - instance.touchStartX;
      },
      touchEndHandler: function () {
        if (!isMobileSliderActive(instance)) return;
        if (instance.touchStartX === null) return;

        if (Math.abs(instance.touchDeltaX) > 40) {
          instance.autoplayPausedByInteraction = true;
          stopAutoplay(instance);
          if (instance.touchDeltaX < 0) {
            goTo(instance, instance.currentIndex + 1);
          } else {
            goTo(instance, instance.currentIndex - 1);
          }
        } else {
          update(instance);
        }

        instance.touchStartX = null;
        instance.touchDeltaX = 0;
      },
    };

    if (instance.prevButton) instance.prevButton.addEventListener('click', instance.prevHandler);
    if (instance.nextButton) instance.nextButton.addEventListener('click', instance.nextHandler);
    root.addEventListener('pointerdown', instance.interactionHandler, { passive: true });
    viewport.addEventListener('touchstart', instance.touchStartHandler, { passive: true });
    viewport.addEventListener('touchmove', instance.touchMoveHandler, { passive: true });
    viewport.addEventListener('touchend', instance.touchEndHandler);
    addMediaListener(media, instance.mediaHandler);
    globalWindow.addEventListener('resize', instance.resizeHandler);

    instances.set(root, instance);
    root.setAttribute('data-custom-footer-benefits-initialized', 'true');
    updatePreviousSectionVisibility(
      instance,
      instance.isHomepage && instance.hidePreviousSectionOnHomepage
    );
    refresh(instance);
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

  document.addEventListener('shopify:section:select', function (event) {
    if (!(event.target instanceof HTMLElement)) return;

    initAll(event.target);
    event.target.querySelectorAll(selectors.root).forEach(function (root) {
      if (!(root instanceof HTMLElement)) return;
      var instance = instances.get(root);
      if (!instance) return;
      refresh(instance);
    });
  });

  document.addEventListener('shopify:section:unload', function (event) {
    if (!(event.target instanceof HTMLElement)) return;

    event.target.querySelectorAll(selectors.root).forEach(function (root) {
      if (root instanceof HTMLElement) {
        destroy(root);
      }
    });
  });

  document.addEventListener('shopify:block:select', function (event) {
    if (!(event.target instanceof HTMLElement)) return;

    var slide = event.target.closest(selectors.slide);
    if (!(slide instanceof HTMLElement)) return;

    var root = slide.closest(selectors.root);
    if (!(root instanceof HTMLElement)) return;

    var instance = instances.get(root);
    if (!instance) {
      init(root);
      instance = instances.get(root);
    }
    if (!instance) return;

    var index = instance.slides.indexOf(slide);
    if (index === -1) return;

    instance.autoplayPausedByInteraction = true;
    stopAutoplay(instance);
    goTo(instance, index);
  });

  globalWindow.CustomFooterBenefits = {
    initAll: initAll,
    destroy: destroy,
  };

  initAll(document);
})();
