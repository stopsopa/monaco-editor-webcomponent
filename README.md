[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6?logo=typescript&logoColor=white)](https://www.npmjs.com/package/composite-monaco-diff)

Web Component and React wrappers on top of [Monaco Editor](https://microsoft.github.io/monaco-editor/#:~:text=cellSize%3A%C2%A0number%3B-,Diff%20Editor,-Side%20by%20side)

Main purpose of this formation of components is to give user simplest possible setup for using monaco to present diffs in the code.

I find there is not many good quality tools for that and Monaco is one of the best but it would be tedios to try to use it.

This repository is here to just simplify this process to allow usage from vanilla js (including from CDN's), as a web component and in the react ecosystem too.

https://www.npmjs.com/package/composite-monaco-diff

https://stopsopa.github.io/monaco-editor-webcomponent/

# Usage

Full API table and live examples: https://stopsopa.github.io/monaco-editor-webcomponent/docs/api.html

Monaco itself is not bundled. It is loaded at runtime from a public CDN (jsDelivr, then unpkg, then cdnjs) through Monaco's AMD loader, see [Loading Monaco](#loading-monaco).

## 1. Plain HTML, no build step

```html
<script
  type="module"
  src="https://stopsopa.github.io/monaco-editor-webcomponent/web-component/composite-monaco-diff.js"
></script>

<!-- the parent decides the size -->
<div style="height: 400px">
  <composite-monaco-diff theme="vs-dark" language="javascript">
    <script type="text/original">
      const a = 1;
    </script>
    <script type="text/modified">
      const a = 2;
    </script>
  </composite-monaco-diff>
</div>
```

The content of the two scripts is de-indented automatically. Optional `data-offset="2"` on a script indents every line by that many spaces afterwards. The text cannot contain `</script>` - use the JavaScript properties for that.

## 2. npm + ES modules

```bash
npm install composite-monaco-diff
```

```js
import "composite-monaco-diff"; // registers <composite-monaco-diff>

const el = document.querySelector("composite-monaco-diff");

el.original = "const a = 1;"; // works at any time, also before the editor is ready
el.modified = "const a = 2;";

const { monaco, editor, original, modified } = await el.whenReady(); // full Monaco access
```

The package is ESM only (it needs a browser, there is no CommonJS build).

## 3. React

```jsx
import { MonacoDiff } from "composite-monaco-diff/react";

<div style={{ height: 400 }}>
  <MonacoDiff theme="vs-dark" language="javascript" original={before} modified={after} />
</div>;
```

`react` is an optional peer dependency. The forwarded ref is the element itself (`MonacoDiffElement`): `ref.current.whenReady()`, `ref.current.getManager()`.

## Attributes / props

| Attribute (HTML)                                               | Prop (React)                           | Meaning                                                                                                                                    |
| -------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `theme`                                                        | `theme`                                | `vs`, `vs-dark`, `hc-black`, `hc-light` or a theme registered with `monaco.editor.defineTheme()`. **Global**, see below.                   |
| `language`                                                     | `language`                             | Shared language of both sides. Default `javascript`.                                                                                       |
| `<script lang>` / `el.originalLanguage`, `el.modifiedLanguage` | `originalLanguage`, `modifiedLanguage` | Language of one side. Always wins over the shared `language`.                                                                              |
| scripts / `el.original`, `el.modified`                         | `original`, `modified`                 | The two texts.                                                                                                                             |
| `editable`                                                     | `editable`, `onChange`                 | Without it the editor is a read-only viewer. With it the modified side can be edited; `change` event / `onChange({ original, modified })`. |

Things worth knowing:

- **The theme is global.** Monaco has one theme per page: setting `theme` on one element changes every Monaco editor on the page, the last value wins. Removing the attribute changes nothing.
- **Language precedence** is the same at creation and later: per-side language, then the shared `language`, then `javascript`.
- **Moving the element** inside the document keeps the editor and its state. Removing it destroys the editor; the text is remembered and restored when the element is attached again.
- `el.whenReady()` always returns a promise. It rejects when the markup is wrong or Monaco cannot be loaded; the element also logs the error and dispatches an `error` event.

## Loading Monaco

By default Monaco `0.55.1` is loaded from jsDelivr, with unpkg and cdnjs as fallbacks (15 s timeout per source). To self-host or pin another location, call this before the first editor is created:

```js
import { configureMonaco } from "composite-monaco-diff";

configureMonaco({ vs: "/assets/monaco-editor/min/vs" }); // or an array of urls tried in order
```

Monaco's AMD loader defines global `require` and `define`. If the page already has Monaco (`window.monaco`), that instance is used and nothing is downloaded.

## Other exports

`composite-monaco-diff/MonacoDiffManager` (the engine without the custom element), `composite-monaco-diff/CenterAndHeightResizer` (resizable container used in the demos), `composite-monaco-diff/urlchange/urlchange` (form state in the query string, used in the demos).

# Development

See [DEV.md](DEV.md).
