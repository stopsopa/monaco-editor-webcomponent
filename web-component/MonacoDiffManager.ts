/**
 * Monaco diff editor manager — the engine behind `<composite-monaco-diff>`.
 *
 * Purpose:
 *   - loads Monaco once per page through its AMD loader (CDN list below, with fallback + timeout),
 *   - mounts one side-by-side diff editor into a container (also inside a shadow root),
 *   - owns the two text models, their languages, the theme and the read-only state.
 *
 * Usage (run in a browser, any directory — it only needs a sized container):
 *
 *   import { MonacoDiffManager, configureMonaco } from "./MonacoDiffManager.js";
 *
 *   // optional, must happen before the first editor is created:
 *   configureMonaco({ vs: "https://my.cdn/monaco-editor@0.55.1/min/vs" });
 *
 *   const mgr = new MonacoDiffManager(container, { original: "a", modified: "b", language: "javascript" });
 *   const { editor, monaco, original, modified } = await mgr.whenReady();
 *   mgr.setLanguage("typescript");      // both sides, unless a per-side language is set
 *   mgr.setModifiedLanguage("json");    // per-side language always wins over the shared one
 *   mgr.setOriginal("new text");        // safe before ready - queued
 *   mgr.destroy();
 *
 * Important:
 *   - Every setter is safe to call before `whenReady()` resolves: the value is stored and used when
 *     the editor is created.
 *   - The editor is read-only by default (it is a diff *viewer*). Pass `editorOptions: { readOnly: false }`
 *     or call `setReadOnly(false)` to allow editing of the modified side, and subscribe with `onChange()`.
 *   - Monaco's theme is global: `setTheme()` re-themes every Monaco editor on the page.
 *   - `destroy()` before ready makes `whenReady()` reject with `MonacoDiffDestroyedError`.
 *   - The `// autogenerate` block is rewritten by: npm run monaco -- --skip
 */

import type * as Monaco from "monaco-editor";
import trimLeft from "./trimLeft.js";

const th = (msg: string) => new Error(`web-component/MonacoDiffManager.ts error: ${msg}`);

// autogenerate v
export const MONACO_GENERATED = {
  "version": "0.55.1",
  "vs": [
    "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs",
    "https://unpkg.com/monaco-editor@0.55.1/min/vs",
    "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.55.1/min/vs",
    "/monaco/vs"
  ]
} as const;
// autogenerate ^

export type MonacoGenerated = typeof MONACO_GENERATED;

type AmdRequire = {
  config: (cfg: { paths: Record<string, string> }) => void;
  (deps: string[], cb: () => void, errCb?: (err: unknown) => void): void;
};

type MonacoWindow = Window & {
  require?: unknown;
  define?: unknown;
  monaco?: typeof Monaco;
};

/** How long one source may take (loader + editor.main) before the next one is tried. */
const DEFAULT_LOAD_TIMEOUT_MS = 15_000;

/** How long we wait for Monaco's stylesheet inside a shadow root before giving up on it (editor still mounts). */
const STYLESHEET_TIMEOUT_MS = 10_000;

let cachedMonaco: typeof Monaco | null = null;
/** Base URL Monaco was loaded from *by this module*. Stays null when the page already had `window.monaco`. */
let cachedVsBase: string | null = null;
let loadingPromise: Promise<typeof Monaco> | null = null;

let configuredVs: string[] | null = null;
let configuredTimeoutMs: number = DEFAULT_LOAD_TIMEOUT_MS;

/** `<script src=".../loader.js">` added by this module, kept only until Monaco is loaded. */
let injectedLoaderScript: HTMLScriptElement | null = null;

export type MonacoConfig = {
  /**
   * Base URL(s) of Monaco's `min/vs` directory, tried in order.
   * Example: "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs" or "/assets/monaco/vs" (self-hosted).
   */
  vs?: string | readonly string[];
  /** Per-source timeout in milliseconds. Default 15000. */
  timeoutMs?: number;
};

function effectiveVs(): readonly string[] {
  return configuredVs ?? MONACO_GENERATED.vs;
}

