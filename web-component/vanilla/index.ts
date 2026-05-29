import { CenterAndHeightResizer } from "../CenterAndHeightResizer.js";

import modURLSearchParams, { type ParamDef } from "../urlchange/urlchange.js";

import type * as Monaco from "monaco-editor";

// const VS_PATH = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.10.1/min/vs";
// const VS_PATH = "https://cdn.jsdelivr.net/npm/monaco-editor@0.53.0/min/vs";
const VS_PATH = "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs";

type MonacoWindow = Window & {
  require?: {
    config: (cfg: { paths: Record<string, string> }) => void;
    (deps: string[], cb: () => void): void;
  };
  monaco?: typeof Monaco;
};

type ResizerParams = {
  left: string;
  center: string;
  height: string;
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

function loadMonaco(vsPath: string = VS_PATH): Promise<typeof Monaco> {
  return new Promise<typeof Monaco>((resolve, reject) => {
    const win = window as unknown as MonacoWindow;

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

const instanceKeyFn = (key: string, i?: number): string => `${key}-${i}`;

function createResizerParamConfig(resizer: HTMLElement): {
  [K in keyof ResizerParams]: ParamDef<ResizerParams[K]>;
} {
  return {
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
}

/** Indexed URL params (`l-0`, `c-0`, `h-0`, …) ↔ resizer attributes; drag events write back to the URL. */
function wireResizerUrlSync(resizer: HTMLElement, index: number): void {
  const config = createResizerParamConfig(resizer);
  const { trackUrl } = modURLSearchParams(config, instanceKeyFn);

  const applyParams = (params: ResizerParams): void => {
    resizer.setAttribute("left", params.left);
    resizer.setAttribute("center", params.center);
    resizer.setAttribute("height", params.height);
  };

  const handle = trackUrl((params) => applyParams(params), { ctx: index, fireOnMount: true });

  const syncToUrl = (): void => {
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

async function initMonacoDiffEditor(container: HTMLElement, layoutRoot: HTMLElement): Promise<void> {
  container.style.height = "100%";
  container.style.width = "100%";

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

  let layoutRaf: number | null = null;
  const scheduleLayout = (): void => {
    if (layoutRaf !== null) return;
    layoutRaf = requestAnimationFrame(() => {
      layoutRaf = null;
      const { width, height } = container.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      editor.layout({ width, height });
    });
  };

  scheduleLayout();

  new ResizeObserver(() => scheduleLayout()).observe(container);

  const resizer = container.closest(CenterAndHeightResizer.tagName);
  if (resizer) {
    for (const eventName of ["onLeft", "onCenter", "onHeight"] as const) {
      resizer.addEventListener(eventName, scheduleLayout);
    }
  }
}

const container = document.getElementById("container");
if (!container) {
  throw new Error("Missing #container element");
}

await customElements.whenDefined(CenterAndHeightResizer.tagName);

document.querySelectorAll(CenterAndHeightResizer.tagName).forEach((el, index) => {
  wireResizerUrlSync(el as HTMLElement, index);
});

// const layoutRoot = await CenterAndHeightResizer.whenHostReady(container);
// await initMonacoDiffEditor(container, layoutRoot);

await initMonacoDiffEditor(container, container);
