/**
 * Shared page of the two React demos (MonacoDiffDemo.tsx = imperative/ref flavour,
 * MonacoDiffDemoAttr.tsx = props flavour). Everything except "how is the editor fed" lives here,
 * the editor itself is supplied through the `renderEditor` render prop.
 *
 * State model (all of it in the query string, see ./params/modURLSearchParams.ts):
 *   theme                      global Monaco theme (one for the whole page - Monaco's theme is global)
 *   ids=1,2                    which instances exist (see web-component/urlchange/instanceIds.ts).
 *                              It is its own key on purpose: params equal to their default are removed
 *                              from the URL, so the list of instances cannot be derived from them.
 *   lang-N orig-N mod-N ew-N eh-N   params of instance N
 *
 * Values from the URL are user input: every decoder validates and falls back to the default.
 *
 * Text and sliders are "live" in local state and written to the URL debounced, so typing does not
 * trigger a router navigation (and an lz-string compression) per keystroke.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { NavigateFunction } from "react-router-dom";
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

import modURLSearchParams from "./params/modURLSearchParams";
import { MONACO_THEMES } from "../../../web-component/composite-monaco-diff";
import type { MonacoTheme } from "../../../web-component/composite-monaco-diff";
import { DEFAULT_DEMO_LANGUAGE, DEMO_LANGUAGES } from "../../../web-component/urlchange/demoWiring";
import type { DemoLanguage } from "../../../web-component/urlchange/demoWiring";
import { oneOf } from "../../../web-component/urlchange/urlchange";
import { INSTANCE_IDS_KEY, nextInstanceId, parseInstanceIds } from "../../../web-component/urlchange/instanceIds";

const DEFAULT_THEME: MonacoTheme = "vs-dark";
const DEFAULT_ORIGINAL = "// Original code\nconst a = 1;\nconsole.log(a);";
const DEFAULT_MODIFIED = "// Modified code\nconst a = 2;\nconsole.log(a);";

/** How long typing / dragging a slider has to pause before the value is written to the URL. */
const URL_WRITE_DEBOUNCE_MS = 250;

const THEME_LABELS: Record<MonacoTheme, string> = {
  vs: "vs (Light)",
  "vs-dark": "vs-dark (Dark)",
  "hc-black": "hc-black (High Contrast Dark)",
  "hc-light": "hc-light (High Contrast Light)",
};

/** lz-string codec. `decompress…` returns null for an empty value - that must never reach the editor. */
const compressedText = (fallback: string) => ({
  encode: (value: string) => compressToEncodedURIComponent(value),
  decode: (value: string) => decompressFromEncodedURIComponent(value) ?? fallback,
});

/** Integer kept as a string (range inputs work with strings), clamped to [min, max]. */
const integerInRange = (min: number, max: number, fallback: string) => (value: string) => {
  if (!/^-?\d+(\.\d+)?$/.test(value.trim())) return fallback;
  return String(Math.min(max, Math.max(min, Math.round(Number(value)))));
};

// Global Theme param config (no suffix function)
const globalThemeParams = modURLSearchParams({
  theme: {
    default: DEFAULT_THEME as MonacoTheme,
    getParam: "theme",
    encode: (value) => value,
    decode: oneOf(MONACO_THEMES, DEFAULT_THEME),
  },
});

// Indexed params config
const { useQueryParams, separateIndexedSearchParams } = modURLSearchParams(
  {
    language: {
      default: DEFAULT_DEMO_LANGUAGE as DemoLanguage,
      getParam: "lang",
      encode: (value) => value,
      decode: oneOf(DEMO_LANGUAGES, DEFAULT_DEMO_LANGUAGE),
    },
    original: {
      default: DEFAULT_ORIGINAL,
      getParam: "orig",
      ...compressedText(DEFAULT_ORIGINAL),
    },
    modified: {
      default: DEFAULT_MODIFIED,
      getParam: "mod",
      ...compressedText(DEFAULT_MODIFIED),
    },
    editorWidth: {
      default: "100",
      getParam: "ew",
      encode: (value) => value,
      decode: integerInRange(20, 100, "100"),
    },
    editorHeight: {
      default: "350",
      getParam: "eh",
      encode: (value) => value,
      decode: integerInRange(100, 800, "350"),
    },
  },
  (key, i?: number) => `${key}-${i}`,
);

/**
 * A value that follows `committed` (the URL) but can run ahead of it: `set` updates the local value
 * immediately and reports it through `commit` once the user paused for `delay` ms.
 */
