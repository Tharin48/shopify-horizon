(function () {
  'use strict';

  /** @type {Window & { CustomFooter?: { initAll: (container?: ParentNode | Document) => void, destroy: (root: HTMLElement) => void } }} */
  var globalWindow = window;

  if (globalWindow.CustomFooter) {
    globalWindow.CustomFooter.initAll(document);
    return;
  }

  var selectors = {
    root: '[data-custom-footer]',
    accordion: '[data-custom-footer-accordion]',
    menuBlock: '[data-custom-footer-menu-block]',
  };
  var mobileMedia = globalWindow.matchMedia('(max-width: 989px)');
  var instances = new WeakMap();

  function addMediaListener(mediaQueryList, handler) {
    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handler);
      return;
    }

    if (typeof mediaQueryList.addListener === 'function') {
      mediaQueryList.addListener(handler);
    }
  }

  function removeMediaListener(mediaQueryList, handler) {
    if (typeof mediaQueryList.removeEventListener === 'function') {
      mediaQueryList.removeEventListener('change', handler);
      return;
    }

    if (typeof mediaQueryList.removeListener === 'function') {
      mediaQueryList.removeListener(handler);
    }
  }

  function closeSiblings(instance, currentAccordion) {
    instance.accordions.forEach(function (accordion) {
      if (accordion === currentAccordion) return;
      accordion.removeAttribute('open');
    });
  }

  function syncMode(instance) {
    var isMobileOrTablet = mobileMedia.matches;

    instance.root.toggleAttribute('data-custom-footer-mobile-accordion', isMobileOrTablet);

    if (isMobileOrTablet) {
      var hasOpenAccordion = instance.accordions.some(function (accordion) {
        return accordion.hasAttribute('open');
      });

      if (!hasOpenAccordion && instance.accordions[0]) {
        instance.accordions[0].setAttribute('open', '');
      }

      return;
    }

    instance.accordions.forEach(function (accordion) {
      accordion.setAttribute('open', '');
    });
  }

  function destroy(root) {
    var instance = instances.get(root);
    if (!instance) return;

    instance.cleanups.forEach(function (cleanup) {
      cleanup();
    });

    removeMediaListener(mobileMedia, instance.mediaHandler);
    root.removeAttribute('data-custom-footer-initialized');
    root.removeAttribute('data-custom-footer-mobile-accordion');
    instances.delete(root);
  }

  function init(root) {
    if (!(root instanceof HTMLElement)) return;
    if (root.getAttribute('data-custom-footer-initialized') === 'true') return;

    var accordions = Array.from(root.querySelectorAll(selectors.accordion)).filter(function (accordion) {
      return accordion instanceof HTMLDetailsElement;
    });

    if (!accordions.length) return;

    var cleanups = [];
    var instance = {
      root: root,
      accordions: accordions,
      cleanups: cleanups,
      mediaHandler: function () {
        syncMode(instance);
      },
    };

    accordions.forEach(function (accordion) {
      var summary = accordion.querySelector('summary');
      if (!(summary instanceof HTMLElement)) return;

      var clickHandler = function (event) {
        if (!mobileMedia.matches) return;

        event.preventDefault();

        var isOpen = accordion.hasAttribute('open');
        if (isOpen) {
          accordion.removeAttribute('open');
          return;
        }

        closeSiblings(instance, accordion);
        accordion.setAttribute('open', '');
      };

      summary.addEventListener('click', clickHandler);
      cleanups.push(function () {
        summary.removeEventListener('click', clickHandler);
      });
    });

    addMediaListener(mobileMedia, instance.mediaHandler);
    instances.set(root, instance);
    root.setAttribute('data-custom-footer-initialized', 'true');
    syncMode(instance);
  }

  function initAll(container) {
    (container || document).querySelectorAll(selectors.root).forEach(function (root) {
      init(root);
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
    if (event.target instanceof HTMLElement) {
      initAll(event.target);
    }
  });

  document.addEventListener('shopify:section:unload', function (event) {
    if (!(event.target instanceof HTMLElement)) return;

    event.target.querySelectorAll(selectors.root).forEach(function (root) {
      destroy(root);
    });
  });

  document.addEventListener('shopify:block:select', function (event) {
    if (!(event.target instanceof HTMLElement)) return;
    if (!mobileMedia.matches) return;

    var menuBlock = event.target.closest(selectors.menuBlock);
    if (!(menuBlock instanceof HTMLElement)) return;

    var root = menuBlock.closest(selectors.root);
    if (!(root instanceof HTMLElement)) return;

    var instance = instances.get(root);
    if (!instance) {
      init(root);
      instance = instances.get(root);
    }
    if (!instance) return;

    var accordion = menuBlock.querySelector(selectors.accordion);
    if (!(accordion instanceof HTMLDetailsElement)) return;

    closeSiblings(instance, accordion);
    accordion.setAttribute('open', '');
  });

  globalWindow.CustomFooter = {
    initAll: initAll,
    destroy: destroy,
  };

  initAll(document);
})();
