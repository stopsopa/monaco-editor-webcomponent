import { CenterAndHeightResizer } from "../CenterAndHeightResizer.js";

import modURLSearchParams from "../urlchange/urlchange.js";

import { MonacoDiffManager } from "../MonacoDiffManager.js";

await customElements.whenDefined(CenterAndHeightResizer.tagName);

const instanceKeyFn = (key: string, i?: number): string => {
  let t;
  const cond = /^\d+$/.test(String(i));
  if (cond) {
    t = `${key}-${i}`;
  } else {
    t = key;
  }
  // console.log("instanceKeyFn", { cond, key, i }, "t: ", t);
  return t;
};

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

const container = document.getElementById("container");
if (!container) {
  throw new Error("Missing #container element");
}

document.querySelectorAll(CenterAndHeightResizer.tagName).forEach((el, index) => {
  const resizer = el as HTMLElement;

  const { trackUrl } = modURLSearchParams(config, (key, ctx) => instanceKeyFn(key, index));

  const { setParams } = trackUrl(
    (params): void => {
      console.log("trackUrl", index, JSON.stringify(params));

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
