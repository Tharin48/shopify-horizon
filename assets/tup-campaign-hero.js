(() => {
  const SECTION_SELECTOR = '[data-tup-campaign-hero]';

  const normalizeStatus = (status) => {
    const value = String(status || '').toLowerCase();
    if (value === 'upcoming' || value === 'completed') return value;
    return 'live';
  };

  const textFrom = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    return String(value);
  };

  const readFallbackMatch = (section) => ({
    competition: section.dataset.fallbackCompetition || 'World Cup',
    stage: section.dataset.fallbackStage || 'Group Stage',
    status: normalizeStatus(section.dataset.fallbackStatus),
    teamA: section.dataset.fallbackTeamA || 'South Korea',
    teamB: section.dataset.fallbackTeamB || 'Ghana',
    scoreA: section.dataset.fallbackScoreA || '2',
    scoreB: section.dataset.fallbackScoreB || '3',
    venue: section.dataset.fallbackVenue || 'Education City Stadium',
    meta: '28.11.2022 · 14:00 · TERMINADO',
    official: 'A. Taylor',
    teamACode: 'KR',
    teamBCode: 'GH',
  });

  const normalizeMatchPayload = (payload, fallback) => {
    const match = payload?.match || payload?.fixture || payload?.data || payload || {};
    const teams = match.teams || {};
    const goals = match.goals || match.score || {};
    const fixture = match.fixture || {};
    const league = match.league || {};

    return {
      competition: textFrom(match.competition || league.name, fallback.competition),
      stage: textFrom(match.stage || league.round, fallback.stage),
      status: normalizeStatus(match.status || fixture.status?.short || fixture.status?.long || fallback.status),
      teamA: textFrom(match.teamA || match.homeTeam || teams.home?.name, fallback.teamA),
      teamB: textFrom(match.teamB || match.awayTeam || teams.away?.name, fallback.teamB),
      scoreA: textFrom(match.scoreA ?? match.homeScore ?? goals.home, fallback.scoreA),
      scoreB: textFrom(match.scoreB ?? match.awayScore ?? goals.away, fallback.scoreB),
      venue: textFrom(match.venue || fixture.venue?.name, fallback.venue),
      meta: textFrom(match.meta || match.date || fixture.date, fallback.meta),
      official: textFrom(match.official || match.referee || fixture.referee, fallback.official),
      teamACode: textFrom(match.teamACode || teams.home?.code, fallback.teamACode),
      teamBCode: textFrom(match.teamBCode || teams.away?.code, fallback.teamBCode),
      teamAFlag: textFrom(match.teamAFlag || match.homeFlag || teams.home?.flag || teams.home?.logo, ''),
      teamBFlag: textFrom(match.teamBFlag || match.awayFlag || teams.away?.flag || teams.away?.logo, ''),
    };
  };

  const normalizeMatchesPayload = (payload, fallback) => {
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.matches)
        ? payload.matches
        : Array.isArray(payload?.fixtures)
          ? payload.fixtures
          : Array.isArray(payload?.response)
            ? payload.response
            : null;

    if (!list) return [normalizeMatchPayload(payload, fallback)];
    return list.map((item) => normalizeMatchPayload(item, fallback));
  };

  const setText = (section, key, value) => {
    const element = section.querySelector(`[data-match-${key}]`);
    if (element) element.textContent = value;
  };

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
      status.dataset.status = normalizeStatus(match.status);
    }
  };

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

  const createMatchCard = (match) => {
    const article = document.createElement('article');
    const teamACrest = match.teamAFlag
      ? `<img class="tup-match-card__flag" src="${escapeHtml(match.teamAFlag)}" alt="${escapeHtml(match.teamA)}" loading="lazy">`
      : escapeHtml(match.teamACode);
    const teamBCrest = match.teamBFlag
      ? `<img class="tup-match-card__flag" src="${escapeHtml(match.teamBFlag)}" alt="${escapeHtml(match.teamB)}" loading="lazy">`
      : escapeHtml(match.teamBCode);

    article.className = 'tup-match-card';
    article.setAttribute('data-match-card', '');
    article.setAttribute('aria-label', 'Match card');
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
        <div class="tup-match-card__score" data-match-score>${escapeHtml(match.scoreA)} - ${escapeHtml(match.scoreB)}</div>
        <div class="tup-match-card__team">
          <span class="tup-match-card__crest">${teamBCrest}</span>
          <span class="tup-match-card__team-name" data-match-team-b>${escapeHtml(match.teamB)}</span>
        </div>
      </div>
      <div class="tup-match-card__footer">
        <span class="tup-match-card__official">${escapeHtml(match.official)}</span>
        <span class="tup-match-card__venue" data-match-venue>${escapeHtml(match.venue)}</span>
      </div>
    `;
    return article;
  };

  const renderMatches = (section, matches) => {
    const track = section.querySelector('[data-match-track]');
    if (!track || matches.length < 1) return;

    track.replaceChildren(...matches.map(createMatchCard));
    renderMatch(section, matches[0]);
    setupScoreboardLoop(section);
  };

  const setupScoreboardLoop = (section) => {
    const viewport = section.querySelector('[data-match-slider]');
    const track = section.querySelector('[data-match-track]');
    if (!(viewport instanceof HTMLElement) || !(track instanceof HTMLElement)) return;

    viewport.querySelectorAll('[data-loop-clone]').forEach((clone) => clone.remove());

    const cards = Array.from(track.querySelectorAll('[data-match-card]:not([data-loop-clone])'));
    if (cards.length < 1) return;

    cards.forEach((card) => {
      const clone = card.cloneNode(true);
      clone.setAttribute('data-loop-clone', '');
      clone.setAttribute('aria-hidden', 'true');
      clone.removeAttribute('id');
      track.append(clone);
    });

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || viewport.dataset.loopInitialized === 'true') return;

    viewport.dataset.loopInitialized = 'true';

    let lastTimestamp = 0;
    let paused = false;
    const pixelsPerSecond = 26;

    const getLoopPoint = () => track.scrollWidth / 2;

    const tick = (timestamp) => {
      if (!document.body.contains(viewport)) return;

      if (!lastTimestamp) lastTimestamp = timestamp;
      const delta = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      if (!paused && getLoopPoint() > viewport.clientWidth) {
        viewport.scrollLeft += (pixelsPerSecond * delta) / 1000;

        if (viewport.scrollLeft >= getLoopPoint()) {
          viewport.scrollLeft -= getLoopPoint();
        }
      }

      window.requestAnimationFrame(tick);
    };

    viewport.addEventListener('mouseenter', () => {
      paused = true;
    });
    viewport.addEventListener('mouseleave', () => {
      paused = false;
    });
    viewport.addEventListener('focusin', () => {
      paused = true;
    });
    viewport.addEventListener('focusout', () => {
      paused = false;
    });

    window.requestAnimationFrame(tick);
  };

  const fetchMatch = async (section) => {
    const endpoint = section.dataset.apiEndpointUrl;
    const fallback = readFallbackMatch(section);
    renderMatch(section, fallback);

    if (!endpoint) return;

    try {
      const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Match API returned ${response.status}`);
      const payload = await response.json();
      renderMatches(section, normalizeMatchesPayload(payload, fallback));
    } catch (error) {
      console.warn('[T Up Campaign Hero] Keeping fallback match data.', error);
    }
  };

  const getCartSections = () =>
    Array.from(document.querySelectorAll('cart-items-component'))
      .map((element) => (element instanceof HTMLElement ? element.dataset.sectionId : ''))
      .filter(Boolean)
      .join(',');

  const openCartOrRedirect = () => {
    const drawer = document.querySelector('cart-drawer-component');
    if (drawer && typeof drawer.open === 'function') {
      drawer.open();
      return;
    }

    const trigger = document.querySelector('[data-testid="cart-drawer-trigger"]');
    if (trigger instanceof HTMLElement) {
      trigger.click();
      return;
    }

    window.location.href = window.Theme?.routes?.cart_url || '/cart';
  };

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
      const payload = await response.json();

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
              itemCount: cart?.item_count ?? 1,
              sections: payload.sections,
            },
          },
        })
      );

      button.textContent = 'Added';
      setMessage(section, 'Added to cart.');
      window.setTimeout(openCartOrRedirect, 80);
    } catch (error) {
      console.error('[T Up Campaign Hero] Add to cart failed.', error);
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

  const initSection = (section) => {
    if (!(section instanceof HTMLElement) || section.dataset.tupInitialized === 'true') return;
    section.dataset.tupInitialized = 'true';
    fetchMatch(section);
    setupScoreboardLoop(section);

    const button = section.querySelector('[data-tup-add-to-cart]');
    if (button instanceof HTMLButtonElement) {
      button.addEventListener('click', () => addBundleToCart(section, button));
    }
  };

  const init = (root = document) => {
    if (root instanceof HTMLElement && root.matches(SECTION_SELECTOR)) initSection(root);
    root.querySelectorAll?.(SECTION_SELECTOR).forEach(initSection);
  };

  init();

  document.addEventListener('shopify:section:load', (event) => init(event.target));
})();
