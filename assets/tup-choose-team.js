/// <reference path="./global.d.ts" />
/// <reference path="./tup-worldcup.d.ts" />

(() => {
  const shared = window.TupWorldCupShared;
  if (!shared) {
    console.error('[T Up Choose Team] Shared World Cup helpers are missing.');
    return;
  }

  const { escapeHtml, getList, parseGameDate, dateSortValue } = shared;
  const SECTION_SELECTOR = '[data-tup-choose-team]';
  const NO_MATCH_TITLE = 'No T-Series blend has been assigned to this team yet.';
  const DEBUG_SELECTION = true;
  const LOG_PREFIX = '[T Up Choose Team]';

  /** @param {HTMLElement} section @returns {TupChooseTeamProduct[]} */
  const readProducts = (section) => {
    const script = section.querySelector('[data-tup-products-json]');
    if (!script) return [];

    try {
      const products = JSON.parse(script.textContent || '[]');
      return Array.isArray(products) ? /** @type {TupChooseTeamProduct[]} */ (products) : [];
    } catch (error) {
      console.warn(`${LOG_PREFIX} Product JSON could not be parsed.`, error);
      return [];
    }
  };

  /** @param {HTMLElement} section @returns {TupCountryBlendMapping[]} */
  const readCountryBlendMappings = (section) => {
    const script = section.querySelector('[data-tup-country-blends-json]');
    if (!script) return [];

    try {
      const mappings = JSON.parse(script.textContent || '[]');
      if (!Array.isArray(mappings)) return [];

      return mappings
        .map((/** @type {TupCountryBlendMapping} */ mapping) => ({
          ...mapping,
          countryCode: normalizeCode(mapping.countryCode),
          active: mapping.active !== false,
        }))
        .filter((mapping) => mapping.countryCode);
    } catch (error) {
      console.warn(`${LOG_PREFIX} Country blend mapping JSON could not be parsed.`, error);
      return [];
    }
  };

  /** @param {HTMLElement} section @returns {TupCountryBlendMapping[]} */
  const readCountryBlendDebugEntries = (section) => {
    const script = section.querySelector('[data-tup-country-blends-debug-json]');
    if (!script) return [];

    try {
      const entries = JSON.parse(script.textContent || '[]');
      if (!Array.isArray(entries)) return [];
      return entries.map((/** @type {TupCountryBlendMapping} */ entry) => ({
        ...entry,
        countryCode: normalizeCode(entry.countryCode),
      }));
    } catch (error) {
      console.warn(`${LOG_PREFIX} Country blend debug JSON could not be parsed.`, error);
      return [];
    }
  };

  /** @param {unknown} value @returns {string} */
  const normalizeCode = (value) =>
    String(value || '')
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

  /** @param {unknown} value @returns {string[]} */
  const normalizeCodes = (value) => {
    if (Array.isArray(value)) return value.map(normalizeCode).filter(Boolean);
    return String(value || '')
      .split(/[\s,|;]+/)
      .map(normalizeCode)
      .filter(Boolean);
  };

  /**
   * @param {TupChooseTeamProduct | undefined} product
   * @param {string} selectedCode
   * @returns {boolean}
   */
  const productMatchesCode = (product, selectedCode) => {
    const codes = normalizeCodes(product?.custom?.tup_country_codes);
    return codes.includes(selectedCode);
  };

  /**
   * @param {TupChooseTeamProduct[]} products
   * @param {string} code
   * @returns {TupChooseTeamProduct | undefined}
   */
  const findProductByCode = (products, code) => products.find((item) => productMatchesCode(item, normalizeCode(code)));

  /**
   * @param {TupCountryBlendMapping[]} mappings
   * @param {string} code
   * @returns {TupCountryBlendMapping | undefined}
   */
  const findMappingByCode = (mappings, code) => {
    const apiCode = normalizeCode(code);
    return mappings.find((item) => normalizeCode(item.countryCode) === apiCode && item.active !== false);
  };

  /**
   * @param {Date | null | undefined} a
   * @param {Date | null | undefined} b
   * @returns {boolean}
   */
  const sameDay = (a, b) =>
    a instanceof Date &&
    b instanceof Date &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  /** @param {TupJsonObject[]} teams @returns {TupTeamLookup} */
  const buildTeamLookup = (teams) => {
    /** @type {TupTeamLookup} */
    const lookup = {};
    teams.forEach((/** @type {TupJsonObject} */ team) => {
      const id = String(team.id ?? team._id ?? '');
      const fifaCode = normalizeCode(team.fifa_code);
      if (!id || !fifaCode) return;
      lookup[id] = {
        id,
        name: String(team.name_en || team.name || team.name_fa || fifaCode),
        flag: String(team.flag || ''),
        fifaCode,
        group: String(team.groups || team.group || ''),
      };
    });
    return lookup;
  };

  /** @param {TupJsonObject} game @returns {string[]} */
  const getTeamIdsFromGame = (game) => [String(game.home_team_id || ''), String(game.away_team_id || '')].filter(Boolean);

  /**
   * @param {TupTeamLookup} teamsById
   * @param {TupJsonObject[]} games
   * @returns {TupTeamRecord[]}
   */
  const uniqueTeamsFromGames = (teamsById, games) => {
    /** @type {string[]} */
    const orderedIds = [];
    games.forEach((game) => {
      getTeamIdsFromGame(game).forEach((id) => {
        if (teamsById[id] && !orderedIds.includes(id)) orderedIds.push(id);
      });
    });

    return orderedIds.flatMap((id) => {
      const team = teamsById[id];
      return team ? [team] : [];
    });
  };

  /**
   * @param {TupTeamLookup} teamsById
   * @param {TupJsonObject[]} games
   * @returns {TupTeamRecord[]}
   */
  const teamsPlayingToday = (teamsById, games) => {
    const today = new Date();
    return uniqueTeamsFromGames(
      teamsById,
      [...games]
        .filter((game) => sameDay(parseGameDate(game), today))
        .sort((a, b) => dateSortValue(parseGameDate(a)) - dateSortValue(parseGameDate(b)))
    ).map((team) => ({ ...team, tabBadge: 'Today' }));
  };

  /** @param {unknown} group @returns {string} */
  const normalizeGroupSortValue = (group) => String(group || '').replace(/^group\s+/i, '').trim();

  /** @param {unknown} group @returns {string} */
  const groupLabel = (group) => {
    const value = normalizeGroupSortValue(group);
    return value ? `Group ${value}` : 'Group';
  };

  /** @param {TupTeamLookup} teamsById @returns {TupTeamRecord[]} */
  const allTeamsByGroup = (teamsById) =>
    Object.values(teamsById)
      .sort((a, b) => {
        const groupComparison = normalizeGroupSortValue(a.group).localeCompare(normalizeGroupSortValue(b.group), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
        if (groupComparison) return groupComparison;
        return String(a.name).localeCompare(String(b.name));
      })
      .map((team) => ({ ...team, tabBadge: groupLabel(team.group) }));

  /** @param {HTMLElement} section @param {string} selector @param {string} value @returns {void} */
  const setText = (section, selector, value) => {
    const element = section.querySelector(selector);
    if (element) element.textContent = value || '';
  };

  /** @param {HTMLElement} section @param {string} message @param {string} [tone] @returns {void} */
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

  /**
   * @param {HTMLElement} section
   * @param {{ image?: string; title?: string } | null | undefined} product
   * @returns {void}
   */
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

  /** @param {HTMLElement} section @param {string} html @returns {void} */
  const setStoryHtml = (section, html) => {
    const story = section.querySelector('[data-product-story]');
    if (story instanceof HTMLElement) story.innerHTML = html || '';
  };

  /** @param {unknown} value @returns {number} */
  const profilePercent = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 0;
    return Math.min(number <= 10 ? number * 10 : number, 100);
  };

  /**
   * @param {HTMLElement} section
   * @param {string} key
   * @param {unknown} value
   * @param {string | undefined} copy
   * @returns {boolean}
   */
  const setProfileRow = (section, key, value, copy) => {
    const row = section.querySelector(`[data-profile-row="${key}"]`);
    const bar = section.querySelector(`[data-profile-bar="${key}"]`);
    const copyElement = section.querySelector(`[data-profile-copy="${key}"]`);
    const hasContent = Boolean(value || copy);

    if (row instanceof HTMLElement) row.hidden = !hasContent;
    if (bar instanceof HTMLElement) bar.style.width = `${profilePercent(value)}%`;
    if (copyElement instanceof HTMLElement) copyElement.textContent = copy || '';

    return hasContent;
  };

  /** @param {HTMLElement} section @param {TupCountryBlendMapping | null | undefined} mapping @returns {void} */
  const updateTastingProfile = (section, mapping) => {
    const profile = section.querySelector('[data-tasting-profile]');
    if (!(profile instanceof HTMLElement)) return;

    const hasStrength = setProfileRow(section, 'strength', mapping?.strengthValue, mapping?.strengthCopy);
    const hasAroma = setProfileRow(section, 'aroma', mapping?.aromaValue, mapping?.aromaCopy);
    const hasSmoothness = setProfileRow(section, 'smoothness', mapping?.smoothnessValue, mapping?.smoothnessCopy);

    profile.hidden = !(hasStrength || hasAroma || hasSmoothness);
  };

  /** @param {HTMLElement} section @param {TupChooseTeamProduct} product @returns {void} */
  const renderProduct = (section, product) => {
    const addButton = section.querySelector('[data-product-add-to-cart]');
    const viewLink = section.querySelector('[data-product-link]');

    setProductImage(section, product);
    setText(section, '[data-product-title]', product.title || '');
    setText(section, '[data-product-blend-badge]', product.custom?.tup_blend_label || 'T-Series Blend');
    setStoryHtml(section, escapeHtml(product.custom?.tup_match_day_story || ''));
    setText(section, '[data-product-price]', product.price || '');
    updateTastingProfile(section, null);
    setMessage(section, '');

    if (addButton instanceof HTMLButtonElement) {
      addButton.hidden = false;
      addButton.disabled = !product.available || !product.variantId;
      addButton.dataset.variantId = String(product.variantId || '');
      addButton.dataset.countryCode = product.countryCode || '';
      addButton.dataset.countryName = product.countryName || '';
      addButton.textContent = product.available ? 'Add to Cart' : 'Sold Out';
    }

    if (viewLink instanceof HTMLAnchorElement) {
      viewLink.href = product.url || '/collections/t-series';
      viewLink.textContent = 'View Product';
    }
  };

  /** @param {HTMLElement} section @param {TupCountryBlendMapping} mapping @returns {void} */
  const renderMapping = (section, mapping) => {
    const addButton = section.querySelector('[data-product-add-to-cart]');
    const viewLink = section.querySelector('[data-product-link]');
    const storyTemplate = mapping.storyTemplateId ? document.getElementById(mapping.storyTemplateId) : null;

    setProductImage(section, {
      image: mapping.productImage,
      title: mapping.displayTitle || mapping.productTitle,
    });
    setText(section, '[data-product-title]', mapping.displayTitle || mapping.productTitle || '');
    setText(section, '[data-product-blend-badge]', mapping.blendBadge || 'T-Series Blend');
    setStoryHtml(section, storyTemplate instanceof HTMLTemplateElement ? storyTemplate.innerHTML : '');
    setText(section, '[data-product-price]', mapping.productPrice || '');
    updateTastingProfile(section, mapping);
    setMessage(section, '');

    if (addButton instanceof HTMLButtonElement) {
      addButton.hidden = false;
      addButton.disabled = !mapping.variantId;
      addButton.dataset.variantId = String(mapping.variantId || '');
      addButton.dataset.countryCode = String(mapping.countryCode || '');
      addButton.dataset.countryName = String(mapping.countryName || mapping.apiTeamName || '');
      addButton.textContent = mapping.variantId ? 'Add to Cart' : 'Sold Out';
    }

    if (viewLink instanceof HTMLAnchorElement) {
      viewLink.href = mapping.productUrl || viewLink.dataset.shopUrl || '/collections/t-series';
      viewLink.textContent = 'View Product';
    }
  };

  /** @param {HTMLElement} section @returns {void} */
  const renderNoProductMatch = (section) => {
    const addButton = section.querySelector('[data-product-add-to-cart]');
    const viewLink = section.querySelector('[data-product-link]');

    setProductImage(section, null);
    setText(section, '[data-product-title]', NO_MATCH_TITLE);
    setText(section, '[data-product-blend-badge]', 'T-Series Blend');
    setStoryHtml(section, 'Choose another team or explore the full T-Series collection.');
    setText(section, '[data-product-price]', '');
    updateTastingProfile(section, null);
    setMessage(section, '');

    if (addButton instanceof HTMLButtonElement) {
      addButton.hidden = true;
      addButton.disabled = true;
      delete addButton.dataset.variantId;
      delete addButton.dataset.countryCode;
      delete addButton.dataset.countryName;
    }

    if (viewLink instanceof HTMLAnchorElement) {
      viewLink.href = viewLink.dataset.shopUrl || '/collections/t-series';
      viewLink.textContent = 'Shop T-Series';
    }
  };

  /** @param {string} message @returns {string} */
  const createTeamRetryMessageMarkup = (message) => `
    <span>${escapeHtml(message)}</span>
    <button type="button" class="tup-api-retry" data-tup-api-retry aria-label="Try again">
      <span class="tup-api-retry__icon" aria-hidden="true"></span>
      <span data-retry-label>Try again</span>
    </button>
  `;

  /**
   * @param {HTMLElement} section
   * @param {TupChooseTeamProduct[]} products
   * @param {string} [message]
   * @returns {void}
   */
  const renderTeamUnavailable = (section, products, message = 'Teams are currently unavailable.') => {
    const container = section.querySelector('.tup-choose-team__cards');
    if (container instanceof HTMLElement) {
      const card = document.createElement('div');
      card.className = 'tup-team-card tup-team-card--message';
      card.innerHTML = createTeamRetryMessageMarkup(message);
      container.replaceChildren(card);
    }

    section.dataset.tupApiFailed = 'true';
    renderNoProductMatch(section);
  };

  /**
   * @param {string} apiCode
   * @param {TupCountryBlendMapping[]} mappings
   * @param {TupCountryBlendMapping | undefined} mapping
   * @param {TupCountryBlendMapping[]} [debugEntries]
   * @returns {void}
   */
  const logSelectionDebug = (apiCode, mappings, mapping, debugEntries = []) => {
    if (!DEBUG_SELECTION) return;
    console.log(apiCode, mappings.map((item) => normalizeCode(item.countryCode)));
    console.log('Matched mapping:', mapping);
    if (!mapping) {
      console.log(
        'Metaobject debug for code:',
        apiCode,
        debugEntries.filter((entry) => normalizeCode(entry.countryCode) === apiCode)
      );
    }
    if (mapping) {
      console.log('Matched mapping checks:', {
        active: mapping.active !== false,
        assignedProductExists: Boolean(mapping.assignedProductExists || mapping.productId),
        variantIdOrFirstAvailableVariantExists: Boolean(mapping.variantId || mapping.variantExists),
        productImageLoaded: Boolean(mapping.productImage || mapping.productImageLoaded),
        productPriceLoaded: Boolean(mapping.productPrice || mapping.productPriceLoaded),
        productTitleLoaded: Boolean(mapping.productTitle || mapping.displayTitle || mapping.productTitleLoaded),
      });
    }
  };

  /**
   * @param {HTMLElement} section
   * @param {HTMLButtonElement} card
   * @param {TupChooseTeamProduct[]} products
   * @param {TupCountryBlendMapping[]} mappings
   * @param {TupCountryBlendMapping[]} debugEntries
   * @returns {void}
   */
  const selectTeam = (section, card, products, mappings, debugEntries) => {
    const apiCode = normalizeCode(card.dataset.countryCode);
    if (!apiCode) return;

    section.querySelectorAll('[data-country-code]').forEach((teamCard) => {
      const isSelected = teamCard === card;
      teamCard.classList.toggle('is-selected', isSelected);
      teamCard.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });

    const mapping = findMappingByCode(mappings, apiCode);
    logSelectionDebug(apiCode, mappings, mapping, debugEntries);

    if (mapping) {
      renderMapping(section, mapping);
      return;
    }

    const product = findProductByCode(products, apiCode);
    if (product) {
      renderProduct(section, {
        ...product,
        countryCode: apiCode,
        countryName: card.dataset.countryName || '',
      });
    } else {
      renderNoProductMatch(section);
    }
  };

  /** @param {TupTeamRecord} team @returns {string} */
  const flagMarkup = (team) => {
    if (team.flag) {
      return `<img src="${escapeHtml(team.flag)}" alt="${escapeHtml(team.name)}" loading="lazy">`;
    }

    return `<span class="tup-team-card__flag-text">${escapeHtml(team.fifaCode.slice(0, 2))}</span>`;
  };

  /**
   * @param {TupTeamRecord} team
   * @param {TupChooseTeamProduct[]} products
   * @param {TupCountryBlendMapping[]} mappings
   * @returns {HTMLButtonElement}
   */
  const createTeamCard = (team, products, mappings) => {
    const apiCode = normalizeCode(team.fifaCode);
    const matchedMapping = findMappingByCode(mappings, apiCode);
    const matchedProduct = findProductByCode(products, apiCode);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'tup-team-card';
    card.dataset.countryCode = apiCode;
    card.dataset.countryName = team.name || '';
    card.setAttribute('aria-pressed', 'false');
    card.innerHTML = `
      <span class="tup-team-card__flag">${flagMarkup(team)}</span>
      <span class="tup-team-card__status">${escapeHtml(team.tabBadge || groupLabel(team.group))}</span>
      <span class="tup-team-card__name">${escapeHtml(team.name)}</span>
      <span class="tup-team-card__blend">${escapeHtml(matchedMapping?.blendBadge || matchedProduct?.custom?.tup_blend_label || apiCode)}</span>
    `;
    return card;
  };

  /**
   * @param {HTMLElement} section
   * @param {TupChooseTeamProduct[]} products
   * @param {TupCountryBlendMapping[]} mappings
   * @param {TupCountryBlendMapping[]} debugEntries
   * @returns {void}
   */
  const bindTeamCards = (section, products, mappings, debugEntries) => {
    const cards = Array.from(section.querySelectorAll('[data-country-code]'));

    cards.forEach((card) => {
      if (!(card instanceof HTMLButtonElement)) return;
      card.addEventListener('click', () => selectTeam(section, card, products, mappings, debugEntries));
    });

    const selectedCard = cards.find((card) => card.classList.contains('is-selected')) || cards[0];
    if (selectedCard instanceof HTMLButtonElement) {
      selectTeam(section, selectedCard, products, mappings, debugEntries);
    } else {
      renderNoProductMatch(section);
    }
  };

  /**
   * @param {HTMLElement} section
   * @param {TupTeamRecord[]} teams
   * @param {TupChooseTeamProduct[]} products
   * @param {TupCountryBlendMapping[]} mappings
   * @param {TupCountryBlendMapping[]} debugEntries
   * @param {string} emptyMessage
   * @returns {boolean}
   */
  const renderTeamCards = (section, teams, products, mappings, debugEntries, emptyMessage) => {
    const container = section.querySelector('.tup-choose-team__cards');
    if (!(container instanceof HTMLElement)) return false;

    if (!teams.length) {
      const isUnavailable = emptyMessage === 'Teams are currently unavailable.';
      const card = document.createElement('div');
      card.className = 'tup-team-card tup-team-card--message';
      card.innerHTML = isUnavailable ? createTeamRetryMessageMarkup(emptyMessage) : `<span>${escapeHtml(emptyMessage)}</span>`;
      container.replaceChildren(card);
      section.dataset.tupApiFailed = isUnavailable ? 'true' : 'false';
      renderNoProductMatch(section);
      return false;
    }

    const cards = teams.map((team) => createTeamCard(team, products, mappings));
    if (cards[0]) {
      cards[0].classList.add('is-selected');
      cards[0].setAttribute('aria-pressed', 'true');
    }
    container.replaceChildren(...cards);
    bindTeamCards(section, products, mappings, debugEntries);
    return true;
  };

  /** @param {HTMLElement} section @param {string} tabName @returns {void} */
  const setActiveTab = (section, tabName) => {
    section.querySelectorAll('[data-team-filter-tab]').forEach((tab) => {
      const isActive = tab instanceof HTMLButtonElement && tab.dataset.teamFilterTab === tabName;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  };

  /**
   * @param {HTMLElement} section
   * @param {TupChooseTeamProduct[]} products
   * @param {TupCountryBlendMapping[]} mappings
   * @param {TupCountryBlendMapping[]} debugEntries
   * @returns {void}
   */
  const renderSelectedTab = (section, products, mappings, debugEntries) => {
    const activeTab = section.dataset.activeTeamTab || 'today';
    const state = section.tupChooseTeamState || { today: [], all: [] };
    const teams = activeTab === 'all' ? state.all : state.today;
    const emptyMessage =
      activeTab === 'all' ? 'Teams are currently unavailable.' : 'No teams are playing today.';

    setActiveTab(section, activeTab);
    renderTeamCards(section, teams, products, mappings, debugEntries, emptyMessage);
  };

  /**
   * @param {HTMLElement} section
   * @param {TupChooseTeamProduct[]} products
   * @param {TupCountryBlendMapping[]} mappings
   * @param {TupCountryBlendMapping[]} debugEntries
   * @returns {void}
   */
  const bindTabs = (section, products, mappings, debugEntries) => {
    section.querySelectorAll('[data-team-filter-tab]').forEach((tab) => {
      if (!(tab instanceof HTMLButtonElement)) return;
      tab.addEventListener('click', () => {
        section.dataset.activeTeamTab = tab.dataset.teamFilterTab || 'today';
        renderSelectedTab(section, products, mappings, debugEntries);
      });
    });
  };

  /**
   * @param {HTMLElement} section
   * @param {TupChooseTeamProduct[]} products
   * @param {TupCountryBlendMapping[]} mappings
   * @param {TupCountryBlendMapping[]} debugEntries
   * @returns {Promise<void>}
   */
  const fetchApiTeams = async (section, products, mappings, debugEntries) => {
    try {
      const payloads = await shared.fetchMissingApiPayloads(section, 'tupChooseTeamApiState', LOG_PREFIX);
      const teamsById = buildTeamLookup(getList(payloads.teams, 'teams'));
      const games = getList(payloads.games, 'games');

      section.tupChooseTeamState = {
        today: teamsPlayingToday(teamsById, games),
        all: allTeamsByGroup(teamsById),
      };

      section.dataset.tupApiFailed = 'false';
      renderSelectedTab(section, products, mappings, debugEntries);
      return;
    } catch (error) {
      console.warn(`${LOG_PREFIX} Teams API unavailable.`, error);
    }

    renderTeamUnavailable(section, products);
  };

  /** @param {HTMLElement} section @param {HTMLButtonElement} button @returns {Promise<void>} */
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
          properties: {
            Campaign: 'T Up for the Cup',
            'Country Code': button.dataset.countryCode || '',
            Country: button.dataset.countryName || '',
            Source: 'Team Product Showcase',
          },
        }),
      });
      const payload = /** @type {TupJsonObject & { status?: string; description?: string; message?: string }} */ (
        await response.json()
      );

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
              countryCode: button.dataset.countryCode || '',
            },
          },
        })
      );

      button.textContent = 'Added';
      setMessage(section, 'Added to cart.');
    } catch (error) {
      console.error(`${LOG_PREFIX} Add to cart failed.`, error);
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

  /** @param {HTMLElement} section @returns {void} */
  const initSection = (section) => {
    if (!(section instanceof HTMLElement) || section.dataset.tupChooseTeamInitialized === 'true') return;
    section.dataset.tupChooseTeamInitialized = 'true';

    const products = readProducts(section);
    const mappings = readCountryBlendMappings(section);
    const debugEntries = readCountryBlendDebugEntries(section);
    section.dataset.activeTeamTab = section.dataset.activeTeamTab || 'today';
    bindTabs(section, products, mappings, debugEntries);
    fetchApiTeams(section, products, mappings, debugEntries);

    const addButton = section.querySelector('[data-product-add-to-cart]');
    if (addButton instanceof HTMLButtonElement) {
      addButton.addEventListener('click', () => addToCart(section, addButton));
    }

    section.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const retryButton = event.target.closest('[data-tup-api-retry]');
      if (!(retryButton instanceof HTMLButtonElement)) return;
      document.dispatchEvent(new CustomEvent('tup:worldcup-api-retry'));
    });

    document.addEventListener('tup:worldcup-api-retry', () => {
      if (!document.body.contains(section) || section.dataset.tupApiFailed !== 'true') return;
      const state = shared.getApiState(section, 'tupChooseTeamApiState');
      if (state.loading) return;
      fetchApiTeams(section, products, mappings, debugEntries);
    });
  };

  /** @param {ParentNode | Document} [root] @returns {void} */
  const init = (root = document) => {
    if (root instanceof HTMLElement && root.matches(SECTION_SELECTOR)) initSection(root);
    root.querySelectorAll?.(SECTION_SELECTOR).forEach((section) => {
      if (section instanceof HTMLElement) initSection(section);
    });
  };

  init();

  document.addEventListener('shopify:section:load', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement) init(target);
  });
})();
