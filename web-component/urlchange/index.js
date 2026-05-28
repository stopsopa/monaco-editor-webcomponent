/**
 * Demo page for vanilla `trackUrl` / `modURLSearchParams`.
 * Mirrors ModURLSearchParamsComponent.tsx: multiple indexed instances, each syncing UI ↔ URL.
 */
import modURLSearchParams, { onUrlChange } from "./urlchange.js";
const radioOptions = ["radio1", "radio2", "radio3"];
const defaultRadioOption = radioOptions[1];
const selectOptions = ["item1", "item2", "item3", "item4"];
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
    encode: (value) => JSON.stringify(value),
    decode: (value) => {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    },
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
const { trackUrl, separateIndexedSearchParams } = modURLSearchParams(urlParamConfig, (key, i) => `${key}-${i}`);
/** Parent-only key: lists instance indexes without writing default-valued tracked params. */
const INSTANCE_IDS_KEY = "ids";
/**
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
  return parseInstanceIds(new URLSearchParams(window.location.search));
}
/**
 * Updates or removes the parent-only `ids` query key.
 * Lets us add an empty instance without writing default-valued tracked params (`t-1`, `r-1`, …).
 */
function writeInstanceIds(params, ids) {
  if (ids.length === 0) {
    params.delete(INSTANCE_IDS_KEY);
  } else {
    params.set(INSTANCE_IDS_KEY, ids.join(","));
  }
}
/**
 * Applies a new query string via `history.replaceState` (no full page reload).
 * Used by the parent when adding/removing instances; children use `trackUrl` setters instead.
 */
function replaceSearch(next) {
  const current = new URLSearchParams(window.location.search);
  if (next.toString() === current.toString()) return;
  const search = next.toString();
  const url = search
    ? `${window.location.pathname}?${search}${window.location.hash}`
    : `${window.location.pathname}${window.location.hash}`;
  history.replaceState(history.state, "", url);
}
/** "Add Text Param" — registers the next instance index in `ids` and mounts a new section. */
function addComponent() {
  const list = getInstanceList();
  const nextIndex = list.length > 0 ? Math.max(...list) + 1 : 1;
  const currentParams = new URLSearchParams(window.location.search);
  writeInstanceIds(currentParams, [...list, nextIndex]);
  replaceSearch(currentParams);
  updateUrlDisplay();
  reconcileSections();
}
/**
 * Removes one instance: drops all of its indexed tracked keys and removes `i` from `ids`.
 * Called from each section's Delete button.
 */
function deleteItem(i) {
  const nextSearchParams = new URLSearchParams(window.location.search);
  const childParams = separateIndexedSearchParams(nextSearchParams, i);
  childParams.forEach((_, key) => {
    nextSearchParams.delete(key);
  });
  writeInstanceIds(
    nextSearchParams,
    parseInstanceIds(nextSearchParams).filter((id) => id !== i),
  );
  replaceSearch(nextSearchParams);
  updateUrlDisplay();
  reconcileSections();
}
const urlDisplayEl = document.getElementById("url-display");
/** Keeps the top `<pre id="url-display">` in sync with the full browser URL after every change. */
const updateUrlDisplay = (url = window.location.href) => {
  if (urlDisplayEl) urlDisplayEl.textContent = url;
};
/** HTML template for one demo instance (form controls + JSON dump). Injected via `innerHTML`. */
function childSectionHtml(index) {
  const radioOptionsHtml = radioOptions
    .map(
      (opt) => `
        <label class="url-ser-label-margin">
          <input type="radio" name="radio-${index}" value="${opt}" data-role="radio" />
          ${opt}
        </label>`,
    )
    .join("");
  const selectOptionsHtml = selectOptions.map((opt) => `<option value="${opt}">${opt}</option>`).join("");
  return `
    <div class="url-ser-flex">
      <form class="url-ser-form" data-role="form">
        <label>
          <strong>Text Input:</strong>
          <br />
          <input type="text" class="url-ser-input" data-role="text" />
        </label>

        <fieldset>
          <legend><strong>Radio Group:</strong></legend>
          ${radioOptionsHtml}
        </fieldset>

        <label>
          <strong>Multiple Select:</strong>
          <br />
          <select multiple class="url-ser-select" data-role="multi-select">
            ${selectOptionsHtml}
          </select>
        </label>

        <fieldset>
          <legend><strong>Checkboxes:</strong></legend>
          <label class="url-ser-label-margin">
            <input type="checkbox" data-role="checkbox-a" />
            Checkbox A
          </label>
          <label>
            <input type="checkbox" data-role="checkbox-b" />
            Checkbox B
          </label>
        </fieldset>

        <div class="buttons">
          <button type="button" class="url-ser-delete-btn red" data-role="delete">
            Delete Component #${index}
          </button>
          <button type="button" class="url-ser-delete-btn" data-role="reconfigure">
            Reconfigure #${index}
          </button>
        </div>
      </form>

      <div class="url-ser-dump-container">
        <pre class="url-ser-pre" data-role="dump"></pre>
      </div>
    </div>
  `;
}
/**
 * One indexed param block in the page.
 * Wires `trackUrl` for instance `index`, binds inputs to `setParam` / `setParams`, and mirrors URL → UI.
 */
