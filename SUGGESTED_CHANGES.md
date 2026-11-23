# Suggested changes

Review of the whole repository (library code in `web-component/`, the URL/form sync module in
`web-component/urlchange/`, the demos, the React wrapper + `vite-project/`, docs, build and CI).
The findings below were written first, as a review only. They were then implemented — see
**Implementation status** right below. The text of each finding still describes the code as it was
_before_ the fixes (line numbers refer to commit `310c29c`).

## Implementation status

Verified after the changes: `tsc -p tsconfig.json` clean, `/bin/bash build.sh` passes, unit tests 78/78
(`node --test "web-component/**/*.test.ts"`), Playwright 36/36 in local headless Chromium (there were 8 tests
before). The GitHub Actions workflow itself could not be executed locally — it was only checked as YAML.

| #   | Status      | What was done / what differs from the fix plan                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Done        | `data-offset` optional (default 0), strict integer check, unit tests, documented.                                                                                                                                                                                                                                                                                                                                                             |
| 2   | Done        | Scripts stay in the DOM; a move keeps the editor (deferred teardown); remove + re-attach restores text and per-side languages.                                                                                                                                                                                                                                                                                                                |
| 3   | Done        | `destroy()` is safe at any moment and idempotent; `whenReady()` rejects with `MonacoDiffDestroyedError`.                                                                                                                                                                                                                                                                                                                                      |
| 4   | Done        | New `listOf()` codec in `urlchange.ts` (`decode("")` → `[]`, unknown items dropped).                                                                                                                                                                                                                                                                                                                                                          |
| 5   | Done        | New `oneOf()` decoder used for radio / theme / language; lz-string `null` falls back to the default; vanilla tracker also rewrites invalid values out of the URL. The React demos validate but leave the invalid value in the address bar.                                                                                                                                                                                                    |
| 6   | Done        | One shared page `MonacoDiffDemoPage.tsx`, instances kept in `ids=` (shared helper `urlchange/instanceIds.ts`).                                                                                                                                                                                                                                                                                                                                |
| 7   | Done        | CJS build removed. **Differs:** `exports` keeps a wildcard instead of explicit entries (your decision after the review): `"./*": { "types": "./dist/types/*.d.ts", "import": "./dist/esm/*.js" }` — the broken `require` and `default` lines are gone. Everything `tsconfig.build.json` emits is importable, which covers the subpaths the public sandbox repo uses. `scripts/check-package.ts` checks that the `.js` and `.d.ts` sets match. |
| 8   | Done        | Examples use relative URLs, guide snippet rewritten, API table extended, README has a usage section, CI guard against `0.0.0.0` / `localhost`.                                                                                                                                                                                                                                                                                                |
| 9   | Done        | Markup errors reject `whenReady()` with the real reason + `error` event; other `<script>` children are ignored.                                                                                                                                                                                                                                                                                                                               |
| 10  | Done        | One precedence rule everywhere: per-side language → shared `language` → `javascript`. `from-scripts` demo lost its `lang` attributes so the language select keeps working.                                                                                                                                                                                                                                                                    |
| 11  | Done        | Any theme name is passed to Monaco, one warning per unknown name, removal of the attribute does nothing, `setMonacoTheme()` exported, global behaviour documented.                                                                                                                                                                                                                                                                            |
| 12  | Done        | Read-only viewer by default; `editable` attribute / prop, `change` event / `onChange`, `el.original` / `el.modified`.                                                                                                                                                                                                                                                                                                                         |
| 13  | Done        | Ref typed as `MonacoDiffElement` (**type-level breaking change** for code using `useRef<HTMLElement>`), `@ts-ignore` removed, optional peer dependencies, props pushed synchronously (no empty first frame).                                                                                                                                                                                                                                  |
| 14  | Done        | Tracker writes the URL itself, `replace` works, `write: false` opt-out, history methods restored when unused. Old consumers that still write the URL in `onChange` keep working (their write becomes a no-op).                                                                                                                                                                                                                                |
| 15  | Done        | Shared `urlchange/demoWiring.ts` used by all three vanilla demos.                                                                                                                                                                                                                                                                                                                                                                             |
| 16  | Done        | Resizers emit `onResizeEnd` and the URL is written once per drag; `debounceMs` option; React demo text/sliders debounced.                                                                                                                                                                                                                                                                                                                     |
| 17  | Mostly done | `configureMonaco()`, per-source timeout, foreign `require` detected, clean fallback after a partial failure (through the loader's own `require.reset()` — the loader file cannot be loaded twice), stylesheet failure is a warning. **Not changed:** the `/monaco/vs` entry of the generated list (a module-relative URL would break consumers' bundlers; use `configureMonaco`).                                                             |
| 18  | Done        | All three `customElements.define` calls are guarded.                                                                                                                                                                                                                                                                                                                                                                                          |
| 19  | Mostly done | `files` whitelist (`.npmignore` deleted), peer dependencies, `tsconfig.build.json` compiles only public entry points, `scripts/check-package.ts` (package.json ↔ package.dev.json, exports targets, tarball whitelist). **Not done:** moving the demos out of `web-component/` — it would change public GitHub Pages URLs.                                                                                                                    |
| 20  | Done        | Event JSON passed through an env variable, `NPM_TOKEN` only on the release step, per-job permissions, clean step only on `main`. Not executable locally.                                                                                                                                                                                                                                                                                      |
| 21  | Done        | Unit tests run in CI; e2e covers content, lifecycle, URL round trips, React instances and all docs examples. No extra `tsc` step: `pw.sh` already runs it.                                                                                                                                                                                                                                                                                    |
| 22  | Done        | `el.whenReady()` always returns a promise and resolves with `{ monaco, editor, original, modified }`; setters queue before ready.                                                                                                                                                                                                                                                                                                             |
| 23  | Done        | No blank first/last line from the declarative form, empty lines not padded; limits documented.                                                                                                                                                                                                                                                                                                                                                |
| 24  | Done        | Listeners bound once, observer disconnected, pointer events with capture, `onResizeEnd`, attribute removal mirrored, `role="separator"`. Keyboard resizing was not added.                                                                                                                                                                                                                                                                     |
| 25  | Partly done | Compiled twins untracked + ignored, one `toolsURLSearchParams.ts` (+ one test), one `floating-label-pattern.css`, shared demo wiring. **Not done:** the unrouted experiment pages are kept (only their decoders were fixed); `.env` stays tracked (`playwright.sh`, called by CI without `ENVFILE`, falls back to it); naming untouched.                                                                                                      |
| 26  | No change   | Verified in the browser: Monaco 0.55.1's AMD build installs its own blob-based worker factory, the console shows no worker warning when loaded from a CDN.                                                                                                                                                                                                                                                                                    |

Found and fixed on the way (not in the list below):

- `web-component/urlchange/index.ts` — "Delete Component" did not remove an instance that had non-default values
  (the keys were synced onto themselves instead of being removed).
- `scripts/sync-monaco-version.ts --skip` exited with 1 when _all_ CDN probes succeeded, which failed `build.sh`
  the moment cdnjs started to serve Monaco 0.55.1. "All OK" now passes; cdnjs became a third source in the generated list.

Known, left as is:

- `lib/cacheTemplate.parallel.test.ts` fails (it needs `lib/templates/`, which is not in the repository). It is not
  part of the CI unit-test step.
- Disposing an editor while its diff is still being computed makes Monaco log `Uncaught (in promise) Canceled`.
  It is Monaco's own cancellation error and cannot be intercepted when Monaco comes from a CDN.

How the findings were checked:

- By reading the source. Line numbers refer to the state of `main` at commit `310c29c`.
- A few claims were confirmed by running code: `parseInt(null, 10) ?? 0` → `NaN`, `"".split(".")` → `[""]`,
  `decompressFromEncodedURIComponent("")` → `null`, the content of `dist/cjs/*.cjs` and of the packed
  `composite-monaco-diff-0.0.1.tgz`.
- Existing unit tests pass (`trimLeft.parallel.test.ts`, `urlchange/toolsURLSearchParams.test.ts`: 40/40).
- The browser behaviour (Monaco, Playwright e2e) was **not** run. Findings that depend on runtime behaviour
  I could not execute are marked **"verify"**.

Every finding has the same structure: **Problem** (short), **Details**, **Logic** (why it happens, step by step)
and **Fix plan**.

## Overview

