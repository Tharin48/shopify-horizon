/**
 * Merge leaf-story section schema strings into every non-default locale *.schema.json
 * so Theme Check MatchingTranslations passes. Run after editing locales/en.default.schema.json.
 *
 *   node scripts/sync-leaf-story-schema-translations.mjs
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
    leaf_story: 'Leaf story',
  },
  content: {
    leaf_decorations: 'Leaf decorations',
    leaf_icon_row: 'Icon row text',
    leaf_icon_row_layout: 'Icon row blocks (mobile)',
    leaf_vision_text: 'Vision text spacing',
    leaf_vision_heading: 'Vision heading (eyebrow)',
  },
  settings: {
    enable_custom_leaf_background: 'Custom section background',
    icon_row_cell_flex_basis_percent: 'Cell flex basis (mobile)',
    icon_row_cell_layout_mobile_info:
      "Under 750px, these settings control each icon group in the horizontal row and override the block's mobile width.",
    icon_row_cell_max_width_mobile: 'Cell max width (mobile)',
    icon_row_cell_min_width_mobile: 'Cell min width (mobile)',
    icon_row_text_size: 'Icon row text size (desktop)',
    icon_row_text_size_mobile: 'Icon row text size (mobile)',
    leaf_image_bottom_right: 'Bottom-right leaf image',
    leaf_image_top_left: 'Top-left leaf image',
    leaf_mobile_max_width_info:
      'Under 750px, leaf size is the smaller of these two caps (viewport % and pixels). Raise both for a larger corner graphic.',
    leaf_mobile_max_width_px: 'Leaf max width cap (mobile, px)',
    leaf_mobile_max_width_vw: 'Leaf max width cap (mobile, viewport)',
    leaf_opacity: 'Leaf opacity',
    leaf_section_background: 'Background color',
    leaf_section_background_info:
      'Overrides the color scheme background for this section. Foreground, links, and buttons still follow the color scheme above.',
    mobile_vision_text_size: 'Vision text size (mobile)',
    mobile_vision_text_size_info:
      'Applies to Paragraph, Custom, and Default blocks in the vision column except the first block (that one uses Vision heading (eyebrow)). Heading presets H1–H4 use block/theme sizing. Icon row uses Icon row settings.',
    show_leaf_bottom_right: 'Show bottom-right leaf',
    show_leaf_top_left: 'Show top-left leaf',
    vision_text_padding_top: 'Padding above vision text',
    vision_text_padding_bottom: 'Padding below vision text',
    vision_padding_inline_start_mobile: 'Vision text padding left (mobile)',
    vision_padding_inline_end_mobile: 'Vision text padding right (mobile)',
    vision_padding_inline_mobile_info:
      'On screens under 750px, replaces left/right padding from text blocks (e.g. Heading) inside column vision stacks. Does not affect the horizontal icon row.',
    vision_heading_text_size: 'Heading size (desktop)',
    vision_heading_text_size_info:
      'Eyebrow / kicker in the vision column: H5 and H6 blocks, or the first Paragraph/Custom/Default block when it is the first block in that column. Main vision copy should be the next block (e.g. Heading or Paragraph). Does not affect icon row.',
    vision_heading_text_size_mobile: 'Heading size (mobile)',
    vision_heading_text_size_mobile_info: 'Same as desktop, on screens under 750px.',
  },
};

function mergeLocale(targetPath) {
  const data = loadJson(targetPath);
  for (const [k, v] of Object.entries(STRINGS.names)) {
    data.names[k] = v;
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
