import { isLowPowerDevice } from '@theme/utilities';

const SELECTOR = '[data-tea-format-selector]';
const CARD_SELECTOR = `${SELECTOR} .tea-format-card[href]`;
const PRODUCT_SECTION_SELECTOR = '[data-ajax-product-section]';
const SHOPIFY_SECTION_PREFIX = 'shopify-section-';
const LOOP_CONTAINER_SELECTOR = '[id^="loop-widget-container-id-"]';
const LOOP_READY_SELECTOR =
  '.loop-widget-purchase-option, .loop-w-btn-group-purchase-option, [id^="loop-widget-purchase-option-id-"]';
const COMPONENT_READY_TIMEOUT = 2500;
const LOOP_READY_TIMEOUT = 12000;

/** @typedef {{ html: string, productId: string, productUrl: string, productTitle: string, documentTitle: string }} ProductSnapshot */

/** @type {Map<string, ProductSnapshot>} */
const productSectionCache = new Map();

/** @type {Map<string, { controller: AbortController, promise: Promise<ProductSnapshot> }>} */
const inFlightRequests = new Map();

const attemptedPrefetchUrls = new Set();

/** @type {AbortController | null} */
let activeNavigationController = null;

/** @type {AbortController | null} */
let activeFetchController = null;

/** @type {AbortController | null} */
let activeLoopMonitorController = null;

let activeRequestId = 0;
let initialized = false;

/**
 * @param {string} value
 * @returns {string | null}
 */
function normalizeProductUrl(value) {
  try {
    const url = new URL(value, window.location.href);
    if (url.origin !== window.location.origin) return null;

    url.hash = '';
    url.searchParams.delete('section_id');
    url.searchParams.delete('sections');
    return url.href;
  } catch {
    return null;
  }
}

/**
 * @param {EventTarget | null} target
 * @returns {HTMLAnchorElement | null}
 */
function getCard(target) {
  if (!(target instanceof Element)) return null;
  const card = target.closest(CARD_SELECTOR);
  return card instanceof HTMLAnchorElement ? card : null;
}

/** @returns {HTMLElement | null} */
function getCurrentProductSection() {
  const section = document.querySelector(PRODUCT_SECTION_SELECTOR);
  return section instanceof HTMLElement ? section : null;
}

/**
 * @param {HTMLElement} section
 * @returns {string | null}
 */
function getSectionId(section) {
  const id = section.dataset.productSectionId;
  return id ? id.replace(new RegExp(`^${SHOPIFY_SECTION_PREFIX}`), '') : null;
}

/**
 * @param {string} destinationUrl
 * @param {string} sectionId
 * @returns {string}
 */
function buildSectionRequestUrl(destinationUrl, sectionId) {
  const url = new URL(destinationUrl);
  url.searchParams.set('section_id', sectionId);
  return url.href;
}

/**
 * @param {string} html
 * @param {string} sectionId
 * @param {string} destinationUrl
 * @returns {ProductSnapshot}
 */
function parseSnapshot(html, sectionId, destinationUrl) {
  const documentFragment = new DOMParser().parseFromString(html, 'text/html');
  const shopifySection = documentFragment.getElementById(`${SHOPIFY_SECTION_PREFIX}${sectionId}`);
  const productSection = shopifySection?.querySelector(PRODUCT_SECTION_SELECTOR);

  if (!(shopifySection instanceof HTMLElement) || !(productSection instanceof HTMLElement)) {
    throw new Error('The rendered product section is missing its validated AJAX wrapper.');
  }

  if (getSectionId(productSection) !== sectionId) {
    throw new Error('The rendered product section ID does not match the current section.');
  }

  const productId = productSection.dataset.productId || '';
  const productTitle = productSection.dataset.productTitle || '';
  const productUrl = normalizeProductUrl(productSection.dataset.productUrl || '');
  const expectedUrl = new URL(destinationUrl);

  if (!productId || !productTitle || !productUrl || new URL(productUrl).pathname !== expectedUrl.pathname) {
    throw new Error('The rendered product section contains invalid destination product data.');
  }

  return {
    html: shopifySection.outerHTML,
    productId,
    productUrl,
    productTitle,
    documentTitle: productSection.dataset.documentTitle || productTitle,
  };
}

