export type MonacoDiffManagerOptions = {
  original?: string;
  modified?: string;
  language?: string;
  originalLanguage?: string;
  modifiedLanguage?: string;
  theme?: string;
  renderSideBySide?: boolean;
  readOnly?: boolean;
  /** AMD `vs` folder URL (trailing path to `/vs`, no trailing slash). */
  monacoVsPath?: string;
  editorOptions?: Record<string, unknown>;
  loadMonaco?: () => Promise<MonacoGlobal>;
  onReady?: (manager: MonacoDiffManager) => void;
  onComponentChange?: (options: MonacoDiffManagerOptions, reason: string) => void;
};

export type MonacoDiffManagerEvents = {
  onReady: [manager: MonacoDiffManager];
  onComponentChange: [options: MonacoDiffManagerOptions, reason: string];
};

export interface MonacoGlobal {
  editor: {
    createDiffEditor(container: HTMLElement, options?: Record<string, unknown>): IStandaloneDiffEditor;
    createModel(value: string, language: string): ITextModel;
    setModelLanguage(model: ITextModel, language: string): void;
    setTheme(theme: string): void;
  };
}

export interface ITextModel {
  getValue(): string;
  setValue(value: string): void;
  getLanguageId(): string;
  dispose(): void;
}

export interface IStandaloneDiffEditor {
  setModel(model: { original: ITextModel; modified: ITextModel } | null): void;
  getModel(): { original: ITextModel; modified: ITextModel } | null;
  updateOptions(options: Record<string, unknown>): void;
  layout(): void;
  dispose(): void;
}

const DEFAULT_VS_PATH = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.10.1/min/vs";
// const DEFAULT_VS_PATH = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.19.2/min/vs";

type MonacoWindow = Window & {
  require?: {
    config: (cfg: { paths: Record<string, string> }) => void;
    (deps: string[], cb: () => void): void;
  };
  monaco?: MonacoGlobal;
};

let sharedMonacoPromise: Promise<MonacoGlobal> | null = null;

export function loadMonacoFromCdn(vsPath: string = DEFAULT_VS_PATH): Promise<MonacoGlobal> {
  if (!sharedMonacoPromise) {
    sharedMonacoPromise = new Promise<MonacoGlobal>((resolve, reject) => {
      const win = window as unknown as MonacoWindow;
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
  constructor(
    private readonly manager: MonacoDiffManager,
    private readonly side: "original" | "modified",
  ) {}

  public set(text: string) {
    if (this.side === "original") {
      this.manager.setOriginal(text);
    } else {
      this.manager.setModified(text);
    }
  }

  public get(): string {
    return this.side === "original" ? this.manager.getOriginal() : this.manager.getModified();
  }

  public lang(language: string) {
    if (this.side === "original") {
      this.manager.setOriginalLanguage(language);
    } else {
      this.manager.setModifiedLanguage(language);
    }
  }

  public getLang(): string {
    return this.side === "original" ? this.manager.getOriginalLanguage() : this.manager.getModifiedLanguage();
  }
}

export class MonacoDiffManager {
  public propParentElement: HTMLElement;
  public propEditorContainer!: HTMLElement;
  public propOptions: MonacoDiffManagerOptions;
  public readonly left = new MonacoDiffSide(this, "original");
  public readonly right = new MonacoDiffSide(this, "modified");

  private _monaco: MonacoGlobal | null = null;
  private _editor: IStandaloneDiffEditor | null = null;
  private _originalModel: ITextModel | null = null;
  private _modifiedModel: ITextModel | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  private _readyPromise: Promise<void>;
  private _destroyed = false;
  private _layoutRaf: number | null = null;

  constructor(bindElement: HTMLElement, options: MonacoDiffManagerOptions = {}) {
    this.propParentElement = bindElement;
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

  public whenReady(): Promise<void> {
    return this._readyPromise;
  }

  public monaco(): MonacoGlobal | null {
    return this._monaco;
  }

  public editor(): IStandaloneDiffEditor | null {
    return this._editor;
  }

  public getOriginal(): string {
    return this._originalModel?.getValue() ?? this.propOptions.original ?? "";
  }

  public getModified(): string {
    return this._modifiedModel?.getValue() ?? this.propOptions.modified ?? "";
  }

  public getOriginalLanguage(): string {
    return (
      this._originalModel?.getLanguageId() ??
      this.propOptions.originalLanguage ??
      this.propOptions.language ??
      "javascript"
    );
  }

  public getModifiedLanguage(): string {
    return (
      this._modifiedModel?.getLanguageId() ??
      this.propOptions.modifiedLanguage ??
      this.propOptions.language ??
      "javascript"
    );
  }

  public setOriginal(text: string) {
    this.propOptions.original = text;
    if (this._originalModel) {
      this._originalModel.setValue(text);
    }
    this._triggerOnComponentChange("setOriginal");
  }

  public setModified(text: string) {
    this.propOptions.modified = text;
    if (this._modifiedModel) {
      this._modifiedModel.setValue(text);
    }
    this._triggerOnComponentChange("setModified");
  }

  public setOriginalLanguage(language: string) {
    this.propOptions.originalLanguage = language;
    if (this._originalModel && this._monaco) {
      this._monaco.editor.setModelLanguage(this._originalModel, language);
    }
    this._triggerOnComponentChange("setOriginalLanguage");
  }

  public setModifiedLanguage(language: string) {
    this.propOptions.modifiedLanguage = language;
    if (this._modifiedModel && this._monaco) {
      this._monaco.editor.setModelLanguage(this._modifiedModel, language);
    }
    this._triggerOnComponentChange("setModifiedLanguage");
  }

  public setLanguage(language: string) {
    this.propOptions.language = language;
    this.setOriginalLanguage(language);
    this.setModifiedLanguage(language);
  }

  public setRenderSideBySide(renderSideBySide: boolean) {
    this.propOptions.renderSideBySide = renderSideBySide;
    this._editor?.updateOptions({ renderSideBySide });
    this._triggerOnComponentChange("setRenderSideBySide");
  }

  /** Inline diff view (`renderSideBySide: false`). */
  public setInline(inline: boolean) {
    this.setRenderSideBySide(!inline);
  }

  public options(partial: Record<string, unknown>) {
    this.propOptions.editorOptions = {
      ...this.propOptions.editorOptions,
      ...partial,
    };
    this._editor?.updateOptions(partial);
    this._triggerOnComponentChange("options");
  }

  public layout() {
    this._editor?.layout();
  }

  public destroy() {
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
  }

  protected render() {
    // Mount Monaco directly in the provided element.
    // The consumer owns sizing (height/width) via parent layout.
    this.propEditorContainer = this.propParentElement;
  }

  private async _init() {
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

      scrollbar: {
        vertical: "auto",
        // horizontal: "auto",
        // verticalScrollbarSize: 10,
        // horizontalScrollbarSize: 10,
      },
      ...editorOptions,
    });

    this._setModels();
    this._bindResize();

    this.propOptions.onReady?.(this);
    this._triggerOnComponentChange("ready");
  }

  private _setModels() {
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

  private _disposeModels() {
    this._originalModel?.dispose();
    this._modifiedModel?.dispose();
    this._originalModel = null;
    this._modifiedModel = null;
  }

  private _bindResize() {
    if (typeof ResizeObserver === "undefined") return;

    this._resizeObserver = new ResizeObserver(() => {
      this.layout();
    });
    this._resizeObserver.observe(this.propParentElement);
  }

  private _triggerOnComponentChange(reason: string) {
    this.propOptions.onComponentChange?.(this.propOptions, reason);
  }
}