class ChildSection {
  index;
  root;
  textInput;
  multiSelect;
  checkboxA;
  checkboxB;
  dumpPre;
  radioInputs;
  handle;
  syncing = false;
  /**
   * Builds DOM from template, starts `trackUrl` for this index, and hooks user events to URL updates.
   * `onDelete` is shared from the parent so every section calls the same delete handler.
   */
  constructor(container, index, onDelete) {
    this.index = index;
    this.root = document.createElement("div");
    this.root.className = "url-ser-container";
    this.root.dataset.index = String(index);
    this.root.innerHTML = childSectionHtml(index);
    container.appendChild(this.root);
    const form = this.root.querySelector('[data-role="form"]');
    this.textInput = this.root.querySelector('[data-role="text"]');
    this.multiSelect = this.root.querySelector('[data-role="multi-select"]');
    this.checkboxA = this.root.querySelector('[data-role="checkbox-a"]');
    this.checkboxB = this.root.querySelector('[data-role="checkbox-b"]');
    this.dumpPre = this.root.querySelector('[data-role="dump"]');
    this.radioInputs = Array.from(this.root.querySelectorAll('[data-role="radio"]'));
    const deleteBtn = this.root.querySelector('[data-role="delete"]');
    const reconfigureBtn = this.root.querySelector('[data-role="reconfigure"]');
    form.addEventListener("submit", (e) => e.preventDefault());
    this.handle = trackUrl(
      (params, updatedURLSearchParams) => {
        console.log(`render child ${index} >${updatedURLSearchParams.toString()}<`, params);
        this.syncUi(params, updatedURLSearchParams.toString());
        updateUrlDisplay();
      },
      { ctx: index, fireOnMount: true },
    );
    this.textInput.addEventListener("input", () => {
      if (this.syncing) return;
      this.handle.setParam("text", this.textInput.value);
    });
    for (const input of this.radioInputs) {
      input.addEventListener("change", () => {
        if (this.syncing || !input.checked) return;
        this.handle.setParam("radio", input.value);
      });
    }
    this.multiSelect.addEventListener("change", () => {
      if (this.syncing) return;
      this.handle.setParam(
        "multiSelect",
        Array.from(this.multiSelect.selectedOptions, (o) => o.value),
      );
    });
    this.checkboxA.addEventListener("change", () => {
      if (this.syncing) return;
      this.handle.setParam("checkboxA", this.checkboxA.checked);
    });
    this.checkboxB.addEventListener("change", () => {
      if (this.syncing) return;
      this.handle.setParam("checkboxB", this.checkboxB.checked);
    });
    deleteBtn.addEventListener("click", () => onDelete(index));
    reconfigureBtn.addEventListener("click", () => {
      const params = this.handle.getParams();
      if (params.radio === "radio2") {
        this.handle.setParams({
          text: `text-${index} second state`,
          radio: "radio3",
          multiSelect: [selectOptions[1], selectOptions[selectOptions.length - 2]],
          checkboxA: true,
          checkboxB: false,
        });
        return;
      }
      this.handle.setParams({
        text: `text-${index}`,
        radio: "radio2",
        multiSelect: [selectOptions[0], selectOptions[selectOptions.length - 1]],
        checkboxA: false,
        checkboxB: true,
      });
    });
  }
  /**
   * Applies decoded URL params to form controls and the debug `<pre>`.
   * `syncing` prevents input handlers from writing back to the URL while we push values in.
   */
  syncUi(params, path) {
    this.syncing = true;
    this.textInput.value = params.text;
    for (const input of this.radioInputs) {
      input.checked = params.radio === input.value;
    }
    for (const option of Array.from(this.multiSelect.options)) {
      option.selected = params.multiSelect.includes(option.value);
    }
    this.checkboxA.checked = params.checkboxA;
    this.checkboxB.checked = params.checkboxB;
    this.dumpPre.textContent = JSON.stringify({ params, path }, null, 2);
    this.syncing = false;
  }
  /** Stops URL listener and removes this section from the DOM. */
  destroy() {
    this.handle.disconnect();
    this.root.remove();
  }
}
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
      sections.set(i, new ChildSection(sectionsEl, i, deleteItem));
    }
  }
  for (const [i, section] of sections) {
    if (!list.includes(i)) {
      section.destroy();
      sections.delete(i);
    }
  }
  for (const i of list) {
    const el = sections.get(i).root;
    sectionsEl.appendChild(el);
  }
}
addBtn.addEventListener("click", addComponent);
// Initial paint + react to back/forward and any URL change that affects instance list or params.
onUrlChange(() => {
  updateUrlDisplay();
  reconcileSections();
});
updateUrlDisplay();
reconcileSections();
