(function () {
  if (window.__customRangeTabsInitialized) return;
  window.__customRangeTabsInitialized = true;

  const ROOT_SELECTOR = '[data-range-tabs-root]';
  const TAB_SELECTOR = '[data-range-tab-target]';
  const PANEL_SELECTOR = '[data-range-panel-key]';

  function setTabState(root, tabs, panels, activeKey, filterEnabled) {
    tabs.forEach((tab) => {
      const isActive = filterEnabled && tab.dataset.rangeTabTarget === activeKey;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    panels.forEach((panel) => {
      panel.hidden = filterEnabled ? panel.dataset.rangePanelKey !== activeKey : false;
    });

    root.dataset.activeRangeTab = filterEnabled ? activeKey : '';
  }

  function maybeScrollToPanel(panel) {
    if (!panel) return;

    const top = window.scrollY + panel.getBoundingClientRect().top - 24;
    const isAboveViewport = top < window.scrollY;
    const isBelowViewport = panel.getBoundingClientRect().top > window.innerHeight * 0.72;

    if (isAboveViewport || isBelowViewport) {
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  function initRangeTabs(root) {
    if (!root || root.dataset.rangeTabsBound === 'true') return;

    const tabs = Array.from(root.querySelectorAll(TAB_SELECTOR));
    if (!tabs.length) return;

    const panels = Array.from(document.querySelectorAll(PANEL_SELECTOR));
    if (!panels.length) return;

    root.dataset.rangeTabsBound = 'true';

    const defaultTab = tabs.find((tab) => tab.dataset.rangeTabDefault === 'true');

    if (defaultTab) {
      setTabState(root, tabs, panels, defaultTab.dataset.rangeTabTarget, true);
    } else {
      setTabState(root, tabs, panels, '', false);
    }

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetKey = tab.dataset.rangeTabTarget;
        if (!targetKey) return;

        setTabState(root, tabs, panels, targetKey, true);

        const firstPanel = panels.find((panel) => panel.dataset.rangePanelKey === targetKey);
        maybeScrollToPanel(firstPanel);
      });
    });
  }

  function initAllRangeTabs(scope) {
    scope.querySelectorAll(ROOT_SELECTOR).forEach(initRangeTabs);
    if (scope.matches && scope.matches(ROOT_SELECTOR)) initRangeTabs(scope);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAllRangeTabs(document);
    });
  } else {
    initAllRangeTabs(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    initAllRangeTabs(event.target);
  });
})();
