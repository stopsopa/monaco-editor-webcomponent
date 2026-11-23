/**
 * Vanilla URL <-> state sync ("form state lives in the query string").
 *
 * Purpose: describe a set of params once (default, url key, encode, decode) and get
 *   - `onChange(params)` whenever those params change (initial load, back/forward, any pushState/replaceState),
 *   - `setParam` / `setParams` that WRITE the address bar themselves (replaceState by default).
 *
 * Usage (browser module):
 *
 *   import modURLSearchParams, { oneOf } from "./urlchange.js";
 *
 *   const { trackUrl } = modURLSearchParams(
 *     {
 *       text: { default: "", getParam: "t", encode: (v: string) => v, decode: (v: string) => v },
 *       mode: { default: "a", getParam: "m", encode: (v: string) => v, decode: oneOf(["a", "b"], "a") },
 *     },
 *     (key, i?: number) => `${key}-${i}`, // optional: one tracker instance per index -> t-1, m-1, t-2 ...
 *   );
 *
 *   const handle = trackUrl((params) => render(params), { ctx: 1, debounceMs: 250 });
 *   input.addEventListener("input", () => handle.setParam("text", input.value));
 *
 * Rules worth knowing:
 *   - A value equal to its default is removed from the URL (default elision).
 *   - Values in the URL are user input: write decoders that validate (`oneOf`) and fall back to the default.
 *     After decoding, the tracker rewrites its own keys in canonical form, so `?m=bogus` disappears from the
 *     address bar instead of disagreeing with the UI.
 *   - `debounceMs` delays only the history write (Safari allows 100 replaceState calls per 30 seconds);
 *     `onChange` and `getParams()` see the new value immediately.
 *   - `write: false` restores the old behaviour: the tracker never touches history and the caller has to
 *     commit `updatedURLSearchParams` (useful when a router owns the URL).
 *   - history.pushState/replaceState are wrapped while at least one listener is subscribed and restored
 *     when the last one unsubscribes.
 */
import {
  buildUrlWithSearchParams,
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
  /**
   * When false the tracker never writes to history: `setParam`/`setParams` only call `onChange` with the
   * would-be state and the caller commits `updatedURLSearchParams` itself. Default: true
   */
  write?: boolean;
  /**
   * Delay (ms) between `setParam`/`setParams` and the history write. `onChange` still fires immediately.
   * Use it for values that change on every keystroke / pointer move. Default: 0 (write synchronously)
   */
  debounceMs?: number;
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
  /** Write a debounced, not yet committed change to the address bar right now. */
  flush: () => void;
  /** Unsubscribe from URL changes. A debounced change that was not written yet is dropped. */
  disconnect: () => void;
  /** List of query parameter keys governed by this instance. */
  governedKeys: string[];
};

// ─── Helpers for param definitions ───────────────────────────────────────────

/**
 * Decoder for enumerated values: anything that is not in `allowed` becomes `fallback`.
 *
 *   radio: { default: "radio2", getParam: "r", encode: (v) => v, decode: oneOf(radioOptions, "radio2") }
 */
export function oneOf<T extends string>(allowed: readonly T[], fallback: T): (value: string) => T {
  return (value: string): T => ((allowed as readonly string[]).includes(value) ? (value as T) : fallback);
}

/**
 * Codec for a list of enumerated values joined with `separator`.
 * `decode("")` is `[]` (not `[""]`) and unknown items are dropped, so `decode(encode(x))` equals `x`
 * for every valid `x`. The values must not contain the separator.
 */
export function listOf<T extends string>(
  allowed: readonly T[],
  separator = ".",
): { encode: (value: T[]) => string; decode: (value: string) => T[] } {
  return {
    encode: (value: T[]) => value.join(separator),
    decode: (value: string) =>
      (value === "" ? [] : value.split(separator)).filter((item): item is T =>
        (allowed as readonly string[]).includes(item),
      ),
  };
}

