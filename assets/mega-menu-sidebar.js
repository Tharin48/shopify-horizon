/**
 * Sidebar mega menu: switches L3 panels when L2 tabs are hovered, focused, or clicked.
 * Updates header submenu height when panel content size changes.
 */
class MegaMenuSidebar extends HTMLElement {
  /** @type {ResizeObserver | undefined} */
  #resizeObserver;

  /** @type {AbortController | undefined} */
  #abortController;

  /** @type {number | null} */
  #pendingActivateTimer = null;

  /** @type {number | null} */
  #pendingResetTimer = null;

  connectedCallback() {
    this.#abortController?.abort();
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    this.#init(signal);

    this.#resizeObserver?.disconnect();
    this.#resizeObserver = new ResizeObserver(() => {
      this.#syncSubmenuHeight();
    });
    this.#resizeObserver.observe(this);
  }

  disconnectedCallback() {
    this.#abortController?.abort();
    this.#abortController = undefined;
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
    this.#clearActivateTimer();
    this.#clearResetTimer();
  }

  /**
   * @param {AbortSignal} signal
   */
  #init(signal) {
    const tabs = this.querySelectorAll('[data-mega-sidebar-tab]');
    const panels = this.querySelectorAll('[data-mega-sidebar-panel]');
    const defaultPanel = this.querySelector('[data-mega-sidebar-default-panel]');
    const directLinks = this.querySelectorAll('[data-mega-sidebar-direct-link]');

    if (!tabs.length || !panels.length) return;

    const fallbackToDefault = () => {
      if (defaultPanel instanceof HTMLElement) {
        for (const tab of tabs) {
          tab.setAttribute('aria-expanded', 'false');
        }

        defaultPanel.hidden = false;
        for (const panel of panels) {
          if (panel instanceof HTMLElement) panel.hidden = true;
        }

        this.#syncSubmenuHeight();
        return;
      }

      const firstTab = tabs[0];
      if (!(firstTab instanceof HTMLElement)) return;
      const firstIndex = Number(firstTab.getAttribute('data-mega-sidebar-index'));
      if (!Number.isNaN(firstIndex)) {
        activate(firstIndex);
      }
    };

    const showDefault = () => {
      for (const tab of tabs) {
        tab.setAttribute('aria-expanded', 'false');
      }

      fallbackToDefault();
    };

    const activate = (/** @type {number} */ index) => {
      this.#clearResetTimer();
      if (defaultPanel instanceof HTMLElement) {
        defaultPanel.hidden = true;
      }
      for (const tab of tabs) {
        const tabIndex = Number(tab.getAttribute('data-mega-sidebar-index'));
        const isMatch = tabIndex === index;
        tab.setAttribute('aria-expanded', isMatch ? 'true' : 'false');
      }
      for (const panel of panels) {
        if (!(panel instanceof HTMLElement)) continue;
        const panelIndex = Number(panel.getAttribute('data-mega-sidebar-index'));
        if (panelIndex === index) {
          panel.hidden = false;
        } else {
          panel.hidden = true;
        }
      }
      this.#syncSubmenuHeight();
    };

    /** @param {number} index */
    const scheduleActivate = (index) => {
      this.#clearActivateTimer();
      this.#clearResetTimer();
      this.#pendingActivateTimer = window.setTimeout(() => {
        this.#pendingActivateTimer = null;
        activate(index);
      }, 110);
    };

    const scheduleReset = () => {
      this.#clearActivateTimer();
      this.#clearResetTimer();
      this.#pendingResetTimer = window.setTimeout(() => {
        this.#pendingResetTimer = null;
        fallbackToDefault();
      }, 140);
    };

    if (defaultPanel instanceof HTMLElement) {
      showDefault();
    }

    for (const tab of tabs) {
      const idx = Number(tab.getAttribute('data-mega-sidebar-index'));
      tab.addEventListener('pointerenter', () => scheduleActivate(idx), { signal });
      tab.addEventListener('pointerleave', () => this.#clearActivateTimer(), { signal });
      tab.addEventListener('focus', () => activate(idx), { signal });
      tab.addEventListener(
        'click',
        () => activate(idx),
        { signal }
      );
    }

    for (const link of directLinks) {
      link.addEventListener(
        'pointerenter',
        () => {
          this.#clearActivateTimer();
          this.#clearResetTimer();
          fallbackToDefault();
        },
        { signal }
      );
      link.addEventListener('focus', () => fallbackToDefault(), { signal });
    }

    this.addEventListener('pointerenter', () => this.#clearResetTimer(), { signal });
    this.addEventListener('pointerleave', () => scheduleReset(), { signal });
    this.addEventListener(
      'focusout',
      (event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !this.contains(nextTarget)) {
          scheduleReset();
        }
      },
      { signal }
    );

    /** @param {KeyboardEvent} event */
    const onDocumentKeydown = (event) => {
      if (!this.contains(document.activeElement)) return;
      const tabElements = [...this.querySelectorAll('[data-mega-sidebar-tab]')].filter(
        (el) => el instanceof HTMLElement
      );
      if (!tabElements.length) return;
      const currentIndex = tabElements.findIndex((t) => t.getAttribute('aria-expanded') === 'true');
      if (currentIndex < 0) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          tabElements[0]?.focus();
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          tabElements[tabElements.length - 1]?.focus();
        }
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const next = tabElements[currentIndex + 1] ?? tabElements[0];
        next?.focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prev = tabElements[currentIndex - 1] ?? tabElements[tabElements.length - 1];
        prev?.focus();
      }
    };
    document.addEventListener('keydown', onDocumentKeydown, { signal });
  }

  #clearActivateTimer() {
    if (this.#pendingActivateTimer !== null) {
      window.clearTimeout(this.#pendingActivateTimer);
      this.#pendingActivateTimer = null;
    }
  }

  #clearResetTimer() {
    if (this.#pendingResetTimer !== null) {
      window.clearTimeout(this.#pendingResetTimer);
      this.#pendingResetTimer = null;
    }
  }

  #syncSubmenuHeight() {
    const submenu = this.closest('[ref="submenu[]"]');
    if (!(submenu instanceof HTMLElement)) return;

    const customRoot = submenu.closest('[data-header-menu-root]');
    const headerEl = document.querySelector('#header-component');
    /** @type {HTMLElement | null} */
    const horizonHeader = headerEl instanceof HTMLElement ? headerEl : null;
    /** @type {HTMLElement | null} */
    const root =
      customRoot instanceof HTMLElement ? customRoot : horizonHeader ?? null;
    if (!root) return;

    const submenuHeight = submenu.offsetHeight;
    root.style.setProperty('--submenu-height', `${submenuHeight}px`);

    let headerVisibleHeight = root.offsetHeight;
    if (horizonHeader && root === horizonHeader) {
      const isOverlap = horizonHeader.hasAttribute('data-submenu-overlap-bottom-row');
      const topRow = horizonHeader.querySelector('.header__row--top');
      const topRowHeight = topRow instanceof HTMLElement ? topRow.offsetHeight : 0;
      headerVisibleHeight =
        isOverlap && horizonHeader.offsetHeight > 0 ? topRowHeight : horizonHeader.offsetHeight;
    }

    const fullOpen = submenuHeight === 0 ? 0 : submenuHeight + (headerVisibleHeight ?? 0);
    root.style.setProperty('--full-open-header-height', `${fullOpen}px`);
  }
}

if (!customElements.get('mega-menu-sidebar')) {
  customElements.define('mega-menu-sidebar', MegaMenuSidebar);
}
