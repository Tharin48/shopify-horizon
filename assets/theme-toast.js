(function () {
  const REGION_ID = 'theme-toast-region';

  /**
   * @returns {HTMLElement}
   */
  const getRegion = () => {
    let region = document.getElementById(REGION_ID);
    if (!region) {
      region = document.createElement('div');
      region.id = REGION_ID;
      region.className = 'theme-toast-region';
      document.body.appendChild(region);
    }
    return region;
  };

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let hideTimer;

  const clearHideTimer = () => {
    if (hideTimer != null) {
      clearTimeout(hideTimer);
      hideTimer = undefined;
    }
  };

  const hide = () => {
    clearHideTimer();
    const region = document.getElementById(REGION_ID);
    if (!region) return;
    region.innerHTML = '';
    region.setAttribute('hidden', '');
  };

  /**
   * @param {{ variant?: 'success' | 'error' | 'info'; message: string; durationMs?: number }} options
   */
  const show = (options) => {
    const rawVariant = options.variant;
    const variant =
      rawVariant === 'error' ? 'error' : rawVariant === 'info' ? 'info' : 'success';
    const message = String(options.message ?? '').trim();
    if (!message) return;

    const durationMs = options.durationMs ?? 6000;
    clearHideTimer();

    const region = getRegion();
    region.removeAttribute('hidden');
    region.innerHTML = '';

    const toast = document.createElement('div');
    toast.className = `theme-toast theme-toast--${variant}`;
    toast.setAttribute('role', variant === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', variant === 'error' ? 'assertive' : 'polite');
    toast.setAttribute('aria-atomic', 'true');

    const text = document.createElement('p');
    text.className = 'theme-toast__message';
    text.textContent = message;

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'theme-toast__dismiss button-unstyled';
    dismiss.textContent =
      typeof window.themeToastDismissLabel === 'string' && window.themeToastDismissLabel
        ? window.themeToastDismissLabel
        : 'Dismiss';

    toast.appendChild(text);
    toast.appendChild(dismiss);
    region.appendChild(toast);

    dismiss.addEventListener('click', () => {
      hide();
    });

    hideTimer = window.setTimeout(() => {
      hide();
    }, durationMs);
  };

  window.themeToast = {
    show,
    hide,
  };

  document.addEventListener(
    'theme:toast',
    /** @param {Event} event */ (event) => {
      if (!(event instanceof CustomEvent) || !event.detail || typeof event.detail !== 'object') {
        return;
      }
      const detail = event.detail;
      const message = detail.message;
      if (typeof message !== 'string') return;
      show({
        variant: detail.variant,
        message,
        durationMs: typeof detail.durationMs === 'number' ? detail.durationMs : undefined,
      });
    }
  );
})();