// ─── History helpers ─────────────────────────────────────────────────────────

/** Callback type for URL changes. */
type UrlChangeListener = () => void;

/** Set of active listeners registered for URL/history updates. */
const urlChangeListeners = new Set<UrlChangeListener>();

/** The functions that were on `history` before we wrapped them, and our wrappers (to restore safely). */
let nativePushState: History["pushState"] | null = null;
let nativeReplaceState: History["replaceState"] | null = null;
let wrappedPushState: History["pushState"] | null = null;
let wrappedReplaceState: History["replaceState"] | null = null;

/**
 * Notifies all registered listeners that a URL change has occurred.
 * Iterates over a copy: listeners may subscribe new listeners (a new tracker created inside a listener)
 * and those must not be called in the same pass.
 */
function notifyUrlChange() {
  for (const listener of Array.from(urlChangeListeners)) {
    if (urlChangeListeners.has(listener)) listener();
  }
}

/**
 * Wraps history.pushState and history.replaceState to notify our listeners
 * of programmatic URL changes. Also listens to the window popstate event.
 */
function ensureHistoryPatched() {
  if (wrappedPushState || typeof window === "undefined") return;

  const push = history.pushState;
  const replace = history.replaceState;
  nativePushState = push;
  nativeReplaceState = replace;

  wrappedPushState = function (this: History, ...args: Parameters<History["pushState"]>) {
    push.apply(history, args);
    notifyUrlChange();
  };
  wrappedReplaceState = function (this: History, ...args: Parameters<History["replaceState"]>) {
    replace.apply(history, args);
    notifyUrlChange();
  };

  history.pushState = wrappedPushState;
  history.replaceState = wrappedReplaceState;
  window.addEventListener("popstate", notifyUrlChange);
}

/**
 * Puts the original history methods back once nobody listens any more.
 * If someone else wrapped history after us, our wrappers have to stay in the chain (they are harmless
 * without listeners) - removing them would also remove the other party's wrapper.
 */
