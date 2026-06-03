import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

type Serializer<T> = {
  parse: (raw: string) => T;
  serialize: (value: T) => string;
};

type UseUrlGetProps<T> = {
  key: string;
  defaultValue: T;
  serializer?: Serializer<T>;
};

type SetUrlValue<T> = (value: T | null | undefined) => void;

// ─── Built-in serializers ─────────────────────────────────────────────────────

export const StringSerializer: Serializer<string> = {
  parse: (raw) => raw,
  serialize: (val) => val,
};

export const predefinedUseUrlString = createUseUrlGet(StringSerializer);

export const NumberSerializer: Serializer<number> = {
  parse: (raw) => Number(raw),
  serialize: (val) => String(val),
};

export const predefinedUseUrlNumber = createUseUrlGet(NumberSerializer);

export const BooleanSerializer: Serializer<boolean> = {
  parse: (raw) => raw === "1",
  serialize: (val) => (String(val) === "true" ? "1" : "0"),
};

export const predefinedUseUrlBoolean = createUseUrlGet(BooleanSerializer);

export const StringArraySerializer: Serializer<string[]> = {
  parse: (raw) => (raw ? raw.split("~") : []),
  serialize: (val) => val.join("~"),
};

export const predefinedUseUrlStringArray = createUseUrlGet(StringArraySerializer);

export const NumberArraySerializer: Serializer<number[]> = {
  parse: (raw) => (raw ? raw.split("~").map(Number) : []),
  serialize: (val) => val.join("~"),
};

export const predefinedUseUrlNumberArray = createUseUrlGet(NumberArraySerializer);

// most flexible
export const JsonSerializer = <T>(): Serializer<T> => ({
  parse: (raw) => JSON.parse(raw) as T,
  serialize: (val) => JSON.stringify(val),
});

export const predefinedUseUrlJson = <T>() => createUseUrlGet(JsonSerializer<T>());

let pendingSearchParams: URLSearchParams | null = null;
let batchTimeout: any = null;

export default function useUrlGet<T = string>(opt: UseUrlGetProps<T>): [T, SetUrlValue<T>] {
  const {
    key,
    defaultValue,
    // Auto-detect string serializer when T is a string; otherwise require explicit serializer
    serializer = StringSerializer as unknown as Serializer<T>,
  } = opt;

  const [searchParams, setSearchParams] = useSearchParams();

  // ── Read ──────────────────────────────────────────────────────────────────
  const raw = searchParams.get(key);
  const value: T =
    raw !== null
      ? (() => {
          try {
            return serializer.parse(raw);
          } catch {
            return defaultValue;
          }
        })()
      : defaultValue;

  // ── Write ─────────────────────────────────────────────────────────────────
  const setValue: SetUrlValue<T> = useCallback(
    (next) => {
      if (!pendingSearchParams) {
        pendingSearchParams = new URLSearchParams(window.location.search);
      }

      const isDefault =
        next === null ||
        next === undefined ||
        next === defaultValue ||
        (defaultValue !== null &&
          defaultValue !== undefined &&
          serializer.serialize(next) === serializer.serialize(defaultValue));

      if (isDefault) {
        pendingSearchParams.delete(key);
      } else {
        pendingSearchParams.set(key, serializer.serialize(next!));
      }

      if (batchTimeout) {
        clearTimeout(batchTimeout);
      }

      batchTimeout = setTimeout(() => {
        if (pendingSearchParams) {
          setSearchParams(pendingSearchParams, { replace: true });
          pendingSearchParams = null;
        }
      }, 0);
    },
    [key, defaultValue, serializer, setSearchParams],
  );

  return [value, setValue];
}

export function createUseUrlGet<T>(serializer: Serializer<T>) {
  return function useBoundUrlGet(key: string, defaultValue: T): [T, SetUrlValue<T>] {
    return useUrlGet<T>({
      key,
      defaultValue,
      serializer,
    });
  };
}

