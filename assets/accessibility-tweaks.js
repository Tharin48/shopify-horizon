/**
 * Small DOM fixes third-party Liquid cannot cover alone.
 * - Shopify video_tag emits a direct-child <img> fallback without alt; treat as decorative (alt "").
 * - Google Shopping Merchant widget iframe ships without title.
 */
(function accessibilityTweaks() {
  'use strict';

  const TITLE_SHOPPING = 'Google Shopping merchant content';

  function fixVideoPosterImages(root) {
    const scope = root && root.nodeType === 1 ? root : document;
    scope.querySelectorAll?.('video > img').forEach((img) => {
      if (!img.hasAttribute('alt')) {
        img.setAttribute('alt', '');
      }
    });
  }

  function fixIframeTitle(frame) {
    if (!(frame instanceof HTMLIFrameElement)) return;

    const existing = frame.getAttribute('title');
    if (existing != null && existing.trim() !== '') return;

    const src = frame.getAttribute('src') || '';
    if (frame.id === 'merchantwidgetiframe' || src.includes('google.com/shopping')) {
      frame.title = TITLE_SHOPPING;
    }
  }

  function fixIframeTitles(scope) {
    const root = scope && scope.nodeType === 1 ? scope : document.body;
    if (!root) return;

    if (root instanceof HTMLIFrameElement) {
      fixIframeTitle(root);
      return;
    }

    if (!root.querySelectorAll) return;
    root.querySelectorAll('iframe').forEach((frame) => {
      fixIframeTitle(frame);
    });
  }

  function run(scope) {
    fixVideoPosterImages(scope);
    fixIframeTitles(scope);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => run());
  } else {
    run();
  }

  document.addEventListener('shopify:section:load', (event) => {
    const target = event.target;
    if (target instanceof Element) run(target);
  });

  /** Late-injected widgets (Merchantverse, etc.). */
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (!(n instanceof Element)) continue;

        if (n.matches('iframe')) {
          fixIframeTitle(n);
          continue;
        }

        if (n.querySelector('iframe')) {
          fixIframeTitles(n);
        }
      }
    }
  });
  if (document.body) {
    mo.observe(document.body, { childList: true, subtree: true });
  }
})();
