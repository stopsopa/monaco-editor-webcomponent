import modURLSearchParams from "../../urlchange/urlchange.js";

import { syncURLSearchParams, buildUrlWithSearchParams } from "../../urlchange/toolsURLSearchParams.js";

import { MonacoDiffManager } from "../../MonacoDiffManager.js";

import { isMonacoTheme, MonacoDiffElement } from "../../monaco-diff.js";

import { CenterAndHeightResizer } from "../../CenterAndHeightResizer.js";

await customElements.whenDefined(MonacoDiffElement.tagName);

await customElements.whenDefined(CenterAndHeightResizer.tagName);

const diffEl = document.querySelector(MonacoDiffElement.tagName);
if (!(diffEl instanceof MonacoDiffElement)) {
  throw new Error("Missing <monaco-diff> element");
}

await diffEl.whenReady();

let model;
let mgr: MonacoDiffManager;

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
`

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
`

function wireResizerUrlSync(resizer: HTMLElement, index: number) {
  const config = {
    left: {
      default: resizer.getAttribute("left") ?? "100px",
      getParam: "l",
      encode: (value: string) => value,
      decode: (value: string) => value,
    },
    center: {
      default: resizer.getAttribute("center") ?? "1200px",
      getParam: "c",
      encode: (value: string) => value,
      decode: (value: string) => value,
    },
    height: {
      default: resizer.getAttribute("height") ?? "100px",
      getParam: "h",
      encode: (value: string) => value,
      decode: (value: string) => value,
    },
  };

  const { trackUrl } = modURLSearchParams(config, (key: string, i?: number): string => `${key}-${i}`);

  const { setParams } = trackUrl(
    (params, updatedURLSearchParams, governedKeys) => {
      resizer.setAttribute("left", params.left);
      resizer.setAttribute("center", params.center);
      resizer.setAttribute("height", params.height);

      const current = new URLSearchParams(window.location.search);
      const next = syncURLSearchParams(current, governedKeys, updatedURLSearchParams);

      if (next.toString() !== current.toString()) {
        const url = buildUrlWithSearchParams(window.location.href, next);
        history.replaceState(history.state, "", url);
      }
    },
    { ctx: index, fireOnMount: true },
  );

  const syncToUrl = () => {
    setParams({
      left: resizer.getAttribute("left") ?? config.left.default,
      center: resizer.getAttribute("center") ?? config.center.default,
      height: resizer.getAttribute("height") ?? config.height.default,
    });
  };

  resizer.addEventListener("onLeft", syncToUrl);
  resizer.addEventListener("onCenter", syncToUrl);
  resizer.addEventListener("onHeight", syncToUrl);
}

function applyThemeAttribute(mgr: MonacoDiffManager, theme: string) {
  mgr.getMonaco()?.editor.setTheme(theme || "vs");
}

function applyLanguageAttribute(mgr: MonacoDiffManager, language: string) {
  mgr.setLanguage(language || undefined);
}

document.querySelectorAll(CenterAndHeightResizer.tagName).forEach((el, index) => {
  wireResizerUrlSync(el as HTMLElement, index);
});

const themeSelect = document.getElementById("theme-select");
if (!(themeSelect instanceof HTMLSelectElement)) {
  throw new Error("Missing #theme-select element");
}

const languageSelect = document.getElementById("language-select");
if (!(languageSelect instanceof HTMLSelectElement)) {
  throw new Error("Missing #language-select element");
}

const { trackUrl: trackUrlNoIndex } = modURLSearchParams({
  theme: {
    default: "",
    getParam: "theme",
    encode: (value: string) => value,
    decode: (value: string) => (isMonacoTheme(value) ? value : ""),
  },
  language: {
    default: "javascript",
    getParam: "lang",
    encode: (value: string) => value,
    decode: (value: string) => value,
  },
});

const { setParam } = trackUrlNoIndex(
  (params, updatedURLSearchParams, governedKeys) => {
    themeSelect.value = params.theme;
    applyThemeAttribute(mgr, params.theme);
    languageSelect.value = params.language;
    applyLanguageAttribute(mgr, params.language);

    const current = new URLSearchParams(window.location.search);
    const next = syncURLSearchParams(current, governedKeys, updatedURLSearchParams);

    if (next.toString() !== current.toString()) {
      const url = buildUrlWithSearchParams(window.location.href, next);
      history.replaceState(history.state, "", url);
    }
  },
  { fireOnMount: true },
);

themeSelect.addEventListener("change", () => {
  setParam("theme", themeSelect.value);
});

languageSelect.addEventListener("change", () => {
  setParam("language", languageSelect.value);
});

mgr = diffEl.getManager();

const editor = mgr.getEditor();
if (!editor) {
  throw new Error("Diff editor not available");
}

model = editor.getModel();
if (!model) {
  throw new Error("Diff editor has no model");
}

model.original.setValue(original);
model.modified.setValue(modified);
