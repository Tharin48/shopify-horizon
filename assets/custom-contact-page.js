/// <reference path="./global.d.ts" />
(function () {
  'use strict';

  /** @type {Window & { CustomContactPage?: { initAll: (container?: ParentNode | Document) => void, destroy: (root: HTMLElement) => void } }} */
  var globalWindow = window;

  if (globalWindow.CustomContactPage) {
    globalWindow.CustomContactPage.initAll(document);
    return;
  }

  var selectors = {
    root: '[data-custom-contact-page]',
    message: '[data-custom-contact-page-message]',
    count: '[data-custom-contact-page-count]',
    combobox: '[data-subject-combobox]',
    contactAccordion: '[data-contact-accordion]',
  };

  var mobileDrawerMedia = globalWindow.matchMedia('(max-width: 749px)');
  var instances = new WeakMap();
  /** @type {WeakMap<HTMLElement, { remove: () => void }>} */
  var comboboxInstances = new WeakMap();

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
   */
  function syncContactAccordions(root) {
    var isMobile = mobileDrawerMedia.matches;
    var mobileContactLayout = root.getAttribute('data-mobile-contact-layout') || 'accordion';
    var useMobileAccordion = isMobile && mobileContactLayout === 'accordion';

    root.querySelectorAll(selectors.contactAccordion).forEach(function (accordion) {
      if (!(accordion instanceof HTMLDetailsElement)) return;

      var summary = accordion.querySelector('summary');
      if (summary instanceof HTMLElement) {
        if (useMobileAccordion) {
          summary.removeAttribute('tabindex');
          summary.removeAttribute('aria-disabled');
        } else {
          summary.setAttribute('tabindex', '-1');
          summary.setAttribute('aria-disabled', 'true');
        }
      }

      if (useMobileAccordion) {
        accordion.removeAttribute('open');
      } else {
        accordion.setAttribute('open', '');
      }
    });
  }

  /**
   * @param {{ message: HTMLTextAreaElement; count: HTMLElement; root: HTMLElement; inputHandler: (() => void) | null }} instance
   */
  function updateCount(instance) {
    if (!instance.message || !instance.count) return;
    instance.count.textContent = String(instance.message.value.length);
  }

  /**
   * @param {HTMLElement} root
   */
  function destroyCombobox(root) {
    var c = comboboxInstances.get(root);
    if (c) {
      c.remove();
      comboboxInstances.delete(root);
    }
  }

  /**
   * @param {HTMLElement} wrap
   */
  function initSubjectCombobox(wrap) {
    if (wrap.getAttribute('data-subject-combobox-initialized') === 'true') return;

    var subjectField = wrap.closest('.custom-contact-page__field--subject');
    var hidden = subjectField instanceof HTMLElement
      ? subjectField.querySelector('[data-subject-combobox-hidden]')
      : wrap.querySelector('[data-subject-combobox-hidden]');
    var trigger = wrap.querySelector('[data-subject-combobox-trigger]');
    var backdrop = wrap.querySelector('[data-subject-combobox-backdrop]');
    var list = wrap.querySelector('[data-subject-combobox-list]');
    var labelEl = wrap.querySelector('[data-subject-combobox-label]');
    var errorNode = subjectField instanceof HTMLElement ? subjectField.querySelector('[data-subject-combobox-error]') : null;

    if (!(hidden instanceof HTMLInputElement) || !(trigger instanceof HTMLButtonElement) || !(list instanceof HTMLElement) || !(labelEl instanceof HTMLElement)) {
      return;
    }

    var sInput = hidden;
    var sBtn = trigger;
    var sList = list;
    var sLabel = labelEl;
    var sectionRoot = wrap.closest('[data-custom-contact-page]');

    var errorEl = errorNode instanceof HTMLElement ? errorNode : null;
    var missingMsg = wrap.getAttribute('data-subject-missing') || 'Please select a subject.';
    var form = wrap.closest('form');
    var options = Array.prototype.slice.call(sList.querySelectorAll('[role="option"]'));
    if (options.length === 0) return;
    var listHomeParent = sList.parentNode;
    var listHomeNextSibling = sList.nextSibling;
    var backdropHomeParent = backdrop instanceof HTMLElement ? backdrop.parentNode : null;
    var backdropHomeNextSibling = backdrop instanceof HTMLElement ? backdrop.nextSibling : null;

    var activeIndex = -1;
    /** @type {number} */
    var openDocListenerTimeout = 0;
    var ownsScrollLock = false;
    /** @type {(e: Event) => void} */
    var docClick = function () {};
    var hintIdForTrigger = (sBtn.id || '').replace(/-subject-trigger$/, '-subject-hint');

    function shouldUseMobileDrawer() {
      return mobileDrawerMedia.matches;
    }

    function moveNodeHome(node, homeParent, homeNextSibling) {
      if (!(node instanceof Node) || !(homeParent instanceof Node)) return;
      if (homeNextSibling && homeNextSibling.parentNode === homeParent) {
        homeParent.insertBefore(node, homeNextSibling);
      } else {
        homeParent.appendChild(node);
      }
    }

    function mountMobileDrawer() {
      if (!shouldUseMobileDrawer()) return;
      if (backdrop instanceof HTMLElement && backdrop.parentNode !== document.body) {
        document.body.appendChild(backdrop);
      }
      if (sList.parentNode !== document.body) {
        document.body.appendChild(sList);
      }
    }

    function restoreMobileDrawer() {
      moveNodeHome(sList, listHomeParent, listHomeNextSibling);
      if (backdrop instanceof HTMLElement) {
        moveNodeHome(backdrop, backdropHomeParent, backdropHomeNextSibling);
      }
    }

    function lockPageScroll() {
      if (!shouldUseMobileDrawer()) return;
      var html = document.documentElement;
      if (html.hasAttribute('scroll-lock')) {
        ownsScrollLock = false;
        return;
      }
      html.setAttribute('scroll-lock', '');
      html.setAttribute('data-custom-contact-page-scroll-lock', '');
      ownsScrollLock = true;
    }

    function unlockPageScroll() {
      var html = document.documentElement;
      if (!ownsScrollLock) return;
      if (html.hasAttribute('data-custom-contact-page-scroll-lock')) {
        html.removeAttribute('data-custom-contact-page-scroll-lock');
        html.removeAttribute('scroll-lock');
      }
      ownsScrollLock = false;
    }

    function isOpen() {
      return !sList.hidden;
    }

    /**
     * @param {boolean} open
     */
    function setOpen(open) {
      if (open && shouldUseMobileDrawer()) {
        mountMobileDrawer();
      } else if (!open || !shouldUseMobileDrawer()) {
        restoreMobileDrawer();
      }

      sList.hidden = !open;
      if (backdrop instanceof HTMLElement) {
        backdrop.hidden = !open || !shouldUseMobileDrawer();
      }
      if (sectionRoot instanceof HTMLElement) {
        if (open && shouldUseMobileDrawer()) {
          sectionRoot.setAttribute('data-mobile-drawer-open', 'true');
        } else {
          sectionRoot.removeAttribute('data-mobile-drawer-open');
        }
      }
      sBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      wrap.classList.toggle('custom-contact-page__combobox--open', open);
      if (!open) {
        unlockPageScroll();
        if (openDocListenerTimeout) {
          clearTimeout(openDocListenerTimeout);
          openDocListenerTimeout = 0;
        }
        activeIndex = -1;
        sBtn.removeAttribute('aria-activedescendant');
        options.forEach(function (/** @type {HTMLElement} */ o) {
          o.classList.remove('custom-contact-page__combobox-option--highlighted');
        });
        document.removeEventListener('click', docClick, true);
      } else {
        lockPageScroll();
        // Defer so the same user click that opened the list does not hit document (capture) and close it.
        openDocListenerTimeout = setTimeout(function () {
          openDocListenerTimeout = 0;
          document.addEventListener('click', docClick, true);
        }, 0);
      }
    }

    /**
     * @param {number} i
     */
    function highlight(i) {
      if (i < 0 || i >= options.length) return;
      activeIndex = i;
      options.forEach(function (/** @type {HTMLElement} */ o, /** @type {number} */ idx) {
        o.classList.toggle('custom-contact-page__combobox-option--highlighted', idx === i);
      });
      var oid = options[i].id;
      if (oid) sBtn.setAttribute('aria-activedescendant', oid);
    }

    function syncLabel() {
      var v = sInput.value.trim();
      var defPh = sLabel.getAttribute('data-subject-default-placeholder') || '';
      if (v) {
        sLabel.textContent = v;
        sLabel.removeAttribute('data-placeholder-shown');
      } else {
        sLabel.textContent = defPh;
        sLabel.setAttribute('data-placeholder-shown', '');
      }
    }

    /**
     * @param {string} val
     */
    function selectByValue(val) {
      var i;
      for (i = 0; i < options.length; i++) {
        if ((options[i].getAttribute('data-value') || '') === val) {
          break;
        }
      }
      if (i < options.length) {
        var chosen = options[i];
        options.forEach(function (/** @type {HTMLElement} */ o) {
          o.setAttribute('aria-selected', o === chosen ? 'true' : 'false');
        });
      }
    }

    function setDescribedToHint() {
      if (hintIdForTrigger && document.getElementById(hintIdForTrigger)) {
        sBtn.setAttribute('aria-describedby', hintIdForTrigger);
      }
    }

    /**
     * @param {HTMLElement} opt
     */
    function selectOption(opt) {
      var v = opt.getAttribute('data-value') || (opt.textContent && opt.textContent.trim()) || '';
      sInput.value = v;
      selectByValue(v);
      syncLabel();
      setOpen(false);
      if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = '';
      }
      sBtn.setAttribute('aria-invalid', 'false');
      setDescribedToHint();
      sBtn.focus();
    }

    function openList() {
      if (isOpen()) return;
      setOpen(true);
      var j;
      for (j = 0; j < options.length; j++) {
        if (options[j].getAttribute('aria-selected') === 'true') {
          highlight(j);
          return;
        }
      }
      highlight(0);
    }

    function toggle() {
      if (isOpen()) {
        setOpen(false);
      } else {
        openList();
      }
    }

    /**
     * @param {Event} e
     */
    docClick = function (e) {
      if (
        e instanceof MouseEvent &&
        e.target instanceof Node &&
        (wrap.contains(e.target) ||
          sList.contains(e.target) ||
          (backdrop instanceof HTMLElement && backdrop.contains(e.target)))
      ) {
        return;
      }
      setOpen(false);
    };

    /**
     * @param {KeyboardEvent} e
     */
    function onDocKey(e) {
      if (e.key === 'Escape' && isOpen()) {
        e.stopPropagation();
        setOpen(false);
        sBtn.focus();
      }
    }

    /**
     * @param {MouseEvent} e
     */
    function onListMouseDown(e) {
      if (!(e.target instanceof Node)) return;
      var t = e.target instanceof Element ? e.target.closest('[role="option"]') : null;
      if (t && sList.contains(t) && t instanceof HTMLElement) {
        e.preventDefault();
      }
    }

    /**
     * @param {MouseEvent} e
     */
    function onListClick(e) {
      if (!(e.target instanceof Node)) return;
      var t = e.target instanceof Element ? e.target.closest('[role="option"]') : null;
      if (t && t instanceof HTMLElement && sList.contains(t)) {
        e.preventDefault();
        e.stopPropagation();
        selectOption(t);
      }
    }

    /**
     * @param {MouseEvent} e
     */
    function onTriggerClick(e) {
      e.preventDefault();
      toggle();
    }

    /**
     * @param {MouseEvent} e
     */
    function onBackdropClick(e) {
      e.preventDefault();
      setOpen(false);
      sBtn.focus();
    }

    /**
     * @param {MediaQueryListEvent} _event
     */
    function onMobileDrawerModeChange(_event) {
      if (isOpen()) {
        setOpen(false);
      } else if (backdrop instanceof HTMLElement) {
        backdrop.hidden = true;
        restoreMobileDrawer();
      }
    }

    /**
     * @param {KeyboardEvent} e
     */
    function onTriggerKeydown(e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isOpen()) {
          openList();
        } else {
          highlight(Math.min(activeIndex + 1, options.length - 1));
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen()) {
          setOpen(true);
          highlight(options.length - 1);
        } else {
          highlight(Math.max(activeIndex - 1, 0));
        }
        return;
      }
      if (e.key === 'Tab') {
        if (isOpen()) {
          setOpen(false);
        }
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (isOpen() && activeIndex >= 0) {
          selectOption(/** @type {HTMLElement} */ (options[activeIndex]));
        } else if (isOpen() && activeIndex < 0) {
          openList();
        } else if (!isOpen()) {
          openList();
        }
        return;
      }
      if (e.key === 'Home' && isOpen()) {
        e.preventDefault();
        highlight(0);
        return;
      }
      if (e.key === 'End' && isOpen()) {
        e.preventDefault();
        highlight(options.length - 1);
      }
    }

    /**
     * @param {Event} e
     */
    function onFormSubmit(e) {
      if (!sInput.value.trim()) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (errorEl) {
          errorEl.textContent = missingMsg;
          errorEl.hidden = false;
        }
        if (errorEl) {
          var desc = [errorEl.id, hintIdForTrigger].filter(function (id) {
            return id && document.getElementById(id);
          });
          if (desc.length) {
            sBtn.setAttribute('aria-describedby', desc.join(' '));
          }
        }
        sBtn.setAttribute('aria-invalid', 'true');
        openList();
        requestAnimationFrame(function () {
          sBtn.focus();
          if (errorEl) {
            errorEl.scrollIntoView({ block: 'nearest' });
          }
        });
      }
    }

    function remove() {
      unlockPageScroll();
      restoreMobileDrawer();
      if (openDocListenerTimeout) {
        clearTimeout(openDocListenerTimeout);
        openDocListenerTimeout = 0;
      }
      document.removeEventListener('keydown', onDocKey, true);
      document.removeEventListener('click', docClick, true);
      removeMediaListener(mobileDrawerMedia, onMobileDrawerModeChange);
      if (form instanceof HTMLFormElement) {
        form.removeEventListener('submit', onFormSubmit, true);
      }
      sBtn.removeEventListener('click', onTriggerClick);
      sBtn.removeEventListener('keydown', onTriggerKeydown);
      if (backdrop instanceof HTMLElement) {
        backdrop.removeEventListener('click', onBackdropClick);
      }
      sList.removeEventListener('mousedown', onListMouseDown, true);
      sList.removeEventListener('click', onListClick, true);
    }

    document.addEventListener('keydown', onDocKey, true);
    addMediaListener(mobileDrawerMedia, onMobileDrawerModeChange);
    if (form instanceof HTMLFormElement) {
      form.addEventListener('submit', onFormSubmit, true);
    }
    sBtn.addEventListener('click', onTriggerClick);
    sBtn.addEventListener('keydown', onTriggerKeydown);
    if (backdrop instanceof HTMLElement) {
      backdrop.addEventListener('click', onBackdropClick);
    }
    sList.addEventListener('mousedown', onListMouseDown, true);
    sList.addEventListener('click', onListClick, true);

    if (sInput.value.trim()) {
      syncLabel();
      selectByValue(sInput.value);
    } else {
      syncLabel();
    }

    comboboxInstances.set(wrap, { remove: remove });
    wrap.setAttribute('data-subject-combobox-initialized', 'true');
  }

  /**
   * @param {HTMLElement} root
   */
  function destroy(root) {
    var instance = instances.get(root);
    if (instance) {
      if (instance.message && instance.inputHandler) {
        instance.message.removeEventListener('input', instance.inputHandler);
      }
      if (instance.mobileAccordionHandler) {
        removeMediaListener(mobileDrawerMedia, instance.mobileAccordionHandler);
      }
    }

    root.querySelectorAll(selectors.combobox).forEach(function (/** @type {Element} */ el) {
      if (el instanceof HTMLElement) {
        destroyCombobox(el);
        el.removeAttribute('data-subject-combobox-initialized');
      }
    });

    root.removeAttribute('data-custom-contact-page-initialized');
    instances.delete(root);
  }

  /**
   * @param {HTMLElement} root
   */
  function init(root) {
    if (!(root instanceof HTMLElement)) return;
    if (root.getAttribute('data-custom-contact-page-initialized') === 'true') return;

    var message = root.querySelector(selectors.message);
    var count = root.querySelector(selectors.count);
    if (message instanceof HTMLTextAreaElement && count instanceof HTMLElement) {
      var inst = {
        root: root,
        message: message,
        count: count,
        mobileAccordionHandler: function () {
          syncContactAccordions(root);
        },
        inputHandler: function () {
          updateCount(inst);
        },
      };
      message.addEventListener('input', inst.inputHandler);
      instances.set(root, inst);
      updateCount(inst);
      addMediaListener(mobileDrawerMedia, inst.mobileAccordionHandler);
    } else {
      var fallbackInst = {
        root: root,
        message: null,
        count: null,
        inputHandler: null,
        mobileAccordionHandler: function () {
          syncContactAccordions(root);
        },
      };
      instances.set(root, fallbackInst);
      addMediaListener(mobileDrawerMedia, fallbackInst.mobileAccordionHandler);
    }

    syncContactAccordions(root);

    root.querySelectorAll(selectors.combobox).forEach(function (el) {
      if (el instanceof HTMLElement) initSubjectCombobox(el);
    });

    root.setAttribute('data-custom-contact-page-initialized', 'true');
  }

  /**
   * @param {ParentNode | Document | undefined} [container]
   */
  function initAll(container) {
    (container || document).querySelectorAll(selectors.root).forEach(function (/** @type {Element} */ root) {
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
    if (event.target instanceof HTMLElement) {
      initAll(event.target);
    }
  });

  document.addEventListener('shopify:section:unload', function (event) {
    if (!(event.target instanceof HTMLElement)) return;

    event.target.querySelectorAll(selectors.root).forEach(function (/** @type {Element} */ root) {
      if (root instanceof HTMLElement) {
        destroy(root);
      }
    });
  });

  globalWindow.CustomContactPage = {
    initAll: initAll,
    destroy: destroy,
  };

  initAll(document);
})();
