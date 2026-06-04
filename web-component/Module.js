// web-component/trimLeft.js
function trimLeft(str, offset = 0) {
  let o = typeof offset === "number" ? offset : parseInt(offset, 10);
  if (isNaN(o)) {
    throw new Error(`offset must be a number, ${offset}`);
  }
  if (o < 0) {
    throw new Error(`offset must be a non-negative number, ${offset}`);
  }
  const lines = str.split("\n");
  let diff = Infinity;
  lines.forEach((line) => {
    if (!/^\s*$/.test(line)) {
      const lengthBefore = line.length;
      const lengthAfter = line.replace(/^\s+/, "").length;
      const indentation = lengthBefore - lengthAfter;
      if (indentation < diff) {
        diff = indentation;
      }
    }
  });
  let result = lines.map((line) => line.substring(diff));
  if (o > 0) {
    const spaces = " ".repeat(o);
    result = result.map((line) => `${spaces}${line}`);
  }
  return result.join("\n");
}

// web-component/MonacoDiffManager.js
var MONACO_GENERATED = {
  "version": "0.55.1",
  "vs": [
    "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs",
    "https://unpkg.com/monaco-editor@0.55.1/min/vs",
    "/monaco/vs"
  ]
};
var cachedMonaco = null;
var cachedVsBase = null;
var MONACO_VS_STYLESHEET = /\/vs\/(base|editor|platform)/;
var MONACO_SHADOW_STYLES_ATTR = "data-monaco-shadow-styles";
function loadStylesheetLink(link) {
  if (link.sheet) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    link.addEventListener("load", () => resolve(), { once: true });
    link.addEventListener("error", () => reject(new Error(`Failed to load Monaco stylesheet: ${link.href}`)), {
      once: true
    });
  });
}
async function ensureMonacoStylesInShadowRoot(container) {
  const root = container.getRootNode();
  if (!(root instanceof ShadowRoot)) {
    return;
  }
  if (root.querySelector(`[${MONACO_SHADOW_STYLES_ATTR}]`)) {
    return;
  }
  const documentLinks = Array.from(document.querySelectorAll("link[rel='stylesheet']")).filter((link) => {
    const href = link.getAttribute("href") ?? "";
    return MONACO_VS_STYLESHEET.test(href);
  });
  const loads = [];
  for (const documentLink of documentLinks) {
    const clone = documentLink.cloneNode(true);
    clone.setAttribute(MONACO_SHADOW_STYLES_ATTR, "");
    loads.push(loadStylesheetLink(clone));
    root.insertBefore(clone, root.firstChild);
  }
  if (documentLinks.length === 0 && cachedVsBase) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${cachedVsBase}/editor/editor.main.css`;
    link.setAttribute(MONACO_SHADOW_STYLES_ATTR, "");
    loads.push(loadStylesheetLink(link));
    root.insertBefore(link, root.firstChild);
  }
  await Promise.all(loads);
}
function loadMonaco(vsBase) {
  return new Promise((resolve, reject) => {
    const win = window;
    const finish = () => {
      win.require?.config({ paths: { vs: vsBase } });
      win.require?.(["vs/editor/editor.main"], () => {
        if (win.monaco) {
          resolve(win.monaco);
        } else {
          reject(new Error(`Monaco did not initialize from ${vsBase}`));
        }
      }, (err) => {
        reject(err instanceof Error ? err : new Error(String(err)));
      });
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
async function hydrateCache(generated = MONACO_GENERATED) {
  if (cachedMonaco) {
    return cachedMonaco;
  }
  const errors = [];
  for (const vsBase of generated.vs) {
    try {
      cachedMonaco = await loadMonaco(vsBase);
      cachedVsBase = vsBase;
      return cachedMonaco;
    } catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)));
    }
  }
  throw new AggregateError(errors, `Failed to load monaco-editor@${generated.version} from all sources`);
}
var SCRIPT_TYPE_ORIGINAL = "text/original";
var SCRIPT_TYPE_MODIFIED = "text/modified";
function readDeclarativeDiffScripts(host) {
  const scripts = Array.from(host.querySelectorAll(":scope > script"));
  if (scripts.length === 0) {
    return null;
  }
  if (scripts.length < 2) {
    throw new Error(`<monaco-diff>: expected exactly at leasttwo <script> elements (type="${SCRIPT_TYPE_ORIGINAL}" and type="${SCRIPT_TYPE_MODIFIED}"), found ${scripts.length}`);
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
      throw new Error(`<monaco-diff>: <script> must have type="${SCRIPT_TYPE_ORIGINAL}" or type="${SCRIPT_TYPE_MODIFIED}"`);
    }
  }
  if (!originalScript || !modifiedScript) {
    const missing = !originalScript ? SCRIPT_TYPE_ORIGINAL : SCRIPT_TYPE_MODIFIED;
    throw new Error(`<monaco-diff>: missing <script type="${missing}">`);
  }
  let original = originalScript.textContent ?? "";
  let modified = modifiedScript.textContent ?? "";
  const originalLanguage = originalScript.getAttribute("lang") ?? void 0;
  const modifiedLanguage = modifiedScript.getAttribute("lang") ?? void 0;
  let originalOffset = parseInt(originalScript.getAttribute("data-offset"), 10) ?? 0;
  let modifiedOffset = parseInt(modifiedScript.getAttribute("data-offset"), 10) ?? 0;
  if (!(originalOffset > 0)) {
    throw new Error(`<monaco-diff><script type='text/original'>: data-offset must be a positive integer >${originalOffset}<`);
  }
  if (!(modifiedOffset > 0)) {
    throw new Error(`<monaco-diff><script type='text/modified'>: data-offset must be a positive integer >${modifiedOffset}<`);
  }
  original = trimLeft(original, originalOffset);
  modified = trimLeft(modified, modifiedOffset);
  originalScript.remove();
  modifiedScript.remove();
  return { original, modified, originalLanguage, modifiedLanguage };
}
var DEFAULT_LANGUAGE = "javascript";
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
    modifiedLanguage: modifiedLanguage ?? sharedLanguage ?? DEFAULT_LANGUAGE
  };
}
var MonacoDiffManager = class {
  _container;
  _readyPromise;
  _editor = null;
  _resizeObserver = null;
  _layoutRaf = null;
  /**
   * Mounts a side-by-side diff editor into the given element: loads Monaco, applies styles,
   * fills in original/modified text, and starts watching size changes.
   */
  constructor(_container, options) {
    this._container = _container;
    _container.style.height = "100%";
    _container.style.width = "100%";
    const { original, modified, originalLanguage, modifiedLanguage } = resolveDiffContent(options);
    this._readyPromise = (async () => {
      const monaco = await hydrateCache(MONACO_GENERATED);
      await ensureMonacoStylesInShadowRoot(this._container);
      this._editor = monaco.editor.createDiffEditor(this._container, {
        automaticLayout: false,
        scrollbar: {
          vertical: "auto"
        },
        scrollBeyondLastLine: false,
        ...options.editorOptions
      });
      this._editor.setModel({
        original: monaco.editor.createModel(original, originalLanguage),
        modified: monaco.editor.createModel(modified, modifiedLanguage)
      });
      this._scheduleLayout();
      this._resizeObserver = new ResizeObserver(() => this._scheduleLayout());
      this._resizeObserver.observe(this._container);
    })();
  }
  /** Promise that resolves when the editor has finished loading and is safe to use. */
  whenReady() {
    return this._readyPromise;
  }
  /** Returns the underlying Monaco diff editor instance (or null if not ready yet). */
  getEditor() {
    return this._editor;
  }
  /** Returns the global Monaco API instance (or null if not loaded yet). */
  getMonaco() {
    return cachedMonaco;
  }
  /** Tears down the editor, frees memory, and stops listening for resize events. */
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
  /** Updates the language for both sides of the diff editor. Falls back to the default language when undefined. */
  setLanguage(language) {
    const model = this._editor?.getModel();
    if (!model)
      return;
    const lang = language ?? DEFAULT_LANGUAGE;
    cachedMonaco?.editor.setModelLanguage(model.original, lang);
    cachedMonaco?.editor.setModelLanguage(model.modified, lang);
  }
  /** Resizes the editor to match its container on the next animation frame (avoids jank). */
  _scheduleLayout() {
    if (this._layoutRaf !== null)
      return;
    this._layoutRaf = requestAnimationFrame(() => {
      this._layoutRaf = null;
      if (!this._editor)
        return;
      const { width, height } = this._container.getBoundingClientRect();
      if (width === 0 || height === 0) {
        return;
      }
      this._editor.layout({ width, height });
    });
  }
};

// web-component/monaco-diff.js
var tagName = "monaco-diff";
var MONACO_THEMES = ["vs", "vs-dark", "hc-black", "hc-light"];
function isMonacoTheme(value) {
  return MONACO_THEMES.includes(value);
}
function parseThemeAttribute(value) {
  if (value && isMonacoTheme(value)) {
    return value;
  }
  return void 0;
}
var MonacoDiffElement = class extends HTMLElement {
  static tagName = tagName;
  static get observedAttributes() {
    return ["theme", "language"];
  }
  _container;
  _manager = null;
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
          min-height: 200px;
        }
        .container {
          width: 100%;
          height: 100%;
        }
      </style>
      <div class="container"></div>
    `;
    this._container = this.shadowRoot.querySelector(".container");
  }
  connectedCallback() {
    if (this._manager) {
      return;
    }
    const theme = parseThemeAttribute(this.getAttribute("theme"));
    const language = this.getAttribute("language") ?? void 0;
    this._manager = new MonacoDiffManager(this._container, {
      host: this,
      language,
      editorOptions: {
        theme
      }
    });
  }
  attributeChangedCallback(name, _oldValue, newValue) {
    if (name === "theme") {
      void this._applyTheme(parseThemeAttribute(newValue));
    } else if (name === "language") {
      void this._applyLanguage(newValue ?? void 0);
    }
  }
  disconnectedCallback() {
    this._manager?.destroy();
    this._manager = null;
  }
  /** Promise that resolves when the editor has finished loading and is safe to use. */
  whenReady() {
    if (!this._manager) {
      throw new Error("<monaco-diff>: not connected");
    }
    return this._manager.whenReady();
  }
  getManager() {
    if (!this._manager) {
      throw new Error("<monaco-diff>: not connected");
    }
    return this._manager;
  }
  async _applyTheme(theme) {
    if (!this._manager) {
      return;
    }
    await this.whenReady();
    const monaco = await hydrateCache();
    monaco.editor.setTheme(theme ?? "vs");
  }
  async _applyLanguage(language) {
    if (!this._manager) {
      return;
    }
    await this.whenReady();
    this._manager.setLanguage(language);
  }
};
customElements.define(tagName, MonacoDiffElement);

// web-component/Module.ts
/** @es.ts 
{
   mode: "bundle",
   extension: ".js",
   options: {
   }
}
@es.ts */// export * from "./react.js"
export {
  MONACO_GENERATED,
  MONACO_THEMES,
  MonacoDiffElement,
  MonacoDiffManager,
  SCRIPT_TYPE_MODIFIED,
  SCRIPT_TYPE_ORIGINAL,
  hydrateCache,
  isMonacoTheme,
  readDeclarativeDiffScripts,
  tagName
};
