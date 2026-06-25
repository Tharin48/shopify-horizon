/**
 * Yotpo lazy hydration.
 *
 * Defers Yotpo widget-instance hydration until each mount is near the viewport.
 * Mounts render without the `yotpo-widget-instance` class (carrying
 * `data-yotpo-lazy` instead) so the Yotpo loader skips them on its initial DOM
 * scan. When a mount approaches the viewport we add the class and ask Yotpo to
 * (re)initialise. This keeps review main-thread work out of the critical
 * interaction window on listing pages that render many product cards.
 *
 * Safe-by-design: if `IntersectionObserver` is unavailable the mounts activate
 * immediately, and if Yotpo has not loaded yet its own initial scan still
 * hydrates the now-classed elements once the loader runs.
 */

const LAZY_SELECTOR = '[data-yotpo-lazy]';
const ROOT_MARGIN = '400px';

/** @type {IntersectionObserver | null} */
let observer = null;
let initFrame = 0;

const requestYotpoInit = () => {
  if (initFrame) return;

  initFrame = window.requestAnimationFrame(() => {
    initFrame = 0;

    const container = /** @type {Window & { yotpoWidgetsContainer?: { initWidgets?: () => void } }} */ (window)
      .yotpoWidgetsContainer;

    if (!container || typeof container.initWidgets !== 'function') return;

    try {
      container.initWidgets();
    } catch (error) {
      console.error('Yotpo initWidgets failed:', error);
    }
  });
};

/**
 * Promotes a lazy placeholder into a live Yotpo widget mount.
 * @param {Element} element - The placeholder element.
 */
const activateMount = (element) => {
  if (!(element instanceof HTMLElement) || !element.hasAttribute('data-yotpo-lazy')) return;

  element.removeAttribute('data-yotpo-lazy');
  element.classList.add('yotpo-widget-instance');
  requestYotpoInit();
};

const getObserver = () => {
  if (observer) return observer;
  if (!('IntersectionObserver' in window)) return null;

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;

        observer?.unobserve(entry.target);
        activateMount(entry.target);
      }
    },
    { rootMargin: ROOT_MARGIN }
  );

  return observer;
};

/**
 * Observes (or immediately activates) every lazy mount within a scope.
 * @param {ParentNode} [root] - Scope to search (defaults to document).
 */
const observeMounts = (root = document) => {
  const mounts = root.querySelectorAll(LAZY_SELECTOR);
  if (!mounts.length) return;

  const activeObserver = getObserver();

  if (!activeObserver) {
    for (const mount of mounts) {
      activateMount(mount);
    }
    return;
  }

  for (const mount of mounts) {
    activeObserver.observe(mount);
  }
};

observeMounts();

document.addEventListener('shopify:section:load', (event) => {
  const { target } = event;
  observeMounts(target instanceof Element ? target : document);
});
