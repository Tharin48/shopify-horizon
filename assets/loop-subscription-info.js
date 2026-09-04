/**
 * Loop Subscription benefits info icon + modal
 *
 * Extends the Loop Subscriptions widget (app block) via theme JS/CSS only.
 * Waits for the async Loop widget, injects an info icon after the subscribe
 * label, and opens an accessible modal with subscription benefits.
 */
;(function () {
  'use strict'

  /** @type {Window & { DilmahLoopInfo?: object }} */
  const globalWindow = window

  if (globalWindow.DilmahLoopInfo?.__bootstrapped) {
    globalWindow.DilmahLoopInfo.refreshFromSettings()
    return
  }

  const INJECTED_ATTR = 'data-dilmah-loop-info-injected'
  const LAYOUT_ATTR = 'data-dilmah-loop-layout-enhanced'
  const CHECKLIST_ATTR = 'data-dilmah-loop-checklist-injected'
  const DISCOUNT_BADGE_ATTR = 'data-dilmah-loop-discount-badge'
  const CUSTOM_DISCOUNT_BADGE_SELECTOR =
    `[${DISCOUNT_BADGE_ATTR}="custom"]`
  const SETTINGS_ID = 'DilmahLoopInfoSettings'
  const VALID_BENEFIT_ICONS = ['calendar', 'bell', 'pencil']

  /** @type {{ enabled: boolean, title: string, closeLabel: string, buttonText: string, benefits: Array<{ icon: string, title: string, descriptionHtml: string }> }} */
  const DEFAULT_SETTINGS = {
    enabled: true,
    title: 'Great reasons to subscribe',
    closeLabel: 'Close subscription benefits popup',
    buttonText: 'Got it',
    benefits: [
      {
        icon: 'calendar',
        title: 'Flexible frequency',
        descriptionHtml:
          '<p>Not sure how much of something you need, or how often? Adjust quantities and frequencies anytime.</p>',
      },
      {
        icon: 'bell',
        title: 'Order reminders',
        descriptionHtml:
          "<p>We'll let you know before each shipment. Delay, reschedule or cancel if needed — we'll only bill you when your order ships.</p>",
      },
      {
        icon: 'pencil',
        title: "You're in control",
        descriptionHtml:
          '<p>Add or remove subscriptions, cancel orders, edit frequencies and quantities through our customer-friendly portal.</p>',
      },
    ],
  }

  /**
   * Loop widget DOM selectors (detected from Loop's RADIO_GROUP / BUTTON_GROUP layouts).
   * The widget container is rendered asynchronously by the Loop app.
   */
  const SELECTORS = {
    /** Loop app block root containers, e.g. #loop-widget-container-id-{productId} */
    widgetContainer: '[id^="loop-widget-container-id-"]',
    /** Subscribe purchase option rows (excludes one-time purchase; RADIO_GROUP + BUTTON_GROUP) */
    subscribeOption:
      '.loop-widget-purchase-option:not(.loop-widget-purchase-option-onetime), [id^="loop-widget-purchase-option-id-"], .loop-w-btn-group-purchase-option:not(.loop-w-btn-group-purchase-option-onetime)',
    /** Subscribe label text, e.g. "Subscribe & Save 10%" */
    subscribeLabel:
      '.loop-widget-purchase-option-label, .loop-w-btn-group-purchase-option-label',
    /** Injected info trigger button */
    infoTrigger: '.dilmah-loop-info__trigger',
  }

  const FOCUSABLE_SELECTOR = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ')

  /** @type {MutationObserver | null} */
  let widgetObserver = null

  /** @type {number} */
  let scanTimer = 0

  /** @type {boolean} */
  let modalBuilt = false

  /** @type {boolean} */
  let modalOpen = false

  /** @type {HTMLElement | null} */
  let overlayElement = null

  /** @type {HTMLElement | null} */
  let dialogElement = null

  /** @type {HTMLElement | null} */
  let lastTriggerElement = null

  /** @type {{ htmlOverflow: string, bodyOverflow: string, bodyPaddingRight: string } | null} */
  let scrollState = null

  /**
   * @param {unknown} value
   * @returns {value is Record<string, unknown>}
   */
  function isObject(value) {
    return typeof value === 'object' && value !== null
  }

  /**
   * @param {unknown} raw
   * @returns {{ enabled: boolean, title: string, closeLabel: string, buttonText: string, benefits: Array<{ icon: string, title: string, descriptionHtml: string }> }}
   */
  function normalizeSettings(raw) {
    const source = isObject(raw) ? raw : {}
    const rawBenefits = Array.isArray(source.benefits)
      ? source.benefits
      : DEFAULT_SETTINGS.benefits

    /** @type {Array<{ icon: string, title: string, descriptionHtml: string }>} */
    const benefits = []

    for (let index = 0; index < 3; index += 1) {
      const fallback =
        DEFAULT_SETTINGS.benefits[index] || DEFAULT_SETTINGS.benefits[0]
      const entry = isObject(rawBenefits[index]) ? rawBenefits[index] : {}
      const icon = VALID_BENEFIT_ICONS.includes(String(entry.icon))
        ? String(entry.icon)
        : fallback.icon

      benefits.push({
        icon,
        title: String(entry.title || fallback.title),
        descriptionHtml: String(
          entry.descriptionHtml || fallback.descriptionHtml,
        ),
      })
    }

    return {
      enabled: source.enabled !== false,
      title: String(source.title || DEFAULT_SETTINGS.title),
      closeLabel: String(source.closeLabel || DEFAULT_SETTINGS.closeLabel),
      buttonText: String(source.buttonText || DEFAULT_SETTINGS.buttonText),
      benefits,
    }
  }

  /**
   * Reads popup settings from `#DilmahLoopInfoSettings` with safe fallbacks.
   */
  function getSettings() {
    const settingsElement = document.getElementById(SETTINGS_ID)
    if (!(settingsElement instanceof HTMLElement)) {
      return normalizeSettings(DEFAULT_SETTINGS)
    }

    try {
      return normalizeSettings(JSON.parse(settingsElement.textContent || '{}'))
    } catch (error) {
      return normalizeSettings(DEFAULT_SETTINGS)
    }
  }

  /**
   * Inline SVG icons (no external libraries).
   * @param {'info' | 'calendar' | 'bell' | 'pencil' | 'check'} name
   * @returns {string}
   */
  function getIconMarkup(name) {
    const icons = {
      info: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" stroke-width="1.5"></circle><rect x="9.25" y="8.5" width="1.5" height="5.5" rx="0.75" fill="currentColor"></rect><circle cx="10" cy="6.25" r="1" fill="currentColor"></circle></svg>',
      calendar:
        '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="14" height="13" rx="2"></rect><path d="M6.5 3v3M13.5 3v3M3 8.5h14"></path><path d="M7.5 11.5h2M7.5 14h2M10.5 11.5h2M10.5 14h2"></path></svg>',
      bell: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.25 16.5a1.75 1.75 0 0 0 3.5 0"></path><path d="M4.75 14.5h10.5l-1.1-1.35a2.25 2.25 0 0 1-.65-1.58V9.25a4.25 4.25 0 0 0-8.5 0v2.32c0 .59-.23 1.16-.65 1.58L4.75 14.5z"></path></svg>',
      pencil:
        '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12.1 4.9l3 3-7.35 7.35-3.75.75.75-3.75L12.1 4.9z"></path><path d="M11 6l3 3"></path></svg>',
      check:
        '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="10" fill="currentColor"></circle><path d="M6 10.25l2.25 2.25L14 7.5" fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
    }

    return icons[name] || ''
  }

  /**
   * Returns true when a Loop widget container has finished rendering purchase options.
   * @param {HTMLElement} container
   */
  function isLoopWidgetReady(container) {
    if (container.classList.contains('loop-display-none')) {
      return false
    }

    if (container.querySelector('.loop-widget-skeleton-container')) {
      return false
    }

    return Boolean(
      container.querySelector(
        '.loop-widget-purchase-option, .loop-w-btn-group-purchase-option, [id^="loop-widget-purchase-option-id-"]',
      ),
    )
  }

  /**
   * Finds the subscribe label element inside a Loop purchase option row.
   * @param {HTMLElement} option
   * @returns {HTMLElement | null}
   */
  function findSubscribeLabel(option) {
    const label = option.querySelector(SELECTORS.subscribeLabel)
    if (label instanceof HTMLElement) {
      return label
    }

    /** Fallback: first text label sibling after the radio icon */
    const radio = option.querySelector(
      '.loop-widget-purchase-option-radio, .loop-widget-radio-svg',
    )
    if (radio?.nextElementSibling instanceof HTMLElement) {
      return radio.nextElementSibling
    }

    return null
  }

  /**
   * Creates the 16px info icon button placed after the subscribe label text.
   * @returns {HTMLButtonElement}
   */
  function createInfoTrigger() {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'dilmah-loop-info__trigger'
    button.setAttribute('aria-label', 'Subscription benefits')
    button.innerHTML = getIconMarkup('info')

    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      openModal(button)
    })

    button.addEventListener('keydown', (event) => {
      event.stopPropagation()
    })

    return button
  }

  /**
   * Removes the injected info icon from a subscribe option.
   * @param {HTMLElement} option
   */
  function removeInfoIconFromOption(option) {
    option.querySelector(SELECTORS.infoTrigger)?.remove()

    const wrap = option.querySelector('.dilmah-loop-info__label-wrap')
    const label = wrap?.querySelector(SELECTORS.subscribeLabel)

    if (
      wrap instanceof HTMLElement &&
      label instanceof HTMLElement &&
      wrap.parentNode
    ) {
      wrap.parentNode.insertBefore(label, wrap)
      wrap.remove()
    }

    option.removeAttribute(INJECTED_ATTR)
  }

  /**
   * Injects the info icon immediately after the Loop subscribe label text.
   * Skips options that already contain an injected trigger.
   * @param {HTMLElement} option
   */
  function injectInfoIcon(option) {
    const settings = getSettings()

    if (!settings.enabled) {
      removeInfoIconFromOption(option)
      return
    }

    if (option.querySelector(SELECTORS.infoTrigger)) {
      option.setAttribute(INJECTED_ATTR, 'true')
      return
    }

    if (option.getAttribute(INJECTED_ATTR) === 'true') {
      option.removeAttribute(INJECTED_ATTR)
    }

    const label = findSubscribeLabel(option)
    if (!label) {
      return
    }

    /** Wrap label + icon so the (i) sits inline after "Subscribe & Save 10%" */
    let wrap = label.parentElement
    if (
      !(wrap instanceof HTMLElement) ||
      !wrap.classList.contains('dilmah-loop-info__label-wrap')
    ) {
      wrap = document.createElement('span')
      wrap.className = 'dilmah-loop-info__label-wrap'
      label.parentNode?.insertBefore(wrap, label)
      wrap.appendChild(label)
    }

    if (wrap.querySelector(SELECTORS.infoTrigger)) {
      option.setAttribute(INJECTED_ATTR, 'true')
      return
    }

    wrap.appendChild(createInfoTrigger())
    option.setAttribute(INJECTED_ATTR, 'true')
  }

  /**
   * @param {HTMLElement} option
   * @returns {HTMLElement | null}
   */
  function findPriceBlock(option) {
    const priceEl = option.querySelector(
      '[id^="loop-widget-purchase-option-price-id-"]',
    )
    if (!(priceEl instanceof HTMLElement)) {
      return null
    }

    let block = priceEl.parentElement
    if (block?.parentElement && block.parentElement !== option) {
      const grandParent = block.parentElement
      if (
        grandParent instanceof HTMLElement &&
        grandParent.contains(priceEl) &&
        !grandParent.querySelector('.loop-widget-spg-container')
      ) {
        block = grandParent
      }
    }

    return block instanceof HTMLElement ? block : null
  }

  /**
   * @param {HTMLElement} option
   */
  function getSavePercentText(option) {
    const badge = option.querySelector(
      '[id^="loop-widget-purchase-option-discount-badge-id-"]',
    )
    const badgeText = badge?.textContent?.trim() || ''
    const badgeMatch = badgeText.match(/(\d+\s*%)/)
    if (badgeMatch) {
      return `Save ${badgeMatch[1].replace(/\s+/g, '')}`
    }

    const labelText = findSubscribeLabel(option)?.textContent || ''
    const labelMatch = labelText.match(/save\s*(\d+\s*%)/i)
  }

  /**
   * @param {HTMLElement} container
   * @returns {string | null}
   */
  function getProductIdFromContainer(container) {
    const match = container.id.match(/^loop-widget-container-id-(\d+)$/)
    return match ? match[1] : null
  }

  /**
   * Calculates the selected variant's genuine subscription discount summary.
   * All allocations are compared with the normal variant price, never with a
   * compare-at price that may represent a separate product promotion.
   * @param {string | null} productId
   * @returns {{ text: string, maximum: number, allSame: boolean } | null}
   */
  function getSubscriptionDiscountSummary(productId) {
    if (!productId) {
      return null
    }

    const widget = globalWindow.LOOP_WIDGET?.[productId]
    const product = widget?.product
    if (!product || !Array.isArray(product.variants)) {
      return null
    }

    const variantId =
      widget.selectedVariantId ||
      product.selected_or_first_available_variant?.id ||
      product.variants[0]?.id
    const variant = product.variants.find(
      (entry) => String(entry.id) === String(variantId),
    )
    const variantPrice = Number(variant?.price)
    const sellingPlans = Array.isArray(product.selling_plan_groups)
      ? product.selling_plan_groups.flatMap((group) =>
          Array.isArray(group?.selling_plans) ? group.selling_plans : [],
        )
      : []

    if (
      !variant ||
      !Number.isFinite(variantPrice) ||
      variantPrice <= 0 ||
      !Array.isArray(variant.selling_plan_allocations)
    ) {
      return null
    }

    const discounts = variant.selling_plan_allocations
      .map((allocation) => {
        const allocationPrice = Number(allocation?.price)
        if (
          !Number.isFinite(allocationPrice) ||
          allocationPrice <= 0 ||
          allocationPrice >= variantPrice
        ) {
          return null
        }

        const percent =
          ((variantPrice - allocationPrice) / variantPrice) * 100
        const roundedPercent =
          Math.round((percent + Number.EPSILON) * 100) / 100
        const sellingPlan = sellingPlans.find(
          (plan) =>
            String(plan?.id) === String(allocation?.selling_plan_id),
        )
        const adjustment = sellingPlan?.price_adjustments?.[0]
        const configuredPercent =
          adjustment?.value_type === 'percentage'
            ? Number(adjustment.value)
            : null

        if (
          Number.isFinite(configuredPercent) &&
          configuredPercent > 0 &&
          configuredPercent < 100
        ) {
          const configuredAllocationPrice =
            variantPrice * (1 - configuredPercent / 100)

          // Shopify rounds allocation prices to the currency's minor unit.
          // Prefer Loop's configured percentage only when that rounding fully
          // explains the difference from the storefront allocation price.
          if (
            Math.abs(allocationPrice - configuredAllocationPrice) <= 1
          ) {
            return Math.round(
              (configuredPercent + Number.EPSILON) * 100,
            ) / 100
          }
        }

        return roundedPercent
      })
      .filter((percent) => percent !== null && percent > 0)

    if (discounts.length === 0) {
      return null
    }

    const maximum = Math.max(...discounts)
    const allSame = discounts.every((percent) => percent === discounts[0])
    const formattedMaximum = String(Number(maximum.toFixed(2)))

    return {
      text: `${allSame ? 'Save' : 'Up to'} ${formattedMaximum}%`,
      maximum,
      allSame,
    }
  }

  /**
   * Finds or creates the single badge managed by this theme customization.
   * This badge is deliberately separate from Loop's native badge. Loop updates
   * its badge whenever the selected selling plan changes; writing the aggregate
   * "Up to" value into that same node causes a visible second render.
   * @param {HTMLElement} option
   * @returns {HTMLElement | null}
   */
  function getDiscountBadge(option) {
    const existingCustomBadge = option.querySelector(
      CUSTOM_DISCOUNT_BADGE_SELECTOR,
    )
    if (existingCustomBadge instanceof HTMLElement) {
      return existingCustomBadge
    }

    const labelTarget =
      option.querySelector('.dilmah-loop-info__label-wrap') ||
      findSubscribeLabel(option)
    if (!(labelTarget instanceof HTMLElement) || !labelTarget.parentNode) {
      return null
    }

    const badge = document.createElement('span')
    badge.className =
      'dilmah-loop-info__discount-badge loop-widget-purchase-option-discount-badge'
    badge.setAttribute(DISCOUNT_BADGE_ATTR, 'custom')
    labelTarget.insertAdjacentElement('afterend', badge)
    return badge
  }

  /**
   * Updates only the informational discount badge. It does not touch selling
   * plan labels, price nodes, radios, selects, or form values.
   * @param {HTMLElement} option
   * @param {string | null} productId
   */
  function updateSubscriptionDiscountBadge(option, productId) {
    const summary = getSubscriptionDiscountSummary(productId)
    const customBadge = option.querySelector(CUSTOM_DISCOUNT_BADGE_SELECTOR)

    if (!summary) {
      if (customBadge instanceof HTMLElement && !customBadge.hidden) {
        customBadge.hidden = true
      }
      return
    }

    const badge = getDiscountBadge(option)
    if (!badge) {
      return
    }

    if (badge.textContent?.trim() !== summary.text) {
      badge.textContent = summary.text
    }
    if (badge.hidden) {
      badge.hidden = false
    }
  }

  /**
   * Places the benefits info trigger immediately after the discount badge.
   * @param {HTMLElement} option
   */
  function positionInfoTriggerAfterDiscountBadge(option) {
    const badge = option.querySelector(CUSTOM_DISCOUNT_BADGE_SELECTOR)
    const trigger = option.querySelector(SELECTORS.infoTrigger)

    if (
      badge instanceof HTMLElement &&
      trigger instanceof HTMLElement &&
      badge.nextElementSibling !== trigger
    ) {
      badge.insertAdjacentElement('afterend', trigger)
    }
  }

  /**
   * @param {string | null} productId
   * @param {string} sellingPlanId
   * @returns {string | null}
   */
  function getSellingPlanDiscountPercent(productId, sellingPlanId) {
    if (!productId) {
      return null
    }

    const widget = globalWindow.LOOP_WIDGET?.[productId]
    const product = widget?.product
    if (!product) {
      return null
    }

    const variantId =
      widget.selectedVariantId ||
      product.selected_or_first_available_variant?.id ||
      product.variants?.[0]?.id

    const variant = product.variants?.find(
      (entry) => String(entry.id) === String(variantId),
    )
    if (!variant) {
      return null
    }

    const allocation = variant.selling_plan_allocations?.find(
      (entry) => String(entry.selling_plan_id) === String(sellingPlanId),
    )
    const variantPrice = Number(variant.price)
    const allocationPrice = Number(allocation?.price)
    if (
      !allocation ||
      !Number.isFinite(variantPrice) ||
      variantPrice <= 0 ||
      !Number.isFinite(allocationPrice) ||
      allocationPrice <= 0 ||
      allocationPrice >= variantPrice
    ) {
      return null
    }

    const percent = Math.round((1 - allocationPrice / variantPrice) * 100)
    return percent > 0 ? `${percent}%` : null
  }

  /**
   * @param {string} rawText
   * @param {string | null} discountPercent
   */
  function formatFrequencyLabel(rawText, discountPercent) {
    let frequency = rawText.trim()
    frequency = frequency.replace(/^deliver(y)?\s*(every)?\s*:?\s*/i, '')
    frequency = frequency.replace(/\s*:?\s*save\s*\d+\s*%?\s*$/i, '')
    frequency = frequency.replace(/\s+/g, ' ').trim()

    if (!frequency) {
      frequency = rawText.trim()
    }

    if (/:\s*save\s/i.test(frequency)) {
      return frequency
    }

    const discount = discountPercent || '10%'
    return `${frequency}: save ${discount}`
  }

  /**
   * Restructures the subscribe option into header / checklist / delivery sections.
   * @param {HTMLElement} option
   */
  function setupExpandedLayout(option) {
    return /// fixing ecom In live
    const existingHeader = option.querySelector(
      '.dilmah-loop-info__option-header',
    )
    const existingBody = option.querySelector('.dilmah-loop-info__option-body')

    if (
      option.getAttribute(LAYOUT_ATTR) === 'true' &&
      existingHeader &&
      existingBody
    ) {
      return
    }

    option
      .querySelectorAll(
        '.dilmah-loop-info__option-header, .dilmah-loop-info__option-body',
      )
      .forEach((wrapper) => {
        if (!(wrapper instanceof HTMLElement) || wrapper.parentNode == null) {
          return
        }

        while (wrapper.firstChild) {
          wrapper.parentNode.insertBefore(wrapper.firstChild, wrapper)
        }

        wrapper.remove()
      })

    option.removeAttribute(LAYOUT_ATTR)
    option.classList.remove('dilmah-loop-info--layout-ready')

    const radio = option.querySelector('.loop-widget-purchase-option-radio')
    const labelTarget =
      option.querySelector('.dilmah-loop-info__label-wrap') ||
      findSubscribeLabel(option)
    const priceBlock = findPriceBlock(option)
    const spgContainer = option.querySelector('.loop-widget-spg-container')
    const discountBadge = option.querySelector(
      '[id^="loop-widget-purchase-option-discount-badge-id-"]',
    )

    const header = document.createElement('div')
    header.className = 'dilmah-loop-info__option-header'

    const left = document.createElement('div')
    left.className = 'dilmah-loop-info__option-left'

    const prices = document.createElement('div')
    prices.className = 'dilmah-loop-info__option-prices'

    const body = document.createElement('div')
    body.className = 'dilmah-loop-info__option-body'

    option.insertBefore(header, option.firstChild)
    header.appendChild(left)
    header.appendChild(prices)
    option.appendChild(body)

    if (radio instanceof HTMLElement) {
      left.appendChild(radio)
    }

    if (labelTarget instanceof HTMLElement) {
      left.appendChild(labelTarget)
    }

    if (priceBlock instanceof HTMLElement) {
      prices.appendChild(priceBlock)
    }

    if (discountBadge instanceof HTMLElement) {
      discountBadge.classList.add('dilmah-loop-info__visually-hidden')
    }

    if (spgContainer instanceof HTMLElement) {
      body.appendChild(spgContainer)
    }

    option.classList.add('dilmah-loop-info--layout-ready')
    option.setAttribute(LAYOUT_ATTR, 'true')
  }

  /**
   * Injects gold checklist rows below the subscribe title row.
   * @param {HTMLElement} option
   */
  function injectInlineChecklist(option) {
    return // ecom fixing in live
    const body = option.querySelector('.dilmah-loop-info__option-body')
    if (!(body instanceof HTMLElement)) {
      return
    }

    let list = body.querySelector(`[${CHECKLIST_ATTR}]`)
    if (!(list instanceof HTMLElement)) {
      list = document.createElement('ul')
      list.className = 'dilmah-loop-info__checklist'
      list.setAttribute(CHECKLIST_ATTR, 'true')
      ;['Skip, pause or cancel anytime'].forEach((text) => {
        const item = document.createElement('li')
        item.className = 'dilmah-loop-info__checklist-item'
        item.innerHTML = `<span class="dilmah-loop-info__checklist-icon" aria-hidden="true">${getIconMarkup('check')}</span><span class="dilmah-loop-info__checklist-text">${text}</span>`
        list.appendChild(item)
      })

      const saveItem = document.createElement('li')
      saveItem.className = 'dilmah-loop-info__checklist-item'
      saveItem.innerHTML = `<span class="dilmah-loop-info__checklist-icon" aria-hidden="true">${getIconMarkup('check')}</span><span class="dilmah-loop-info__checklist-text" data-dilmah-loop-save-text></span>`
      list.insertBefore(saveItem, list.firstChild)
      // body.insertBefore(list, body.firstChild);
      // ecom live fix
    }

    const saveTextEl = list.querySelector('[data-dilmah-loop-save-text]')
    if (saveTextEl) {
      saveTextEl.textContent = getSavePercentText(option)
    }
  }

  /**
   * Moves the Loop delivery selector below the checklist and normalizes its label.
   * @param {HTMLElement} option
   */
  function organizeDeliverySection(option) {
    const spg = option.querySelector('.loop-widget-spg-container')
    if (!(spg instanceof HTMLElement)) {
      return
    }

    let delivery = spg.querySelector('.dilmah-loop-info__delivery')
    if (!(delivery instanceof HTMLElement)) {
      delivery = document.createElement('div')
      delivery.className = 'dilmah-loop-info__delivery'
      spg.appendChild(delivery)
    }

    const label = spg.querySelector(
      '.loop-widget-sp-selector-label:not(.loop-widget-sp-selector-label-as-text), .loop-widget-sp-button-selector-label',
    )
    const selectorContainer = spg.querySelector(
      '.loop-widget-sp-selector-container',
    )
    const buttonContainer =
      spg.querySelector('[id^="loop-widget-sp-button-group-id-"]') ||
      spg.querySelector('.loop-widget-sp-button-container')
    const selectEl = spg.querySelector('select.loop-widget-sp-selector')

    if (selectorContainer instanceof HTMLElement) {
      if (selectorContainer.parentElement !== delivery) {
        delivery.appendChild(selectorContainer)
      }
    } else if (selectEl instanceof HTMLElement) {
      const selectParent = selectEl.parentElement
      if (
        selectParent instanceof HTMLElement &&
        selectParent !== delivery &&
        selectParent.parentElement !== delivery
      ) {
        delivery.appendChild(selectParent)
      } else if (selectEl.parentElement !== delivery) {
        delivery.appendChild(selectEl)
      }
    } else if (
      buttonContainer instanceof HTMLElement &&
      buttonContainer.parentElement !== delivery
    ) {
      delivery.appendChild(buttonContainer)
    }

    spg
      .querySelectorAll(
        '.loop-widget-sp-selector-description, [id^="loop-widget-sp-selector-description-id-"], .loop-widget-sp-selector-label-as-text',
      )
      .forEach((node) => {
        if (node instanceof HTMLElement) {
          node.classList.add('dilmah-loop-info__visually-hidden')
        }
      })
  }

  /**
   * Keeps Loop's existing selling-plan checklist immediately after the complete
   * delivery selector without cloning or recreating it.
   * @param {HTMLElement} option
   */
  function moveChecklistAfterDropdown(option) {
    const delivery = option.querySelector('.dilmah-loop-info__delivery')
    const checklists = Array.from(
      option.querySelectorAll('.dilmah-loop-info__checklist'),
    ).filter((element) => element instanceof HTMLElement)
    const renderedChecklist = option.querySelector(
      '.loop-widget-sp-selector-description .dilmah-loop-info__checklist',
    )
    const checklist =
      renderedChecklist instanceof HTMLElement
        ? renderedChecklist
        : checklists[0]

    if (
      delivery instanceof HTMLElement &&
      checklist instanceof HTMLElement
    ) {
      checklists.forEach((candidate) => {
        if (candidate !== checklist) {
          candidate.remove()
        }
      })

      if (delivery.nextElementSibling !== checklist) {
        delivery.insertAdjacentElement('afterend', checklist)
      }
    }
  }

  /**
   * Rewrites Loop selling plan labels to "1 month: save 10%" format.
   * @param {HTMLElement} option
   * @param {string | null} productId
   */
  function rewriteSellingPlanLabels(option, productId) {
    return
    const select = option.querySelector('select.loop-widget-sp-selector')
    if (select instanceof HTMLSelectElement) {
      Array.from(select.options).forEach((opt) => {
        const original =
          opt.dataset.dilmahOriginalText || opt.textContent?.trim() || ''
        if (!opt.dataset.dilmahOriginalText) {
          opt.dataset.dilmahOriginalText = original
        }

        const discount =
          getSellingPlanDiscountPercent(productId, opt.value) ||
          getSavePercentText(option).replace(/^Save\s*/i, '')
        opt.textContent = formatFrequencyLabel(original, discount)
      })
      return
    }

    option.querySelectorAll('.loop-widget-sp-button').forEach((button) => {
      if (!(button instanceof HTMLElement)) {
        return
      }

      const original =
        button.dataset.dilmahOriginalText || button.textContent?.trim() || ''
      if (!button.dataset.dilmahOriginalText) {
        button.dataset.dilmahOriginalText = original
      }

      const discount =
        getSellingPlanDiscountPercent(
          productId,
          button.dataset.sellingPlanId || '',
        ) || getSavePercentText(option).replace(/^Save\s*/i, '')
      button.textContent = formatFrequencyLabel(original, discount)
    })
  }

  /**
   * Tags compare-at price node for styling when Loop does not provide a class.
   * @param {HTMLElement} option
   */
  function stylePriceBlock(option) {
    const prices = option.querySelector('.dilmah-loop-info__option-prices')
    const priceEl = prices?.querySelector(
      '[id^="loop-widget-purchase-option-price-id-"]',
    )
    if (!(priceEl instanceof HTMLElement)) {
      return
    }

    const compareAt =
      prices.querySelector('.loop-widget-purchase-option-compare-at-price') ||
      priceEl.previousElementSibling

    if (compareAt instanceof HTMLElement && compareAt !== priceEl) {
      compareAt.classList.add('dilmah-loop-info__compare-at-price')
    }
  }

  /**
   * Applies the expanded subscription card layout for a single subscribe option.
   * @param {HTMLElement} option
   * @param {string | null} productId
   */
  function enhanceSubscribeOption(option, productId) {
    setupExpandedLayout(option)
    injectInfoIcon(option)
    updateSubscriptionDiscountBadge(option, productId)
    positionInfoTriggerAfterDiscountBadge(option)
    stylePriceBlock(option)
    injectInlineChecklist(option)
    organizeDeliverySection(option)
    moveChecklistAfterDropdown(option)
    rewriteSellingPlanLabels(option, productId)

    const isSelected =
      option.classList.contains('loop-widget-purchase-option-selected') ||
      option.getAttribute('aria-checked') === 'true'
    // option.classList.toggle('dilmah-loop-info--selected', isSelected);
    // We use default app configuration
  }

  /**
   * Scans Loop widget containers and enhances subscribe rows (icon + expanded layout).
   * @param {ParentNode} root
   */
  function scanAndInject(root = document) {
    const scope =
      root instanceof Element || root instanceof Document ? root : document
    const containers = scope.querySelectorAll(SELECTORS.widgetContainer)

    containers.forEach((container) => {
      if (
        !(container instanceof HTMLElement) ||
        !isLoopWidgetReady(container)
      ) {
        return
      }

      const productId = getProductIdFromContainer(container)

      container
        .querySelectorAll(SELECTORS.subscribeOption)
        .forEach((option) => {
          if (option instanceof HTMLElement) {
            enhanceSubscribeOption(option, productId)
          }
        })
    })
  }

  /** @param {() => void} callback */
  function scheduleScan(callback) {
    globalWindow.clearTimeout(scanTimer)
    scanTimer = globalWindow.setTimeout(callback, 80)
  }

  /**
   * Observes DOM mutations so icons are added after Loop async renders / re-renders
   * (variant changes, selling plan changes, AJAX updates).
   */
  function startWidgetObserver() {
    if (widgetObserver) {
      return
    }

    widgetObserver = new MutationObserver((mutations) => {
      let shouldScan = false

      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.target instanceof HTMLElement
        ) {
          const target = mutation.target
          if (
            target.matches(SELECTORS.widgetContainer) ||
            target.closest(SELECTORS.widgetContainer) ||
            target.id?.startsWith('loop-widget-')
          ) {
            shouldScan = true
            break
          }
        }

        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (!(node instanceof HTMLElement)) {
              continue
            }

            if (
              node.matches(SELECTORS.widgetContainer) ||
              node.querySelector(SELECTORS.widgetContainer) ||
              node.id?.startsWith('loop-widget-') ||
              node.classList.contains('loop-widget-purchase-option')
            ) {
              shouldScan = true
              break
            }
          }
        }

        if (shouldScan) {
          break
        }
      }

      if (shouldScan) {
        scheduleScan(() => scanAndInject(document))
      }
    })

    widgetObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'id', 'aria-checked'],
    })
  }

  function stopWidgetObserver() {
    if (!widgetObserver) {
      return
    }

    widgetObserver.disconnect()
    widgetObserver = null
  }

  /**
   * Some variant and selling-plan selections update JS state before Loop
   * replaces any DOM. Reuse the existing debounced scan for those events.
   * @param {Event} event
   */
  function handleWidgetSelectionChange(event) {
    if (
      event.type !== 'variant:update' &&
      !(
        event.target instanceof Element &&
        event.target.closest(SELECTORS.widgetContainer)
      )
    ) {
      return
    }

    scheduleScan(() => scanAndInject(document))
  }

  /** @param {HTMLElement} container @returns {HTMLElement[]} */
  function getFocusableElements(container) {
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      (element) => {
        if (!(element instanceof HTMLElement)) {
          return false
        }

        return !element.hidden && element.tabIndex >= 0
      },
    )
  }

  function lockScroll() {
    if (scrollState) {
      return
    }

    scrollState = {
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow,
      bodyPaddingRight: document.body.style.paddingRight,
    }

    const scrollbarWidth =
      globalWindow.innerWidth - document.documentElement.clientWidth
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
  }

  function unlockScroll() {
    if (!scrollState) {
      return
    }

    document.documentElement.style.overflow = scrollState.htmlOverflow
    document.body.style.overflow = scrollState.bodyOverflow
    document.body.style.paddingRight = scrollState.bodyPaddingRight
    scrollState = null
  }

  function destroyModal() {
    if (modalOpen) {
      modalOpen = false
      unlockScroll()
    }

    if (overlayElement) {
      overlayElement.removeEventListener('click', handleOverlayClick)
      overlayElement.removeEventListener('keydown', handleOverlayKeydown)
      overlayElement.remove()
    }

    overlayElement = null
    dialogElement = null
    modalBuilt = false
    lastTriggerElement = null
  }

  function buildModal() {
    const settings = getSettings()

    if (!settings.enabled) {
      destroyModal()
      return
    }

    destroyModal()

    const overlay = document.createElement('div')
    overlay.className = 'dilmah-loop-info__overlay'
    overlay.hidden = true
    overlay.setAttribute('aria-hidden', 'true')

    const backdrop = document.createElement('div')
    backdrop.className = 'dilmah-loop-info__backdrop'
    backdrop.setAttribute('data-dilmah-loop-info-dismiss', '')

    const dialog = document.createElement('div')
    dialog.className = 'dilmah-loop-info__dialog'
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    dialog.setAttribute('aria-labelledby', 'dilmah-loop-info-title')
    dialog.tabIndex = -1

    const closeButton = document.createElement('button')
    closeButton.type = 'button'
    closeButton.className = 'dilmah-loop-info__close'
    closeButton.setAttribute('aria-label', settings.closeLabel)
    closeButton.setAttribute('data-dilmah-loop-info-dismiss', '')
    closeButton.innerHTML = '&times;'

    const title = document.createElement('h2')
    title.id = 'dilmah-loop-info-title'
    title.className = 'dilmah-loop-info__title'
    title.textContent = settings.title

    const benefitsList = document.createElement('ul')
    benefitsList.className = 'dilmah-loop-info__benefits'

    settings.benefits.forEach((benefit) => {
      const item = document.createElement('li')
      item.className = 'dilmah-loop-info__benefit'

      const iconWrap = document.createElement('div')
      iconWrap.className = 'dilmah-loop-info__benefit-icon'
      iconWrap.innerHTML = getIconMarkup(
        VALID_BENEFIT_ICONS.includes(benefit.icon) ? benefit.icon : 'calendar',
      )

      const content = document.createElement('div')
      content.className = 'dilmah-loop-info__benefit-content'

      const benefitTitle = document.createElement('h3')
      benefitTitle.className = 'dilmah-loop-info__benefit-title'
      benefitTitle.textContent = benefit.title

      const description = document.createElement('div')
      description.className = 'dilmah-loop-info__benefit-description'
      description.innerHTML = benefit.descriptionHtml

      content.appendChild(benefitTitle)
      content.appendChild(description)
      item.appendChild(iconWrap)
      item.appendChild(content)
      benefitsList.appendChild(item)
    })

    const cta = document.createElement('button')
    cta.type = 'button'
    cta.className = 'dilmah-loop-info__cta'
    cta.setAttribute('data-dilmah-loop-info-dismiss', '')
    cta.textContent = settings.buttonText

    dialog.appendChild(closeButton)
    dialog.appendChild(title)
    dialog.appendChild(benefitsList)
    dialog.appendChild(cta)
    overlay.appendChild(backdrop)
    overlay.appendChild(dialog)
    document.body.appendChild(overlay)

    overlay.addEventListener('click', handleOverlayClick)
    overlay.addEventListener('keydown', handleOverlayKeydown)

    overlayElement = overlay
    dialogElement = dialog
    modalBuilt = true
  }

  /** @param {KeyboardEvent} event */
  function trapFocus(event) {
    if (!modalOpen || !dialogElement || event.key !== 'Tab') {
      return
    }

    const focusable = getFocusableElements(dialogElement)
    if (!focusable.length) {
      event.preventDefault()
      dialogElement.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement

    if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
      return
    }

    if (event.shiftKey && (active === first || active === dialogElement)) {
      event.preventDefault()
      last.focus()
    }
  }

  /** @param {MouseEvent} event */
  function handleOverlayClick(event) {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }

    if (target.matches('[data-dilmah-loop-info-dismiss]')) {
      event.preventDefault()
      closeModal()
    }
  }

  /** @param {KeyboardEvent} event */
  function handleOverlayKeydown(event) {
    if (event.key === 'Escape' && modalOpen) {
      event.preventDefault()
      closeModal()
      return
    }

    trapFocus(event)
  }

  /** @param {HTMLElement} trigger */
  function openModal(trigger) {
    const settings = getSettings()
    if (!settings.enabled) {
      return
    }

    buildModal()

    if (!overlayElement || !dialogElement || modalOpen) {
      return
    }

    lastTriggerElement = trigger
    modalOpen = true
    overlayElement.hidden = false
    overlayElement.setAttribute('aria-hidden', 'false')
    lockScroll()

    globalWindow.requestAnimationFrame(() => {
      overlayElement?.classList.add('is-open')
      const focusTarget = dialogElement?.querySelector('.dilmah-loop-info__cta')
      if (focusTarget instanceof HTMLElement) {
        focusTarget.focus()
      } else {
        dialogElement?.focus()
      }
    })
  }

  function closeModal() {
    if (!overlayElement || !dialogElement || !modalOpen) {
      return
    }

    modalOpen = false
    overlayElement.classList.remove('is-open')
    overlayElement.setAttribute('aria-hidden', 'true')
    unlockScroll()

    globalWindow.setTimeout(() => {
      if (!modalOpen && overlayElement) {
        overlayElement.hidden = true
      }
    }, 200)

    if (
      lastTriggerElement instanceof HTMLElement &&
      document.contains(lastTriggerElement)
    ) {
      lastTriggerElement.focus()
    }
  }

  function refreshFromSettings() {
    const settings = getSettings()
    destroyModal()

    if (settings.enabled) {
      buildModal()
    }

    scanAndInject(document)
  }

  function init() {
    const settings = getSettings()

    if (settings.enabled) {
      buildModal()
    }

    scanAndInject(document)
    startWidgetObserver()
    document.addEventListener('change', handleWidgetSelectionChange)
    document.addEventListener('variant:update', handleWidgetSelectionChange)

    document.addEventListener('shopify:section:load', (event) => {
      if (!(event.target instanceof HTMLElement)) {
        return
      }

      if (!event.target.querySelector(`#${SETTINGS_ID}`)) {
        return
      }

      scheduleScan(() => refreshFromSettings())
    })
  }

  function destroy() {
    stopWidgetObserver()
    globalWindow.clearTimeout(scanTimer)
    destroyModal()
    document.removeEventListener('change', handleWidgetSelectionChange)
    document.removeEventListener('variant:update', handleWidgetSelectionChange)

    document.querySelectorAll(`[${INJECTED_ATTR}]`).forEach((option) => {
      option.removeAttribute(INJECTED_ATTR)
    })

    document.querySelectorAll(`[${LAYOUT_ATTR}]`).forEach((option) => {
      option.removeAttribute(LAYOUT_ATTR)
      option.classList.remove(
        'dilmah-loop-info--layout-ready',
        'dilmah-loop-info--selected',
      )
    })

    document.querySelectorAll(`[${CHECKLIST_ATTR}]`).forEach((list) => {
      list.remove()
    })

    document
      .querySelectorAll(
        '.dilmah-loop-info__option-header, .dilmah-loop-info__option-body',
      )
      .forEach((node) => {
        if (!(node instanceof HTMLElement) || node.parentNode == null) {
          return
        }

        while (node.firstChild) {
          node.parentNode.insertBefore(node.firstChild, node)
        }

        node.remove()
      })

    document.querySelectorAll(SELECTORS.infoTrigger).forEach((trigger) => {
      trigger.remove()
    })

    document
      .querySelectorAll(CUSTOM_DISCOUNT_BADGE_SELECTOR)
      .forEach((badge) => badge.remove())

    document
      .querySelectorAll('.dilmah-loop-info__label-wrap')
      .forEach((wrap) => {
        if (!(wrap instanceof HTMLElement) || wrap.parentNode == null) {
          return
        }

        while (wrap.firstChild) {
          wrap.parentNode.insertBefore(wrap.firstChild, wrap)
        }

        wrap.remove()
      })
  }

  globalWindow.DilmahLoopInfo = {
    __bootstrapped: true,
    init,
    destroy,
    open: openModal,
    close: closeModal,
    scan: scanAndInject,
    refreshFromSettings,
    getSettings,
    getSubscriptionDiscountSummary,
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
  } else {
    init()
  }
})()
