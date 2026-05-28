const DEFAULT_VS_PATH = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.10.1/min/vs";

let sharedMonacoPromise: Promise<any> | null = null;

function loadMonaco(vsPath: string = DEFAULT_VS_PATH): Promise<any> {
  if (!sharedMonacoPromise) {
    sharedMonacoPromise = new Promise<any>((resolve, reject) => {
      const win = window as any;
      if (win.monaco) {
        resolve(win.monaco);
        return;
      }

      const finish = () => {
        win.require.config({ paths: { vs: vsPath } });
        win.require(["vs/editor/editor.main"], () => {
          if (win.monaco) {
            resolve(win.monaco);
          } else {
            reject(new Error("Monaco failed to initialize"));
          }
        });
      };

      if (win.require) {
        finish();
        return;
      }

      const script = document.createElement("script");
      script.src = `${vsPath}/loader.js`;
      script.async = true;
      script.onload = () => finish();
      script.onerror = () => reject(new Error(`Failed to load Monaco loader from ${vsPath}`));
      document.head.appendChild(script);
    });
  }
  return sharedMonacoPromise;
}

export interface MonacoDiffManagerOptions {
  original: string;
  modified: string;
  language?: string;
}

export class MonacoDiffManager {
  private _readyPromise: Promise<void>;
  private _editor: any = null;
  private _resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, options: MonacoDiffManagerOptions) {
    this._readyPromise = (async () => {
      const monaco = await loadMonaco();

      this._editor = monaco.editor.createDiffEditor(container, {
        automaticLayout: false,
        scrollbar: {
          vertical: "auto",
        },
        scrollBeyondLastLine: false,
      });

      const language = options.language || "javascript";

      this._editor.setModel({
        original: monaco.editor.createModel(options.original, language),
        modified: monaco.editor.createModel(options.modified, language),
      });

      const scheduleLayout = () => requestAnimationFrame(() => this._editor?.layout());
      scheduleLayout();

      if (typeof ResizeObserver !== "undefined") {
        this._resizeObserver = new ResizeObserver(() => scheduleLayout());
        this._resizeObserver.observe(container);
      }
    })();
  }

  public whenReady(): Promise<void> {
    return this._readyPromise;
  }

  public getEditor(): any {
    return this._editor;
  }

  public destroy() {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._editor?.dispose();
    this._editor = null;
  }
}
