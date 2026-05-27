# Shopify Horizon Demo Theme — GitHub & Development Guidelines

This document explains how to set up, manage, develop, review, and deploy the Shopify Horizon demo theme safely using GitHub.

The main goal is to keep the theme **update-safe**, **reviewable**, and **easy to maintain**, while still allowing custom Dilmah UI/UX development.

---

## 1. Project Purpose

This repository is used to manage the custom Shopify Horizon demo theme development.

The theme is based on Shopify Horizon and will include custom UI/UX improvements such as:

- Custom homepage sections
- Custom header and navigation behaviour
- Custom footer sections
- Product card improvements
- Collection/catalog page improvements
- Editorial product page sections
- Search and filter UI improvements
- Campaign-specific landing sections
- Performance improvements
- Theme editor friendly reusable sections and blocks

The theme should not be treated as random code edits. It should be managed as:

> Horizon base theme + custom Dilmah modules

---

## 2. Core Development Principles

### 2.1 Keep Horizon update-safe

Where possible, avoid directly modifying Horizon core files unless absolutely required.

Preferred approach:

- Create new custom sections
- Create new custom snippets
- Create new custom assets
- Create new custom templates
- Extend existing Horizon functionality carefully
- Keep custom files clearly named

Avoid:

- Random edits across many Horizon core files
- Hardcoded one-off layouts
- Removing Horizon-native functionality without review
- Editing checkout-related files from the theme

---

### 2.2 Use modular custom development

All custom development should be built as reusable, editor-friendly modules.

Recommended naming pattern:

```txt
sections/custom-*.liquid
snippets/custom-*.liquid
assets/custom-*.css
assets/custom-*.js
blocks/custom-*.liquid
templates/page.custom-*.json
templates/product.custom-*.json
templates/collection.custom-*.json
```

Examples:

```txt
sections/custom-hero.liquid
sections/custom-editorial-product-story.liquid
snippets/custom-product-card.liquid
assets/custom-header.js
assets/custom-theme.css
templates/product.custom-editorial.json
```

---

### 2.3 Do not hardcode content unnecessarily

Use Shopify Theme Editor settings where possible.

Content should be controlled through:

- Section schema settings
- Blocks
- Product metafields
- Collection metafields
- Metaobjects
- Dynamic sources
- Shopify Search & Discovery filters

Avoid hardcoding:

- Text content
- Product handles
- Collection handles
- Image URLs
- Static campaign copy
- Navigation links

Hardcoding is allowed only for temporary demos and must be clearly commented.

---

## 3. Repository Setup

### 3.1 Clone the repository

```bash
git clone <repository-url>
cd <repository-name>
```

### 3.2 Install Shopify CLI

```bash
npm install -g @shopify/cli @shopify/theme
```

Check the installed version:

```bash
shopify version
```

### 3.3 Login to Shopify

```bash
shopify auth login
```

Use the correct Shopify store account with theme access.

---

## 4. Shopify Store Environments

Use the correct store environment before development or deployment.

Example `shopify.theme.toml`:

```toml
[environments.global]
store = "dilmah-global.myshopify.com"

[environments.srilanka]
store = "dilmahtea-srilanka.myshopify.com"

[environments.nz]
store = "dilmah-nz.myshopify.com"
theme = "154145030282"
```

Use the correct environment when running theme commands.

Example:

```bash
shopify theme dev --environment nz
```

or

```bash
shopify theme push --environment nz
```

---

## 5. Branching Strategy

Use a simple and safe branch structure.

### 5.1 Main branches

```txt
main        = production-ready branch
staging     = preview / QA branch
develop     = active development integration branch
```

Recommended flow:

```txt
feature branch → develop → staging → main
```

---

### 5.2 Feature branches

Create a new branch for every new task.

Branch naming format:

```txt
feature/<ticket-or-task-name>
fix/<ticket-or-task-name>
chore/<ticket-or-task-name>
hotfix/<ticket-or-task-name>
```

Examples:

