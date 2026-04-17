import { Component } from '@theme/component';
import { ThemeEvents, VariantUpdateEvent, ZoomMediaSelectedEvent } from '@theme/events';

/**
 * A custom element that renders a media gallery.
 *
 * @typedef {object} Refs
 * @property {import('./zoom-dialog').ZoomDialog} [zoomDialogComponent] - The zoom dialog component.
 * @property {import('./slideshow').Slideshow} [slideshow] - The slideshow component.
 * @property {HTMLElement[]} [media] - The media elements.
 *
 * @extends Component<Refs>
 */
export class MediaGallery extends Component {
  connectedCallback() {
    super.connectedCallback();

    const { signal } = this.#controller;
    const target = this.closest('.shopify-section, dialog');

    target?.addEventListener(ThemeEvents.variantUpdate, this.#handleVariantUpdate, { signal });
    this.refs.zoomDialogComponent?.addEventListener(ThemeEvents.zoomMediaSelected, this.#handleZoomMediaSelected, {
      signal,
    });
  }

  #controller = new AbortController();

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#controller.abort();
  }

  /**
   * Handles a variant update event by replacing the current media gallery with a new one.
   *
   * @param {VariantUpdateEvent} event - The variant update event.
   */
  #handleVariantUpdate = (event) => {
    const source = event.detail.data.html;

    if (!source) return;
    const newMediaGallery = source.querySelector('media-gallery');

    if (!newMediaGallery) return;

    this.replaceWith(newMediaGallery);
  };

  /**
   * Handles the 'zoom-media:selected' event.
   * @param {ZoomMediaSelectedEvent} event - The zoom-media:selected event.
   */
  #handleZoomMediaSelected = async (event) => {
    this.slideshow?.select(event.detail.index, undefined, { animate: false });
  };

  /**
   * Zooms the media gallery.
   *
   * @param {number} index - The index of the media to zoom.
   * @param {PointerEvent} event - The pointer event.
   */
  zoom(index, event) {
    this.refs.zoomDialogComponent?.open(index, event);
  }

  /**
   * Preloads an image.
   * @param {number} index - The index of the media to preload.
   */
  preloadImage(index) {
    const zoomDialogMedia = this.refs.zoomDialogComponent?.refs.media[index];
    if (!zoomDialogMedia) return;

    this.refs.zoomDialogComponent?.loadHighResolutionImage(zoomDialogMedia);
  }

  get slideshow() {
    return this.refs.slideshow;
  }

  get media() {
    return this.refs.media;
  }

  get presentation() {
    return this.dataset.presentation;
  }
}

if (!customElements.get('media-gallery')) {
  customElements.define('media-gallery', MediaGallery);
}

/**
 * Thumbnail clicks scroll to stacked media items (list presentation).
 * Re-initializes on Theme Editor section loads.
 */
function initProductMediaListLayouts(root) {
  const scope = root && root.nodeType ? root : document;

  for (const layout of scope.querySelectorAll('[data-product-media-list]')) {
    if (layout.dataset.listInit === '1') continue;
    layout.dataset.listInit = '1';

    const blockId = layout.dataset.blockId;
    if (!blockId) continue;
    const stack = layout.querySelector('.media-gallery__list-stack');
    const items = stack ? Array.from(stack.querySelectorAll('[data-media-index]')) : [];
    const prevButton = layout.querySelector('[data-media-list-prev]');
    const nextButton = layout.querySelector('[data-media-list-next]');
    const indicatorButtons = Array.from(layout.querySelectorAll('[data-media-list-indicator]'));

    const updateActive = (index) => {
      for (const btn of layout.querySelectorAll('[data-media-list-index]')) {
        const active = String(index) === btn.getAttribute('data-media-list-index');
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-current', active ? 'true' : 'false');
      }

      for (const indicator of indicatorButtons) {
        const active = String(index) === indicator.getAttribute('data-media-list-indicator');
        indicator.classList.toggle('is-active', active);
        indicator.setAttribute('aria-current', active ? 'true' : 'false');
      }

      if (prevButton) prevButton.disabled = index <= 0;
      if (nextButton) nextButton.disabled = index >= items.length - 1;
    };

    const scrollToIndex = (index) => {
      const target = document.getElementById(`ProductMediaList-${blockId}-${index}`);
      if (!target) return;

      const isMobile = window.matchMedia('(max-width: 749px)').matches;
      target.scrollIntoView({
        behavior: 'smooth',
        block: isMobile ? 'nearest' : 'start',
        inline: isMobile ? 'start' : 'nearest',
      });

      updateActive(Number(index));
    };

    const getActiveIndexFromScroll = () => {
      if (!stack || !items.length) return 0;
      const itemWidth = items[0]?.clientWidth || stack.clientWidth || 1;
      return Math.max(0, Math.min(items.length - 1, Math.round(stack.scrollLeft / itemWidth)));
    };

    layout.addEventListener('click', (event) => {
      const button = event.target.closest('[data-media-list-index]');
      if (button && layout.contains(button)) {
        const index = button.getAttribute('data-media-list-index');
        if (index !== null) scrollToIndex(index);
        return;
      }

      const indicator = event.target.closest('[data-media-list-indicator]');
      if (indicator && layout.contains(indicator)) {
        const index = indicator.getAttribute('data-media-list-indicator');
        if (index !== null) scrollToIndex(index);
        return;
      }

      if (prevButton && event.target.closest('[data-media-list-prev]')) {
        scrollToIndex(getActiveIndexFromScroll() - 1);
        return;
      }

      if (nextButton && event.target.closest('[data-media-list-next]')) {
        scrollToIndex(getActiveIndexFromScroll() + 1);
      }
    });

    if (stack && items.length > 1) {
      let scrollFrame = 0;

      stack.addEventListener(
        'scroll',
        () => {
          if (scrollFrame) cancelAnimationFrame(scrollFrame);
          scrollFrame = requestAnimationFrame(() => {
            updateActive(getActiveIndexFromScroll());
          });
        },
        { passive: true }
      );
    }

    updateActive(0);
  }
}

document.addEventListener('DOMContentLoaded', () => initProductMediaListLayouts(document));

document.addEventListener('shopify:section:load', (event) => {
  if (event.target instanceof HTMLElement) {
    for (const el of event.target.querySelectorAll('[data-product-media-list]')) {
      el.dataset.listInit = '';
    }
    initProductMediaListLayouts(event.target);
  }
});
