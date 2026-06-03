import { CenterAndHeightResizer } from "../../CenterAndHeightResizer.js";

import modURLSearchParams from "../../urlchange/urlchange.js";
import { syncURLSearchParams, buildUrlWithSearchParams } from "../../urlchange/toolsURLSearchParams.js";

import { isMonacoTheme, MonacoDiffElement, tagName } from "../../monaco-diff.js";

await customElements.whenDefined(tagName);

const instanceKeyFn = (key: string, i?: number): string => `${key}-${i}`;

// const diffDemoParamConfig: { theme: ParamDef<string>; language: ParamDef<string> } = {
//   theme: {
//     default: "",
//     getParam: "theme",
//     encode: (value: string) => value,
//     decode: (value: string) => (isMonacoTheme(value) ? value : ""),
//   },
//   language: {
//     default: "javascript",
//     getParam: "lang",
//     encode: (value: string) => value,
//     decode: (value: string) => value,
//   },
// };

function wireResizerUrlSync(resizer: HTMLElement, index: number): void {
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

  const { trackUrl } = modURLSearchParams(config, instanceKeyFn);

  const { setParams } = trackUrl(
    (params, updatedURLSearchParams, governedKeys): void => {
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

  const syncToUrl = (): void => {
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

function applyThemeAttribute(diffEl: MonacoDiffElement, theme: string): void {
  if (theme) {
    diffEl.setAttribute("theme", theme);
  } else {
    diffEl.removeAttribute("theme");
  }
}

function applyLanguageAttribute(diffEl: MonacoDiffElement, language: string): void {
  if (language) {
    diffEl.setAttribute("language", language);
  } else {
    diffEl.removeAttribute("language");
  }
}

await customElements.whenDefined(CenterAndHeightResizer.tagName);

document.querySelectorAll(CenterAndHeightResizer.tagName).forEach((el, index) => {
  wireResizerUrlSync(el as HTMLElement, index);
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
    applyThemeAttribute(diffEl, params.theme);
    languageSelect.value = params.language;
    applyLanguageAttribute(diffEl, params.language);

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
