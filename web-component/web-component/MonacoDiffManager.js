/**
 * Monaco diff editor manager. Refresh version/CDN URLs: pnpm run monaco -- --skip
 */
// autogenerate v
export const MONACO_GENERATED = {
  version: "0.55.1",
  vs: [
    "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs",
    "https://unpkg.com/monaco-editor@0.55.1/min/vs",
    "/monaco/vs",
  ],
};
let cachedMonaco = null;
function loadMonaco(vsBase) {
  return new Promise((resolve, reject) => {
    const win = window;
    const finish = () => {
      win.require?.config({ paths: { vs: vsBase } });
      win.require?.(
        ["vs/editor/editor.main"],
        () => {
          if (win.monaco) {
            resolve(win.monaco);
          } else {
            reject(new Error(`Monaco did not initialize from ${vsBase}`));
          }
        },
        (err) => {
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      );
    };
    if (win.monaco) {
      resolve(win.monaco);
      return;
    }
    if (win.require) {
      finish();
      return;
    }
    const script = document.createElement("script");
    script.src = `${vsBase}/loader.js`;
    script.async = true;
    script.onload = () => finish();
    script.onerror = () => reject(new Error(`Failed to load Monaco loader from ${vsBase}`));
    document.head.appendChild(script);
  });
}
/** Try each `/min/vs` URL in order until Monaco loads. */
export async function hydrateCache(generated = MONACO_GENERATED) {
  if (cachedMonaco) {
    return cachedMonaco;
  }
  const errors = [];
  for (const vsBase of generated.vs) {
    try {
      cachedMonaco = await loadMonaco(vsBase);
      return cachedMonaco;
    } catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)));
    }
  }
  throw new AggregateError(errors, `Failed to load monaco-editor@${generated.version} from all sources`);
}
export const SCRIPT_TYPE_ORIGINAL = "text/original";
export const SCRIPT_TYPE_MODIFIED = "text/modified";
/**
 * Reads optional `<script type="text/original">` and `<script type="text/modified">`
 * from direct children of `host`. Returns `null` when none are present.
 */
export function readDeclarativeDiffScripts(host) {
  const scripts = Array.from(host.querySelectorAll(":scope > script"));
  if (scripts.length === 0) {
    return null;
  }
  if (scripts.length !== 2) {
    throw new Error(
      `<monaco-diff>: expected exactly two <script> elements (type="${SCRIPT_TYPE_ORIGINAL}" and type="${SCRIPT_TYPE_MODIFIED}"), found ${scripts.length}`,
    );
  }
  let originalScript;
  let modifiedScript;
  for (const script of scripts) {
    const type = script.getAttribute("type");
    if (type === SCRIPT_TYPE_ORIGINAL) {
      if (originalScript) {
        throw new Error(`<monaco-diff>: duplicate <script type="${SCRIPT_TYPE_ORIGINAL}">`);
      }
      originalScript = script;
    } else if (type === SCRIPT_TYPE_MODIFIED) {
      if (modifiedScript) {
        throw new Error(`<monaco-diff>: duplicate <script type="${SCRIPT_TYPE_MODIFIED}">`);
      }
      modifiedScript = script;
    } else {
      throw new Error(
        `<monaco-diff>: <script> must have type="${SCRIPT_TYPE_ORIGINAL}" or type="${SCRIPT_TYPE_MODIFIED}"`,
      );
    }
  }
  if (!originalScript || !modifiedScript) {
    const missing = !originalScript ? SCRIPT_TYPE_ORIGINAL : SCRIPT_TYPE_MODIFIED;
    throw new Error(`<monaco-diff>: missing <script type="${missing}">`);
  }
  const original = originalScript.textContent ?? "";
  const modified = modifiedScript.textContent ?? "";
  const originalLanguage = originalScript.getAttribute("lang") ?? undefined;
  const modifiedLanguage = modifiedScript.getAttribute("lang") ?? undefined;
  originalScript.remove();
  modifiedScript.remove();
  return { original, modified, originalLanguage, modifiedLanguage };
}
const DEFAULT_LANGUAGE = "javascript";
function resolveDiffContent(options) {
  let original = options.original ?? "";
  let modified = options.modified ?? "";
  let originalLanguage = options.originalLanguage;
  let modifiedLanguage = options.modifiedLanguage;
  if (options.host) {
    const declarative = readDeclarativeDiffScripts(options.host);
    if (declarative) {
      original = declarative.original;
      modified = declarative.modified;
      originalLanguage = originalLanguage ?? declarative.originalLanguage;
      modifiedLanguage = modifiedLanguage ?? declarative.modifiedLanguage;
    }
  }
  const sharedLanguage = options.language;
  return {
    original,
    modified,
    originalLanguage: originalLanguage ?? sharedLanguage ?? DEFAULT_LANGUAGE,
    modifiedLanguage: modifiedLanguage ?? sharedLanguage ?? DEFAULT_LANGUAGE,
  };
}
export class MonacoDiffManager {
  _container;
  _readyPromise;
  _editor = null;
  _resizeObserver = null;
  _layoutRaf = null;
  constructor(_container, options) {
    this._container = _container;
    _container.style.height = "100%";
    _container.style.width = "100%";
    const { original, modified, originalLanguage, modifiedLanguage } = resolveDiffContent(options);
    this._readyPromise = (async () => {
      const monaco = await hydrateCache(MONACO_GENERATED);
      this._editor = monaco.editor.createDiffEditor(this._container, {
        automaticLayout: false,
        scrollbar: {
          vertical: "auto",
        },
        scrollBeyondLastLine: false,
        ...options.editorOptions,
      });
      this._editor.setModel({
        original: monaco.editor.createModel(original, originalLanguage),
        modified: monaco.editor.createModel(modified, modifiedLanguage),
      });
      this._scheduleLayout();
      this._resizeObserver = new ResizeObserver(() => this._scheduleLayout());
      this._resizeObserver.observe(this._container);
    })();
  }
  whenReady() {
    return this._readyPromise;
  }
  getEditor() {
    return this._editor;
  }
  destroy() {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    if (this._layoutRaf !== null) {
      cancelAnimationFrame(this._layoutRaf);
      this._layoutRaf = null;
    }
    const model = this._editor?.getModel();
    model?.original.dispose();
    model?.modified.dispose();
    this._editor?.dispose();
    this._editor = null;
  }
  _scheduleLayout() {
    if (this._layoutRaf !== null) return;
    this._layoutRaf = requestAnimationFrame(() => {
      this._layoutRaf = null;
      if (!this._editor) return;
      const { width, height } = this._container.getBoundingClientRect();
      if (width === 0 || height === 0) {
        return;
      }
      this._editor.layout({ width, height });
    });
  }
}
