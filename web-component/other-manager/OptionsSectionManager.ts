import { markSearchWithSpan } from "../composite-select/helpers.js";
import type { Item, InputChangeEvent } from "../types.js";
import createSubscriber from "../createSubscriber.js";


export type OptionsSectionManagerOptions<T extends Item> = {
  options?: T[];
  loading?: boolean;
  value?: string;
  label?: string;
  onItemPick?: (item: T) => void;
  onInputChange?: (e: InputChangeEvent, previousValue: string | undefined, origin: string) => void;
  onCancel?: () => void;
  onOk?: () => void;
  onHighlightChange?: (id: string | number | null) => void;
  disabled?: boolean;
  maxHeight?: string;
  showFilter?: boolean;
  showFooter?: boolean;
  renderEmpty?: (defaultRender: () => string | HTMLElement) => string | HTMLElement;
  renderItem?: (
    item: T,
    defaultRender: (item: T, searchValue: string | undefined) => string | HTMLElement,
    searchValue: string | undefined,
  ) => string | HTMLElement;
  renderList?: (list: T[], defaultRender: (list: T[]) => (string | HTMLElement)[]) => (string | HTMLElement)[];
  onClear?: () => void;
  onFocus?: (e: FocusEvent) => void;
  onComponentChange?: (s: OptionsSectionManagerOptions<T>, reason: string) => void;
};

export type OptionsSectionManagerEvents<T extends Item> = {
  onItemPick: [item: T];
  onInputChange: [e: InputChangeEvent, previousValue: string | undefined, origin: string];
  onCancel: [];
  onOk: [];
  onHighlightChange: [id: string | number | null];
  onClear: [];
  onFocus: [e: FocusEvent];
  onComponentChange: [s: OptionsSectionManagerOptions<T>, reason: string];
};

export class OptionsSectionManager<T extends Item = Item> {
  public propOptions: OptionsSectionManagerOptions<T>;
  public propParentElement!: HTMLElement;
  public propFilterContainer!: HTMLElement;
  public propOptionsContainer!: HTMLElement;
  public propFooterContainer!: HTMLElement;
  public propInputElement: HTMLInputElement | null = null;
  public propSpinnerElement: HTMLElement | null = null;
  public propLabelElement: HTMLLabelElement | null = null;
  public propOkButton!: HTMLButtonElement;
  public propLeftSpace!: HTMLElement;
  public propCancelButton!: HTMLButtonElement;
  public propClearButton!: HTMLButtonElement;
  public propHighlightedId: string | number | null = null;
  private _skipNextFocusEvent = false;
  protected _attachedElements = new Map<any, (e: KeyboardEvent) => void>();
  protected _subscriber = createSubscriber<OptionsSectionManagerEvents<T>>();

  constructor(bindElement: HTMLElement, options: OptionsSectionManagerOptions<T> = {}) {
    this.propParentElement = bindElement;
    this.propParentElement.classList.add("options-section-manager");
    const {
      options: opt = [],
      loading = false,
      disabled = false,
      value = "",
      showFooter = true,
      showFilter = true,
      renderItem = (item, def, searchValue) => def(item, searchValue),
      renderList = (list, def) => def(list),
      renderEmpty = (def) => def(),
      onClear = () => {},
      ...rest
    } = options;

    this.propOptions = {
      options: opt,
      loading,
      disabled,
      value,
      showFooter,
      showFilter,
      renderItem,
      renderList,
      renderEmpty,
      onClear,
      ...rest,
    };

    this.render();

    Promise.resolve().then(() => {
      if (this.propOptions.maxHeight) {
        this.setMaxHeight(this.propOptions.maxHeight);
      }

      this._bindEvents();
    });
  }

  public getSubscriber() {
    return this._subscriber;
  }

  protected _triggerOnComponentChange(reason: string) {
    if (this.propOptions.onComponentChange) {
      this.propOptions.onComponentChange.call(this, this.propOptions, reason);
    }
    this._subscriber.trigger("onComponentChange", this.propOptions, reason);
  }

