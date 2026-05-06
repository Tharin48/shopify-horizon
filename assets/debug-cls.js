/**
 * Dev-only cumulative layout shift logger.
 * Enable with ?debug_cls=true on any storefront URL.
 */

/**
 * @typedef {object} DebugClsLayoutShiftEntry
 * @property {boolean} hadRecentInput
 * @property {number} value
 * @property {number} startTime
 * @property {Array<{ node?: Node, currentRect?: DOMRectReadOnly, previousRect?: DOMRectReadOnly }>} [sources]
 */

(function () {
  'use strict';

  if (!('PerformanceObserver' in window)) {
    console.warn('[debug_cls] PerformanceObserver not supported');
    return;
  }

  try {
    var po = new PerformanceObserver(function (list) {
      var entries = list.getEntries();
      for (var i = 0; i < entries.length; i++) {
        var entry = /** @type {DebugClsLayoutShiftEntry} */ (/** @type {unknown} */ (entries[i]));
        if (!entry || entry.hadRecentInput) continue;
        if (entry.value < 0.0001) continue;

        console.groupCollapsed(
          '[debug_cls] shift ' + entry.value.toFixed(4) + ' @' + Math.round(entry.startTime) + 'ms'
        );
        console.log('value', entry.value);
        if (entry.sources && entry.sources.length) {
          for (var j = 0; j < entry.sources.length; j++) {
            var src = entry.sources[j];
            var node = src && src.node;
            var preview = '';
            try {
              var el = node instanceof Element ? node : null;
              if (el && el.outerHTML) {
                preview = el.outerHTML.replace(/\s+/g, ' ').trim().slice(0, 240);
              }
            } catch (e) {
              preview = '(unserializable node)';
            }
            console.log('source', j, { node: node, currentRect: src && src.currentRect, previousRect: src && src.previousRect });
            if (preview) console.log('html', preview);
          }
        } else {
          console.log('sources', '(none — often font or global repaint)');
        }
        console.groupEnd();
      }
    });
    po.observe({ type: 'layout-shift', buffered: true });
    console.info('[debug_cls] observer active — filter console for [debug_cls]');
  } catch (e) {
    console.warn('[debug_cls] failed to observe layout-shift', e);
  }
})();
