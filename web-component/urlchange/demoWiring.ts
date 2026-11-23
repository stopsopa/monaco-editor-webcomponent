/**
 * Shared URL wiring of the three vanilla demo pages:
 *   web-component/manager/index.ts
 *   web-component/web-component/from-js/index.ts
 *   web-component/web-component/from-scripts/index.ts
 *
 * Purpose: these pages used to carry three hand-copied versions of the same code, and one of them drifted
 * (the 300px editor rendered at 100px). Now there is one implementation:
 *
 *   wireResizerUrlSync(resizer, index)   <center-and-height-resizer> size  <->  l-N / c-N / h-N
 *   wireThemeLanguageUrlSync({...})      theme + language <select>         <->  theme / lang
 *
 * Usage (from a demo page module, after the elements exist):
 *
 *   document.querySelectorAll("center-and-height-resizer").forEach((el, i) => wireResizerUrlSync(el, i));
 *
 *   wireThemeLanguageUrlSync({
 *     themeSelect: getSelect("theme-select"),
 *     languageSelect: getSelect("language-select"),
 *     applyTheme: (theme) => { ... },        // "" = no theme chosen
 *     applyLanguage: (language) => { ... },
 *   });
 *
 * Notes:
 *   - Defaults of the resizer params come from the element's own attributes, so the HTML stays the
 *     source of truth for the initial size.
 *   - The URL is written when a drag ends (`onResizeEnd`), not on every pointer move.
 *   - This file has no side-effect imports, so the React demos can import DEMO_LANGUAGES from it.
 */
import modURLSearchParams, { oneOf, type TrackUrlHandle } from "./urlchange.js";

const th = (msg: string) => new Error(`web-component/urlchange/demoWiring.ts error: ${msg}`);

/** One list for every language <select> and every `lang` decoder in the demos. */
export const DEMO_LANGUAGES = ["javascript", "typescript", "json", "css", "html", "python", "plaintext"] as const;

export type DemoLanguage = (typeof DEMO_LANGUAGES)[number];

export const DEFAULT_DEMO_LANGUAGE: DemoLanguage = "javascript";

/** Theme values offered by the demos: "" means "do not touch Monaco's theme". */
export const DEMO_THEMES = ["", "vs", "vs-dark", "hc-black", "hc-light"] as const;

export type DemoTheme = (typeof DEMO_THEMES)[number];

export function getSelect(id: string): HTMLSelectElement {
  const select = document.getElementById(id);
  if (!(select instanceof HTMLSelectElement)) {
    throw th(`missing <select id="${id}">`);
  }
  return select;
}

/** Replaces the options of a <select> with the given values (value === label). */
export function fillSelect(select: HTMLSelectElement, values: readonly string[]): void {
  select.replaceChildren(
    ...values.map((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      return option;
    }),
  );
}

type ResizerParams = { left: string; center: string; height: string };

/**
 * Keeps `left` / `center` / `height` of one resizer in the URL under `l-{index}`, `c-{index}`, `h-{index}`.
 */
export function wireResizerUrlSync(resizer: HTMLElement, index: number): TrackUrlHandle<ResizerParams> {
  const identity = (value: string) => value;

  const config = {
    left: { default: resizer.getAttribute("left") ?? "100px", getParam: "l", encode: identity, decode: identity },
    center: { default: resizer.getAttribute("center") ?? "1200px", getParam: "c", encode: identity, decode: identity },
    height: { default: resizer.getAttribute("height") ?? "100px", getParam: "h", encode: identity, decode: identity },
  };

  const { trackUrl } = modURLSearchParams<ResizerParams, number>(config, (key, i) => `${key}-${i}`);

  const handle = trackUrl(
    (params) => {
      resizer.setAttribute("left", params.left);
      resizer.setAttribute("center", params.center);
      resizer.setAttribute("height", params.height);
    },
    { ctx: index, fireOnMount: true },
  );

  // The element updates its own attributes live while dragging; the URL gets one write per gesture.
  resizer.addEventListener("onResizeEnd", () => {
    handle.setParams({
      left: resizer.getAttribute("left") ?? config.left.default,
      center: resizer.getAttribute("center") ?? config.center.default,
      height: resizer.getAttribute("height") ?? config.height.default,
    });
  });

  return handle;
}

type ThemeLanguageParams = { theme: DemoTheme; language: DemoLanguage };

/**
 * Keeps the theme and language <select>s in the URL under `theme` and `lang`.
 * The language <select> is filled from DEMO_LANGUAGES, so the control and the decoder cannot drift apart.
 */
export function wireThemeLanguageUrlSync(options: {
  themeSelect: HTMLSelectElement;
  languageSelect: HTMLSelectElement;
  /** Called with "" when no theme is chosen. */
  applyTheme: (theme: DemoTheme) => void;
  applyLanguage: (language: DemoLanguage) => void;
}): TrackUrlHandle<ThemeLanguageParams> {
  const { themeSelect, languageSelect, applyTheme, applyLanguage } = options;

  fillSelect(languageSelect, DEMO_LANGUAGES);

  const { trackUrl } = modURLSearchParams<ThemeLanguageParams>({
    theme: {
      default: "",
      getParam: "theme",
      encode: (value) => value,
      decode: oneOf(DEMO_THEMES, ""),
    },
    language: {
      default: DEFAULT_DEMO_LANGUAGE,
      getParam: "lang",
      encode: (value) => value,
      decode: oneOf(DEMO_LANGUAGES, DEFAULT_DEMO_LANGUAGE),
    },
  });

  const handle = trackUrl(
    (params) => {
      themeSelect.value = params.theme;
      applyTheme(params.theme);
      languageSelect.value = params.language;
      applyLanguage(params.language);
    },
    { fireOnMount: true },
  );

  themeSelect.addEventListener("change", () => {
    handle.setParam("theme", oneOf(DEMO_THEMES, "")(themeSelect.value));
  });

  languageSelect.addEventListener("change", () => {
    handle.setParam("language", oneOf(DEMO_LANGUAGES, DEFAULT_DEMO_LANGUAGE)(languageSelect.value));
  });

  return handle;
}
