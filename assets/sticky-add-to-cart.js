import { Component } from '@theme/component';
import { ThemeEvents, QuantitySelectorUpdateEvent } from '@theme/events';
import { morph } from '@theme/morph';
import { onAnimationEnd } from '@theme/utilities';

/**
 * @typedef {Object} ProductVariant
 * @property {string|number} [id] - Variant ID
 * @property {string} [title] - Variant title
 * @property {string} [name] - Variant name
 * @property {boolean} [available] - Whether variant is available
 * @property {Object} [featured_media] - Featured media object
 * @property {Object} [featured_media.preview_image] - Featured image data
 * @property {string} [featured_media.preview_image.src] - Image source URL
 * @property {string} [featured_media.alt] - Alt text for the image
 */

/**
 * @typedef {HTMLElement & {
 *   source: Element,
 *   destination: Element,
 *   useSourceSize: string | boolean
 * }} FlyToCart
 */

/**
 * @typedef {Object} StickyAddToCartRefs
 * @property {HTMLElement} stickyBar - The floating bar container
 * @property {HTMLButtonElement} addToCartButton - Sticky bar's add-to-cart button
 * @property {HTMLElement} quantityDisplay - Quantity display container
 * @property {HTMLElement} quantityNumber - Quantity number element
 * @property {HTMLImageElement} [productImage] - Product image element
 */

/**
 * A custom element that manages a sticky add-to-cart bar.
 * Shows when the main buy buttons scroll out of view.
 *
 * Accelerated checkout uses a real product {% form %} + payment_button (see sticky-add-to-cart-panel);
 * add-to-cart triggers the main buy row button so fly-to-cart + theme AJAX stay correct.
 *
 * @extends {Component<StickyAddToCartRefs>}
 */
class StickyAddToCartComponent extends Component {
  requiredRefs = ['stickyBar', 'addToCartButton', 'quantityDisplay', 'quantityNumber'];

  /** @type {IntersectionObserver | null} */
  #buyButtonsIntersectionObserver = null;

  /** @type {IntersectionObserver | null} */
  #mainBottomObserver = null;

  /** @type {number | undefined} */
  #resetTimeout;

  /** @type {boolean} */
  #isStuck = false;

  /** @type {number | null} */
  #animationTimeout = null;

  /** @type {AbortController} */
  #abortController = new AbortController();

  /** @type {HTMLButtonElement | null} */
  #targetAddToCartButton = null;

  /** @type {HTMLElement | null} */
  #sectionElement = null;

  /** @type {Comment | null} */
  #stickyBarAnchor = null;

  /** @type {HTMLElement | null} */
  #productContent = null;

  /** @type {number} */
  #baseProductContentPaddingBottom = 0;

  /** @type {number} */
  #currentQuantity = 1;

  /** @type {boolean} */
  #hiddenByBottom = false;

