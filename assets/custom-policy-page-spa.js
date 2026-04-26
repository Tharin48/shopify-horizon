/// <reference path="./global.d.ts" />
/**
 * Client-side navigation between policy pages linked from custom-page-tabs (no full reload).
 * Skips in theme editor. Falls back to full navigation on errors or non-/pages/ URLs.
 */
(function policyPageSpa() {
  'use strict';

  if (window.__customPolicyPageSpaInit) {
    return;
  }
  window.__customPolicyPageSpaInit = true;

  if (window.Shopify && window.Shopify.designMode) {
    return;
  }

  const cache = new Map();
  const MAX_CACHE = 6;

  /**
   * @param {string} href
   */
  const normalizeUrl = (href) => {
    try {
      const u = new URL(href, location.href);
      u.hash = '';
      return u.href;
    } catch (e) {
      return href;
    }
  };

  /**
   * @param {string} href
   */
  const isSpaCandidate = (href) => {
    try {
      const u = new URL(href, location.href);
      if (u.origin !== location.origin) {
        return false;
      }
      return u.pathname.startsWith('/pages/');
    } catch (e) {
      return false;
    }
  };

  /**
   * @returns {HTMLElement | null}
   */
  const main = () => {
    const el = document.querySelector(
      'main#MainContent, main#MainContent.content-for-layout, main[role="main"]#MainContent'
    );
    return el instanceof HTMLElement ? el : null;
  };

  /**
   * @param {HTMLElement} root
   * @returns {Promise<void>}
   */
  const activateScripts = async (root) => {
    const scripts = Array.from(root.querySelectorAll('script'));
    for (const old of scripts) {
      if (!old.parentNode) {
        continue;
      }
      const s = document.createElement('script');
      for (const attr of old.attributes) {
        s.setAttribute(attr.name, attr.value);
      }
      if (old.getAttribute('src')) {
        s.src = old.getAttribute('src') || old.src;
        /** @type {Promise<void>} */
        const wait = new Promise((resolve, reject) => {
          s.onload = () => {
            resolve(undefined);
          };
          s.onerror = () => {
            reject();
          };
        });
        old.parentNode.replaceChild(s, old);
        try {
          await wait;
        } catch (e) {
          // continue with other scripts
        }
      } else {
        s.textContent = old.textContent;
        old.parentNode.replaceChild(s, old);
      }
    }
  };

  /**
   * `innerHTML` + cache preserve data-* "bound" flags from a previous in-memory init, but
   * event listeners are not serialized. `bindRoot` then skips; interactions break.
   * @param {HTMLElement} root
   */
  const clearStaleBindingFlags = (root) => {
    if (!root) {
      return;
    }
    for (const el of root.querySelectorAll('[data-shipping-availability-bound]')) {
      el.removeAttribute('data-shipping-availability-bound');
    }
    for (const el of root.querySelectorAll('[data-custom-faq-bound]')) {
      el.removeAttribute('data-custom-faq-bound');
    }
  };

  /**
   * @param {HTMLElement | null} m
   */
  const cacheSnapshot = (m) => {
    if (!m) {
      return;
    }
    const key = normalizeUrl(location.href);
    cache.set(key, {
      mainInner: m.innerHTML,
      title: document.title,
      template: m.getAttribute('data-template') || '',
    });
    while (cache.size > MAX_CACHE) {
      const first = cache.keys().next().value;
      cache.delete(first);
    }
  };

  /**
   * @param {string} activeUrl
   */
  const updateTabs = (activeUrl) => {
    const n = document.querySelector('nav.custom-policy-page__tabs-shell');
    if (!n) {
      return;
    }
    const absActive = normalizeUrl(activeUrl);
    for (const a of n.querySelectorAll('a.custom-policy-page__tab-link')) {
      if (!(a instanceof HTMLAnchorElement)) {
        continue;
      }
      const abs = normalizeUrl(a.href);
      const on = abs === absActive;
      a.classList.toggle('is-active', on);
      if (on) {
        a.setAttribute('aria-current', 'page');
      } else {
        a.removeAttribute('aria-current');
      }
    }
  };

  /**
   * @param {HTMLElement} m
   */
  const focusMainHeading = (m) => {
    const h1 = m.querySelector('h1');
    if (h1 && h1 !== document.activeElement) {
      if (!h1.hasAttribute('tabindex')) {
        h1.setAttribute('tabindex', '-1');
      }
      h1.focus({ preventScroll: true });
    }
  };

  /**
   * @param {HTMLElement} m
   */
  const runSectionInits = (m) => {
    if (window.CustomShippingAvailability && typeof window.CustomShippingAvailability.initAll === 'function') {
      window.CustomShippingAvailability.initAll(m);
    }
    if (window.CustomFaqAccordion && typeof window.CustomFaqAccordion.initAll === 'function') {
      window.CustomFaqAccordion.initAll(m);
    }
    if (window.CustomPolicyPageArt && typeof window.CustomPolicyPageArt.initFrameAll === 'function') {
      window.CustomPolicyPageArt.initFrameAll();
    }
    document.documentElement.dispatchEvent(
      new CustomEvent('shopify:section:load', {
        bubbles: true,
        cancelable: true,
      })
    );
  };

  let navigating = false;
  /** @type {HTMLElement | null} */
  let loadingOverlay = null;

  const ensureLoadingOverlay = () => {
    if (loadingOverlay) {
      return loadingOverlay;
    }
    const el = document.createElement('div');
    el.id = 'custom-policy-page-spa-loading';
    el.className = 'custom-policy-page-spa-loading';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-busy', 'true');
    el.setAttribute('hidden', '');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<span class="visually-hidden" id="custom-policy-page-spa-loading-label">Loading</span><div class="custom-policy-page-spa-loading__spinner" aria-hidden="true"></div>';
    el.setAttribute('aria-labelledby', 'custom-policy-page-spa-loading-label');
    document.body.appendChild(el);
    loadingOverlay = el;
    return el;
  };

  const showLoadingOverlay = () => {
    const el = ensureLoadingOverlay();
    el.removeAttribute('hidden');
    el.setAttribute('aria-hidden', 'false');
    document.documentElement.setAttribute('scroll-lock', '');
  };

  const hideLoadingOverlay = () => {
    if (!loadingOverlay) {
      return;
    }
    loadingOverlay.setAttribute('hidden', '');
    loadingOverlay.setAttribute('aria-hidden', 'true');
    document.documentElement.removeAttribute('scroll-lock');
  };

  /**
   * @param {string} targetUrl
   * @param {{ replace?: boolean }} [opts]
   * @returns {Promise<void>}
   */
  const navigate = async (targetUrl, opts = {}) => {
    const m = main();
    if (!m) {
      window.location.assign(targetUrl);
      return;
    }

    const key = normalizeUrl(targetUrl);
    if (navigating) {
      return;
    }
    navigating = true;
    m.setAttribute('aria-busy', 'true');
    m.style.opacity = '0.96';

    try {
      cacheSnapshot(m);
      const cached = cache.get(key);
      if (cached) {
        m.innerHTML = cached.mainInner;
        if (cached.template) {
          m.setAttribute('data-template', cached.template);
        }
        document.title = cached.title;
        clearStaleBindingFlags(m);
        await activateScripts(m);
        runSectionInits(m);
      } else {                                                                                                                                              
        showLoadingOverlay();
        try {
          const res = await fetch(key, {
            credentials: 'same-origin',
            headers: {
              Accept: 'text/html',
              'X-Requested-With': 'XMLHttpRequest',
            },
          });
          if (!res.ok) {
            window.location.assign(key);
            return;
          }
          const html = await res.text();
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const next = doc.querySelector('main#MainContent, main.content-for-layout[role="main"], main[role="main"]');
          if (!next) {
            window.location.assign(key);
            return;
          }
          m.innerHTML = next.innerHTML;
          const t = next.getAttribute('data-template');
          if (t) {
            m.setAttribute('data-template', t);
          }
          const ti = doc.querySelector('title');
          if (ti && ti.textContent) {
            document.title = ti.textContent;
          }
          clearStaleBindingFlags(m);
          await activateScripts(m);
          runSectionInits(m);
          cache.set(key, {
            mainInner: m.innerHTML,
            title: document.title,
            template: m.getAttribute('data-template') || '',
          });
          while (cache.size > MAX_CACHE) {
            const first = cache.keys().next().value;
            cache.delete(first);
          }
        } finally {
          hideLoadingOverlay();
        }
      }

      if (opts.replace) {
        history.replaceState({ policySpa: true, u: key }, document.title, key);
      } else {
        history.pushState({ policySpa: true, u: key }, document.title, key);
      }
      updateTabs(key);
      window.scrollTo({ top: 0, behavior: 'auto' });
      requestAnimationFrame(() => {
        focusMainHeading(m);
        m.removeAttribute('aria-busy');
        m.style.opacity = '';
      });
    } catch (e) {
      hideLoadingOverlay();
      window.location.assign(targetUrl);
    } finally {
      navigating = false;
    }
  };

  document.addEventListener(
    'click',
    (e) => {
      const t = e.target;
      if (!(t instanceof Element)) {
        return;
      }
      const a = t.closest('a.custom-policy-page__tab-link');
      if (!a || !(a instanceof HTMLAnchorElement)) {
        return;
      }
      if (a.classList.contains('is-active')) {
        e.preventDefault();
        return;
      }
      if (e.defaultPrevented) {
        return;
      }
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const href = a.getAttribute('href');
      if (!href || !isSpaCandidate(href)) {
        return;
      }
      e.preventDefault();
      const targetUrl = normalizeUrl(a.href);
      if (targetUrl === normalizeUrl(location.href)) {
        return;
      }
      void navigate(targetUrl, { replace: false });
    },
    true
  );

  window.addEventListener('popstate', (e) => {
    if (navigating) {
      return;
    }
    if (!e.state || !e.state.policySpa) {
      return;
    }
    const key = normalizeUrl(location.href);
    const c = cache.get(key);
    if (!c) {
      window.location.reload();
      return;
    }
    const m = main();
    if (!m) {
      window.location.reload();
      return;
    }
    void (async () => {
      navigating = true;
      m.setAttribute('aria-busy', 'true');
      try {
        m.innerHTML = c.mainInner;
        if (c.template) {
          m.setAttribute('data-template', c.template);
        }
        document.title = c.title;
        clearStaleBindingFlags(m);
        await activateScripts(m);
        runSectionInits(m);
        updateTabs(key);
        window.scrollTo({ top: 0, behavior: 'auto' });
        requestAnimationFrame(() => {
          focusMainHeading(m);
        });
      } finally {
        m.removeAttribute('aria-busy');
        navigating = false;
      }
    })();
  });

  const boot = () => {
    const m = main();
    if (!m) {
      return;
    }
    cacheSnapshot(m);
    history.replaceState({ policySpa: true, u: normalizeUrl(location.href) }, document.title, location.href);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
