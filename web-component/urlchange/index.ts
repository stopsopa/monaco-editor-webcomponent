/**
 * Demo page for vanilla `trackUrl` / `modURLSearchParams`.
 * Mirrors ModURLSearchParamsComponent.tsx: multiple indexed instances, each syncing UI ↔ URL.
 *
 * Open web-component/urlchange/index.html through the dev server (`npm start`).
 *
 * How it is put together:
 *   - every instance has its own tracker (`trackUrl(..., { ctx: i })`) which reads AND writes its keys,
 *   - the list of instances lives in `ids=1,2` (see instanceIds.ts), written by this file,
 *   - text typing is debounced (`debounceMs`) so the history API is not called on every keystroke.
 */
import modURLSearchParams, { listOf, oneOf, onUrlChange } from "./urlchange.js";

import {
  cloneSearchParams,
  compareNormalizedSearchParams,
  syncURLSearchParams,
  buildUrlWithSearchParams,
} from "./toolsURLSearchParams.js";

import {
  INSTANCE_IDS_KEY,
  hasExplicitInstanceIds,
  instanceIdsPatch,
  nextInstanceId,
  parseInstanceIds,
} from "./instanceIds.js";

import {
  ChildSection,
  type RadioOptionType,
  radioOptions,
  selectOptions,
  type MultiSelectOptionsArray,
  defaultRadioOption,
} from "./ChildSection.js";

/**
 * Schema for one instance: local names, short URL keys (`t`, `r`, …), defaults, encode/decode.
 * Everything coming from the URL is user input, so the enumerated params validate on decode.
 */
const urlParamConfig = {
  text: {
    default: "default text",
    getParam: "t",
    encode: (value: string) => value,
    decode: (value: string) => value,
  },
  radio: {
    default: defaultRadioOption,
    getParam: "r",
    encode: (value: RadioOptionType) => value,
    decode: oneOf(radioOptions, defaultRadioOption),
  },
  multiSelect: {
    default: ["item1", "item2"] as MultiSelectOptionsArray,
    getParam: "m",
    ...listOf(selectOptions, "."),
  },
  checkboxA: {
    default: false,
    getParam: "c1",
    encode: (value: boolean) => (value ? "1" : "0"),
    decode: (value: string) => value === "1",
  },
  checkboxB: {
    default: true,
    getParam: "c2",
    encode: (value: boolean) => (value ? "1" : "0"),
    decode: (value: string) => value === "1",
  },
} as const;

const instanceKeyFn = (key: string, i?: number) => `${key}-${i}`;

const { trackUrl } = modURLSearchParams(urlParamConfig, instanceKeyFn);

/** How long typing has to pause before the text lands in the address bar. */
const TEXT_DEBOUNCE_MS = 250;

/** Reads the current page URL and returns which instance indexes should be rendered. */
function getInstanceList(): number[] {
  return parseInstanceIds(cloneSearchParams(new URLSearchParams(window.location.search)));
}

/** All indexed query keys for one instance (`t-1`, `r-1`, …) — used when removing an instance from the URL. */
function governedKeysForInstance(i: number): string[] {
  return Object.values(urlParamConfig).map((def) => instanceKeyFn(def.getParam, i));
}

/**
 * Commits a full query string to the address bar when it differs from the current location (normalized).
 */
function updateUrl(next: URLSearchParams) {
  const current = cloneSearchParams(new URLSearchParams(window.location.search));
  if (compareNormalizedSearchParams(next, current)) return;

  const url = buildUrlWithSearchParams(window.location.href, next);
  history.replaceState(history.state, "", url);
}

/**
 * Syncs only `governed` keys from `patch` onto `base` (defaults to current location) and commits.
 * Keys absent from `patch` are removed — required for default elision and instance teardown.
 */
function replaceSearchSynced(governed: string[], patch: URLSearchParams, base?: URLSearchParams) {
  updateUrl(
    syncURLSearchParams(base ?? cloneSearchParams(new URLSearchParams(window.location.search)), governed, patch),
  );
}

/** "Add Text Param" — registers the next instance index in `ids` and mounts a new section. */
function addComponent() {
  const current = cloneSearchParams(new URLSearchParams(window.location.search));
  const list = getInstanceList();
  const nextIndex = nextInstanceId(list);

  replaceSearchSynced([INSTANCE_IDS_KEY], instanceIdsPatch([...list, nextIndex]), current);
  updateUrlDisplay();
  reconcileSections();
}

/**
 * Removes one instance: drops all of its indexed tracked keys and removes `i` from `ids`.
 * Called from each section's Delete button.
 */
function deleteItem(i: number) {
  // a debounced text change of this instance must not be written after its keys were removed
  sections.get(i)?.handle.disconnect();

  const current = cloneSearchParams(new URLSearchParams(window.location.search));
  // an empty patch removes every governed key of this instance
  const withoutChild = syncURLSearchParams(current, governedKeysForInstance(i), new URLSearchParams());
  const ids = parseInstanceIds(withoutChild).filter((id) => id !== i);

  replaceSearchSynced([INSTANCE_IDS_KEY], instanceIdsPatch(ids), withoutChild);
  updateUrlDisplay();
  reconcileSections();
}