function useDebouncedValue<T>(committed: T, commit: (value: T) => void, delay = URL_WRITE_DEBOUNCE_MS) {
  const [local, setLocal] = useState(committed);
  const timer = useRef<number | undefined>(undefined);
  const commitRef = useRef(commit);

  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);

  // The URL changed from outside (back/forward, another control): follow it, unless a local change is
  // still waiting to be written - that one is newer.
  useEffect(() => {
    if (timer.current === undefined) setLocal(committed);
  }, [committed]);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  const set = useCallback(
    (value: T) => {
      setLocal(value);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = undefined;
        commitRef.current(value);
      }, delay);
    },
    [delay],
  );

  return [local, set] as const;
}

export type DemoEditorProps = {
  theme: MonacoTheme;
  language: DemoLanguage;
  original: string;
  modified: string;
};

type MonacoDiffDemoPageProps = {
  title: string;
  /** File name under vite-project/src/pages/ for the "snippet" link. */
  sourceFile: string;
  /** Renders the diff editor for one instance. */
  renderEditor: (props: DemoEditorProps) => ReactNode;
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "#495057",
  marginBottom: "6px",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  height: "100px",
  padding: "10px",
  borderRadius: "6px",
  border: "1px solid #ced4da",
  fontFamily: "monospace",
  fontSize: "0.9rem",
  resize: "vertical",
  outline: "none",
};

export default function MonacoDiffDemoPage({ title, sourceFile, renderEditor }: MonacoDiffDemoPageProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Manage global theme parameter
  const { params: globalParams, setParam: setGlobalParam } = globalThemeParams.useQueryParams(
    location.search,
    navigate,
  );
  const globalTheme = globalParams.theme;

  const instances = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const ids = parseInstanceIds(params);
    // Neither `ids` nor any instance key = fresh page: show one instance with default values.
    // `ids=` (present but empty) means the user destroyed all of them.
    return ids.length === 0 && !params.has(INSTANCE_IDS_KEY) ? [1] : ids;
  }, [location.search]);

  const addInstance = useCallback(() => {
    const next = new URLSearchParams(window.location.search);
    // writes the list that is currently displayed, so the implicit default instance becomes explicit
    next.set(INSTANCE_IDS_KEY, [...instances, nextInstanceId(instances)].join(","));
    navigate({ search: next.toString() }, { replace: true });
  }, [instances, navigate]);

  const removeInstance = useCallback(
    (id: number) => {
      const next = new URLSearchParams(window.location.search);
      separateIndexedSearchParams(next, id).forEach((_, key) => {
        next.delete(key);
      });
      next.set(INSTANCE_IDS_KEY, instances.filter((instanceId) => instanceId !== id).join(","));
      navigate({ search: next.toString() }, { replace: true });
    },
    [instances, navigate],
  );

  return (
    <div style={{ padding: "30px", fontFamily: "system-ui, sans-serif", background: "#f8f9fa", minHeight: "100vh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "30px",
          borderBottom: "1px solid #dee2e6",
          paddingBottom: "20px",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 700, color: "#212529" }}>{title}</h1>
          <p style={{ margin: "5px 0 0 0", color: "#6c757d" }}>
            <a
              href={`https://github.com/stopsopa/monaco-editor-webcomponent/blob/main/vite-project/src/pages/${sourceFile}`}
              className="gcp-css"
            >
              snippet
            </a>
          </p>
        </div>
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontSize: "0.9rem", fontWeight: 600, color: "#495057" }}>Theme:</label>
            <select
              value={globalTheme}
              onChange={(e) => setGlobalParam("theme", oneOf(MONACO_THEMES, DEFAULT_THEME)(e.target.value))}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #ced4da",
                outline: "none",
                background: "#fff",
                fontWeight: 600,
              }}
            >
              {MONACO_THEMES.map((theme) => (
                <option key={theme} value={theme}>
                  {THEME_LABELS[theme]}
                </option>
              ))}
            </select>
          </div>
          <Link
            to="/"
            className="gcp-css"
            style={{
              textDecoration: "none",
              color: "#495057",
              border: "1px solid #ced4da",
              padding: "8px 16px",
              borderRadius: "8px",
              background: "#fff",
              transition: "all 0.2s",
            }}
          >
            &larr; Home
          </Link>
          <button
            onClick={addInstance}
            className="gcp-css"
            data-testid="add-instance"
            style={{
              border: "none",
              padding: "8px 16px",
              borderRadius: "8px",
              background: "#007bff",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
              transition: "all 0.2s",
            }}
          >
            Initialize New Instance
          </button>
          <a
            href={window.location.href.split("?")[0]}
            className="gcp-css"
            style={{
              textDecoration: "none",
              color: "#dc3545",
              border: "1px solid #f5c2c7",
              padding: "8px 16px",
              borderRadius: "8px",
              background: "#f8d7da",
              transition: "all 0.2s",
            }}
          >
            Reset URL
          </a>
        </div>
      </header>

      <main style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
        {instances.length === 0 && (
          <p style={{ color: "#6c757d" }} data-testid="no-instances">
            No instances. Use “Initialize New Instance”.
          </p>
        )}
        {instances.map((id) => {
          const search = separateIndexedSearchParams(location.search, id).toString();
          return (
            <DemoInstance
              key={id}
              id={id}
              search={search}
              navigate={navigate}
              onRemove={removeInstance}
              globalTheme={globalTheme}
              renderEditor={renderEditor}
            />
          );
        })}
      </main>
    </div>
  );
}