// ─── Usage examples ───────────────────────────────────────────────────────────
//
// 1. Importing the hooks and predefined helpers:
//
// import useUrlGet, {
//   createUseUrlGet,
//   NumberSerializer,
//   BooleanSerializer,
//   JsonSerializer,
//   StringArraySerializer,
//   NumberArraySerializer,
//   FlipGetJsonSerializer,
//   predefinedUseUrlString,
//   predefinedUseUrlNumber,
//   predefinedUseUrlBoolean,
//   predefinedUseUrlStringArray,
//   predefinedUseUrlNumberArray,
//   predefinedUseUrlJson,
//   predefinedUseUrlFlip,
// } from "./useUrlGet";
//
// --- create custom bound hook ---
// const useUrlGetString = createUseUrlGet(StringSerializer);
// // then in component:
// // const [val, setVal] = useUrlGetString("key", "default_value");
//
// --- string (default) ---
// const [search, setSearch] = useUrlGet<string>({
//   key: "q",
//   defaultValue: "",
// });
//
// --- number ---
// const [page, setPage] = useUrlGet<number>({
//   key: "page",
//   defaultValue: 1,
//   serializer: NumberSerializer,
// });
//
// --- boolean ---
// const [darkMode, setDarkMode] = useUrlGet<boolean>({
//   key: "dark",
//   defaultValue: false,
//   serializer: BooleanSerializer,
// });
//
// --- complex object ---
// type Filters = { sort: string };
// const [filters, setFilters] = useUrlGet<Filters>({
//   key: "filters",
//   defaultValue: { sort: "asc" },
//   serializer: JsonSerializer<Filters>(),
// });
//
// --- array of strings ---
// const [tags, setTags] = useUrlGet<string[]>({
//   key: "tags",
//   defaultValue: [],
//   serializer: StringArraySerializer,
// });
//
// --- array of numbers ---
// const [ids, setIds] = useUrlGet<number[]>({
//   key: "ids",
//   defaultValue: [],
//   serializer: NumberArraySerializer,
// });
//
// --- flipget encoded object ---
// const [state, setState] = useUrlGet<Filters>({
//   key: "state",
//   defaultValue: { sort: "asc" },
//   serializer: FlipGetJsonSerializer<Filters>(),
// });
//
// --- unsetting a value (removes key from URL) ---
// setSearch(null);       // → removes ?q=...
// setSearch(undefined);  // → same
//
// ─── Predefined Hooks (Easiest & Simplest!) ───────────────────────────────────
//
// --- String ---
// const [search, setSearch] = predefinedUseUrlString("q", "");
//
// --- Number ---
// const [page, setPage] = predefinedUseUrlNumber("page", 1);
//
// --- Boolean (saves as '1' or '0') ---
// const [darkMode, setDarkMode] = predefinedUseUrlBoolean("dark", false);
//
// --- String Array (comma separated) ---
// const [tags, setTags] = predefinedUseUrlStringArray("tags", []);
//
// --- Number Array (comma separated) ---
// const [ids, setIds] = predefinedUseUrlNumberArray("ids", []);
//
// --- JSON (standard JSON string in URL) ---
// const [filters, setFilters] = predefinedUseUrlJson<Filters>()("filters", { sort: "asc" });
//
// --- Flip JSON (compact url-friendly character-mapped JSON) ---
// const [state, setState] = predefinedUseUrlFlip<Filters>()("state", { sort: "asc" });
//
// ─── Core useUrlGet Hook with Custom Serializer ────────────────────────────
//
// const PipeSeparatedSerializer = {
//   parse:     (raw: string) => raw.split("|"),
//   serialize: (value: string[]) => value.join("|"),
// };
//
// const [tags, setTags] = useUrlGet<string[]>({
//   key:          "tags",
//   defaultValue: [],
//   serializer:   PipeSeparatedSerializer,
// });
//
// --- Unsetting a value (removes the key from URL if value is null, undefined, or matches default) ---
// setSearch(null);       // → removes ?q=... from URL
// setSearch("");         // → matches default value "", so also removes ?q=... from URL!

/**
// string (default — no serializer needed)
const [q, setQ] = useUrlGet<string>({ key: "q", defaultValue: "" });

// number
const [page, setPage] = useUrlGet<number>({
  key: "page", defaultValue: 1, serializer: NumberSerializer,
});

// any object → JSON-encoded in the URL
const [filters, setFilters] = useUrlGet<Filters>({
  key: "filters", defaultValue: { tags: [], sort: "asc" },
  serializer: JsonSerializer<Filters>(),
});

// custom serializer


const PipeSeparatedSerializer: Serializer<string[]> = {
  parse:     (raw)   => raw.split("|"),
  serialize: (value) => value.join("|"),
};

const [tags, setTags] = useUrlGet<string[]>({
  key:          "tags",
  defaultValue: [],
  serializer:   PipeSeparatedSerializer,
});

// ?tags=react|typescript|hooks
// setTags(["react", "typescript", "hooks"])
// setTags(null)  → removes ?tags= entirely

 */
