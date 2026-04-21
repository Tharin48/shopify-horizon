import { fetchConfig } from '@theme/utilities';
import { CartAddEvent, CartErrorEvent } from '@theme/events';

const BOUND = '__teamakersQuickAddBound';

function getCartSectionIds() {
  /** @type {string[]} */
  const ids = [];
  document.querySelectorAll('cart-items-component').forEach((el) => {
    if (el instanceof HTMLElement && el.dataset.sectionId) {
      ids.push(el.dataset.sectionId);
    }
  });
  return ids;
}

/**
 * @param {SubmitEvent} event
 */
async function onTeamakersQuickAddSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (!form.classList.contains('teamakers-pick__quick-add-form')) return;

  event.preventDefault();
  event.stopPropagation();

  const submitButton =
    event.submitter instanceof HTMLButtonElement
      ? event.submitter
      : /** @type {HTMLButtonElement | null} */ (form.querySelector('button[type="submit"]'));

  const formData = new FormData(form);
  const sectionIds = getCartSectionIds();
  if (sectionIds.length) {
    formData.set('sections', sectionIds.join(','));
  }

  if (submitButton) submitButton.disabled = true;

  try {
    const fetchCfg = fetchConfig('javascript', { body: formData });
    const response = await fetch(Theme.routes.cart_add_url, {
      ...fetchCfg,
      headers: {
        ...fetchCfg.headers,
        Accept: 'text/html',
      },
    });

    const data = await response.json();

    if (data.status) {
      document.dispatchEvent(
        new CartErrorEvent(
          form.id || 'teamakers-quick-add',
          data.message || '',
          data.description || '',
          data.errors || {}
        )
      );
      return;
    }

    const cartResponse = await fetch('/cart.js');
    const cart = await cartResponse.json();

    const variantId = formData.get('id')?.toString() || '';
    const qty = Number(formData.get('quantity')) || 1;

    document.dispatchEvent(
      new CartAddEvent(cart, variantId, {
        source: 'product-form-component',
        itemCount: qty,
        sections: data.sections,
      })
    );

    if (submitButton) {
      submitButton.dataset.added = 'true';
      window.setTimeout(() => {
        submitButton.removeAttribute('data-added');
      }, 800);
    }

    const drawer = document.querySelector('cart-drawer-component');
    if (drawer && 'showDialog' in drawer && typeof drawer.showDialog === 'function') {
      drawer.showDialog();
    }
  } catch (err) {
    console.error('Teamakers quick add:', err);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

if (!globalThis[BOUND]) {
  globalThis[BOUND] = true;
  document.addEventListener('submit', onTeamakersQuickAddSubmit);
}
