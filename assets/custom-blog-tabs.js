if (!customElements.get('custom-blog-tabs')) {
  customElements.define(
    'custom-blog-tabs',
    class CustomBlogTabs extends HTMLElement {
      /** @type {AbortController | undefined} */
      #abort;

      connectedCallback() {
        this.#abort?.abort();
        this.#abort = new AbortController();
        const { signal } = this.#abort;

        const tabs = this.querySelectorAll('[role="tab"]');
        const panels = this.querySelectorAll('[role="tabpanel"]');

        if (tabs.length < 2 || panels.length < 2) return;

        for (const tab of tabs) {
          tab.addEventListener(
            'click',
            () => {
              this.#activateTab(/** @type {HTMLButtonElement} */ (tab), tabs, panels);
            },
            { signal }
          );

          tab.addEventListener(
            'keydown',
            /** @param {Event} event */
            (event) => {
              if (!(event instanceof KeyboardEvent)) return;

              let nextIndex = -1;
              const currentIndex = [...tabs].indexOf(tab);

              if (event.key === 'ArrowRight') {
                nextIndex = (currentIndex + 1) % tabs.length;
              } else if (event.key === 'ArrowLeft') {
                nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
              } else if (event.key === 'Home') {
                nextIndex = 0;
              } else if (event.key === 'End') {
                nextIndex = tabs.length - 1;
              }

              if (nextIndex === -1) return;

              event.preventDefault();
              /** @type {HTMLButtonElement} */ (tabs[nextIndex]).focus();
              this.#activateTab(/** @type {HTMLButtonElement} */ (tabs[nextIndex]), tabs, panels);
            },
            { signal }
          );
        }
      }

      disconnectedCallback() {
        this.#abort?.abort();
      }

      /**
       * @param {HTMLButtonElement} activeTab
       * @param {NodeListOf<Element>} tabs
       * @param {NodeListOf<Element>} panels
       */
      #activateTab(activeTab, tabs, panels) {
        const targetId = activeTab.getAttribute('aria-controls');
        if (!targetId) return;

        for (const tab of tabs) {
          const isActive = tab === activeTab;
          tab.classList.toggle('is-active', isActive);
          tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
          /** @type {HTMLElement} */ (tab).tabIndex = isActive ? 0 : -1;
        }

        for (const panel of panels) {
          /** @type {HTMLElement} */ (panel).hidden = panel.id !== targetId;
        }
      }
    }
  );
}
