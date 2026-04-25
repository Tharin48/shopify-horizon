/**
 * Prefetch other policy tab URLs as early as possible (full page loads unchanged).
 * - Injects <link rel="prefetch"> immediately when this script runs (defer, DOM ready)
 * - Re-warms on pointer, touch, and focus (before click)
 * - Skips in theme design mode, Save-Data, and de-duplicates by URL
 */
(function policyPageTabsPrefetch() {
  'use strict';

  if (window.__customPolicyPageTabsPrefetchDone) {
    return;
  }
  window.__customPolicyPageTabsPrefetchDone = true;

  if (window.Shopify && window.Shopify.designMode) {
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.connection && navigator.connection.saveData) {
    return;
  }

  const seen = new Set();

  const addPrefetch = (href) => {
    if (!href) {
      return;
    }
    let abs;
    try {
      abs = new URL(href, document.baseURI).href;
    } catch (e) {
      return;
    }
    if (seen.has(abs)) {
      return;
    }
    const here = new URL(document.baseURI);
    const there = new URL(abs);
    if (there.origin === here.origin && there.pathname === here.pathname && there.search === here.search) {
      return;
    }
    seen.add(abs);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'document';
    link.href = abs;
    document.head.appendChild(link);
  };

  const wireIntentPrefetch = (anchor) => {
    if (anchor.dataset.policyTabPrefetchWired) {
      return;
    }
    anchor.dataset.policyTabPrefetchWired = 'true';
    const warm = () => {
      addPrefetch(anchor.getAttribute('href'));
    };
    anchor.addEventListener('pointerenter', warm, { passive: true });
    anchor.addEventListener('touchstart', warm, { passive: true, capture: true });
    anchor.addEventListener('focusin', warm, { passive: true });
  };

  const run = () => {
    const navs = document.querySelectorAll('nav.custom-policy-page__tabs-shell');
    for (const nav of navs) {
      for (const a of nav.querySelectorAll('a.custom-policy-page__tab-link:not(.is-active)')) {
        addPrefetch(a.getAttribute('href'));
        wireIntentPrefetch(a);
      }
    }
  };

  run();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  }
})();
