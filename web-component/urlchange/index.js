/**
 * Demo page for vanilla `trackUrl` / `modURLSearchParams`.
 * Mirrors ModURLSearchParamsComponent.tsx: multiple indexed instances, each syncing UI ↔ URL.
 *
 * All query-string reads/writes go through helpers in `toolsURLSearchParams.ts`.
 */
import modURLSearchParams, { onUrlChange } from "./urlchange.js";
import { cloneSearchParams, compareNormalizedSearchParams, syncURLSearchParams } from "./toolsURLSearchParams.js";
import { ChildSection, selectOptions, defaultRadioOption } from "./ChildSection.js";
/** Schema for one instance: local names, short URL keys (`t`, `r`, …), defaults, encode/decode. */
const urlParamConfig = {
  text: {
    default: "default text",
    getParam: "t",
    encode: (value) => value,
    decode: (value) => value,
  },
  radio: {
    default: defaultRadioOption,
    getParam: "r",
    encode: (value) => value,
    decode: (value) => value,
  },
  multiSelect: {
    default: ["item1", "item2"],
    getParam: "m",
    encode: (value) => value.join("."),
    decode: (value) => value.split("."),
  },
  checkboxA: {
    default: false,
    getParam: "c1",
    encode: (value) => (value ? "1" : "0"),
    decode: (value) => value === "1",
  },
  checkboxB: {
    default: true,
    getParam: "c2",
    encode: (value) => (value ? "1" : "0"),
    decode: (value) => value === "1",
  },
};
const instanceKeyFn = (key, i) => `${key}-${i}`;
const { trackUrl, separateIndexedSearchParams } = modURLSearchParams(urlParamConfig, instanceKeyFn);
/** Parent-only key: lists instance indexes without writing default-valued tracked params. */
const INSTANCE_IDS_KEY = "ids";
/**
 * Attempt to find list of indices to determine how many html formations to render
 *
 * Collects all instance indexes present in the query string.
 * Uses the parent `ids=1,2` list plus any key ending in `-{n}` (e.g. `t-3` from deep links).
 */
function parseInstanceIds(params) {
  const indexes = new Set();
  const raw = params.get(INSTANCE_IDS_KEY);
  if (raw) {
    for (const part of raw.split(",")) {
      const n = parseInt(part.trim(), 10);
      if (!isNaN(n)) indexes.add(n);
    }
  }
  params.forEach((_, key) => {
    if (key === INSTANCE_IDS_KEY) return;
    const match = key.match(/-(\d+)$/);
    if (match) indexes.add(parseInt(match[1], 10));
  });
  return Array.from(indexes).sort((a, b) => a - b);
}
/** Reads the current page URL and returns which instance indexes should be rendered. */
function getInstanceList() {
  return parseInstanceIds(cloneSearchParams(new URLSearchParams(window.location.search)));
}
/**
 * Returns a patch for `ids` only. Apply with `syncURLSearchParams` so an empty list removes the key.
 */
function instanceIdsPatch(ids) {
  const patch = new URLSearchParams();
  if (ids.length > 0) {
    patch.set(INSTANCE_IDS_KEY, ids.join(","));
  }
  return patch;
}
/** All indexed query keys for one instance (`t-1`, `r-1`, …) — used when removing an instance from the URL. */
function governedKeysForInstance(i) {
  return Object.values(urlParamConfig).map((def) => instanceKeyFn(def.getParam, i));
}
/**
 * Commits a full query string to the address bar when it differs from the current location (normalized).
 */
function updateUrl(next) {
  const current = cloneSearchParams(new URLSearchParams(window.location.search));
  if (compareNormalizedSearchParams(next, current)) return;
  const search = next.toString();
  const url = search
    ? `${window.location.pathname}?${search}${window.location.hash}`
    : `${window.location.pathname}${window.location.hash}`;
  history.replaceState(history.state, "", url);
}
/**
 * Syncs only `governed` keys from `patch` onto `base` (defaults to current location) and commits.
 * Keys absent from `patch` are removed — required for default elision and instance teardown.
 */
