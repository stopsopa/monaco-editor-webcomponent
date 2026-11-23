/**
 * Which "instances" of an indexed form/demo exist, stored in the query string.
 *
 * Purpose: pages that render N copies of the same component keep each copy's params under suffixed keys
 * (`t-1`, `r-1`, `t-2`, …). The list of copies cannot be derived from those keys alone, because a param
 * equal to its default is removed from the URL - an instance with only default values would vanish.
 * So the list lives in its own key: `ids=1,2,3`.
 *
 * Used by the vanilla demo (web-component/urlchange/index.ts) and the React demos
 * (vite-project/src/pages/MonacoDiffDemoPage.tsx). Pure functions, no DOM access.
 *
 *   const ids = parseInstanceIds(new URLSearchParams(location.search));   // [1, 3]
 *   const next = withInstanceIds(new URLSearchParams(location.search), [...ids, nextInstanceId(ids)]);
 */

/** Parent-only key: lists instance indexes without writing default-valued tracked params. */
export const INSTANCE_IDS_KEY = "ids";

/**
 * Collects all instance indexes present in the query string.
 * Uses the `ids=1,2` list plus any key ending in `-{n}` (e.g. `t-3` from a hand-written deep link).
 */
export function parseInstanceIds(params: URLSearchParams): number[] {
  const indexes = new Set<number>();

  const raw = params.get(INSTANCE_IDS_KEY);
  if (raw) {
    for (const part of raw.split(",")) {
      if (/^\d+$/.test(part.trim())) indexes.add(parseInt(part.trim(), 10));
    }
  }

  params.forEach((_, key) => {
    if (key === INSTANCE_IDS_KEY) return;
    const match = key.match(/-(\d+)$/);
    if (match) indexes.add(parseInt(match[1], 10));
  });

  return Array.from(indexes).sort((a, b) => a - b);
}

/** Next free index: one above the highest existing one, starting at 1. */
export function nextInstanceId(ids: number[]): number {
  return ids.length > 0 ? Math.max(...ids) + 1 : 1;
}

/**
 * Returns a patch for `ids` only. Apply with `syncURLSearchParams` so an empty list removes the key.
 */
export function instanceIdsPatch(ids: number[]): URLSearchParams {
  const patch = new URLSearchParams();
  if (ids.length > 0) {
    patch.set(INSTANCE_IDS_KEY, ids.join(","));
  }
  return patch;
}

/** Copy of `params` with `ids` replaced by the given list (key removed when the list is empty). */
export function withInstanceIds(params: URLSearchParams, ids: number[]): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(INSTANCE_IDS_KEY);
  if (ids.length > 0) {
    next.set(INSTANCE_IDS_KEY, ids.join(","));
  }
  return next;
}

/** True when `ids` in the query string lists exactly the given instances. */
export function hasExplicitInstanceIds(params: URLSearchParams, ids: number[]): boolean {
  return (params.get(INSTANCE_IDS_KEY) ?? "") === ids.join(",");
}
