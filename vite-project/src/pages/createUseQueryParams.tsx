import { useState, useEffect, useMemo } from "react";

// ---- Type Utilities ----

// The LOOSER input-facing version of ParamValue.
// decode returns `unknown` instead of `T` — this is the key trick:
//
// When TypeScript infers T from an object literal, it looks at ALL fields
// that mention T. If decode returns `any` (e.g. JSON.parse), `any` poisons
// the inference and T becomes `any` too.
//
// By typing decode's return as `unknown`, we opt that field OUT of inference.
// TypeScript will then infer T solely from `default`, which is what we want.
//
// Search terms: "TypeScript generic inference", "inference site", "unknown vs any"
type ParamValueInput<T> = {
  default: T;
  encode: (value: T) => string;
  decode: (value: string) => unknown; // excluded from T inference intentionally
};

// Index signature for the config object passed to createUseQueryParams.
// `unknown` as the type argument means "each entry is a ParamValueInput
// of some T, we don't know which yet" — this is the correct upper bound
// for a heterogeneous map where each key has a different T.
//
// Using `any` here instead would disable type checking downstream.
// Search terms: "TypeScript index signature", "unknown vs any upper bound"
type ParamConfigInput = {
  [key: string]: ParamValueInput<any>;
};

// Mapped type that walks over the config C and extracts the T
// from each ParamValueInput<T> entry using `infer`.
//
// `infer T` inside a conditional type tells TypeScript:
// "if this extends ParamValueInput<T>, capture what T is".
// Because ParamValueInput.decode returns `unknown` (not `any`),
// infer picks up T cleanly from `default` only.
//
// Search terms: "TypeScript mapped types", "conditional types infer",
// "distributive conditional types", "TypeScript keyof"
type InferParamTypes<C extends ParamConfigInput> = {
  [K in keyof C]: C[K] extends ParamValueInput<infer T> ? T : never;
};

// Alias — the shape of the `params` object returned by the hook.
// Each key maps to its decoded value type as inferred above.
type ParamValues<C extends ParamConfigInput> = InferParamTypes<C>;

// diff only contains keys whose current value differs from default.
// Partial because a key is absent when its value equals the default.
// Search terms: "TypeScript Partial utility type"
type ParamDiff<C extends ParamConfigInput> = Partial<InferParamTypes<C>>;

// Generic function type for setParam.
// The per-call generic <K extends keyof C> is the critical detail:
// it makes each CALL site bind K to the specific key passed,
// so TypeScript can look up InferParamTypes<C>[K] and enforce
// that the value matches that specific key's type.
//
// Without the per-call generic, value would have to be a union
// of all possible types, losing per-key safety.
//
// Search terms: "TypeScript generic function type", "per-call generic",
// "correlated union types", "indexed access types"
type SetParam<C extends ParamConfigInput> = <K extends keyof C>(
  key: K,
  value?: InferParamTypes<C>[K] | null,
) => URLSearchParams;

// Partial mapped type for setParams — allows updating any subset of keys
// while still enforcing that each value matches its key's type.
// Search terms: "TypeScript Partial utility type", "mapped type modifiers"
type SetParams<C extends ParamConfigInput> = (
  updates: Partial<{ [K in keyof C]: InferParamTypes<C>[K] | null | undefined }>,
) => URLSearchParams;

// The hook no longer owns URL writes — it exposes:
// - params:    all current values (decoded from URL or defaulted)
// - diff:      only keys that differ from their default (useful for building
//              a URLSearchParams to push externally)
// - setParam:  returns a new URLSearchParams with a single key updated and triggers rerender
// - setParams: returns a new URLSearchParams with multiple keys updated and triggers rerender
// - updatedURLSearchParams: the internal state URLSearchParams
type UseQueryParamsReturn<C extends ParamConfigInput> = {
  params: ParamValues<C>;
  diff: ParamDiff<C>;
  setParam: SetParam<C>;
  setParams: SetParams<C>;
  updatedURLSearchParams: URLSearchParams;
};

