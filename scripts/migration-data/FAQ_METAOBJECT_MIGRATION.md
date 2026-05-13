# FAQ Metaobject Migration Guide

This guide explains how to migrate the temporary FAQ seed JSON into Shopify metaobjects for the `custom-faq-accordion` section.

Seed file:

- [dilmah-policy-faq.seed.json](/Users/tharingunawardhana/Documents/GitHub/shopify-horizon/scripts/migration-data/dilmah-policy-faq.seed.json)

The storefront section does **not** read this JSON directly. The live frontend reads:

- `page.metafields.custom.faq_items`

That page metafield must be a **list of metaobject references** pointing to the `FAQ Item` metaobject entries.

## 1. Create the `FAQ Item` metaobject definition

In Shopify admin:

1. Go to `Settings > Metafields and metaobjects > Metaobjects`.
2. Click `Add definition`.
3. Create a definition named `FAQ Item`.
4. Add these fields:

| Field name | Handle | Recommended type | Notes |
| --- | --- | --- | --- |
| Question | `question` | Single line text | Use this as the main question/title. |
| Answer | `answer` | Rich text | This is rendered in the accordion body. |
| Category | `category` | Single line text | Keep category labels consistent. |
| Sort order | `sort_order` | Integer | Lower numbers appear first. |
| Enabled | `enabled` | True or false | Use `true` for items that should display. |

Recommended setup:

- Set `Question` as the display name / label field if Shopify prompts for one.
- Enable storefront access for the definition so the theme can read the entries.

Suggested category values from the current seed file:

- `Finding Products`
- `Account & Website Help`
- `Shipping & Orders`
- `Payments`
- `Order Issues`
- `Gifts & Customisation`
- `Bulk Orders`
- `Tea Knowledge`

## 2. Create FAQ entries from the seed JSON

Use the JSON file as the source of truth and create one metaobject entry per item.

For each object in `dilmah-policy-faq.seed.json`:

- `category` -> `Category`
- `question` -> `Question`
- `answer` -> `Answer`
- `sort_order` -> assign manually during entry creation
- `enabled` -> set to `true` unless you intentionally want to hide the item

Recommended sort order pattern:

- Start at `10`
- Increment by `10`

Example:

| Question | Sort order | Enabled |
| --- | --- | --- |
| I can’t find the tea I’m looking for. What should I do? | `10` | `true` |
| Can I buy Dilmah tea locally in my country? | `20` | `true` |
| Why should I create an account with Dilmah? | `30` | `true` |

Using gaps like `10, 20, 30` makes future inserts easier without renumbering everything.

## 3. Create the page metafield reference

The FAQ section expects a page metafield with this exact definition:

- Namespace: `custom`
- Key: `faq_items`
- Type: `List of metaobject references`
- Reference type: `FAQ Item`

In Shopify admin:

1. Go to `Settings > Metafields and metaobjects`.
2. Open `Pages`.
3. Click `Add definition`.
4. Enter:
   - Name: `FAQ items`
   - Namespace and key: `custom.faq_items`
   - Type: `Metaobject reference`
5. Change it to a **list** type.
6. Select the `FAQ Item` definition as the referenced metaobject.
7. Save.

## 4. Connect selected FAQ items to a page

After the page metafield exists and the FAQ Item entries are created:

1. Go to `Online Store > Pages`.
2. Open the page that uses the `page.policy-faq` template, such as the FAQ page.
3. In the page metafields area, find `FAQ items`.
4. Select the specific `FAQ Item` entries you want on that page.
5. Save the page.

How this works in the theme:

- The section reads `page.metafields.custom.faq_items.value`.
- Only the entries selected on that page are rendered.
- Categories are derived from each selected entry’s `category` field.
- Display order is controlled by each entry’s `sort_order`.
- Items can be hidden without deleting them by setting `enabled` to `false`.

## 5. Recommended migration workflow

1. Create the `FAQ Item` metaobject definition.
2. Create all FAQ Item entries from the seed JSON.
3. Create the page metafield definition `custom.faq_items`.
4. Attach the desired FAQ entries to the FAQ page.
5. Open the theme editor and confirm:
   - category pills look correct
   - items appear in the expected order
   - disabled items do not render

## 6. Notes for future automation

If you later want to automate migration instead of entering items manually, the JSON file can be mapped directly to:

- `question`
- `answer`
- `category`
- `sort_order`
- `enabled`

The only extra decision needed is the numeric `sort_order` sequence for each entry.

## References

- Shopify Help: Creating entries
  https://help.shopify.com/en/manual/custom-data/metaobjects/creating-entries
- Shopify Help: Referencing metaobjects
  https://help.shopify.com/en/manual/custom-data/metaobjects/referencing-metaobjects
- Shopify Help: Connecting and displaying metaobjects
  https://help.shopify.com/en/manual/custom-data/metaobjects/connecting-to-your-online-store/connecting-metaobjects