```txt
feature/custom-home-hero
feature/editorial-product-page
feature/custom-footer-blocks
fix/header-mobile-menu
fix/lcp-hero-video
chore/update-theme-settings
hotfix/cart-drawer-freeze
```

---

## 6. Development Workflow

### 6.1 Always start from the latest develop branch

```bash
git checkout develop
git pull origin develop
```

Create a new feature branch:

```bash
git checkout -b feature/custom-home-hero
```

---

### 6.2 Start local Shopify development theme

```bash
shopify theme dev --environment nz
```

This creates a temporary development theme and gives a preview link.

Use this for active development. Do not directly work on the live theme.

---

### 6.3 Development rules

Before coding:

1. Check if Horizon already has similar functionality.
2. Check if the same component exists elsewhere in the repo.
3. Reuse existing snippets, blocks, and styles where possible.
4. Keep custom files modular.
5. Add Theme Editor schema settings for content control.
6. Test desktop, tablet, and mobile.
7. Test inside the Shopify Theme Editor.
8. Check performance impact.

---

## 7. File Naming Rules

### 7.1 Custom sections

```txt
sections/custom-[feature-name].liquid
```

Examples:

```txt
sections/custom-home-hero.liquid
sections/custom-tea-story.liquid
sections/custom-impact-bar.liquid
```

---

### 7.2 Custom snippets

```txt
snippets/custom-[component-name].liquid
```

Examples:

```txt
snippets/custom-product-card.liquid
snippets/custom-icon-text.liquid
snippets/custom-filter-pill.liquid
```

---

### 7.3 Custom assets

```txt
assets/custom-[feature-name].css
assets/custom-[feature-name].js
```

Examples:

```txt
assets/custom-header.css
assets/custom-header.js
assets/custom-product-card.css
```

---

### 7.4 Templates

```txt
templates/page.custom-[page-name].json
templates/product.custom-[template-name].json
templates/collection.custom-[template-name].json
```

Examples:

```txt
templates/page.custom-shipping-delivery.json
templates/product.custom-editorial.json
templates/collection.custom-tea-range.json
```

---

## 8. Theme Editor Compatibility Rules

Shopify Theme Editor can reload sections without a full page refresh. Because of this, custom JavaScript must be written carefully.

For every custom JS feature:

- Initialize on normal page load
- Re-initialize on Shopify section load
- Avoid duplicate event listeners
- Avoid global DOM mutations that break when sections reload

Recommended pattern:

```js
function initCustomSection(container = document) {
  const sections = container.querySelectorAll('[data-custom-section]')

  sections.forEach((section) => {
    if (section.dataset.initialized === 'true') return

    section.dataset.initialized = 'true'

    // Add feature logic here
  })
}

document.addEventListener('DOMContentLoaded', () => {
  initCustomSection()
})

document.addEventListener('shopify:section:load', (event) => {
  initCustomSection(event.target)
})
```

---

## 9. Git Commit Guidelines

Use clear commit messages.

Recommended format:

```txt
[type]: short description
```

Types:

```txt
feat     = new feature
fix      = bug fix
chore    = setup/config/update task
refactor = code restructure without behaviour change
style    = styling-only change
perf     = performance improvement
docs     = documentation
```

Examples:

```txt
feat: add custom homepage hero section
fix: resolve mobile header drawer overlap
perf: reduce hero poster image size
docs: add Shopify deployment guidelines
chore: update shopify theme config
```

---

## 10. Pull Request Process

Every feature must be reviewed through a pull request.

### 10.1 PR title format

```txt
[Shopify] Short task name
```

Example:

```txt
[Shopify] Add custom editorial product template
```

---

### 10.2 PR description template

```md
## Summary

Explain what changed.

## Why this change is needed

Explain the business/design/development reason.

## Files changed

- `sections/...`
- `snippets/...`
- `assets/...`
- `templates/...`

## Testing done

- [ ] Tested desktop
- [ ] Tested mobile
- [ ] Tested Shopify Theme Editor
- [ ] Tested add to cart / cart drawer if affected
- [ ] Tested search/filter if affected
- [ ] Checked console errors
- [ ] Checked Lighthouse/PageSpeed if performance-related

## Screenshots / Preview

Add preview link and screenshots.

## Risk level

Low / Medium / High

## Notes

Mention anything the reviewer should know.
```

