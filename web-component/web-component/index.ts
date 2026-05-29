import { CenterAndHeightResizer } from "../CenterAndHeightResizer.js";

import modURLSearchParams, { type ParamDef } from "../urlchange/urlchange.js";

import { isMonacoTheme, MonacoDiffElement, tagName } from "../monaco-diff.js";

type ResizerParams = {
  left: string;
  center: string;
  height: string;
};

type DiffDemoParams = {
  theme: string;
};

const instanceKeyFn = (key: string, i?: number): string => `${key}-${i}`;

const diffDemoParamConfig: { theme: ParamDef<string> } = {
  theme: {
    default: "",
    getParam: "theme",
    encode: (value: string) => value,
    decode: (value: string) => (isMonacoTheme(value) ? value : ""),
  },
};

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

  const { setParams } = trackUrl((params) => applyParams(params), { ctx: index, fireOnMount: true });

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

const { trackUrl: trackDiffUrl } = modURLSearchParams(diffDemoParamConfig);

const { setParam: setThemeParam } = trackDiffUrl(
  (params: DiffDemoParams) => {
    themeSelect.value = params.theme;
    applyThemeAttribute(diffEl, params.theme);
  },
  { fireOnMount: true },
);

themeSelect.addEventListener("change", () => {
  const theme = themeSelect.value;
  applyThemeAttribute(diffEl, theme);
  setThemeParam("theme", theme);
});

await diffEl.whenReady();
