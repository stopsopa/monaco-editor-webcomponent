/**
 * Resizable center panel with optional left gutter and bottom height handle.
 *
 * Import this module to register the element (`customElements.define` at file bottom).
 * Before calling instance APIs from other modules, wait for registration:
 *
 *   await customElements.whenDefined(CenterAndHeightResizer.tagName);
 *
 * Before mounting layout-sensitive UI (e.g. Monaco) in slotted content, prefer:
 *
 *   await CenterAndHeightResizer.whenHostReady(container);
 *
 * @example HTML
 * ```html
 * <center-and-height-resizer left="50px" center="350px" height="200px" style="padding: 12px" data-test="idfortest">
 *   <div>Content</div>
 * </center-and-height-resizer>
 * ```
 *
 * @example JS
 * ```js
 * import { CenterAndHeightResizer } from "./CenterAndHeightResizer.js";
 *
 * await customElements.whenDefined(CenterAndHeightResizer.tagName);
 *
 * const resizer = document.querySelector(CenterAndHeightResizer.tagName);
 * resizer.addEventListener("onLeft", (e) => console.log(e.detail.width));
 * resizer.addEventListener("onCenter", (e) => console.log(e.detail.width));
 * resizer.addEventListener("onHeight", (e) => console.log(e.detail.height));
 * // fired once when a drag gesture ends - the right moment to persist the size (URL, storage, ...)
 * resizer.addEventListener("onResizeEnd", (e) => console.log(e.detail)); // { left, center, height }
 * ```
 *
 * The handles use pointer events (mouse, touch, pen) with pointer capture, so a drag cannot get "stuck"
 * when the pointer is released outside the window.
 */
const SKIP_ATTRIBUTES = ["id", "class", "left", "center", "height", "style"];

export class CenterAndHeightResizer extends HTMLElement {
  static readonly tagName = "center-and-height-resizer" as const;

  leftDiv!: HTMLElement;
  rightDiv!: HTMLElement;
  centerDiv!: HTMLElement;
  resizerLeft!: HTMLElement;
  resizerRight!: HTMLElement;
  resizerBottom!: HTMLElement;

  private _isReady = false;
  private readonly _readyPromise: Promise<void>;
  private _resolveReady!: () => void;
  /** Handles get their listeners exactly once, no matter how often the element is re-attached. */
  private _initialised = false;
  private _forwardingObserver: MutationObserver | null = null;
  /** Attribute names currently mirrored onto the inner panel, so removed ones can be removed there too. */
  private _forwardedAttributes = new Set<string>();