function restoreHistoryIfUnused() {
  if (!wrappedPushState || urlChangeListeners.size > 0) return;
  if (history.pushState !== wrappedPushState || history.replaceState !== wrappedReplaceState) return;

  history.pushState = nativePushState!;
  history.replaceState = nativeReplaceState!;
  window.removeEventListener("popstate", notifyUrlChange);

  nativePushState = nativeReplaceState = wrappedPushState = wrappedReplaceState = null;
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
    restoreHistoryIfUnused();
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

  /**
   * The canonical URL form of decoded params: only governed keys, every value re-encoded,
   * values equal to their default left out.
   */
  function encodeState(params: ParamValues<C>, ctx?: Ctx): URLSearchParams {
    const result = new URLSearchParams();
    for (const [key, def] of Object.entries(config)) {
      const d = def as ParamDef<unknown>;
      const value = (params as Record<string, unknown>)[key];
      if (JSON.stringify(value) !== JSON.stringify(d.default)) {
        result.set(applyKey(d.getParam, ctx), d.encode(value));
      }
    }
    result.sort();
    return result;
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
    const write = options?.write !== false;
    const debounceMs = Math.max(0, options?.debounceMs ?? 0);

    const governedKeys = Object.values(config).map((def) => applyKey((def as ParamDef<unknown>).getParam, ctx));

    let lastSignature = "";

    /** Governed slice that `onChange` has already seen but that is not in the address bar yet (debounce). */
    let pending: URLSearchParams | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const locationSearch = () => cloneSearchParams(new URLSearchParams(window.location.search));

    /** The query string as this tracker sees it: the address bar plus its own not yet written slice. */
    const currentSearch = () =>
      pending ? syncURLSearchParams(locationSearch(), governedKeys, pending) : locationSearch();

    /** Decodes the given query string and invokes the onChange callback. */
    const emit = (search: URLSearchParams) => {
      lastSignature = trackedSignature(search, ctx);
      const { params, updatedURLSearchParams } = readState(search, ctx);
      onChange(params, updatedURLSearchParams, governedKeys);
    };

    /** Writes the pending slice to the address bar (only our keys - other keys are taken from the live URL). */
    const commit = (useReplace: boolean) => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (!pending) return;

      const slice = pending;
      pending = null;

      const current = locationSearch();
      const next = syncURLSearchParams(current, governedKeys, slice);
      if (compareNormalizedSearchParams(next, current)) return;

      // Set before writing: the write notifies every listener, including ours, and must not echo back.
      lastSignature = trackedSignature(next, ctx);

      const url = buildUrlWithSearchParams(window.location.href, next);
      if (useReplace) {
        history.replaceState(history.state, "", url);
      } else {
        history.pushState(history.state, "", url);
      }
    };

    /**
     * Reads the address bar, removes what does not survive decode -> encode (invalid values, explicit
     * defaults) from our keys, then reports the state.
     */
    const emitFromLocation = () => {
      const search = locationSearch();

      if (write) {
        const canonical = encodeState(readState(search, ctx).params, ctx);
        if (canonical.toString() !== trackedSignature(search, ctx)) {
          pending = canonical;
          commit(true); // normalisation never creates a history entry
          emit(locationSearch());
          return;
        }
      }

      emit(search);
    };

    /** Checks if the signature of the tracked parameters changed, and triggers update if so. */
    const emitIfTrackedChanged = () => {
      // Our own slice is newer than the address bar; it gets written when the debounce fires.
      if (pending) return;
      const signature = trackedSignature(window.location.search, ctx);
      if (signature === lastSignature) return;
      emitFromLocation();
    };

    /** Applies a local change: `next` is the full query string with the change already in it. */
    const applyLocalChange = (next: URLSearchParams) => {
      const slice = separateIndexedSearchParams(next, ctx);
      if (slice.toString() === trackedSignature(currentSearch(), ctx)) return;

      if (!write) {
        // caller owns the URL: report the would-be state and let it commit `updatedURLSearchParams`
        emit(next);
        return;
      }

      pending = slice;

      if (debounceMs > 0) {
        emit(next);
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(() => commit(replace), debounceMs);
      } else {
        commit(replace);
        emit(locationSearch());
      }
    };

    /** Helper to set/update a single parameter value. */
    const setParam = <K extends keyof C>(key: K, value: C[K]) => {
      const def = config[key] as ParamDef<C[K]>;
      const finalKey = applyKey(def.getParam, ctx);
      const patch = new URLSearchParams();

      if (JSON.stringify(value) !== JSON.stringify(def.default)) {
        patch.set(finalKey, def.encode(value));
      }

      applyLocalChange(syncURLSearchParams(currentSearch(), [finalKey], patch));
    };

    /** Helper to set/update multiple parameter values at once. */
    const setParams = (updates: Partial<ParamValues<C>>) => {
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

      applyLocalChange(syncURLSearchParams(currentSearch(), governed, patch));
    };

    const flush = () => commit(replace);

    if (fireOnMount) {
      emitFromLocation();
    } else {
      lastSignature = trackedSignature(window.location.search, ctx);
    }

    const unsubscribe = subscribeUrlChange(emitIfTrackedChanged);

    // Do not lose the last keystrokes when the page goes away within the debounce window.
    if (debounceMs > 0) {
      window.addEventListener("pagehide", flush);
    }

    return {
      setParam,
      setParams,
      getParams: () => readState(currentSearch(), ctx).params,
      getUpdatedURLSearchParams: () => separateIndexedSearchParams(currentSearch(), ctx),
      refresh: () => emitFromLocation(),
      flush,
      disconnect: () => {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        pending = null;
        if (debounceMs > 0) {
          window.removeEventListener("pagehide", flush);
        }
        unsubscribe();
      },
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
 * Like the React version, `setParam` / `setParams` write the URL themselves.
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
 *   (params) => { ...apply params to the UI; the URL is already written... },
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
