/**
 * `<composite-monaco-diff>` — declarative diff editor with optional embedded `<script>` sources.
 *
 * Import this module to register the element (`customElements.define` at file bottom).
 * Before querying the DOM or calling instance APIs from other modules, wait until the
 * browser knows the tag (same pattern as other custom elements in this repo):
 *
 *   import { MonacoDiffElement } from "./composite-monaco-diff.js";
 *
 *   await customElements.whenDefined(MonacoDiffElement.tagName);
 *
 *   const diff = document.querySelector<MonacoDiffElement>(MonacoDiffElement.tagName)!;
 *   const { editor, monaco, original, modified } = await diff.whenReady();
 *
 * Attributes:
 *   theme      Monaco theme name ("vs", "vs-dark", "hc-black", "hc-light" or one registered with
 *              monaco.editor.defineTheme). GLOBAL in Monaco: it re-themes every Monaco editor on the page.
 *              Removing the attribute changes nothing.
 *   language   shared language for both sides. A side that has its own language (`<script lang>`,
 *              `el.originalLanguage`, `el.modifiedLanguage`) keeps it.
 *   editable   boolean. Without it the editor is a read-only viewer. With it the modified side can be
 *              typed in and the element dispatches `change` (detail: { original, modified }).
 *
 * Properties (all usable before the element is connected / ready):
 *   el.original, el.modified                   text of each side
 *   el.originalLanguage, el.modifiedLanguage   per-side language (undefined = follow `language`)
 *
 * Events:
 *   change   user edited the text (only when `editable`), detail: { original, modified }
 *   error    initialisation failed (wrong markup, Monaco could not be loaded), detail: { error }
 *
 * Lifecycle:
 *   - Moving the element (appendChild to another parent) keeps the same editor and its state.
 *   - Removing it destroys the editor; text and per-side languages are remembered and restored when the
 *     element is attached again, like a native form control keeps its value while detached.
 *   - `data-offset` on the scripts is optional (default 0): spaces added in front of every line after the
 *     common indentation was removed.
 *   - The content of the scripts cannot contain the text `</script>` - use the properties for that.
 *
 * @example HTML
 * ```html
 * <composite-monaco-diff theme="vs-dark">
 *   <script type="text/original" lang="javascript">
 *     const a = 1;
 *   </script>
 *   <script type="text/modified" lang="typescript">
 *     const a = 2;
 *   </script>
 * </composite-monaco-diff>
 * ```
 */

import {
  MonacoDiffManager,
  MonacoDiffDestroyedError,
  type MonacoDiffContent,
  type MonacoDiffReady,
} from "./MonacoDiffManager.js";

const th = (msg: string) => new Error(`web-component/composite-monaco-diff.ts error: ${msg}`);

/** Custom element tag name (`"composite-monaco-diff"`). Pass to `customElements.whenDefined(tagName)`. */
export const tagName = "composite-monaco-diff" as const;

/** Monaco's built-in themes. Custom themes registered with `monaco.editor.defineTheme()` work too. */
export const MONACO_THEMES = ["vs", "vs-dark", "hc-black", "hc-light"] as const;

export type MonacoTheme = (typeof MONACO_THEMES)[number];

export function isMonacoTheme(value: string): value is MonacoTheme {
  return (MONACO_THEMES as readonly string[]).includes(value);
}

const warnedThemes = new Set<string>();

/**
 * Any non-empty string is passed to Monaco (so custom themes work). Monaco silently falls back to "vs"
 * for a name it does not know, which makes a typo look like "the attribute does not work" - hence one
 * warning per unknown name.
 */
