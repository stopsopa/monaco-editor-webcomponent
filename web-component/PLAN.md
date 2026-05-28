# PLAN.md

# Monaco Diff Web Component

A lightweight Web Component wrapper around Monaco Diff Editor with:

- declarative HTML API
- runtime imperative API
- minimal dependencies
- framework agnostic integration
- progressive enhancement
- clean separation between DOM API and Monaco internals

---

# Goals

The component should:

- allow fully declarative usage directly in HTML
- preserve raw source code formatting
- support runtime updates
- expose Monaco safely without leaking implementation details everywhere
- be ergonomic for humans and AI agents
- avoid overengineering
- remain extensible

---

# Primary HTML Design

```html
<monaco-diff>
  <script type="text/left" lang="javascript">
    function hello() {
      console.log("before");
    }
  </script>

  <script type="text/right" lang="javascript">
    function helloWorld() {
      console.log("after");
    }
  </script>
</monaco-diff>
```

---

# Why `<script>` Tags

Using embedded `<script>` tags solves several problems:

- preserves whitespace exactly
- avoids HTML escaping issues
- avoids prettier formatting corruption
- works with large code blocks
- easy parsing via `textContent`
- browser-native behavior
- SSR friendly

The component will treat these script tags as initialization input only.

They are NOT synchronized after initialization.

---

# Component Responsibilities

The Web Component owns:

- Monaco lifecycle
- model creation/disposal
- resize handling
- diff editor initialization
- option synchronization
- attribute parsing
- declarative content extraction

The consumer owns:

- source text
- runtime updates
- language selection
- external persistence

---

# Proposed Public API

## HTMLElement

```js
const diff = document.querySelector("monaco-diff");
```

---

# Manager API

The component exposes:

```js
diff.getManager();
```

The manager acts as a stable abstraction layer around Monaco internals.

Goal:

- prevent consumers from directly depending on Monaco APIs
- allow internal refactors later
- expose clean high-level operations

---

# Proposed Runtime API

```js
const manager = diff.getManager();

manager.left.set("const a = 1;");
manager.right.set("const a = 2;");

manager.left.lang("javascript");
manager.right.lang("typescript");

manager.options({
  renderSideBySide: false,
});
```

---

# Why Manager API Exists

This API intentionally encapsulates Monaco concepts.

Avoid:

```js
diff.editor.getModel();
```

as the primary workflow.

Consumers should not need Monaco knowledge for normal usage.

Manager provides:

- stable API
- simpler mental model
- easier documentation
- safer future changes

Monaco instance may still be exposed as escape hatch.

---

# Internal Architecture

## Component

```txt
<monaco-diff>
```

Owns:

- shadow DOM
- editor container
- lifecycle hooks
- manager instance

---

# Manager

Internal abstraction layer.

Example:

```txt
MonacoDiffManager
```

Responsibilities:

- create editor
- create/update models
- synchronize options
- dispose resources
- expose side controllers

---

# Side Controllers

Each side should have isolated controller.

Example:

```txt
manager.left
manager.right
```

Each side controller handles:

- text updates
- language updates
- model lifecycle

---

# Example Internal Shape

```js
manager.left.set(text);
manager.left.get();

manager.left.lang(language);
manager.left.getLang();

manager.left.model();
```

---

# Monaco Exposure

Optional escape hatch:

```js
manager.monaco();
manager.editor();
```

This allows advanced consumers to access raw Monaco APIs.

Should NOT be primary documentation path.

---

# Declarative Initialization Flow

On component connection:

1. find `<script type="text/left">`
2. find `<script type="text/right">`
3. extract `textContent`
4. extract `lang`
5. initialize Monaco models
6. create diff editor
7. apply initial options

---

# Attributes

Initial proposed attributes:

```html
<monaco-diff theme="vs-dark" inline read-only></monaco-diff>
```

---

# Attribute Mapping

## `inline`

```js
renderSideBySide = false;
```

---

## `theme`

Passes Monaco theme.

Examples:

- `vs`
- `vs-dark`
- `hc-black`

---

## `read-only`

Applies readonly mode to editor.

---

# Shadow DOM