/**
 * Overrides where Monaco is loaded from (self-hosting, air-gapped environments, pinning a version).
 * Must be called before the first editor is created. Calling it later with a different `vs` throws,
 * because Monaco can be loaded only once per page.
 */
export function configureMonaco(config: MonacoConfig): void {
  if (config.timeoutMs !== undefined) {
    if (!(config.timeoutMs > 0)) {
      throw th(`configureMonaco(): timeoutMs must be a positive number, got >${config.timeoutMs}<`);
    }
    configuredTimeoutMs = config.timeoutMs;
  }

  if (config.vs === undefined) {
    return;
  }

  const list = (typeof config.vs === "string" ? [config.vs] : Array.from(config.vs)).map((vs) => {
    if (typeof vs !== "string" || !vs.trim()) {
      throw th(`configureMonaco(): every 'vs' entry must be a non-empty string, got >${String(vs)}<`);
    }
    return vs.trim().replace(/\/+$/, "");
  });

  if (list.length === 0) {
    throw th(`configureMonaco(): 'vs' must contain at least one url`);
  }

  if (loadingPromise || cachedMonaco) {
    if (JSON.stringify(list) !== JSON.stringify(effectiveVs())) {
      throw th(
        `configureMonaco(): Monaco already started loading from >${effectiveVs().join(", ")}<, ` +
          `call configureMonaco() before the first editor is created`,
      );
    }
    return;
  }

  configuredVs = list;
}

/** Monaco AMD injects editor CSS into `document`; shadow roots need their own copy. */
const MONACO_VS_STYLESHEET = /\/vs\/(base|editor|platform)/;

/**
 * Marker on `<link rel="stylesheet">` nodes we inject into a shadow root.
 * Purpose: tag “our” Monaco CSS copies so we do not insert duplicates on reconnect
 * or second editor in the same shadow tree. Usage: set on each cloned/created link
 * before append; `ensureMonacoStylesInShadowRoot` bails out if one is already present.
 */
const MONACO_SHADOW_STYLES_ATTR = "data-monaco-shadow-styles";

/**
 * Waits until a CSS file linked in the page has finished loading (or is already loaded).
 * Never rejects: a missing stylesheet must not prevent the editor from mounting, so a failure
 * or a timeout is only reported with console.warn.
 */
function loadStylesheetLink(link: HTMLLinkElement): Promise<void> {
  if (link.sheet) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      console.warn(`web-component/MonacoDiffManager.ts: Monaco stylesheet still not loaded, continuing: ${link.href}`);
      resolve();
    }, STYLESHEET_TIMEOUT_MS);

    link.addEventListener(
      "load",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    link.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        console.warn(`web-component/MonacoDiffManager.ts: failed to load Monaco stylesheet: ${link.href}`);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Puts Monaco’s CSS inside the web component’s shadow DOM so the editor looks correct
 * there (normal page CSS does not reach inside a shadow root).
 *
 * Each injected stylesheet is marked with {@link MONACO_SHADOW_STYLES_ATTR} so this
 * runs only once per shadow root.
 */
async function ensureMonacoStylesInShadowRoot(container: HTMLElement): Promise<void> {
  const root = container.getRootNode();
  if (!(root instanceof ShadowRoot)) {
    return;
  }

  if (root.querySelector(`[${MONACO_SHADOW_STYLES_ATTR}]`)) {
    return;
  }

  const documentLinks = Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel='stylesheet']")).filter(
    (link) => {
      const href = link.getAttribute("href") ?? "";
      return MONACO_VS_STYLESHEET.test(href);
    },
  );

  const loads: Promise<void>[] = [];

  for (const documentLink of documentLinks) {
    const clone = documentLink.cloneNode(true) as HTMLLinkElement;
    clone.setAttribute(MONACO_SHADOW_STYLES_ATTR, "");
    loads.push(loadStylesheetLink(clone));
    root.insertBefore(clone, root.firstChild);
  }

  // Only when this module loaded Monaco itself do we know which base (and version) the CSS belongs to.
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

function isAmdRequire(value: unknown): value is AmdRequire {
  return typeof value === "function" && typeof (value as { config?: unknown }).config === "function";
}

