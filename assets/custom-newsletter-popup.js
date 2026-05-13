(function () {
  'use strict';

  /** @type {Window & { CustomNewsletterPopup?: { initAll: (container?: ParentNode | Document) => void, destroy: (root: HTMLElement) => void, open: (root: HTMLElement) => void, close: (root: HTMLElement, persistDismissal?: boolean) => void } }} */
  var globalWindow = window;

  if (globalWindow.CustomNewsletterPopup) {
    globalWindow.CustomNewsletterPopup.initAll(document);
    return;
  }

  var selectors = {
    root: '[data-custom-newsletter-popup]',
    dialog: '.custom-newsletter-popup__dialog',
    input: '.custom-newsletter-popup__input',
    copy: '[data-newsletter-popup-copy]',
    discountCode: '.custom-newsletter-popup__discount-code span',
    dismiss: '[data-newsletter-popup-dismiss]',
    state: '[data-newsletter-popup-state]',
    success: '[data-newsletter-popup-success]',
  };
  var focusableSelector = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');
  var mobileMedia = globalWindow.matchMedia('(max-width: 749px)');
  /**
   * @typedef {{
   *   root: HTMLElement,
   *   dialog: HTMLElement,
   *   input: HTMLElement | null,
   *   copyButton: HTMLElement | null,
   *   discountCode: HTMLElement | null,
   *   success: HTMLElement | null,
   *   state: string,
   *   isOpen: boolean,
   *   openTimer: number,
   *   lastActiveElement: HTMLElement | null,
   *   scrollState: { htmlOverflow: string, bodyOverflow: string, bodyPaddingRight: string } | null,
   *   handleClick: (event: MouseEvent) => void,
   *   handleKeydown: (event: KeyboardEvent) => void,
   *   handleMediaChange: () => void
   * }} PopupInstance
   */
  var instances = new WeakMap();

  /** @param {MediaQueryList} mediaQueryList @param {(event: MediaQueryListEvent) => void} handler */
  function addMediaListener(mediaQueryList, handler) {
    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handler);
      return;
    }

    if (typeof mediaQueryList.addListener === 'function') {
      mediaQueryList.addListener(handler);
    }
  }

  /** @param {MediaQueryList} mediaQueryList @param {(event: MediaQueryListEvent) => void} handler */
  function removeMediaListener(mediaQueryList, handler) {
    if (typeof mediaQueryList.removeEventListener === 'function') {
      mediaQueryList.removeEventListener('change', handler);
      return;
    }

    if (typeof mediaQueryList.removeListener === 'function') {
      mediaQueryList.removeListener(handler);
    }
  }

  /** @param {string} key */
  function safeGetStorage(key) {
    try {
      return globalWindow.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  /** @param {string} key @param {string} value */
  function safeSetStorage(key, value) {
    try {
      globalWindow.localStorage.setItem(key, value);
    } catch (error) {
      return;
    }
  }

  /** @param {string} key */
  function safeGetSessionStorage(key) {
    try {
      return globalWindow.sessionStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  /** @param {string} key @param {string} value */
  function safeSetSessionStorage(key, value) {
    try {
      globalWindow.sessionStorage.setItem(key, value);
    } catch (error) {
      return;
    }
  }

  /** @param {HTMLElement} root */
  function getState(root) {
    var stateElement = root.querySelector(selectors.state);
    return stateElement ? stateElement.getAttribute('data-newsletter-popup-state') || 'default' : 'default';
  }

  /** @param {HTMLElement} root */
  function getFrequencyMs(root) {
    var frequencyDays = Number(root.dataset.frequencyDays || 14);
    if (!Number.isFinite(frequencyDays) || frequencyDays < 1) {
      frequencyDays = 14;
    }

    return frequencyDays * 24 * 60 * 60 * 1000;
  }

  /** @param {HTMLElement} root */
  function isDesignMode(root) {
    return root.dataset.designMode === 'true';
  }

  /** @param {HTMLElement} root */
  function isEnabled(root) {
    return root.dataset.enabled === 'true';
  }

  /** @param {HTMLElement} root */
  function isPageAllowed(root) {
    return isDesignMode(root) || root.dataset.pageAllowed === 'true';
  }

  /** @param {HTMLElement} root */
  function isDeviceAllowed(root) {
    if (isDesignMode(root)) return true;
    if (mobileMedia.matches) return root.dataset.enableMobile === 'true';
    return root.dataset.enableDesktop === 'true';
  }

  /** @param {HTMLElement} root */
  function isSubscribed(root) {
    if (isDesignMode(root)) return false;
    return safeGetStorage('newsletterSubscribed') === 'true';
  }

  /** @param {HTMLElement} root */
  function usesSessionFrequency(root) {
    return root.dataset.displayFrequency === 'session';
  }

  /** @param {HTMLElement} root */
  function isDismissed(root) {
    if (isDesignMode(root)) return false;

    if (usesSessionFrequency(root)) {
      return safeGetSessionStorage(root.dataset.sessionDismissKey || '') === 'true';
    }

    var dismissedAt = Number(safeGetStorage(root.dataset.dismissKey || ''));
    if (!Number.isFinite(dismissedAt) || dismissedAt <= 0) {
      return false;
    }

    return Date.now() - dismissedAt < getFrequencyMs(root);
  }

  /** @param {HTMLElement} root */
  function setDismissed(root) {
    if (isDesignMode(root)) return;

    if (usesSessionFrequency(root)) {
      if (!root.dataset.sessionDismissKey) return;
      safeSetSessionStorage(root.dataset.sessionDismissKey, 'true');
      return;
    }

    if (!root.dataset.dismissKey) return;

    safeSetStorage(root.dataset.dismissKey, String(Date.now()));
  }

  function setSubscribed() {
    safeSetStorage('newsletterSubscribed', 'true');
  }

  /** @param {string} value @returns {Promise<boolean>} */
  function copyText(value) {
    if (!value) return Promise.resolve(false);

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(value).then(
        function () {
          return true;
        },
        function () {
          return false;
        }
      );
    }

    var input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'absolute';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.select();

    var didCopy = false;
    try {
      didCopy = document.execCommand('copy');
    } catch (error) {
      didCopy = false;
    }

    document.body.removeChild(input);
    return Promise.resolve(didCopy);
  }

  /** @param {HTMLElement} container @returns {HTMLElement[]} */
  function getFocusableElements(container) {
    var candidates = Array.from(container.querySelectorAll(focusableSelector));
    /** @type {HTMLElement[]} */
    var focusable = [];
    candidates.forEach(function (element) {
      if (!(element instanceof HTMLElement)) return;
      if (element.hidden) return;
      if (element.tabIndex < 0) return;
      focusable.push(element);
    });
    return focusable;
  }

  /** @param {PopupInstance} instance */
  function clearOpenTimer(instance) {
    if (!instance.openTimer) return;
    globalWindow.clearTimeout(instance.openTimer);
    instance.openTimer = 0;
  }

  /** @param {PopupInstance} instance */
  function restoreScroll(instance) {
    if (isDesignMode(instance.root)) return;
    if (!instance.scrollState) return;

    document.documentElement.style.overflow = instance.scrollState.htmlOverflow;
    document.body.style.overflow = instance.scrollState.bodyOverflow;
    document.body.style.paddingRight = instance.scrollState.bodyPaddingRight;
    instance.scrollState = null;
  }

  /** @param {PopupInstance} instance */
  function lockScroll(instance) {
    if (isDesignMode(instance.root)) return;
    if (instance.scrollState) return;

    instance.scrollState = {
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow,
      bodyPaddingRight: document.body.style.paddingRight,
    };

    var scrollbarWidth = globalWindow.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = scrollbarWidth + 'px';
    }
  }

  /** @param {PopupInstance} instance */
  function open(instance) {
    if (instance.isOpen) return;

    clearOpenTimer(instance);
    instance.isOpen = true;
    instance.root.hidden = false;
    instance.root.setAttribute('aria-hidden', 'false');
    instance.lastActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lockScroll(instance);

    globalWindow.requestAnimationFrame(function () {
      instance.root.classList.add('is-open');

      var focusTarget = instance.state === 'success' ? instance.success : instance.input;
      if (!(focusTarget instanceof HTMLElement)) {
        focusTarget = instance.dialog;
      }

      if (focusTarget instanceof HTMLElement) {
        focusTarget.focus();
      }
    });
  }

  /**
   * @param {PopupInstance} instance
   * @param {{ persistDismissal?: boolean, restoreFocus?: boolean }=} options
   */
  function close(instance, options) {
    var persistDismissal = !options || options.persistDismissal !== false;
    var restoreFocus = !options || options.restoreFocus !== false;

    clearOpenTimer(instance);

    if (persistDismissal) {
      if (instance.state === 'success') {
        setSubscribed();
      } else {
        setDismissed(instance.root);
      }
    }

    if (!instance.isOpen) return;

    instance.isOpen = false;
    instance.root.classList.remove('is-open');
    instance.root.setAttribute('aria-hidden', 'true');
    restoreScroll(instance);

    globalWindow.setTimeout(function () {
      if (!instance.isOpen) {
        instance.root.hidden = true;
      }
    }, 240);

    if (restoreFocus && instance.lastActiveElement instanceof HTMLElement && document.contains(instance.lastActiveElement)) {
      instance.lastActiveElement.focus();
    }
  }

  /** @param {PopupInstance} instance @param {number} delayMs */
  function scheduleOpen(instance, delayMs) {
    clearOpenTimer(instance);

    instance.openTimer = globalWindow.setTimeout(function () {
      open(instance);
    }, Math.max(0, delayMs));
  }

  /** @param {PopupInstance} instance */
  function reevaluate(instance) {
    instance.state = getState(instance.root);

    if (instance.state === 'success') {
      open(instance);
      return;
    }

    if (instance.state === 'error') {
      open(instance);
      return;
    }

    if (!isEnabled(instance.root) || !isPageAllowed(instance.root) || !isDeviceAllowed(instance.root) || isSubscribed(instance.root) || isDismissed(instance.root)) {
      close(instance, { persistDismissal: false, restoreFocus: false });
      return;
    }

    if (isDesignMode(instance.root)) {
      open(instance);
      return;
    }

    if (instance.isOpen) return;

    var delaySeconds = Number(instance.root.dataset.delaySeconds || 8);
    if (!Number.isFinite(delaySeconds) || delaySeconds < 0) {
      delaySeconds = 8;
    }

    scheduleOpen(instance, delaySeconds * 1000);
  }

  /** @param {PopupInstance} instance */
  function handleDismiss(instance) {
    close(instance, { persistDismissal: instance.state !== 'success' });
  }

  /** @param {PopupInstance} instance @param {KeyboardEvent} event */
  function trapFocus(instance, event) {
    if (event.key !== 'Tab' || !instance.isOpen) return;

    var focusableElements = getFocusableElements(instance.dialog);
    if (!focusableElements.length) {
      event.preventDefault();
      instance.dialog.focus();
      return;
    }

    var firstElement = /** @type {HTMLElement} */ (focusableElements[0]);
    var lastElement = /** @type {HTMLElement} */ (focusableElements[focusableElements.length - 1]);
    var activeElement = document.activeElement;

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  /** @param {HTMLElement} root */
  function destroy(root) {
    var instance = instances.get(root);
    if (!instance) return;

    clearOpenTimer(instance);
    restoreScroll(instance);
    root.hidden = true;
    root.classList.remove('is-open');

    instance.root.removeEventListener('click', instance.handleClick);
    instance.root.removeEventListener('keydown', instance.handleKeydown);
    removeMediaListener(mobileMedia, instance.handleMediaChange);

    root.removeAttribute('data-custom-newsletter-popup-initialized');
    instances.delete(root);
  }

  /** @param {HTMLElement} root */
  function init(root) {
    if (!(root instanceof HTMLElement)) return;
    if (root.getAttribute('data-custom-newsletter-popup-initialized') === 'true') return;

    var dialog = root.querySelector(selectors.dialog);
    if (!(dialog instanceof HTMLElement)) return;

    var input = root.querySelector(selectors.input);
    var copyButton = root.querySelector(selectors.copy);
    var discountCode = root.querySelector(selectors.discountCode);
    var success = root.querySelector(selectors.success);

    /** @type {PopupInstance} */
    var instance = {
      root: root,
      dialog: dialog,
      input: input instanceof HTMLElement ? input : null,
      copyButton: copyButton instanceof HTMLElement ? copyButton : null,
      discountCode: discountCode instanceof HTMLElement ? discountCode : null,
      success: success instanceof HTMLElement ? success : null,
      state: getState(root),
      isOpen: false,
      openTimer: 0,
      lastActiveElement: null,
      scrollState: null,
      handleClick: function (event) {
        var copyTarget = event.target instanceof Element ? event.target.closest(selectors.copy) : null;
        if (copyTarget && instance.copyButton && instance.discountCode) {
          event.preventDefault();

          var defaultText = instance.copyButton.getAttribute('data-copy-default-text') || 'Copy code';
          var successText = instance.copyButton.getAttribute('data-copy-success-text') || 'Copied';
          var code = (instance.discountCode.textContent || '').trim();

          copyText(code).then(function (didCopy) {
            if (!didCopy || !instance.copyButton) return;

            instance.copyButton.classList.add('is-copied');
            instance.copyButton.setAttribute('aria-label', successText);
            instance.copyButton.setAttribute('title', successText);
            globalWindow.setTimeout(function () {
              if (instance.copyButton) {
                instance.copyButton.classList.remove('is-copied');
                instance.copyButton.setAttribute('aria-label', defaultText);
                instance.copyButton.setAttribute('title', defaultText);
              }
            }, 1800);
          });
          return;
        }

        var dismissTarget = event.target instanceof Element ? event.target.closest(selectors.dismiss) : null;
        if (!dismissTarget) return;

        event.preventDefault();
        handleDismiss(instance);
      },
      handleKeydown: function (event) {
        if (event.key === 'Escape' && instance.isOpen) {
          event.preventDefault();
          handleDismiss(instance);
          return;
        }

        trapFocus(instance, event);
      },
      handleMediaChange: function () {
        reevaluate(instance);
      },
    };

    root.addEventListener('click', instance.handleClick);
    root.addEventListener('keydown', instance.handleKeydown);
    addMediaListener(mobileMedia, instance.handleMediaChange);

    root.setAttribute('data-custom-newsletter-popup-initialized', 'true');
    instances.set(root, instance);
    reevaluate(instance);
  }

  /** @param {ParentNode | Document | HTMLElement | null | undefined} container */
  function findRoots(container) {
    if (!container) return [];

    var roots = [];
    if (container instanceof HTMLElement && container.matches(selectors.root)) {
      roots.push(container);
    }

    var scope = container instanceof Element || container instanceof Document ? container : document;
    scope.querySelectorAll(selectors.root).forEach(function (root) {
      if (root instanceof HTMLElement) {
        roots.push(root);
      }
    });

    return roots;
  }

  /** @param {ParentNode | Document | HTMLElement=} container */
  function initAll(container) {
    findRoots(container || document).forEach(function (root) {
      init(root);
    });
  }

  /** @param {HTMLElement} root */
  function openRoot(root) {
    var instance = instances.get(root);
    if (!instance) return;

    instance.state = getState(root);
    if (!isEnabled(root) && instance.state === 'default') return;
    open(instance);
  }

  /** @param {HTMLElement} root @param {boolean=} persistDismissal */
  function closeRoot(root, persistDismissal) {
    var instance = instances.get(root);
    if (!instance) return;

    close(instance, { persistDismissal: persistDismissal !== false });
  }

  globalWindow.CustomNewsletterPopup = {
    initAll: initAll,
    destroy: destroy,
    open: openRoot,
    close: closeRoot,
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

  document.addEventListener('shopify:section:select', function (event) {
    if (!(event.target instanceof HTMLElement)) return;

    initAll(event.target);
    findRoots(event.target).forEach(function (root) {
      openRoot(root);
    });
  });

  document.addEventListener('shopify:section:deselect', function (event) {
    if (!(event.target instanceof HTMLElement)) return;

    findRoots(event.target).forEach(function (root) {
      closeRoot(root, false);
    });
  });

  document.addEventListener('shopify:section:unload', function (event) {
    if (!(event.target instanceof HTMLElement)) return;

    findRoots(event.target).forEach(function (root) {
      destroy(root);
    });
  });
})();