---

## 11. Review Checklist

Before merging, check:

- Code is modular
- No unnecessary edits to Horizon core files
- Theme Editor settings work
- Mobile layout works
- No console errors
- No broken Shopify schema
- No unused assets
- No duplicate JavaScript listeners
- No hardcoded content unless approved
- Product/cart/search functionality still works
- Performance impact is acceptable

---

## 12. Deployment Process

### 12.1 Development deployment

Use:

```bash
shopify theme dev --environment nz
```

Purpose:

- Local testing
- Feature development
- Temporary preview
- Hot reload development

Do not use this for final client/stakeholder QA because development themes are temporary.

---

### 12.2 Staging / preview deployment

Push the branch to an unpublished Shopify theme for QA.

```bash
shopify theme push --environment nz --theme <staging-theme-id>
```

Use this for:

- Internal QA
- Marketing review
- Design review
- Stakeholder preview
- Regression testing

Do not publish directly from local development.

---

### 12.3 Production deployment

Only deploy to production after:

1. PR is approved
2. Staging preview is tested
3. Theme Editor is tested
4. Critical pages are checked
5. Backup is created
6. Deployment time is agreed

Recommended production command:

```bash
shopify theme push --environment nz --theme <production-theme-id>
```

Use `--allow-live` only when intentionally deploying to the live theme:

```bash
shopify theme push --environment nz --theme <production-theme-id> --allow-live
```

---

## 13. Deployment Safety Rules

Before production deployment:

- Pull latest production theme backup
- Confirm current live theme ID
- Confirm store environment
- Confirm branch is correct
- Confirm there are no unwanted local files
- Confirm theme check passes
- Confirm no unfinished demo code is included

Recommended safety commands:

```bash
git status
git branch
shopify theme list --environment nz
```

Run theme check:

```bash
shopify theme check
```

---

## 14. Backup Process

Before changing the live theme, create a backup.

Option 1: Duplicate theme from Shopify Admin.

Shopify Admin:

```txt
Online Store → Themes → Current Theme → Actions → Duplicate
```

Rename backup:

```txt
Backup - Before <Feature Name> - YYYY-MM-DD
```

Example:

```txt
Backup - Before Custom Header Deployment - 2026-05-27
```

Option 2: Pull live theme locally:

```bash
shopify theme pull --environment nz --theme <production-theme-id>
```

Commit the backup state if needed.

---

## 15. Hotfix Process

Use hotfix only for urgent production issues.

```bash
git checkout main
git pull origin main
git checkout -b hotfix/cart-drawer-freeze
```

Fix the issue, test it, then merge:

```txt
hotfix branch → staging → main
```

After hotfix deployment, merge the fix back into develop:

```bash
git checkout develop
git pull origin develop
git merge main
git push origin develop
```

---

## 16. Handling Shopify Theme Editor Changes

If someone changes content or settings directly in Shopify Theme Editor, those changes can create differences from GitHub.

To avoid losing changes:

1. Pull the latest theme before starting work.
2. Review changed JSON template/settings files.
3. Commit valid Theme Editor changes.
4. Do not overwrite live theme settings without checking.

Pull theme:

```bash
shopify theme pull --environment nz --theme <theme-id>
```

Check changed files:

```bash
git status
git diff
```

Commit valid changes:

```bash
git add .
git commit -m "chore: sync theme editor changes"
git push origin develop
```

---

## 17. Custom Development Standards

### 17.1 Sections

Every custom section should include:

- Clear section name
- Theme Editor schema
- Mobile settings where needed
- Image controls where needed
- Text controls where needed
- Block support where useful
- Safe default values

---

### 17.2 CSS

CSS should be:

- Scoped to the custom section/component
- Mobile responsive
- Not globally destructive
- Not overriding Horizon styles unnecessarily