/**
 * Cleans up after a failed attempt so the next source gets a fair try.
 *
 * - The loader script itself did not load: remove our <script> tag, the next source injects its own.
 * - The loader is there but a module failed (editor.main blocked, 404, timeout): the loader cannot be
 *   loaded a second time (it declares top-level `const`s), so it is kept and only asked to forget what
 *   it knows (`require.reset()`), otherwise it would never request the failed module again.
 */
function resetLoaderAfterFailure(): void {
  const amdRequire = (window as unknown as MonacoWindow).require;

  if (isAmdRequire(amdRequire)) {
    const reset = (amdRequire as unknown as { reset?: unknown }).reset;
    if (typeof reset === "function") {
      try {
        reset.call(amdRequire);
      } catch {
        // a loader without a working reset(): nothing more we can do, the next source is tried anyway
      }
    }
    return;
  }

  injectedLoaderScript?.remove();
  injectedLoaderScript = null;
}

/**
 * Downloads and starts Monaco from a given base URL (CDN or self-hosted `.../vs`),
 * using the same loader script the official samples use.
 *
 * Resolves with `vsBase: null` when Monaco was already on the page and nothing had to be loaded.
 */
function loadMonaco(vsBase: string, timeoutMs: number): Promise<{ monaco: typeof Monaco; vsBase: string | null }> {
  return new Promise((resolve, reject) => {
    const win = window as unknown as MonacoWindow;

    let settled = false;

    const timer = setTimeout(() => {
      fail(th(`timed out after ${timeoutMs}ms while loading Monaco from ${vsBase}`));
    }, timeoutMs);

    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err instanceof Error ? err : th(`loading Monaco from ${vsBase} failed: ${String(err)}`));
    };

    const succeed = (monaco: typeof Monaco, base: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ monaco, vsBase: base });
    };

    const requireEditor = (amdRequire: AmdRequire) => {
      try {
        amdRequire.config({ paths: { vs: vsBase } });
        amdRequire(
          ["vs/editor/editor.main"],
          () => {
            if (win.monaco) {
              succeed(win.monaco, vsBase);
            } else {
              fail(th(`Monaco did not initialize from ${vsBase}`));
            }
          },
          (err) => {
            fail(th(`failed to load vs/editor/editor.main from ${vsBase}: ${describeError(err)}`));
          },
        );
      } catch (err) {
        fail(err);
      }
    };

    if (win.monaco?.editor) {
      succeed(win.monaco, null);
      return;
    }

    if (win.require !== undefined) {
      if (!isAmdRequire(win.require)) {
        fail(
          th(
            `a global 'require' that is not an AMD loader is present (CommonJS / Electron nodeIntegration?), ` +
              `Monaco's AMD loader cannot be used next to it. Load Monaco yourself (window.monaco) before creating the editor`,
          ),
        );
        return;
      }

      // An AMD loader (Monaco's own or RequireJS) is already on the page - reuse it.
      requireEditor(win.require);
      return;
    }

    const script = document.createElement("script");
    script.src = `${vsBase}/loader.js`;
    script.async = true;
    script.onload = () => {
      if (isAmdRequire(win.require)) {
        requireEditor(win.require);
      } else {
        fail(th(`${vsBase}/loader.js loaded but did not define an AMD 'require'`));
      }
    };
    script.onerror = () => fail(th(`failed to load Monaco loader from ${vsBase}/loader.js`));
    injectedLoaderScript = script;
    document.head.appendChild(script);
  });
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Loads Monaco once and keeps it in memory. Tries each configured URL until one works,
 * so the app still runs if a CDN is down. Sources come from {@link configureMonaco} or,
 * by default, from {@link MONACO_GENERATED}.
 */
export function hydrateCache(): Promise<typeof Monaco> {
  if (cachedMonaco) {
    return Promise.resolve(cachedMonaco);
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  const sources = effectiveVs();
  const timeoutMs = configuredTimeoutMs;

  loadingPromise = (async () => {
    const errors: Error[] = [];

    for (const vsBase of sources) {
      try {
        const loaded = await loadMonaco(vsBase, timeoutMs);
        cachedMonaco = loaded.monaco;
        cachedVsBase = loaded.vsBase;
        // the loader stays on the page from now on - Monaco keeps using it for lazy language chunks
        injectedLoaderScript = null;
        return cachedMonaco;
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)));
        resetLoaderAfterFailure();
      }
    }

    loadingPromise = null;
    throw new AggregateError(
      errors,
      `web-component/MonacoDiffManager.ts error: failed to load monaco-editor from all sources: ` +
        errors.map((e) => e.message).join(" | "),
    );
  })();

  return loadingPromise;
}