| #   | Area              | Finding                                                                                | Severity |
| --- | ----------------- | -------------------------------------------------------------------------------------- | -------- |
| 1   | Component         | `data-offset` is accidentally mandatory — documented examples throw                    | High     |
| 2   | Component         | Moving / re-attaching the element loses all content                                    | High     |
| 3   | Component         | `destroy()` during loading leaks an editor and can mount two editors in one container  | High     |
| 4   | Form / URL        | Empty multi-select round-trips as `[""]` instead of `[]`                               | High     |
| 5   | Form / URL        | Decoders do not validate — control, state and URL disagree; `null` reaches the editor  | High     |
| 6   | Form / URL        | React demos: instances disappear / "add" replaces instance #1 / "Destroy" does nothing | High     |
| 7   | Packaging         | The CJS build contains ESM code; `require()` of the package cannot work                | High     |
| 8   | Docs              | Docs point at `http://0.0.0.0:8089` and at markup that the current code rejects        | High     |
| 9   | Component         | Declarative markup errors surface as "not connected"; wrong order of checks; typo      | Medium   |
| 10  | Component         | Language precedence is inconsistent between init and later changes                     | Medium   |
| 11  | Component         | `theme` is a per-element attribute but a global Monaco setting                         | Medium   |
| 12  | Component / React | Editor is editable, but edits are never reported and get overwritten                   | Medium   |
| 13  | React wrapper     | Prop handling gaps in `react.ts`                                                       | Medium   |
| 14  | Form / URL        | `trackUrl` never writes the URL; `replace` option is dead; 5 copies of the write-back  | Medium   |
| 15  | Form / URL        | `manager` demo: URL defaults override the HTML (300px editor renders at 100px)         | Medium   |
| 16  | Form / URL        | `history.replaceState` on every mousemove / keystroke (Safari rate limit)              | Medium   |
| 17  | Component         | Monaco loader fallback chain is fragile                                                | Medium   |
| 18  | Component         | `customElements.define` is unguarded — loading two builds throws                       | Medium   |
| 19  | Packaging         | Package ships demos, test output, duplicate builds; no peer dependencies               | Medium   |
| 20  | CI                | `echo '${{ toJson(github.event) }}'` is injectable; `NPM_TOKEN` exposed to every step  | Medium   |
| 21  | CI / tests        | Unit tests are not run in CI; e2e only checks a background colour                      | Medium   |
| 22  | Component         | `whenReady()` throws synchronously; unhandled rejections; `setLanguage` before ready   | Low      |
| 23  | Component         | `trimLeft` keeps the leading/trailing blank line and pads empty lines                  | Low      |
| 24  | Component         | Resizer elements re-bind listeners on every reconnect, mouse only                      | Low      |
| 25  | Consistency       | Duplicated files and committed compiled `.js` next to `.ts`                            | Low      |
| 26  | Component         | Monaco web workers when loaded cross-origin from a CDN (**verify**)                    | Low      |

Suggested order of work is at the very end.

---

## 1. `data-offset` is accidentally mandatory — documented examples throw

**Severity: High** · `web-component/MonacoDiffManager.ts:241-254`

### Problem

`<script type="text/original">` / `<script type="text/modified">` without a `data-offset` attribute make the
component throw. `data-offset="0"` throws as well. Four of the five published examples and the example in the
file's own doc comment do not have the attribute.

### Details

```ts
let originalOffset = parseInt(originalScript.getAttribute("data-offset") as string, 10) ?? 0;
...
if (!(originalOffset > 0)) {
  throw new Error(`...data-offset must be a positive integer >${originalOffset}<`);
}
```

Markup without `data-offset`:

- `docs/example1.html`, `docs/example2.html`, `docs/example3.html`, `docs/example4.html`
- doc comment at the top of `web-component/composite-monaco-diff.ts:18-25`

Only `web-component/web-component/from-scripts/index.html` (the page covered by e2e) has `data-offset="3"`, which is
why the tests are green.

### Logic

1. `getAttribute("data-offset")` returns `null` when the attribute is missing.
2. `parseInt(null, 10)` returns `NaN`.
3. `??` only replaces `null`/`undefined`. `NaN` is neither, so `NaN ?? 0` is `NaN` — the `?? 0` default never applies.
4. `!(NaN > 0)` is `true` → throw.
5. For `data-offset="0"`: `!(0 > 0)` is `true` → throw, although `trimLeft()` explicitly supports `0`
   (`trimLeft.ts:8` only rejects negative values) and `0` is the natural "no extra indentation" value.
6. `parseInt` is also too lenient: `"3abc"` → `3`, `"2.7"` → `2`.

The error message says "positive integer", the `?? 0` says "defaults to zero" — the two halves of the code disagree
about the intent. Given the docs, the intent is clearly "optional, default 0".

### Fix plan

1. Add one helper and use it for both scripts:

   ```ts
   function readOffset(script: HTMLScriptElement, type: string): number {
     const raw = script.getAttribute("data-offset");
     if (raw === null || raw.trim() === "") return 0; // optional
     if (!/^\d+$/.test(raw.trim())) {
       throw new Error(
         `<composite-monaco-diff> <script type="${type}">: data-offset must be a non-negative integer, got "${raw}"`,
       );
     }
     return Number(raw);
   }
   ```

2. Remove the two `if (!(offset > 0))` blocks.
3. Add unit tests for `readDeclarativeDiffScripts` (it is a pure DOM function — testable with Playwright or jsdom):
   no attribute, `"0"`, `"3"`, `"abc"`, `"-1"`.
4. Add an e2e test that opens `docs/example1.html` and asserts the editor contains text (see finding 21).
5. Document `data-offset` in `docs/api.html` (it is not mentioned in the API table at all).

---

## 2. Moving / re-attaching the element loses all content

**Severity: High** · `web-component/composite-monaco-diff.ts:80-108`, `web-component/MonacoDiffManager.ts:259-260`

### Problem

When a `<composite-monaco-diff>` is removed from the DOM and attached again — including a plain move with
`parent.appendChild(el)` — it comes back as an empty editor. Both the declarative content and anything set later
through the API are gone.

### Details

- `readDeclarativeDiffScripts()` deletes the two `<script>` elements after reading them (`originalScript.remove()`,
  `modifiedScript.remove()`).
- `disconnectedCallback()` destroys the manager (editor + both models) and sets `_manager = null`.
- `connectedCallback()` creates a brand new manager from the current DOM.

### Logic

1. First connect: scripts are read, then removed. Content now lives only inside the Monaco models.
2. `someOtherParent.appendChild(el)` → the browser calls `disconnectedCallback()` then `connectedCallback()`
   synchronously.
3. `disconnectedCallback()` disposes the models → the content no longer exists anywhere.
4. `connectedCallback()` → `readDeclarativeDiffScripts()` finds no scripts → returns `null` → the editor is created
   with `""` / `""`.

The same happens to content written with `model.original.setValue(...)` (the `from-js` demo, `docs/example5.html`)
and to scroll position, selection and view state.

Realistic triggers: drag-and-drop/sortable lists, moving a node into a dialog, frameworks that re-parent nodes,
keyed list reordering in React (React moves DOM nodes with `insertBefore`).

Removing the scripts is also unnecessary: the element has a shadow root without a `<slot>`, so light-DOM children
are never rendered, and `<script type="text/original">` is inert.

### Fix plan

1. **Do not remove the scripts.** Delete `MonacoDiffManager.ts:259-260`. They stay as the source of truth and remain
   visible in dev tools.
2. **Do not destroy on a move.** Defer the teardown and cancel it if the element is connected again:

   ```ts
   disconnectedCallback(): void {
     queueMicrotask(() => {
       if (this.isConnected) return; // it was only moved
       this._manager?.destroy();
       this._manager = null;
     });
   }
   ```

   `connectedCallback()` already returns early when `_manager` exists, so a move keeps the same editor, models and
   state. The existing `ResizeObserver` re-layouts it in the new place.

3. For a real remove → later re-add (manager really destroyed), decide and document the behaviour. Recommended:
   snapshot `original`/`modified` values and languages in `destroy()` callers (the element), and feed them as
   `options.original` / `options.modified` to the next manager, so the element behaves like a native form control
   that keeps its value while detached.
4. Add an e2e test: move the element, assert the text is still there.

---

## 3. `destroy()` during loading leaks an editor and can mount two editors in one container

**Severity: High** · `web-component/MonacoDiffManager.ts:335-358, 377-391`

### Problem

If the manager is destroyed before Monaco finished loading, the pending initialisation still runs afterwards and
creates an editor that nobody owns. Combined with a reconnect this puts two diff editors into the same container.

### Details

The constructor starts an async function that awaits `hydrateCache()` and `ensureMonacoStylesInShadowRoot()` and then
calls `createDiffEditor`, `createModel` ×2 and creates a `ResizeObserver`. `destroy()` only cleans what exists _at the
moment it is called_; it leaves no mark that tells the pending async function to stop.

### Logic

1. `connectedCallback()` → manager A created → A waits for the Monaco download (hundreds of ms on a cold cache).
2. Element is disconnected → `A.destroy()`: `_editor` is still `null`, `_resizeObserver` is `null` → nothing to clean.
3. Element is connected again → manager B is created **on the same `.container` div**.
4. Monaco arrives. A's continuation runs: creates editor A in the container, two models, a `ResizeObserver`.
   B's continuation runs: creates editor B in the same container.
5. Result: two editors stacked in one div, editor A + its two models + its observer can never be disposed because
   the element only references B.

Triggers: React `StrictMode` (mount → unmount → mount in dev; `vite-project/src/main.tsx` has a StrictMode switch),
route changes while loading, any quick remove/add, and the move from finding 2.

Without a reconnect it is "only" a leak: an editor is created inside a detached element.

### Fix plan

1. Add a flag and check it after every `await`:

   ```ts
   private _destroyed = false;

   this._readyPromise = (async () => {
     const monaco = await hydrateCache(MONACO_GENERATED);
     if (this._destroyed) return;
     await ensureMonacoStylesInShadowRoot(container);
     if (this._destroyed) return;
     ...
   })();

   public destroy() {
     this._destroyed = true;
     ...
   }
   ```

