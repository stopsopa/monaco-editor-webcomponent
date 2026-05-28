import {
  cloneSearchParams,
  compareNormalizedSearchParams,
  mergeURLSearchParams,
  syncURLSearchParams,
} from "./toolsURLSearchParams.js";
// ─── Types ───────────────────────────────────────────────────────────────────
/** Param value types inferred from a config object's `default` fields. */
// ─── History helpers ─────────────────────────────────────────────────────────
const urlChangeListeners = /* @__PURE__ */ new Set();
let historyPatched = false;
let originalPushState = null;
let originalReplaceState = null;
function notifyUrlChange() {
  for (const listener of urlChangeListeners) {
    listener();
  }
}
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
function subscribeUrlChange(listener) {
  ensureHistoryPatched();
  urlChangeListeners.add(listener);
  return () => {
    urlChangeListeners.delete(listener);
  };
}
// ─── Core factory ────────────────────────────────────────────────────────────
function createURLParamTracker(config, keyFn) {
  const applyKey = (baseKey, ctx) => (keyFn ? keyFn(baseKey, ctx) : baseKey);
  function separateIndexedSearchParams(search, ctx) {
    const keys = Object.values(config).map((def) => applyKey(def.getParam, ctx));
    const normalized = typeof search === "string" ? new URLSearchParams(search) : search;
    return mergeURLSearchParams(new URLSearchParams(), keys, normalized);
  }
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
  function trackedSignature(search, ctx) {
    return separateIndexedSearchParams(search, ctx).toString();
  }
  function trackUrl2(onChange, options) {
    const ctx = options?.ctx;
    const replace = options?.replace !== false;
    const fireOnMount = options?.fireOnMount !== false;
    let lastSignature = "";
    const emitCurrentState = (search = window.location.search) => {
      lastSignature = trackedSignature(search, ctx);
      const { params, updatedURLSearchParams } = readState(search, ctx);
      onChange(params, updatedURLSearchParams);
    };
    const emitIfTrackedChanged = () => {
      const signature = trackedSignature(window.location.search, ctx);
      if (signature === lastSignature) return;
      emitCurrentState();
    };
    const syncAfterLocalWrite = (next) => {
      emitCurrentState(next);
    };
    const writeSearch = (next) => {
      const current = cloneSearchParams(new URLSearchParams(window.location.search));
      if (compareNormalizedSearchParams(next, current)) return;
      ensureHistoryPatched();
      const search = next.toString();
      const url = search
        ? `${window.location.pathname}?${search}${window.location.hash}`
        : `${window.location.pathname}${window.location.hash}`;
      const commit = replace ? originalReplaceState : originalPushState;
      commit.call(history, history.state, "", url);
      syncAfterLocalWrite(next);
    };
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
    const setParams = (updates) => {
      const current = cloneSearchParams(new URLSearchParams(window.location.search));
      const governed = [];
      const patch = new URLSearchParams();
      for (const [key, value] of Object.entries(updates)) {
        const def = config[key];
        if (def && value !== void 0) {
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
    };
  }
  return {
    separateIndexedSearchParams,
    trackUrl: trackUrl2,
    readState,
  };
}
/**
 * Vanilla counterpart to React `modURLSearchParams`. Define params once, then call
 * `trackUrl(onChange)` or use the standalone `trackUrl(config, onChange)` helper.
 */
function modURLSearchParams(config, keyFn) {
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
function trackUrl(config, onChange, options) {
  const { keyFn, ...trackOptions } = options ?? {};
  const tracker = createURLParamTracker(config, keyFn);
  return tracker.trackUrl(onChange, trackOptions);
}
/** Subscribe to query-string updates (history push/replace/popstate). */
function onUrlChange(listener) {
  return subscribeUrlChange(listener);
}
export {
  compareNormalizedSearchParams,
  createURLParamTracker,
  modURLSearchParams as default,
  mergeURLSearchParams,
  onUrlChange,
  trackUrl,
};
