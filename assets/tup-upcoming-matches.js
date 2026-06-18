/// <reference path="./global.d.ts" />
/// <reference path="./tup-worldcup.d.ts" />

(() => {
  const shared = window.TupWorldCupShared;
  if (!shared) {
    console.error('[T Up Upcoming Matches] Shared World Cup helpers are missing.');
    return;
  }

  const { escapeHtml, getList, parseGameDate, normalizeStatus, dateSortValue } = shared;
  const SECTION_SELECTOR = '[data-tup-upcoming-matches]';
  const STORAGE_KEY = 'tup_selected_match';
  const LOG_PREFIX = '[T Up Upcoming Matches]';

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
   * @param {Date | null} date
   * @param {TupMatchStatusState} state
   * @returns {string}
   */
  const getKickoffText = (date, state) => {
    if (state === 'live') return 'Live now';
    if (state === 'completed') return 'Full time';
    if (!(date instanceof Date)) return 'Kick-off soon';

    const diff = date.getTime() - Date.now();
    if (diff <= 0) return 'Kick-off soon';

    const totalMinutes = Math.floor(diff / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `Kick-off in ${days}d ${hours}h`;
    return `Kick-off in ${hours}h ${String(minutes).padStart(2, '0')}m`;
  };

  /**
   * @param {TupJsonObject} game
   * @param {TupTeamLookup} teamsById
   * @returns {TupUpcomingMatch}
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
    const state = normalizeStatus(game.time_elapsed, game.finished);
    const date = parseGameDate(game);
    const teamAName = homeTeam.name || String(game.home_team_name_en || game.home_team_label || 'Team A');
    const teamBName = awayTeam.name || String(game.away_team_name_en || game.away_team_label || 'Team B');

    return {
      id: String(game.id || game._id || `${teamAName}-${teamBName}`),
      state,
      teamAName,
      teamAFlag: homeTeam.flag || '',
      teamACode: homeTeam.fifaCode || '',
      teamBName,
      teamBFlag: awayTeam.flag || '',
      teamBCode: awayTeam.fifaCode || '',
      stage: getStage(game, homeTeam, awayTeam),
      kickoffText: getKickoffText(date, state),
      scoreText: state === 'live' || state === 'completed' ? `${game.home_score ?? 0} - ${game.away_score ?? 0}` : '',
      date,
    };
  };

  /** @param {TupUpcomingMatch[]} matches @returns {TupUpcomingMatch[]} */
  const sortMatches = (matches) =>
    [...matches].sort((a, b) => {
      /** @type {Record<TupMatchStatusState, number>} */
      const stateWeight = { live: 0, upcoming: 1, completed: 2 };
      const weightDiff = (stateWeight[a.state] ?? 9) - (stateWeight[b.state] ?? 9);
      if (weightDiff) return weightDiff;
      if (a.state === 'completed') return dateSortValue(b.date) - dateSortValue(a.date);
      return (dateSortValue(a.date) || Number.POSITIVE_INFINITY) - (dateSortValue(b.date) || Number.POSITIVE_INFINITY);
    });

  /**
   * @param {string} url
   * @param {string} name
   * @param {string} code
   * @returns {string}
   */
  const flagMarkup = (url, name, code) => {
    if (url) {
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(name)}" loading="lazy">`;
    }

    return `<span class="tup-upcoming-match-card__flag-text">${escapeHtml((code || name).slice(0, 2).toUpperCase())}</span>`;
  };

  /** @param {TupUpcomingMatch} match @returns {HTMLElement} */
  const createCard = (match) => {
    const card = document.createElement('article');
    card.className = 'tup-upcoming-match-card';
    card.dataset.matchId = match.id;
    card.dataset.matchState = match.state;
    card.dataset.matchDetails = JSON.stringify(match);
    card.setAttribute('aria-label', `${match.teamAName} vs ${match.teamBName}`);
    card.innerHTML = `
      <span class="tup-upcoming-match-card__team">
        <span class="tup-upcoming-match-card__flag">${flagMarkup(match.teamAFlag, match.teamAName, match.teamACode)}</span>
        <span class="tup-upcoming-match-card__team-name">${escapeHtml(match.teamAName)}</span>
      </span>
      <span class="tup-upcoming-match-card__vs">vs</span>
      <span class="tup-upcoming-match-card__team">
        <span class="tup-upcoming-match-card__flag">${flagMarkup(match.teamBFlag, match.teamBName, match.teamBCode)}</span>
        <span class="tup-upcoming-match-card__team-name">${escapeHtml(match.teamBName)}</span>
      </span>
      <span class="tup-upcoming-match-card__details">
        <span class="tup-upcoming-match-card__group">${escapeHtml(match.stage)}</span>
        ${match.scoreText ? `<span class="tup-upcoming-match-card__score">${escapeHtml(match.scoreText)}</span>` : ''}
        <span class="tup-upcoming-match-card__countdown">${escapeHtml(match.kickoffText)}</span>
      </span>
    `;
    return card;
  };

  /** @param {HTMLElement} card @returns {TupUpcomingMatch} */
  const getCardDetails = (card) => {
    try {
      return /** @type {TupUpcomingMatch} */ (JSON.parse(card.dataset.matchDetails || '{}'));
    } catch (_) {
      return /** @type {TupUpcomingMatch} */ ({});
    }
  };

  /** @param {HTMLElement} section @param {HTMLElement} card @returns {void} */
  const selectCard = (section, card) => {
    for (const item of section.querySelectorAll('.tup-upcoming-match-card')) {
      item.classList.toggle('is-selected', item === card);
    }

    const details = getCardDetails(card);
    localStorage.setItem(STORAGE_KEY, details.id || card.dataset.matchId || '');
    section.dispatchEvent(
      new CustomEvent('tup:match-selected', {
        bubbles: true,
        detail: details,
      })
    );
  };

  /** @param {HTMLElement} section @returns {void} */
  const bindCards = (section) => {
    for (const card of section.querySelectorAll('.tup-upcoming-match-card')) {
      if (!(card instanceof HTMLElement)) continue;
      card.addEventListener('click', () => selectCard(section, card));
    }
  };

  /** @param {HTMLElement} section @returns {void} */
  const setupMatchLoop = (section) => {
    const scroller = section.querySelector('.tup-upcoming-matches__scroller');
    const track = section.querySelector('[data-upcoming-track]');
    if (!(scroller instanceof HTMLElement) || !(track instanceof HTMLElement)) return;

    track.querySelectorAll('[data-loop-clone]').forEach((clone) => clone.remove());

    const cards = Array.from(track.querySelectorAll('.tup-upcoming-match-card:not([data-loop-clone])'));
    if (cards.length < 2) return;

    cards.forEach((card) => {
      const clone = card.cloneNode(true);
      if (!(clone instanceof HTMLElement)) return;
      clone.setAttribute('data-loop-clone', '');
      clone.setAttribute('aria-hidden', 'true');
      track.append(clone);
    });

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || scroller.dataset.loopInitialized === 'true') return;

    scroller.dataset.loopInitialized = 'true';

    let lastTimestamp = 0;
    let paused = false;
    const pixelsPerSecond = 34;
    const getLoopPoint = () => track.scrollWidth / 2;

    /** @param {number} timestamp @returns {void} */
    const tick = (timestamp) => {
      if (!document.body.contains(scroller)) return;

      if (!lastTimestamp) lastTimestamp = timestamp;
      const delta = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      if (!paused && getLoopPoint() > scroller.clientWidth) {
        scroller.scrollLeft += (pixelsPerSecond * delta) / 1000;
        if (scroller.scrollLeft >= getLoopPoint()) {
          scroller.scrollLeft -= getLoopPoint();
        }
      }

      window.requestAnimationFrame(tick);
    };

    scroller.addEventListener('pointerenter', () => {
      paused = true;
    });
    scroller.addEventListener('pointerleave', () => {
      paused = false;
    });
    scroller.addEventListener('focusin', () => {
      paused = true;
    });
    scroller.addEventListener('focusout', () => {
      paused = false;
    });

    window.requestAnimationFrame(tick);
  };

  /** @param {HTMLElement} section @param {TupUpcomingMatch[]} matches @returns {void} */
  const renderApiMatches = (section, matches) => {
    const track = section.querySelector('[data-upcoming-track]');
    if (!track || !matches.length) return;
    section.dataset.tupApiFailed = 'false';
    track.replaceChildren(...matches.map(createCard));
    bindCards(section);
    setupMatchLoop(section);
  };

  /** @returns {string} */
  const createRetryButtonMarkup = () => `
    <button type="button" class="tup-api-retry" data-tup-api-retry aria-label="Try again">
      <span class="tup-api-retry__icon" aria-hidden="true"></span>
      <span data-retry-label>Try again</span>
    </button>
  `;

  /** @param {HTMLElement} section @param {string} [message] @returns {void} */
  const renderUnavailable = (section, message = 'Upcoming matches are currently unavailable.') => {
    const track = section.querySelector('[data-upcoming-track]');
    if (!track) return;
    section.dataset.tupApiFailed = 'true';
    const card = document.createElement('div');
    card.className = 'tup-upcoming-match-card tup-upcoming-match-card--message';
    card.innerHTML = `
      <p class="tup-upcoming-match-card__empty">${escapeHtml(message)}</p>
      ${createRetryButtonMarkup()}
    `;
    track.replaceChildren(card);
  };

  /** @param {HTMLElement} section @returns {Promise<void>} */
  const fetchApiMatches = async (section) => {
    try {
      const payloads = await shared.fetchMissingApiPayloads(section, 'tupUpcomingApiState', LOG_PREFIX);
      const teamsById = buildTeamLookup(getList(payloads.teams, 'teams'));
      const matches = sortMatches(getList(payloads.games, 'games').map((game) => normalizeGame(game, teamsById)));
      if (matches.length) {
        renderApiMatches(section, matches);
        return;
      }
      shared.getApiState(section, 'tupUpcomingApiState').failed = new Set(['teams', 'games']);
      renderUnavailable(section, 'No match data is available yet.');
      return;
    } catch (error) {
      console.warn(`${LOG_PREFIX} Matches API unavailable.`, error);
    }

    renderUnavailable(section);
  };

  /** @param {HTMLElement} section @returns {void} */
  const initSection = (section) => {
    if (!(section instanceof HTMLElement) || section.dataset.tupUpcomingInitialized === 'true') return;
    section.dataset.tupUpcomingInitialized = 'true';
    fetchApiMatches(section);

    section.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const retryButton = event.target.closest('[data-tup-api-retry]');
      if (!(retryButton instanceof HTMLButtonElement)) return;
      document.dispatchEvent(new CustomEvent('tup:worldcup-api-retry'));
    });

    document.addEventListener('tup:worldcup-api-retry', () => {
      if (!document.body.contains(section) || section.dataset.tupApiFailed !== 'true') return;
      const state = shared.getApiState(section, 'tupUpcomingApiState');
      if (state.loading) return;
      fetchApiMatches(section);
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
