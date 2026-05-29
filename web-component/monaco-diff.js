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
export const MONACO_THEMES = ["vs", "vs-dark", "hc-black", "hc-light"];
export function isMonacoTheme(value) {
  return MONACO_THEMES.includes(value);
}
function parseThemeAttribute(value) {
  if (value && isMonacoTheme(value)) {
    return value;
  }
  return undefined;
}
export class MonacoDiffElement extends HTMLElement {
  static tagName = "monaco-diff";
  static get observedAttributes() {
    return ["theme"];
  }
  _container;
  _manager = null;
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
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
    this._container = this.shadowRoot.querySelector(".container");
  }
  connectedCallback() {
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
  attributeChangedCallback(name, _oldValue, newValue) {
    if (name !== "theme") {
      return;
    }
    void this._applyTheme(parseThemeAttribute(newValue));
  }
  disconnectedCallback() {
    this._manager?.destroy();
    this._manager = null;
  }
  whenReady() {
    if (!this._manager) {
      throw new Error("<monaco-diff>: not connected");
    }
    return this._manager.whenReady();
  }
  getManager() {
    if (!this._manager) {
      throw new Error("<monaco-diff>: not connected");
    }
    return this._manager;
  }
  async _applyTheme(theme) {
    if (!this._manager) {
      return;
    }
    await this._manager.setTheme(theme ?? "vs");
  }
}
customElements.define(MonacoDiffElement.tagName, MonacoDiffElement);
