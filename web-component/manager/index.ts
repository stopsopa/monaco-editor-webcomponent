/**
 * Demo: MonacoDiffManager used directly (no custom element) inside a plain <div>.
 * Open web-component/manager/index.html through the dev server (`npm start`).
 *
 * Resizer sizes, theme and language are kept in the URL - see ../urlchange/demoWiring.ts.
 */
import { CenterAndHeightResizer } from "../CenterAndHeightResizer.js";

import { getSelect, wireResizerUrlSync, wireThemeLanguageUrlSync } from "../urlchange/demoWiring.js";

import { MonacoDiffManager } from "../MonacoDiffManager.js";

const th = (msg: string) => new Error(`web-component/manager/index.ts error: ${msg}`);

await customElements.whenDefined(CenterAndHeightResizer.tagName);

const container = document.getElementById("container");
if (!container) {
  throw th("Missing #container element");
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

const mgr = new MonacoDiffManager(container, {
  original,
  modified,
  language: "javascript",
});

/**
 * Wait for the editor before wiring the URL: applying the theme needs Monaco.
 */
await mgr.whenReady();

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
