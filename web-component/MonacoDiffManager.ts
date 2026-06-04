/**
 * Monaco diff editor manager. Refresh version/CDN URLs: pnpm run monaco -- --skip
 */

import type * as Monaco from "monaco-editor";
import trimLeft from "./trimLeft.js";

// autogenerate v
export const MONACO_GENERATED = {
  "version": "0.55.1",
  "vs": [
    "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs",
    "https://unpkg.com/monaco-editor@0.55.1/min/vs",
    "/monaco/vs"
  ]
} as const;
// autogenerate ^

export type MonacoGenerated = typeof MONACO_GENERATED;

type MonacoWindow = Window & {
  require?: {
    config: (cfg: { paths: Record<string, string> }) => void;
    (deps: string[], cb: () => void, errCb?: (err: unknown) => void): void;
  };
  monaco?: typeof Monaco;
};

let cachedMonaco: typeof Monaco | null = null;
let cachedVsBase: string | null = null;
let loadingPromise: Promise<typeof Monaco> | null = null;

/** Monaco AMD injects editor CSS into `document`; shadow roots need their own copy. */
const MONACO_VS_STYLESHEET = /\/vs\/(base|editor|platform)/;

/**
 * Marker on `<link rel="stylesheet">` nodes we inject into a shadow root.
 * Purpose: tag “our” Monaco CSS copies so we do not insert duplicates on reconnect
 * or second editor in the same shadow tree. Usage: set on each cloned/created link
 * before append; `ensureMonacoStylesInShadowRoot` bails out if one is already present.
 */
const MONACO_SHADOW_STYLES_ATTR = "data-monaco-shadow-styles";

