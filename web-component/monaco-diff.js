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
export class MonacoDiffElement extends HTMLElement {
  static tagName = "monaco-diff";
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
    this._manager = new MonacoDiffManager(this._container, {
      host: this,
      editorOptions: {
        theme: this.getAttribute("theme") ?? undefined,
      },
    });
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
}
customElements.define(MonacoDiffElement.tagName, MonacoDiffElement);
