import { useCallback } from "react";

/**
 * A value that can safely exist in query params.
 */
type QueryPrimitive = string | number | boolean | null | undefined;

/**
 * Supported query object shape.
 *
 * Allows:
 * - primitives
 * - arrays
 * - nested objects
 */
export type QueryValue = QueryPrimitive | QueryPrimitive[] | QueryObject | QueryObject[];

export interface QueryObject {
  [key: string]: QueryValue;
}

/**
 * Native URL wrapper passed to your callback.
 *
 * Uses URLSearchParams internally because it's the most native
 * browser API for query param manipulation.
 */
export interface QueryUrlObject {
  get: (key: string) => string | null;
  set: (key: string, value: string) => QueryUrlObject;
  append: (key: string, value: string) => QueryUrlObject;
  remove: (key: string) => QueryUrlObject;
  has: (key: string) => boolean;
  raw: URLSearchParams;
}

/**
 * Callback allowing custom serialization logic.
 */
export type QueryApplyHandler = (key: string, value: unknown, urlObject: QueryUrlObject) => void;

/**
 * Creates a small wrapper around URLSearchParams.
 *
 * We return chainable methods so your callback can do:
 *
 * urlObject.remove(key).set(key, 'value')
 */
function createUrlObject(searchParams: URLSearchParams): QueryUrlObject {
  return {
    raw: searchParams,

    get(key) {
      return searchParams.get(key);
    },

    set(key, value) {
      searchParams.set(key, value);
      return this;
    },

    append(key, value) {
      searchParams.append(key, value);
      return this;
    },

    remove(key) {
      searchParams.delete(key);
      return this;
    },

    has(key) {
      return searchParams.has(key);
    },
  };
}

/**
 * Recursively flattens an object into dot notation.
 *
 * Example:
 * {
 *   user: {
 *     name: 'john'
 *   }
 * }
 *
 * becomes:
 *
 * user.name = john
 */
function flattenObject(obj: QueryObject, prefix = ""): Array<[string, unknown]> {
  const entries: Array<[string, unknown]> = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    // Ignore completely missing keys
    if (typeof value === "undefined") {
      entries.push([fullKey, undefined]);
      continue;
    }

    // Arrays are handled as-is
    if (Array.isArray(value)) {
      entries.push([fullKey, value]);
      continue;
    }

    // Nested object
    if (value !== null && typeof value === "object") {
      entries.push(...flattenObject(value as QueryObject, fullKey));
      continue;
    }

    entries.push([fullKey, value]);
  }

  return entries;
}

/**
 * Core function.
 *
 * Updates ONLY keys present in `queryObject`.
 * Keeps all other existing URL params untouched.
 */
export function queryApply<T extends QueryObject>(url: string, queryObject: T, handler?: QueryApplyHandler): string {
  // Native browser URL API
  const urlInstance = new URL(url);

  // Native query params API
  const searchParams = new URLSearchParams(urlInstance.search);

  // Small helper wrapper
  const urlObject = createUrlObject(searchParams);

  // Flatten nested objects
  const entries = flattenObject(queryObject);

  for (const [key, value] of entries) {
    /**
     * If custom handler exists,
     * user fully controls behavior.
     */
    if (handler) {
      handler(key, value, urlObject);
      continue;
    }

    /**
     * Default behavior:
     *
     * undefined/null -> remove param
     * array -> join with comma
     * primitive -> String(value)
     */
    if (value === undefined || value === null) {
      urlObject.remove(key);
      continue;
    }

    if (Array.isArray(value)) {
      urlObject.set(key, value.join(","));
      continue;
    }

    urlObject.set(key, String(value));
  }

  // Apply updated params back to URL
  urlInstance.search = searchParams.toString();

  return urlInstance.toString();
}

/**
 * React hook wrapper.
 *
 * Gives stable callback via useCallback.
 */
export function useQueryApply() {
  return useCallback(queryApply, []);
}

/* -------------------------------------------------------------------------- */
/*                                  EXAMPLE                                   */
/* -------------------------------------------------------------------------- */

/*
const myobject = {
  text: 'ff',
  radio: 'option2',
  multiSelect: ['item2', 'item3'],
  test: undefined,
};

const applyQuery = useQueryApply();

const url = applyQuery(
  window.location.href,
  myobject,
  (key, value, urlObject) => {
    // Remove undefined keys
    if (value === undefined || value === null) {
      urlObject.remove(key);
      return;
    }

    // Custom array serialization
    if (key === 'multiSelect' && Array.isArray(value)) {
      urlObject.set(key, value.join('|'));
      return;
    }

    // Default primitive handling
    urlObject.set(key, String(value));
  }
);

console.log(url);
*/

/* -------------------------------------------------------------------------- */
/*                               RESULT EXAMPLE                               */
/* -------------------------------------------------------------------------- */

/*
FROM:

https://example.com?page=1&theme=dark&radio=old

TO:

https://example.com/?page=1&theme=dark&text=ff&radio=option2&multiSelect=item2%7Citem3

Notice:
- page/theme remain untouched
- only keys from object were modified
- test was removed because undefined
*/
