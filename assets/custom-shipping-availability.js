(() => {
  if (/** @type {any} */ (window).CustomShippingAvailability) return;

  const rootSelector = '[data-custom-shipping-availability]';

  const statusMeta = {
    eligible: {
      badge: 'Shipping available',
      tone: 'positive',
      message: 'We can usually ship to this country.',
      showContact: false
    },
    eligible_with_conditions: {
      badge: 'Shipping available with conditions',
      tone: 'warning',
      message: 'Shipping is available, but additional information or documentation may be required.',
      showContact: false
    },
    special_import_license_required: {
      badge: 'Special import licence may be required',
      tone: 'warning',
      message:
        'This destination may require a special import licence or may have restrictions on online tea purchases.',
      showContact: true
    },
    restricted_or_contact_required: {
      badge: 'Please contact us before ordering',
      tone: 'warning',
      message: 'Shipping may require manual confirmation.',
      showContact: true
    }
  };

  /**
   * @typedef {{ country_name: string, country_code: string, sort_order?: string|number, shipping_status?: string, required_documents?: string, notice?: string, contact_email?: string }} ShippingItem
   * @typedef {{ fallbackContactEmail: string, noResultsText?: string, defaultResultText?: string }} ShippingConfig
   * @typedef {{ items: ShippingItem[], matches: ShippingItem[], activeIndex: number, selectedItem: ShippingItem|null }} ShippingState
   * @typedef {HTMLElement & { _shippingState: ShippingState, _shippingConfig: ShippingConfig }} ShippingRoot
   */

  /**
   * @param {Element|null} node
   * @param {any} fallback
   */
  const parseJson = (node, fallback) => {
    if (!node) return fallback;

    try {
      return JSON.parse(node.textContent || '');
    } catch (error) {
      console.warn('CustomShippingAvailability JSON parse error', error);
      return fallback;
    }
  };

  /** @param {unknown} value */
  const normalizeText = (value) => String(value || '').trim();

  /**
   * @param {string} text
   * @param {string} [email]
   */
  const normalizeEmailText = (text, email) =>
    normalizeText(text).replace(/\[email\]/gi, email || '');

  /** @param {ShippingItem[]} items */
  const sortItems = (items) =>
    items.slice().sort((left, right) => {
      const leftOrder = Number(left.sort_order || 9999);
      const rightOrder = Number(right.sort_order || 9999);

      if (leftOrder !== rightOrder) return leftOrder - rightOrder;

      return normalizeText(left.country_name).localeCompare(normalizeText(right.country_name), undefined, {
        sensitivity: 'base'
      });
    });

  /**
   * @param {string} tagName
   * @param {string} [className]
   * @param {string} [text]
   */
  const createElement = (tagName, className, text) => {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  };

  /**
   * Splits multi-line text into a <ul> of <li> bullet items.
   * Lines are split on newlines; blank lines are discarded.
   * @param {string} text
   * @param {string} [className]
   * @returns {HTMLElement}
   */
  const createBulletList = (text, className) => {
    const byNewline = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    // If the field has no newlines, fall back to splitting on sentence boundaries
    const lines =
      byNewline.length > 1
        ? byNewline
        : text
            .split(/\.\s+/)
            .map((s) => s.trim().replace(/\.+$/, ''))
            .filter(Boolean);

    const ul = createElement('ul', className || 'custom-shipping-availability__bullet-list');
    lines.forEach((line) => {
      const li = createElement('li', 'custom-shipping-availability__bullet-item', line);
      ul.appendChild(li);
    });
    return ul;
  };

  /** @param {Element|null} node */
  const clearNode = (node) => {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  };

  /** @param {string} sectionId */
  const getRootById = (sectionId) =>
    document.querySelector(`${rootSelector}[data-section-id="${sectionId}"]`);

  /**
   * @param {ShippingItem[]} items
   * @param {string} query
   */
  const getMatches = (items, query) => {
    const needle = normalizeText(query).toLocaleLowerCase();
    if (!needle) return [];

    return items.filter((item) => {
      const countryName = normalizeText(item.country_name).toLocaleLowerCase();
      const countryCode = normalizeText(item.country_code).toLocaleLowerCase();

      return countryName.includes(needle) || countryCode.includes(needle);
    });
  };

  /**
   * @param {ShippingRoot} root
   * @param {boolean} isExpanded
   */
  const setExpanded = (root, isExpanded) => {
    const combobox = root.querySelector('[data-shipping-combobox]');
    if (combobox) combobox.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  };

  /**
   * @param {ShippingRoot} root
   * @param {string} text
   * @param {string|null} tone
   */
  const setFeedback = (root, text, tone) => {
    const feedback = root.querySelector('[data-shipping-feedback]');
    if (!feedback) return;

    feedback.textContent = text || '';
    feedback.classList.toggle('is-warning', tone === 'warning');
  };

  /** @param {ShippingRoot} root */
  const closeDropdown = (root) => {
    const dropdown = root.querySelector('[data-shipping-dropdown]');
    const input = root.querySelector('[data-shipping-input]');
    const list = root.querySelector('[data-shipping-options]');

    if (dropdown) /** @type {HTMLElement} */ (dropdown).hidden = true;
    if (list) clearNode(list);
    if (input) input.removeAttribute('aria-activedescendant');

    setExpanded(root, false);
    root._shippingState.matches = [];
    root._shippingState.activeIndex = -1;
  };

  /**
   * @param {ShippingRoot} root
   * @param {ShippingItem|null} item
   */
  const renderResult = (root, item) => {
    const host = root.querySelector('[data-shipping-result-host]');
    if (!host) return;

    clearNode(host);
    if (!item) return;

    const statusKey = /** @type {keyof typeof statusMeta} */ (item.shipping_status);
    const meta = statusMeta[statusKey] || statusMeta.restricted_or_contact_required;
    const email = normalizeText(item.contact_email) || root._shippingConfig.fallbackContactEmail;

    const card = createElement('article', 'custom-shipping-availability__result-card');
    card.dataset.tone = meta.tone;

    const header = createElement('div', 'custom-shipping-availability__result-header');
    const countryWrap = createElement('div', 'custom-shipping-availability__result-country');
    const title = createElement('h3', 'custom-shipping-availability__result-country-name', item.country_name);
    countryWrap.appendChild(title);

    if (normalizeText(item.country_code)) {
      countryWrap.appendChild(
        createElement('span', 'custom-shipping-availability__result-country-code', item.country_code)
      );
    }

    const badge = createElement('span', 'custom-shipping-availability__status', meta.badge);
    badge.dataset.tone = meta.tone;

    header.appendChild(countryWrap);
    header.appendChild(badge);
    card.appendChild(header);

    card.appendChild(createElement('p', 'custom-shipping-availability__message', meta.message));

    const details = createElement('div', 'custom-shipping-availability__detail-list');

    if (normalizeText(item.required_documents)) {
      const required = createElement('div', 'custom-shipping-availability__detail');
      required.appendChild(
        createElement('strong', 'custom-shipping-availability__detail-title', 'Required documents')
      );
      required.appendChild(createBulletList(item.required_documents || ''));
      details.appendChild(required);
    }

    if (normalizeText(item.notice)) {
      const notice = createElement('div', 'custom-shipping-availability__detail');
      notice.appendChild(createElement('strong', 'custom-shipping-availability__detail-title', 'Shipping notice'));
      notice.appendChild(createBulletList(item.notice || ''));
      details.appendChild(notice);
    }

    if (meta.showContact && normalizeText(email)) {
      const contact = createElement('div', 'custom-shipping-availability__detail');
      contact.appendChild(createElement('strong', 'custom-shipping-availability__detail-title', 'Contact support'));
      const contactValue = createElement('div', 'custom-shipping-availability__detail-value');
      const link = createElement('a', 'custom-shipping-availability__contact-link', email);
      /** @type {HTMLAnchorElement} */ (link).href = `mailto:${email}`;
      contactValue.appendChild(link);
      contact.appendChild(contactValue);
      details.appendChild(contact);
    }

    if (details.childNodes.length) {
      card.appendChild(details);
    }

    host.appendChild(card);
  };

  /**
   * @param {ShippingRoot} root
   * @param {ShippingItem} item
   */
  const selectItem = (root, item) => {
    const input = root.querySelector('[data-shipping-input]');

    if (input) /** @type {HTMLInputElement} */ (input).value = item.country_name;

    root._shippingState.selectedItem = item;
    renderResult(root, item);
    setFeedback(root, '', null);
    closeDropdown(root);
  };

  /** @param {ShippingRoot} root */
  const renderNoResult = (root) => {
    renderResult(root, null);
    setFeedback(
      root,
      normalizeEmailText(
        root._shippingConfig.noResultsText || '',
        root._shippingConfig.fallbackContactEmail
      ),
      'warning'
    );
  };

  /** @param {ShippingRoot} root */
  const renderDefaultState = (root) => {
    renderResult(root, null);
    setFeedback(root, root._shippingConfig.defaultResultText || '', null);
  };

  /** @param {ShippingRoot} root */
  const highlightOption = (root) => {
    const state = root._shippingState;
    const options = Array.from(root.querySelectorAll('[data-shipping-option]'));
    const input = root.querySelector('[data-shipping-input]');

    options.forEach((option, index) => {
      const isActive = index === state.activeIndex;
      option.classList.toggle('is-active', isActive);
      option.setAttribute('aria-selected', isActive ? 'true' : 'false');

      if (isActive && input) {
        input.setAttribute('aria-activedescendant', option.id);
        option.scrollIntoView({ block: 'nearest' });
      }
    });

    if (state.activeIndex < 0 && input) {
      input.removeAttribute('aria-activedescendant');
    }
  };

  /**
   * @param {ShippingRoot} root
   * @param {ShippingItem[]} matches
   */
  const renderDropdown = (root, matches) => {
    const dropdown = root.querySelector('[data-shipping-dropdown]');
    const list = root.querySelector('[data-shipping-options]');
    const sectionId = root.dataset.sectionId;

    if (!dropdown || !list) return;

    clearNode(list);

    if (!matches.length) {
      /** @type {HTMLElement} */ (dropdown).hidden = true;
      setExpanded(root, false);
      return;
    }

    matches.forEach((item, index) => {
      const option = createElement('button', 'custom-shipping-availability__option');
      /** @type {HTMLButtonElement} */ (option).type = 'button';
      option.id = `custom-shipping-option-${sectionId}-${index}`;
      option.dataset.shippingOption = '';
      option.dataset.countryKey = normalizeText(item.country_name).toLocaleLowerCase();
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');

      const optionName = createElement('span', 'custom-shipping-availability__option-name', item.country_name);
      option.appendChild(optionName);

      if (normalizeText(item.country_code)) {
        option.appendChild(
          createElement('span', 'custom-shipping-availability__option-code', item.country_code)
        );
      }

      option.addEventListener('mousedown', (event) => event.preventDefault());
      option.addEventListener('click', () => selectItem(root, item));
      list.appendChild(option);
    });

    /** @type {HTMLElement} */ (dropdown).hidden = false;
    setExpanded(root, true);
    highlightOption(root);
  };

  /** @param {ShippingRoot} root */
  const updateMatches = (root) => {
    const input = root.querySelector('[data-shipping-input]');
    const query = input ? /** @type {HTMLInputElement} */ (input).value : '';
    const matches = getMatches(root._shippingState.items, query).slice(0, 10);

    root._shippingState.matches = matches;
    root._shippingState.activeIndex = matches.length ? 0 : -1;

    renderDropdown(root, matches);

    if (!normalizeText(query)) {
      if (!root._shippingState.selectedItem) {
        renderDefaultState(root);
      }
      closeDropdown(root);
    }
  };

  /** @param {ShippingRoot} root */
  const handleEnter = (root) => {
    const state = root._shippingState;
    const input = root.querySelector('[data-shipping-input]');
    const query = normalizeText(input ? /** @type {HTMLInputElement} */ (input).value : '');

    if (!query) {
      renderDefaultState(root);
      closeDropdown(root);
      return;
    }

    if (state.matches.length) {
      const nextIndex = state.activeIndex >= 0 ? state.activeIndex : 0;
      const match = state.matches[nextIndex];
      if (match) selectItem(root, match);
      return;
    }

    const exactMatch = state.items.find((item) => {
      const countryName = normalizeText(item.country_name).toLocaleLowerCase();
      const countryCode = normalizeText(item.country_code).toLocaleLowerCase();
      const normalizedQuery = query.toLocaleLowerCase();

      return countryName === normalizedQuery || (countryCode && countryCode === normalizedQuery);
    });

    if (exactMatch) {
      selectItem(root, /** @type {ShippingItem} */ (exactMatch));
      return;
    }

    renderNoResult(root);
    closeDropdown(root);
  };

  /** @param {ShippingRoot} root */
  const bindRoot = (root) => {
    if (root.dataset.shippingAvailabilityBound === 'true') return;
    root.dataset.shippingAvailabilityBound = 'true';

    const input = root.querySelector('[data-shipping-input]');
    if (!input) return;

    input.addEventListener('input', () => {
      root._shippingState.selectedItem = null;
      updateMatches(root);
    });

    input.addEventListener('focus', () => {
      if (normalizeText(/** @type {HTMLInputElement} */ (input).value)) updateMatches(root);
    });

    input.addEventListener('keydown', (event) => {
      const state = root._shippingState;
      const key = /** @type {KeyboardEvent} */ (event).key;

      if (key === 'ArrowDown') {
        event.preventDefault();
        if (!state.matches.length) {
          updateMatches(root);
          return;
        }
        state.activeIndex = Math.min(state.activeIndex + 1, state.matches.length - 1);
        highlightOption(root);
      } else if (key === 'ArrowUp') {
        event.preventDefault();
        if (!state.matches.length) return;
        state.activeIndex = Math.max(state.activeIndex - 1, 0);
        highlightOption(root);
      } else if (key === 'Enter') {
        event.preventDefault();
        handleEnter(root);
      } else if (key === 'Escape') {
        closeDropdown(root);
      }
    });

    input.addEventListener('blur', () => {
      window.setTimeout(() => closeDropdown(root), 120);
    });
  };

  /** @param {Element|null} root */
  const initRoot = (root) => {
    if (!root) return;

    const shippingRoot = /** @type {ShippingRoot} */ (root);
    const configNode = shippingRoot.querySelector('[data-shipping-country-config]');
    const itemsNode = shippingRoot.querySelector('[data-shipping-country-items]');

    shippingRoot._shippingConfig = parseJson(configNode, {});
    shippingRoot._shippingConfig.fallbackContactEmail = normalizeText(shippingRoot._shippingConfig.fallbackContactEmail);
    shippingRoot._shippingState = {
      items: sortItems(parseJson(itemsNode, [])),
      matches: [],
      activeIndex: -1,
      selectedItem: null
    };

    bindRoot(shippingRoot);
    renderDefaultState(shippingRoot);
  };

  /** @param {Document|Element} [scope] */
  const initAll = (scope = document) => {
    const scopeEl = /** @type {any} */ (scope);
    const roots =
      scopeEl && typeof scopeEl.matches === 'function' && scopeEl.matches(rootSelector)
        ? [scope]
        : Array.from(/** @type {Document|Element} */ (scope).querySelectorAll(rootSelector));

    roots.forEach((el) => initRoot(/** @type {Element} */ (el)));
  };

  /** @type {any} */ (window).CustomShippingAvailability = {
    initAll,
    /** @param {string} sectionId */
    initBySectionId(sectionId) {
      initRoot(getRootById(sectionId));
    }
  };

  document.addEventListener('DOMContentLoaded', () => initAll(document));
  document.addEventListener('shopify:section:load', () => initAll(document));
  document.addEventListener('shopify:section:select', () => initAll(document));
  document.addEventListener('shopify:block:select', () => initAll(document));
})();
