/**
 * Monaco diff editor manager. Refresh version/CDN URLs: pnpm run monaco:sync
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
      return cachedMonaco;
    } catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)));
    }
  }

  throw new AggregateError(errors, `Failed to load monaco-editor@${generated.version} from all sources`);
}

export interface MonacoDiffManagerOptions {
  original: string;
  modified: string;
  language?: string;
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

      const language = options.language || "javascript";

      this._editor.setModel({
        original: monaco.editor.createModel(options.original, language),
        modified: monaco.editor.createModel(options.modified, language),
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