/**
 * Sets Monaco's theme. The theme is a global Monaco setting - this changes every Monaco editor on the page,
 * not just one `<composite-monaco-diff>`. Loads Monaco first when needed.
 */
export async function setMonacoTheme(theme: string): Promise<void> {
  const monaco = await hydrateCache();
  monaco.editor.setTheme(theme);
}

export const SCRIPT_TYPE_ORIGINAL = "text/original" as const;
export const SCRIPT_TYPE_MODIFIED = "text/modified" as const;

export interface DeclarativeDiffContent {
  original: string;
  modified: string;
  originalLanguage?: string;
  modifiedLanguage?: string;
}

/**
 * Reads the optional `data-offset` attribute: how many spaces to put in front of every line
 * after the common indentation was removed. Missing / empty means 0.
 */
export function readOffset(raw: string | null, type: string): number {
  if (raw === null || raw.trim() === "") {
    return 0;
  }

  if (!/^\d+$/.test(raw.trim())) {
    throw th(
      `<composite-monaco-diff> <script type="${type}">: data-offset must be a non-negative integer, got >${raw}<`,
    );
  }

  return Number(raw.trim());
}

/**
 * Turns the raw text of a `<script type="text/original|text/modified">` into editor content:
 * drops the line break right after the opening tag and the whitespace-only line before the closing tag,
 * removes the common indentation and then indents by `offset` spaces.
 */
export function normalizeDeclarativeText(text: string, offset: number): string {
  return trimLeft(text.replace(/^[ \t]*\r?\n/, "").replace(/\r?\n[ \t]*$/, ""), offset);
}

/**
 * Reads the “before” and “after” code from `<script>` tags inside the element (HTML-first setup).
 * Returns nothing if there are no such scripts; throws if the markup is incomplete or wrong.
 *
 * Only direct children with type="text/original" / type="text/modified" are considered, any other
 * `<script>` child is ignored. The scripts are left in the DOM: they stay the source of truth,
 * so the element can be moved or re-attached (and React can keep owning them).
 */
export function readDeclarativeDiffScripts(host: HTMLElement): DeclarativeDiffContent | null {
  const scripts = Array.from(
    host.querySelectorAll<HTMLScriptElement>(
      `:scope > script[type="${SCRIPT_TYPE_ORIGINAL}"], :scope > script[type="${SCRIPT_TYPE_MODIFIED}"]`,
    ),
  );

  if (scripts.length === 0) {
    return null;
  }

  let originalScript: HTMLScriptElement | undefined;
  let modifiedScript: HTMLScriptElement | undefined;

  for (const script of scripts) {
    const type = script.getAttribute("type");

    if (type === SCRIPT_TYPE_ORIGINAL) {
      if (originalScript) {
        throw th(`<composite-monaco-diff>: duplicate <script type="${SCRIPT_TYPE_ORIGINAL}">`);
      }
      originalScript = script;
    } else if (type === SCRIPT_TYPE_MODIFIED) {
      if (modifiedScript) {
        throw th(`<composite-monaco-diff>: duplicate <script type="${SCRIPT_TYPE_MODIFIED}">`);
      }
      modifiedScript = script;
    }
  }

  if (!originalScript || !modifiedScript) {
    const missing = !originalScript ? SCRIPT_TYPE_ORIGINAL : SCRIPT_TYPE_MODIFIED;
    throw th(`<composite-monaco-diff>: missing <script type="${missing}">`);
  }

  const originalOffset = readOffset(originalScript.getAttribute("data-offset"), SCRIPT_TYPE_ORIGINAL);
  const modifiedOffset = readOffset(modifiedScript.getAttribute("data-offset"), SCRIPT_TYPE_MODIFIED);

  return {
    original: normalizeDeclarativeText(originalScript.textContent ?? "", originalOffset),
    modified: normalizeDeclarativeText(modifiedScript.textContent ?? "", modifiedOffset),
    originalLanguage: originalScript.getAttribute("lang") || undefined,
    modifiedLanguage: modifiedScript.getAttribute("lang") || undefined,
  };
}

