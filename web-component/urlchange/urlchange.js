import {
  cloneSearchParams,
  compareNormalizedSearchParams,
  mergeURLSearchParams,
  syncURLSearchParams,
} from "./toolsURLSearchParams.js";
/** Set of active listeners registered for URL/history updates. */
const urlChangeListeners = new Set();
/** Flag indicating whether the window.history methods have been monkey-patched. */
let historyPatched = false;
let originalPushState = null;
let originalReplaceState = null;
/**
 * Notifies all registered listeners that a URL change has occurred.
 */
function notifyUrlChange() {
  for (const listener of urlChangeListeners) {
    listener();
  }
}
/**
 * Monkey-patches history.pushState and history.replaceState to notify our listeners
 * of programmatic URL changes. Also listens to the window popstate event.
 */
function ensureHistoryPatched() {
  if (historyPatched || typeof window === "undefined") return;
  historyPatched = true;
  originalPushState = history.pushState.bind(history);
  originalReplaceState = history.replaceState.bind(history);
  history.pushState = function (...args) {
    originalPushState(...args);
    notifyUrlChange();
  };
  history.replaceState = function (...args) {
    originalReplaceState(...args);
    notifyUrlChange();
  };
  window.addEventListener("popstate", notifyUrlChange);
}
/**
 * Subscribes a listener callback to URL change events (pushState, replaceState, popstate).
 * Returns an unsubscribe function.
 */
function subscribeUrlChange(listener) {
  ensureHistoryPatched();
  urlChangeListeners.add(listener);
  return () => {
    urlChangeListeners.delete(listener);
  };
}
// ─── Core factory ────────────────────────────────────────────────────────────
/**
 * Internal factory that creates trackers for a specific configuration of URL parameters.
 * Encapsulates the logic of reading, writing, and separating parameter sets.
 */
function createURLParamTracker(config, keyFn) {
  /** Applies optional keyFn namespace/index mapping to raw config parameter keys. */
  const applyKey = (baseKey, ctx) => (keyFn ? keyFn(baseKey, ctx) : baseKey);
  /**
   * Filters and extracts only the keys governed by this tracker configuration and optional context
   * from the provided search parameters or string.
   */
  function separateIndexedSearchParams(search, ctx) {
    const keys = Object.values(config).map((def) => applyKey(def.getParam, ctx));
    const normalized = typeof search === "string" ? new URLSearchParams(search) : search;
    return mergeURLSearchParams(new URLSearchParams(), keys, normalized);
  }
  /**
   * Reads, decodes, and parses parameter values from search parameters, falling back to defaults.
   */
  function readState(search, ctx) {
    const updatedURLSearchParams = separateIndexedSearchParams(search, ctx);
    const result = {};
    for (const [key, def] of Object.entries(config)) {
      const d = def;
      const raw = updatedURLSearchParams.get(applyKey(d.getParam, ctx));
      result[key] = raw !== null ? d.decode(raw) : d.default;
    }
    return {
      params: result,
      updatedURLSearchParams,
    };
  }
  /** Generates a normalized signature of only the tracked keys for comparison. */
  function trackedSignature(search, ctx) {
    return separateIndexedSearchParams(search, ctx).toString();
  }
  /**
   * Starts tracking the URL, invoking the onChange callback when tracked parameters change.
   * Returns a handle containing functions to read/update the state.
   */
  function trackUrl(onChange, options) {
    const ctx = options?.ctx;
    const replace = options?.replace !== false;
    const fireOnMount = options?.fireOnMount !== false;
    const governedKeys = Object.values(config).map((def) => applyKey(def.getParam, ctx));
    let lastSignature = "";
    /** Decodes the current URL parameters and invokes the onChange callback. */
    const emitCurrentState = (search = window.location.search) => {
      lastSignature = trackedSignature(search, ctx);
      const { params, updatedURLSearchParams } = readState(search, ctx);
      onChange(params, updatedURLSearchParams, governedKeys);
    };
    /** Checks if the signature of the tracked parameters changed, and triggers update if so. */
    const emitIfTrackedChanged = () => {
      const signature = trackedSignature(window.location.search, ctx);
      if (signature === lastSignature) return;
      emitCurrentState();
    };
    /** Syncs internal state signature and calls onChange callback after writing updates. */
    const syncAfterLocalWrite = (next) => {
      emitCurrentState(next);
    };
    /** Commits the new URLSearchParams using standard history methods. */
    const writeSearch = (next) => {
      const current = cloneSearchParams(new URLSearchParams(window.location.search));
      if (compareNormalizedSearchParams(next, current)) return;
      syncAfterLocalWrite(next);
    };
    /** Helper to set/update a single parameter value. */
    const setParam = (key, value) => {
      const def = config[key];
      const finalKey = applyKey(def.getParam, ctx);
      const current = cloneSearchParams(new URLSearchParams(window.location.search));
      const patch = new URLSearchParams();
      if (JSON.stringify(value) !== JSON.stringify(def.default)) {
        patch.set(finalKey, def.encode(value));
      }
      writeSearch(syncURLSearchParams(current, [finalKey], patch));
    };
    /** Helper to set/update multiple parameter values at once. */
    const setParams = (updates) => {
      const current = cloneSearchParams(new URLSearchParams(window.location.search));
      const governed = [];
      const patch = new URLSearchParams();
      for (const [key, value] of Object.entries(updates)) {
        const def = config[key];
        if (def && value !== undefined) {
          const finalKey = applyKey(def.getParam, ctx);
          governed.push(finalKey);
          if (JSON.stringify(value) !== JSON.stringify(def.default)) {
            patch.set(finalKey, def.encode(value));
          }
        }
      }
      writeSearch(syncURLSearchParams(current, governed, patch));
    };
    if (fireOnMount) {
      emitCurrentState();
    } else {
      lastSignature = trackedSignature(window.location.search, ctx);
    }
    const unsubscribe = subscribeUrlChange(emitIfTrackedChanged);
    return {
      setParam,
      setParams,
      getParams: () => readState(window.location.search, ctx).params,
      getUpdatedURLSearchParams: () => separateIndexedSearchParams(window.location.search, ctx),
      refresh: () => emitCurrentState(),
      disconnect: unsubscribe,
      governedKeys,
    };
  }
  return {
    separateIndexedSearchParams,
    trackUrl,
    readState,
  };
}
/**
 * Vanilla counterpart to React `modURLSearchParams`. Define params once, then call
 * `trackUrl(onChange)` or use the standalone `trackUrl(config, onChange)` helper.
 */
export default function modURLSearchParams(config, keyFn) {
  return createURLParamTracker(config, keyFn);
}
/**
 * Subscribe to URL changes for a fixed param schema. The callback runs only when
 * tracked keys (per config) change — other query/hash navigation is ignored.
 *
 * @example
 * const { setParam, setParams } = trackUrl(
 *   {
 *     emptyList: { default: false, getParam: "emp", encode: (v) => (v ? "1" : "0"), decode: (v) => v === "1" },
 *   },
 *   (params, updatedURLSearchParams) => { ... },
 * );
 */
export function trackUrl(config, onChange, options) {
  const { keyFn, ...trackOptions } = options ?? {};
  const tracker = createURLParamTracker(config, keyFn);
  return tracker.trackUrl(onChange, trackOptions);
}
/** Subscribe to query-string updates (history push/replace/popstate). */
export function onUrlChange(listener) {
  return subscribeUrlChange(listener);
}
export { mergeURLSearchParams, createURLParamTracker, compareNormalizedSearchParams };