const DemoInstance = memo(function DemoInstance({
  id,
  search,
  navigate,
  onRemove,
  globalTheme,
  renderEditor,
}: {
  id: number;
  search: string;
  navigate: NavigateFunction;
  onRemove: (id: number) => void;
  globalTheme: MonacoTheme;
  renderEditor: (props: DemoEditorProps) => ReactNode;
}) {
  const { params, setParam } = useQueryParams(search, navigate, id);
  const { language } = params;

  const commitOriginal = useCallback((value: string) => setParam("original", value), [setParam]);
  const commitModified = useCallback((value: string) => setParam("modified", value), [setParam]);
  const commitWidth = useCallback((value: string) => setParam("editorWidth", value), [setParam]);
  const commitHeight = useCallback((value: string) => setParam("editorHeight", value), [setParam]);

  const [original, setOriginal] = useDebouncedValue(params.original, commitOriginal);
  const [modified, setModified] = useDebouncedValue(params.modified, commitModified);
  const [editorWidth, setEditorWidth] = useDebouncedValue(params.editorWidth, commitWidth);
  const [editorHeight, setEditorHeight] = useDebouncedValue(params.editorHeight, commitHeight);

  return (
    <section
      data-testid={`instance-${id}`}
      style={{
        background: "#ffffff",
        border: "1px solid #e0e0e0",
        borderRadius: "12px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.02)",
        padding: "24px",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#343a40" }}>Instance #{id}</h2>
        <button
          onClick={() => onRemove(id)}
          style={{
            background: "#dc3545",
            color: "#fff",
            border: "none",
            padding: "6px 12px",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Destroy
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "15px",
          marginBottom: "20px",
        }}
      >
        <div>
          <label style={labelStyle}>Language</label>
          <select
            value={language}
            data-testid={`language-${id}`}
            onChange={(e) => setParam("language", oneOf(DEMO_LANGUAGES, DEFAULT_DEMO_LANGUAGE)(e.target.value))}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #ced4da",
              outline: "none",
            }}
          >
            {DEMO_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Width: {editorWidth}%</label>
          <input
            type="range"
            min="20"
            max="100"
            step="1"
            value={editorWidth}
            onChange={(e) => setEditorWidth(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <label style={labelStyle}>Height: {editorHeight}px</label>
          <input
            type="range"
            min="100"
            max="800"
            step="10"
            value={editorHeight}
            onChange={(e) => setEditorHeight(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <div>
          <label style={labelStyle}>Original Text</label>
          <textarea value={original} onChange={(e) => setOriginal(e.target.value)} style={textareaStyle} />
        </div>
        <div>
          <label style={labelStyle}>Modified Text</label>
          <textarea value={modified} onChange={(e) => setModified(e.target.value)} style={textareaStyle} />
        </div>
      </div>

      <div
        style={{
          border: "1px solid #dee2e6",
          borderRadius: "8px",
          overflow: "hidden",
          height: `${editorHeight}px`,
          width: `${editorWidth}%`,
          background: "#f1f3f5",
        }}
      >
        {/* The editor is a read-only viewer: the textareas above are the only inputs for the text. */}
        {renderEditor({ theme: globalTheme, language, original, modified })}
      </div>
    </section>
  );
});