/**
 * @param {string} destinationUrl
 * @param {string} sectionId
 * @returns {{ controller: AbortController, promise: Promise<ProductSnapshot> }}
 */
function requestSnapshot(destinationUrl, sectionId) {
  const cached = productSectionCache.get(destinationUrl);
  if (cached) {
    return { controller: new AbortController(), promise: Promise.resolve(cached) };
  }

  const pending = inFlightRequests.get(destinationUrl);
  if (pending) return pending;

  const controller = new AbortController();
  const requestUrl = buildSectionRequestUrl(destinationUrl, sectionId);

  const promise = fetch(requestUrl, {
    credentials: 'same-origin',
    headers: { Accept: 'text/html' },
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Product section request failed with status ${response.status}.`);
      return response.text();
    })
    .then((html) => parseSnapshot(html, sectionId, destinationUrl))
    .then((snapshot) => {
      productSectionCache.set(destinationUrl, snapshot);
      productSectionCache.set(snapshot.productUrl, snapshot);
      return snapshot;
    })
    .finally(() => {
      const currentRequest = inFlightRequests.get(destinationUrl);
      if (currentRequest?.controller === controller) inFlightRequests.delete(destinationUrl);
    });

  const request = { controller, promise };
  inFlightRequests.set(destinationUrl, request);
  return request;
}

/** @returns {boolean} */
function shouldAvoidPrefetch() {
  if (isLowPowerDevice()) return true;

  const connection = /** @type {Navigator & { connection?: { saveData?: boolean, effectiveType?: string } }} */ (
    navigator
  ).connection;

  return connection?.saveData === true || connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g';
}

/** @param {HTMLAnchorElement} card */
function prefetchCard(card) {
  if (card.getAttribute('aria-current') === 'page' || shouldAvoidPrefetch()) return;

  const destinationUrl = normalizeProductUrl(card.href);
  const currentSection = getCurrentProductSection();
  const sectionId = currentSection ? getSectionId(currentSection) : null;

  if (!destinationUrl || !sectionId || attemptedPrefetchUrls.has(destinationUrl)) return;
  if (destinationUrl === normalizeProductUrl(currentSection?.dataset.productUrl || window.location.href)) return;

  attemptedPrefetchUrls.add(destinationUrl);
  void requestSnapshot(destinationUrl, sectionId).promise.catch(() => {
    // Prefetch is optional. A later click can retry and the real link remains intact.
  });
}

/**
 * @param {MouseEvent} event
 * @param {HTMLAnchorElement} card
 * @returns {boolean}
 */
function isPlainNavigation(event, card) {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (card.hasAttribute('download')) return false;

  const target = card.getAttribute('target');
  return !target || target.toLowerCase() === '_self';
}

/**
 * @param {HTMLElement} productSection
 * @param {HTMLAnchorElement | null} card
 */
function setLoadingState(productSection, card) {
  productSection.classList.add('is-product-switching');
  productSection.setAttribute('aria-busy', 'true');

  productSection.querySelectorAll('.tea-format-card.is-product-switching').forEach((item) => {
    item.classList.remove('is-product-switching');
  });
  card?.classList.add('is-product-switching');
}

/** @param {HTMLElement} productSection */
function clearLoadingState(productSection) {
  productSection.classList.remove('is-product-switching');
  productSection.removeAttribute('aria-busy');
  productSection.querySelectorAll('.tea-format-card.is-product-switching').forEach((card) => {
    card.classList.remove('is-product-switching');
  });
}

/**
 * @param {HTMLScriptElement} script
 * @param {{ isolate?: boolean }} [options]
 */
function recreateScript(script, options = {}) {
  if (!script.parentElement) return;

  const replacement = document.createElement('script');
  Array.from(script.attributes).forEach((attribute) => replacement.setAttribute(attribute.name, attribute.value));
  replacement.textContent = options.isolate ? `(() => {\n${script.textContent}\n})();` : script.textContent;
  script.replaceWith(replacement);
}

/**
 * Recreates external app-block scripts using Horizon's section morphing pattern.
 * Loop is different: its external runtime is page-global, while an inline script
 * registers the newly rendered product and calls startLoopWidget(productId).
 * @param {HTMLElement} productSection
 */
function reactivateAppBlockScripts(productSection) {
  const loopBlocks = new Set(
    Array.from(productSection.querySelectorAll(LOOP_CONTAINER_SELECTOR))
      .map((container) => container.closest('.shopify-app-block'))
      .filter((block) => block instanceof HTMLElement)
  );
  const loopRuntime = /** @type {Window & { LoopSubscriptions?: { startLoopWidget?: (productId: string | number) => void } }} */ (
    window
  ).LoopSubscriptions;

  productSection.querySelectorAll('.shopify-app-block script[src]').forEach((script) => {
    if (!(script instanceof HTMLScriptElement)) return;

    const belongsToLoop = Array.from(loopBlocks).some((block) => block.contains(script));
    if (belongsToLoop && typeof loopRuntime?.startLoopWidget === 'function') return;
    recreateScript(script);
  });

  loopBlocks.forEach((block) => {
    block.querySelectorAll('script:not([src])').forEach((script) => {
      if (!(script instanceof HTMLScriptElement)) return;

      const type = script.type.trim().toLowerCase();
      if (type && type !== 'text/javascript' && type !== 'application/javascript') return;
      recreateScript(script, { isolate: true });
    });
  });
}

/**
 * @param {HTMLElement} productSection
 * @param {AbortSignal} signal
 * @returns {Promise<void>}
 */
function waitForRequiredComponents(productSection, signal) {
  const componentNames = [
    'variant-picker',
    'product-form-component',
    'add-to-cart-component',
    'quantity-selector-component',
    'media-gallery',
    'zoom-dialog',
    'accordion-custom',
    'sticky-add-to-cart',
  ].filter((name) => productSection.querySelector(name));

  const definitions = componentNames.map((name) => customElements.whenDefined(name));
  if (!definitions.length) return Promise.resolve();

  return withTimeout(Promise.all(definitions).then(() => undefined), COMPONENT_READY_TIMEOUT, signal);
}

/**
 * @param {HTMLElement} productSection
 * @param {AbortSignal} signal
 * @returns {Promise<void>}
 */
function waitForLoopWidget(productSection, signal) {
  if (signal.aborted) return Promise.reject(new DOMException('Product switch aborted.', 'AbortError'));

  const initialContainer = productSection.querySelector(LOOP_CONTAINER_SELECTOR);
  if (!(initialContainer instanceof HTMLElement)) return Promise.resolve();

  const isReady = () => {
    const loopContainer = productSection.querySelector(LOOP_CONTAINER_SELECTOR);
    const loopBlock = loopContainer?.closest('.shopify-app-block');
    const skeleton = loopBlock?.querySelector('.loop-widget-skeleton-container');

    return (
      loopContainer instanceof HTMLElement &&
      !skeleton &&
      (loopContainer.classList.contains('loop-display-none') ||
        Boolean(loopContainer.querySelector(LOOP_READY_SELECTOR)))
    );
  };

  if (isReady()) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let settled = false;
    const observer = new MutationObserver(() => {
      if (isReady()) finish(resolve);
    });
    const timeout = window.setTimeout(
      () => finish(() => reject(new Error('Loop subscription initialization timed out.'))),
      LOOP_READY_TIMEOUT
    );
    const handleAbort = () => finish(() => reject(new DOMException('Product switch aborted.', 'AbortError')));
    /** @param {() => void} callback */
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(timeout);
      signal.removeEventListener('abort', handleAbort);
      callback();
    };

    signal.addEventListener('abort', handleAbort, { once: true });
    observer.observe(productSection, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  });
}

/**
 * Loop fetches its widget configuration and selling-plan data independently.
 * Do not block or undo a successful product switch while that work completes.
 * @param {HTMLElement} productSection
 */
function monitorLoopWidget(productSection) {
  activeLoopMonitorController?.abort();
  const controller = new AbortController();
  activeLoopMonitorController = controller;

  void waitForLoopWidget(productSection, controller.signal)
    .then(() => {
      if (controller.signal.aborted || !productSection.isConnected) return;

      const loopInfo = /** @type {Window & { DilmahLoopInfo?: { refreshFromSettings?: () => void } }} */ (window)
        .DilmahLoopInfo;
      if (typeof loopInfo?.refreshFromSettings === 'function') loopInfo.refreshFromSettings();
    })
    .catch((error) => {
      if (controller.signal.aborted || !productSection.isConnected) return;
      console.warn('Loop widget did not finish initializing after the AJAX product switch.', error);
    })
    .finally(() => {
      if (activeLoopMonitorController === controller) activeLoopMonitorController = null;
    });
}

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} duration
 * @param {AbortSignal} signal
 * @returns {Promise<T>}
 */
function withTimeout(promise, duration, signal) {
  if (signal.aborted) return Promise.reject(new DOMException('Product switch aborted.', 'AbortError'));

  return new Promise((resolve, reject) => {
    let settled = false;
    /**
     * @param {(value?: any) => void} callback
     * @param {any} value
     */
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      signal.removeEventListener('abort', handleAbort);
      callback(value);
    };
    const timeout = window.setTimeout(
      () => finish(reject, new Error('Product component initialization timed out.')),
      duration
    );
    const handleAbort = () => finish(reject, new DOMException('Product switch aborted.', 'AbortError'));
    signal.addEventListener('abort', handleAbort, { once: true });
    promise.then((value) => finish(resolve, value), (error) => finish(reject, error));
  });
}

/** @param {HTMLElement} productSection */
function initializePaymentButtons(productSection) {
  if (!productSection.querySelector('shopify-payment-button, .shopify-payment-button')) return;

  const paymentButton = /** @type {Window & { Shopify?: { PaymentButton?: { init?: () => void } } }} */ (window).Shopify
    ?.PaymentButton;
  if (typeof paymentButton?.init === 'function') paymentButton.init();
}

/**
 * @param {ProductSnapshot} snapshot
 * @param {string} sectionId
 * @returns {HTMLElement}
 */
function createProductSection(snapshot, sectionId) {
  const parsed = new DOMParser().parseFromString(snapshot.html, 'text/html');
  const wrapper = parsed.getElementById(`${SHOPIFY_SECTION_PREFIX}${sectionId}`);
  const productSection = wrapper?.querySelector(PRODUCT_SECTION_SELECTOR);

  if (!(productSection instanceof HTMLElement)) throw new Error('Cached product section HTML is invalid.');
  return productSection;
}

/**
 * @param {ProductSnapshot} snapshot
 * @param {string} destinationUrl
 * @param {string} sectionId
 * @param {AbortSignal} signal
 * @param {boolean} restoreFocus
 * @returns {Promise<HTMLElement>}
 */
async function applySnapshot(snapshot, destinationUrl, sectionId, signal, restoreFocus) {
  const currentSection = getCurrentProductSection();
  if (!currentSection) throw new Error('The current product section is unavailable.');

  const newSection = createProductSection(snapshot, sectionId);
  newSection.classList.add('is-product-switching');
  newSection.setAttribute('aria-busy', 'true');
  currentSection.replaceWith(newSection);

  reactivateAppBlockScripts(newSection);
  newSection.dispatchEvent(
    new CustomEvent('shopify:section:load', {
      bubbles: true,
      detail: { sectionId },
    })
  );

  await waitForRequiredComponents(newSection, signal);
  initializePaymentButtons(newSection);
  monitorLoopWidget(newSection);

  if (signal.aborted) throw new DOMException('Product switch aborted.', 'AbortError');

  document.title = snapshot.documentTitle;
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical instanceof HTMLLinkElement) canonical.href = snapshot.productUrl;

  clearLoadingState(newSection);

  const liveRegion = newSection.querySelector('[data-ajax-product-live]');
  if (liveRegion instanceof HTMLElement) liveRegion.textContent = `Now viewing ${snapshot.productTitle}`;

  if (restoreFocus) {
    const selectedCard = newSection.querySelector(`${CARD_SELECTOR}[aria-current="page"]`);
    if (selectedCard instanceof HTMLElement) selectedCard.focus({ preventScroll: true });
  }

  return newSection;
}

/**
 * @param {string} destinationUrl
 * @param {{ pushHistory?: boolean, restoreFocus?: boolean }} [options]
 */
async function switchProduct(destinationUrl, options = {}) {
  const currentSection = getCurrentProductSection();
  const sectionId = currentSection ? getSectionId(currentSection) : null;
  if (!currentSection || !sectionId) {
    window.location.assign(destinationUrl);
    return;
  }

  const requestId = ++activeRequestId;
  activeNavigationController?.abort();
  activeFetchController?.abort();
  activeLoopMonitorController?.abort();
  activeNavigationController = new AbortController();

  const matchingCard = Array.from(currentSection.querySelectorAll(CARD_SELECTOR)).find(
    (card) => card instanceof HTMLAnchorElement && normalizeProductUrl(card.href) === destinationUrl
  );
  setLoadingState(currentSection, matchingCard instanceof HTMLAnchorElement ? matchingCard : null);

  try {
    const cached = productSectionCache.get(destinationUrl);
    let snapshot = cached;

    if (!snapshot) {
      const request = requestSnapshot(destinationUrl, sectionId);
      activeFetchController = request.controller;
      snapshot = await request.promise;
    }

    if (requestId !== activeRequestId || activeNavigationController.signal.aborted) return;

    const newSection = await applySnapshot(
      snapshot,
      destinationUrl,
      sectionId,
      activeNavigationController.signal,
      options.restoreFocus === true
    );

    if (requestId !== activeRequestId || activeNavigationController.signal.aborted) return;

    if (options.pushHistory !== false) {
      history.pushState({ ...(history.state || {}), ajaxProduct: true, productUrl: destinationUrl }, '', destinationUrl);
    }

    document.dispatchEvent(
      new CustomEvent('product:ajax-switched', {
        detail: {
          productUrl: destinationUrl,
          productId: snapshot.productId,
          section: newSection,
        },
      })
    );
  } catch (error) {
    if (requestId !== activeRequestId || (error instanceof DOMException && error.name === 'AbortError')) return;
    window.location.assign(destinationUrl);
  } finally {
    if (requestId === activeRequestId) {
      activeFetchController = null;
      activeNavigationController = null;
    }
  }
}

function initialize() {
  const productSection = getCurrentProductSection();
  const sectionId = productSection ? getSectionId(productSection) : null;
  const shopifySection = productSection?.closest('.shopify-section');
  const productUrl = normalizeProductUrl(productSection?.dataset.productUrl || window.location.href);

  if (!productSection || !sectionId || !(shopifySection instanceof HTMLElement) || !productUrl) return;

  const initialSnapshot = parseSnapshot(shopifySection.outerHTML, sectionId, productUrl);
  initialSnapshot.documentTitle = document.title;
  productSectionCache.set(productUrl, initialSnapshot);

  history.replaceState({ ...(history.state || {}), ajaxProduct: true, productUrl }, '', window.location.href);
  initialized = true;
}

initialize();

if (initialized) {
  document.addEventListener(
    'pointerover',
    (event) => {
      const card = getCard(event.target);
      if (!card) return;

      const previousTarget = event.relatedTarget;
      if (previousTarget instanceof Node && card.contains(previousTarget)) return;
      prefetchCard(card);
    },
    { passive: true }
  );

  document.addEventListener('focusin', (event) => {
    const card = getCard(event.target);
    if (card) prefetchCard(card);
  });

  document.addEventListener(
    'touchstart',
    (event) => {
      const card = getCard(event.target);
      if (card) prefetchCard(card);
    },
    { passive: true }
  );

  document.addEventListener('click', (event) => {
    if (!(event instanceof MouseEvent)) return;

    const card = getCard(event.target);
    if (!card || !isPlainNavigation(event, card) || card.getAttribute('aria-current') === 'page') return;

    const destinationUrl = normalizeProductUrl(card.href);
    if (!destinationUrl) return;

    event.preventDefault();
    void switchProduct(destinationUrl, { pushHistory: true, restoreFocus: event.detail === 0 });
  });

  window.addEventListener('popstate', (event) => {
    const destinationUrl = normalizeProductUrl(event.state?.productUrl || window.location.href);
    if (!destinationUrl) {
      window.location.assign(window.location.href);
      return;
    }

    const currentUrl = normalizeProductUrl(getCurrentProductSection()?.dataset.productUrl || '');
    if (destinationUrl === currentUrl) return;

    // History entries without our `ajaxProduct` flag (e.g. a collection or
    // search results page the customer navigated here from) are never a
    // product-format switch. Navigate immediately instead of attempting - and
    // failing - to fetch/parse a product AJAX snapshot from that URL first.
    if (!event.state?.ajaxProduct) {
      window.location.assign(destinationUrl);
      return;
    }

    void switchProduct(destinationUrl, { pushHistory: false, restoreFocus: false });
  });
}
