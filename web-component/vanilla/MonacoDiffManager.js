const DEFAULT_VS_PATH = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.10.1/min/vs";
let sharedMonacoPromise = null;
export function loadMonacoFromCdn(vsPath = DEFAULT_VS_PATH) {
  if (!sharedMonacoPromise) {
    sharedMonacoPromise = new Promise((resolve, reject) => {
      const win = window;
      if (win.monaco) {
        resolve(win.monaco);
        return;
      }
      const finish = () => {
        win.require?.config({ paths: { vs: vsPath } });
        win.require?.(["vs/editor/editor.main"], () => {
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
export class MonacoDiffSide {
  manager;
  side;
  constructor(manager, side) {
    this.manager = manager;
    this.side = side;
  }
  set(text) {
    if (this.side === "original") {
      this.manager.setOriginal(text);
    } else {
      this.manager.setModified(text);
    }
  }
  get() {
    return this.side === "original" ? this.manager.getOriginal() : this.manager.getModified();
  }
  lang(language) {
    if (this.side === "original") {
      this.manager.setOriginalLanguage(language);
    } else {
      this.manager.setModifiedLanguage(language);
    }
  }
  getLang() {
    return this.side === "original" ? this.manager.getOriginalLanguage() : this.manager.getModifiedLanguage();
  }
}
export class MonacoDiffManager {
  propParentElement;
  propEditorContainer;
  propOptions;
  left = new MonacoDiffSide(this, "original");
  right = new MonacoDiffSide(this, "modified");
  _monaco = null;
  _editor = null;
  _originalModel = null;
  _modifiedModel = null;
  _resizeObserver = null;
  _readyPromise;
  _destroyed = false;
  constructor(bindElement, options = {}) {
    this.propParentElement = bindElement;
    this.propParentElement.classList.add("monaco-diff-manager");
    this.propOptions = {
      original: "",
      modified: "",
      language: "javascript",
      renderSideBySide: true,
      readOnly: false,
      monacoVsPath: DEFAULT_VS_PATH,
      ...options,
    };
    this.render();
    this._readyPromise = this._init();
  }
  whenReady() {
    return this._readyPromise;
  }
  monaco() {
    return this._monaco;
  }
  editor() {
    return this._editor;
  }
  getOriginal() {
    return this._originalModel?.getValue() ?? this.propOptions.original ?? "";
  }
  getModified() {
    return this._modifiedModel?.getValue() ?? this.propOptions.modified ?? "";
  }
  getOriginalLanguage() {
    return (
      this._originalModel?.getLanguageId() ??
      this.propOptions.originalLanguage ??
      this.propOptions.language ??
      "javascript"
    );
  }
  getModifiedLanguage() {
    return (
      this._modifiedModel?.getLanguageId() ??
      this.propOptions.modifiedLanguage ??
      this.propOptions.language ??
      "javascript"
    );
  }
  setOriginal(text) {
    this.propOptions.original = text;
    if (this._originalModel) {
      this._originalModel.setValue(text);
    }
    this._triggerOnComponentChange("setOriginal");
  }
  setModified(text) {
    this.propOptions.modified = text;
    if (this._modifiedModel) {
      this._modifiedModel.setValue(text);
    }
    this._triggerOnComponentChange("setModified");
  }
  setOriginalLanguage(language) {
    this.propOptions.originalLanguage = language;
    if (this._originalModel && this._monaco) {
      this._monaco.editor.setModelLanguage(this._originalModel, language);
    }
    this._triggerOnComponentChange("setOriginalLanguage");
  }
  setModifiedLanguage(language) {
    this.propOptions.modifiedLanguage = language;
    if (this._modifiedModel && this._monaco) {
      this._monaco.editor.setModelLanguage(this._modifiedModel, language);
    }
    this._triggerOnComponentChange("setModifiedLanguage");
  }
  setLanguage(language) {
    this.propOptions.language = language;
    this.setOriginalLanguage(language);
    this.setModifiedLanguage(language);
  }
  setRenderSideBySide(renderSideBySide) {
    this.propOptions.renderSideBySide = renderSideBySide;
    this._editor?.updateOptions({ renderSideBySide });
    this._triggerOnComponentChange("setRenderSideBySide");
  }
  /** Inline diff view (`renderSideBySide: false`). */
  setInline(inline) {
    this.setRenderSideBySide(!inline);
  }
  options(partial) {
    this.propOptions.editorOptions = {
      ...this.propOptions.editorOptions,
      ...partial,
    };
    this._editor?.updateOptions(partial);
    this._triggerOnComponentChange("options");
  }
  layout() {
    this._editor?.layout();
  }
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._editor?.dispose();
    this._editor = null;
    this._originalModel?.dispose();
    this._originalModel = null;
    this._modifiedModel?.dispose();
    this._modifiedModel = null;
    this._monaco = null;
    this.propParentElement.replaceChildren();
    this.propParentElement.classList.remove("monaco-diff-manager");
  }
  render() {
    this.propEditorContainer = document.createElement("div");
    this.propEditorContainer.className = "monaco-diff-manager__editor";
    this.propParentElement.replaceChildren(this.propEditorContainer);
  }
  async _init() {
    const load =
      this.propOptions.loadMonaco ?? (() => loadMonacoFromCdn(this.propOptions.monacoVsPath ?? DEFAULT_VS_PATH));
    this._monaco = await load();
    if (this._destroyed) return;
    if (this.propOptions.theme) {
      this._monaco.editor.setTheme(this.propOptions.theme);
    }
    const { readOnly, renderSideBySide, editorOptions } = this.propOptions;
    this._editor = this._monaco.editor.createDiffEditor(this.propEditorContainer, {
      readOnly,
      renderSideBySide,
      automaticLayout: false,
      ...editorOptions,
    });
    this._setModels();
    this._bindResize();
    this.propOptions.onReady?.(this);
    this._triggerOnComponentChange("ready");
  }
  _setModels() {
    if (!this._monaco || !this._editor) return;
    this._disposeModels();
    const originalLang = this.getOriginalLanguage();
    const modifiedLang = this.getModifiedLanguage();
    this._originalModel = this._monaco.editor.createModel(this.propOptions.original ?? "", originalLang);
    this._modifiedModel = this._monaco.editor.createModel(this.propOptions.modified ?? "", modifiedLang);
    this._editor.setModel({
      original: this._originalModel,
      modified: this._modifiedModel,
    });
  }
  _disposeModels() {
    this._originalModel?.dispose();
    this._modifiedModel?.dispose();
    this._originalModel = null;
    this._modifiedModel = null;
  }
  _bindResize() {
    if (typeof ResizeObserver === "undefined") return;
    this._resizeObserver = new ResizeObserver(() => {
      this.layout();
    });
    this._resizeObserver.observe(this.propParentElement);
  }
  _triggerOnComponentChange(reason) {
    this.propOptions.onComponentChange?.(this.propOptions, reason);
  }
}
