/**
 * Hot / Cold brewing instructions tabs (used inside accordions and elsewhere).
 */
if (!customElements.get('custom-brewing-tabs')) {
  customElements.define(
    'custom-brewing-tabs',
    class CustomBrewingTabs extends HTMLElement {
      /** @type {AbortController | undefined} */
      #abort;

      connectedCallback() {
        this.#abort = new AbortController();
        const { signal } = this.#abort;

        const tablist = this.querySelector('[role="tablist"]');
        const tabs = this.querySelectorAll('[role="tab"]');
        const panels = this.querySelectorAll('[role="tabpanel"]');

        if (!tablist || tabs.length < 2 || panels.length < 2) return;

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
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
              event.preventDefault();
              const i = [...tabs].indexOf(/** @type {HTMLButtonElement} */ (tab));
              const next =
                event.key === 'ArrowRight'
                  ? (i + 1) % tabs.length
                  : (i - 1 + tabs.length) % tabs.length;
              /** @type {HTMLButtonElement} */ (tabs[next]).focus();
              this.#activateTab(/** @type {HTMLButtonElement} */ (tabs[next]), tabs, panels);
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

        for (const t of tabs) {
          const isSel = t === activeTab;
          t.setAttribute('aria-selected', isSel ? 'true' : 'false');
          /** @type {HTMLElement} */ (t).tabIndex = isSel ? 0 : -1;
        }

        for (const p of panels) {
          const match = p.id === targetId;
          /** @type {HTMLElement} */ (p).hidden = !match;
        }
      }
    }
  );
}