export const DEFAULT_LANGUAGE = "javascript";

/**
 * Figures out what text and per-side language to show: explicit options win, then the HTML scripts,
 * then empty strings. The shared language is not resolved here - see `MonacoDiffManager._languageFor()`.
 */
function resolveDiffContent(options: MonacoDiffManagerOptions): {
  original: string;
  modified: string;
  originalLanguage: string | undefined;
  modifiedLanguage: string | undefined;
} {
  const declarative = options.host ? readDeclarativeDiffScripts(options.host) : null;

  return {
    original: options.original ?? declarative?.original ?? "",
    modified: options.modified ?? declarative?.modified ?? "",
    originalLanguage: options.originalLanguage ?? declarative?.originalLanguage,
    modifiedLanguage: options.modifiedLanguage ?? declarative?.modifiedLanguage,
  };
}

export interface MonacoDiffManagerOptions {
  /** When set, reads optional declarative `<script>` children before creating models. */
  host?: HTMLElement;
  /** Wins over the declarative `<script type="text/original">`. */
  original?: string;
  /** Wins over the declarative `<script type="text/modified">`. */
  modified?: string;
  /** Applies to a side only when that side has no language of its own. */
  language?: string;
  /** Wins over `<script lang>` and over the shared `language`. */
  originalLanguage?: string;
  /** Wins over `<script lang>` and over the shared `language`. */
  modifiedLanguage?: string;
  /** Extra Monaco options. Defaults: `readOnly: true`, `originalEditable: false` (diff viewer). */
  editorOptions?: Monaco.editor.IStandaloneDiffEditorConstructionOptions;
}

/** What `whenReady()` resolves with - everything needed to work with the editor without null checks. */
export interface MonacoDiffReady {
  monaco: typeof Monaco;
  editor: Monaco.editor.IStandaloneDiffEditor;
  original: Monaco.editor.ITextModel;
  modified: Monaco.editor.ITextModel;
}

export interface MonacoDiffContent {
  original: string;
  modified: string;
}

export type MonacoDiffChangeListener = (content: MonacoDiffContent) => void;

/** Rejection reason of `whenReady()` when the manager was destroyed before (or after) it became ready. */
export class MonacoDiffDestroyedError extends Error {
  constructor() {
    super("web-component/MonacoDiffManager.ts error: MonacoDiffManager was destroyed");
    this.name = "MonacoDiffDestroyedError";
  }
}

type Side = "original" | "modified";

export class MonacoDiffManager {
  private _readyPromise: Promise<MonacoDiffReady>;
  private _ready: MonacoDiffReady | null = null;
  private _destroyed = false;
  private _resizeObserver: ResizeObserver | null = null;
  private _layoutRaf: number | null = null;
  private _disposables: Monaco.IDisposable[] = [];
  private _changeListeners = new Set<MonacoDiffChangeListener>();

  /** Text to use when the models are created; kept up to date by setOriginal()/setModified() before ready. */
  private _content: MonacoDiffContent = { original: "", modified: "" };
  private _sharedLanguage: string | undefined;
  private _sideLanguage: Record<Side, string | undefined> = { original: undefined, modified: undefined };
  private _theme: string | undefined;
  private _readOnly: boolean;

  protected _container: HTMLElement;

  /**
   * Mounts a side-by-side diff editor into the given element: loads Monaco, applies styles,
   * fills in original/modified text, and starts watching size changes.
   *
   * Never throws: wrong declarative markup or a failed Monaco download reject `whenReady()`.
   */
  constructor(container: HTMLElement, options: MonacoDiffManagerOptions = {}) {
    this._container = container;
    container.style.height = "100%";
    container.style.width = "100%";

    this._sharedLanguage = options.language || undefined;
    this._theme = options.editorOptions?.theme;
    this._readOnly = options.editorOptions?.readOnly ?? true;

    this._readyPromise = this._init(options);

    // Whoever awaits whenReady() still gets the rejection; this only stops the browser from reporting
    // "unhandled promise rejection" when nobody does (e.g. element removed while Monaco was loading).
    this._readyPromise.catch(() => {});
  }