Use Shadow DOM for:

- style encapsulation
- Monaco layout isolation
- avoiding global CSS collisions

---

# Internal DOM Structure

Example:

```html
<shadow-root>
  <style></style>

  <div class="container"></div>
</shadow-root>
```

Monaco mounts into `.container`.

---

# Resize Handling

Need automatic layout updates.

Recommended:

```js
ResizeObserver;
```

on component root.

Call:

```js
editor.layout();
```

when size changes.

---

# Model Lifecycle

Critical:

Dispose Monaco models correctly.

When replacing models:

```js
oldModel.dispose();
```

Avoid memory leaks.

---

# Language Handling

Language should be independent per side.

Example:

```html
<script type="text/left" lang="typescript">
```

Future support:

```js
manager.left.lang("json");
```

Implementation likely via:

```js
monaco.editor.setModelLanguage();
```

---

# Future Extensibility

Architecture should support later additions:

- unified diff mode
- syntax theme switching
- diff navigation
- editable/readonly sides
- line highlighting
- loading indicators
- async model loading
- file loading
- diff statistics
- events
- custom toolbar
- multiple editors

without redesigning API.

---

# Events

Potential future events:

```js
diff.addEventListener('change', ...)
```

Possible emitted events:

- ready
- change
- languagechange
- optionchange

Not required initially.

---

# Initial Scope

MVP should ONLY implement:

- declarative script parsing
- Monaco diff initialization
- manager API
- text updates
- language updates
- resize handling
- cleanup/disposal

Everything else deferred.

---

# Non-Goals

Avoid initially:

- framework bindings
- virtual DOM integrations
- collaborative editing
- persistence
- syntax autodetection
- file system integration
- custom diff algorithms
- toolbar UI
- tabs
- workers abstraction

---

# Suggested File Structure

```txt
/src
	monaco-diff.js
	manager.js
	side-controller.js
	template.js
	styles.css
```

---

# Suggested Class Layout

```txt
MonacoDiffElement
	└── MonacoDiffManager
			├── LeftSideController
			└── RightSideController
```

---

# Suggested Naming

Custom element:

```txt
monaco-diff
```

Manager:

```txt
MonacoDiffManager
```

Side controller:

```txt
MonacoDiffSide
```

---

# Example Final Usage

## Declarative

```html
<monaco-diff theme="vs-dark">
  <script type="text/left" lang="javascript">
    const a = 1;
  </script>

  <script type="text/right" lang="javascript">
    const a = 2;
  </script>
</monaco-diff>
```

---

## Imperative

```js
const diff = document.querySelector("monaco-diff");

const manager = diff.getManager();

manager.left.set("const a = 10;");

manager.right.set("const a = 20;");

manager.left.lang("typescript");

manager.options({
  renderSideBySide: false,
});
```

---

# Design Philosophy

Primary design principles:

- HTML-first
- progressively enhanced
- minimal API surface
- encapsulated Monaco complexity
- stable abstractions
- framework agnostic
- easy to understand from markup alone

The component should feel like a native browser element rather than a Monaco wrapper.

# This is generally the code snippet for monaco

```js

<section id="container"></section>
<section class="actions">
	<label>Inline</label>
	<input type="checkbox" class="inline-it">
</section>


body, html {
	padding: 0;
	margin: 0;
	height: calc(100vh - 2em);
}
#container {
	height: 100%;
	width: 100%;
	box-sizing: border-box;
}

.actions {
	height: 2em;
	display: flex;
	align-items: center;
	border-top: 1px solid #aaa;
	padding: 0.2em;
	box-sizing: border-box;
}

label {
	padding-right: 0.3em;
}


require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.10.1/min/vs' }});
require(['vs/editor/editor.main'], () => {
	const editor = monaco.editor.createDiffEditor(document.getElementById('container'));
	editor.setModel({
		original: monaco.editor.createModel(text1, 'javascript'),
		modified: monaco.editor.createModel(text2, 'javascript'),
	});

	document.querySelector('.inline-it').addEventListener('change', (e) => {
		editor.updateOptions({ renderSideBySide: !e.target.checked });
	});
});


```

design all using esm
