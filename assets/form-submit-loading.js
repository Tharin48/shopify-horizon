(function () {
  const FORM_SELECTORS = [
    'form.custom-footer__newsletter-form',
    'form.email-signup__form',
    'form.contact-form__form',
    'form.custom-contact-page__form',
  ].join(',');

  /**
   * @param {HTMLFormElement} form
   * @returns {HTMLElement | null}
   */
  const findSubmitControl = (form) => {
    const explicitSubmit = form.querySelector('button[type="submit"], input[type="submit"]');
    if (explicitSubmit instanceof HTMLElement) {
      return explicitSubmit;
    }
    const buttons = form.querySelectorAll('button');
    for (const btn of buttons) {
      if (!(btn instanceof HTMLButtonElement)) continue;
      const typeAttr = btn.getAttribute('type');
      if (typeAttr === null || typeAttr === '' || typeAttr === 'submit') {
        return btn;
      }
    }
    return null;
  };

  /**
   * @param {HTMLFormElement} form
   */
  const clearFormSubmittingUi = (form) => {
    form.classList.remove('form-is-submitting');
    form.removeAttribute('aria-busy');

    const control = findSubmitControl(form);
    if (!control) return;

    control.classList.remove('form-submit-loading__control');
    control.removeAttribute('aria-busy');
    control.removeAttribute('disabled');

    if (control instanceof HTMLInputElement && control.type === 'submit') return;

    const spinner = control.querySelector(':scope > .form-submit-loading__spinner');
    spinner?.remove();
  };

  /**
   * @param {HTMLFormElement} form
   */
  const setFormSubmittingUi = (form) => {
    if (form.classList.contains('form-is-submitting')) return;

    form.classList.add('form-is-submitting');
    form.setAttribute('aria-busy', 'true');

    const control = findSubmitControl(form);
    if (!control) return;

    control.classList.add('form-submit-loading__control');
    control.setAttribute('aria-busy', 'true');

    window.setTimeout(() => {
      control.setAttribute('disabled', '');
    }, 0);

    if (control instanceof HTMLInputElement && control.type === 'submit') {
      return;
    }

    const spinner = document.createElement('span');
    spinner.className = 'form-submit-loading__spinner';
    spinner.setAttribute('aria-hidden', 'true');
    control.appendChild(spinner);
  };

  document.addEventListener('submit', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLFormElement)) return;
    if (!target.matches(FORM_SELECTORS)) return;
    setFormSubmittingUi(target);
  });

  window.formSubmitLoading = {
    /** @param {HTMLFormElement} form */
    clear(form) {
      if (!(form instanceof HTMLFormElement)) return;
      clearFormSubmittingUi(form);
    },
  };
})();
