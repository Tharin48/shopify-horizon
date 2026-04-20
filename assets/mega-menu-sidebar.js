/**
 * Sidebar mega menu: switches L3 panels when L2 tabs are hovered, focused, or clicked.
 * Updates header submenu height when panel content size changes.
 */
class MegaMenuSidebar extends HTMLElement {
  /** @type {ResizeObserver | undefined} */
  #resizeObserver;

  /** @type {AbortController | undefined} */
  #abortController;

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
  }

  /**
   * @param {AbortSignal} signal
   */
  #init(signal) {
    const tabs = this.querySelectorAll('[data-mega-sidebar-tab]');
    const panels = this.querySelectorAll('[data-mega-sidebar-panel]');
    const defaultPanel = this.querySelector('[data-mega-sidebar-default-panel]');

    if (!tabs.length || !panels.length) return;

    const showDefault = () => {
      if (!(defaultPanel instanceof HTMLElement)) return;

      for (const tab of tabs) {
        tab.setAttribute('aria-expanded', 'false');
      }

      defaultPanel.hidden = false;
      for (const panel of panels) {
        panel.hidden = true;
      }

      this.#syncSubmenuHeight();
    };

    const activate = (/** @type {number} */ index) => {
      if (defaultPanel instanceof HTMLElement) {
        defaultPanel.hidden = true;
      }
      for (const tab of tabs) {
        const tabIndex = Number(tab.getAttribute('data-mega-sidebar-index'));
        const isMatch = tabIndex === index;
        tab.setAttribute('aria-expanded', isMatch ? 'true' : 'false');
      }
      for (const panel of panels) {
        const panelIndex = Number(panel.getAttribute('data-mega-sidebar-index'));
        if (panelIndex === index) {
          panel.hidden = false;
        } else {
          panel.hidden = true;
        }
      }
      this.#syncSubmenuHeight();
    };

    if (defaultPanel instanceof HTMLElement) {
      showDefault();
    }

    for (const tab of tabs) {
      const idx = Number(tab.getAttribute('data-mega-sidebar-index'));
      tab.addEventListener('pointerenter', () => activate(idx), { signal });
      tab.addEventListener('focus', () => activate(idx), { signal });
      tab.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          activate(idx);
        },
        { signal }
      );
    }

    const onDocumentKeydown = (event) => {
      if (!this.contains(document.activeElement)) return;
      const tabElements = [...this.querySelectorAll('[data-mega-sidebar-tab]')];
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

  #syncSubmenuHeight() {
    const submenu = this.closest('[ref="submenu[]"]');
    if (!(submenu instanceof HTMLElement)) return;

    const customRoot = submenu.closest('[data-header-menu-root]');
    const horizonHeader = document.querySelector('#header-component');
    /** @type {HTMLElement | null} */
    const root =
      customRoot instanceof HTMLElement ? customRoot : horizonHeader instanceof HTMLElement ? horizonHeader : null;
    if (!root) return;

    const submenuHeight = submenu.offsetHeight;
    root.style.setProperty('--submenu-height', `${submenuHeight}px`);

    let headerVisibleHeight = root.offsetHeight;
    if (horizonHeader && root === horizonHeader) {
      const isOverlap = horizonHeader.hasAttribute('data-submenu-overlap-bottom-row');
      headerVisibleHeight =
        isOverlap && horizonHeader.offsetHeight > 0
          ? horizonHeader.querySelector('.header__row--top')?.offsetHeight ?? 0
          : horizonHeader.offsetHeight;
    }

    const fullOpen = submenuHeight === 0 ? 0 : submenuHeight + (headerVisibleHeight ?? 0);
    root.style.setProperty('--full-open-header-height', `${fullOpen}px`);
  }
}

if (!customElements.get('mega-menu-sidebar')) {
  customElements.define('mega-menu-sidebar', MegaMenuSidebar);
}