  private async _init(options: MonacoDiffManagerOptions): Promise<MonacoDiffReady> {
    // Synchronous part (runs inside the constructor): a markup error becomes a rejection of whenReady().
    const content = resolveDiffContent(options);
    this._content = { original: content.original, modified: content.modified };
    this._sideLanguage = { original: content.originalLanguage, modified: content.modifiedLanguage };

    const container = this._container;

    const monaco = await hydrateCache();
    this._assertAlive();

    await ensureMonacoStylesInShadowRoot(container);
    this._assertAlive();

    const editor = monaco.editor.createDiffEditor(container, {
      automaticLayout: false,
      scrollbar: {
        vertical: "auto",
      },
      scrollBeyondLastLine: false,
      originalEditable: false,
      ...options.editorOptions,
      // these three can be changed through setters while Monaco was loading - the latest value wins
      readOnly: this._readOnly,
      ...(this._theme ? { theme: this._theme } : {}),
    });

    const original = monaco.editor.createModel(this._content.original, this._languageFor("original"));
    const modified = monaco.editor.createModel(this._content.modified, this._languageFor("modified"));

    editor.setModel({ original, modified });

    for (const model of [original, modified]) {
      this._disposables.push(
        model.onDidChangeContent((event) => {
          // isFlush = setValue(): programmatic replacement, not an edit made by the user
          if (event.isFlush) return;
          this._emitChange();
        }),
      );
    }

    this._ready = { monaco, editor, original, modified };

    this._scheduleLayout();

    this._resizeObserver = new ResizeObserver(() => this._scheduleLayout());
    this._resizeObserver.observe(container);

    return this._ready;
  }

  private _assertAlive(): void {
    if (this._destroyed) {
      throw new MonacoDiffDestroyedError();
    }
  }

  /** One rule for both init and later changes: per-side language, else shared language, else the default. */
  private _languageFor(side: Side): string {
    return this._sideLanguage[side] ?? this._sharedLanguage ?? DEFAULT_LANGUAGE;
  }

  private _applyLanguages(): void {
    const ready = this._ready;
    if (!ready) return;

    for (const side of ["original", "modified"] as const) {
      const language = this._languageFor(side);
      if (ready[side].getLanguageId() !== language) {
        ready.monaco.editor.setModelLanguage(ready[side], language);
      }
    }
  }

  private _emitChange(): void {
    if (this._changeListeners.size === 0) return;
    const content = this.getContent();
    for (const listener of Array.from(this._changeListeners)) {
      listener(content);
    }
  }

  private _setSide(side: Side, value: string): void {
    if (typeof value !== "string") {
      throw th(`${side} content must be a string, got >${value === null ? "null" : typeof value}<`);
    }

    if (this._destroyed) return;

    this._content[side] = value;

    const model = this._ready?.[side];
    if (model && model.getValue() !== value) {
      model.setValue(value);
    }
  }

  private _getSide(side: Side): string {
    return this._ready ? this._ready[side].getValue() : this._content[side];
  }

  /**
   * Promise that resolves with `{ monaco, editor, original, modified }` when the editor is safe to use.
   * Rejects when the markup was wrong, Monaco could not be loaded, or the manager was destroyed.
   */
  public whenReady(): Promise<MonacoDiffReady> {
    if (this._destroyed) {
      return Promise.reject(new MonacoDiffDestroyedError());
    }
    return this._readyPromise;
  }

  public isDestroyed(): boolean {
    return this._destroyed;
  }

  /** Returns the underlying Monaco diff editor instance (or null if not ready yet / destroyed). */
  public getEditor(): Monaco.editor.IStandaloneDiffEditor | null {
    return this._ready?.editor ?? null;
  }

  /** Returns the global Monaco API instance (or null if not loaded yet). */
  public getMonaco(): typeof Monaco | null {
    return cachedMonaco;
  }

