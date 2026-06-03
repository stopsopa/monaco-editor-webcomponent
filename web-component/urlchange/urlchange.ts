import {
  cloneSearchParams,
  compareNormalizedSearchParams,
  mergeURLSearchParams,
  syncURLSearchParams,
} from "./toolsURLSearchParams.js";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Definition for a single URL parameter.
 * Used to specify the default value, the query string key, and functions to encode/decode the value.
 */
export type ParamDef<T> = {
  /** The default value used when the parameter is not present in the URL. */
  default: T;
  /** The actual query parameter key in the URL (e.g. "t" for text). */
  getParam: string;
  /** Function to serialize the value of type T to a string for the URL. */
  encode: (value: T) => string;
  /** Function to parse the parameter string from the URL back to type T. */
  decode: (value: string) => T;
};

type ParamValues<C> = C;

/**
 * Param value types inferred from a config object's `default` fields.
 * Extracts the types of default values to create a strongly-typed parameter object.
 */
export type InferParamsFromConfig<T extends Record<string, { default: unknown }>> = {
  [K in keyof T]: T[K]["default"];
};

/**
 * Options for tracking the URL.
 */
export type TrackUrlOptions<Ctx = unknown> = {
  /** Optional function to customize or namespace the URL key depending on a context/index. */
  keyFn?: (key: string, ctx?: Ctx) => string;
  /** Optional context value (like an index or ID) passed to keyFn. */
  ctx?: Ctx;
  /** When false, use history.pushState instead of replaceState. Default: true */
  replace?: boolean;
  /** When false, skip the initial onChange call. Default: true */
  fireOnMount?: boolean;
};

/**
 * Handle returned by `trackUrl` for managing URL parameters of a component instance.
 */
export type TrackUrlHandle<C extends Record<string, unknown>> = {
  /** Update a single parameter value. */
  setParam: <K extends keyof C>(key: K, value: C[K]) => void;
  /** Update multiple parameter values at once. */
  setParams: (updates: Partial<ParamValues<C>>) => void;
  /** Get the current decoded parameter values. */
  getParams: () => ParamValues<C>;
  /** Get the current updated URLSearchParams representing only governed keys. */
  getUpdatedURLSearchParams: () => URLSearchParams;
  /** Re-read the URL and invoke onChange (same as the initial mount sync). */
  refresh: () => void;
  /** Unsubscribe from URL changes. */
  disconnect: () => void;
  /** List of query parameter keys governed by this instance. */
  governedKeys: string[];
};

// ─── History helpers ─────────────────────────────────────────────────────────

/** Callback type for URL changes. */
type UrlChangeListener = () => void;

/** Set of active listeners registered for URL/history updates. */
const urlChangeListeners = new Set<UrlChangeListener>();

/** Flag indicating whether the window.history methods have been monkey-patched. */
let historyPatched = false;
let originalPushState: History["pushState"] | null = null;
let originalReplaceState: History["replaceState"] | null = null;

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
    originalPushState!(...args);
    notifyUrlChange();
  };
  history.replaceState = function (...args) {
    originalReplaceState!(...args);
    notifyUrlChange();
  };
  window.addEventListener("popstate", notifyUrlChange);
}

/**
 * Subscribes a listener callback to URL change events (pushState, replaceState, popstate).
 * Returns an unsubscribe function.
 */
