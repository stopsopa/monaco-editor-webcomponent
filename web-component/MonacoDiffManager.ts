/**
 * Monaco diff editor manager. Refresh version/CDN URLs: pnpm run monaco -- --skip
 */

import type * as Monaco from "monaco-editor";

// autogenerate v
export const MONACO_GENERATED = {
  version: "0.55.1",
  vs: [
    "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs",
    "https://unpkg.com/monaco-editor@0.55.1/min/vs",
    "/monaco/vs",
  ],
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

/** Monaco AMD injects editor CSS into `document`; shadow roots need their own copy. */
const MONACO_VS_STYLESHEET = /\/vs\/(base|editor|platform)/;

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
 * Copies Monaco's global stylesheet links into a shadow root so editor layout and
 * themes render correctly inside `<monaco-diff>`.
 */
async function ensureMonacoStylesInShadowRoot(container: HTMLElement): Promise<void> {
  const root = container.getRootNode();
  if (!(root instanceof ShadowRoot)) {
    return;
  }

  if (root.querySelector("[data-monaco-shadow-styles]")) {
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
    clone.setAttribute("data-monaco-shadow-styles", "");
    loads.push(loadStylesheetLink(clone));
    root.insertBefore(clone, root.firstChild);
  }

  if (documentLinks.length === 0 && cachedVsBase) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${cachedVsBase}/editor/editor.main.css`;
    link.setAttribute("data-monaco-shadow-styles", "");
    loads.push(loadStylesheetLink(link));
    root.insertBefore(link, root.firstChild);
  }

  await Promise.all(loads);
}

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

/** Try each `/min/vs` URL in order until Monaco loads. */
export async function hydrateCache(generated: MonacoGenerated = MONACO_GENERATED): Promise<typeof Monaco> {
  if (cachedMonaco) {
    return cachedMonaco;
  }

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

  throw new AggregateError(errors, `Failed to load monaco-editor@${generated.version} from all sources`);
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
 * Reads optional `<script type="text/original">` and `<script type="text/modified">`
 * from direct children of `host`. Returns `null` when none are present.
 */
export function readDeclarativeDiffScripts(host: HTMLElement): DeclarativeDiffContent | null {
  const scripts = Array.from(host.querySelectorAll<HTMLScriptElement>(":scope > script"));

  if (scripts.length === 0) {
    return null;
  }

  if (scripts.length !== 2) {
    throw new Error(
      `<monaco-diff>: expected exactly two <script> elements (type="${SCRIPT_TYPE_ORIGINAL}" and type="${SCRIPT_TYPE_MODIFIED}"), found ${scripts.length}`,
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

  const original = originalScript.textContent ?? "";
  const modified = modifiedScript.textContent ?? "";
  const originalLanguage = originalScript.getAttribute("lang") ?? undefined;
  const modifiedLanguage = modifiedScript.getAttribute("lang") ?? undefined;

  originalScript.remove();
  modifiedScript.remove();

  return { original, modified, originalLanguage, modifiedLanguage };
}

const DEFAULT_LANGUAGE = "javascript";

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

  public whenReady() {
    return this._readyPromise;
  }

  public getEditor() {
    return this._editor;
  }

  public async setTheme(theme: string): Promise<void> {
    await this.whenReady();
    const monaco = await hydrateCache(MONACO_GENERATED);
    monaco.editor.setTheme(theme);
  }

  public destroy() {
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
