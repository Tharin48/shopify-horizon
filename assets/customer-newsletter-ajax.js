(function () {
  const FORM_SELECTOR = 'form.custom-footer__newsletter-form, form.email-signup__form';

  /** @type {WeakSet<HTMLFormElement>} */
  const inFlight = new WeakSet();

  // Silence instance `submit()` — hCaptcha calls this after AJAX; avoids empty-form reload.
  const silenceNativeSubmit = (form) => {
    if (!Object.prototype.hasOwnProperty.call(form, 'submit')) {
      form.submit = () => {
        /* AJAX or prototype.submit handles submission */
      };
    }
  };

  document.querySelectorAll(FORM_SELECTOR).forEach(silenceNativeSubmit);

  new MutationObserver((mutations) => {
    for (const { addedNodes } of mutations) {
      for (const node of addedNodes) {
        if (node instanceof HTMLFormElement && node.matches(FORM_SELECTOR)) {
          silenceNativeSubmit(node);
        } else if (node instanceof Element) {
          node.querySelectorAll(FORM_SELECTOR).forEach(silenceNativeSubmit);
        }
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  const getToast = () =>
    typeof window.themeToast === 'object' &&
    window.themeToast &&
    typeof window.themeToast.show === 'function'
      ? window.themeToast
      : undefined;

  const getLoadingApi = () =>
    typeof window.formSubmitLoading === 'object' && window.formSubmitLoading
      ? window.formSubmitLoading
      : undefined;

  /** @param {string | undefined | null} s */
  const urlOrBodyIndicatesSignupSuccess = (s) =>
    Boolean(s) &&
    (s.includes('customer_posted=true') || s.includes('contact_posted=true'));

  const urlIsChallenge = (url) =>
    Boolean(url) && /\/challenge|\/checkpoint\//i.test(url);

  /**
   * @param {string} html
   */
  const parseHtml = (html) => new DOMParser().parseFromString(html, 'text/html');

  /**
   * @param {string} html
   * @param {HTMLFormElement} form
   */
  const fragmentIndicatesSuccess = (html, form) => {
    if (!html) return false;
    if (form.classList.contains('custom-footer__newsletter-form')) {
      return /custom-footer__newsletter-message--success/.test(html);
    }
    if (form.classList.contains('email-signup__form')) {
      return /id\s*=\s*"Email-signup__message-success-/.test(html);
    }
    return false;
  };

  /**
   * @param {Document} doc
   * @param {HTMLFormElement} form
   */
  const domIndicatesSuccess = (doc, form) => {
    if (form.classList.contains('custom-footer__newsletter-form')) {
      return Boolean(doc.querySelector('.custom-footer__newsletter-message--success'));
    }
    if (form.classList.contains('email-signup__form')) {
      return Boolean(doc.querySelector('[id^="Email-signup__message-success-"]'));
    }
    return false;
  };

  /**
   * @param {Document} doc
   * @param {HTMLFormElement} form
   */
  const getServerErrorText = (doc, form) => {
    if (form.classList.contains('custom-footer__newsletter-form')) {
      return doc.querySelector('.custom-footer__newsletter-message--error')?.textContent?.trim() ?? '';
    }
    return doc.querySelector('[id^="Email-signup__message-error-"]')?.textContent?.trim() ?? '';
  };

  /** @param {HTMLFormElement} form */
  const successText = (form) => {
    const attr = form.getAttribute('data-newsletter-success');
    return (attr && attr.trim()) || 'Thanks for subscribing!';
  };

  /** @param {HTMLFormElement} form */
  const errorFallback = (form) => {
    const attr = form.getAttribute('data-newsletter-error');
    return (attr && attr.trim()) || 'Something went wrong. Please try again.';
  };

  /**
   * @param {Event} event
   * @returns {HTMLFormElement | null}
   */
  const resolveForm = (event) => {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const node of path) {
      if (node instanceof HTMLFormElement && node.matches(FORM_SELECTOR)) return node;
    }
    const target = event.target;
    if (target instanceof HTMLFormElement && target.matches(FORM_SELECTOR)) return target;
    if (target instanceof Element) {
      const f = target.closest('form');
      if (f instanceof HTMLFormElement && f.matches(FORM_SELECTOR)) return f;
    }
    return null;
  };

  /**
   * Let Shopify / hCaptcha finish injecting hidden fields after the submit event.
   * @param {number} ms
   */
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  document.addEventListener(
    'submit',
    (event) => {
      const form = resolveForm(event);
      if (!form) return;

      event.preventDefault();
      silenceNativeSubmit(form);

      if (inFlight.has(form)) return;
      inFlight.add(form);

      const toast = getToast();
      const loadingApi = getLoadingApi();

      void (async () => {
        const finish = () => {
          inFlight.delete(form);
          loadingApi?.clear(form);
        };

        try {
          // After submit handlers on the same tick, hCaptcha often adds tokens asynchronously.
          await wait(120);
          const response = await fetch(form.action, {
            method: 'POST',
            body: new FormData(form),
            credentials: 'same-origin',
            redirect: 'follow',
            cache: 'no-store',
          });

          const finalUrl = response.url || '';

          if (urlIsChallenge(finalUrl)) {
            finish();
            HTMLFormElement.prototype.submit.call(form);
            return;
          }

          const text = await response.text();
          const doc = parseHtml(text);
          const errText = getServerErrorText(doc, form).trim();

          const confirmedSuccess =
            urlOrBodyIndicatesSignupSuccess(finalUrl) ||
            urlOrBodyIndicatesSignupSuccess(text) ||
            fragmentIndicatesSuccess(text, form) ||
            domIndicatesSuccess(doc, form);

          if (confirmedSuccess) {
            form.reset();
            toast?.show({ variant: 'success', message: successText(form) });
            finish();
            return;
          }

          if (errText) {
            toast?.show({ variant: 'error', message: errText });
            finish();
            return;
          }

          // Unknown response: never show a fake success. Use a real browser POST so
          // spam protection tokens and Shopify's normal flow reach the backend.
          finish();
          HTMLFormElement.prototype.submit.call(form);
        } catch {
          toast?.show({
            variant: 'error',
            message: errorFallback(form),
          });
          finish();
        }
      })();
    },
    true
  );
})();
