class ThemePerformance {
  /**
   * @param {string} metricPrefix
   */
  constructor(metricPrefix) {
    this.metricPrefix = metricPrefix;
  }

  /**
   * @param {string} benchmarkName
   * @returns {PerformanceMark}
   */
  createStartingMarker(benchmarkName) {
    const metricName = `${this.metricPrefix}:${benchmarkName}`;
    return performance.mark(`${metricName}:start`);
  }

  /**
   * @param {string} benchmarkName
   * @param {Event} event
   * @returns {void}
   */
  measureFromEvent(benchmarkName, event) {
    const metricName = `${this.metricPrefix}:${benchmarkName}`;
    performance.mark(`${metricName}:start`, {
      startTime: event.timeStamp,
    });

    performance.mark(`${metricName}:end`);

    performance.measure(metricName, `${metricName}:start`, `${metricName}:end`);
  }

  /**
   * @param {PerformanceMark} startMarker
   * @returns {void}
   */
  measureFromMarker(startMarker) {
    const metricName = startMarker.name.replace(/:start$/, '');
    const endMarker = performance.mark(`${metricName}:end`);

    performance.measure(metricName, startMarker.name, endMarker.name);
  }

  /**
   * @param {string} benchmarkName
   * @param {Function} callback
   * @returns {void}
   */
  measure(benchmarkName, callback) {
    const metricName = `${this.metricPrefix}:${benchmarkName}`;
    performance.mark(`${metricName}:start`);

    callback();

    performance.mark(`${metricName}:end`);

    performance.measure(benchmarkName, `${metricName}:start`, `${metricName}:end`);
  }
}

export const cartPerformance = new ThemePerformance('cart-performance');

const PERF_DEBUG_SCOPE_PREFIX = '[theme-perf]';
const registeredDebugListeners = new WeakMap();
let hasObservedLongTasks = false;

export function shouldLogPerfDebug() {
  if (typeof window === 'undefined') return false;

  try {
    return (
      window.__HORIZON_PERF_DEBUG__ === true ||
      new URLSearchParams(window.location.search).get('perf_debug') === 'true'
    );
  } catch (error) {
    return window.__HORIZON_PERF_DEBUG__ === true;
  }
}

export function observeLongTasks(scope = 'theme') {
  if (!shouldLogPerfDebug() || hasObservedLongTasks || typeof PerformanceObserver === 'undefined') {
    return;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration <= 50) continue;
        console.warn(`${PERF_DEBUG_SCOPE_PREFIX}[${scope}] long task`, {
          name: entry.name || 'longtask',
          duration: Math.round(entry.duration),
          startTime: Math.round(entry.startTime),
        });
      }
    });

    observer.observe({ type: 'longtask', buffered: true });
    hasObservedLongTasks = true;
  } catch (error) {
    console.warn(`${PERF_DEBUG_SCOPE_PREFIX}[${scope}] failed to observe long tasks`, error);
  }
}

export function logLongTask(scope, label, startTime, extra = undefined) {
  if (!shouldLogPerfDebug() || typeof performance === 'undefined') {
    return;
  }

  const duration = performance.now() - startTime;
  if (duration <= 50) {
    return;
  }

  console.warn(`${PERF_DEBUG_SCOPE_PREFIX}[${scope}] ${label}`, {
    duration: Math.round(duration),
    ...(extra && typeof extra === 'object' ? extra : {}),
  });
}

export function registerDebugListener(target, scope, key) {
  if (!shouldLogPerfDebug() || !target) {
    return false;
  }

  let registrations = registeredDebugListeners.get(target);
  if (!registrations) {
    registrations = new Set();
    registeredDebugListeners.set(target, registrations);
  }

  if (registrations.has(key)) {
    console.warn(`${PERF_DEBUG_SCOPE_PREFIX}[${scope}] duplicate listener registration`, { key, target });
    return true;
  }

  registrations.add(key);
  return false;
}

export function unregisterDebugListener(target, key) {
  if (!target) {
    return;
  }

  const registrations = registeredDebugListeners.get(target);
  if (!registrations) {
    return;
  }

  registrations.delete(key);
  if (!registrations.size) {
    registeredDebugListeners.delete(target);
  }
}
