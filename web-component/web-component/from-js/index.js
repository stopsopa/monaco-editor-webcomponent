import { CenterAndHeightResizer } from "../../CenterAndHeightResizer.js";
import modURLSearchParams from "../../urlchange/urlchange.js";
import { isMonacoTheme, MonacoDiffElement, tagName } from "../../monaco-diff.js";
await customElements.whenDefined(tagName);
const instanceKeyFn = (key, i) => `${key}-${i}`;
const diffDemoParamConfig = {
  theme: {
    default: "",
    getParam: "theme",
    encode: (value) => value,
    decode: (value) => (isMonacoTheme(value) ? value : ""),
  },
  language: {
    default: "javascript",
    getParam: "lang",
    encode: (value) => value,
    decode: (value) => value,
  },
};
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
`.trim();
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
`.trim();
function createResizerParamConfig(resizer) {
  return {
    left: {
      default: resizer.getAttribute("left") ?? "100px",
      getParam: "l",
      encode: (value) => value,
      decode: (value) => value,
    },
    center: {
      default: resizer.getAttribute("center") ?? "1200px",
      getParam: "c",
      encode: (value) => value,
      decode: (value) => value,
    },
    height: {
      default: resizer.getAttribute("height") ?? "100px",
      getParam: "h",
      encode: (value) => value,
      decode: (value) => value,
    },
  };
}
function wireResizerUrlSync(resizer, index) {
  const config = createResizerParamConfig(resizer);
  const { trackUrl } = modURLSearchParams(config, instanceKeyFn);
  const applyParams = (params) => {
    resizer.setAttribute("left", params.left);
    resizer.setAttribute("center", params.center);
    resizer.setAttribute("height", params.height);
  };
  const { setParams } = trackUrl((params) => applyParams(params), { ctx: index, fireOnMount: true });
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
function applyThemeAttribute(diffEl, theme) {
  if (theme) {
    diffEl.setAttribute("theme", theme);
  } else {
    diffEl.removeAttribute("theme");
  }
}
function applyLanguageAttribute(diffEl, language) {
  if (language) {
    diffEl.setAttribute("language", language);
  } else {
    diffEl.removeAttribute("language");
  }
}
await customElements.whenDefined(CenterAndHeightResizer.tagName);
document.querySelectorAll(CenterAndHeightResizer.tagName).forEach((el, index) => {
  wireResizerUrlSync(el, index);
});
await customElements.whenDefined(tagName);
const diffEl = document.querySelector(tagName);
if (!(diffEl instanceof MonacoDiffElement)) {
  throw new Error("Missing <monaco-diff> element");
}
const themeSelect = document.getElementById("theme-select");
if (!(themeSelect instanceof HTMLSelectElement)) {
  throw new Error("Missing #theme-select element");
}
const languageSelect = document.getElementById("language-select");
if (!(languageSelect instanceof HTMLSelectElement)) {
  throw new Error("Missing #language-select element");
}
const { trackUrl: trackDiffUrl } = modURLSearchParams(diffDemoParamConfig);
const { setParam } = trackDiffUrl(
  (params) => {
    themeSelect.value = params.theme;
    applyThemeAttribute(diffEl, params.theme);
    languageSelect.value = params.language;
    applyLanguageAttribute(diffEl, params.language);
  },
  { fireOnMount: true },
);
themeSelect.addEventListener("change", () => {
  const theme = themeSelect.value;
  applyThemeAttribute(diffEl, theme);
  setParam("theme", theme);
});
languageSelect.addEventListener("change", () => {
  const language = languageSelect.value;
  applyLanguageAttribute(diffEl, language);
  setParam("language", language);
});
await diffEl.whenReady();
const editor = diffEl.getManager().getEditor();
if (!editor) {
  throw new Error("Diff editor not available");
}
const model = editor.getModel();
if (!model) {
  throw new Error("Diff editor has no model");
}
model.original.setValue(original);
model.modified.setValue(modified);