Use section-specific classes:

```css
.custom-home-hero {
  /* styles */
}

.custom-home-hero__content {
  /* styles */
}
```

Avoid broad selectors:

```css
div {
}

button {
}

h1 {
}
```

---

### 17.3 JavaScript

JS should be:

- Optional enhancement, not required for core content
- Safe in Theme Editor
- Not duplicated on section reload
- Scoped using data attributes

Use data attributes:

```html
<div data-custom-slider>
```

---

### 17.4 Liquid

Liquid should be:

- Easy to read
- Commented where logic is complex
- Safe with empty values
- Compatible with Theme Editor dynamic sources

Example:

```liquid
{% if section.settings.heading != blank %}
  <h2>{{ section.settings.heading }}</h2>
{% endif %}
```

---

## 18. Performance Guidelines

Every development task should consider performance.

Check:

- Hero image size
- Video size
- Lazy loading
- Unused JS
- Unused CSS
- Third-party apps
- Yotpo/reviews impact
- GTM scripts
- LCP element
- CLS issues
- INP issues

For hero media:

- Use optimized poster images
- Avoid oversized background images
- Avoid loading heavy video before key content
- Prefer image-first, video-after-load approach where suitable

---

## 19. App vs Theme Decision

Use theme code for:

- Storefront UI
- Sections
- Blocks
- Product page layouts
- Collection page layouts
- Blog/article layouts
- Theme Editor content

Use a custom app or app extension for:

- Backend data storage
- Customer preference saving
- Checkout extensions
- Webhooks
- Admin workflows
- External API integrations
- Secure database operations

Do not force backend features into the Shopify theme.

---

## 20. Storefront Filtering Rules

For product filtering:

Preferred:

- Shopify Search & Discovery
- Product metafields
- Metaobject references
- Native storefront filter objects

Avoid:

- Tag-only filtering for complex product attributes
- Hardcoded filter options
- Custom filter logic that ignores Shopify filter state

Example filter data:

- Tea Type
- Tea Format
- Flavor
- Time of Day
- Wellness Benefit
- Product Range

---

## 21. Suggested Folder Ownership

```txt
sections/     = page-level and reusable custom sections
snippets/     = reusable Liquid components
assets/       = CSS, JS, images, icons
templates/    = Shopify JSON templates
blocks/       = reusable Horizon theme blocks
config/       = theme settings
locales/      = translation files
layout/       = global layout files
```

---

## 22. Common Commands

### Start development

```bash
shopify theme dev --environment nz
```

### List themes

```bash
shopify theme list --environment nz
```

### Pull theme

```bash
shopify theme pull --environment nz --theme <theme-id>
```

### Push theme

```bash
shopify theme push --environment nz --theme <theme-id>
```

### Push to live theme intentionally

```bash
shopify theme push --environment nz --theme <theme-id> --allow-live
```

### Run theme check

```bash
shopify theme check
```

---

## 23. Recommended Workflow Summary

```txt
1. Pull latest develop
2. Create feature branch
3. Run Shopify theme dev
4. Build custom section/snippet/template
5. Test locally
6. Test in Theme Editor
7. Commit changes
8. Push branch
9. Open PR into develop
10. Review and merge
11. Deploy develop to staging theme
12. QA staging preview
13. Merge staging into main
14. Backup live theme
15. Deploy main to production theme
16. Verify live site
```

---

## 24. Important Warnings

Do not:

- Deploy directly to live without backup
- Work directly on main branch
- Push unfinished files to live theme
- Edit checkout from theme
- Remove Horizon native functionality without checking
- Add third-party scripts without performance review
- Hardcode campaign content that marketing needs to edit
- Modify multiple core files without documenting why

---

## 25. Final Development Rule

Every Shopify theme change should be:

```txt
Reusable
Theme-editor friendly
Mobile responsive
Performance-aware
Reviewable in GitHub
Safe to deploy
Easy to rollback
```

If a change does not meet these conditions, it should be reworked before deployment.