/** Waits until a CSS file linked in the page has finished loading (or is already loaded). */
function loadStylesheetLink(link: HTMLLinkElement): Promise<void> {
  if (link.sheet) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    link.addEventListener("load", () => resolve(), { once: true });
    link.addEventListener("error", () => reject(new Error(`Failed to load Monaco stylesheet: ${link.href}`)), {
      once: true,
    });
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

/**
 * Downloads and starts Monaco from a given base URL (CDN or local `/monaco/vs`),
 * using the same loader script the official samples use.
 */
function loadMonaco(vsBase: string): Promise<typeof Monaco> {
  return new Promise<typeof Monaco>((resolve, reject) => {
    const win = window as unknown as MonacoWindow;

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

/**
 * Loads Monaco once and keeps it in memory. Tries each configured URL until one works,
 * so the app still runs if a CDN is down.
 */
export function hydrateCache(generated: MonacoGenerated = MONACO_GENERATED): Promise<typeof Monaco> {
  if (cachedMonaco) {
    return Promise.resolve(cachedMonaco);
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    const errors: Error[] = [];

    for (const vsBase of generated.vs) {
      try {
        cachedMonaco = await loadMonaco(vsBase);
        cachedVsBase = vsBase;
        return cachedMonaco;
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }

    loadingPromise = null;
    throw new AggregateError(errors, `Failed to load monaco-editor@${generated.version} from all sources`);
  })();

  return loadingPromise;
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
 * Reads the “before” and “after” code from `<script>` tags inside the element (HTML-first setup).
 * Returns nothing if there are no scripts; throws if the markup is incomplete or wrong.
 */
export function readDeclarativeDiffScripts(host: HTMLElement): DeclarativeDiffContent | null {
  const scripts = Array.from(host.querySelectorAll<HTMLScriptElement>(":scope > script"));

  if (scripts.length === 0) {
    return null;
  }

  if (scripts.length < 2) {
    throw new Error(
      `<monaco-diff>: expected exactly at leasttwo <script> elements (type="${SCRIPT_TYPE_ORIGINAL}" and type="${SCRIPT_TYPE_MODIFIED}"), found ${scripts.length}`,
    );
  }

  let originalScript: HTMLScriptElement | undefined;
  let modifiedScript: HTMLScriptElement | undefined;

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

  let original = originalScript.textContent ?? "";
  let modified = modifiedScript.textContent ?? "";

  const originalLanguage = originalScript.getAttribute("lang") ?? undefined;
  const modifiedLanguage = modifiedScript.getAttribute("lang") ?? undefined;

  let originalOffset = parseInt(originalScript.getAttribute("data-offset") as string, 10) ?? 0;
  let modifiedOffset = parseInt(modifiedScript.getAttribute("data-offset") as string, 10) ?? 0;

  if (!(originalOffset > 0)) {
    throw new Error(
      `<monaco-diff><script type='text/original'>: data-offset must be a positive integer >${originalOffset}<`,
    );
  }

  if (!(modifiedOffset > 0)) {
    throw new Error(
      `<monaco-diff><script type='text/modified'>: data-offset must be a positive integer >${modifiedOffset}<`,
    );
  }

  original = trimLeft(original, originalOffset);
  modified = trimLeft(modified, modifiedOffset);

  originalScript.remove();
  modifiedScript.remove();

  return { original, modified, originalLanguage, modifiedLanguage };
}

const DEFAULT_LANGUAGE = "javascript";

/**
 * Figures out what text and language to show on each side: from options, from HTML scripts,
 * or empty strings with a sensible default language.
 */
function resolveDiffContent(options: MonacoDiffManagerOptions): {
  original: string;
  modified: string;
  originalLanguage: string;
  modifiedLanguage: string;
} {
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

export interface MonacoDiffManagerOptions {
  /** When set, reads optional declarative `<script>` children before creating models. */
  host?: HTMLElement;
  original?: string;
  modified?: string;
  /** Applies to both sides when `originalLanguage` / `modifiedLanguage` are not set. */
  language?: string;
  originalLanguage?: string;
  modifiedLanguage?: string;
  editorOptions?: Monaco.editor.IStandaloneDiffEditorConstructionOptions;
}

export class MonacoDiffManager {
  private _readyPromise: Promise<void>;
  private _editor: Monaco.editor.IStandaloneDiffEditor | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  private _layoutRaf: number | null = null;

  /**
   * Mounts a side-by-side diff editor into the given element: loads Monaco, applies styles,
   * fills in original/modified text, and starts watching size changes.
   */
  constructor(
    private readonly _container: HTMLElement,
    options: MonacoDiffManagerOptions,
  ) {
    _container.style.height = "100%";
    _container.style.width = "100%";

    const { original, modified, originalLanguage, modifiedLanguage } = resolveDiffContent(options);

    this._readyPromise = (async () => {
      const monaco = await hydrateCache(MONACO_GENERATED);

      await ensureMonacoStylesInShadowRoot(this._container);

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

  /** Promise that resolves when the editor has finished loading and is safe to use. */
  public whenReady() {
    return this._readyPromise;
  }

  /** Returns the underlying Monaco diff editor instance (or null if not ready yet). */
  public getEditor() {
    return this._editor;
  }

  /** Returns the global Monaco API instance (or null if not loaded yet). */
  public getMonaco() {
    return cachedMonaco;
  }

  /** Tears down the editor, frees memory, and stops listening for resize events. */
  public destroy() {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;

    if (this._layoutRaf !== null) {
      cancelAnimationFrame(this._layoutRaf);
      this._layoutRaf = null;
    }

    const model = this._editor?.getModel();
    this._editor?.dispose();
    this._editor = null;
    model?.original.dispose();
    model?.modified.dispose();
  }

  /** Updates the language for both sides of the diff editor. Falls back to the default language when undefined. */
  public setLanguage(language: string | undefined): void {
    const model = this._editor?.getModel();
    if (!model) return;

    const lang = language ?? DEFAULT_LANGUAGE;
    cachedMonaco?.editor.setModelLanguage(model.original, lang);
    cachedMonaco?.editor.setModelLanguage(model.modified, lang);
  }

  /** Resizes the editor to match its container on the next animation frame (avoids jank). */
  private _scheduleLayout() {
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