function replaceSearchSynced(governed, patch, base) {
  updateUrl(
    syncURLSearchParams(base ?? cloneSearchParams(new URLSearchParams(window.location.search)), governed, patch),
  );
}
/** "Add Text Param" — registers the next instance index in `ids` and mounts a new section. */
function addComponent() {
  const current = cloneSearchParams(new URLSearchParams(window.location.search));
  const list = getInstanceList();
  const nextIndex = list.length > 0 ? Math.max(...list) + 1 : 1;
  replaceSearchSynced([INSTANCE_IDS_KEY], instanceIdsPatch([...list, nextIndex]), current);
  updateUrlDisplay();
  reconcileSections();
}
/**
 * Removes one instance: drops all of its indexed tracked keys and removes `i` from `ids`.
 * Called from each section's Delete button.
 */
function deleteItem(i) {
  const current = cloneSearchParams(new URLSearchParams(window.location.search));
  const childSlice = separateIndexedSearchParams(current, i);
  const withoutChild = syncURLSearchParams(current, governedKeysForInstance(i), childSlice);
  const ids = parseInstanceIds(withoutChild).filter((id) => id !== i);
  replaceSearchSynced([INSTANCE_IDS_KEY], instanceIdsPatch(ids), withoutChild);
  updateUrlDisplay();
  reconcileSections();
}
const urlDisplayEl = document.getElementById("url-display");
/** Keeps the top `<pre id="url-display">` in sync with the full browser URL after every change. */
const updateUrlDisplay = (url = window.location.href) => {
  if (urlDisplayEl) urlDisplayEl.textContent = url;
};
const sectionsEl = document.getElementById("sections");
const instanceListEl = document.getElementById("instance-list");
const addBtn = document.getElementById("add-btn");
const linkOff = document.getElementById("link-off");
linkOff.href = window.location.href.split("?")[0];
const sections = new Map();
/**
 * Syncs mounted sections with `getInstanceList()`: create missing, destroy removed, reorder DOM.
 * Runs on load, on URL changes (back/forward, links), and after add/delete.
 */
function reconcileSections() {
  const list = getInstanceList();
  instanceListEl.textContent = list.length > 0 ? list.join(", ") : "(none)";
  for (const i of list) {
    if (!sections.has(i)) {
      const section = new ChildSection(sectionsEl, i);
      const handle = trackUrl(
        (params, updatedURLSearchParams, governedKeys) => {
          console.log(`RENDER ${i} >${updatedURLSearchParams.toString()}<`, params);
          section.setText(params.text);
          section.setRadio(params.radio);
          section.setMultiSelect(params.multiSelect);
          section.setCheckboxA(params.checkboxA);
          section.setCheckboxB(params.checkboxB);
          section.setDump({ params, path: updatedURLSearchParams.toString() });
          updateUrlDisplay();
          const current = new URLSearchParams(window.location.search);
          const next = syncURLSearchParams(current, governedKeys, updatedURLSearchParams);
          if (next.toString() !== current.toString()) {
            const search = next.toString();
            const url = search
              ? `${window.location.pathname}?${search}${window.location.hash}`
              : `${window.location.pathname}${window.location.hash}`;
            history.replaceState(history.state, "", url);
          }
        },
        { ctx: i, fireOnMount: true },
      );
      section.onText((idx, val) => {
        handle.setParam("text", val);
      });
      section.onRadio((idx, val) => {
        handle.setParam("radio", val);
      });
      section.onMultiSelect((idx, val) => {
        handle.setParam("multiSelect", val);
      });
      section.onCheckboxA((idx, val) => {
        handle.setParam("checkboxA", val);
      });
      section.onCheckboxB((idx, val) => {
        handle.setParam("checkboxB", val);
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
    const el = sections.get(i).section.root;
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