  constructor() {
    super();
    this._readyPromise = new Promise<void>((resolve) => {
      this._resolveReady = resolve;
    });
    this.attachShadow({ mode: "open" });

    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          padding: 0 !important;
        }
        .flex {
          display: flex;
          width: 100%;
          align-items: stretch;
        }
        .center-column {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .center-div {
          flex-grow: 1;
          min-width: 0;
          box-sizing: border-box;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.1);
          background: #fff;
          border-radius: 6px;
          overflow: auto;
          min-height: 50px;
          border: 1px solid #eaeaea;
        }
        .side-div {
          flex-shrink: 0;
          box-sizing: border-box;
        }
        #right-div {
          flex-grow: 1;
        }
        .resizer {
          flex-shrink: 0;
          transition: background 0.2s;
          user-select: none;
          touch-action: none;
          position: relative;
        }
        .resizer.horizontal {
          width: 8px;
          cursor: col-resize;
        }
        .resizer.vertical {
          height: 8px;
          cursor: row-resize;
          width: 100%;
        }
        .resizer:hover,
        .resizer.active {
          background: rgba(26, 115, 232, 0.12);
        }
        .resizer::after {
          content: "";
          position: absolute;
          background: #ccc;
          transition: background 0.2s;
        }
        .resizer.horizontal::after {
          left: 50%;
          top: 0;
          bottom: 0;
          width: 14px;
          transform: translateX(-50%);
        }
        .resizer.vertical::after {
          top: 50%;
          left: 0;
          right: 0;
          height: 14px;
          transform: translateY(-50%);
        }
        .resizer:hover::after,
        .resizer.active::after {
          background: #1a73e8;
        }
        
        #resizer-left {
          margin-right: 5px;
        }
        #resizer-right {
          margin-left: 5px;
        }
        #resizer-bottom {
          margin-top: 5px;
        }
      </style>
      <div class="flex">
        <div class="side-div" id="left-div"></div>
        <div class="resizer horizontal" id="resizer-left" role="separator" aria-orientation="vertical"></div>
        <div class="center-column">
          <div class="center-div" id="center-div">
            <slot></slot>
          </div>
          <div class="resizer vertical" id="resizer-bottom" role="separator" aria-orientation="horizontal"></div>
        </div>
        <div class="resizer horizontal" id="resizer-right" role="separator" aria-orientation="vertical"></div>
        <div class="side-div" id="right-div"></div>
      </div>
    `;
  }

  static get observedAttributes() {
    return SKIP_ATTRIBUTES.filter((attr) => !["id", "class"].includes(attr));
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;
    if (!this.leftDiv) return; // Not connected yet

    // A removed attribute (null) clears the inline size.
    const value = newValue ?? "";

    switch (name) {
      case "left":
        this.leftDiv.style.width = value;
        break;
      case "center":
        this.centerDiv.style.width = value;
        break;
      case "height":
        this.centerDiv.style.height = value;
        break;
      case "style":
        this.centerDiv.style.cssText = value;
        this._applyInternalStylesToCenterDiv();
        break;
    }
  }

  connectedCallback() {
    if (!this._initialised) {
      this._initialised = true;

      this.leftDiv = this.shadowRoot!.getElementById("left-div") as HTMLElement;
      this.rightDiv = this.shadowRoot!.getElementById("right-div") as HTMLElement;
      this.centerDiv = this.shadowRoot!.getElementById("center-div") as HTMLElement;
      this.resizerLeft = this.shadowRoot!.getElementById("resizer-left") as HTMLElement;
      this.resizerRight = this.shadowRoot!.getElementById("resizer-right") as HTMLElement;
      this.resizerBottom = this.shadowRoot!.getElementById("resizer-bottom") as HTMLElement;

      this.setupResizer(this.resizerLeft, this.leftDiv, "left", false);
      this.setupResizer(this.resizerRight, this.centerDiv, "center", false);
      this.setupHeightResizer(this.resizerBottom, this.centerDiv);
    }

    const attrLeft = this.getAttribute("left");
    const attrCenter = this.getAttribute("center");
    const attrHeight = this.getAttribute("height");

    if (attrLeft) {
      this.leftDiv.style.width = attrLeft;
    }

    if (attrCenter) {
      this.centerDiv.style.width = attrCenter;
    }

    if (attrHeight) {
      this.centerDiv.style.height = attrHeight;
    }

    this._initForwarding();

    this._isReady = true;
    this._resolveReady();
  }

  disconnectedCallback() {
    this._forwardingObserver?.disconnect();
    this._forwardingObserver = null;
  }

  /** Resolves after the first `connectedCallback` (attributes applied to the layout panel). */
  whenReady(): Promise<void> {
    return this._isReady ? Promise.resolve() : this._readyPromise;
  }

  static whenLayoutReady(el: HTMLElement, maxFrames = 120): Promise<void> {
    return new Promise((resolve, reject) => {
      let frames = 0;
      const tick = (): void => {
        const { width, height } = el.getBoundingClientRect();
        if (width > 0 && height > 0) {
          resolve();
          return;
        }
        if (++frames >= maxFrames) {
          reject(new Error("Layout root did not obtain non-zero dimensions"));
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  /** Wait for custom element upgrade, `connectedCallback`, and a non-zero layout panel. */
  static async whenHostReady(container: HTMLElement): Promise<HTMLElement> {
    await customElements.whenDefined(CenterAndHeightResizer.tagName);
    const resizer = container.closest(CenterAndHeightResizer.tagName) as CenterAndHeightResizer | null;
    if (resizer) {
      await resizer.whenReady();
    }
    const layoutRoot = resizer?.getContentRoot() ?? container;
    await CenterAndHeightResizer.whenLayoutReady(layoutRoot);
    return layoutRoot;
  }

  _applyInternalStylesToCenterDiv() {
    const center = this.getAttribute("center");
    if (center) this.centerDiv.style.width = center;
    const height = this.getAttribute("height");
    if (height) this.centerDiv.style.height = height;
  }

  _initForwarding() {
    this._forwardingObserver?.disconnect();

    const observer = new MutationObserver((mutations) => {
      let syncNeeded = false;
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          if (!SKIP_ATTRIBUTES.includes(mutation.attributeName!)) {
            syncNeeded = true;
            break;
          }
        }
      }
      if (syncNeeded) this._syncAttributes();
    });
    observer.observe(this, { attributes: true });
    this._forwardingObserver = observer;
    this._syncAttributes();
  }

  _syncAttributes() {
    const present = new Set<string>();

    for (const attr of Array.from(this.attributes)) {
      if (SKIP_ATTRIBUTES.includes(attr.name)) continue;
      present.add(attr.name);
      this.centerDiv.setAttribute(attr.name, attr.value);
    }

    // mirror removals: what was forwarded before and is gone from the host goes from the panel too
    for (const name of this._forwardedAttributes) {
      if (!present.has(name)) this.centerDiv.removeAttribute(name);
    }
    this._forwardedAttributes = present;

    if (this.hasAttribute("style")) {
      this.centerDiv.style.cssText = this.getAttribute("style") || "";
      this._applyInternalStylesToCenterDiv();
    }
  }

  getContentRoot(): HTMLElement {
    return this.centerDiv || (this.shadowRoot!.getElementById("center-div") as HTMLElement);
  }

  /**
   * Shared drag handling for all three handles. Pointer events + pointer capture: works with mouse,
   * touch and pen, and `pointerup` / `pointercancel` always arrive at the handle - also when the pointer
   * was released outside the window.
   */
  private _setupDrag(handle: HTMLElement, onStart: (e: PointerEvent) => (moveEvent: PointerEvent) => void) {
    handle.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      handle.classList.add("active");
      handle.setPointerCapture(e.pointerId);

      const onMove = onStart(e);

      const onEnd = () => {
        handle.classList.remove("active");
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onEnd);
        handle.removeEventListener("pointercancel", onEnd);
        if (handle.hasPointerCapture(e.pointerId)) {
          handle.releasePointerCapture(e.pointerId);
        }

        this.dispatchEvent(
          new CustomEvent("onResizeEnd", {
            detail: {
              left: this.getAttribute("left"),
              center: this.getAttribute("center"),
              height: this.getAttribute("height"),
            },
          }),
        );
      };

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onEnd);
      handle.addEventListener("pointercancel", onEnd);
    });
  }

  setupResizer(handle: HTMLElement, target: HTMLElement, attrName: string, invert: boolean) {
    this._setupDrag(handle, (e) => {
      const startX = e.clientX;
      const startWidth = target.offsetWidth;

      return (moveEvent) => {
        let diff = moveEvent.clientX - startX;
        if (invert) diff = -diff;
        let newWidth = startWidth + diff;
        newWidth = Math.max(0, newWidth);
        target.style.width = newWidth + "px";

        this.setAttribute(attrName, newWidth + "px");
        const eventName = attrName === "left" ? "onLeft" : "onCenter";
        this.dispatchEvent(new CustomEvent(eventName, { detail: { width: newWidth } }));
      };
    });
  }

  setupHeightResizer(handle: HTMLElement, target: HTMLElement) {
    this._setupDrag(handle, (e) => {
      const startY = e.clientY;
      const startHeight = target.offsetHeight;

      return (moveEvent) => {
        const diff = moveEvent.clientY - startY;
        let newHeight = startHeight + diff;
        newHeight = Math.max(0, newHeight);
        target.style.height = newHeight + "px";

        this.setAttribute("height", newHeight + "px");
        this.dispatchEvent(new CustomEvent("onHeight", { detail: { height: newHeight } }));
      };
    });
  }
}

// Several builds of this file can end up on one page; defining the same tag twice would throw.
if (!customElements.get(CenterAndHeightResizer.tagName)) {
  customElements.define(CenterAndHeightResizer.tagName, CenterAndHeightResizer);
}
