import  {  useMemo, useCallback, memo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { NavigateFunction } from "react-router-dom";
import modURLSearchParams from "./params/modURLSearchParams";
import { MonacoDiff } from "../../../web-component/react";
import type { MonacoTheme } from "../../../web-component/monaco-diff";

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

// Global Theme param config (no suffix function)
const globalThemeParams = modURLSearchParams({
  theme: {
    default: "vs-dark" as MonacoTheme,
    getParam: "theme",
    encode: (value) => value,
    decode: (value) => value as MonacoTheme,
  },
});

// Indexed params config
const { useQueryParams, separateIndexedSearchParams } = modURLSearchParams(
  {
    language: {
      default: "javascript",
      getParam: "lang",
      encode: (value) => value,
      decode: (value) => value,
    },
    original: {
      default: "// Original code\nconst a = 1;\nconsole.log(a);",
      getParam: "orig",
      encode: (value) => compressToEncodedURIComponent(value),
      decode: (value) => decompressFromEncodedURIComponent(value),
    },
    modified: {
      default: "// Modified code\nconst a = 2;\nconsole.log(a);",
      getParam: "mod",
      encode: (value) => compressToEncodedURIComponent(value),
      decode: (value) => decompressFromEncodedURIComponent(value),
    },
    editorWidth: {
      default: "100",
      getParam: "ew",
      encode: (value) => value,
      decode: (value) => value,
    },
    editorHeight: {
      default: "350",
      getParam: "eh",
      encode: (value) => value,
      decode: (value) => value,
    },
  },
  (key, i?: number) => `${key}-${i}`,
);

export default function MonacoDiffDemoAttr() {
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
    const indexes = new Set<number>();
    params.forEach((_, key) => {
      const match = key.match(/-(\d+)$/);
      if (match) {
        indexes.add(parseInt(match[1], 10));
      }
    });
    const parsed = Array.from(indexes).sort((a, b) => a - b);
    return parsed.length > 0 ? parsed : [1];
  }, [location.search]);

  const addInstance = useCallback(() => {
    const nextIndex = instances.length > 0 ? Math.max(...instances) + 1 : 1;
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.set(`lang-${nextIndex}`, "javascript");
    navigate({ search: currentParams.toString() }, { replace: true });
  }, [instances, navigate]);

  const removeInstance = useCallback(
    (id: number) => {
      const nextSearchParams = new URLSearchParams(window.location.search);
      const childParams = separateIndexedSearchParams(nextSearchParams, id);
      let changed = false;
      childParams.forEach((_, key) => {
        nextSearchParams.delete(key);
        changed = true;
      });

      if (changed) {
        navigate({ search: nextSearchParams.toString() }, { replace: true });
      }
    },
    [navigate],
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
          <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 700, color: "#212529" }}>Monaco Diff React Demo</h1>
          <p style={{ margin: "5px 0 0 0", color: "#6c757d" }}>
            <a href="/monaco-diff-attr?theme=vs&orig-1=MYewdgzgLgBA5gGxAIwIYICoAsCmBbHABVQCdU8IYBeGPEAEwFUAlAGQGUdTgtiyKAFAG8AUDBhRcBAFwxR48fRwAzVAFcEUWQCIAbhAC09UgGttMVJRgBZcKlDZ8OADRiFcHFD7kdkp9tcFGBwwUCVZAV10NRwASmoAPhgohBjAhSUwnAjdeKok3QtKWzB7EEcCdIBfVyrYgG4gA&mod-1=MYewdgzgLgBA5gGxAIwIYICoAsCmBbHABVQCdU8IYBeGPEAEwFUAlAGQGUdTgtiyKAFAG8AUDBhRcBAFwxR48fRwAzVAFcEUWQCIAbhAC09UgGttMVJQCy4VKGz4cAGjEK4OKH3I7Jj7S4UYHDBQJVkBXXQ1HABKagA%2BGEiEaICFJVCccOTouKpEnJwLa1t7KWdXAF8XSpiAbiA&ew-1=76">snippet</a>
          </p>
        </div>
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontSize: "0.9rem", fontWeight: 600, color: "#495057" }}>Theme:</label>
            <select
              value={globalTheme}
              onChange={(e) => setGlobalParam("theme", e.target.value as MonacoTheme)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #ced4da",
                outline: "none",
                background: "#fff",
                fontWeight: 600,
              }}
            >
              <option value="vs">vs (Light)</option>
              <option value="vs-dark">vs-dark (Dark)</option>
              <option value="hc-black">hc-black (High Contrast Dark)</option>
              <option value="hc-light">hc-light (High Contrast Light)</option>
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
}: {
  id: number;
  search: string;
  navigate: NavigateFunction;
  onRemove: (id: number) => void;
  globalTheme: MonacoTheme;
}) {
  const { params, setParam } = useQueryParams(search, navigate, id);
  const { language, original, modified, editorWidth, editorHeight } = params;

  return (
    <section
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
          <label
            style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#495057", marginBottom: "6px" }}
          >
            Language
          </label>
          <select
            value={language}
            onChange={(e) => setParam("language", e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #ced4da",
              outline: "none",
            }}
          >
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="css">CSS</option>
            <option value="html">HTML</option>
            <option value="json">JSON</option>
          </select>
        </div>
        <div>
          <label
            style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#495057", marginBottom: "6px" }}
          >
            Width: {editorWidth}%
          </label>
          <input
            type="range"
            min="20"
            max="100"
            step="1"
            value={editorWidth}
            onChange={(e) => setParam("editorWidth", e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <label
            style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#495057", marginBottom: "6px" }}
          >
            Height: {editorHeight}px
          </label>
          <input
            type="range"
            min="100"
            max="800"
            step="10"
            value={editorHeight}
            onChange={(e) => setParam("editorHeight", e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <div>
          <label
            style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#495057", marginBottom: "6px" }}
          >
            Original Text
          </label>
          <textarea
            value={original}
            onChange={(e) => setParam("original", e.target.value)}
            style={{
              width: "100%",
              height: "100px",
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #ced4da",
              fontFamily: "monospace",
              fontSize: "0.9rem",
              resize: "vertical",
              outline: "none",
            }}
          />
        </div>
        <div>
          <label
            style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#495057", marginBottom: "6px" }}
          >
            Modified Text
          </label>
          <textarea
            value={modified}
            onChange={(e) => setParam("modified", e.target.value)}
            style={{
              width: "100%",
              height: "100px",
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #ced4da",
              fontFamily: "monospace",
              fontSize: "0.9rem",
              resize: "vertical",
              outline: "none",
            }}
          />
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
        <MonacoDiff theme={globalTheme} language={language} original={original} modified={modified} />
      </div>
    </section>
  );
});
