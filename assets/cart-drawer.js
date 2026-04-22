import { DialogComponent, DialogOpenEvent, DialogCloseEvent } from '@theme/dialog';
import { CartAddEvent } from '@theme/events';
import { isMobileBreakpoint, isMinWidth990 } from '@theme/utilities';

const TEMP_CART_DEBUG_PREFIX = '[TEMP CART DEBUG]';

const shouldLogTempCartDebug = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  return Boolean(window.__HORIZON_TEMP_CART_DEBUG__ || document.querySelector('[data-catalog-ajax]'));
};

/**
 * @param {...unknown} args
 * @returns {void}
 */
function logTempCartDebug(...args) {
  if (!shouldLogTempCartDebug()) return;
  console.debug(TEMP_CART_DEBUG_PREFIX, ...args);
}

/**
 * A custom element that manages a cart drawer.
 *
 * @typedef {object} Refs
 * @property {HTMLDialogElement} dialog - The dialog element.
 * @property {HTMLElement} [liveRegion] - The live region for cart announcements when dialog is open.
 *
 * @extends {DialogComponent}
 */
class CartDrawerComponent extends DialogComponent {
  /** @type {number} */
  #summaryThreshold = 0.5;

  /** @type {AbortController | null} */
  #historyAbortController = null;

  connectedCallback() {
    super.connectedCallback();
    logTempCartDebug('cart drawer init', {
      autoOpen: this.hasAttribute('auto-open'),
    });
    document.addEventListener(CartAddEvent.eventName, this.#handleCartAdd);
    this.addEventListener(DialogOpenEvent.eventName, this.#updateStickyState);
    this.addEventListener(DialogOpenEvent.eventName, this.#handleHistoryOpen);
    this.addEventListener(DialogCloseEvent.eventName, this.#handleHistoryClose);

    if (history.state?.cartDrawerOpen) {
      history.replaceState(null, '');
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener(CartAddEvent.eventName, this.#handleCartAdd);
    this.removeEventListener(DialogOpenEvent.eventName, this.#updateStickyState);
    this.removeEventListener(DialogOpenEvent.eventName, this.#handleHistoryOpen);
    this.removeEventListener(DialogCloseEvent.eventName, this.#handleHistoryClose);
    this.#historyAbortController?.abort();
  }

  #handleHistoryOpen = () => {
    if (!isMobileBreakpoint()) return;

    if (!history.state?.cartDrawerOpen) {
      history.pushState({ cartDrawerOpen: true }, '');
    }

    this.#historyAbortController = new AbortController();
    window.addEventListener('popstate', this.#handlePopState, { signal: this.#historyAbortController.signal });
  };

  #handleHistoryClose = () => {
    this.#historyAbortController?.abort();
    if (history.state?.cartDrawerOpen) {
      history.back();
    }
  };

  #handlePopState = async () => {
    if (this.refs.dialog?.open) {
      this.refs.dialog.style.setProperty('--dialog-drawer-closing-animation', 'none');
      await this.closeDialog();
      this.refs.dialog.style.removeProperty('--dialog-drawer-closing-animation');
    }
  };

  /**
   * Handles cart add events - opens drawer if auto-open (990px+ only) and announces count when open.
   * @param {Event} event
   */
  #handleCartAdd = (event) => {
    const detail =
      /** @type {{ resource?: { item_count?: number }; sourceId?: string; data?: { source?: string; itemCount?: number; sections?: unknown } }} */ (
        'detail' in event ? event.detail : undefined
      ) || {};
    logTempCartDebug('cart drawer open trigger', {
      source: detail.data?.source || null,
      sourceId: detail.sourceId || null,
      itemCount: detail.data?.itemCount || null,
      hasSections: Boolean(detail.data?.sections),
      autoOpen: this.hasAttribute('auto-open'),
      isMinWidth990: isMinWidth990(),
    });

    if (this.hasAttribute('auto-open') && isMinWidth990()) {
      logTempCartDebug('cart drawer showDialog call', {
        source: 'cart:add event',
      });
      this.showDialog();
    }

    this.#announceCartCount(detail.resource?.item_count);
  };

  /**
   * Announces cart count to screen readers when dialog is open.
   * @param {number | undefined} cartCount
   */
  #announceCartCount(cartCount) {
    const liveRegion = /** @type {HTMLElement | undefined} */ (this.refs.liveRegion);
    if (!this.refs.dialog?.open || !liveRegion || cartCount === undefined) return;

    liveRegion.textContent = `${Theme.translations.cart_count}: ${cartCount}`;
  }

  open() {
    logTempCartDebug('cart drawer showDialog call', {
      source: 'header cart trigger',
    });
    this.showDialog();

    /**
     * Close cart drawer when installments CTA is clicked to avoid overlapping dialogs
     */
    customElements.whenDefined('shopify-payment-terms').then(() => {
      const installmentsContent = document.querySelector('shopify-payment-terms')?.shadowRoot;
      const cta = installmentsContent?.querySelector('#shopify-installments-cta');
      cta?.addEventListener('click', this.closeDialog, { once: true });
    });
  }

  close() {
    this.closeDialog();
  }

  #updateStickyState() {
    const { dialog } = /** @type {Refs} */ (this.refs);
    if (!dialog) return;

    // Refs do not cross nested `*-component` boundaries (e.g., `cart-items-component`), so we query within the dialog.
    const content = dialog.querySelector('.cart-drawer__content');
    const summary = dialog.querySelector('.cart-drawer__summary');

    if (!content || !summary) {
      // Ensure the dialog doesn't get stuck in "unsticky" mode when summary disappears (e.g., empty cart).
      dialog.setAttribute('cart-summary-sticky', 'false');
      return;
    }

    const drawerHeight = dialog.getBoundingClientRect().height;
    const summaryHeight = summary.getBoundingClientRect().height;
    const ratio = summaryHeight / drawerHeight;
    dialog.setAttribute('cart-summary-sticky', ratio > this.#summaryThreshold ? 'false' : 'true');
    logTempCartDebug('cart drawer sticky state updated', {
      drawerHeight,
      summaryHeight,
      ratio,
    });
  }
}

if (!customElements.get('cart-drawer-component')) {
  customElements.define('cart-drawer-component', CartDrawerComponent);
}