2. Decide what `whenReady()` means for a destroyed manager. Recommended: reject with a recognisable error
   (`new Error("MonacoDiffManager destroyed before ready")`) so callers awaiting it do not continue against a `null`
   editor; `react.ts` already has a `try/catch` and an `active` flag.
3. Make `destroy()` idempotent (it nearly is; the flag makes it explicit).
4. The deferred teardown from finding 2 removes most of the triggers; this flag covers the rest.
5. Test: create a manager, call `destroy()` synchronously, wait, assert the container has no `.monaco-diff-editor`.

---

## 4. Empty multi-select round-trips as `[""]` instead of `[]`

**Severity: High (form data)** · `web-component/urlchange/index.ts:38-43`, same pattern in
`vite-project/src/pages/params/ModURLSearchParamsComponent.tsx` and `UrlSerialiser.tsx` if they use `split`

### Problem

Deselecting every option of the multiple select stores a state that is not "nothing selected" but
"one item selected, whose value is the empty string".

### Details

```ts
multiSelect: {
  default: ["item1", "item2"],
  getParam: "m",
  encode: (value) => value.join("."),
  decode: (value) => value.split(".") as MultiSelectOptionsArray,
},
```

### Logic

1. User deselects all options → `getMultiSelect()` returns `[]`.
2. `setParam("multiSelect", [])`: `[]` differs from the default `["item1","item2"]`, so it is not elided →
   `encode([])` → `""` → URL gets `m-1=`.
3. Read back: `raw` is `""`, which is `!== null`, so `decode("")` runs → `"".split(".")` → `[""]`.
4. `params.multiSelect` is now `[""]`. The `<select>` _looks_ right (no option has value `""`), but the JSON dump,
   and any code using `params.multiSelect.length` or iterating it, sees one bogus item. Typed as
   `SingleOptionType[]`, it contains a value outside the union — the `as` cast hides it.

A second weakness of the same codec: `.` is the separator, so option values containing `.` cannot be represented.
Not a problem with `item1..item4`, but it is a trap when the pattern is copied.

### Fix plan

1. Make decode symmetrical with encode and validate against the known options:

   ```ts
   decode: (value: string) =>
     (value === "" ? [] : value.split(".")).filter((v): v is SingleOptionType =>
       (selectOptions as readonly string[]).includes(v),
     ),
   ```

2. Check the React counterparts (`ModURLSearchParamsComponent.tsx`, `UrlSerialiser.tsx`) for the same `split`
   pattern and fix them the same way.
3. If values may ever contain the separator, switch to repeated keys (`m-1=a&m-1=b` — `URLSearchParams.getAll`,
   which `mergeURLSearchParams`/`syncURLSearchParams` already preserve) and extend `ParamDef` with optional
   `encodeAll`/`decodeAll`.
4. Add a test: `decode(encode([]))` deep-equals `[]`.

---

## 5. Decoders do not validate — control, state and URL disagree; `null` reaches the editor

**Severity: High (form data)** · several files, listed below

### Problem

Values coming from the URL are user input, but most `decode` functions pass them through with a TypeScript cast.
An unknown value produces three different truths at once: what the URL says, what the form control shows, and what
the application state/editor uses.

### Details

| Where                                                                                   | Param             | `decode`                                   | What a bad value does                                                                                                 |
| --------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `urlchange/index.ts:32-37`                                                              | `r-N` radio       | `value as RadioOptionType`                 | `?r-1=bogus` → no radio is checked, `params.radio === "bogus"`                                                        |
| `manager/index.ts:175-180`, `from-js/index.ts:161-166`, `from-scripts/index.ts:111-116` | `lang`            | `(value) => value`                         | `?lang=bogus` → `<select>` shows nothing selected (`selectedIndex === -1`), Monaco gets an unknown language id        |
| `vite-project/src/pages/MonacoDiffDemo.tsx:12-17`, `MonacoDiffDemoAttr.tsx:12-17`       | `theme`           | `value as MonacoTheme`                     | `?theme=bogus` → `<select>` has no matching option; the element maps it to `vs` while the demo's default is `vs-dark` |
| `MonacoDiffDemo.tsx:29-40`, `MonacoDiffDemoAttr.tsx:29-40`                              | `orig-N`, `mod-N` | `decompressFromEncodedURIComponent(value)` | returns **`null`** for `orig-1=` and `""` for garbage                                                                 |

The vanilla `theme` param is the one place that does it right: `decode: (value) => (isMonacoTheme(value) ? value : "")`.

### Logic

- `readState` (`urlchange.ts:156`, and `modURLSearchParams.ts:55` in React) does
  `raw !== null ? d.decode(raw) : d.default`. So the default is used only when the key is _absent_. A present but
  invalid value goes straight through `decode`.
- lz-string case, step by step: URL `?orig-1=` → `raw === ""` → `decompressFromEncodedURIComponent("")` → `null` →
  `params.original === null` → `<textarea value={null}>` (React warning, switches to uncontrolled) → in `react.ts:55`
  `original !== undefined && model.original.getValue() !== original` is `true` → `model.original.setValue(null)`.
  The declared type is `string`, so nothing warns at compile time.
- Invalid values are also never cleaned up: the write-back in every `onChange` copies the raw slice of the URL
  (`updatedURLSearchParams`) back, so `?theme=bogus` stays in the address bar while the UI shows the default.

### Fix plan

1. Give every enumerated param a validating decoder that falls back to the default:

   ```ts
   const oneOf = <T extends string>(allowed: readonly T[], fallback: T) => (v: string): T =>
     (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

   radio:    { ..., decode: oneOf(radioOptions, defaultRadioOption) },
   theme:    { ..., decode: oneOf(MONACO_THEMES, "vs-dark") },
   language: { ..., decode: oneOf(LANGUAGES, "javascript") },
   ```

   Keep one exported `LANGUAGES` list and render the `<option>`s from it, so the select and the decoder cannot drift
   (today the vanilla demos offer 7 languages, the React demos 5).

2. lz-string: `decode: (v) => decompressFromEncodedURIComponent(v) ?? DEFAULT_ORIGINAL` (or `?? ""`).
3. Make the library defensive as a second line: in `react.ts` only call `setValue` when
   `typeof original === "string"`.
4. Optional, in the tracker itself: after decoding, re-encode the decoded params and use _that_ as
   `updatedURLSearchParams`. Then invalid values are normalised out of the URL automatically
   (`?theme=bogus` → param removed because it decodes to the default).

---

## 6. React demos: instances disappear, "add" replaces instance #1, "Destroy" does nothing

**Severity: High (form data / state)** · `vite-project/src/pages/MonacoDiffDemo.tsx:68-103`,
`vite-project/src/pages/MonacoDiffDemoAttr.tsx:68-103`

### Problem

The list of editor instances is derived from "which `-N` suffixes exist in the query string", while the param
module removes a key from the query string whenever its value equals the default. These two rules fight each other.

### Details

```ts
const instances = useMemo(() => {
  ... params.forEach((_, key) => { const match = key.match(/-(\d+)$/); if (match) indexes.add(...) });
  return parsed.length > 0 ? parsed : [1];          // fallback
}, [location.search]);

const addInstance = () => { ... currentParams.set(`lang-${nextIndex}`, "javascript"); ... };
```

### Logic

Three reproducible sequences:

**A. "Initialize New Instance" on a fresh page replaces #1 instead of adding #2**

1. URL has no params → `instances = [1]` (fallback).
2. Click add → `nextIndex = 2` → URL becomes `?lang-2=javascript`.
3. `instances` is recomputed from the URL: only suffix `2` exists → `[2]`. Instance #1 is gone, because it has only
   default values and therefore no keys.

**B. An instance vanishes when the user picks the default language**

1. Instance #2 exists only thanks to `lang-2=javascript` (written explicitly by `addInstance`).
2. User selects TypeScript → `lang-2=typescript`. Still fine.
3. User selects JavaScript again → `setParam` sees value === default → **deletes** `lang-2`
   (`modURLSearchParams.ts:74-75`).
4. If #2 has no other non-default param, no key with suffix `-2` is left → the instance disappears from the page
   while the user is interacting with it.

**C. "Destroy" on an all-default instance does nothing**

`removeInstance` deletes the instance's keys and navigates only `if (changed)`. An instance shown through the
fallback (or one with only defaults) has no keys → nothing changes → the button is dead.

The vanilla demo (`web-component/urlchange/index.ts:62-105`) already solved exactly this with a dedicated
`ids=1,2` key that is independent of the tracked params. The React demos were not updated the same way —
this is a consistency gap between the two implementations of the same idea.

### Fix plan

1. Port the `ids` approach to both React pages:
   - `instances` = ids from `ids=` **union** suffixes found in other keys (keeps deep links like `?orig-3=...` working).
   - If the result is empty, use `[1]`.
   - `addInstance`: write `ids=<existing>,<next>` — where `<existing>` is the currently _displayed_ list
     (so the fallback `[1]` is made explicit the first time) — and stop writing the fake `lang-N=javascript`.
   - `removeInstance`: remove the instance's keys **and** its id from `ids`; always navigate.
2. Extract `parseInstanceIds` / `instanceIdsPatch` from `urlchange/index.ts` into a shared module and use it from
   both the vanilla and React demos.
3. `MonacoDiffDemo.tsx` and `MonacoDiffDemoAttr.tsx` are ~95% identical (everything except the effect and the
   `<MonacoDiff>` line). Extract the shared page into one component that takes the editor as a render prop, so this
   fix (and the next one) is made once.