  protected _scrollToHighlighted() {
    if (this.propHighlightedId === null) return;
    const el = this.propOptionsContainer.querySelector(`.element[data-id="${this.propHighlightedId}"]`) as HTMLElement;
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }

  protected _defaultRenderEmpty() {
    return `<div class="empty-msg">No options to display</div>`;
  }

  protected _defaultRenderItem(item: T, searchValue: string | undefined) {
    const el = document.createElement("div");
    el.className = "element";

    el.classList.toggle("selected", item.selected === true);

    el.dataset.id = String(item.id);

    const label = document.createElement("label");

    label.innerHTML = markSearchWithSpan(item.label, searchValue || "");

    el.appendChild(label);

    return el;
  }

  protected _defaultRenderList(list: T[]) {
    return list.map((item) =>
      this.propOptions.renderItem!(item, this._defaultRenderItem.bind(this), this.propOptions.value),
    );
  }

  protected _bindEvents() {
    if (this.propInputElement) {
      this.propInputElement.addEventListener("input", (e) => {
        const previousValue = this.propOptions.value;
        this.propOptions.value = this.propInputElement!.value;
        this._triggerOnInputChange(e as unknown as InputChangeEvent, previousValue, "input");
      });

      this.propInputElement.addEventListener("focus", (e) => {
        if (this._skipNextFocusEvent) {
          this._skipNextFocusEvent = false;
          return;
        }
        if (this.propOptions.onFocus) {
          this.propOptions.onFocus.call(this, e);
        }
        this._subscriber.trigger("onFocus", e);
        this.attachArrowsUpAndDown();
      });

      this.propInputElement.addEventListener("blur", () => {
        this.detachArrowsUpAndDown();
      });
    }

    this.propClearButton.addEventListener("click", (e) => {
      e.preventDefault();
      this.clearSearch();
    });

    this.propOkButton.addEventListener("click", () => {
      if (this.propOptions.onOk) {
        this.propOptions.onOk.call(this);
      }
      this._subscriber.trigger("onOk");
    });

    this.propCancelButton.addEventListener("click", () => {
      if (this.propOptions.onCancel) {
        this.propOptions.onCancel.call(this);
      }
      this._subscriber.trigger("onCancel");
    });

    this.propOptionsContainer.addEventListener("click", (e) => {
      if (this.propOptions.disabled) return;
      const target = e.target as HTMLElement;
      const element = target.closest(".element") as HTMLElement;
      if (element) {
        const id = element.dataset.id;
        const item = this.propOptions.options?.find((opt) => String(opt.id) === id);
        if (item) {
          this.setFocus();
          this.highlightAndScrollToElementOnTheList(item.id);
          this._triggerOnItemPick(item);
        }
      }
    });
  }

