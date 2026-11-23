/**
 * Demo: <composite-monaco-diff> with content in <script type="text/original|text/modified"> children,
 * driven only through attributes.
 * Open web-component/web-component/from-scripts/index.html through the dev server (`npm start`).
 *
 * Resizer sizes, theme and language are kept in the URL - see ../../urlchange/demoWiring.ts.
 *
 * The scripts in index.html deliberately have no `lang` attribute: a per-script language always wins
 * over the element's `language` attribute, and here the language <select> has to control both sides.
 */
import { getSelect, wireResizerUrlSync, wireThemeLanguageUrlSync } from "../../urlchange/demoWiring.js";

import { MonacoDiffElement } from "../../composite-monaco-diff.js";

import { CenterAndHeightResizer } from "../../CenterAndHeightResizer.js";

const th = (msg: string) => new Error(`web-component/web-component/from-scripts/index.ts error: ${msg}`);

await customElements.whenDefined(MonacoDiffElement.tagName);

await customElements.whenDefined(CenterAndHeightResizer.tagName);

const diffEl = document.querySelector<MonacoDiffElement>(MonacoDiffElement.tagName);
if (!diffEl) {
  throw th("Missing <composite-monaco-diff> element");
}

await diffEl.whenReady();

document.querySelectorAll<HTMLElement>(CenterAndHeightResizer.tagName).forEach((resizer, index) => {
  wireResizerUrlSync(resizer, index);
});

wireThemeLanguageUrlSync({
  themeSelect: getSelect("theme-select"),
  languageSelect: getSelect("language-select"),
  // "" = "(Monaco default)": show Monaco's default light theme. The theme attribute is only a way to
  // call Monaco's global setTheme, so removing it would not switch back to light.
  applyTheme: (theme) => diffEl.setAttribute("theme", theme || "vs"),
  applyLanguage: (language) => diffEl.setAttribute("language", language),
});
