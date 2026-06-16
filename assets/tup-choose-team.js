(() => {
  const SECTION_SELECTOR = '[data-tup-choose-team]';
  const NO_MATCH_TITLE = 'No T-Series blend has been assigned to this team yet.';

  const readProducts = (section) => {
    const script = section.querySelector('[data-tup-products-json]');
    if (!script) return [];

    try {
      const products = JSON.parse(script.textContent || '[]');
      return Array.isArray(products) ? products : [];
    } catch (error) {
      console.warn('[T Up Choose Team] Product JSON could not be parsed.', error);
      return [];
    }
  };

  const normalizeCode = (value) => String(value || '').trim().toUpperCase();

  const normalizeCodes = (value) => {
    if (Array.isArray(value)) return value.map(normalizeCode).filter(Boolean);
    return String(value || '')
      .split(/[\s,|;]+/)
      .map(normalizeCode)
      .filter(Boolean);
  };

  const productMatchesCode = (product, selectedCode) => {
    const codes = normalizeCodes(product?.custom?.tup_country_codes);
    return codes.includes(selectedCode);
  };

  const setText = (section, selector, value) => {
    const element = section.querySelector(selector);
    if (element) element.textContent = value || '';
  };

  const setMessage = (section, message, tone = '') => {
    const element = section.querySelector('[data-product-message]');
    if (!(element instanceof HTMLElement)) return;
    element.textContent = message;
    if (tone) {
      element.dataset.tone = tone;
    } else {
      delete element.dataset.tone;
    }
  };

  const setProductImage = (section, product) => {
    const panel = section.querySelector('.tup-choose-team__image-panel');
    if (!(panel instanceof HTMLElement)) return;

    panel.replaceChildren();

    if (product?.image) {
      const image = document.createElement('img');
      image.className = 'tup-choose-team__product-image';
      image.src = product.image;
      image.alt = product.title || '';
      image.loading = 'lazy';
      panel.append(image);
      return;
    }

    const placeholder = document.createElement('div');
    placeholder.className = 'tup-choose-team__placeholder';
    placeholder.textContent = 'Select another team or explore the full T-Series collection.';
    panel.append(placeholder);
  };

  const renderProduct = (section, product) => {
    const addButton = section.querySelector('[data-product-add-to-cart]');
    const viewLink = section.querySelector('[data-product-link]');

    setProductImage(section, product);
    setText(section, '[data-product-title]', product.title);
    setText(section, '[data-product-blend-badge]', product.custom?.tup_blend_label || 'T-Series Blend');
    setText(section, '[data-product-story]', product.custom?.tup_match_day_story || '');
    setText(section, '[data-product-price]', product.price || '');
    setMessage(section, '');

    if (addButton instanceof HTMLButtonElement) {
      addButton.hidden = false;
      addButton.disabled = !product.available || !product.variantId;
      addButton.dataset.variantId = product.variantId || '';
      addButton.textContent = product.available ? 'Add to Cart' : 'Sold Out';
    }

    if (viewLink instanceof HTMLAnchorElement) {
      viewLink.href = product.url || '/collections/t-series';
      viewLink.textContent = 'View Product';
    }
  };

  const renderFallback = (section) => {
    const addButton = section.querySelector('[data-product-add-to-cart]');
    const viewLink = section.querySelector('[data-product-link]');

    setProductImage(section, null);
    setText(section, '[data-product-title]', NO_MATCH_TITLE);
    setText(section, '[data-product-blend-badge]', 'T-Series Blend');
    setText(section, '[data-product-story]', 'Choose another team or explore the full T-Series collection.');
    setText(section, '[data-product-price]', '');
    setMessage(section, '');

    if (addButton instanceof HTMLButtonElement) {
      addButton.hidden = true;
      addButton.disabled = true;
      delete addButton.dataset.variantId;
    }

    if (viewLink instanceof HTMLAnchorElement) {
      viewLink.href = viewLink.dataset.fallbackUrl || '/collections/t-series';
      viewLink.textContent = 'Shop T-Series';
    }
  };

  const selectTeam = (section, card, products) => {
    const selectedCode = normalizeCode(card.dataset.countryCode);
    if (!selectedCode) return;

    section.querySelectorAll('[data-country-code]').forEach((teamCard) => {
      const isSelected = teamCard === card;
      teamCard.classList.toggle('is-selected', isSelected);
      teamCard.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });

    const product = products.find((item) => productMatchesCode(item, selectedCode));
    if (product) {
      renderProduct(section, product);
    } else {
      renderFallback(section);
    }
  };

  const addToCart = async (section, button) => {
    const variantId = button.dataset.variantId;
    if (!variantId) return;

    const originalText = button.textContent;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Adding...';
    setMessage(section, '');

    try {
      const response = await fetch(window.Theme?.routes?.cart_add_url || '/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          id: Number(variantId),
          quantity: 1,
        }),
      });
      const payload = await response.json();

      if (!response.ok || payload.status) {
        throw new Error(payload.description || payload.message || 'Unable to add this product to cart.');
      }

      document.dispatchEvent(
        new CustomEvent('cart:update', {
          bubbles: true,
          detail: {
            resource: payload,
            sourceId: section.id,
            data: {
              source: 'tup-choose-team',
              variantId,
            },
          },
        })
      );

      button.textContent = 'Added';
      setMessage(section, 'Added to cart.');
    } catch (error) {
      console.error('[T Up Choose Team] Add to cart failed.', error);
      setMessage(section, error instanceof Error ? error.message : 'Unable to add this product to cart.', 'error');
      button.textContent = originalText || 'Add to Cart';
    } finally {
      window.setTimeout(() => {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = originalText || 'Add to Cart';
      }, 1200);
    }
  };

  const initSection = (section) => {
    if (!(section instanceof HTMLElement) || section.dataset.tupChooseTeamInitialized === 'true') return;
    section.dataset.tupChooseTeamInitialized = 'true';

    const products = readProducts(section);
    const cards = Array.from(section.querySelectorAll('[data-country-code]'));

    cards.forEach((card) => {
      if (!(card instanceof HTMLButtonElement)) return;
      card.addEventListener('click', () => selectTeam(section, card, products));
    });

    const selectedCard = cards.find((card) => card.classList.contains('is-selected')) || cards[0];
    if (selectedCard instanceof HTMLButtonElement) {
      selectTeam(section, selectedCard, products);
    } else {
      renderFallback(section);
    }

    const addButton = section.querySelector('[data-product-add-to-cart]');
    if (addButton instanceof HTMLButtonElement) {
      addButton.addEventListener('click', () => addToCart(section, addButton));
    }
  };

  const init = (root = document) => {
    if (root instanceof HTMLElement && root.matches(SECTION_SELECTOR)) initSection(root);
    root.querySelectorAll?.(SECTION_SELECTOR).forEach(initSection);
  };

  init();
  document.addEventListener('shopify:section:load', (event) => init(event.target));
})();
