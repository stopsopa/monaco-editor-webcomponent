import "../CenterAndHeightResizer.js";
import modURLSearchParams from "../urlchange/urlchange.js";
// const VS_PATH = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.10.1/min/vs";
const VS_PATH = "https://cdn.jsdelivr.net/npm/monaco-editor@0.53.0/min/vs";
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
function loadMonaco(vsPath = VS_PATH) {
  return new Promise((resolve, reject) => {
    const win = window;
    const finish = () => {
      win.require?.config({ paths: { vs: vsPath } });
      win.require?.(["vs/editor/editor.main"], () => {
        if (win.monaco) resolve(win.monaco);
        else reject(new Error(`Monaco did not initialize from ${vsPath}`));
      });
    };
    if (win.require && win.monaco) {
      resolve(win.monaco);
      return;
    }
    if (win.require) {
      finish();
      return;
    }
    const script = document.createElement("script");
    script.src = `${vsPath}/loader.js`;
    script.async = true;
    script.onload = () => finish();
    script.onerror = () => reject(new Error(`Failed to load Monaco loader from ${vsPath}`));
    document.head.appendChild(script);
  });
}
const instanceKeyFn = (key, i) => `${key}-${i}`;
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
/** Indexed URL params (`l-0`, `c-0`, `h-0`, …) ↔ resizer attributes; drag events write back to the URL. */
function wireResizerUrlSync(resizer, index) {
  const config = createResizerParamConfig(resizer);
  const { trackUrl } = modURLSearchParams(config, instanceKeyFn);
  const applyParams = (params) => {
    resizer.setAttribute("left", params.left);
    resizer.setAttribute("center", params.center);
    resizer.setAttribute("height", params.height);
  };
  const handle = trackUrl((params) => applyParams(params), { ctx: index, fireOnMount: true });
  const syncToUrl = () => {
    handle.setParams({
      left: resizer.getAttribute("left") ?? config.left.default,
      center: resizer.getAttribute("center") ?? config.center.default,
      height: resizer.getAttribute("height") ?? config.height.default,
    });
  };
  resizer.addEventListener("onLeft", syncToUrl);
  resizer.addEventListener("onCenter", syncToUrl);
  resizer.addEventListener("onHeight", syncToUrl);
}
/** Slotted `#container` may not resize when shadow `#center-div` does — observe that panel instead. */
function resolveLayoutRoot(container) {
  // const resizer = container.closest("center-and-height-resizer") as CenterAndHeightResizerEl | null;
  // return resizer?.getContentRoot?.() ?? container;
  return container;
}
async function initMonacoDiffEditor(container) {
  container.style.height = "100%";
  container.style.width = "100%";
  const layoutRoot = resolveLayoutRoot(container);
  const monaco = await loadMonaco();
  const editor = monaco.editor.createDiffEditor(container, {
    automaticLayout: false,
    scrollbar: {
      vertical: "auto",
    },
    scrollBeyondLastLine: false,
  });
  editor.setModel({
    original: monaco.editor.createModel(original, "javascript"),
    modified: monaco.editor.createModel(modified, "javascript"),
  });
  let layoutRaf = null;
  const scheduleLayout = () => {
    if (layoutRaf !== null) return;
    layoutRaf = requestAnimationFrame(() => {
      layoutRaf = null;
      const { width, height } = layoutRoot.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      editor.layout({ width, height });
    });
  };
  scheduleLayout();
  new ResizeObserver(() => scheduleLayout()).observe(layoutRoot);
  const resizer = container.closest("center-and-height-resizer");
  if (resizer) {
    for (const eventName of ["onLeft", "onCenter", "onHeight"]) {
      resizer.addEventListener(eventName, scheduleLayout);
    }
  }
}
document.querySelectorAll("center-and-height-resizer").forEach((el, index) => {
  wireResizerUrlSync(el, index);
});
const container = document.getElementById("container");
if (!container) {
  throw new Error("Missing #container element");
}
await initMonacoDiffEditor(container);
