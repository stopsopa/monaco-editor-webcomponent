import modURLSearchParams, { onUrlChange } from "./urlchange.js";

const radioOptions = ["radio1", "radio2", "radio3"] as const;
type RadioOptionType = (typeof radioOptions)[number];
const defaultRadioOption: RadioOptionType = radioOptions[1];

const selectOptions = ["item1", "item2", "item3", "item4"] as const;
type SingleOptionType = (typeof selectOptions)[number];
type MultiSelectOptionsArray = SingleOptionType[];

const urlParamConfig = {
  text: {
    default: "default text",
    getParam: "t",
    encode: (value: string) => value,
    decode: (value: string) => value,
  },
  radio: {
    default: defaultRadioOption as RadioOptionType,
    getParam: "r",
    encode: (value: RadioOptionType) => value,
    decode: (value: string) => value as RadioOptionType,
  },
  multiSelect: {
    default: ["item1", "item2"] as MultiSelectOptionsArray,
    getParam: "m",
    encode: (value: MultiSelectOptionsArray) => JSON.stringify(value),
    decode: (value: string) => {
      try {
        return JSON.parse(value) as MultiSelectOptionsArray;
      } catch {
        return [];
      }
    },
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

const { trackUrl, separateIndexedSearchParams } = modURLSearchParams(
  urlParamConfig,
  (key, i?: number) => `${key}-${i}`,
);

type UrlParams = Parameters<Parameters<typeof trackUrl>[0]>[0];

/** Parent-only key: lists instance indexes without writing default-valued tracked params. */
const INSTANCE_IDS_KEY = "ids";

function parseInstanceIds(params: URLSearchParams): number[] {
  const indexes = new Set<number>();

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

function getInstanceList(): number[] {
  return parseInstanceIds(new URLSearchParams(window.location.search));
}

function writeInstanceIds(params: URLSearchParams, ids: number[]) {
  if (ids.length === 0) {
    params.delete(INSTANCE_IDS_KEY);
  } else {
    params.set(INSTANCE_IDS_KEY, ids.join(","));
  }
}

function replaceSearch(next: URLSearchParams) {
  const current = new URLSearchParams(window.location.search);
  if (next.toString() === current.toString()) return;

  const search = next.toString();
  const url = search
    ? `${window.location.pathname}?${search}${window.location.hash}`
    : `${window.location.pathname}${window.location.hash}`;
  history.replaceState(history.state, "", url);
}

function addComponent() {
  const list = getInstanceList();
  const nextIndex = list.length > 0 ? Math.max(...list) + 1 : 1;
  const currentParams = new URLSearchParams(window.location.search);

  // Register the instance only — do not seed tracked params at their defaults.
  writeInstanceIds(currentParams, [...list, nextIndex]);

  replaceSearch(currentParams);
  updateUrlDisplay();
  reconcileSections();
}

function deleteItem(i: number) {
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

const updateUrlDisplay = (url: string = window.location.href) => {
  if (urlDisplayEl) urlDisplayEl.textContent = url;
};

function childSectionHtml(index: number): string {
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

class ChildSection {
  readonly root: HTMLElement;
  private readonly textInput: HTMLInputElement;
  private readonly multiSelect: HTMLSelectElement;
  private readonly checkboxA: HTMLInputElement;
  private readonly checkboxB: HTMLInputElement;
  private readonly dumpPre: HTMLPreElement;
  private readonly radioInputs: HTMLInputElement[];
  private readonly handle: ReturnType<typeof trackUrl>;
  private syncing = false;

  constructor(
    container: HTMLElement,
    readonly index: number,
    onDelete: (i: number) => void,
  ) {
    this.root = document.createElement("div");
    this.root.className = "url-ser-container";
    this.root.dataset.index = String(index);
    this.root.innerHTML = childSectionHtml(index);
    container.appendChild(this.root);

    const form = this.root.querySelector('[data-role="form"]') as HTMLFormElement;
    this.textInput = this.root.querySelector('[data-role="text"]') as HTMLInputElement;
    this.multiSelect = this.root.querySelector('[data-role="multi-select"]') as HTMLSelectElement;
    this.checkboxA = this.root.querySelector('[data-role="checkbox-a"]') as HTMLInputElement;
    this.checkboxB = this.root.querySelector('[data-role="checkbox-b"]') as HTMLInputElement;
    this.dumpPre = this.root.querySelector('[data-role="dump"]') as HTMLPreElement;
    this.radioInputs = Array.from(this.root.querySelectorAll('[data-role="radio"]'));

    const deleteBtn = this.root.querySelector('[data-role="delete"]') as HTMLButtonElement;
    const reconfigureBtn = this.root.querySelector('[data-role="reconfigure"]') as HTMLButtonElement;

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
        this.handle.setParam("radio", input.value as RadioOptionType);
      });
    }

    this.multiSelect.addEventListener("change", () => {
      if (this.syncing) return;
      this.handle.setParam(
        "multiSelect",
        Array.from(this.multiSelect.selectedOptions, (o) => o.value as SingleOptionType),
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

  private syncUi(params: UrlParams, path: string) {
    this.syncing = true;
    this.textInput.value = params.text;
    for (const input of this.radioInputs) {
      input.checked = params.radio === input.value;
    }
    for (const option of Array.from(this.multiSelect.options)) {
      option.selected = params.multiSelect.includes(option.value as SingleOptionType);
    }
    this.checkboxA.checked = params.checkboxA;
    this.checkboxB.checked = params.checkboxB;
    this.dumpPre.textContent = JSON.stringify({ params, path }, null, 2);
    this.syncing = false;
  }

  destroy() {
    this.handle.disconnect();
    this.root.remove();
  }
}

const sectionsEl = document.getElementById("sections")!;
const instanceListEl = document.getElementById("instance-list")!;
const addBtn = document.getElementById("add-btn")!;
const linkOff = document.getElementById("link-off") as HTMLAnchorElement;

linkOff.href = window.location.href.split("?")[0];

const sections = new Map<number, ChildSection>();

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
    const el = sections.get(i)!.root;
    sectionsEl.appendChild(el);
  }
}

addBtn.addEventListener("click", addComponent);

onUrlChange(() => {
  updateUrlDisplay();
  reconcileSections();
});

updateUrlDisplay();
reconcileSections();
