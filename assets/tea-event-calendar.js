(function () {
  'use strict';

  /**
   * @typedef {Object} TeaEventData
   * @property {string} title
   * @property {string} description
   * @property {string} location
   * @property {string} url
   * @property {string} start
   * @property {string} end
   * @property {string} uid
   * @property {string} icsFilename
   */

  /**
   * @typedef {Object} TeaEventCalendarInstance
   * @property {HTMLButtonElement} trigger
   * @property {HTMLElement} menu
   * @property {HTMLElement} backdrop
   * @property {HTMLElement} calendarControls
   * @property {HTMLAnchorElement | null} liveLink
   * @property {HTMLElement | null} liveLabel
   * @property {string} liveCtaLabel
   * @property {string} postEventCtaLabel
   * @property {number | null} ctaTimerStart
   * @property {number | null} ctaTimerEnd
   * @property {TeaEventData} eventData
   * @property {boolean} isOpen
   * @property {HTMLElement | null} focusReturn
   * @property {boolean} bound
   * @property {((event: MouseEvent) => void)=} onTriggerClick
   * @property {((event: KeyboardEvent) => void)=} onDocumentKeydown
   * @property {((event: PointerEvent) => void)=} onDocumentPointerDown
   * @property {((event: MouseEvent) => void)=} onMenuClick
   * @property {(() => void)=} onBackdropClick
   * @property {(() => void)=} onMqChange
   * @property {(() => void)=} onViewportChange
   */

  var SECTION_SELECTOR = '[data-tea-event-banner]';
  var INIT_ATTR = 'data-tea-event-calendar-init';
  var MOBILE_MQ = window.matchMedia('(max-width: 749px)');

  /** @type {WeakMap<HTMLElement, TeaEventCalendarInstance>} */
  var instances = new WeakMap();

  /**
   * @param {string} value
   * @returns {string}
   */
  function escapeIcsText(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r\n/g, '\\n')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\n');
  }

  /**
   * @param {string} iso
   * @returns {string}
   */
  function isoToGoogleDate(iso) {
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  /**
   * @param {string} iso
   * @returns {string}
   */
  function isoToOutlookDate(iso) {
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  /**
   * @param {HTMLElement} root
   * @param {TeaEventData} eventData
   * @returns {void}
   */
  function renderLocalEventSchedule(root, eventData) {
    var dateEl = root.querySelector('[data-tea-event-display-date]');
    var timeEl = root.querySelector('[data-tea-event-display-time]');
    var startDate = new Date(eventData.start);

    if (Number.isNaN(startDate.getTime())) return;

    var dateFormatter = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    var timeFormatter = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'long',
    });

    if (dateEl) {
      dateEl.textContent = dateFormatter.format(startDate);
    }
    if (timeEl) {
      timeEl.textContent = timeFormatter.format(startDate);
    }
  }

  /**
   * @typedef {'upcoming' | 'live' | 'ended'} TeaEventPhase
   */

  /**
   * @param {TeaEventData} eventData
   * @param {string} postEventCtaLabel
   * @returns {TeaEventPhase}
   */
  function getEventPhase(eventData, postEventCtaLabel) {
    if (!eventData.url) return 'upcoming';

    var start = new Date(eventData.start).getTime();
    var end = new Date(eventData.end).getTime();
    var now = Date.now();

    if (Number.isNaN(start) || Number.isNaN(end)) return 'upcoming';
    if (now >= start && now <= end) return 'live';
    if (now > end && postEventCtaLabel) return 'ended';
    return 'upcoming';
  }

  /**
   * @param {TeaEventCalendarInstance} calendar
   * @returns {void}
   */
  function clearCtaTimers(calendar) {
    if (calendar.ctaTimerStart !== null) {
      window.clearTimeout(calendar.ctaTimerStart);
      calendar.ctaTimerStart = null;
    }
    if (calendar.ctaTimerEnd !== null) {
      window.clearTimeout(calendar.ctaTimerEnd);
      calendar.ctaTimerEnd = null;
    }
  }

  /**
   * @param {HTMLElement} root
   * @param {TeaEventCalendarInstance} calendar
   * @returns {void}
   */
  function updateCtaState(root, calendar) {
    var phase = getEventPhase(calendar.eventData, calendar.postEventCtaLabel);

    root.classList.remove('is-event-upcoming', 'is-event-live', 'is-event-ended');
    root.classList.add('is-event-' + phase);

    if (calendar.isOpen && phase !== 'upcoming') {
      closeMenu(root);
    }

    if (!calendar.liveLink) return;

    if (phase === 'live') {
      calendar.calendarControls.hidden = true;
      calendar.liveLink.hidden = false;
      calendar.liveLink.href = calendar.eventData.url;
      if (calendar.liveLabel) {
        calendar.liveLabel.textContent = calendar.liveCtaLabel;
      }
      return;
    }

    if (phase === 'ended') {
      calendar.calendarControls.hidden = true;
      calendar.liveLink.hidden = false;
      calendar.liveLink.href = calendar.eventData.url;
      if (calendar.liveLabel) {
        calendar.liveLabel.textContent = calendar.postEventCtaLabel;
      }
      return;
    }

    calendar.calendarControls.hidden = false;
    calendar.liveLink.hidden = true;
  }

  /**
   * @param {HTMLElement} root
   * @param {TeaEventCalendarInstance} calendar
   * @returns {void}
   */
  function scheduleCtaTimers(root, calendar) {
    clearCtaTimers(calendar);

    if (!calendar.eventData.url) return;

    var start = new Date(calendar.eventData.start).getTime();
    var end = new Date(calendar.eventData.end).getTime();
    var now = Date.now();

    if (Number.isNaN(start) || Number.isNaN(end)) return;

    if (now < start) {
      calendar.ctaTimerStart = window.setTimeout(function () {
        updateCtaState(root, calendar);
        scheduleCtaTimers(root, calendar);
      }, start - now);
    }

    if (now < end) {
      calendar.ctaTimerEnd = window.setTimeout(function () {
        updateCtaState(root, calendar);
        scheduleCtaTimers(root, calendar);
      }, end - now);
    }
  }

  /**
   * @param {DOMStringMap} dataset
   * @returns {TeaEventData}
   */
  function readEventData(dataset) {
    return {
      title: dataset.eventTitle || '',
      description: dataset.eventDescription || '',
      location: dataset.eventLocation || '',
      url: dataset.eventUrl || '',
      start: dataset.eventStart || '',
      end: dataset.eventEnd || '',
      uid: dataset.eventUid || 'tea-event@shopify-horizon',
      icsFilename: dataset.icsFilename || 'tea-around-the-clock.ics',
    };
  }

  /**
   * @param {TeaEventData} eventData
   * @returns {string}
   */
  function buildIcsContent(eventData) {
    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Shopify Horizon//Tea Event Banner//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + escapeIcsText(eventData.uid),
      'DTSTAMP:' + isoToGoogleDate(new Date().toISOString()),
      'DTSTART:' + isoToGoogleDate(eventData.start),
      'DTEND:' + isoToGoogleDate(eventData.end),
      'SUMMARY:' + escapeIcsText(eventData.title),
    ];

    if (eventData.description) {
      lines.push('DESCRIPTION:' + escapeIcsText(eventData.description));
    }
    if (eventData.location) {
      lines.push('LOCATION:' + escapeIcsText(eventData.location));
    }
    if (eventData.url) {
      lines.push('URL:' + escapeIcsText(eventData.url));
    }

    lines.push('END:VEVENT', 'END:VCALENDAR');
    return lines.join('\r\n');
  }

  /**
   * @param {TeaEventData} eventData
   * @returns {string}
   */
  function buildGoogleCalendarUrl(eventData) {
    var start = isoToGoogleDate(eventData.start);
    var end = isoToGoogleDate(eventData.end);
    if (!start || !end) return '';

    var params = new URLSearchParams({
      action: 'TEMPLATE',
      text: eventData.title,
      dates: start + '/' + end,
      ctz: 'UTC',
    });

    if (eventData.description) params.set('details', eventData.description);
    if (eventData.location) params.set('location', eventData.location);

    return 'https://calendar.google.com/calendar/render?' + params.toString();
  }

  /**
   * @param {TeaEventData} eventData
   * @returns {string}
   */
  function buildOutlookCalendarUrl(eventData) {
    var params = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      subject: eventData.title,
      startdt: isoToOutlookDate(eventData.start),
      enddt: isoToOutlookDate(eventData.end),
    });

    if (eventData.description) params.set('body', eventData.description);
    if (eventData.location) params.set('location', eventData.location);

    return 'https://outlook.live.com/calendar/0/deeplink/compose?' + params.toString();
  }

  /**
   * @returns {'apple' | 'google' | 'outlook'}
   */
  function detectPreferredCalendar() {
    var ua = navigator.userAgent || '';
    var platform = navigator.platform || '';
    var maxTouchPoints = navigator.maxTouchPoints || 0;

    var isApple =
      /iPad|iPhone|iPod/.test(ua) ||
      (platform === 'MacIntel' && maxTouchPoints > 1) ||
      /Macintosh|Mac OS X/.test(ua);

    if (isApple) return 'apple';

    if (/CrOS/.test(ua) || /Android/.test(ua)) return 'google';

    if (/Windows/.test(ua)) return 'outlook';

    return 'google';
  }

  /**
   * @returns {Array<{ id: string, label: string }>}
   */
  function getMenuOptions() {
    var preferred = detectPreferredCalendar();
    var options = [
      { id: 'google', label: 'Google Calendar' },
      { id: 'apple', label: 'Apple Calendar' },
      { id: 'outlook', label: 'Outlook Calendar' },
      { id: 'ics', label: 'Download Calendar File (.ics)' },
    ];

    var order = {
      apple: ['apple', 'google', 'outlook', 'ics'],
      google: ['google', 'apple', 'outlook', 'ics'],
      outlook: ['outlook', 'google', 'apple', 'ics'],
    };

    var sortOrder = order[preferred] || order.google;
    /** @type {Array<{ id: string, label: string }>} */
    var sortedOptions = [];

    for (var i = 0; i < sortOrder.length; i += 1) {
      var optionId = sortOrder[i];
      var matchedOption = options.find(function (option) {
        return option.id === optionId;
      });

      if (matchedOption) {
        sortedOptions.push(matchedOption);
      }
    }

    return sortedOptions;
  }

  /**
   * @param {TeaEventData} eventData
   * @returns {void}
   */
  function downloadIcs(eventData) {
    var content = buildIcsContent(eventData);
    var blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    var objectUrl = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = objectUrl;
    link.download = eventData.icsFilename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(objectUrl);
    }, 0);
  }

  /**
   * @param {string} url
   * @returns {void}
   */
  function openExternalUrl(url) {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * @param {HTMLElement} menu
   * @returns {void}
   */
  function resetDesktopMenuPosition(menu) {
    menu.style.top = '';
    menu.style.left = '';
    menu.style.width = '';
    menu.style.maxWidth = '';
  }

  /**
   * @param {TeaEventCalendarInstance} instance
   * @returns {void}
   */
  function positionDesktopMenu(instance) {
    if (MOBILE_MQ.matches || !instance.isOpen) {
      resetDesktopMenuPosition(instance.menu);
      return;
    }

    var trigger = instance.trigger;
    var menu = instance.menu;
    var rect = trigger.getBoundingClientRect();
    var gap = 8;
    var viewportPadding = 16;
    var menuWidth = Math.max(rect.width, 288);
    var maxLeft = window.innerWidth - menuWidth - viewportPadding;
    var left = Math.min(Math.max(rect.left, viewportPadding), Math.max(viewportPadding, maxLeft));
    var top = rect.bottom + gap;
    var menuRect = menu.getBoundingClientRect();
    var menuHeight = menuRect.height || menu.offsetHeight;

    if (menuHeight > 0 && top + menuHeight > window.innerHeight - viewportPadding) {
      var aboveTop = rect.top - gap - menuHeight;
      if (aboveTop >= viewportPadding) {
        top = aboveTop;
      }
    }

    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
    menu.style.width = menuWidth + 'px';
    menu.style.maxWidth = 'calc(100vw - ' + viewportPadding * 2 + 'px)';
  }

  /**
   * @param {HTMLElement} root
   * @returns {void}
   */
  function closeMenu(root) {
    var instance = instances.get(root);
    if (!instance || !instance.isOpen) return;

    instance.isOpen = false;
    instance.trigger.setAttribute('aria-expanded', 'false');
    instance.menu.hidden = true;
    instance.backdrop.hidden = true;
    instance.backdrop.setAttribute('aria-hidden', 'true');
    root.classList.remove('is-calendar-open');
    resetDesktopMenuPosition(instance.menu);

    var focusReturn = instance.focusReturn;
    if (focusReturn instanceof HTMLElement) {
      try {
        focusReturn.focus({ preventScroll: true });
      } catch (error) {
        focusReturn.focus();
      }
    }
  }

  /**
   * @param {HTMLElement} root
   * @returns {void}
   */
  function openMenu(root) {
    var instance = instances.get(root);
    if (!instance) return;

    instance.isOpen = true;
    instance.focusReturn =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    instance.trigger.setAttribute('aria-expanded', 'true');
    instance.menu.hidden = false;
    if (MOBILE_MQ.matches) {
      instance.backdrop.hidden = false;
      instance.backdrop.setAttribute('aria-hidden', 'false');
    } else {
      instance.backdrop.hidden = true;
      instance.backdrop.setAttribute('aria-hidden', 'true');
    }
    root.classList.add('is-calendar-open');

    if (MOBILE_MQ.matches) {
      var firstItem = instance.menu.querySelector('[role="menuitem"]');
      if (firstItem instanceof HTMLElement) {
        try {
          firstItem.focus({ preventScroll: true });
        } catch (error) {
          firstItem.focus();
        }
      }
      return;
    }

    /** @type {TeaEventCalendarInstance} */
    var calendar = instance;

    positionDesktopMenu(calendar);

    window.requestAnimationFrame(function () {
      positionDesktopMenu(calendar);
      var firstDesktopItem = calendar.menu.querySelector('[role="menuitem"]');
      if (firstDesktopItem instanceof HTMLElement) {
        try {
          firstDesktopItem.focus({ preventScroll: true });
        } catch (error) {
          firstDesktopItem.focus();
        }
      }
    });
  }

  /**
   * @param {HTMLElement} root
   * @param {string} optionId
   * @returns {void}
   */
  function handleMenuSelection(root, optionId) {
    var instance = instances.get(root);
    if (!instance) return;

    var eventData = instance.eventData;

    if (optionId === 'google') {
      openExternalUrl(buildGoogleCalendarUrl(eventData));
    } else if (optionId === 'apple') {
      downloadIcs(eventData);
    } else if (optionId === 'outlook') {
      var outlookUrl = buildOutlookCalendarUrl(eventData);
      if (outlookUrl) {
        var outlookWindow = window.open(outlookUrl, '_blank', 'noopener,noreferrer');
        if (!outlookWindow) {
          downloadIcs(eventData);
        }
      } else {
        downloadIcs(eventData);
      }
    } else if (optionId === 'ics') {
      downloadIcs(eventData);
    }

    closeMenu(root);
  }

  /**
   * @param {HTMLElement} menu
   * @param {TeaEventData} eventData
   * @returns {void}
   */
  function renderMenuItems(menu, eventData) {
    menu.innerHTML = '';
    var options = getMenuOptions();

    options.forEach(function (option) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'tea-event-banner__calendar-option';
      item.setAttribute('role', 'menuitem');
      item.dataset.calendarOption = option.id;
      item.textContent = option.label;
      menu.appendChild(item);
    });

    menu.dataset.rendered = 'true';
    menu.dataset.eventSignature = [
      eventData.title,
      eventData.start,
      eventData.end,
      eventData.location,
      eventData.url,
    ].join('|');
  }

  /**
   * @param {HTMLElement} root
   * @returns {void}
   */
  function bindEvents(root) {
    var instance = instances.get(root);
    if (!instance || instance.bound) return;

    /** @type {TeaEventCalendarInstance} */
    var calendar = instance;
    calendar.bound = true;

    calendar.onTriggerClick = function (/** @type {MouseEvent} */ event) {
      event.preventDefault();
      if (calendar.isOpen) {
        closeMenu(root);
      } else {
        openMenu(root);
      }
    };

    calendar.onDocumentKeydown = function (/** @type {KeyboardEvent} */ event) {
      if (!calendar.isOpen) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(root);
        return;
      }

      if (event.key === 'Tab' && calendar.menu.contains(document.activeElement)) {
        var focusable = Array.from(calendar.menu.querySelectorAll('[role="menuitem"]'));
        if (!focusable.length) return;

        var first = focusable[0];
        var last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first && last instanceof HTMLElement) {
          event.preventDefault();
          try {
            last.focus({ preventScroll: true });
          } catch (error) {
            last.focus();
          }
        } else if (!event.shiftKey && document.activeElement === last && first instanceof HTMLElement) {
          event.preventDefault();
          try {
            first.focus({ preventScroll: true });
          } catch (error) {
            first.focus();
          }
        }
      }
    };

    calendar.onDocumentPointerDown = function (/** @type {PointerEvent} */ event) {
      if (!calendar.isOpen) return;
      var target = event.target;
      if (!(target instanceof Node)) return;
      if (root.contains(target)) return;
      closeMenu(root);
    };

    calendar.onMenuClick = function (/** @type {MouseEvent} */ event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) return;
      var option = target.closest('[data-calendar-option]');
      if (!(option instanceof HTMLElement)) return;
      handleMenuSelection(root, option.dataset.calendarOption || '');
    };

    calendar.onBackdropClick = function () {
      closeMenu(root);
    };

    calendar.onMqChange = function () {
      root.classList.toggle('is-mobile-calendar', MOBILE_MQ.matches);
      if (calendar.isOpen) {
        if (MOBILE_MQ.matches) {
          resetDesktopMenuPosition(calendar.menu);
        } else {
          calendar.backdrop.hidden = true;
          calendar.backdrop.setAttribute('aria-hidden', 'true');
          positionDesktopMenu(calendar);
        }
      }
    };

    calendar.onViewportChange = function () {
      if (calendar.isOpen && !MOBILE_MQ.matches) {
        positionDesktopMenu(calendar);
      }
    };

    var onTriggerClick = calendar.onTriggerClick;
    var onMenuClick = calendar.onMenuClick;
    var onBackdropClick = calendar.onBackdropClick;
    var onDocumentKeydown = calendar.onDocumentKeydown;
    var onDocumentPointerDown = calendar.onDocumentPointerDown;
    var onViewportChange = calendar.onViewportChange;
    var onMqChange = calendar.onMqChange;

    if (
      onTriggerClick &&
      onMenuClick &&
      onBackdropClick &&
      onDocumentKeydown &&
      onDocumentPointerDown &&
      onViewportChange &&
      onMqChange
    ) {
      calendar.trigger.addEventListener('click', onTriggerClick);
      calendar.menu.addEventListener('click', onMenuClick);
      calendar.backdrop.addEventListener('click', onBackdropClick);
      document.addEventListener('keydown', onDocumentKeydown);
      document.addEventListener('pointerdown', onDocumentPointerDown);
      window.addEventListener('resize', onViewportChange);
      window.addEventListener('scroll', onViewportChange, true);

      if (typeof MOBILE_MQ.addEventListener === 'function') {
        MOBILE_MQ.addEventListener('change', onMqChange);
      } else if (typeof MOBILE_MQ.addListener === 'function') {
        MOBILE_MQ.addListener(onMqChange);
      }

      onMqChange();
    }
  }

  /**
   * @param {HTMLElement} root
   * @returns {void}
   */
  function teardown(root) {
    var instance = instances.get(root);
    if (!instance) return;

    if (instance.trigger && instance.onTriggerClick) {
      instance.trigger.removeEventListener('click', instance.onTriggerClick);
    }
    if (instance.menu && instance.onMenuClick) {
      instance.menu.removeEventListener('click', instance.onMenuClick);
    }
    if (instance.backdrop && instance.onBackdropClick) {
      instance.backdrop.removeEventListener('click', instance.onBackdropClick);
    }
    if (instance.onDocumentKeydown) {
      document.removeEventListener('keydown', instance.onDocumentKeydown);
    }
    if (instance.onDocumentPointerDown) {
      document.removeEventListener('pointerdown', instance.onDocumentPointerDown);
    }
    if (instance.onViewportChange) {
      window.removeEventListener('resize', instance.onViewportChange);
      window.removeEventListener('scroll', instance.onViewportChange, true);
    }
    if (instance.menu) {
      resetDesktopMenuPosition(instance.menu);
    }
    if (instance.onMqChange) {
      if (typeof MOBILE_MQ.removeEventListener === 'function') {
        MOBILE_MQ.removeEventListener('change', instance.onMqChange);
      } else if (typeof MOBILE_MQ.removeListener === 'function') {
        MOBILE_MQ.removeListener(instance.onMqChange);
      }
    }
    clearCtaTimers(instance);

    instances.delete(root);
    root.removeAttribute(INIT_ATTR);
  }

  /**
   * @param {HTMLElement} root
   * @returns {void}
   */
  function init(root) {
    if (!(root instanceof HTMLElement)) return;
    if (root.getAttribute(INIT_ATTR) === 'true') return;

    root.classList.add('has-js');
    document.documentElement.classList.add('has-js');

    var trigger = root.querySelector('[data-tea-event-calendar-trigger]');
    var menu = root.querySelector('[data-tea-event-calendar-menu]');
    var backdrop = root.querySelector('[data-tea-event-calendar-backdrop]');
    var calendarControls = root.querySelector('[data-tea-event-calendar-controls]');
    var liveLink = root.querySelector('[data-tea-event-live-link]');
    var liveLabel = root.querySelector('[data-tea-event-live-label]');

    if (!(trigger instanceof HTMLButtonElement)) return;
    if (!(menu instanceof HTMLElement)) return;
    if (!(backdrop instanceof HTMLElement)) return;
    if (!(calendarControls instanceof HTMLElement)) return;

    teardown(root);

    var eventData = readEventData(root.dataset);
    renderMenuItems(menu, eventData);

    /** @type {TeaEventCalendarInstance} */
    var instance = {
      trigger: trigger,
      menu: menu,
      backdrop: backdrop,
      calendarControls: calendarControls,
      liveLink: liveLink instanceof HTMLAnchorElement ? liveLink : null,
      liveLabel: liveLabel instanceof HTMLElement ? liveLabel : null,
      liveCtaLabel: root.dataset.liveCtaLabel || 'Join Now Live',
      postEventCtaLabel: root.dataset.postEventCtaLabel || '',
      ctaTimerStart: null,
      ctaTimerEnd: null,
      eventData: eventData,
      isOpen: false,
      focusReturn: null,
      bound: false,
    };

    instances.set(root, instance);

    bindEvents(root);
    renderLocalEventSchedule(root, eventData);
    updateCtaState(root, instance);
    scheduleCtaTimers(root, instance);
    root.setAttribute(INIT_ATTR, 'true');
  }

  /**
   * @param {ParentNode} scope
   * @returns {void}
   */
  function initAll(scope) {
    var roots = (scope || document).querySelectorAll(SECTION_SELECTOR);
    for (var i = 0; i < roots.length; i += 1) {
      var root = roots[i];
      if (root instanceof HTMLElement) {
        init(root);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAll(document);
    });
  } else {
    initAll(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    if (event.target instanceof HTMLElement) {
      initAll(event.target);
    }
  });

  document.addEventListener('shopify:section:unload', function (event) {
    if (!(event.target instanceof HTMLElement)) return;
    var roots = event.target.querySelectorAll(SECTION_SELECTOR);
    for (var i = 0; i < roots.length; i += 1) {
      var root = roots[i];
      if (root instanceof HTMLElement) {
        teardown(root);
      }
    }
  });
})();
