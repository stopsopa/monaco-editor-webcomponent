import { CenterAndHeightResizer } from "../CenterAndHeightResizer.js";

import modURLSearchParams from "../urlchange/urlchange.js";
import { syncURLSearchParams, buildUrlWithSearchParams } from "../urlchange/toolsURLSearchParams.js";

import { MonacoDiffManager } from "../MonacoDiffManager.js";

import { isMonacoTheme } from "../composite-monaco-diff.js";

await customElements.whenDefined(CenterAndHeightResizer.tagName);

const container = document.getElementById("container");
if (!container) {
  throw new Error("Missing #container element");
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
 * This is actually important for mgr to
 * be ready before continuing with trackUrl()
 */
await mgr.whenReady();

const themeSelect = document.getElementById("theme-select");
if (!(themeSelect instanceof HTMLSelectElement)) {
  throw new Error("Missing #theme-select element");
}

const languageSelect = document.getElementById("language-select");
if (!(languageSelect instanceof HTMLSelectElement)) {
  throw new Error("Missing #language-select element");
}

const config = {
  left: {
    default: "100px",
    getParam: "l",
    encode: (value: string) => value,
    decode: (value: string) => value,
  },
  center: {
    default: "1200px",
    getParam: "c",
    encode: (value: string) => value,
    decode: (value: string) => value,
  },
  height: {
    default: "100px",
    getParam: "h",
    encode: (value: string) => value,
    decode: (value: string) => value,
  },
  theme: {
    default: "",
    getParam: "theme",
    encode: (value: string) => value,
    decode: (value: string) => value,
  },
};

document.querySelectorAll(CenterAndHeightResizer.tagName).forEach((el, index) => {
  const resizer = el as HTMLElement;

  const { trackUrl } = modURLSearchParams(config, (key, i) => {
    let t;
    const cond = /^\d+$/.test(String(i));
    if (cond) {
      t = `${key}-${i}`;
    } else {
      t = key;
    }
    // console.log("instanceKeyFn", { cond, key, i }, "t: ", t);
    return t;
  });

  const { setParams } = trackUrl(
    (params, updatedURLSearchParams, governedKeys): void => {
      // console.log("trackUrl", index, JSON.stringify(params));

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
    // console.log("syncToUrl: ", index);
    setParams({
      left: resizer.getAttribute("left") ?? config.left.default,
      center: resizer.getAttribute("center") ?? config.center.default,
      height: resizer.getAttribute("height") ?? config.height.default,
    });
  };

  resizer.addEventListener("onLeft", syncToUrl);
  resizer.addEventListener("onCenter", syncToUrl);
  resizer.addEventListener("onHeight", syncToUrl);
});

function applyThemeAttribute(theme: string): void {
  console.log("applyThemeAttribute", theme);
  mgr.getMonaco()?.editor.setTheme(theme || "vs");
}

function applyLanguageAttribute(language: string): void {
  console.log("applyLanguageAttribute", language);
  mgr.setLanguage(language || undefined);
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
    console.log("trackUrlNoIndex", params);
    themeSelect.value = params.theme;
    applyThemeAttribute(params.theme);
    languageSelect.value = params.language;
    applyLanguageAttribute(params.language);

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
  console.log("themeSelect.value", themeSelect.value);
  setParam("theme", themeSelect.value);
});

languageSelect.addEventListener("change", () => {
  console.log("languageSelect.value", languageSelect.value);
  setParam("language", languageSelect.value);
});
