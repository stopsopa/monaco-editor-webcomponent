export const radioOptions = ["radio1", "radio2", "radio3"] as const;
export type RadioOptionType = (typeof radioOptions)[number];
export const defaultRadioOption: RadioOptionType = radioOptions[1];

export const selectOptions = ["item1", "item2", "item3", "item4"] as const;
export type SingleOptionType = (typeof selectOptions)[number];
export type MultiSelectOptionsArray = SingleOptionType[];

/** HTML template for one demo instance (form controls + JSON dump). Injected via `innerHTML`. */
function generateSectionHtml(index: number): string {
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
 * ChildSection encapsulates all aspects of DOM manipulation for a single
 * index/instance of the test components, keeping DOM queries and mutations
 * isolated from the URL-handling business logic.
 */
export class ChildSection {
  readonly root: HTMLElement;
  private readonly textInput: HTMLInputElement;
  private readonly multiSelect: HTMLSelectElement;
  private readonly checkboxA: HTMLInputElement;
  private readonly checkboxB: HTMLInputElement;
  private readonly dumpPre: HTMLPreElement;
  private readonly radioInputs: HTMLInputElement[];

  constructor(
    container: HTMLElement,
    readonly index: number,
  ) {
    this.root = document.createElement("div");
    this.root.className = "url-ser-container";
    this.root.dataset.index = String(index);
    this.root.innerHTML = generateSectionHtml(index);
    container.appendChild(this.root);

    const form = this.root.querySelector('[data-role="form"]') as HTMLFormElement;
    this.textInput = this.root.querySelector('[data-role="text"]') as HTMLInputElement;
    this.multiSelect = this.root.querySelector('[data-role="multi-select"]') as HTMLSelectElement;
    this.checkboxA = this.root.querySelector('[data-role="checkbox-a"]') as HTMLInputElement;
    this.checkboxB = this.root.querySelector('[data-role="checkbox-b"]') as HTMLInputElement;
    this.dumpPre = this.root.querySelector('[data-role="dump"]') as HTMLPreElement;
    this.radioInputs = Array.from(this.root.querySelectorAll('[data-role="radio"]'));

    form.addEventListener("submit", (e) => e.preventDefault());
  }

  // Getters & Setters
  getText(): string {
    return this.textInput.value;
  }
  setText(value: string) {
    this.textInput.value = value;
  }

  getRadio(): RadioOptionType {
    const checkedRadio = this.radioInputs.find((input) => input.checked);
    return (checkedRadio ? checkedRadio.value : defaultRadioOption) as RadioOptionType;
  }
  setRadio(value: RadioOptionType) {
    for (const input of this.radioInputs) {
      input.checked = input.value === value;
    }
  }

  getMultiSelect(): MultiSelectOptionsArray {
    return Array.from(this.multiSelect.selectedOptions, (o) => o.value as SingleOptionType);
  }
  setMultiSelect(values: MultiSelectOptionsArray) {
    for (const option of Array.from(this.multiSelect.options)) {
      option.selected = values.includes(option.value as SingleOptionType);
    }
  }

  getCheckboxA(): boolean {
    return this.checkboxA.checked;
  }
  setCheckboxA(value: boolean) {
    this.checkboxA.checked = value;
  }

  getCheckboxB(): boolean {
    return this.checkboxB.checked;
  }
  setCheckboxB(value: boolean) {
    this.checkboxB.checked = value;
  }

  setDump(data: any) {
    this.dumpPre.textContent = JSON.stringify(data, null, 2);
  }

  // Event Registrations
  onText(callback: (index: number, value: string) => void) {
    this.textInput.addEventListener("input", () => {
      callback(this.index, this.textInput.value);
    });
  }

  onRadio(callback: (index: number, value: RadioOptionType) => void) {
    for (const input of this.radioInputs) {
      input.addEventListener("change", () => {
        if (input.checked) {
          callback(this.index, input.value as RadioOptionType);
        }
      });
    }
  }

  onMultiSelect(callback: (index: number, values: MultiSelectOptionsArray) => void) {
    this.multiSelect.addEventListener("change", () => {
      callback(this.index, this.getMultiSelect());
    });
  }

  onCheckboxA(callback: (index: number, value: boolean) => void) {
    this.checkboxA.addEventListener("change", () => {
      callback(this.index, this.checkboxA.checked);
    });
  }

  onCheckboxB(callback: (index: number, value: boolean) => void) {
    this.checkboxB.addEventListener("change", () => {
      callback(this.index, this.checkboxB.checked);
    });
  }

  onDelete(callback: (index: number) => void) {
    const deleteBtn = this.root.querySelector('[data-role="delete"]') as HTMLButtonElement;
    deleteBtn.addEventListener("click", () => callback(this.index));
  }

  onReconfigure(callback: (index: number) => void) {
    const reconfigureBtn = this.root.querySelector('[data-role="reconfigure"]') as HTMLButtonElement;
    reconfigureBtn.addEventListener("click", () => callback(this.index));
  }

  destroy() {
    this.root.remove();
  }
}
