/**
 * Demo: <composite-monaco-diff> without <script> children, content set from JavaScript.
 * Open web-component/web-component/from-js/index.html through the dev server (`npm start`).
 *
 * Resizer sizes, theme and language are kept in the URL - see ../../urlchange/demoWiring.ts.
 */
import { getSelect, wireResizerUrlSync, wireThemeLanguageUrlSync } from "../../urlchange/demoWiring.js";

import { MonacoDiffElement } from "../../composite-monaco-diff.js";

import { CenterAndHeightResizer } from "../../CenterAndHeightResizer.js";

const th = (msg: string) => new Error(`web-component/web-component/from-js/index.ts error: ${msg}`);

await customElements.whenDefined(MonacoDiffElement.tagName);

await customElements.whenDefined(CenterAndHeightResizer.tagName);

const diffEl = document.querySelector<MonacoDiffElement>(MonacoDiffElement.tagName);
if (!diffEl) {
  throw th("Missing <composite-monaco-diff> element");
}

const original = `
    const loadMonaco = (vsPath = VS_PATH) =>
      new Promise((resolve, reject) => {
        const win = window;

        const finish = () => {
          win.require.config({ paths: { vs: vsPath } });
          win.require(["vs/editor/editor.main"], () => resolve(win.monaco));
        };

        if (win.require && win.monaco) return resolve(win.monaco);
        if (win.require) return finish();

        const script = document.createElement("script");
        script.src = \`\${vsPath}/loader.js\`;
        script.async = true;
        script.onload = () => finish();
        script.onerror = () => reject(new Error(\`Failed to load Monaco loader from \${vsPath}\`));
        document.head.appendChild(script);
      });
`;

const modified = `
const loadMonaco = (vsPath = VS_PATH) =>
  new Promise((resolve, reject) => {
    const win = window;

    const finish = () => {
      win.require.config({ paths: { vs: vsPath } });
      win.require(["vs/editor/editor.main"], () => resolve(win.monaco));
    };

    if (win.require && win.moneco) return resolve(win.monaco);

    const script = document.createElement("script");
    script.src = \`\${vsPath}/loader.js\`;
    script.async = true;
    script.onload = () => finish();
    script.added = 'stuff'
    script.onerror = () => reject(new Error(\`Failed to load Monaco loader from \${vsPath}\`));
    document.head.appendChild(script);
  });
`;

// The properties can be set at any time - before the editor is ready the values are simply kept.
diffEl.original = original;
diffEl.modified = modified;

await diffEl.whenReady();

const mgr = diffEl.getManager();

document.querySelectorAll<HTMLElement>(CenterAndHeightResizer.tagName).forEach((resizer, index) => {
  wireResizerUrlSync(resizer, index);
});

wireThemeLanguageUrlSync({
  themeSelect: getSelect("theme-select"),
  languageSelect: getSelect("language-select"),
  // "" = "(Monaco default)": show Monaco's default light theme
  applyTheme: (theme) => mgr.setTheme(theme || "vs"),
  applyLanguage: (language) => mgr.setLanguage(language),
});
