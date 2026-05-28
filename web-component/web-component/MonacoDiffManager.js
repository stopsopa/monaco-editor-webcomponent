import { loadMonaco } from "../monaco/loadMonaco.js";
export class MonacoDiffManager {
  _readyPromise;
  _editor = null;
  _resizeObserver = null;
  _layoutRaf = null;
  constructor(container, options) {
    this._readyPromise = this._init(container, options);
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
  async _init(container, options) {
    const monaco = await loadMonaco(options.monaco ?? {});
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
  }
  _scheduleLayout() {
    if (this._layoutRaf !== null) return;
    this._layoutRaf = requestAnimationFrame(() => {
      this._layoutRaf = null;
      this._editor?.layout();
    });
  }
}
