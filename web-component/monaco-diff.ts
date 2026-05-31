/**
 * `<monaco-diff>` — declarative diff editor with optional embedded `<script>` sources.
 *
 * Import this module to register the element (`customElements.define` at file bottom).
 * Before querying the DOM or calling instance APIs from other modules, wait until the
 * browser knows the tag (same pattern as other custom elements in this repo):
 *
 *   import { tagName, MonacoDiffElement } from "./monaco-diff.js";
 *
 *   await customElements.whenDefined(tagName);
 *
 *   const diff = document.querySelector(tagName);
 *   if (!(diff instanceof MonacoDiffElement)) throw new Error("Missing <monaco-diff>");
 *   await diff.whenReady();
 *
 * @example HTML
 * ```html
 * <monaco-diff theme="vs-dark">
 *   <script type="text/original" lang="javascript">
 *     const a = 1;
 *   </script>
 *   <script type="text/modified" lang="typescript">
 *     const a = 2;
 *   </script>
 * </monaco-diff>
 * ```
 */

import { hydrateCache, MonacoDiffManager } from "./MonacoDiffManager.js";

/** Custom element tag name (`"monaco-diff"`). Pass to `customElements.whenDefined(tagName)`. */
export const tagName = "monaco-diff" as const;

export const MONACO_THEMES = ["vs", "vs-dark", "hc-black", "hc-light"] as const;

export type MonacoTheme = (typeof MONACO_THEMES)[number];

export function isMonacoTheme(value: string): value is MonacoTheme {
  return (MONACO_THEMES as readonly string[]).includes(value);
}

function parseThemeAttribute(value: string | null): MonacoTheme | undefined {
  if (value && isMonacoTheme(value)) {
    return value;
  }
  return undefined;
}

export class MonacoDiffElement extends HTMLElement {
  static readonly tagName = tagName;

  static get observedAttributes(): string[] {
    return ["theme", "language"];
  }

  private _container!: HTMLElement;
  private _manager: MonacoDiffManager | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
          min-height: 200px;
        }
        .container {
          width: 100%;
          height: 100%;
        }
      </style>
      <div class="container"></div>
    `;
    this._container = this.shadowRoot!.querySelector(".container")!;
  }

  connectedCallback(): void {
    if (this._manager) {
      return;
    }

    const theme = parseThemeAttribute(this.getAttribute("theme"));
    const language = this.getAttribute("language") ?? undefined;

    this._manager = new MonacoDiffManager(this._container, {
      host: this,
      language,
      editorOptions: {
        theme,
      },
    });
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name === "theme") {
      void this._applyTheme(parseThemeAttribute(newValue));
    } else if (name === "language") {
      void this._applyLanguage(newValue ?? undefined);
    }
  }

  disconnectedCallback(): void {
    this._manager?.destroy();
    this._manager = null;
  }

  /** Promise that resolves when the editor has finished loading and is safe to use. */
  whenReady(): Promise<void> {
    if (!this._manager) {
      throw new Error("<monaco-diff>: not connected");
    }
    return this._manager.whenReady();
  }

  getManager(): MonacoDiffManager {
    if (!this._manager) {
      throw new Error("<monaco-diff>: not connected");
    }
    return this._manager;
  }

  private async _applyTheme(theme: MonacoTheme | undefined): Promise<void> {
    if (!this._manager) {
      return;
    }

    await this.whenReady();
    const monaco = await hydrateCache();
    monaco.editor.setTheme(theme ?? "vs");
  }

  private async _applyLanguage(language: string | undefined): Promise<void> {
    if (!this._manager) {
      return;
    }

    await this.whenReady();
    this._manager.setLanguage(language);
  }
}

customElements.define(tagName, MonacoDiffElement);