  connectedCallback() {
    super.connectedCallback();

    this.#sectionElement = this.closest('.shopify-section');
    this.#mountStickyBarPortal();
    this.#setupIntersectionObserver();

    const { signal } = this.#abortController;
    const target = this.#sectionElement;
    target?.addEventListener(ThemeEvents.variantUpdate, this.#handleVariantUpdate, { signal });
    target?.addEventListener(ThemeEvents.variantSelected, this.#handleVariantSelected, { signal });

    document.addEventListener(ThemeEvents.cartUpdate, this.#handleCartAddComplete, { signal });
    document.addEventListener(ThemeEvents.cartError, this.#handleCartAddComplete, { signal });
    document.addEventListener(ThemeEvents.quantitySelectorUpdate, this.#handleQuantityUpdate, { signal });
    window.addEventListener('resize', this.#updateReservedSpace, { signal, passive: true });

    this.#getInitialQuantity();
    requestAnimationFrame(() => {
      this.#syncStickyWalletAvailability();
      this.#updateReservedSpace();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#buyButtonsIntersectionObserver?.disconnect();
    this.#mainBottomObserver?.disconnect();
    this.#abortController.abort();
    this.#unmountStickyBarPortal();
    if (this.#animationTimeout) {
      clearTimeout(this.#animationTimeout);
    }
  }

  #mountStickyBarPortal() {
    const { stickyBar } = this.refs;
    if (!(stickyBar instanceof HTMLElement) || stickyBar.parentNode === document.body) return;

    this.#stickyBarAnchor = document.createComment('sticky-add-to-cart-anchor');
    stickyBar.parentNode?.insertBefore(this.#stickyBarAnchor, stickyBar);
    document.body.appendChild(stickyBar);
  }

  #unmountStickyBarPortal() {
    const { stickyBar } = this.refs;
    if (!(stickyBar instanceof HTMLElement) || !this.#stickyBarAnchor?.parentNode) return;

    this.#stickyBarAnchor.parentNode.insertBefore(stickyBar, this.#stickyBarAnchor);
    this.#stickyBarAnchor.remove();
    this.#stickyBarAnchor = null;
  }

  /**
   * Mirror main buy row: hide wallet column when storefront has no accelerated checkout for this variant.
   */
  #syncStickyWalletAvailability = () => {
    const productForm = this.#getProductForm();
    const stickyRoot = this.refs.stickyBar;
    const stickyBlock = /** @type {HTMLElement | null} */ (
      stickyRoot?.querySelector('[ref="acceleratedCheckoutButtonContainer"]')
    );
    const walletWrap = /** @type {HTMLElement | null} */ (stickyRoot?.querySelector('[ref="walletWrap"]'));
    const addBtn = this.refs.addToCartButton;

    if (!(addBtn instanceof HTMLButtonElement)) return;

    const mainBlock =
      productForm?.querySelector('[ref="acceleratedCheckoutButtonContainer"]') ??
      productForm?.querySelector('.accelerated-checkout-block');

    const hasWalletUi = !!(mainBlock && !mainBlock.hasAttribute('hidden'));

    if (walletWrap instanceof HTMLElement) {
      walletWrap.toggleAttribute('hidden', !hasWalletUi);
    }
    if (stickyBlock instanceof HTMLElement) {
      stickyBlock.toggleAttribute('hidden', !hasWalletUi);
    }
  };

  /**
   * Sets the quantity hidden field on the sticky wallet form (Shopify dynamic checkout reads it).
   */
  #syncStickyWalletQuantityInput() {
    const q = /** @type {HTMLInputElement | null} */ (
      this.refs.stickyBar?.querySelector('[ref="stickyWalletQuantityInput"]')
    );
    if (q) q.value = String(this.#currentQuantity);
  }

  #isMobileViewport() {
    return window.matchMedia('(max-width: 749px)').matches;
  }

  #cacheProductContent() {
    if (this.#productContent) return;

    const sectionElement = this.closest('.shopify-section');
    const productContent = /** @type {HTMLElement | null} */ (
      sectionElement?.querySelector('[data-testid="product-information"]')
    );

    if (!productContent) return;

    this.#productContent = productContent;
    this.#baseProductContentPaddingBottom = parseFloat(getComputedStyle(productContent).paddingBottom || '0') || 0;
  }

  #updateReservedSpace = () => {
    this.#cacheProductContent();
    if (!this.#productContent) return;

    const stickyBarStyles = getComputedStyle(this.refs.stickyBar);
    const stickyBarBottom = parseFloat(stickyBarStyles.bottom || '0') || 0;
    const extraSpace =
      this.#isStuck && this.#isMobileViewport() ? Math.ceil(this.refs.stickyBar.offsetHeight + stickyBarBottom) : 0;

    this.#productContent.style.paddingBottom = `${this.#baseProductContentPaddingBottom + extraSpace}px`;
  };

  /**
   * Sets up the IntersectionObserver to watch the buy buttons visibility
   */
  #setupIntersectionObserver() {
    const productForm = this.#getProductForm();
    if (!productForm) return;

    const buyButtonsBlock = productForm.closest('.buy-buttons-block');
    if (!buyButtonsBlock) return;

    this.#cacheProductContent();

    // In themes migrated from 2.0, the footer element doesn't exist
    const footer = document.querySelector('footer') ?? document.querySelector('[class*="footer-group"]');
    if (!footer) return;

    // Observer for buy buttons visibility
    this.#buyButtonsIntersectionObserver = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (!entry) return;

      // Only show sticky bar if buy buttons have been scrolled past (above viewport)
      if (!entry.isIntersecting && !this.#isStuck) {
        // Check if the element is above the viewport (scrolled past) or below (not yet reached)
        const rect = entry.target.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top < 0) {
          // Element is above viewport - show sticky bar
          this.#showStickyBar();
        }
        // If rect.top >= 0, element is below viewport - don't show sticky bar yet
      } else if (entry.isIntersecting && this.#isStuck) {
        this.#hiddenByBottom = false;
        this.#hideStickyBar();
      }
    });

    // Observer for footer visibility - hides sticky bar at page bottom
    this.#mainBottomObserver = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry) return;

        if (entry.isIntersecting && this.#isStuck) {
          this.#hiddenByBottom = true;
          this.#hideStickyBar();
        } else if (!entry.isIntersecting && this.#hiddenByBottom) {
          // Footer out of view - check if we should show sticky bar again
          const rect = buyButtonsBlock.getBoundingClientRect();
          // Only show if buy buttons are above the viewport (scrolled past)
          if (rect.bottom < 0 || rect.top < 0) {
            this.#hiddenByBottom = false;
            this.#showStickyBar();
          }
        }
      },
      {
        rootMargin: '200px 0px 0px 0px',
      }
    );

    this.#buyButtonsIntersectionObserver.observe(buyButtonsBlock);
    this.#mainBottomObserver.observe(footer);
    this.#targetAddToCartButton = productForm.querySelector('[ref="addToCartButton"]');
    this.#syncStickyWalletAvailability();
    this.#updateReservedSpace();
  }

  // Public action handlers
  /**
   * Handles the add to cart button click in the sticky bar
   */
  handleAddToCartClick = async () => {
    if (!this.#targetAddToCartButton) return;
    this.#targetAddToCartButton.dataset.puppet = 'true';
    this.#targetAddToCartButton.click();
    const cartIcon = document.querySelector('.header-actions__cart-icon');

    if (this.refs.addToCartButton.dataset.added !== 'true') {
      this.refs.addToCartButton.dataset.added = 'true';
    }

    if (!cartIcon || !this.refs.addToCartButton || !this.refs.productImage) return;
    if (this.#resetTimeout) clearTimeout(this.#resetTimeout);

    const flyToCartElement = /** @type {FlyToCart} */ (document.createElement('fly-to-cart'));
    const sourceStyles = getComputedStyle(this.refs.productImage);

    flyToCartElement.classList.add('fly-to-cart--sticky');
    flyToCartElement.style.setProperty('background-image', `url(${this.refs.productImage.src})`);
    flyToCartElement.useSourceSize = 'true';
    flyToCartElement.source = this.refs.productImage;
    flyToCartElement.destination = cartIcon;

    document.body.appendChild(flyToCartElement);

    await onAnimationEnd([this.refs.addToCartButton, flyToCartElement]);
    this.#resetTimeout = setTimeout(() => {
      this.refs.addToCartButton.removeAttribute('data-added');
    }, 800);
  };

  /**
   * Handles variant update events
   * @param {CustomEvent} event - The variant update event
   */
  #handleVariantUpdate = (event) => {
    if (event.detail.data.productId !== this.dataset.productId) return;

    const variant = event.detail.resource;

    // Get the new sticky add to cart HTML from the server response
    const newStickyAddToCart = event.detail.data.html.querySelector('sticky-add-to-cart');
    if (!newStickyAddToCart) return;

    const newStickyBar = newStickyAddToCart.querySelector('[ref="stickyBar"]');
    if (!newStickyBar) return;

    // Store current visibility state before morphing
    const currentStuck = this.refs.stickyBar.getAttribute('data-stuck') || 'false';
    const variantAvailable = newStickyAddToCart.dataset.variantAvailable;

    // Morph the entire sticky bar content
    morph(this.refs.stickyBar, newStickyBar, { childrenOnly: true });

    // Restore visibility state after morphing
    this.refs.stickyBar.setAttribute('data-stuck', currentStuck);
    this.dataset.variantAvailable = variantAvailable;

    // Update the dataset attributes with new variant info
    if (variant && variant.id) {
      this.dataset.currentVariantId = variant.id;
    }

    // Re-cache the target add to cart button after morphing
    const productForm = this.#getProductForm();
    if (productForm) {
      this.#targetAddToCartButton = productForm.querySelector('[ref="addToCartButton"]');
    }

    if (variant == null) {
      this.#handleVariantUnavailable();
    }
    // Restore the current quantity display if needed
    this.#syncStickyWalletQuantityInput();
    this.#updateButtonText();
    queueMicrotask(() => this.#syncStickyWalletAvailability());
  };

  /**
   * Handles variant selected events
   * @param {CustomEvent} event - The variant update event
   */
  #handleVariantSelected = (event) => {
    // The variant update event will follow and handle all updates via morph
    // We just update the dataset here for tracking
    const variantId = event.detail.resource?.id;
    if (!variantId) return;
    this.dataset.currentVariantId = variantId;
  };

