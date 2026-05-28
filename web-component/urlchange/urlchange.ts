import {
  cloneSearchParams,
  compareNormalizedSearchParams,
  mergeURLSearchParams,
  syncURLSearchParams,
} from "./toolsURLSearchParams.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ParamDef<T> = {
  default: T;
  getParam: string;
  encode: (value: T) => string;
  decode: (value: string) => T;
};

type ParamValues<C> = C;

/** Param value types inferred from a config object's `default` fields. */
export type InferParamsFromConfig<T extends Record<string, { default: unknown }>> = {
  [K in keyof T]: T[K]["default"];
};

export type TrackUrlOptions<Ctx = unknown> = {
  keyFn?: (key: string, ctx?: Ctx) => string;
  ctx?: Ctx;
  /** When false, use history.pushState instead of replaceState. Default: true */
  replace?: boolean;
  /** When false, skip the initial onChange call. Default: true */
  fireOnMount?: boolean;
};

export type TrackUrlHandle<C extends Record<string, unknown>> = {
  setParam: <K extends keyof C>(key: K, value: C[K]) => void;
  setParams: (updates: Partial<ParamValues<C>>) => void;
  getParams: () => ParamValues<C>;
  getUpdatedURLSearchParams: () => URLSearchParams;
  /** Re-read URL and invoke onChange (same as the initial mount sync). */
  refresh: () => void;
  disconnect: () => void;
};

// ─── History helpers ─────────────────────────────────────────────────────────

type UrlChangeListener = () => void;
const urlChangeListeners = new Set<UrlChangeListener>();
let historyPatched = false;
let originalPushState: History["pushState"] | null = null;
let originalReplaceState: History["replaceState"] | null = null;

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
    originalPushState!(...args);
    notifyUrlChange();
  };
  history.replaceState = function (...args) {
    originalReplaceState!(...args);
    notifyUrlChange();
  };
  window.addEventListener("popstate", notifyUrlChange);
}

function subscribeUrlChange(listener: UrlChangeListener): () => void {
  ensureHistoryPatched();
  urlChangeListeners.add(listener);
  return () => {
    urlChangeListeners.delete(listener);
  };
}

// ─── Core factory ────────────────────────────────────────────────────────────

function createURLParamTracker<C extends Record<string, unknown>, Ctx = unknown>(
  config: { [K in keyof C]: ParamDef<C[K]> },
  keyFn?: (key: string, ctx?: Ctx) => string,
) {
  const applyKey = (baseKey: string, ctx?: Ctx) => (keyFn ? keyFn(baseKey, ctx) : baseKey);

  function separateIndexedSearchParams(search: string | URLSearchParams, ctx?: Ctx): URLSearchParams {
    const keys = Object.values(config).map((def) => applyKey((def as ParamDef<unknown>).getParam, ctx));
    const normalized = typeof search === "string" ? new URLSearchParams(search) : search;
    return mergeURLSearchParams(new URLSearchParams(), keys, normalized);
  }

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

  function trackedSignature(search: string | URLSearchParams, ctx?: Ctx): string {
    return separateIndexedSearchParams(search, ctx).toString();
  }

  function trackUrl(
    onChange: (params: ParamValues<C>, updatedURLSearchParams: URLSearchParams) => void,
    options?: TrackUrlOptions<Ctx>,
  ): TrackUrlHandle<C> {
    const ctx = options?.ctx;
    const replace = options?.replace !== false;
    const fireOnMount = options?.fireOnMount !== false;

    let lastSignature = "";

    const emitCurrentState = (search: string | URLSearchParams = window.location.search) => {
      lastSignature = trackedSignature(search, ctx);
      const { params, updatedURLSearchParams } = readState(search, ctx);
      onChange(params, updatedURLSearchParams);
    };

    const emitIfTrackedChanged = () => {
      const signature = trackedSignature(window.location.search, ctx);
      if (signature === lastSignature) return;
      emitCurrentState();
    };

    const syncAfterLocalWrite = (next: URLSearchParams) => {
      emitCurrentState(next);
    };

    const writeSearch = (next: URLSearchParams) => {
      const current = cloneSearchParams(new URLSearchParams(window.location.search));
      if (compareNormalizedSearchParams(next, current)) return;

      ensureHistoryPatched();
      const search = next.toString();
      const url = search
        ? `${window.location.pathname}?${search}${window.location.hash}`
        : `${window.location.pathname}${window.location.hash}`;
      const commit = replace ? originalReplaceState! : originalPushState!;
      commit.call(history, history.state, "", url);
      syncAfterLocalWrite(next);
    };

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
  onChange: (params: ParamValues<C>, updatedURLSearchParams: URLSearchParams) => void,
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
