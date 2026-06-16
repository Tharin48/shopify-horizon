(() => {
  const SECTION_SELECTOR = '[data-tup-upcoming-matches]';
  const STORAGE_KEY = 'tup_selected_match';

  const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (char) => {
      const entities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[char];
    });

  const normalizeStatus = (status) => {
    const value = String(status || '').toLowerCase();
    if (value === 'live' || value === 'completed') return value;
    return 'upcoming';
  };

  const normalizeApiMatches = (payload) => {
    const matches = Array.isArray(payload?.matches) ? payload.matches : [];

    return matches.map((match) => ({
      id: String(match.id || `${match.teamA?.name || 'team-a'}-${match.teamB?.name || 'team-b'}`),
      state: normalizeStatus(match.state),
      teamAName: match.teamA?.name || 'Team A',
      teamAFlag: match.teamA?.flag || '',
      teamBName: match.teamB?.name || 'Team B',
      teamBFlag: match.teamB?.flag || '',
      stage: match.stage || 'Group Stage',
      kickoffText: match.kickoffText || 'Kick-off soon',
    }));
  };

  const flagMarkup = (url, name) => {
    if (url) {
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(name)}" loading="lazy">`;
    }

    return `<span class="tup-upcoming-match-card__flag-text">${escapeHtml(name.slice(0, 2).toUpperCase())}</span>`;
  };

  const createCard = (match) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'tup-upcoming-match-card';
    card.dataset.matchId = match.id;
    card.dataset.matchState = match.state;
    card.dataset.matchDetails = JSON.stringify(match);
    card.setAttribute('aria-pressed', 'false');
    card.innerHTML = `
      <span class="tup-upcoming-match-card__team">
        <span class="tup-upcoming-match-card__flag">${flagMarkup(match.teamAFlag, match.teamAName)}</span>
        <span class="tup-upcoming-match-card__team-name">${escapeHtml(match.teamAName)}</span>
      </span>
      <span class="tup-upcoming-match-card__vs">vs</span>
      <span class="tup-upcoming-match-card__team">
        <span class="tup-upcoming-match-card__flag">${flagMarkup(match.teamBFlag, match.teamBName)}</span>
        <span class="tup-upcoming-match-card__team-name">${escapeHtml(match.teamBName)}</span>
      </span>
      <span class="tup-upcoming-match-card__details">
        <span class="tup-upcoming-match-card__group">${escapeHtml(match.stage)}</span>
        <span class="tup-upcoming-match-card__countdown">${escapeHtml(match.kickoffText)}</span>
      </span>
    `;
    return card;
  };

  const getCardDetails = (card) => {
    try {
      return JSON.parse(card.dataset.matchDetails || '{}');
    } catch (_) {
      return {};
    }
  };

  const selectCard = (section, card) => {
    for (const item of section.querySelectorAll('.tup-upcoming-match-card')) {
      item.classList.toggle('is-selected', item === card);
      item.setAttribute('aria-pressed', item === card ? 'true' : 'false');
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

  const bindCards = (section) => {
    const storedMatchId = localStorage.getItem(STORAGE_KEY);

    for (const card of section.querySelectorAll('.tup-upcoming-match-card')) {
      if (!(card instanceof HTMLButtonElement)) continue;

      if (storedMatchId && card.dataset.matchId === storedMatchId) {
        card.classList.add('is-selected');
        card.setAttribute('aria-pressed', 'true');
      }

      card.addEventListener('click', () => selectCard(section, card));
    }
  };

  const renderApiMatches = (section, matches) => {
    const track = section.querySelector('[data-upcoming-track]');
    if (!track || !matches.length) return;
    track.replaceChildren(...matches.map(createCard));
    bindCards(section);
  };

  const fetchApiMatches = async (section) => {
    if (section.dataset.showApiData !== 'true' || !section.dataset.apiEndpointUrl) {
      bindCards(section);
      return;
    }

    try {
      const response = await fetch(section.dataset.apiEndpointUrl, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Upcoming matches API returned ${response.status}`);
      const payload = await response.json();
      const matches = normalizeApiMatches(payload);
      if (payload.status === 'success' && matches.length) {
        renderApiMatches(section, matches);
        return;
      }
    } catch (error) {
      console.warn('[T Up Upcoming Matches] Keeping theme editor fallback matches.', error);
    }

    bindCards(section);
  };

  const initSection = (section) => {
    if (!(section instanceof HTMLElement) || section.dataset.tupUpcomingInitialized === 'true') return;
    section.dataset.tupUpcomingInitialized = 'true';
    fetchApiMatches(section);
  };

  const init = (root = document) => {
    if (root instanceof HTMLElement && root.matches(SECTION_SELECTOR)) initSection(root);
    root.querySelectorAll?.(SECTION_SELECTOR).forEach(initSection);
  };

  init();
  document.addEventListener('shopify:section:load', (event) => init(event.target));
})();