const urlDisplayEl = document.getElementById("url-display");

/** Keeps the top `<pre id="url-display">` in sync with the full browser URL after every change. */
const updateUrlDisplay = (url: string = window.location.href) => {
  if (urlDisplayEl) urlDisplayEl.textContent = url;
};

const sectionsEl = document.getElementById("sections")!;
const instanceListEl = document.getElementById("instance-list")!;
const addBtn = document.getElementById("add-btn")!;
const linkOff = document.getElementById("link-off") as HTMLAnchorElement;

linkOff.href = window.location.href.split("?")[0];

interface SectionRecord {
  section: ChildSection;
  handle: ReturnType<typeof trackUrl>;
}

const sections = new Map<number, SectionRecord>();

let reconciling = false;
let reconcileAgain = false;

/**
 * Syncs mounted sections with `getInstanceList()`: create missing, destroy removed, reorder DOM.
 * Runs on load, on URL changes (back/forward, links), and after add/delete.
 *
 * Creating a tracker can rewrite the URL (normalisation), which notifies `onUrlChange` and lands here
 * again - hence the guard: a nested call only asks the running one to do another pass.
 */
function reconcileSections() {
  if (reconciling) {
    reconcileAgain = true;
    return;
  }

  reconciling = true;
  try {
    do {
      reconcileAgain = false;
      reconcileSectionsOnce();
    } while (reconcileAgain);
  } finally {
    reconciling = false;
  }
}

function reconcileSectionsOnce() {
  const list = getInstanceList();
  instanceListEl.textContent = list.length > 0 ? list.join(", ") : "(none)";

  // Instances found only through their keys (deep link `?t-3=x`) are written into `ids` first.
  // Otherwise such an instance would disappear as soon as its last param is back at the default.
  const current = cloneSearchParams(new URLSearchParams(window.location.search));
  if (!hasExplicitInstanceIds(current, list)) {
    replaceSearchSynced([INSTANCE_IDS_KEY], instanceIdsPatch(list), current);
  }

  for (const i of list) {
    if (!sections.has(i)) {
      const section = new ChildSection(sectionsEl, i);

      // The tracker writes the URL itself; this callback only applies params to the UI.
      const handle = trackUrl(
        (params, updatedURLSearchParams) => {
          console.log(`RENDER ${i} >${updatedURLSearchParams.toString()}<`, params);

          // do not fight the caret while the user is typing in this very input
          if (section.getText() !== params.text) section.setText(params.text);
          section.setRadio(params.radio);
          section.setMultiSelect(params.multiSelect);
          section.setCheckboxA(params.checkboxA);
          section.setCheckboxB(params.checkboxB);

          section.setDump({ params, path: updatedURLSearchParams.toString() });
          updateUrlDisplay();
        },
        { ctx: i, fireOnMount: true, debounceMs: TEXT_DEBOUNCE_MS },
      );

      section.onText((idx, val) => {
        handle.setParam("text", val);
      });

      // discrete controls: no reason to wait for the debounce
      section.onRadio((idx, val) => {
        handle.setParam("radio", val);
        handle.flush();
      });

      section.onMultiSelect((idx, val) => {
        handle.setParam("multiSelect", val);
        handle.flush();
      });

      section.onCheckboxA((idx, val) => {
        handle.setParam("checkboxA", val);
        handle.flush();
      });

      section.onCheckboxB((idx, val) => {
        handle.setParam("checkboxB", val);
        handle.flush();
      });

      section.onDelete((idx) => {
        deleteItem(idx);
      });

      section.onReconfigure((idx) => {
        const params = handle.getParams();
        if (params.radio === "radio2") {
          handle.setParams({
            text: `text-${idx} second state`,
            radio: "radio3",
            multiSelect: [selectOptions[1], selectOptions[selectOptions.length - 2]],
            checkboxA: true,
            checkboxB: false,
          });
        } else {
          handle.setParams({
            text: `text-${idx}`,
            radio: "radio2",
            multiSelect: [selectOptions[0], selectOptions[selectOptions.length - 1]],
            checkboxA: false,
            checkboxB: true,
          });
        }
        handle.flush();
      });

      sections.set(i, { section, handle });
    }
  }

  for (const [i, record] of sections) {
    if (!list.includes(i)) {
      record.handle.disconnect();
      record.section.destroy();
      sections.delete(i);
    }
  }

  for (const i of list) {
    const el = sections.get(i)!.section.root;
    sectionsEl.appendChild(el);
  }
}

addBtn.addEventListener("click", addComponent);

// Initial paint + react to back/forward and any URL change that affects instance list or params.
onUrlChange(() => {
  console.log("any change");
  updateUrlDisplay();
  reconcileSections();
});

updateUrlDisplay();
reconcileSections();
