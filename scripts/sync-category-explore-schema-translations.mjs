/**
 * Merge category-explore section / block schema strings into every non-default locale *.schema.json
 * so Theme Check MatchingTranslations passes. Run after editing locales/en.default.schema.json.
 *
 *   node scripts/sync-category-explore-schema-translations.mjs
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

const STRINGS = {
  names: {
    category_explore: 'Explore categories',
    category_explore_card: 'Category card',
  },
  options: {
    category_explore_grid_compact_1: 'Bottom small (left)',
    category_explore_grid_compact_2: 'Bottom small (center)',
    category_explore_grid_compact_3: 'Bottom small (right)',
    category_explore_grid_featured: 'Large left',
    category_explore_grid_wide: 'Wide top (right)',
    category_explore_label_row_top: 'Top',
    category_explore_label_row_middle: 'Middle',
    category_explore_label_row_bottom: 'Bottom',
  },
  content: {
    category_explore_padding_desktop: 'Section padding (large screens)',
    category_explore_padding_mobile: 'Section padding (small screens)',
    category_explore_section_height: 'Section height',
    category_explore_grid_mobile: 'Mobile and tablet grid',
  },
  settings: {
    category_explore_blocks_info:
      'Add theme blocks (such as headings) before category cards in the block list. Consecutive category cards are placed in the asymmetric grid; theme blocks render in editor order outside the grid.',
    category_explore_card_max_width: 'Max card width',
    category_explore_card_max_width_info:
      'Caps how wide the card is inside its grid cell (centered). Set to 0 for full cell width.',
    category_explore_card_min_height_desktop: 'Min height (large screens)',
    category_explore_card_min_height_info: '0 uses the default height for this grid slot. Set a value to override.',
    category_explore_card_min_height_mobile: 'Min height (small screens)',
    category_explore_card_radius: 'Card corner radius (large screens)',
    category_explore_card_radius_info: 'Used on the desktop grid (990px and up).',
    category_explore_card_radius_mobile: 'Card corner radius (small screens)',
    category_explore_card_radius_mobile_info:
      'Used on the mobile and tablet grid (under 990px).',
    category_explore_grid_gap: 'Grid gap (large screens)',
    category_explore_grid_gap_info:
      'Space between cards on the desktop grid. Mobile and tablet use the settings below.',
    category_explore_grid_gap_horizontal_mobile: 'Horizontal gap between cards',
    category_explore_grid_gap_vertical_mobile: 'Vertical gap between rows',
    category_explore_grid_gap_mobile_info:
      'Applies to the two-column layout on screens under 990px.',
    category_explore_mobile_row_tall_min: 'Top row minimum height',
    category_explore_mobile_row_square_min: 'Middle row minimum height',
    category_explore_mobile_row_wide_min: 'Bottom row minimum height',
    category_explore_mobile_row_min_info:
      'Minimum height for the two side-by-side cards in this row. The row can still grow with viewport width and free space.',
    category_explore_mobile_row_wide_info:
      'Minimum height for the full-width card at the bottom. The row can still grow with viewport width and free space.',
    category_explore_grid_position: 'Grid position',
    category_explore_icon_color: 'Icon color',
    category_explore_icon_color_info: 'Defaults to the label color if not set.',
    category_explore_image_alt: 'Image alt text',
    category_explore_image_alt_info:
      'Describe the main image for screen readers. Falls back to the card title if empty.',
    category_explore_image_hover: 'Hover image',
    category_explore_image_hover_info:
      'Shown on hover (desktop) when a main image is set. Uses a fade transition.',
    category_explore_label_size: 'Label size',
    category_explore_label_size_mobile: 'Label size (small screens)',
    category_explore_label_row_position: 'Label and arrow position',
    category_explore_label_row_position_info:
      'Places the title and arrow row vertically on the card. The title and arrow stay on one line and align with each other.',
    category_explore_label_color: 'Label text color',
    category_explore_overlay_color: 'Overlay',
    category_explore_overlay_color_info: 'Leave blank to use the default dark gradient.',
    category_explore_section_height_desktop: 'Grid height (large screens)',
    category_explore_section_height_desktop_info:
      'Sets the exact grid height on desktop — cards auto-fill the rows proportionally. 0 = automatic.',
    category_explore_section_height_info: '0 = automatic height based on card content.',
    category_explore_section_height_mobile_info: 'Sets a minimum height on mobile. 0 = automatic.',
    category_explore_section_min_height_desktop: 'Min height (large screens)',
    category_explore_section_min_height_mobile: 'Min height (small screens)',
    category_explore_show_overlay: 'Show overlay',
    category_explore_show_arrow_desktop: 'Show arrow (large screens)',
    category_explore_show_arrow_mobile: 'Show arrow (small screens)',
  },
};

function mergeLocale(targetPath) {
  const data = loadJson(targetPath);
  delete data.settings?.category_explore_heading;
  for (const [k, v] of Object.entries(STRINGS.names)) {
    data.names[k] = v;
  }
  for (const [k, v] of Object.entries(STRINGS.options)) {
    data.options[k] = v;
  }
  for (const [k, v] of Object.entries(STRINGS.content)) {
    data.content[k] = v;
  }
  for (const [k, v] of Object.entries(STRINGS.settings)) {
    data.settings[k] = v;
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