  /**
   * Updates the variant title based on selected options when the variant is unavailable
   */
  #handleVariantUnavailable = () => {
    this.dataset.currentVariantId = '';
    const variantTitleElement = this.refs.stickyBar?.querySelector('.sticky-add-to-cart__variant');
    const productId = this.dataset.productId;
    const variantPicker = document.querySelector(`variant-picker[data-product-id="${productId}"]`);
    if (!variantTitleElement || !variantPicker) return;

    const selectedOptions = Array.from(variantPicker.querySelectorAll('input:checked'))
      .map((option) => /** @type {HTMLInputElement} */ (option).value)
      .filter((value) => value !== '')
      .join(' / ');
    if (!selectedOptions) return;
    variantTitleElement.textContent = selectedOptions;
  };

  /**
   * Handles cart add complete (success or error) - resets puppet flag
   * @param {CustomEvent} _event - The cart event (unused)
   */
  #handleCartAddComplete = (_event) => {
    // Reset the puppet flag after cart operation
    if (this.#targetAddToCartButton) {
      this.#targetAddToCartButton.dataset.puppet = 'false';
    }
  };

  /**
   * Handles quantity selector update events
   * @param {QuantitySelectorUpdateEvent} event - The quantity update event
   */
  #handleQuantityUpdate = (event) => {
    // Only respond to product page quantity selector updates, not cart drawer
    if (event.detail.cartLine) return;

    this.#currentQuantity = event.detail.quantity;
    this.#syncStickyWalletQuantityInput();
    this.#updateButtonText();
  };

  /**
   * Shows the sticky bar with animation
   */
  #showStickyBar() {
    const { stickyBar } = this.refs;
    this.#isStuck = true;
    stickyBar.dataset.stuck = 'true';
    this.#updateReservedSpace();
  }

  /**
   * Hides the sticky bar with animation
   */
  #hideStickyBar() {
    const { stickyBar } = this.refs;
    this.#isStuck = false;
    stickyBar.dataset.stuck = 'false';
    this.#updateReservedSpace();
  }

  // Helper methods
  /**
   * Gets the product form element
   * @returns {HTMLElement | null}
   */
  #getProductForm() {
    const productId = this.dataset.productId;
    if (!productId) return null;

    const sectionElement = this.#sectionElement;
    if (!sectionElement) return null;

    const sectionId = sectionElement.id.replace('shopify-section-', '');
    return document.querySelector(
      `#shopify-section-${sectionId} product-form-component[data-product-id="${productId}"]`
    );
  }

  /**
   * Gets the initial quantity from the data attribute
   */
  #getInitialQuantity() {
    this.#currentQuantity = parseInt(this.dataset.initialQuantity || '1') || 1;
    this.#syncStickyWalletQuantityInput();
    this.#updateButtonText();
  }

  /**
   * Updates the button text to include quantity
   */
  #updateButtonText() {
    const { addToCartButton, quantityDisplay, quantityNumber } = this.refs;

    const available = !addToCartButton.disabled;

    // Update the quantity number
    quantityNumber.textContent = this.#currentQuantity.toString();

    // Show/hide the quantity display based on availability and quantity
    if (available && this.#currentQuantity > 1) {
      quantityDisplay.style.display = 'inline';
    } else {
      quantityDisplay.style.display = 'none';
    }
  }
}

if (!customElements.get('sticky-add-to-cart')) {
  customElements.define('sticky-add-to-cart', StickyAddToCartComponent);
}
