/**
 * `<monaco-diff>` — declarative diff editor with optional embedded `<script>` sources.
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

import { MonacoDiffManager } from "./MonacoDiffManager.js";

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
  static readonly tagName = "monaco-diff" as const;

  static get observedAttributes(): string[] {
    return ["theme"];
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

    this._manager = new MonacoDiffManager(this._container, {
      host: this,
      editorOptions: {
        theme,
      },
    });
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name !== "theme") {
      return;
    }

    void this._applyTheme(parseThemeAttribute(newValue));
  }

  disconnectedCallback(): void {
    this._manager?.destroy();
    this._manager = null;
  }

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

    await this._manager.setTheme(theme ?? "vs");
  }
}

customElements.define(MonacoDiffElement.tagName, MonacoDiffElement);
