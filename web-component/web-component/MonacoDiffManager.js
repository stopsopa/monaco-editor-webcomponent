const DEFAULT_VS_PATH = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.10.1/min/vs";
let sharedMonacoPromise = null;
function loadMonaco(vsPath = DEFAULT_VS_PATH) {
  if (!sharedMonacoPromise) {
    sharedMonacoPromise = new Promise((resolve, reject) => {
      const win = window;
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
export class MonacoDiffManager {
  _readyPromise;
  _editor = null;
  _resizeObserver = null;
  constructor(container, options) {
    this._readyPromise = this._init(container, options);
  }
  whenReady() {
    return this._readyPromise;
  }
  async _init(container, options) {
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
  }
  destroy() {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._editor?.dispose();
    this._editor = null;
  }
}
