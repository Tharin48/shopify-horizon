(function () {
  'use strict';

  /** @type {Window & { CustomBlogHeroSlider?: { initAll: (scope?: ParentNode | Document) => void } }} */
  var globalWindow = window;

  if (globalWindow.CustomBlogHeroSlider) {
    globalWindow.CustomBlogHeroSlider.initAll(document);
    return;
  }

  var selectors = {
    root: '[data-custom-blog-hero-slider]',
    viewport: '[data-blog-hero-viewport]',
    track: '[data-blog-hero-track]',
    slide: '[data-blog-hero-slide]',
    dot: '[data-blog-hero-dot]',
  };

  var instances = new WeakMap();

  function clampIndex(index, count) {
    if (count <= 0) return 0;
    if (index < 0) return count - 1;
    if (index >= count) return 0;
    return index;
  }

  function update(root, nextIndex) {
    var instance = instances.get(root);
    if (!instance) return;

    var count = instance.slides.length;
    if (!count) return;

    instance.index = clampIndex(nextIndex, count);
    instance.track.style.transform = 'translate3d(' + String(instance.index * -100) + '%, 0, 0)';

    for (var i = 0; i < instance.dots.length; i += 1) {
      var isActive = i === instance.index;
      instance.dots[i].classList.toggle('is-active', isActive);
      instance.dots[i].setAttribute('aria-current', isActive ? 'true' : 'false');
      instance.dots[i].setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
  }

  function stopAutoplay(root) {
    var instance = instances.get(root);
    if (!instance || !instance.timerId) return;

    window.clearInterval(instance.timerId);
    instance.timerId = 0;
  }

  function startAutoplay(root) {
    var instance = instances.get(root);
    if (!instance || !instance.autoplay || instance.slides.length < 2) return;

    stopAutoplay(root);
    instance.timerId = window.setInterval(function () {
      update(root, instance.index + 1);
    }, instance.autoplaySpeed);
  }

  function bindSwipe(root) {
    var instance = instances.get(root);
    if (!instance) return;

    var startX = 0;
    var isPointerDown = false;

    function onPointerDown(event) {
      startX = event.clientX;
      isPointerDown = true;
      stopAutoplay(root);
    }

    function onPointerUp(event) {
      if (!isPointerDown) return;
      isPointerDown = false;

      var deltaX = event.clientX - startX;
      if (Math.abs(deltaX) > 40) {
        update(root, instance.index + (deltaX < 0 ? 1 : -1));
      }
      startAutoplay(root);
    }

    function onTouchStart(event) {
      if (!event.touches.length) return;
      startX = event.touches[0].clientX;
      stopAutoplay(root);
    }

    function onTouchEnd(event) {
      if (!event.changedTouches.length) {
        startAutoplay(root);
        return;
      }

      var deltaX = event.changedTouches[0].clientX - startX;
      if (Math.abs(deltaX) > 40) {
        update(root, instance.index + (deltaX < 0 ? 1 : -1));
      }
      startAutoplay(root);
    }

    instance.viewport.addEventListener('pointerdown', onPointerDown);
    instance.viewport.addEventListener('pointerup', onPointerUp);
    instance.viewport.addEventListener('pointercancel', function () {
      isPointerDown = false;
      startAutoplay(root);
    });
    instance.viewport.addEventListener('touchstart', onTouchStart, { passive: true });
    instance.viewport.addEventListener('touchend', onTouchEnd, { passive: true });

    instance.teardown.push(function () {
      instance.viewport.removeEventListener('pointerdown', onPointerDown);
      instance.viewport.removeEventListener('pointerup', onPointerUp);
      instance.viewport.removeEventListener('touchstart', onTouchStart);
      instance.viewport.removeEventListener('touchend', onTouchEnd);
    });
  }

  function init(root) {
    if (!root || root.getAttribute('data-custom-blog-hero-slider-initialized') === 'true') {
      return;
    }

    var viewport = root.querySelector(selectors.viewport);
    var track = root.querySelector(selectors.track);
    var slides = Array.from(root.querySelectorAll(selectors.slide));
    var dots = Array.from(root.querySelectorAll(selectors.dot));

    if (!viewport || !track || !slides.length) {
      root.setAttribute('data-custom-blog-hero-slider-initialized', 'true');
      return;
    }

    var instance = {
      viewport: viewport,
      track: track,
      slides: slides,
      dots: dots,
      index: 0,
      autoplay: root.getAttribute('data-autoplay') === 'true',
      autoplaySpeed: parseInt(root.getAttribute('data-autoplay-speed') || '5000', 10),
      timerId: 0,
      teardown: [],
    };

    if (!instance.autoplaySpeed || instance.autoplaySpeed < 1000) {
      instance.autoplaySpeed = 5000;
    }

    instances.set(root, instance);

    for (var i = 0; i < dots.length; i += 1) {
      dots[i].addEventListener('click', function () {
        var dotIndex = parseInt(this.getAttribute('data-slide-index') || '0', 10);
        update(root, dotIndex);
        startAutoplay(root);
      });
    }

    viewport.addEventListener('mouseenter', function () {
      stopAutoplay(root);
    });

    viewport.addEventListener('mouseleave', function () {
      startAutoplay(root);
    });

    viewport.addEventListener('focusin', function () {
      stopAutoplay(root);
    });

    viewport.addEventListener('focusout', function () {
      startAutoplay(root);
    });

    viewport.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        update(root, instance.index + 1);
        startAutoplay(root);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        update(root, instance.index - 1);
        startAutoplay(root);
      } else if (event.key === 'Home') {
        event.preventDefault();
        update(root, 0);
        startAutoplay(root);
      } else if (event.key === 'End') {
        event.preventDefault();
        update(root, instance.slides.length - 1);
        startAutoplay(root);
      }
    });

    bindSwipe(root);
    update(root, 0);
    startAutoplay(root);
    root.setAttribute('data-custom-blog-hero-slider-initialized', 'true');
  }

  function initAll(scope) {
    var root = scope || document;
    var sections = root.matches && root.matches(selectors.root) ? [root] : root.querySelectorAll(selectors.root);

    for (var i = 0; i < sections.length; i += 1) {
      init(sections[i]);
    }
  }

  globalWindow.CustomBlogHeroSlider = {
    initAll: initAll,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAll(document);
    });
  } else {
    initAll(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    if (event.target instanceof HTMLElement) {
      initAll(event.target);
    }
  });
})();
