(function () {
  'use strict';

  var SELECTORS = {
    root: '[data-custom-blog-recipes]',
    viewport: '[data-custom-blog-recipes-viewport]',
    indicators: '[data-custom-blog-recipes-indicator]',
  };

  function updateIndicators(root, index) {
    var indicators = root.querySelectorAll(SELECTORS.indicators);
    for (var i = 0; i < indicators.length; i++) {
      var isActive = i === index;
      indicators[i].classList.toggle('is-active', isActive);
      indicators[i].setAttribute('aria-current', isActive ? 'true' : 'false');
    }
  }

  function initSection(root) {
    if (!root || root.getAttribute('data-custom-blog-recipes-initialized') === 'true') {
      return;
    }

    var viewport = root.querySelector(SELECTORS.viewport);
    var indicators = root.querySelectorAll(SELECTORS.indicators);

    if (!viewport || !indicators.length) {
      root.setAttribute('data-custom-blog-recipes-initialized', 'true');
      return;
    }

    var rafId = 0;

    function getIndex() {
      var width = viewport.clientWidth || 1;
      return Math.max(0, Math.min(indicators.length - 1, Math.round(viewport.scrollLeft / width)));
    }

    function handleScroll() {
      if (rafId) return;

      rafId = window.requestAnimationFrame(function () {
        rafId = 0;
        updateIndicators(root, getIndex());
      });
    }

    for (var i = 0; i < indicators.length; i++) {
      indicators[i].addEventListener('click', function () {
        var index = parseInt(this.getAttribute('data-slide-index') || '0', 10);
        viewport.scrollTo({
          left: viewport.clientWidth * index,
          behavior: 'smooth',
        });
      });
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    updateIndicators(root, getIndex());
    root.setAttribute('data-custom-blog-recipes-initialized', 'true');
  }

  function initAll(scope) {
    var root = scope || document;
    var sections = root.matches && root.matches(SELECTORS.root) ? [root] : root.querySelectorAll(SELECTORS.root);

    for (var i = 0; i < sections.length; i++) {
      initSection(sections[i]);
    }
  }

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
