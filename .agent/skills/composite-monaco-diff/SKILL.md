---
name: composite-monaco-diff
description: Show a side-by-side diff of two texts (before/after code, config, any text) with syntax highlighting using the <composite-monaco-diff> web component or its React wrapper <MonacoDiff> (npm package composite-monaco-diff, Monaco diff editor loaded from CDN, works without a build step). Use when a page needs a code diff / compare view, or when existing <composite-monaco-diff> / <MonacoDiff> elements must be created, sized, read or updated from JavaScript (change texts, language, theme, make editable, reach the Monaco API).
---

# `<composite-monaco-diff>` web component

A custom element that wraps the [Monaco](https://microsoft.github.io/monaco-editor/) **diff** editor: original text on the left, modified on the right. It downloads Monaco by itself (once per page, however many diffs are rendered), follows the size of its parent, and is a read-only viewer unless told otherwise.

It is for comparing **two** texts. For a single highlighted code block or a plain code editor use something else (for example the `ace-editor-web-component` skill).

- API table and live examples: https://stopsopa.github.io/monaco-editor-webcomponent/docs/api.html
- Source: https://github.com/stopsopa/monaco-editor-webcomponent
- npm: `composite-monaco-diff` (ESM only, browser only)

## 1. Installation

Pick the one that matches the project. Never add a `<script>` or import for Monaco itself.

**Plain HTML (no build step)** - once per page:

```html
<script
  type="module"
  src="https://stopsopa.github.io/monaco-editor-webcomponent/web-component/composite-monaco-diff.js"
></script>
```

**npm / bundler:**

```bash
npm install composite-monaco-diff
```

```js
import "composite-monaco-diff"; // registers <composite-monaco-diff>
```

**React:** same package, `import { MonacoDiff } from "composite-monaco-diff/react"` (section 5).

Monaco `0.55.1` is fetched at runtime from jsDelivr, with unpkg and cdnjs as fallbacks. Leave that alone unless the user asks to self-host (section 7).

## 2. Basic usage

```html
<div style="height: 400px">
  <composite-monaco-diff language="javascript">
    <script type="text/original">
      const a = 1;
    </script>
    <script type="text/modified">
      const a = 2;
    </script>
  </composite-monaco-diff>
</div>
```

- **Size comes from the parent.** The element is `display: block; width: 100%; height: 100%; min-height: 200px`. Give the parent an explicit height, otherwise the diff is 200px tall. It re-layouts itself when the parent is resized.
- **Width:** below roughly 900px Monaco switches from side-by-side to an inline diff. Give it room (examples use 1200px) when two columns matter.
- **Both scripts or none.** `text/original` and `text/modified` must come as a pair and be direct children. Only one of them, or a duplicate, is an error. With no scripts the editor starts empty and is filled from JavaScript (section 4).
- Common indentation and the blank first/last line are removed, so indent the code to match the surrounding HTML. `data-offset="2"` on a script adds that many spaces in front of every line afterwards.
- The text cannot contain `</script>`. For such content (or any text held in a variable) set it from JavaScript instead.
- The scripts are read once, when the element is attached. Changing their text later does nothing - use the properties.
- Do not set `theme` unless the user asks (default: Monaco's light `vs`).

## 3. Attributes

| Attribute  | Default      | Notes                                                                                                                                                       |
| ---------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `language` | `javascript` | Language of both sides. Monaco language id, see below.                                                                                                      |
| `theme`    | none (`vs`)  | `vs`, `vs-dark`, `hc-black`, `hc-light`, or a theme registered with `monaco.editor.defineTheme()`. **Global**: changes every Monaco editor on the page.     |
| `editable` | off          | Boolean. Without it the diff is read-only. With it the modified (right) side can be typed in and `change` events fire. The original side is never editable. |

On the scripts: `lang` (language of that side only) and `data-offset` (see above).

All three attributes can be changed at any time with `setAttribute` / `removeAttribute` and are applied live.

**Language ids** are Monaco's: `javascript`, `typescript`, `json`, `html`, `css`, `scss`, `python`, `shell`, `yaml`, `markdown`, `sql`, `xml`, `java`, `go`, `rust`, `php`, `dockerfile`, `plaintext` (no highlighting), ... Short names (`js`, `ts`, `sh`, `bash`) are not ids; an unknown id renders as plain text. Full list at runtime: `monaco.languages.getLanguages().map((l) => l.id)`.

**Language precedence**, always: per-side language (`<script lang>`, `el.originalLanguage`, `el.modifiedLanguage`) → shared `language` → `javascript`. So if the diff must react to a language switch, do not put `lang` on the scripts.

## 4. JavaScript API

```js
const el = document.querySelector("composite-monaco-diff");
```

### Texts and languages: no waiting needed

These properties work at any moment - before the element is attached, while Monaco is still downloading, and after. Values set early are kept and used when the editor is created.

```js
el.original = "const a = 1;"; // left side, must be a string
el.modified = "const a = 2;"; // right side, must be a string
const text = el.modified; // current text (includes user edits)

el.originalLanguage = "json"; // one side only; undefined = follow the `language` attribute
el.modifiedLanguage = "yaml";
el.setAttribute("language", "typescript"); // both sides
```

Properties win over the `<script>` content. To create a diff entirely from JavaScript:

```js
const el = document.createElement("composite-monaco-diff");
el.original = before;
el.modified = after;
el.setAttribute("language", "json");
container.appendChild(el); // container needs a height
```

### Events

```js
// user typed in the modified side (requires `editable`); not fired by el.modified = ...
el.addEventListener("change", (e) => {
  const { original, modified } = e.detail;
});

// wrong markup or Monaco could not be downloaded (also logged to the console)
el.addEventListener("error", (e) => console.log(e.detail.error));
```

`change` bubbles, `error` does not.

### Monaco itself: `whenReady()`

Only needed for things the element does not expose (options, scrolling, decorations, markers, navigation between changes):

```js
const { monaco, editor, original, modified } = await el.whenReady();
// monaco: the Monaco API, editor: IStandaloneDiffEditor, original / modified: ITextModel

editor.updateOptions({ renderSideBySide: false }); // inline diff
editor.getModifiedEditor().revealLine(40);
```

- Always returns a promise. On a detached element it stays pending until the element is attached and ready.
- It rejects when initialisation fails, so `await` it inside `try/catch` when the failure matters.
- Do not keep `editor` / models across a removal of the element (see lifecycle below) - call `whenReady()` again.
- `el.getManager()` returns the engine (`setOriginal`, `setLanguage`, `setTheme`, `setReadOnly`, `onChange`, ...). It throws when the element is not attached. Prefer the properties and attributes above.

### Lifecycle

- **Moving** the element (`otherParent.appendChild(el)`) keeps the same editor and its state.
- **Removing** it destroys the editor. Texts and per-side languages are remembered and restored when it is attached again, as a new editor.
- Several builds of the component on one page are fine; the tag is defined once.

### TypeScript

```ts
import type { MonacoDiffElement } from "composite-monaco-diff";

const el = document.querySelector<MonacoDiffElement>("composite-monaco-diff")!;
```

## 5. React

```jsx
import { useRef, useState } from "react";
import { MonacoDiff } from "composite-monaco-diff/react";

function Diff({ before, after }) {
  return (
    <div style={{ height: 400 }}>
      <MonacoDiff language="javascript" original={before} modified={after} />
    </div>
  );
}
```

| Prop                                   | Notes                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `original`, `modified`                 | Strings. Pass texts through these props, not through script children.  |
| `language`                             | Shared language.                                                       |
| `originalLanguage`, `modifiedLanguage` | One side only, win over `language`.                                    |
| `theme`                                | Global, same as the attribute.                                         |
| `editable`                             | Boolean, default `false`.                                              |
| `onChange`                             | `({ original, modified }) => void`, user edits only, needs `editable`. |
| `className`, `style`, `id`             | Passed to the element. The wrapping parent still needs a height.       |

Editable and controlled:

```jsx
const [text, setText] = useState(initial);

<MonacoDiff editable original={base} modified={text} onChange={({ modified }) => setText(modified)} />;
```

The ref is the element itself, so everything from section 4 is available:

```tsx
import { MonacoDiff, type MonacoDiffElement } from "composite-monaco-diff/react";

const ref = useRef<MonacoDiffElement>(null);
<MonacoDiff ref={ref} original={a} modified={b} />;

const { editor, monaco } = await ref.current!.whenReady(); // in an effect or handler
```

`react` (>= 18) is a peer dependency the project already has; nothing else to install.

## 6. Things that go wrong

- **Nothing visible / very short editor:** the parent has no height.
- **Theme of another diff changed:** the theme is one per page. Use the same theme on every `<composite-monaco-diff>`, or set it on one only. Removing the attribute does not restore the previous theme.
- **Language switch does nothing on one side:** that side has its own language (`<script lang>` or a per-side property).
- **`change` never fires:** `editable` is missing, or the text was set from code (only user edits fire it).
- **Error "missing `<script type=...>`":** only one of the two scripts is present.
- **Page already uses a global `require` that is not an AMD loader:** Monaco's loader cannot start; the element reports it through the `error` event. If the page already has `window.monaco`, that instance is reused.

## 7. Self-hosting Monaco (only when asked)

`configureMonaco({ vs, timeoutMs })` replaces the CDN list. `vs` is the url (or an array of urls, tried in order) of Monaco's `min/vs` directory. It must run **before the first element is attached**; later it throws.

In an app that renders its elements from JavaScript (React and similar), call it at the entry point:

```js
import { configureMonaco } from "composite-monaco-diff";

configureMonaco({ vs: "/assets/monaco-editor/min/vs" });
```

When the elements are already in the HTML, importing the component upgrades them immediately, so configure through the engine module first:

```html
<script type="module">
  import { configureMonaco } from "https://stopsopa.github.io/monaco-editor-webcomponent/web-component/MonacoDiffManager.js";

  configureMonaco({ vs: "/assets/monaco-editor/min/vs" });
</script>
<script
  type="module"
  src="https://stopsopa.github.io/monaco-editor-webcomponent/web-component/composite-monaco-diff.js"
></script>
```

With a bundler the equivalent is `import { configureMonaco } from "composite-monaco-diff/MonacoDiffManager"`, the call, then `await import("composite-monaco-diff")`.

## 8. Complete example

A read-only diff from markup and an editable one filled from JavaScript (Monaco is still downloaded once).

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <script
      type="module"
      src="https://stopsopa.github.io/monaco-editor-webcomponent/web-component/composite-monaco-diff.js"
    ></script>
    <style>
      .diff {
        height: 300px;
        width: 1200px;
        margin: 16px auto;
        border: 1px solid gray;
      }
    </style>
  </head>
  <body>
    <div class="diff">
      <composite-monaco-diff language="json">
        <script type="text/original">
          {
            "name": "example",
            "version": "1.0.0"
          }
        </script>
        <script type="text/modified">
          {
            "name": "example",
            "version": "1.1.0"
          }
        </script>
      </composite-monaco-diff>
    </div>

    <div class="diff">
      <composite-monaco-diff id="playground" language="javascript" editable></composite-monaco-diff>
    </div>

    <button id="to-python">Switch to Python</button>
    <pre id="output"></pre>

    <script type="module">
      const el = document.getElementById("playground");
      const output = document.getElementById("output");

      // no waiting: values are kept until the editor exists
      el.original = "console.log('Hello');";
      el.modified = "console.log('Hello, World!');";

      el.addEventListener("change", (e) => {
        output.textContent = e.detail.modified;
      });

      document.getElementById("to-python").addEventListener("click", () => {
        el.setAttribute("language", "python");
        el.original = "print('Hello')";
        el.modified = "print('Hello, World!')";
      });

      // Monaco API only after whenReady()
      const { modified } = await el.whenReady();
      output.textContent = `${modified.getLineCount()} line(s)`;
    </script>
  </body>
</html>
```

## Checklist

- One module script (or one import) for the component; nothing for Monaco.
- The parent of every `<composite-monaco-diff>` has a height.
- Markup content: both `<script type="text/original">` and `<script type="text/modified">`, direct children, no `</script>` inside.
- Content from code: `el.original` / `el.modified` (React: `original` / `modified` props), strings only, no waiting.
- No `theme` unless asked, and then the same one on every diff of the page.
- Monaco language ids (`shell`, not `sh`); no `lang` on the scripts when the language has to be switchable.
- `editable` only when the user should type; listen to `change` (React: `onChange`).
- `await el.whenReady()` before touching `monaco`, `editor` or the models.
