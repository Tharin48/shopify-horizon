/**
 * Copy custom-header-related `names` / `settings` strings from EN_STRINGS below into
 * every non-default locale `*.schema.json` so Theme Check `MatchingTranslations` passes.
 *
 * When you add new keys under `names` or `settings` in locales/en.default.schema.json
 * for the custom header section, add the same keys and English copy here, then run:
 *   node scripts/sync-custom-header-schema-translations.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '..', 'locales');

const HEADER = `/*
 * ------------------------------------------------------------
 * IMPORTANT: The contents of this file are auto-generated.
 *
 * This file may be updated by the Shopify admin language editor
 * or related systems. Please exercise caution as any changes
 * made to this file may be overwritten.
 * ------------------------------------------------------------
 */
`;

function stripLeadingComment(src) {
  return src.replace(/^\/\*[\s\S]*?\*\/\s*/, '').trim();
}

function loadJson(pathname) {
  const raw = fs.readFileSync(pathname, 'utf8');
  return JSON.parse(stripLeadingComment(raw));
}

const NAMES_KEYS = ['custom_header', 'tea_club'];
const SETTINGS_KEYS = [
  'default_header_height',
  'enable_homepage_transparent_header',
  'enable_sticky_header',
  'minimized_background',
  'minimized_text_color',
  'minimized_header_height',
  'minimized_nav_alignment',
  'minimized_nav_alignment_info',
  'show_desktop_search_bar',
  'show_desktop_search_bar_info',
  'desktop_search_style',
  'desktop_search_style_info',
  'desktop_search_style_custom',
  'desktop_search_style_default',
  'desktop_search_placeholder',
  'search_bar_colors_header',
  'search_bar_background',
  'search_bar_text_color',
  'search_bar_border_color',
  'search_bar_border_color_info',
  'search_bar_focus_color',
  'search_bar_focus_color_info',
  'scroll_threshold',
  'show_tea_club_button',
  'tea_club_label',
  'tea_club_link',
  'solid_background',
  'solid_text_color',
  'transparent_header_background',
  'transparent_header_background_info',
  'transparent_text_color',
];

/** Source: locales/en.default.schema.json (same strings as theme editor English) */
const EN_STRINGS = {
  names: {
    custom_header: 'Custom header',
    tea_club: 'Tea Club',
  },
  settings: {
    default_header_height: 'Default header height',
    enable_homepage_transparent_header: 'Transparent header on home page',
    enable_sticky_header: 'Enable sticky header',
    minimized_background: 'Minimized header background',
    minimized_text_color: 'Minimized header text color',
    minimized_header_height: 'Minimized header height',
    minimized_nav_alignment: 'Minimized header menu position',
    minimized_nav_alignment_info:
      'Controls where the navigation links sit in the compact sticky header on desktop',
    show_desktop_search_bar: 'Show search bar on homepage header',
    show_desktop_search_bar_info:
      'Displays a pill-shaped search bar below the navigation when the header is in transparent mode (homepage)',
    desktop_search_style: 'Desktop search bar behaviour',
    desktop_search_style_info:
      'Custom: live autocomplete dropdown with recent searches and product suggestions. Default: opens the theme\'s full predictive-search modal.',
    desktop_search_style_custom: 'Custom dropdown',
    desktop_search_style_default: 'Default search modal',
    desktop_search_placeholder: 'Search bar placeholder text',
    search_bar_colors_header: 'Search bar colors',
    search_bar_background: 'Background',
    search_bar_text_color: 'Text & icon color',
    search_bar_border_color: 'Border color',
    search_bar_border_color_info: 'Subtle border in the default (unfocused) state',
    search_bar_focus_color: 'Focus accent color',
    search_bar_focus_color_info: 'Border and glow color when the search bar is active',
    scroll_threshold: 'Scroll threshold',
    show_tea_club_button: 'Show Tea Club button',
    tea_club_label: 'Tea Club button label',
    tea_club_link: 'Tea Club link',
    solid_background: 'Solid header background',
    solid_text_color: 'Solid header text',
    transparent_header_background: 'Transparent header background',
    transparent_header_background_info:
      'Shown on the home page when the header is transparent. Use fully transparent or a light tint so text stays readable over the hero.',
    transparent_text_color: 'Transparent header text',
  },
};

function mergeLocale(targetPath) {
  const data = loadJson(targetPath);
  for (const k of NAMES_KEYS) {
    data.names[k] = EN_STRINGS.names[k];
  }
  for (const k of SETTINGS_KEYS) {
    data.settings[k] = EN_STRINGS.settings[k];
  }
  const out = HEADER + JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(targetPath, out, 'utf8');
}

const files = fs.readdirSync(localesDir).filter((f) => f.endsWith('.schema.json') && f !== 'en.default.schema.json');

for (const f of files.sort()) {
  mergeLocale(path.join(localesDir, f));
  console.log('updated', f);
}

console.log('done:', files.length, 'files');