function parseThemeAttribute(value: string | null): string | undefined {
  const theme = value?.trim();

  if (!theme) {
    return undefined;
  }

  if (!isMonacoTheme(theme) && !warnedThemes.has(theme)) {
    warnedThemes.add(theme);
    console.warn(
      `<composite-monaco-diff>: theme "${theme}" is not one of the built-in themes (${MONACO_THEMES.join(", ")}). ` +
        `It only works if it was registered with monaco.editor.defineTheme(), otherwise Monaco falls back to "vs".`,
    );
  }

  return theme;
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>["resolve"];
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** Values that have to survive while there is no manager (before the first connect, or while detached). */
type Stash = {
  original?: string;
  modified?: string;
  originalLanguage?: string;
  modifiedLanguage?: string;
};

export class MonacoDiffElement extends HTMLElement {
  static readonly tagName = tagName;

  static get observedAttributes(): string[] {
    return ["theme", "language", "editable"];
  }

  private _container!: HTMLElement;
  private _manager: MonacoDiffManager | null = null;
  private _stash: Stash = {};
  /** `whenReady()` callers that arrived while the element had no manager. */
  private _whenConnected: Deferred<MonacoDiffReady> | null = null;

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
      // Moved inside the document (disconnect + connect in the same task): keep the editor as it is.
      return;
    }

    const stash = this._stash;
    this._stash = {};

    const manager = new MonacoDiffManager(this._container, {
      host: this,
      language: this.getAttribute("language") ?? undefined,
      ...stash,
      editorOptions: {
        theme: parseThemeAttribute(this.getAttribute("theme")),
        readOnly: !this.hasAttribute("editable"),
      },
    });

    this._manager = manager;

    manager.onChange((content) => {
      this.dispatchEvent(new CustomEvent<MonacoDiffContent>("change", { detail: content, bubbles: true }));
    });

    const ready = manager.whenReady();

    ready.catch((error: unknown) => {
      if (error instanceof MonacoDiffDestroyedError) {
        return;
      }
      console.error(error);
      this.dispatchEvent(new CustomEvent("error", { detail: { error } }));
    });

    if (this._whenConnected) {
      this._whenConnected.resolve(ready);
      this._whenConnected = null;
    }
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (!this._manager) {
      // not connected yet: connectedCallback() reads the attributes
      return;
    }

    if (name === "theme") {
      const theme = parseThemeAttribute(newValue);
      // Removing the attribute means "no opinion" - the global theme is left as it is.
      if (theme) {
        this._manager.setTheme(theme);
      }
    } else if (name === "language") {
      this._manager.setLanguage(newValue ?? undefined);
    } else if (name === "editable") {
      this._manager.setReadOnly(newValue === null);
    }
  }

  disconnectedCallback(): void {
    // A move (parent.appendChild(el)) fires disconnected + connected synchronously.
    // Tear down only when the element is still detached once the current task is done.
    queueMicrotask(() => {
      if (this.isConnected || !this._manager) {
        return;
      }

      const manager = this._manager;
      this._manager = null;

      const { originalLanguage, modifiedLanguage } = manager.getLanguages();
      this._stash = {
        original: manager.getOriginal(),
        modified: manager.getModified(),
        originalLanguage,
        modifiedLanguage,
      };

      manager.destroy();
    });
  }

  /**
   * Promise that resolves with `{ monaco, editor, original, modified }` when the editor is safe to use.
   * Always returns a promise: on a not (yet) connected element it stays pending until the element is
   * connected and its editor is ready. Rejects when initialisation fails.
   */
  whenReady(): Promise<MonacoDiffReady> {
    if (this._manager) {
      return this._manager.whenReady();
    }

    if (!this._whenConnected) {
      this._whenConnected = createDeferred<MonacoDiffReady>();
    }

    return this._whenConnected.promise;
  }

  getManager(): MonacoDiffManager {
    if (!this._manager) {
      throw th(`<composite-monaco-diff> is not connected to the document - there is no manager yet`);
    }
    return this._manager;
  }

  /** Text of the original (left) side. */
  get original(): string {
    return this._manager ? this._manager.getOriginal() : (this._stash.original ?? "");
  }

  set original(value: string) {
    this._setContent("original", value);
  }

  /** Text of the modified (right) side. */
  get modified(): string {
    return this._manager ? this._manager.getModified() : (this._stash.modified ?? "");
  }

  set modified(value: string) {
    this._setContent("modified", value);
  }

  /** Language of the original side only; `undefined` = follow the `language` attribute. */
  get originalLanguage(): string | undefined {
    return this._manager ? this._manager.getLanguages().originalLanguage : this._stash.originalLanguage;
  }

  set originalLanguage(language: string | undefined) {
    if (this._manager) {
      this._manager.setOriginalLanguage(language);
    } else {
      this._stash.originalLanguage = language || undefined;
    }
  }

  /** Language of the modified side only; `undefined` = follow the `language` attribute. */
  get modifiedLanguage(): string | undefined {
    return this._manager ? this._manager.getLanguages().modifiedLanguage : this._stash.modifiedLanguage;
  }

  set modifiedLanguage(language: string | undefined) {
    if (this._manager) {
      this._manager.setModifiedLanguage(language);
    } else {
      this._stash.modifiedLanguage = language || undefined;
    }
  }

  private _setContent(side: "original" | "modified", value: string): void {
    if (typeof value !== "string") {
      throw th(`<composite-monaco-diff>.${side} must be a string, got >${value === null ? "null" : typeof value}<`);
    }

    if (this._manager) {
      if (side === "original") {
        this._manager.setOriginal(value);
      } else {
        this._manager.setModified(value);
      }
    } else {
      this._stash[side] = value;
    }
  }
}

// Several builds of this file can end up on one page (CDN bundle + npm import, two bundled dependencies…).
// The first one wins; defining the same tag twice would throw and abort the whole module.
if (!customElements.get(tagName)) {
  customElements.define(tagName, MonacoDiffElement);
}