4. e2e: add instance → two editors visible; switch language away and back → still two editors; destroy → one.

---

## 7. The CJS build contains ESM code; `require()` of the package cannot work

**Severity: High (packaging)** · `tsconfig.cjs.json`, `.github/fix-cjs.sh`, `package.json:26-43`

### Problem

`package.json` advertises a CommonJS entry (`"require": "./dist/cjs/Module.cjs"`), but the files in `dist/cjs` are
ES modules that were only renamed to `.cjs`.

### Details

`tsconfig.cjs.json` sets `"module": "esnext"`. Actual output, `dist/cjs/Module.cjs`:

```js
export * from "./composite-monaco-diff.js";
export * from "./MonacoDiffManager.js";
export * from "./trimLeft.js";
```

Three separate defects:

1. `.cjs` forces Node and bundlers to parse the file as CommonJS → `export` is a `SyntaxError`.
2. The specifiers still say `./composite-monaco-diff.js`, but `fix-cjs.sh` renamed that file to `.cjs`. The perl
   rewrite in `fix-cjs.sh` only looks for `require("...js")`, which never occurs in ESM output.
3. The wildcard export says `"require": "./dist/cjs/*.js"` — after the rename no `.js` file exists in `dist/cjs`.

### Logic

`build.sh` → `build_cjs` → `tsc -p tsconfig.cjs.json` (emits ESM because `module: esnext`) → `fix-cjs.sh` renames
`*.js` → `*.cjs` and patches `require(` calls that are not there. Nothing in the pipeline fails, so the broken output
is packed and published. It is not noticed because every consumer in this repo (`vite-project`, the demos) uses
`import`.

Real CJS output is also not possible with the current sources/config without further changes:
`verbatimModuleSyntax: true` forbids ESM syntax when emitting CJS, `moduleResolution: bundler` requires an ES module
target, and the demo files use top-level `await`.

### Fix plan

Recommended — **drop CJS**. The package is a browser custom element that registers itself on import and loads Monaco
through an AMD `<script>`; there is no meaningful `require()` consumer.

1. Remove `build_cjs`, `tsconfig.cjs.json`, `.github/fix-cjs.sh` (and the unused `.github/fix-mjs.sh`).
2. `package.json`:

   ```json
   "exports": {
     ".":       { "types": "./dist/types/Module.d.ts", "import": "./dist/esm/Module.js" },
     "./react": { "types": "./dist/types/react.d.ts",  "import": "./dist/esm/react.js" },
     "./package.json": "./package.json"
   }
   ```

   Replacing the `"./*"` wildcard with explicit entries also stops exposing demo files as public API (finding 19).

Alternative — if CJS must stay: build it with a bundler (`esbuild --format=cjs --bundle` per entry, the tool is
already a dependency) instead of `tsc` + rename, and fix the wildcard to `./dist/cjs/*.cjs`.

Either way add a smoke test to `build.sh`: `node -e "import('composite-monaco-diff')"` is not usable (needs a DOM),
so at least run `node --check` on every file in `dist/` — it would have caught this.

---

## 8. Docs point at `http://0.0.0.0:8089` and at markup that the current code rejects

