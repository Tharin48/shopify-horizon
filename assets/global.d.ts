export {};

declare global {
  interface Shopify {
    country: string;
    currency: {
      active: string;
      rate: string;
    };
    designMode: boolean;
    locale: string;
    shop: string;
    loadFeatures(features: ShopifyFeature[], callback?: LoadCallback): void;
    ModelViewerUI?: ModelViewer;
    visualPreviewMode: boolean;
  }

  interface Theme {
    translations: Record<string, string>;
    routes: {
      cart_add_url: string;
      cart_change_url: string;
      cart_update_url: string;
      cart_url: string;
      predictive_search_url: string;
      search_url: string;
    };
    utilities: {
      scheduler: {
        schedule: (task: () => void) => void;
      };
    };
    template: {
      name: string;
    };
  }

  interface CustomShippingAvailabilityApi {
    initAll: (root: HTMLElement) => void;
  }

  interface CustomFaqAccordionApi {
    initAll: (root: HTMLElement) => void;
  }

  interface CustomPolicyPageArtApi {
    initFrameAll: () => void;
  }

  interface Window {
    Shopify: Shopify;
    /** Opt-in: set on `window` in devtools to log cart / catalog AJAX debug. */
    __HORIZON_TEMP_CART_DEBUG__?: boolean;
    /** Set by `custom-policy-page-spa.js` to avoid double init. */
    __customPolicyPageSpaInit?: boolean;
    /** Theme scripts attached by `custom-shipping-availability.js` and section inlines. */
    CustomShippingAvailability?: CustomShippingAvailabilityApi;
    CustomFaqAccordion?: CustomFaqAccordionApi;
    CustomPolicyPageArt?: CustomPolicyPageArtApi;
    /** Contact page section — `assets/custom-contact-page.js` */
    CustomContactPage?: {
      initAll: (container?: ParentNode | Document) => void;
      destroy: (root: HTMLElement) => void;
    };
  }

  declare const Shopify: Shopify;
  declare const Theme: Theme;

  type LoadCallback = (error: Error | undefined) => void;

  // Refer to https://github.com/Shopify/shopify/blob/main/areas/core/shopify/app/assets/javascripts/storefront/load_feature/load_features.js
  interface ShopifyFeature {
    name: string;
    version: string;
    onLoad?: LoadCallback;
  }

  // Refer to https://github.com/Shopify/model-viewer-ui/blob/main/src/js/model-viewer-ui.js
  interface ModelViewer {
    new (
      element: Element,
      options?: {
        focusOnPlay?: boolean;
      }
    ): ModelViewer;
    play(): void;
    pause(): void;
    toggleFullscreen(): void;
    zoom(amount: number): void;
    destroy(): void;
  }

  // Device Memory API - https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory
  interface Navigator {
    readonly deviceMemory?: number;
  }
}