// ---- extractSearchParams ----
//
// Accepts any of the following URL-like strings and returns a URLSearchParams:
//   - Full URL:       "http://example.com/path?foo=bar#hash"
//   - Absolute path:  "/path?foo=bar#hash"
//   - Query only:     "?foo=bar"
//   - Bare pairs:     "foo=bar&baz=qux"
//
// Strategy: strip the hash first, then try URL parsing, then path parsing,
// then fall back to treating the whole string as a raw query string.
//
// Search terms: "URL parsing JavaScript", "URLSearchParams constructor",
// "robust query string parsing"
function extractSearchParams(input: string | URLSearchParams): URLSearchParams {
  if (input instanceof URLSearchParams) {
    return new URLSearchParams(input);
  }

  // Strip fragment — everything from # onwards is irrelevant for query params
  const withoutHash = input.split("#")[0];

  // Try full URL (http://... or https://...)
  try {
    const url = new URL(withoutHash);
    return url.searchParams;
  } catch {
    // Not a full URL, fall through
  }

  // Try absolute or relative path (/path?foo=bar or path?foo=bar)
  // Attach a dummy base so URL() can parse it
  try {
    const url = new URL(withoutHash, "http://localhost");
    return url.searchParams;
  } catch {
    // Not a path-like string, fall through
  }

  // Try bare query string: strip leading "?" if present and parse directly.
  // URLSearchParams handles "foo=bar&baz=qux" and "?foo=bar&baz=qux" equally.
  return new URLSearchParams(withoutHash.replace(/^\?/, ""));
}

// ---- createUseQueryParams ----

// A "hook factory" — a function that returns a hook.
// This pattern lets you bake config into a hook at definition time
// rather than passing it as an argument at call time, which is
// important for React hooks (hook identity must be stable).
//
// C is inferred from the config argument, capturing the full
// literal shape of the object (keys and their T types).
//
// Search terms: "TypeScript factory pattern", "higher order functions TypeScript",
// "React hook factory", "closing over generic type"
export function createUseQueryParams<C extends ParamConfigInput>(config: C) {
  return function useQueryParams(urlInput: string | URLSearchParams): UseQueryParamsReturn<C> {
    // Parse the caller-supplied URL string into URLSearchParams.
    // The hook is decoupled from any router — the caller decides what
    // to pass (location.href, location.search, a raw string, etc).
    // Search terms: "dependency injection React hooks", "decoupled hook design"
    const initialSearchParams = useMemo(() => extractSearchParams(urlInput), [urlInput]);

    const [updatedURLSearchParams, setUpdatedURLSearchParams] = useState<URLSearchParams>(initialSearchParams);

    useEffect(() => {
      setUpdatedURLSearchParams(extractSearchParams(urlInput));
    }, [urlInput]);

    const params = {} as ParamValues<C>;
    const diff = {} as ParamDiff<C>;

    const getDecoded = <K extends keyof C>(k: K, raw: string): InferParamTypes<C>[K] =>
      config[k].decode(raw) as InferParamTypes<C>[K];

    const getDefault = <K extends keyof C>(k: K): InferParamTypes<C>[K] => config[k].default as InferParamTypes<C>[K];

    for (const key in config) {
      const raw = updatedURLSearchParams.get(key);
      const val = raw !== null ? getDecoded(key, raw) : getDefault(key);
      params[key] = val;

      const isDefault = JSON.stringify(val) === JSON.stringify(config[key].default);
      if (!isDefault) {
        (diff as Record<string, unknown>)[key] = val;
      }
    }

    // setParam creates and returns a new URLSearchParams with the single key updated.
    // Null/undefined resets the key to its default value (deletes from URL).
    const setParam: SetParam<C> = (key, value) => {
      const next = new URLSearchParams(updatedURLSearchParams);
      if (value === null || value === undefined) {
        next.delete(key as string);
      } else {
        const isDefault = JSON.stringify(value) === JSON.stringify(config[key as string].default);
        if (isDefault) {
          next.delete(key as string);
        } else {
          next.set(key as string, config[key as string].encode(value));
        }
      }
      setUpdatedURLSearchParams(next);
      return next;
    };

    // setParams creates and returns a new URLSearchParams with multiple keys updated.
    const setParams: SetParams<C> = (updates) => {
      const next = new URLSearchParams(updatedURLSearchParams);
      for (const key in updates) {
        const value = updates[key];
        if (value === null || value === undefined) {
          next.delete(key);
        } else {
          const isDefault = JSON.stringify(value) === JSON.stringify(config[key].default);
          if (isDefault) {
            next.delete(key);
          } else {
            next.set(key, config[key].encode(value));
          }
        }
      }
      setUpdatedURLSearchParams(next);
      return next;
    };

    return { params, diff, setParam, setParams, updatedURLSearchParams };
  };
}
