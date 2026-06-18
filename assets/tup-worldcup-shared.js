/// <reference path="./global.d.ts" />
/// <reference path="./tup-worldcup.d.ts" />

/// <reference path="./global.d.ts" />
/// <reference path="./tup-worldcup.d.ts" />

/**
 * Shared World Cup API helpers for T Up campaign section scripts.
 * @type {{
 *   TEAMS_ENDPOINT: string;
 *   GAMES_ENDPOINT: string;
 *   escapeHtml: (value: unknown) => string;
 *   fetchJson: (url: string) => Promise<unknown>;
 *   getList: (payload: unknown, key: string) => TupJsonObject[];
 *   getApiState: (section: HTMLElement, stateKey: 'tupHeroApiState' | 'tupChooseTeamApiState' | 'tupUpcomingApiState') => TupApiState;
 *   setRetryBusy: (section: HTMLElement, busy: boolean) => void;
 *   fetchMissingApiPayloads: (section: HTMLElement, stateKey: 'tupHeroApiState' | 'tupChooseTeamApiState' | 'tupUpcomingApiState', logPrefix: string) => Promise<Partial<Record<TupApiKey, unknown>>>;
 *   parseGameDate: (game: TupJsonObject) => Date | null;
 *   normalizeStatus: (status: unknown, finished: unknown) => TupMatchStatusState;
 *   dateSortValue: (date: Date | null | undefined) => number;
 * }}
 */
const TupWorldCupShared = {
  TEAMS_ENDPOINT: 'https://worldcup26.ir/get/teams',
  GAMES_ENDPOINT: 'https://worldcup26.ir/get/games',

  /** @param {unknown} value @returns {string} */
  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => {
      /** @type {Record<string, string>} */
      const entities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return char in entities ? entities[char] : char;
    });
  },

  /** @param {string} url @returns {Promise<unknown>} */
  async fetchJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return response.json();
  },

  /** @param {unknown} payload @param {string} key @returns {TupJsonObject[]} */
  getList(payload, key) {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object') {
      const record = /** @type {TupJsonObject} */ (payload);
      if (Array.isArray(record[key])) return /** @type {TupJsonObject[]} */ (record[key]);
      const data = record.data;
      if (data && typeof data === 'object' && Array.isArray(/** @type {TupJsonObject} */ (data)[key])) {
        return /** @type {TupJsonObject[]} */ (/** @type {TupJsonObject} */ (data)[key]);
      }
    }
    return [];
  },

  /**
   * @param {HTMLElement} section
   * @param {'tupHeroApiState' | 'tupChooseTeamApiState' | 'tupUpcomingApiState'} stateKey
   * @returns {TupApiState}
   */
  getApiState(section, stateKey) {
    if (!section[stateKey]) {
      section[stateKey] = {
        payloads: {},
        failed: new Set(),
        loading: false,
      };
    }
    return /** @type {TupApiState} */ (section[stateKey]);
  },

  /** @param {HTMLElement} section @param {boolean} busy @returns {void} */
  setRetryBusy(section, busy) {
    section.querySelectorAll('[data-tup-api-retry]').forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.disabled = busy;
      button.setAttribute('aria-busy', busy ? 'true' : 'false');
      button.querySelector('[data-retry-label]')?.replaceChildren(busy ? 'Trying...' : 'Try again');
    });
  },

  /**
   * @param {HTMLElement} section
   * @param {'tupHeroApiState' | 'tupChooseTeamApiState' | 'tupUpcomingApiState'} stateKey
   * @param {string} logPrefix
   * @returns {Promise<Partial<Record<TupApiKey, unknown>>>}
   */
  async fetchMissingApiPayloads(section, stateKey, logPrefix) {
    const state = TupWorldCupShared.getApiState(section, stateKey);
    /** @type {Record<TupApiKey, string>} */
    const endpoints = {
      teams: TupWorldCupShared.TEAMS_ENDPOINT,
      games: TupWorldCupShared.GAMES_ENDPOINT,
    };
    /** @type {TupApiKey[]} */
    const keys = /** @type {TupApiKey[]} */ (
      Object.keys(endpoints).filter((key) => {
        const apiKey = /** @type {TupApiKey} */ (key);
        return !state.payloads[apiKey] || state.failed.has(apiKey);
      })
    );

    if (!keys.length) return state.payloads;

    state.loading = true;
    TupWorldCupShared.setRetryBusy(section, true);

    const results = await Promise.allSettled(keys.map((key) => TupWorldCupShared.fetchJson(endpoints[key])));
    results.forEach((result, index) => {
      const key = keys[index];
      if (!key) return;

      if (result.status === 'fulfilled') {
        state.payloads[key] = result.value;
        state.failed.delete(key);
      } else {
        state.failed.add(key);
        console.warn(`${logPrefix} ${key} API unavailable.`, result.reason);
      }
    });

    state.loading = false;
    TupWorldCupShared.setRetryBusy(section, false);

    if (state.failed.size) {
      throw new Error(`World Cup API failed: ${[...state.failed].join(', ')}`);
    }

    return state.payloads;
  },

  /** @param {TupJsonObject} game @returns {Date | null} */
  parseGameDate(game) {
    const raw = game.local_date || game.date || game.datetime;
    if (!raw) return null;
    const parts = String(raw).split(' ');
    const datePart = parts[0];
    const timePart = parts[1] ?? '00:00';
    if (!datePart) return null;
    const [month, day, year] = datePart.split('/').map(Number);
    const [hours = 0, minutes = 0] = timePart.split(':').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day, hours, minutes);
  },

  /** @param {unknown} status @param {unknown} finished @returns {TupMatchStatusState} */
  normalizeStatus(status, finished) {
    const value = String(status || '').toLowerCase();
    const done = String(finished || '').toLowerCase() === 'true';
    if (done || value === 'finished' || value === 'completed') return 'completed';
    if (
      value === 'live' ||
      value === 'inprogress' ||
      value === 'in_progress' ||
      value === 'halftime' ||
      value === 'half_time'
    ) {
      return 'live';
    }
    return 'upcoming';
  },

  /** @param {Date | null | undefined} date @returns {number} */
  dateSortValue(date) {
    return date instanceof Date ? date.getTime() : 0;
  },
};

window.TupWorldCupShared = TupWorldCupShared;
