/**
 *   <center-resizer
 *      left="50px"
 *      center="350px"
 *      style="padding: 12px;"
 *      data-test="idfortest"
 *   >
 *      <div>Content</div>
 *   </center-resizer>
 *
 *   const resizer = document.querySelector('center-resizer');
 *   resizer.addEventListener('onLeft', e => console.log(e.detail.width));
 *   resizer.addEventListener('onCenter', e => console.log(e.detail.width));
 *   // fired once when a drag gesture ends - the right moment to persist the size
 *   resizer.addEventListener('onResizeEnd', e => console.log(e.detail)); // { left, center }
 *
 * Width-only sibling of CenterAndHeightResizer.ts (same drag handling: pointer events + pointer capture).
 */
const SKIP_ATTRIBUTES = ["id", "class", "left", "center", "style"];

export class CenterResizer extends HTMLElement {
  leftDiv!: HTMLElement;
  centerDiv!: HTMLElement;
  rightDiv!: HTMLElement;
  resizerLeft!: HTMLElement;
  resizerRight!: HTMLElement;

  /** Handles get their listeners exactly once, no matter how often the element is re-attached. */
  private _initialised = false;
  private _forwardingObserver: MutationObserver | null = null;
  /** Attribute names currently mirrored onto the inner panel, so removed ones can be removed there too. */
  private _forwardedAttributes = new Set<string>();

  constructor() {
    super();
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
        .center-div {
          flex-shrink: 0;
          min-width: 0;
          padding-left: 15px;
          padding-right: 15px;
          box-sizing: border-box;
        }
        .side-div {
          flex-shrink: 0;
          box-sizing: border-box;
        }
        #right-div {
          flex-grow: 1;
        }
        .resizer {
          width: 8px;
          cursor: col-resize;
          flex-shrink: 0;
          transition: background 0.2s;
          user-select: none;
          touch-action: none;
          margin: 0 -4px;
          position: relative;
        }
        .resizer:hover,
        .resizer.active {
          background: rgba(26, 115, 232, 0.2);
        }
        .resizer::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          width: 2px;
          background: #ccc;
          transform: translateX(-50%);
        }
        .resizer:hover::after,
        .resizer.active::after {
          background: #1a73e8;
        }
      </style>
      <div class="flex">
        <div class="side-div" id="left-div"></div>
        <div class="resizer" id="resizer-left" role="separator" aria-orientation="vertical"></div>
        <div class="center-div" id="center-div">
          <slot></slot>
        </div>
        <div class="resizer" id="resizer-right" role="separator" aria-orientation="vertical"></div>
        <div class="side-div" id="right-div"></div>
      </div>
    `;
  }

  static get observedAttributes() {
    return SKIP_ATTRIBUTES.filter((attr) => !["id", "class"].includes(attr));
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;
    if (!this.centerDiv) return;

    // A removed attribute (null) clears the inline size.
    const value = newValue ?? "";

    switch (name) {
      case "left":
        this.leftDiv.style.width = value;
        break;
      case "center":
        this.centerDiv.style.width = value;
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
      this.centerDiv = this.shadowRoot!.getElementById("center-div") as HTMLElement;
      this.rightDiv = this.shadowRoot!.getElementById("right-div") as HTMLElement;
      this.resizerLeft = this.shadowRoot!.getElementById("resizer-left") as HTMLElement;
      this.resizerRight = this.shadowRoot!.getElementById("resizer-right") as HTMLElement;

      this.setupResizer(this.resizerLeft, this.leftDiv, "left");
      this.setupResizer(this.resizerRight, this.centerDiv, "center");
    }

    const attrLeft = this.getAttribute("left");
    const attrCenter = this.getAttribute("center");

    if (attrLeft) {
      this.leftDiv.style.width = attrLeft;
    }

    if (attrCenter) {
      this.centerDiv.style.width = attrCenter;
    }

    this._initForwarding();
  }

  disconnectedCallback() {
    this._forwardingObserver?.disconnect();
    this._forwardingObserver = null;
  }

  _applyInternalStylesToCenterDiv() {
    const center = this.getAttribute("center");
    if (center) this.centerDiv.style.width = center;
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

  setupResizer(handle: HTMLElement, target: HTMLElement, attributeName: "left" | "center") {
    handle.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      handle.classList.add("active");
      handle.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startWidth = target.offsetWidth;

      const onMove = (moveEvent: PointerEvent) => {
        const diff = moveEvent.clientX - startX;
        const newWidth = Math.max(0, startWidth + diff);
        target.style.width = newWidth + "px";

        if (attributeName === "center") {
          this.setAttribute("center", newWidth + "px");
          this.dispatchEvent(new CustomEvent("onCenter", { detail: { width: newWidth } }));
        } else {
          this.setAttribute("left", newWidth + "px");
          this.dispatchEvent(new CustomEvent("onLeft", { detail: { width: newWidth } }));
        }
      };

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
            detail: { left: this.getAttribute("left"), center: this.getAttribute("center") },
          }),
        );
      };

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onEnd);
      handle.addEventListener("pointercancel", onEnd);
    });
  }
}

// Several builds of this file can end up on one page; defining the same tag twice would throw.
if (!customElements.get("center-resizer")) {
  customElements.define("center-resizer", CenterResizer);
}