function subscribeUrlChange(listener: UrlChangeListener): () => void {
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
function createURLParamTracker<C extends Record<string, unknown>, Ctx = unknown>(
  config: { [K in keyof C]: ParamDef<C[K]> },
  keyFn?: (key: string, ctx?: Ctx) => string,
) {
  /** Applies optional keyFn namespace/index mapping to raw config parameter keys. */
  const applyKey = (baseKey: string, ctx?: Ctx) => (keyFn ? keyFn(baseKey, ctx) : baseKey);

  /**
   * Filters and extracts only the keys governed by this tracker configuration and optional context
   * from the provided search parameters or string.
   */
  function separateIndexedSearchParams(search: string | URLSearchParams, ctx?: Ctx): URLSearchParams {
    const keys = Object.values(config).map((def) => applyKey((def as ParamDef<unknown>).getParam, ctx));
    const normalized = typeof search === "string" ? new URLSearchParams(search) : search;
    return mergeURLSearchParams(new URLSearchParams(), keys, normalized);
  }

  /**
   * Reads, decodes, and parses parameter values from search parameters, falling back to defaults.
   */
  function readState(search: string | URLSearchParams, ctx?: Ctx) {
    const updatedURLSearchParams = separateIndexedSearchParams(search, ctx);
    const result: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(config)) {
      const d = def as ParamDef<unknown>;
      const raw = updatedURLSearchParams.get(applyKey(d.getParam, ctx));
      result[key] = raw !== null ? d.decode(raw) : d.default;
    }
    return {
      params: result as ParamValues<C>,
      updatedURLSearchParams,
    };
  }

  /** Generates a normalized signature of only the tracked keys for comparison. */
  function trackedSignature(search: string | URLSearchParams, ctx?: Ctx): string {
    return separateIndexedSearchParams(search, ctx).toString();
  }

  /**
   * Starts tracking the URL, invoking the onChange callback when tracked parameters change.
   * Returns a handle containing functions to read/update the state.
   */
  function trackUrl(
    onChange: (params: ParamValues<C>, updatedURLSearchParams: URLSearchParams, governedKeys: string[]) => void,
    options?: TrackUrlOptions<Ctx>,
  ): TrackUrlHandle<C> {
    const ctx = options?.ctx;
    const replace = options?.replace !== false;
    const fireOnMount = options?.fireOnMount !== false;

    const governedKeys = Object.values(config).map((def) => applyKey((def as ParamDef<unknown>).getParam, ctx));

    let lastSignature = "";

    /** Decodes the current URL parameters and invokes the onChange callback. */
    const emitCurrentState = (search: string | URLSearchParams = window.location.search) => {
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
    const syncAfterLocalWrite = (next: URLSearchParams) => {
      emitCurrentState(next);
    };

    /** Commits the new URLSearchParams using standard history methods. */
    const writeSearch = (next: URLSearchParams) => {
      const current = cloneSearchParams(new URLSearchParams(window.location.search));
      if (compareNormalizedSearchParams(next, current)) return;

      syncAfterLocalWrite(next);
    };

    /** Helper to set/update a single parameter value. */
    const setParam = <K extends keyof C>(key: K, value: C[K]) => {
      const def = config[key] as ParamDef<C[K]>;
      const finalKey = applyKey(def.getParam, ctx);
      const current = cloneSearchParams(new URLSearchParams(window.location.search));
      const patch = new URLSearchParams();

      if (JSON.stringify(value) !== JSON.stringify(def.default)) {
        patch.set(finalKey, def.encode(value));
      }

      writeSearch(syncURLSearchParams(current, [finalKey], patch));
    };

    /** Helper to set/update multiple parameter values at once. */
    const setParams = (updates: Partial<ParamValues<C>>) => {
      const current = cloneSearchParams(new URLSearchParams(window.location.search));
      const governed: string[] = [];
      const patch = new URLSearchParams();

      for (const [key, value] of Object.entries(updates)) {
        const def = config[key as keyof C] as ParamDef<unknown> | undefined;
        if (def && value !== undefined) {
          const finalKey = applyKey(def.getParam, ctx);
          governed.push(finalKey);
          if (JSON.stringify(value) !== JSON.stringify(def.default)) {
            patch.set(finalKey, def.encode(value as never));
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
export default function modURLSearchParams<C extends Record<string, unknown>, Ctx = unknown>(
  config: { [K in keyof C]: ParamDef<C[K]> },
  keyFn?: (key: string, ctx?: Ctx) => string,
) {
  return createURLParamTracker<C, Ctx>(config, keyFn);
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
export function trackUrl<C extends Record<string, unknown>, Ctx = unknown>(
  config: { [K in keyof C]: ParamDef<C[K]> },
  onChange: (params: ParamValues<C>, updatedURLSearchParams: URLSearchParams, governedKeys: string[]) => void,
  options?: TrackUrlOptions<Ctx> & { keyFn?: (key: string, ctx?: Ctx) => string },
): TrackUrlHandle<C> {
  const { keyFn, ...trackOptions } = options ?? {};
  const tracker = createURLParamTracker<C, Ctx>(config, keyFn);
  return tracker.trackUrl(onChange, trackOptions);
}

/** Subscribe to query-string updates (history push/replace/popstate). */
export function onUrlChange(listener: UrlChangeListener): () => void {
  return subscribeUrlChange(listener);
}

export { mergeURLSearchParams, createURLParamTracker, compareNormalizedSearchParams };