  protected _handleKeyDown(e: KeyboardEvent) {
    const options = this.propOptions.options || [];
    const currentIndex = options.findIndex((item) => String(item.id) === String(this.propHighlightedId));

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      if (currentIndex === -1) {
        this.highlightAndScrollToElementOnTheList(options[0]?.id);
      } else if (currentIndex < options.length - 1) {
        this.highlightAndScrollToElementOnTheList(options[currentIndex + 1].id);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      if (currentIndex === -1) {
        this.highlightAndScrollToElementOnTheList(options[options.length - 1]?.id);
      } else if (currentIndex > 0) {
        this.highlightAndScrollToElementOnTheList(options[currentIndex - 1].id);
      }
    } else if (e.key === "Enter") {
      if (this.propHighlightedId !== null) {
        e.preventDefault();
        e.stopPropagation();
        this.pickHighlighted();
      } else if (this.propInputElement!.value === "") {
        e.stopPropagation();
        this._triggerOnInputChange(e as unknown as InputChangeEvent, this.propOptions.value, "enter");
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.highlightAndScrollToElementOnTheList(null);
    } else if (e.key === "Backspace" && this.propInputElement!.value === "") {
      e.stopPropagation();
      this._triggerOnInputChange(e as unknown as InputChangeEvent, this.propOptions.value, "backspace");
    }
  }

  protected _updateOptionsDisplay() {
    const container = this.propOptionsContainer;
    if (!container) return;

    const options = this.propOptions.options || [];

    if (options.length === 0) {
      const result = this.propOptions.renderEmpty!(this._defaultRenderEmpty.bind(this));
      if (typeof result === "string") {
        container.innerHTML = result;
      } else {
        container.innerHTML = "";
        container.appendChild(result);
      }
      return;
    }

    const renderedItems = this.propOptions.renderList!(options, this._defaultRenderList.bind(this));
    container.innerHTML = "";
    renderedItems.forEach((item, index) => {
      const dataItem = options[index];
      let el: HTMLElement | null = null;

      if (typeof item === "string") {
        const temp = document.createElement("div");
        temp.innerHTML = item;
        el = temp.firstElementChild as HTMLElement;

        el.classList.add("element");

        el.dataset.id = String(dataItem.id);

        el.classList.toggle("selected", dataItem.selected === true);
      } else {
        el = item;
      }

      if (el) {
        el.classList.toggle(
          "highlighted",
          this.propHighlightedId !== null && String(dataItem.id) === String(this.propHighlightedId),
        );

        container.appendChild(el);
      }
    });
  }

  protected _updateLoadingDisplay() {
    if (this.propSpinnerElement) {
      this.propSpinnerElement.classList.toggle("loading", Boolean(this.propOptions.loading));
    }
    if (this.propClearButton) {
      this.propClearButton.style.display = this.propOptions.loading ? "none" : "flex";
    }
  }

  protected _updateDisabledDisplay() {
    if (this.propOptionsContainer) {
      this.propOptionsContainer.classList.toggle("disabled", Boolean(this.propOptions.disabled));
    }
    if (this.propClearButton) {
      this.propClearButton.disabled = Boolean(this.propOptions.disabled);
    }
  }

  protected _updateFooterDisplay() {
    if (this.propFooterContainer) {
      this.propFooterContainer.style.display = this.propOptions.showFooter !== false ? "flex" : "none";
    }
  }

  protected _updateFilterDisplay() {
    if (this.propFilterContainer) {
      this.propFilterContainer.style.display = this.propOptions.showFilter !== false ? "flex" : "none";
    }
  }
  /**
   * Internal helper to notify both the callback provided in options and the internal subscriber
   * when the input value changes.
   */
  protected _triggerOnInputChange(
    e: InputChangeEvent,
    previousValue: string | undefined,
    origin: string,
  ) {
    if (this.propOptions.onInputChange) {
      this.propOptions.onInputChange.call(this, e, previousValue, origin);
    }
    this._subscriber.trigger("onInputChange", e, previousValue, origin);
  }

  /**
   * Internal helper to notify both the callback provided in options and the internal subscriber
   * when an item is picked (e.g. via click or Enter key).
   */
  protected _triggerOnItemPick(item: T) {
    if (this.propOptions.disabled) return;
    if (this.propOptions.onItemPick) {
      this.propOptions.onItemPick.call(this, item);
    }
    this._subscriber.trigger("onItemPick", item);
  }

  // setters
  public setMaxHeight(maxHeight?: string) {
    this.propOptions.maxHeight = maxHeight || "";
    if (this.propParentElement) {
      this.propParentElement.style.maxHeight = maxHeight || "none";
    }
    this._triggerOnComponentChange("setMaxHeight");
  }

  public setDisabled(disabled: boolean) {
    this.propOptions.disabled = Boolean(disabled);
    this._updateDisabledDisplay();
    this._triggerOnComponentChange("setDisabled");
  }

  public setShowFooter(show: boolean) {
    this.propOptions.showFooter = Boolean(show);
    this._updateFooterDisplay();
    this._triggerOnComponentChange("showFooter");
  }

  public setShowFilter(show: boolean) {
    this.propOptions.showFilter = Boolean(show);
    this._updateFilterDisplay();
    this._triggerOnComponentChange("showFilter");
  }

  public setOptions(options: T[]) {
    this.propOptions.options = options;
    this._updateOptionsDisplay();
    this._triggerOnComponentChange("setOptions");
  }

  public setLoading(loading: boolean) {
    this.propOptions.loading = Boolean(loading);
    this._updateLoadingDisplay();
    this._triggerOnComponentChange("setLoading");
  }

  public setValue(value: string, triggerOnChange: boolean = true) {
    const previousValue = this.propOptions.value;
    this.propOptions.value = value;
    if (this.propInputElement) {
      this.propInputElement.value = value;
    }
    if (triggerOnChange) {
      const event = new Event("input") as InputChangeEvent;
      Object.defineProperty(event, "target", { writable: false, value: this.propInputElement });
      this._triggerOnInputChange(event, previousValue, "setValue");
    }
    this._triggerOnComponentChange("setValue");
  }
  // getters
  public getShowFilter() {
    return this.propOptions.showFilter;
  }
  public getShowFooter() {
    return this.propOptions.showFooter;
  }
  public getDisabled() {
    return this.propOptions.disabled;
  }
  public getLabel() {
    return this.propOptions.label;
  }
  public getLoading() {
    return this.propOptions.loading;
  }
  public getValue() {
    return this.propOptions.value;
  }
  public getOptions() {
    return this.propOptions.options || [];
  }
  public getMaxHeight() {
    return this.propOptions.maxHeight;
  }
  public getHighlightedId() {
    return this.propHighlightedId;
  }

  public clearSearch(triggerOnClear: boolean = true, triggerOnChange: boolean = true) {
    const previousValue = this.propOptions.value;
    this.setValue("", triggerOnChange);
    if (triggerOnClear) {
      if (this.propOptions.onClear) {
        this.propOptions.onClear();
      }
      this._subscriber.trigger("onClear");

      const event = new Event("input") as InputChangeEvent;
      Object.defineProperty(event, "target", { writable: false, value: this.propInputElement });
      this._triggerOnInputChange(event, previousValue, "clear");
    }
  }

  public setLabel(label: string) {
    this.propOptions.label = label;
    if (this.propLabelElement) {
      this.propLabelElement.textContent = label || "";
    }
    this._triggerOnComponentChange("setLabel");
  }

  public highlightAndScrollToElementOnTheList(id?: string | number | null) {
    this.propHighlightedId = id ?? null;
    this._updateOptionsDisplay();
    if (this.propHighlightedId !== null) {
      this._scrollToHighlighted();
    }
    if (this.propOptions.onHighlightChange) {
      this.propOptions.onHighlightChange.call(this, this.propHighlightedId);
    }
    this._subscriber.trigger("onHighlightChange", this.propHighlightedId);
  }

  public pickHighlighted() {
    if (this.propHighlightedId === null) return;
    const item = this.propOptions.options?.find((opt) => String(opt.id) === String(this.propHighlightedId));
    if (item) {
      this._triggerOnItemPick(item);
    }
  }

  public setRenderEmpty(renderEmpty?: (defaultRender: () => string | HTMLElement) => string | HTMLElement) {
    this.propOptions.renderEmpty = renderEmpty || ((def) => def());
    this._updateOptionsDisplay();
    this._triggerOnComponentChange("setRenderEmpty");
  }

  public setRenderItem(
    renderItem?: (
      item: T,
      defaultRender: (item: T, searchValue: string | undefined) => string | HTMLElement,
      searchValue: string | undefined,
    ) => string | HTMLElement,
  ) {
    this.propOptions.renderItem =
      renderItem || ((item, defaultRender, searchValue) => defaultRender(item, searchValue));
    this._updateOptionsDisplay();
    this._triggerOnComponentChange("setRenderItem");
  }

  public setRenderList(
    renderList?: (list: T[], defaultRender: (list: T[]) => (string | HTMLElement)[]) => (string | HTMLElement)[],
  ) {
    this.propOptions.renderList = renderList || ((list, def) => def(list));
    this._updateOptionsDisplay();
    this._triggerOnComponentChange("setRenderList");
  }

  public setFocus(triggerOnFocus: boolean = true) {
    if (!triggerOnFocus) {
      this._skipNextFocusEvent = true;
    }
    this.propInputElement!.focus();
  }
  public setBlur() {
    this.propInputElement!.blur();
  }

  protected attachArrowsUpAndDown() {
    const element = this.propInputElement!;
    if (this._attachedElements.has(element)) {
      return;
    }
    const listener = (e: KeyboardEvent) => this._handleKeyDown(e);
    this._attachedElements.set(element, listener);
    element.addEventListener("keydown", listener);
  }

  protected detachArrowsUpAndDown() {
    const element = this.propInputElement!;
    const listener = this._attachedElements.get(element);
    if (listener) {
      element.removeEventListener("keydown", listener);
      this._attachedElements.delete(element);
    }
  }

  public destroy() {
    // This is the trick: we track all elements we've attached to and detach them here.
    // This is especially important for the 'window' object which persists.
    for (const [element] of this._attachedElements) {
      const listener = this._attachedElements.get(element);
      if (listener) {
        element.removeEventListener("keydown", listener);
      }
    }
    this._attachedElements.clear();
    this._subscriber.destroy();
  }

  public render() {
    if (!this.propFilterContainer) {
      this.propFilterContainer = document.createElement("div");
      this.propFilterContainer.className = "filter";

      const inputWrapper = document.createElement("div");
      inputWrapper.className = "input-wrapper";

      this.propInputElement = document.createElement("input");
      this.propInputElement.type = "text";
      this.propInputElement.id = "search-input-" + Math.random().toString(36).substr(2, 9);
      this.propInputElement.placeholder = " ";
      this.propInputElement.autocomplete = "off";

      this.propLabelElement = document.createElement("label");
      this.propLabelElement.setAttribute("for", this.propInputElement.id);
      this.propLabelElement.textContent = this.propOptions.label || "Search...";

      inputWrapper.appendChild(this.propInputElement);
      inputWrapper.appendChild(this.propLabelElement);

      this.propSpinnerElement = document.createElement("div");
      this.propSpinnerElement.className = "spinner";
      inputWrapper.appendChild(this.propSpinnerElement);

      this.propClearButton = document.createElement("button");
      this.propClearButton.type = "button";
      this.propClearButton.className = "clear-btn";
      this.propClearButton.textContent = "✕";
      inputWrapper.appendChild(this.propClearButton);

      this.propFilterContainer.appendChild(inputWrapper);

      this.propOptionsContainer = document.createElement("div");
      this.propOptionsContainer.className = "options";
      this.propOptionsContainer.tabIndex = 0;

      this.propFooterContainer = document.createElement("div");
      this.propFooterContainer.className = "footer";

      this.propCancelButton = document.createElement("button");
      this.propCancelButton.type = "button";
      this.propCancelButton.dataset.role = "cancel";
      this.propCancelButton.className = "gcp-css white";
      this.propCancelButton.textContent = "Cancel";

      this.propOkButton = document.createElement("button");
      this.propOkButton.type = "button";
      this.propOkButton.dataset.role = "ok";
      this.propOkButton.className = "gcp-css";
      this.propOkButton.textContent = "OK";

      this.propLeftSpace = document.createElement("span");
      this.propLeftSpace.className = "left-space";
      this.propLeftSpace.textContent = "";

      this.propFooterContainer.appendChild(this.propLeftSpace);
      this.propFooterContainer.appendChild(this.propCancelButton);
      this.propFooterContainer.appendChild(this.propOkButton);

      this.propParentElement.appendChild(this.propFilterContainer);
      this.propParentElement.appendChild(this.propOptionsContainer);
      this.propParentElement.appendChild(this.propFooterContainer);
    }

    this._updateOptionsDisplay();
    this._updateLoadingDisplay();
    this._updateDisabledDisplay();
    this._updateFooterDisplay();
    this._updateFilterDisplay();
    // this.setValue(this.propOptions.value || "");
  }
}
