/**
 * Monaco diff editor manager. Refresh version/CDN URLs: pnpm run monaco:sync
 */
import type * as Monaco from "monaco-editor";

// autogenerate v
export const MONACO_GENERATED = {
  "version": "0.53.0",
  "cdn": {
    "jsdelivr": "https://cdn.jsdelivr.net/npm/monaco-editor@0.53.0/min/vs",
    "unpkg": "https://unpkg.com/monaco-editor@0.53.0/min/vs",
    "cdnjs": "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.53.0/min/vs"
  },
  "self": "/monaco/vs",
  "cdnProbe": {
    "jsdelivr": {
      "ok": true,
      "status": 200,
      "url": "https://cdn.jsdelivr.net/npm/monaco-editor@0.53.0/min/vs/loader.js",
      "vsBase": "https://cdn.jsdelivr.net/npm/monaco-editor@0.53.0/min/vs"
    },
    "unpkg": {
      "ok": true,
      "status": 200,
      "url": "https://unpkg.com/monaco-editor@0.53.0/min/vs/loader.js",
      "vsBase": "https://unpkg.com/monaco-editor@0.53.0/min/vs"
    },
    "cdnjs": {
      "ok": true,
      "status": 200,
      "url": "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.53.0/min/vs/loader.js",
      "vsBase": "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.53.0/min/vs"
    }
  }
} as const;
// autogenerate ^

export type MonacoGenerated = typeof MONACO_GENERATED;

type MonacoWindow = Window & {
  require?: {
    config: (cfg: { paths: Record<string, string> }) => void;
    (deps: string[], cb: () => void): void;
  };
  monaco?: typeof Monaco;
};

let loadPromise: Promise<typeof Monaco> | null = null;

/**
 * Load Monaco once. `vsBase` is the `/min/vs` folder URL from MONACO_GENERATED
 * (e.g. generated.cdn.jsdelivr or generated.self).
 */
export function loadMonaco(
  generated: MonacoGenerated = MONACO_GENERATED,
  vsBase: string = generated.cdn.jsdelivr,
): Promise<typeof Monaco> {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise<typeof Monaco>((resolve, reject) => {
    const win = window as unknown as MonacoWindow;

    const finish = () => {
      win.require?.config({ paths: { vs: vsBase } });
      win.require?.(["vs/editor/editor.main"], () => {
        if (win.monaco) {
          resolve(win.monaco);
        } else {
          reject(new Error("Monaco failed to initialize"));
        }
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

  return loadPromise;
}

export interface MonacoDiffManagerOptions {
  original: string;
  modified: string;
  language?: string;
  /** `/min/vs` base URL; defaults to MONACO_GENERATED.cdn.jsdelivr */
  vsBase?: string;
  editorOptions?: Monaco.editor.IStandaloneDiffEditorConstructionOptions;
}

export class MonacoDiffManager {
  private _readyPromise: Promise<void>;
  private _editor: Monaco.editor.IStandaloneDiffEditor | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  private _layoutRaf: number | null = null;

  constructor(container: HTMLElement, options: MonacoDiffManagerOptions) {
    this._readyPromise = (async () => {
      const monaco = await loadMonaco(MONACO_GENERATED, options.vsBase);

      this._editor = monaco.editor.createDiffEditor(container, {
        automaticLayout: false,
        scrollbar: { vertical: "auto" },
        scrollBeyondLastLine: false,
        ...options.editorOptions,
      });

      const language = options.language || "javascript";

      this._editor.setModel({
        original: monaco.editor.createModel(options.original, language),
        modified: monaco.editor.createModel(options.modified, language),
      });

      this._scheduleLayout();

      if (typeof ResizeObserver !== "undefined") {
        this._resizeObserver = new ResizeObserver(() => this._scheduleLayout());
        this._resizeObserver.observe(container);
      }
    })();
  }

  public whenReady(): Promise<void> {
    return this._readyPromise;
  }

  public getEditor(): Monaco.editor.IStandaloneDiffEditor | null {
    return this._editor;
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
      this._editor?.layout();
    });
  }
}
