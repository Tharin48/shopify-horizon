/// <reference path="./global.d.ts" />
/// <reference path="./tup-worldcup.d.ts" />

(() => {
  const shared = window.TupWorldCupShared;
  if (!shared) {
    console.error('[T Up Campaign Hero] Shared World Cup helpers are missing.');
    return;
  }

  const { escapeHtml, getList, parseGameDate, normalizeStatus, dateSortValue } = shared;
  const SECTION_SELECTOR = '[data-tup-campaign-hero]';
  const LOG_PREFIX = '[T Up Campaign Hero]';

  /** @param {unknown} value @returns {string} */
  const normalizeCode = (value) => String(value || '').trim().toUpperCase();

  /** @param {unknown} value @returns {string} */
  const getRichTextPlainText = (value) => {
    if (!value) return '';

    /** @param {unknown} node @returns {string} */
    const collectText = (node) => {
      if (!node) return '';
      if (typeof node === 'string') return node;
      if (Array.isArray(node)) return node.map(collectText).filter(Boolean).join(' ');
      if (typeof node !== 'object') return '';

      const record = /** @type {TupJsonObject} */ (node);
      const ownValue = typeof record.value === 'string' ? record.value : '';
      const childrenValue = Array.isArray(record.children) ? collectText(record.children) : '';
      return [ownValue, childrenValue].filter(Boolean).join(' ');
    };

    if (typeof value === 'object') return collectText(value).replace(/\s+/g, ' ').trim();

    const text = String(value).trim();
    if (!text) return '';

    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        return collectText(JSON.parse(text)).replace(/\s+/g, ' ').trim();
      } catch (error) {
        const richTextValues = [...text.matchAll(/["']value["']\s*(?::|=>)\s*["']([^"']+)["']/g)]
          .map((match) => match[1])
          .filter(Boolean);

        if (richTextValues.length) return richTextValues.join(' ').replace(/\s+/g, ' ').trim();

        return text;
      }
    }

    return text;
  };

  /** @param {HTMLElement} section @returns {TupMatchReward[]} */
  const getRewardMappings = (section) => {
    const script = section.querySelector('[data-tup-match-rewards]');
    if (!(script instanceof HTMLScriptElement)) return [];

    try {
      const rewards = JSON.parse(script.textContent || '[]')
        .filter((/** @type {TupRawMatchReward} */ reward) => reward?.active === true && reward?.discountCode)
        .map((/** @type {TupRawMatchReward} */ reward) => ({
          teamA: normalizeCode(reward.teamA),
          teamB: normalizeCode(reward.teamB),
          discountCode: String(reward.discountCode || '').trim(),
          rewardText: getRichTextPlainText(reward.rewardText),
          expiryText: String(reward.expiryText || '').trim(),
          active: true,
        }))
        .filter((/** @type {TupMatchReward} */ reward) => reward.teamA && reward.teamB && reward.discountCode);

      console.table(
        rewards.map((/** @type {TupMatchReward} */ reward) => ({
          teamA: reward.teamA,
          teamB: reward.teamB,
          discountCode: reward.discountCode,
          active: reward.active,
        }))
      );

      return rewards;
    } catch (error) {
      console.warn(`${LOG_PREFIX} Reward mappings could not be parsed.`, error);
      return [];
    }
  };

  /**
   * @param {TupHeroMatch} match
   * @param {TupMatchReward[]} rewards
   * @returns {TupMatchReward | null}
   */
  const findRewardForMatch = (match, rewards) => {
    if (match.status !== 'completed') return null;

    const homeCode = normalizeCode(match.teamACode);
    const awayCode = normalizeCode(match.teamBCode);
    const matchedReward =
      rewards.find(
        (reward) =>
          (reward.teamA === homeCode && reward.teamB === awayCode) ||
          (reward.teamA === awayCode && reward.teamB === homeCode)
      ) || null;

    console.log(`${LOG_PREFIX} selected match codes:`, {
      homeCode,
      awayCode,
      matchedReward,
    });

    return matchedReward;
  };

  /** @param {TupJsonObject[]} teams @returns {TupTeamLookup} */
  const buildTeamLookup = (teams) => {
    /** @type {TupTeamLookup} */
    const lookup = {};
    teams.forEach((/** @type {TupJsonObject} */ team) => {
      const id = String(team.id ?? team._id ?? '');
      if (!id) return;
      lookup[id] = {
        id,
        name: String(team.name_en || team.name || team.name_fa || 'Team'),
        flag: String(team.flag || ''),
        fifaCode: String(team.fifa_code || '').toUpperCase(),
        group: String(team.groups || team.group || ''),
      };
    });
    return lookup;
  };

  /** @param {TupJsonObject} game @param {TupMatchStatusState} status @returns {string} */
  const formatMatchMeta = (game, status) => {
    const date = parseGameDate(game);
    const statusLabel = status === 'completed' ? 'FINISHED' : status === 'live' ? 'NOW HAPPENING' : 'UPCOMING';
    if (!date) return statusLabel;
    return `${date.toLocaleDateString(undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })} · ${date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })} · ${statusLabel}`;
  };

  /**
   * @param {TupJsonObject} game
   * @param {TupTeamRecord} homeTeam
   * @param {TupTeamRecord} awayTeam
   * @returns {string}
   */
  const getStage = (game, homeTeam, awayTeam) => {
    if (game.type === 'group' || game.group) {
      return `Group ${game.group || homeTeam.group || awayTeam.group || ''}`.trim();
    }
    return String(game.type || game.group || 'World Cup').toUpperCase();
  };

  /**
   * @param {TupJsonObject} game
   * @param {Date | null} date
   * @returns {TupMatchStatusState}
   */
  const normalizeMatchStatus = (game, date) => {
    const status = normalizeStatus(game.time_elapsed, game.finished);
    if (status !== 'upcoming' || !(date instanceof Date)) return status;

    const isFinished = String(game.finished || '').toLowerCase() === 'true';
    const now = new Date();
    const matchWindowMs = 2.25 * 60 * 60 * 1000;
    const hasKickedOff = now >= date;
    const stillInMatchWindow = now.getTime() - date.getTime() <= matchWindowMs;

    if (!isFinished && hasKickedOff && stillInMatchWindow) return 'live';
    return status;
  };

  /**
   * @param {TupJsonObject} game
   * @param {TupTeamLookup} teamsById
   * @returns {TupHeroMatch}
   */
  const normalizeGame = (game, teamsById) => {
    const homeTeam = teamsById[String(game.home_team_id)] || {
      id: '',
      name: '',
      flag: '',
      fifaCode: '',
      group: '',
    };
    const awayTeam = teamsById[String(game.away_team_id)] || {
      id: '',
      name: '',
      flag: '',
      fifaCode: '',
      group: '',
    };
    const date = parseGameDate(game);
    const status = normalizeMatchStatus(game, date);
    const teamA = homeTeam.name || String(game.home_team_name_en || game.home_team_label || 'Team A');
    const teamB = awayTeam.name || String(game.away_team_name_en || game.away_team_label || 'Team B');

    return {
      id: String(game.id || game._id || `${teamA}-${teamB}`),
      competition: 'World Cup',
      stage: getStage(game, homeTeam, awayTeam) || 'World Cup',
      status,
      teamA,
      teamB,
      scoreA: Number(game.home_score ?? 0),
      scoreB: Number(game.away_score ?? 0),
      venue: '',
      meta: formatMatchMeta(game, status),
      official: '',
      date,
      teamACode: normalizeCode(homeTeam.fifaCode),
      teamBCode: normalizeCode(awayTeam.fifaCode),
      teamAFlag: homeTeam.flag || '',
      teamBFlag: awayTeam.flag || '',
    };
  };

  /** @param {TupHeroMatch[]} matches @returns {TupHeroMatch[]} */
  const getHeroMatches = (matches) => {
    const liveMatches = matches
      .filter((match) => match.status === 'live')
      .sort((a, b) => dateSortValue(a.date) - dateSortValue(b.date));
    const completedMatches = matches
      .filter((match) => match.status === 'completed')
      .sort((a, b) => dateSortValue(b.date) - dateSortValue(a.date));

    return [...liveMatches, ...completedMatches];
  };

  /** @param {HTMLElement} section @param {string} key @param {string} value @returns {void} */
  const setText = (section, key, value) => {
    const element = section.querySelector(`[data-match-${key}]`);
    if (element) element.textContent = value;
  };

  /** @param {HTMLElement} section @param {TupHeroMatch} match @returns {void} */
  const renderMatch = (section, match) => {
    setText(section, 'competition', match.competition);
    setText(section, 'stage', match.stage);
    setText(section, 'status', match.status);
    setText(section, 'team-a', match.teamA);
    setText(section, 'team-b', match.teamB);
    setText(section, 'score', `${match.scoreA} - ${match.scoreB}`);
    setText(section, 'venue', match.venue);

    const status = section.querySelector('[data-match-status]');
    if (status instanceof HTMLElement) {
      status.dataset.status = normalizeStatus(match.status, false);
      status.textContent = match.status === 'live' ? 'Now happening' : match.status;
    }
  };

  /** @param {TupMatchReward | null | undefined} reward @returns {string} */
  const createRewardMarkup = (reward) => {
    if (!reward) return '';

    const rewardText =
      reward.rewardText || 'Use this code at checkout for your match-day T-Series reward.';
    const expiryText = reward.expiryText
      ? `<p class="tup-match-reward__expiry">${escapeHtml(reward.expiryText)}</p>`
      : '';

    return `
      <div class="tup-match-reward" data-match-reward>
        <p class="tup-match-reward__text">${escapeHtml(rewardText)}</p>
        ${expiryText}
        <div class="tup-match-reward__actions">
          <span class="tup-match-reward__code" data-reward-code>${escapeHtml(reward.discountCode)}</span>
          <button
            type="button"
            class="tup-match-reward__copy"
            data-copy-reward
            data-discount-code="${escapeHtml(reward.discountCode)}"
            aria-label="Copy discount code"
          >
            <span data-copy-label>Copy</span>
          </button>
        </div>
        <p class="tup-match-reward__message" data-copy-message role="status"></p>
      </div>
    `;
  };

  /**
   * @param {TupHeroMatch} match
   * @param {TupMatchReward[]} rewards
   * @returns {HTMLElement}
   */
  const createMatchCard = (match, rewards) => {
    const article = document.createElement('article');
    const reward = findRewardForMatch(match, rewards);
    const teamACrest = match.teamAFlag
      ? `<img class="tup-match-card__flag" src="${escapeHtml(match.teamAFlag)}" alt="${escapeHtml(match.teamA)}" loading="lazy">`
      : escapeHtml(match.teamACode || match.teamA.slice(0, 2).toUpperCase());
    const teamBCrest = match.teamBFlag
      ? `<img class="tup-match-card__flag" src="${escapeHtml(match.teamBFlag)}" alt="${escapeHtml(match.teamB)}" loading="lazy">`
      : escapeHtml(match.teamBCode || match.teamB.slice(0, 2).toUpperCase());

    article.className = 'tup-match-card';
    article.setAttribute('data-match-card', '');
    article.setAttribute('aria-label', 'Match card');
    const footerMarkup =
      match.official || match.venue
        ? `
          <div class="tup-match-card__footer">
            <span class="tup-match-card__official">${escapeHtml(match.official)}</span>
            <span class="tup-match-card__venue" data-match-venue>${escapeHtml(match.venue)}</span>
          </div>
        `
        : '';

    article.innerHTML = `
      <div class="tup-match-card__top">
        <span class="tup-match-card__competition" data-match-competition>${escapeHtml(match.competition)}</span>
        <span class="tup-match-card__stage" data-match-stage>${escapeHtml(match.stage)}</span>
      </div>
      <div class="tup-match-card__meta">${escapeHtml(match.meta)}</div>
      <div class="tup-match-card__body">
        <div class="tup-match-card__team">
          <span class="tup-match-card__crest">${teamACrest}</span>
          <span class="tup-match-card__team-name" data-match-team-a>${escapeHtml(match.teamA)}</span>
        </div>
        <div class="tup-match-card__score" data-match-score>${escapeHtml(String(match.scoreA))} - ${escapeHtml(String(match.scoreB))}</div>
        <div class="tup-match-card__team">
          <span class="tup-match-card__crest">${teamBCrest}</span>
          <span class="tup-match-card__team-name" data-match-team-b>${escapeHtml(match.teamB)}</span>
        </div>
      </div>
      ${footerMarkup}
      ${createRewardMarkup(reward)}
    `;
    return article;
  };

  /** @param {HTMLElement} section @param {TupHeroMatch[]} matches @returns {void} */
  const renderMatches = (section, matches) => {
    const track = section.querySelector('[data-match-track]');
    if (!track || matches.length < 1) return;

    const rewards = getRewardMappings(section);
    track.replaceChildren(...matches.slice(0, 8).map((match) => createMatchCard(match, rewards)));
    const firstMatch = matches[0];
    if (firstMatch) renderMatch(section, firstMatch);
  };

  /** @param {HTMLElement | null} element @returns {void} */
  const selectText = (element) => {
    if (!(element instanceof HTMLElement)) return;

    const selection = window.getSelection?.();
    if (!selection) return;

    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  /** @param {HTMLButtonElement} button @returns {Promise<void>} */
  const copyDiscountCode = async (button) => {
    const code = String(button.dataset.discountCode || '').trim();
    if (!code) return;

    const reward = button.closest('[data-match-reward]');
    const label = button.querySelector('[data-copy-label]');
    const message = reward?.querySelector('[data-copy-message]');
    const codeElement = reward?.querySelector('[data-reward-code]');
    /** @param {string} text @returns {void} */
    const setLabel = (text) => {
      if (label instanceof HTMLElement) label.textContent = text;
    };
    /** @param {string} text @returns {void} */
    const setMessage = (text) => {
      if (message instanceof HTMLElement) message.textContent = text;
    };

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable.');

      await navigator.clipboard.writeText(code);
      setLabel('Copied');
      setMessage('');
    } catch (error) {
      selectText(codeElement instanceof HTMLElement ? codeElement : null);
      setLabel('Copy');
      setMessage('Copy this code at checkout.');
    }

    window.setTimeout(() => {
      setLabel('Copy');
      setMessage('');
    }, 2000);
  };

  /** @returns {string} */
  const createRetryButtonMarkup = () => `
    <button type="button" class="tup-api-retry tup-api-retry--dark" data-tup-api-retry aria-label="Try again">
      <span class="tup-api-retry__icon" aria-hidden="true"></span>
      <span data-retry-label>Try again</span>
    </button>
  `;

  /** @param {HTMLElement} section @param {string} [message] @returns {void} */
  const renderUnavailable = (section, message = 'Match results are loading.') => {
    const track = section.querySelector('[data-match-track]');
    if (!track) return;
    section.dataset.tupApiFailed = 'true';

    track.replaceChildren();
    const card = document.createElement('article');
    card.className = 'tup-match-card';
    card.setAttribute('aria-label', 'Match results unavailable');
    card.innerHTML = `
      <div class="tup-match-card__top">
        <span class="tup-match-card__competition">World Cup</span>
        <span class="tup-match-card__stage">Results</span>
      </div>
      <div class="tup-match-card__body">
        <p class="tup-match-card__empty">${escapeHtml(message)}</p>
      </div>
      <div class="tup-match-card__retry">
        ${createRetryButtonMarkup()}
      </div>
    `;
    track.append(card);

    const status = section.querySelector('[data-match-status]');
    if (status instanceof HTMLElement) {
      status.textContent = 'Loading';
      status.dataset.status = 'loading';
    }
  };

  /** @param {HTMLElement} section @returns {Promise<void>} */
  const fetchMatch = async (section) => {
    try {
      const payloads = await shared.fetchMissingApiPayloads(section, 'tupHeroApiState', LOG_PREFIX);
      const teamsById = buildTeamLookup(getList(payloads.teams, 'teams'));
      const matches = getHeroMatches(getList(payloads.games, 'games').map((game) => normalizeGame(game, teamsById)));
      if (!matches.length) {
        shared.getApiState(section, 'tupHeroApiState').failed = new Set(['teams', 'games']);
        renderUnavailable(section, 'No live or completed match results are available yet.');
        return;
      }

      section.dataset.tupApiFailed = 'false';
      renderMatches(section, matches);
    } catch (error) {
      console.warn(`${LOG_PREFIX} Match results API unavailable.`, error);
      renderUnavailable(section, 'Match results are currently unavailable.');
    }
  };

  /** @returns {string} */
  const getCartSections = () =>
    Array.from(document.querySelectorAll('cart-items-component'))
      .map((element) => (element instanceof HTMLElement ? element.dataset.sectionId : ''))
      .filter(Boolean)
      .join(',');

  /** @returns {void} */
  const openCartOrRedirect = () => {
    const drawer = document.querySelector('cart-drawer-component');
    if (drawer instanceof HTMLElement && typeof /** @type {CartDrawerComponentElement} */ (drawer).open === 'function') {
      /** @type {CartDrawerComponentElement} */ (drawer).open();
      return;
    }

    const trigger = document.querySelector('[data-testid="cart-drawer-trigger"]');
    if (trigger instanceof HTMLElement) {
      trigger.click();
      return;
    }

    window.location.href = window.Theme?.routes?.cart_url || '/cart';
  };

  /** @param {HTMLElement} section @param {string} message @param {string} [tone] @returns {void} */
  const setMessage = (section, message, tone = '') => {
    const messageElement = section.querySelector('[data-tup-cart-message]');
    if (!(messageElement instanceof HTMLElement)) return;
    messageElement.textContent = message;
    if (tone) {
      messageElement.dataset.tone = tone;
    } else {
      delete messageElement.dataset.tone;
    }
  };

  /** @param {HTMLElement} section @param {HTMLButtonElement} button @returns {Promise<void>} */
  const addBundleToCart = async (section, button) => {
    const variantId = section.dataset.bundleVariantId;
    if (!variantId) {
      setMessage(section, 'Select a bundle product in the section settings.', 'error');
      return;
    }

    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    const originalText = button.textContent;
    button.textContent = 'Adding...';
    setMessage(section, '');

    /** @type {{ id: number; quantity: number; properties: Record<string, string>; sections?: string }} */
    const body = {
      id: Number(variantId),
      quantity: 1,
      properties: {
        Campaign: 'T Up for the Cup',
        Source: 'Hero Bundle',
      },
    };

    const sections = getCartSections();
    if (sections) body.sections = sections;

    try {
      const cartAddUrl = window.Theme?.routes?.cart_add_url || '/cart/add.js';
      const cartUrl = `${window.Theme?.routes?.cart_url || '/cart'}.js`;
      const response = await fetch(cartAddUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });
      const payload = /** @type {TupJsonObject & { status?: string; description?: string; message?: string; sections?: unknown }} */ (
        await response.json()
      );

      if (!response.ok || payload.status) {
        throw new Error(payload.description || payload.message || 'Unable to add this bundle to cart.');
      }

      const cart = await fetch(cartUrl, { headers: { Accept: 'application/json' } })
        .then((cartResponse) => (cartResponse.ok ? cartResponse.json() : null))
        .catch(() => null);

      document.dispatchEvent(
        new CustomEvent('cart:update', {
          bubbles: true,
          detail: {
            resource: cart || payload,
            sourceId: section.id,
            data: {
              source: 'tup-campaign-hero',
              variantId,
              itemCount: cart && typeof cart === 'object' && 'item_count' in cart ? Number(cart.item_count) : 1,
              sections: payload.sections,
            },
          },
        })
      );

      button.textContent = 'Added';
      setMessage(section, 'Added to cart.');
      window.setTimeout(openCartOrRedirect, 80);
    } catch (error) {
      console.error(`${LOG_PREFIX} Add to cart failed.`, error);
      setMessage(section, error instanceof Error ? error.message : 'Unable to add this bundle to cart.', 'error');
      button.textContent = originalText || 'Add to cart';
    } finally {
      window.setTimeout(() => {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = originalText || 'Add to cart';
      }, 1200);
    }
  };

  /** @param {HTMLElement} section @returns {void} */
  const initSection = (section) => {
    if (!(section instanceof HTMLElement) || section.dataset.tupInitialized === 'true') return;
    section.dataset.tupInitialized = 'true';
    fetchMatch(section);

    const button = section.querySelector('[data-tup-add-to-cart]');
    if (button instanceof HTMLButtonElement) {
      button.addEventListener('click', () => addBundleToCart(section, button));
    }

    section.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const copyButton = event.target.closest('[data-copy-reward]');
      if (copyButton instanceof HTMLButtonElement) copyDiscountCode(copyButton);
    });

    section.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const retryButton = event.target.closest('[data-tup-api-retry]');
      if (!(retryButton instanceof HTMLButtonElement)) return;
      document.dispatchEvent(new CustomEvent('tup:worldcup-api-retry'));
    });

    document.addEventListener('tup:worldcup-api-retry', () => {
      if (!document.body.contains(section) || section.dataset.tupApiFailed !== 'true') return;
      const state = shared.getApiState(section, 'tupHeroApiState');
      if (state.loading) return;
      fetchMatch(section);
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
