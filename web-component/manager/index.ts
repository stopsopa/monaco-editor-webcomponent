import { CenterAndHeightResizer } from "../CenterAndHeightResizer.js";

import modURLSearchParams, { type ParamDef } from "../urlchange/urlchange.js";

import { MonacoDiffManager } from "../MonacoDiffManager.js";

type ResizerParams = {
  left: string;
  center: string;
  height: string;
  theme: string;
};

const instanceKeyFn = (key: string, i?: number): string => `${key}-${i}`;

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

const container = document.getElementById("container");
if (!container) {
  throw new Error("Missing #container element");
}

await customElements.whenDefined(CenterAndHeightResizer.tagName);

document.querySelectorAll(CenterAndHeightResizer.tagName).forEach((el, index) => {
  const resizer = el as HTMLElement;

  const { trackUrl } = modURLSearchParams(config, instanceKeyFn);

  const { setParams } = trackUrl(
    (params): void => {
      resizer.setAttribute("left", params.left);
      resizer.setAttribute("center", params.center);
      resizer.setAttribute("height", params.height);
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
});

const mgr = new MonacoDiffManager(container, {
  original,
  modified,
  language: "javascript",
});

await mgr.whenReady();