  /** Replaces the text of the original (left) side. Before ready the value is kept and used on creation. */
  public setOriginal(value: string): void {
    this._setSide("original", value);
  }

  /** Replaces the text of the modified (right) side. Before ready the value is kept and used on creation. */
  public setModified(value: string): void {
    this._setSide("modified", value);
  }

  public getOriginal(): string {
    return this._getSide("original");
  }

  public getModified(): string {
    return this._getSide("modified");
  }

  public getContent(): MonacoDiffContent {
    return { original: this.getOriginal(), modified: this.getModified() };
  }

  /**
   * Sets the shared language. It applies to a side only when that side has no language of its own
   * (`setOriginalLanguage()` / `setModifiedLanguage()` / `<script lang>`). `undefined` = no shared language.
   */
  public setLanguage(language: string | undefined): void {
    this._sharedLanguage = language || undefined;
    this._applyLanguages();
  }

  /** Per-side language, wins over the shared one. `undefined` hands the side back to the shared language. */
  public setOriginalLanguage(language: string | undefined): void {
    this._sideLanguage.original = language || undefined;
    this._applyLanguages();
  }

  /** Per-side language, wins over the shared one. `undefined` hands the side back to the shared language. */
  public setModifiedLanguage(language: string | undefined): void {
    this._sideLanguage.modified = language || undefined;
    this._applyLanguages();
  }

  /** The three language inputs as they were set (not the effective languages). */
  public getLanguages(): { language?: string; originalLanguage?: string; modifiedLanguage?: string } {
    return {
      language: this._sharedLanguage,
      originalLanguage: this._sideLanguage.original,
      modifiedLanguage: this._sideLanguage.modified,
    };
  }

  /** Sets Monaco's theme. WARNING: global - it changes every Monaco editor on the page. */
  public setTheme(theme: string): void {
    if (typeof theme !== "string" || !theme) return;
    this._theme = theme;
    this._ready?.monaco.editor.setTheme(theme);
  }

  /** `false` lets the user type in the modified side (subscribe with `onChange()`), `true` = viewer. */
  public setReadOnly(readOnly: boolean): void {
    this._readOnly = readOnly;
    this._ready?.editor.updateOptions({ readOnly });
  }

  public isReadOnly(): boolean {
    return this._readOnly;
  }

  /**
   * Subscribes to edits made by the user in the editor (not to setOriginal()/setModified()).
   * Returns an unsubscribe function.
   */
  public onChange(listener: MonacoDiffChangeListener): () => void {
    this._changeListeners.add(listener);
    return () => {
      this._changeListeners.delete(listener);
    };
  }

  /**
   * Tears down the editor, frees memory, and stops listening for resize events. Safe to call at any
   * moment (also while Monaco is still loading) and more than once.
   */
  public destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this._resizeObserver?.disconnect();
    this._resizeObserver = null;

    if (this._layoutRaf !== null) {
      cancelAnimationFrame(this._layoutRaf);
      this._layoutRaf = null;
    }

    for (const disposable of this._disposables) {
      disposable.dispose();
    }
    this._disposables = [];
    this._changeListeners.clear();

    const ready = this._ready;
    this._ready = null;

    if (ready) {
      // keep the last text readable through getOriginal()/getModified() after the models are gone
      this._content = { original: ready.original.getValue(), modified: ready.modified.getValue() };
      // Note: when a diff computation is still pending (text set a moment ago) Monaco logs
      // "Uncaught (in promise) Canceled" on dispose. It is Monaco's own CancellationError, harmless,
      // and cannot be intercepted from here when Monaco comes from a CDN (cross-origin script).
      ready.editor.dispose();
      ready.original.dispose();
      ready.modified.dispose();
    }
  }

  /** Resizes the editor to match its container on the next animation frame (avoids jank). */
  private _scheduleLayout() {
    if (this._layoutRaf !== null) return;

    this._layoutRaf = requestAnimationFrame(() => {
      this._layoutRaf = null;

      const editor = this._ready?.editor;
      if (!editor) return;

      const { width, height } = this._container.getBoundingClientRect();

      if (width === 0 || height === 0) {
        return;
      }

      editor.layout({ width, height });
    });
  }
}