**Severity: High (docs are the product's front door)** · `docs/example2.html` … `example5.html`, `docs/api.html`,
`README.md`, `web-component/composite-monaco-diff.ts:16-26`

### Problem

The published documentation cannot work for a visitor: it loads a module from the developer's local server and it
shows markup that the current source throws on.

### Details

1. `http://0.0.0.0:8089/web-component/CenterAndHeightResizer.js` is hard-coded in `docs/example2.html`,
   `example3.html`, `example4.html`, `example5.html` and in the "Guide & Setup" snippet of `docs/api.html`.
   - On GitHub Pages (HTTPS) this is blocked as mixed content / unreachable.
   - In example 2 and 3 only the resizer fails (the editor has no sized parent then).
   - In example 4 and 5 the import is inside the same module as the rest: a failing static import aborts the whole
     module → in example 5 the code that fills the editor never runs.
2. Examples 1–4 have no `data-offset` → finding 1.
3. The examples load `https://stopsopa.github.io/.../composite-monaco-diff.js`, i.e. whatever was deployed last,
   not the code next to them. Docs and code can silently disagree (that is how 1 and 2 stayed hidden). **Verify**
   what the deployed file currently does.
4. `docs/api.html` snippet: declared as `lang="python"` although it is HTML; uses `original` / `modified` variables
   that are never defined; mixes escaped `&lt;script` and raw `<composite-monaco-diff>` tags.
5. `docs/api.html` API table does not mention `data-offset`, the `lang` attribute semantics from finding 10, or that
   `theme` is global (finding 11).
6. `README.md` has no installation or usage section at all — and `README.md` is what npm shows.

### Fix plan

1. Use relative URLs inside `docs/`: `../web-component/composite-monaco-diff.js` and
   `../web-component/CenterAndHeightResizer.js`. They work locally (`server.ts` serves the repo root) and on
   GitHub Pages, and they always match the code of the same commit.
2. Keep one absolute CDN example only in the "how to use it on your site" snippet, where it belongs.
3. Fix the snippet in `api.html` (`lang="html"`, define the variables, consistent escaping).
4. Add `data-offset`, language precedence and global theme notes to the API table.
5. Add to `README.md`: install, the three usage modes (script tag, ESM import, React), minimal examples.
6. Add a cheap guard to CI: `grep -rn "0\.0\.0\.0\|localhost" docs/ index.html && exit 1`.
7. Add each `docs/example*.html` to the e2e suite (finding 21).

---

## 9. Declarative markup errors surface as "not connected"; wrong order of checks; typo

**Severity: Medium** · `web-component/MonacoDiffManager.ts:194-233, 333`, `web-component/composite-monaco-diff.ts:80-123`

### Problem

When the `<script>` children are wrong, the developer gets a misleading second error, and in some cases the first
error message describes the wrong mistake.

### Details / Logic

1. `resolveDiffContent(options)` runs **synchronously in the `MonacoDiffManager` constructor** (line 333).
   If it throws, `new MonacoDiffManager(...)` throws inside `connectedCallback()`, so `this._manager` is never
   assigned. The browser reports the real error once to the console as an uncaught exception, but every later
   `el.whenReady()` / `el.getManager()` — which is what application code actually calls — throws
   `"<composite-monaco-diff>: not connected"`. The element _is_ connected; the message sends the developer in the
   wrong direction.
2. Order of checks: `if (scripts.length < 2)` runs before the per-script type check. A single
   `<script type="text/original">` therefore reports "expected … two `<script>` elements, found 1" instead of the
   precise `missing <script type="text/modified">` that the code further down would produce.
3. The message itself is garbled: `expected exactly at leasttwo <script> elements` ("exactly" + "at least",
   missing space).
4. Any other `<script>` child (for example an inline `<script type="application/json">` config) is a hard error.
   That is a defensible choice but it should be deliberate and documented.

### Fix plan

1. Move content resolution inside the async block so that every failure becomes a rejection of the ready promise:

   ```ts
   this._readyPromise = (async () => {
     const content = resolveDiffContent(options); // throws -> whenReady() rejects with the real error
     const monaco = await hydrateCache(MONACO_GENERATED);
     ...
   })();
   ```

   The element then always has a manager; `await el.whenReady()` rejects with the actual markup error.
   Also emit an `error` CustomEvent from the element so pages without their own `await` can react.

2. Delete the `scripts.length < 2` block; the existing duplicate/unknown/missing checks already cover all cases with
   better messages.
3. Only consider `script[type="text/original"], script[type="text/modified"]` and ignore other scripts — or keep the
   strict behaviour and say so in the docs.

---

## 10. Language precedence is inconsistent between init and later changes

**Severity: Medium** · `MonacoDiffManager.ts:271-300, 394-401`, `composite-monaco-diff.ts:97-103, 135-142`,
`react.ts:42-88`

### Problem

Which language wins — the shared `language` or the per-side one — depends on _when_ it is set.

### Details / Logic

At creation (`resolveDiffContent`):

```
per-side option  ??  <script lang>  ??  shared language  ??  "javascript"
```

→ per-side wins. `<composite-monaco-diff language="json">` with `<script ... lang="typescript">` shows TypeScript.

On a later change (`attributeChangedCallback` → `_applyLanguage` → `setLanguage`):

```ts
cachedMonaco?.editor.setModelLanguage(model.original, lang);
cachedMonaco?.editor.setModelLanguage(model.modified, lang);
```

→ shared wins and overwrites both sides. Consequences:

1. Setting `language` to the value it already conceptually had changes the result: the `from-scripts` demo calls
   `diffEl.setAttribute("language", "javascript")` on mount (`fireOnMount`), which silently discards any per-script
   `lang`. Invisible in the demo only because both scripts are `javascript`.
2. Removing the attribute resets both sides to `"javascript"`, not to the per-script languages.
3. React: `react.ts` passes `language` as an attribute and applies `originalLanguage`/`modifiedLanguage` in an effect
   whose dependency list is `[original, modified, originalLanguage, modifiedLanguage]`. When only `language` changes,
   the attribute path overrides both models and the effect does not re-run → the per-side props are lost until one
   of them changes.

### Fix plan

1. Store the three inputs in the manager (`_sharedLanguage`, `_originalLanguage`, `_modifiedLanguage`) and compute
   the effective language in one place with the same rule as at init:

   ```ts
   private _applyLanguages() {
     const m = this._editor?.getModel(); if (!m) return;
     monaco.editor.setModelLanguage(m.original, this._originalLanguage ?? this._sharedLanguage ?? DEFAULT_LANGUAGE);
     monaco.editor.setModelLanguage(m.modified, this._modifiedLanguage ?? this._sharedLanguage ?? DEFAULT_LANGUAGE);
   }
   ```

2. Public API: `setLanguage(shared)`, plus `setOriginalLanguage(lang | undefined)` / `setModifiedLanguage(...)`.
   All three just update a field and call `_applyLanguages()`.
3. `react.ts`: call those setters instead of `monaco.editor.setModelLanguage` and add `language` to the effect's
   dependency list.
4. Document the precedence in `docs/api.html`.

---

## 11. `theme` is a per-element attribute but a global Monaco setting

**Severity: Medium** · `composite-monaco-diff.ts:85-94, 125-133`, `MonacoDiffManager.ts:340-347`

### Problem

`<composite-monaco-diff theme="vs-dark">` looks like it themes one editor. In Monaco the theme is global
(`monaco.editor.setTheme`), so it re-themes every Monaco editor on the page — other diff elements and any unrelated
Monaco instance of the host application.

### Details / Logic

1. Two elements, `theme="vs"` and `theme="vs-dark"`: whichever is created or changed last wins for both. The DOM
   attributes then no longer describe what is on screen.
2. Removing the attribute calls `setTheme("vs")` — it forces light for everyone rather than "no opinion".
3. An invalid value (`theme="dark"`) is silently mapped to `undefined` → `"vs"`. No warning, so a typo looks like the
   attribute "does not work".
4. Custom themes registered with `monaco.editor.defineTheme("my-theme", …)` cannot be used through the attribute
   because `parseThemeAttribute` only accepts the four built-ins.

### Fix plan

1. Document the global behaviour prominently (API table + README).
2. `console.warn` once for an unknown theme value instead of silently falling back.
3. Accept any non-empty string in the attribute and let Monaco decide (keeps custom themes usable); keep
   `isMonacoTheme` for the demos' `<select>` validation.
4. On attribute removal do nothing (do not force `"vs"`).
5. Consider exporting a `setMonacoTheme(theme)` function so applications with several editors have one obvious,
   honestly-global place to call.

---

## 12. Editor is editable, but edits are never reported and get overwritten

**Severity: Medium (form data)** · `MonacoDiffManager.ts:340-347`, `react.ts:55-60`, both React demo pages

### Problem

Monaco's diff editor allows typing in the modified pane by default. The component offers no change notification, so
text typed there never reaches the form/URL state — and the next prop update replaces it.

### Logic

1. React demo: the `<textarea>` → URL → `modified` prop → `model.modified.setValue(modified)`. One direction only.
2. The user types in the editor's right pane. The model changes; the textarea, the URL and React state do not.
3. The user then changes anything that re-runs the effect with a different `modified` (or types in the textarea):
   `model.modified.getValue() !== modified` is `true` → `setValue(modified)` → the edits made in the editor are
   discarded, the cursor/undo stack are reset.

So the page shows two inputs for the same value (textarea and editor) that can hold different content.

### Fix plan

Pick one of two consistent models and make it explicit:

- **Viewer (simplest, matches the README's purpose "present diffs")**: default `readOnly: true` (and
  `originalEditable: false`) in the manager's `createDiffEditor` options; users who want editing pass
  `editorOptions: { readOnly: false }`.
- **Controlled input**: subscribe to `model.modified.onDidChangeContent` (and original, when editable) and
  dispatch a `change` CustomEvent from the element with `{ original, modified }`; add `onChange` to `MonacoDiffProps`
  in `react.ts`. Add `value`-style getters (`el.original`, `el.modified`) so reading does not require
  `getManager().getEditor().getModel()`. In the wrapper, skip `setValue` when the incoming prop equals the last
  value emitted through `onChange` (prevents cursor jumps).

Dispose the content listeners in `destroy()`.

---

## 13. Prop handling gaps in the React wrapper

**Severity: Medium** · `web-component/react.ts`

### Problem / Details / Logic

1. **`language` not in the effect dependencies** — see finding 10.
2. **`null` / non-string values reach `setValue`** — see finding 5. The check is `original !== undefined`.
3. **Children that are `<script>` elements break React.** `children` is forwarded into the custom element. If someone
   writes the declarative form in JSX, the component removes those nodes (finding 2) while React still believes it
   owns them → `NotFoundError: Failed to execute 'removeChild'` on the next reconciliation/unmount. Fixing finding 2
   (do not remove scripts) also fixes this.
4. **`key` and `ref` are declared inside `MonacoDiffProps`.** `key` is never a prop; `ref` is already added by
   `React.RefAttributes`. They only confuse the generated `.d.ts`.
5. **`// @ts-ignore` on `import * as React from "react"`** hides a missing dependency declaration: the root
   `package.json` has no `peerDependencies` (finding 19). Consumers get no install-time warning and the wrapper's
   types degrade to `any` when `@types/react` is missing.
6. **`Module.ts` has `// export * from "./react.js"` commented out**, while `docs/api.html` presents the React
   wrapper as part of the API. It is reachable only through the wildcard export `composite-monaco-diff/react` —
   undocumented.
7. **The ref type is `HTMLElement`**, so `ref.current.whenReady()` / `.getManager()` (documented in `api.html`) do
   not type-check without a cast. Both demos use `as any`.
8. First render shows an empty editor until `whenReady()` resolves and the effect applies `original`/`modified`.
   With the declarative path the content is there from the first model. Passing the initial text into the manager
   options would avoid the empty frame and one diff computation.

### Fix plan

1. Type the ref as `MonacoDiffElement` (`React.forwardRef<MonacoDiffElement, MonacoDiffProps>`).
2. Remove `key`/`ref` from `MonacoDiffProps`; remove the `@ts-ignore`; declare `react` as an optional peer
   dependency.
3. Add an explicit `"./react"` export (finding 7) and document `import { MonacoDiff } from "composite-monaco-diff/react"`.
4. Add `language` to the dependency list and use the manager setters from finding 10.
5. Guard with `typeof original === "string"`.
6. Optional: let the element accept initial content through properties (`el.original = "..."` before connect) and
   have the wrapper set them in the ref callback, so the first model already has the text.

---

## 14. `trackUrl` never writes the URL; `replace` option is dead; five copies of the write-back

**Severity: Medium (API consistency)** · `web-component/urlchange/urlchange.ts:173-263`

### Problem

`setParam` / `setParams` do not change the address bar. They only call `onChange` with the _would-be_ state and rely
on the caller to write it to `history`. The types and comments say otherwise.

### Details

```ts
const replace = options?.replace !== false;   // line 178 — never read again

/** Commits the new URLSearchParams using standard history methods. */
const writeSearch = (next) => {
  ...
  syncAfterLocalWrite(next);                  // -> emitCurrentState(next) -> onChange(...)   (no history call)
};
```

Every consumer therefore repeats this block inside `onChange` — `manager/index.ts` (twice), `from-js/index.ts`
(twice), `from-scripts/index.ts` (twice), `urlchange/index.ts`:

```ts
const current = new URLSearchParams(window.location.search);
const next = syncURLSearchParams(current, governedKeys, updatedURLSearchParams);
if (next.toString() !== current.toString()) {
  history.replaceState(history.state, "", buildUrlWithSearchParams(window.location.href, next));
}
```

### Logic

1. The documented option `replace: false` ("use history.pushState instead of replaceState") has no effect, because
   the module never calls either.
2. A consumer that only wants to _react_ to params and forgets the write-back gets silently broken forms:
   `setParam("a", 1)` → `onChange` fires with `a=1` → URL unchanged → `setParam("b", 2)` starts again from
   `window.location.search` (which still lacks `a`) → `onChange` fires with `b=2` and `a` back at its default.
   The first change is lost without any error.
3. `getParams()` reads `window.location.search`, so between `setParam` and the consumer's write-back it returns the
   old value — two sources of truth for a moment.
4. Seven hand-copied blocks have to stay identical forever.

Related small points in the same module:

- `history.pushState/replaceState` are monkey-patched once and never restored, even when the last listener
  unsubscribes. Acceptable for a page-level module, but worth a comment and a restore when `urlChangeListeners`
  becomes empty.
- `notifyUrlChange` iterates the live `Set` while listeners add new listeners (`reconcileSections` creates trackers
  inside a listener). `Set` iteration visits entries added during iteration, so a just-created tracker is called
  immediately in the same pass. Iterate over a copy (`[...urlChangeListeners]`) to make the order predictable.
- The JSDoc example for `trackUrl` and the "Vanilla counterpart to React `modURLSearchParams`" comment describe an
  API that behaves differently from the React one (React `setParam` navigates by itself).

### Fix plan

1. Make the tracker own the write:

   ```ts
   const writeSearch = (next: URLSearchParams) => {
     const current = new URLSearchParams(window.location.search);
     if (compareNormalizedSearchParams(next, current)) return;
     const url = buildUrlWithSearchParams(window.location.href, next);
     lastSignature = trackedSignature(next, ctx); // set before writing: suppresses the echo
     (replace ? history.replaceState : history.pushState).call(history, history.state, "", url);
     const { params, updatedURLSearchParams } = readState(next, ctx);
     onChange(params, updatedURLSearchParams, governedKeys);
   };
   ```

2. Delete the seven write-back blocks from the demos; `onChange` becomes "apply params to the UI" only.
3. Keep an opt-out (`write: false`) if the "caller writes" mode is wanted for embedding in routers.
4. Iterate a copy of the listener set; restore the history methods when the set becomes empty.
5. Extend `toolsURLSearchParams.test.ts`-style tests to `urlchange.ts` (needs a tiny `history`/`location` stub or a
   Playwright test on `urlchange/index.html`): two consecutive `setParam` calls both end up in the URL;
   `replace: false` creates a history entry.

---

## 15. `manager` demo: URL defaults override the HTML (300px editor renders at 100px)

**Severity: Medium** · `web-component/manager/index.ts:83-156` vs `web-component/manager/index.html:20-28`

### Problem

The page declares the editor's resizer with `height="300px"`, but on a clean URL the script immediately sets it to
`100px`.

### Logic

1. One shared `config` is used for **both** `<center-and-height-resizer>` elements, with fixed defaults
   `left: "100px"`, `center: "1200px"`, `height: "100px"`.
2. `trackUrl(..., { fireOnMount: true })` → no `h-1` in the URL → `readState` returns the config default `"100px"` →
   `resizer.setAttribute("height", "100px")` on the second resizer, whose HTML said `300px`.
3. The other two demos were already corrected to take the default from the element
   (`default: resizer.getAttribute("height") ?? "100px"` in `from-js/index.ts:79-98` and
   `from-scripts/index.ts:21-40`). `manager/index.ts` was left behind.

Two more leftovers in the same config:

- It contains a `theme` entry. With the key function every resizer therefore "governs" `theme-0` / `theme-1`, which
  nothing ever sets. The real theme param is the un-indexed `theme` handled by the second tracker below. Harmless
  but confusing — and the write-back would delete a `theme-0` param if one existed.
- The key function `/^\d+$/.test(String(i)) ? `${key}-${i}` : key` has a dead branch: `ctx` is always the numeric
  index here. The other demos use plain `` `${key}-${i}` ``.

### Fix plan

1. Replace the block with the same `wireResizerUrlSync(resizer, index)` function the other two demos use.
2. Better: move `wireResizerUrlSync` and the theme/language tracker into one shared module (for example
   `web-component/urlchange/demoWiring.ts`) and import it from all three demos. Today the three `index.ts` files are
   near-identical copies, and this bug exists precisely because one copy drifted.
3. Remove the `theme` entry and the conditional key function.
4. e2e: assert the editor container height is 300px on a clean URL.

---

## 16. `history.replaceState` on every mousemove / keystroke

**Severity: Medium** · resizer wiring in the three demos, `urlchange/index.ts` (`onText` → `input` event), React
demos (`onChange` of textarea and range inputs → `navigate(..., { replace: true })`)

### Problem

Dragging a resizer, typing, or moving a range slider writes to the History API on every single event.

### Logic

1. `CenterAndHeightResizer` dispatches `onLeft` / `onCenter` / `onHeight` inside `mousemove`
   (`CenterAndHeightResizer.ts:299-309, 329-337`) → `syncToUrl` → `setParams` → `history.replaceState`.
   A one-second drag is 60+ calls.
2. Safari throws `SecurityError: Attempt to use history.replaceState() more than 100 times per 30 seconds`.
   The exception is thrown inside the mousemove handler → the drag stops updating the URL and logs errors; Chrome
   throttles navigation-like IPC with a console warning.
3. In the React demos every keystroke additionally lz-compresses the whole text and triggers a router navigation,
   which re-renders the page tree and re-runs `separateIndexedSearchParams` for every instance.

### Fix plan

1. Separate "live value" from "persisted value": apply the change to the UI immediately, write the URL debounced
   (~200–300 ms) or on the end of the gesture.
2. For the resizer: dispatch an additional `onResizeEnd` event from the `mouseup` handler and sync the URL only
   there (the attribute is already updated live, so the layout stays smooth).
3. For text/range inputs: keep local state for the control and call `setParam` from a debounced callback
   (or on `change`/`blur` instead of `input`).
4. Add an optional `debounceMs` to `TrackUrlOptions` so the policy lives in one place once finding 14 is done.

---

## 17. Monaco loader fallback chain is fragile

**Severity: Medium** · `web-component/MonacoDiffManager.ts:107-178`

### Problem

The "try CDN 1, then CDN 2, then local" logic works for the simplest failure (loader script unreachable) but not for
the others, and it trusts any global `require`.

### Details / Logic

1. **Partial failure is not retried cleanly.** If `loader.js` loads from CDN 1 but `vs/editor/editor.main` fails
   (blocked by CSP, a 404 for one chunk, a flaky connection), the next attempt sees `win.require` already present and
   only calls `require.config({ paths: { vs: nextBase } })` + `require([...])` on the _same_ loader instance, which
   already has that module recorded as failed. Whether it retries is loader-internal. **Verify** by blocking
   `editor.main.js` of the first CDN in dev tools.
2. **No timeout.** If neither the success nor the error callback fires, `hydrateCache()` never settles and
   `whenReady()` hangs forever — no error, no fallback.
3. **Any `window.require` is assumed to be Monaco's AMD loader.** On a page with RequireJS, or in Electron with
   `nodeIntegration`, `win.require.config` is missing or means something else → a `TypeError` for each source, ending
   in the `AggregateError`. Monaco's loader also defines global `define`/`require`, which can break UMD libraries
   loaded later on the host page — a known Monaco-AMD caveat that the docs should mention.
4. **`"/monaco/vs"` is an absolute path.** It only resolves when the site is served from the domain root. On GitHub
   Pages (`/monaco-editor-webcomponent/…`) and in every npm consumer's app it 404s. As the last fallback it mostly
   adds one more failed request.
5. **`generated` argument is ignored after the first call** (`cachedMonaco` / `loadingPromise` short-circuit). A
   caller passing different sources gets the first caller's Monaco without notice.
6. **`cachedVsBase` vs pre-existing Monaco.** If the host page already loaded Monaco (`win.monaco` exists),
   `loadMonaco` resolves immediately for the first source and `cachedVsBase` is set to the first CDN URL even though
   Monaco came from somewhere else. `ensureMonacoStylesInShadowRoot` then, when it finds no `<link>` to clone, injects
   `editor.main.css` from that CDN at version 0.55.1 — possibly a different version than the Monaco actually running.
7. **A stylesheet load error rejects the whole editor.** `loadStylesheetLink` rejects on `error`, and the manager
   awaits it before creating the editor.
8. **No way for the user to configure the base URL** (self-hosting, air-gapped environments, pinning a version)
   short of editing the generated constant.

### Fix plan

1. Public configuration, applied before the first load:
   `configureMonaco({ vs: string | string[] })` (and/or an attribute `monaco-vs="..."` on the element). Throw if
   called after loading started with a different value.
2. Wrap each attempt in a timeout (e.g. 15 s) that rejects and moves on.
3. Detect the loader: only reuse `win.require` if `typeof win.require.config === "function"` **and** the loader
   script was injected by this module (keep a module-level flag); otherwise report a clear error
   ("a foreign AMD/CommonJS `require` is present").
4. On a failed attempt, remove the injected `<script>` and reset the loader state (`delete win.require; delete
win.define`) before trying the next source, so each attempt starts clean.
5. Make the local fallback relative to the module (`new URL("../monaco/vs", import.meta.url).href`) or drop it from
   the published defaults and leave it to configuration.
6. Only set `cachedVsBase` when this module actually loaded Monaco from that base.
7. Treat stylesheet failures as a warning (`console.warn`) and continue.

---

## 18. `customElements.define` is unguarded — loading two builds throws

**Severity: Medium** · `web-component/composite-monaco-diff.ts:145`, `CenterAndHeightResizer.ts:351`, `CenterResizer.ts`

### Problem

The same element is shipped in several physical files. If a page ends up loading two of them, the second
`customElements.define("composite-monaco-diff", …)` throws
`NotSupportedError: the name "composite-monaco-diff" has already been used`, which aborts that whole module.

### Logic

Copies that register the tag:

- `web-component/composite-monaco-diff.js` (per-file `tsc` output, used by the docs via GitHub Pages)
- `web-component/Module.js` (esbuild **bundle** of everything, produced by `es.ts`)
- `dist/esm/composite-monaco-diff.js` (npm entry, imported by `dist/esm/Module.js` and `dist/esm/react.js`)

ES modules are de-duplicated by URL, not by content. Examples that load two copies: a page using the CDN bundle
`Module.js` plus a widget importing `composite-monaco-diff.js`; an app importing `composite-monaco-diff` and
`composite-monaco-diff/web-component/Module.js`; two npm dependencies that each bundle the package.

A second, quieter effect: each copy has its own module state (`cachedMonaco`, `loadingPromise`) and its own
`MonacoDiffElement` class, so `el instanceof MonacoDiffElement` from the other copy is `false` — the demos throw
`"Missing <composite-monaco-diff> element"` in that situation.

### Fix plan

1. Guard all three registrations:

   ```ts
   if (!customElements.get(tagName)) customElements.define(tagName, MonacoDiffElement);
   ```

2. Publish exactly one browser-ready file per use case and say which in the README (finding 19).
3. In docs/demos prefer duck-typing or `customElements.get(tagName)` over `instanceof` against an imported class.

---

## 19. Package ships demos, test output and duplicate builds; no peer dependencies

**Severity: Medium (packaging)** · `package.json`, `.npmignore`, `tsconfig.base.json`, `build.sh`

### Problem

The tarball contains much more than the library, and misses metadata consumers need.

### Details (from `composite-monaco-diff-0.0.1.tgz`)

1. **Demo applications are compiled into `dist/`** — in all three flavours (`cjs`, `esm`, `types`):
   `manager/index`, `urlchange/index`, `urlchange/ChildSection`, `web-component/from-js/index`,
   `web-component/from-scripts/index`, `CenterAndHeightResizer`, `CenterResizer`. Cause: `tsconfig.base.json` has
   `"include": ["web-component"]`, i.e. the whole folder. Through the `"./*"` export they are importable as
   `composite-monaco-diff/manager/index` etc. Those files run top-level `await` and `document.getElementById(...)!`
   on import.
2. **`test-results/.last-run.json` is published.** `.npmignore` covers `/playwright*` but not `/test-results/`.
3. **The library is included twice**: `dist/esm/*.js` and `web-component/*.js` (`Module.js` bundle,
   `composite-monaco-diff.js`, `MonacoDiffManager.js`, `react.js`, `trimLeft.js`) — see finding 18.
4. **No `peerDependencies`.** `dist/types/MonacoDiffManager.d.ts` does `import type * as Monaco from "monaco-editor"`,
   and `react.d.ts` imports `react`. Without those packages the public types collapse to `any` (or error with
   `skipLibCheck: false`).
5. **No `files` whitelist** — the content is defined by a 100-line `.npmignore` blacklist, much of it copied from
   another project (`/select.*`, `**/*urlManager*`, `**/*list-up-down-navi*`, `morph.js`, `radio.js`, …). A blacklist
   publishes every _new_ file by default; that is how item 2 happened.
6. `vite-project/vite.config.ts` has `optimizeDeps.exclude: ["composite-select"]` and `App.tsx` has a commented
   `import "composite-select/floating-label-pattern.css"` — leftovers from the sibling project.
7. `package.json` and `package.dev.json` duplicate name/version/scripts by hand and are swapped by
   `bash/swap-files-v2.sh`; the two can drift (they already differ in formatting and in which metadata they carry).

### Fix plan

1. Switch to a whitelist and delete `.npmignore`:

   ```json
   "files": ["dist", "web-component/Module.js", "README.md", "LICENSE"],
   "sideEffects": true,
   "peerDependencies": { "monaco-editor": ">=0.50", "react": ">=18" },
   "peerDependenciesMeta": { "monaco-editor": { "optional": true }, "react": { "optional": true } }
   ```

   (`monaco-editor` is types-only at runtime, hence optional.)

2. Build only library files: add a `tsconfig.build.json` with
   `"include": ["web-component/Module.ts", "web-component/react.ts"]` (TypeScript follows the imports) and use it in
   `build_esm`. Keep the demos compiled in place by the existing watch config only.
3. Move demos out of the library folder (e.g. `demo/manager`, `demo/urlchange`, `demo/web-component`) so "what is
   the library" is visible from the directory layout. `web-component/web-component/` as a path is a hint that the
   structure grew by accident.
4. Explicit `exports` (finding 7).
5. Add `npm pack --dry-run` output to CI logs and fail if it lists anything outside the whitelist.
6. Remove the `composite-select` leftovers.
7. Generate `package.json` from `package.dev.json` (or the reverse) with a small script instead of maintaining both
   by hand; at minimum add a CI check that `name`, `version`, `scripts` are equal.

---

## 20. `echo '${{ toJson(github.event) }}'` is injectable; `NPM_TOKEN` exposed to every step

**Severity: Medium (security)** · `.github/workflows/tests.yml:16-18, 37-41`

### Problem

Two debug steps paste attacker-influenced text directly into a shell script, in a workflow that has
`contents: write` and holds the npm publish token in its environment.

### Details / Logic

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  NPM_TOKEN: ${{ secrets.NPM_TOKEN }} # workflow level: visible to every step of every job
...
- name: Debug github.event
  run: echo '${{ toJson(github.event) }}'
- name: Debug github
  run: echo '${{ toJson(github) }}'
```

1. `${{ … }}` is substituted **before** the shell runs. The event JSON contains free text: commit messages, branch
   names, PR titles and bodies, author names.
2. Any of those containing a single quote ends the `'…'` string; what follows is executed as shell. A commit message
   like `fix: it's broken` already breaks the step by accident; a crafted one runs arbitrary commands.
3. The workflow triggers on `push` to every branch and on `pull_request`. For pushes (anyone with write access, or a
   merged PR whose title/commit message was written by an outsider) the injected command runs with a write-scoped
   `GITHUB_TOKEN` and with `NPM_TOKEN` in the environment → repository write and npm publish under the maintainer's
   name. (Fork PRs do not receive secrets, which limits but does not remove the problem.)
4. `toJson(github)` additionally prints the whole `github` context to the log (GitHub masks the token, but dumping
   contexts is discouraged for that reason).

Smaller points in the same file: the "Clean before artifact" step (which `rm -rf`s `.git`, `.github`, …) runs on
every branch although Pages are only built on `main`; `timeout-minutes: 4` is tight for `npm ci` ×2 + build + docker
pull + Playwright.

### Fix plan

1. Remove both debug steps, or pass the data through the environment (never interpolate into `run:`):

   ```yaml
   - name: Debug github.event
     env:
       EVENT_JSON: ${{ toJson(github.event) }}
     run: printf '%s\n' "$EVENT_JSON"
   ```

2. Move `NPM_TOKEN` from workflow-level `env` to the single `Release` step; set `permissions` per job
   (`test`: `contents: read`; `npm`: `contents: write`; `github-pages`: `pages: write`, `id-token: write`).
3. Add `if: github.ref == 'refs/heads/main'` to "Clean before artifact".
4. Consider npm provenance / trusted publishing (OIDC) so no long-lived token is needed at all.

---

## 21. Unit tests are not run in CI; e2e only checks a background colour

**Severity: Medium** · `.github/workflows/tests.yml`, `*.e2e.ts`, `*.test.ts`

### Problem

The checks that exist would not have caught most findings in this document.

### Details

1. The workflow runs `pw.sh -t docker` (Playwright) only. I found no step that runs the `node --test` suites
   (`web-component/trimLeft.parallel.test.ts`, `web-component/urlchange/toolsURLSearchParams.test.ts`,
   `vite-project/src/pages/params/toolsURLSearchParams.test.ts`, `lib/cacheTemplate.parallel.test.ts`). They pass
   locally (40/40 for the two I ran) but nothing protects them. **Verify** whether `pw.sh`/`xx` runs them indirectly.
2. All e2e tests (`manager/index.e2e.ts`, `from-js/index.e2e.ts`, `from-scripts/index.e2e.ts`, `App.e2e.ts`) do the
   same thing: wait for `.original-in-monaco-diff-editor` and compare `backgroundColor` for light/dark. None asserts
   editor **content**, language, the URL ↔ form round trip, resizing, instance add/remove, or any docs page.
3. The polling loop is copy-pasted eight times; each e2e file imports four helpers from `test/lib.ts` and uses none.
4. No type-check step for the library in CI other than what `build.sh` does implicitly; `tsconfig.json` sets
   `useUnknownInCatchVariables: false` and several files use `as any`.

### Fix plan

1. Add a CI step: `node --test "**/*.test.ts"` (Node 24 from `.tool-versions` runs TypeScript directly).
2. Add e2e coverage, one test per high-severity finding:
   - `docs/example1.html` renders text in both panes (findings 1, 8);
   - content survives `appendChild` move (2);
   - `urlchange/index.html`: deselect all → reload → dump shows `[]` (4); `?r-1=bogus` → default radio checked (5);
   - React demo: add instance, toggle language, destroy (6);
   - `manager/index.html` container height on clean URL (15).
3. Extract the polling loop into `test/lib.ts` (`getEditorBackground(page, selector)`), or better use
   `expect.poll` / `locator.toHaveCSS`.
4. Add `tsc --noEmit -p tsconfig.json` as an explicit CI step.

---

## 22. `whenReady()` throws synchronously; unhandled rejections; `setLanguage` before ready is dropped

**Severity: Low** · `composite-monaco-diff.ts:97-142`, `MonacoDiffManager.ts:394-401`

### Details / Logic

1. `whenReady(): Promise<void>` **throws** when the element is not connected instead of returning a rejected promise.
   `el.whenReady().catch(handler)` therefore never reaches `handler`. An element created with
   `document.createElement` and not yet appended hits this.
2. `attributeChangedCallback` does `void this._applyTheme(...)` / `void this._applyLanguage(...)`. Both `await
this.whenReady()`. If Monaco failed to load, each attribute change produces an additional _unhandled promise
   rejection_ with the same `AggregateError`.
3. `MonacoDiffManager.setLanguage()` returns silently when the editor is not ready yet (`if (!model) return`). Called
   directly on a manager right after construction (the documented `manager` usage), the call is lost. The element
   path avoids it by awaiting `whenReady()`, the class itself does not.
4. `getEditor()` / `getMonaco()` return `null` before ready; every caller in the demos needs
   `if (!editor) throw …; if (!model) throw …` boilerplate.

### Fix plan

1. Create the ready promise in the element's constructor (resolve/reject it from the manager), so `whenReady()` is
   always a promise — pending until first connect.
2. `.catch(() => {})` in `_applyTheme` / `_applyLanguage` (the load error is already reported through `whenReady()`).
3. Make `setLanguage` queue: store the requested language (see finding 10) and apply it at the end of initialisation.
4. Add a convenience `whenReady()` resolution value: resolve with `{ editor, monaco, models }` so callers do not need
   null checks.

---

## 23. `trimLeft` keeps the leading/trailing blank line and pads empty lines

**Severity: Low** · `web-component/trimLeft.ts`

### Details / Logic

1. Declarative content always starts with a newline (after `<script …>`) and ends with a newline + the indentation
   before `</script>`. `trimLeft` de-indents but keeps both, so the editor shows an empty line 1 and an extra empty
   last line on both sides. The current unit tests assert this behaviour, so it is intentional for the function —
   but for the component it is almost certainly unwanted.
2. With `offset > 0`, `` `${spaces}${line}` `` is applied to **every** line, including empty ones → whitespace-only
   lines (visible with "render whitespace", and they count as content).
3. Indentation is measured in characters. A file mixing tabs and spaces is de-indented by the smallest _character_
   count, which can cut into a tab-indented line incorrectly. Edge case; worth a doc note.
4. Inherent limit of the declarative form: the content cannot contain `</script>`. Should be documented with the
   JS-API alternative.

### Fix plan

1. In `readDeclarativeDiffScripts` (not in `trimLeft`, to keep its contract): strip one leading newline and the
   trailing whitespace-only line before/after `trimLeft`:
   `text.replace(/^[ \t]*\r?\n/, "").replace(/\r?\n[ \t]*$/, "")`.
2. In `trimLeft`: `result.map((line) => (line === "" ? line : spaces + line))`.
3. Add tests for both; document the tab/space and `</script>` limits.

---

## 24. Resizer elements re-bind listeners on every reconnect, mouse only

**Severity: Low** · `web-component/CenterAndHeightResizer.ts:184-215, 260-275, 292-348`, `CenterResizer.ts`

### Details / Logic

1. `connectedCallback()` calls `setupResizer` ×2, `setupHeightResizer` and `_initForwarding()` every time. There is
   no `disconnectedCallback()`. After a move/re-attach each handle has two `mousedown` listeners (events fire twice,
   URL written twice) and a second `MutationObserver` is running. The first observer is never disconnected.
2. Only mouse events are handled — no touch/pointer support, so the handles do not work on tablets/phones. Pointer
   events with `setPointerCapture` would also remove the need for `document`-level listeners.
3. If the mouse is released outside the window, `mouseup` on `document` can be missed and the drag "sticks" until the
   next click.
4. `attributeChangedCallback(name, oldValue: string, newValue: string)` — both can be `null`; assigning `null` to
   `style.width` happens to clear it, but the types hide that.
5. `SKIP_ATTRIBUTES`-based attribute forwarding copies attributes to the inner div but never removes them when they
   are removed from the host.
6. The handles have no keyboard access or ARIA role (`role="separator"`, `aria-orientation`, arrow keys).

### Fix plan

1. Guard the setup with a `_initialised` flag (or move it to the constructor, since the shadow DOM is created there),
   and disconnect the `MutationObserver` in `disconnectedCallback()`.
2. Switch to `pointerdown` / `pointermove` / `pointerup` + `setPointerCapture`.
3. Emit a final `onResizeEnd` event (needed by finding 16).
4. Type the callback parameters as `string | null`; mirror attribute removal.
5. If the resizers are demo helpers only, move them to the demo folder and keep them out of the npm package
   (finding 19); if they are part of the product, document them in `api.html`.

---

## 25. Duplicated files and committed compiled `.js` next to `.ts`

**Severity: Low (consistency / drift risk)**

### Details

1. **Compiled JavaScript is committed beside its TypeScript source**:
   `vite-project/src/pages/params/toolsURLSearchParams.js`, `modURLSearchParams.js`,
   `vite-project/src/pages/useUrlGet.js`, `vite-project/vite.config.js`, `lib/cacheTemplate.js`, `lib/template.js`,
   `lib/utils.js`, `test/lib.js`, `produceRender.js`.
   The important consequence: `modURLSearchParams.ts` imports `"./toolsURLSearchParams.js"`. Because that `.js` file
   really exists, Vite loads **it**, not the `.ts`. Editing the `.ts` has no effect on the running app until someone
   recompiles by hand, and `vite-project` is excluded from `tsconfig.watch.json`.
   I compared them (types stripped with esbuild): today they differ only in formatting, so nothing is broken yet.
2. **`toolsURLSearchParams.ts` exists twice** — `web-component/urlchange/` and `vite-project/src/pages/params/` —
   and they have already diverged: the vite copy lacks `buildUrlWithSearchParams`. Each has its own test file.
3. **`floating-label-pattern.css` exists twice** (repo root and `web-component/`), currently identical.
4. **Three demo scripts are near copies**: `manager/index.ts`, `from-js/index.ts`, `from-scripts/index.ts`
   (finding 15 is a direct result). `MonacoDiffDemo.tsx` / `MonacoDiffDemoAttr.tsx` likewise (finding 6).
5. **Unreferenced code in `vite-project/src/pages/`**: `UrlSerialiser.tsx`, `createUrlObject.tsx`,
   `createUseQueryParams.tsx`, `useUrlGet.ts/.js`, `params/ModURLSearchParamsComponent.tsx` are not routed from
   `App.tsx`. `createUseQueryParams.tsx` contains a hard-coded `0.0.0.0`/`localhost` URL. `composition/` and
   `learning/` are empty/experimental folders.
6. `.env` is tracked in git (it only holds `HOST`/`PORT`, so no leak today) while `.env*` is in `.npmignore` — if a
   secret is ever added it will be committed by default. Prefer a tracked `.env.example` + ignored `.env`.
7. Naming: the npm package is `composite-monaco-diff`, the repository `monaco-editor-webcomponent`, the element class
   `MonacoDiffElement`, the entry file `Module.ts`, description "Web component wrapper on top of monaco editor"
   (it is specifically the _diff_ editor).

### Fix plan

1. Delete the committed `.js` twins and add them to `.gitignore` (as is already done for `web-component/*.js`); for
   `vite-project` import without extension or with `.ts` so the source is used directly.
2. Keep one `toolsURLSearchParams.ts` (in `web-component/urlchange/`) and import it from `vite-project` via a
   relative path or a Vite alias; merge the two test files.
3. Keep one `floating-label-pattern.css`.
4. Shared demo wiring module (findings 6, 15).
5. Delete or route the unreferenced pages; remove empty folders.
6. `.env` → `.env.example`.

---

## 26. Monaco web workers when loaded cross-origin from a CDN (**verify**)

**Severity: Low** · `web-component/MonacoDiffManager.ts:107-145`

### Problem

Monaco computes diffs (and runs the TS/JSON/CSS language services) in web workers. Browsers refuse to construct a
`Worker` from a script on another origin. With Monaco loaded from `cdn.jsdelivr.net` and no
`window.MonacoEnvironment`, Monaco typically logs
_"Could not create web worker(s). Falling back to loading web worker code in main thread, which might cause UI
freezes"_ and runs the diff on the main thread.

### Logic

`loadMonaco` only configures `require.config({ paths: { vs } })`. Nothing defines
`MonacoEnvironment.getWorkerUrl` / `getWorker`. For small snippets the fallback is invisible; for large files the
diff computation blocks the UI. I could not run a browser here — **check the console of any demo page** to confirm
for 0.55.1.

### Fix plan

If the warning is present, define the standard same-origin proxy before the first `require`:

```ts
const w = window as any;
if (!w.MonacoEnvironment) {
  w.MonacoEnvironment = {
    getWorkerUrl: () =>
      `data:text/javascript;charset=utf-8,${encodeURIComponent(
        `self.MonacoEnvironment={baseUrl:'${vsBase}/../'};importScripts('${vsBase}/base/worker/workerMain.js');`,
      )}`,
  };
}
```

Do not overwrite an existing `MonacoEnvironment` (the host app may have configured its own). Confirm the worker entry
path against the `min/vs` layout of the pinned version in `scripts/sync-monaco-version.ts`, since it changed between
Monaco releases.

---

## Suggested order of work

1. **Stop the bleeding in what is published** — findings 1, 8 (docs examples work again), 7 (remove or fix CJS),
   20 (CI injection). Small, independent changes.
2. **Component lifecycle** — 2, 3, 9, 22 together (they touch the same ~60 lines: connect/disconnect, the async
   constructor, the ready promise), then 18.
3. **Form/URL data correctness** — 4, 5, 6, 15 (pure data fixes), then 14 and 16 (tracker owns the write, debounce),
   deleting the duplicated write-back blocks on the way.
4. **API consistency** — 10, 11, 12, 13 (language/theme precedence, change events, React wrapper).
5. **Packaging and hygiene** — 19, 25, 21 (tests that lock in everything above), 17, 23, 24, 26.
