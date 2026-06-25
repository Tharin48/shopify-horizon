export {};

declare global {
  type TupApiKey = 'teams' | 'games';

  type TupMatchStatusState = 'upcoming' | 'live' | 'completed';

  /** Loose JSON object from World Cup API or theme JSON scripts. */
  type TupJsonObject = Record<string, unknown>;

  interface TupApiState {
    payloads: Partial<Record<TupApiKey, unknown>>;
    failed: Set<string>;
    loading: boolean;
  }

  interface TupMatchReward {
    teamA: string;
    teamB: string;
    discountCode: string;
    rewardText: string;
    expiryText: string;
    active: boolean;
  }

  interface TupRawMatchReward extends TupJsonObject {
    active?: boolean;
    discountCode?: string;
    teamA?: string;
    teamB?: string;
    rewardText?: unknown;
    expiryText?: string;
  }

  interface TupTeamRecord {
    id: string;
    name: string;
    flag: string;
    fifaCode: string;
    group: string;
    tabBadge?: string;
  }

  type TupTeamLookup = Record<string, TupTeamRecord>;

  interface TupHeroMatch {
    id: string;
    competition: string;
    stage: string;
    status: TupMatchStatusState;
    teamA: string;
    teamB: string;
    scoreA: number;
    scoreB: number;
    venue: string;
    meta: string;
    official: string;
    date: Date | null;
    matchEndTime: Date | null;
    teamACode: string;
    teamBCode: string;
    teamAFlag: string;
    teamBFlag: string;
  }

  interface TupUpcomingMatch {
    id: string;
    state: TupMatchStatusState;
    teamAName: string;
    teamAFlag: string;
    teamACode: string;
    teamBName: string;
    teamBFlag: string;
    teamBCode: string;
    stage: string;
    kickoffText: string;
    scoreText: string;
    date: Date | null;
  }

  interface TupChooseTeamProduct extends TupJsonObject {
    title?: string;
    image?: string;
    price?: string;
    url?: string;
    available?: boolean;
    variantId?: string | number;
    countryCode?: string;
    countryName?: string;
    custom?: {
      tup_country_codes?: string | string[];
      tup_blend_label?: string;
      tup_match_day_story?: string;
    };
  }

  interface TupCountryBlendMapping extends TupJsonObject {
    countryCode?: string;
    active?: boolean;
    blendBadge?: string;
    displayTitle?: string;
    productTitle?: string;
    productImage?: string;
    productPrice?: string;
    productUrl?: string;
    variantId?: string | number;
    storyTemplateId?: string;
    apiTeamName?: string;
    strengthValue?: number | string;
    strengthCopy?: string;
    aromaValue?: number | string;
    aromaCopy?: string;
    smoothnessValue?: number | string;
    smoothnessCopy?: string;
    assignedProductExists?: boolean;
    productId?: string | number;
    variantExists?: boolean;
    productImageLoaded?: boolean;
    productPriceLoaded?: boolean;
    productTitleLoaded?: boolean;
  }

  interface TupChooseTeamState {
    today: TupTeamRecord[];
    all: TupTeamRecord[];
  }

  interface CartDrawerComponentElement extends HTMLElement {
    open(): void;
  }

  interface HTMLElement {
    tupHeroApiState?: TupApiState;
    tupChooseTeamApiState?: TupApiState;
    tupUpcomingApiState?: TupApiState;
    tupChooseTeamState?: TupChooseTeamState;
  }
}
