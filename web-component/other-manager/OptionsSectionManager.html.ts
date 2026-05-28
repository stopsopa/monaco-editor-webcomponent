import "../CenterAndHeightResizer.js";
import { OptionsSectionManager } from "./OptionsSectionManager.js";
import { urlStateConfig, getNextId, setNextId } from "./urlManager.js";
import { getSafeFreeOffset } from "../composite-select/namesSource.js";
import type { OptionItem, DemoState } from "./urlManager.js";

const reloadLink = document.getElementById("reload-link") as HTMLAnchorElement | null;
if (reloadLink) {
  reloadLink.href = window.location.pathname;
}

let instanceCounter = 0;

const updateUrlDisplay = (url: string = window.location.href) => {
  const el = document.getElementById("url-display");
  if (el) el.textContent = url;
};

const init = (initialOptions: OptionItem[] = [], states: Partial<DemoState> = {}) => {
  instanceCounter++;
  const id = instanceCounter;

  const resizerLeft = states.left || "50px";
  const resizerCenter = states.center || "350px";
  const resizerHeight = states.height || "";

  const section = document.createElement("div");
  section.className = "demo-section";
  section.innerHTML = `
    <h2>Instance #${id}</h2>
    <button class="gcp-css white destroy-btn" data-role="destroy">Destroy</button>

    <div class="resizer-container">
      <center-and-height-resizer data-role="resizer" left="${resizerLeft}" center="${resizerCenter}" ${resizerHeight ? `height="${resizerHeight}"` : ""}>
        <div data-role="container" style="height: 100%;"></div>
      </center-and-height-resizer>
    </div>

    <div class="controls gcp-css" style="margin-bottom: 8px;">
      <div class="controls-label">OptionsSectionManager</div>

      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <div class="gcp-css checkbox-wrapper">
          <div class="checkbox-row">
            <input type="checkbox" id="disabled-opt-${id}" data-role="disabled-opt" ${states.disabled ? "checked" : ""}>
            <div class="content-cell"><label for="disabled-opt-${id}">Disabled</label></div>
          </div>
        </div>

        <div class="gcp-css checkbox-wrapper">
          <div class="checkbox-row">
            <input type="checkbox" id="loading-opt-${id}" data-role="loading-opt" ${states.loading ? "checked" : ""}>
            <div class="content-cell"><label for="loading-opt-${id}">Loading</label></div>
          </div>
        </div>

        <div class="gcp-css checkbox-wrapper">
          <div class="checkbox-row">
            <input type="checkbox" id="footer-opt-${id}" data-role="footer-opt" ${states.setShowFooter !== false ? "checked" : ""}>
            <div class="content-cell"><label for="footer-opt-${id}">Show Footer</label></div>
          </div>
        </div>

        <div class="gcp-css checkbox-wrapper">
          <div class="checkbox-row">
            <input type="checkbox" id="filter-opt-${id}" data-role="filter-opt" ${states.setShowFilter !== false ? "checked" : ""}>
            <div class="content-cell"><label for="filter-opt-${id}">Show Filter</label></div>
          </div>
        </div>

        <div class="gcp-css checkbox-wrapper">
          <div class="checkbox-row">
            <input type="checkbox" id="empty-list-${id}" data-role="empty-list-cb" ${states.emptyList ? "checked" : ""}>
            <div class="content-cell"><label for="empty-list-${id}">Empty list (sim search)</label></div>
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;">
        <div class="gcp-css input-wrapper">
          <input type="text" id="label-input-opt-${id}" data-role="label-input-opt" placeholder="&nbsp;" value="${states.label || ""}">
          <label for="label-input-opt-${id}">Label</label>
        </div>
        <div class="gcp-css input-wrapper">
          <input type="text" id="value-input-opt-${id}" data-role="value-input-opt" placeholder="&nbsp;" value="${states.value || ""}">
          <label for="value-input-opt-${id}">Value</label>
        </div>
        <button class="gcp-css white" data-role="focus-btn">Focus</button>
        <button class="gcp-css white" data-role="add-btn">Add Random</button>
        <button class="gcp-css white" data-role="clear-btn">Clear All</button>
      </div>

      <div style="display: flex; gap: 5px; align-items: center; width: 100%; margin-top: 10px; flex-wrap: wrap;">
        <span style="min-width: 120px;">📏 <strong>Max Height</strong>:</span>
        <div style="display: flex; gap: 2px;">
          <button class="gcp-css white" data-role="mh-down" style="padding: 0 8px; min-width: auto;">▼</button>
          <div class="gcp-css input-wrapper" style="max-width: 100px; margin-bottom: 0;">
            <input type="text" id="mh-input-${id}" data-role="mh-input" placeholder="&nbsp;" value="${states.maxHeight || ""}">
            <label for="mh-input-${id}">Height</label>
          </div>
          <button class="gcp-css white" data-role="mh-up" style="padding: 0 8px; min-width: auto;">▲</button>
        </div>
        <button class="gcp-css white" data-role="mh-set-btn">Set</button>
        <button class="gcp-css white" data-role="mh-preset" data-value="200px">200px</button>
        <button class="gcp-css white" data-role="mh-preset" data-value="300px">300px</button>
        <button class="gcp-css white" data-role="mh-preset" data-value="400px">400px</button>
        <button class="gcp-css white" data-role="mh-preset" data-value="600px">600px</button>
        <button class="gcp-css white" data-role="mh-preset" data-value="" data-reset>Reset</button>
      </div>

      <div style="display: flex; gap: 5px; align-items: center; width: 100%; margin-top: 10px; flex-wrap: wrap;">
        <span style="min-width: 120px;">🎨 <strong>Render</strong>:</span>
        <button class="gcp-css white" data-role="opt-render-btn">Set Custom Render</button>
        <button class="gcp-css white" data-role="opt-string-render-btn">Set String Render</button>
        <button class="gcp-css white" data-role="opt-default-render-btn">Set Default Render</button>
        <button class="gcp-css white" data-role="opt-empty-btn">Set Custom Empty</button>
        <button class="gcp-css white" data-role="opt-default-empty-btn">Set Default Empty</button>
      </div>

      <div style="width: 100%; margin-top: 10px;">
        (onInputChange triggers: <span data-role="onchange-count" style="font-weight: bold;">0</span>,
        onItemPick: <span data-role="onpick-count" style="font-weight: bold;">0</span>,
        onOk: <span data-role="onok-count" style="font-weight: bold;">0</span>,
        onCancel: <span data-role="oncancel-count" style="font-weight: bold;">0</span>,
        onHighlightChange: <span data-role="onhighlight-count" style="font-weight: bold;">0</span>)
      </div>
    </div>

    <pre data-role="dump" style="background:#f8f8f8;padding:10px;border:1px solid #eee;border-radius:4px;font-size:12px;margin:0;overflow:auto;"></pre>
  `;

  const instancesArea = document.getElementById("instances-area");
  instancesArea?.appendChild(section);

  const container = section.querySelector('[data-role="container"]') as HTMLDivElement;
  const resizer = section.querySelector('[data-role="resizer"]') as HTMLElement;
  const destroyBtn = section.querySelector('[data-role="destroy"]') as HTMLButtonElement;
  const dump = section.querySelector('[data-role="dump"]') as HTMLElement;

  const disabledOptCb = section.querySelector('[data-role="disabled-opt"]') as HTMLInputElement;
  const loadingOptCb = section.querySelector('[data-role="loading-opt"]') as HTMLInputElement;
  const footerOptCb = section.querySelector('[data-role="footer-opt"]') as HTMLInputElement;
  const filterOptCb = section.querySelector('[data-role="filter-opt"]') as HTMLInputElement;
  const emptyListCb = section.querySelector('[data-role="empty-list-cb"]') as HTMLInputElement;

  const labelInputOpt = section.querySelector('[data-role="label-input-opt"]') as HTMLInputElement;
  const valueInputOpt = section.querySelector('[data-role="value-input-opt"]') as HTMLInputElement;
  const focusBtn = section.querySelector('[data-role="focus-btn"]') as HTMLButtonElement;
  const addBtn = section.querySelector('[data-role="add-btn"]') as HTMLButtonElement;
  const clearBtn = section.querySelector('[data-role="clear-btn"]') as HTMLButtonElement;

  const mhInput = section.querySelector('[data-role="mh-input"]') as HTMLInputElement;
  const mhSetBtn = section.querySelector('[data-role="mh-set-btn"]') as HTMLButtonElement;
  const mhUp = section.querySelector('[data-role="mh-up"]') as HTMLButtonElement;
  const mhDown = section.querySelector('[data-role="mh-down"]') as HTMLButtonElement;

  const optRenderBtn = section.querySelector('[data-role="opt-render-btn"]') as HTMLButtonElement;
  const optStringRenderBtn = section.querySelector('[data-role="opt-string-render-btn"]') as HTMLButtonElement;
  const optDefaultRenderBtn = section.querySelector('[data-role="opt-default-render-btn"]') as HTMLButtonElement;
  const optEmptyBtn = section.querySelector('[data-role="opt-empty-btn"]') as HTMLButtonElement;
  const optDefaultEmptyBtn = section.querySelector('[data-role="opt-default-empty-btn"]') as HTMLButtonElement;

  const inc = (role: string) => {
    const el = section.querySelector(`[data-role="${role}"]`);
    if (el) {
      el.textContent = String(parseInt(el.textContent || "0", 10) + 1);
    }
  };

  const updateDump = (options: OptionItem[]) => {
    dump.textContent = JSON.stringify(options.filter((o) => o.selected), null, 2);
  };

  let mgr: OptionsSectionManager<OptionItem>;

  const syncUrl = () => {
    const url = new URL(window.location.href);
    urlStateConfig.toUrl(url, id, {
      options: mgr.getOptions(),
      left: resizer.getAttribute("left") || "50px",
      center: resizer.getAttribute("center") || "350px",
      height: resizer.getAttribute("height") || "",
      disabled: disabledOptCb.checked,
      loading: loadingOptCb.checked,
      setShowFooter: footerOptCb.checked,
      setShowFilter: filterOptCb.checked,
      emptyList: emptyListCb.checked,
      label: labelInputOpt.value || "",
      value: valueInputOpt.value || "",
      maxHeight: mhInput.value || "",
      highlight: String(mgr.propHighlightedId || ""),
    });
    window.history.replaceState({}, "", url);
    updateUrlDisplay(url.toString());
  };

  mgr = new OptionsSectionManager<OptionItem>(container, {
    options: initialOptions,
    loading: !!states.loading,
    disabled: !!states.disabled,
    showFooter: states.setShowFooter !== false,
    showFilter: states.setShowFilter !== false,
    label: states.label || "Search...",
    value: states.value || "",
    maxHeight: states.maxHeight || "",
    onInputChange: (e) => {
      inc("onchange-count");
      valueInputOpt.value = e.target.value;
      syncUrl();
    },
    onItemPick: (item) => {
      inc("onpick-count");
      const nextOptions = mgr.getOptions().map((o) => {
        if (String(o.id) === String(item.id)) return { ...o, selected: !o.selected };
        return o;
      });
      mgr.setOptions(nextOptions);
      updateDump(nextOptions);
      syncUrl();
    },
    onCancel: () => inc("oncancel-count"),
    onOk: () => inc("onok-count"),
    onHighlightChange: (id) => {
      inc("onhighlight-count");
      syncUrl();
    },
    onComponentChange: (opt) => {
      disabledOptCb.checked = !!opt.disabled;
      loadingOptCb.checked = !!opt.loading;
      footerOptCb.checked = opt.showFooter !== false;
      filterOptCb.checked = opt.showFilter !== false;
      labelInputOpt.value = opt.label || "";
      valueInputOpt.value = opt.value || "";
      mhInput.value = opt.maxHeight || "";
    },
  });

  updateDump(mgr.getOptions());

  disabledOptCb.addEventListener("change", () => {
    mgr.setDisabled(disabledOptCb.checked);
    syncUrl();
  });

  loadingOptCb.addEventListener("change", () => {
    mgr.setLoading(loadingOptCb.checked);
    syncUrl();
  });

  footerOptCb.addEventListener("change", () => {
    mgr.setShowFooter(footerOptCb.checked);
    syncUrl();
  });

  filterOptCb.addEventListener("change", () => {
    mgr.setShowFilter(filterOptCb.checked);
    syncUrl();
  });

  let savedOptions = mgr.getOptions();
  emptyListCb.addEventListener("change", () => {
    if (emptyListCb.checked) {
      savedOptions = mgr.getOptions();
      mgr.setOptions([]);
    } else {
      mgr.setOptions(savedOptions);
    }
    syncUrl();
  });

  labelInputOpt.addEventListener("input", () => {
    mgr.setLabel(labelInputOpt.value);
    syncUrl();
  });

  valueInputOpt.addEventListener("input", () => {
    mgr.setValue(valueInputOpt.value);
    syncUrl();
  });

  focusBtn.addEventListener("click", () => mgr.setFocus());

  addBtn.addEventListener("click", () => {
    const id = getNextId();
    setNextId(id + 1);
    const next = [...mgr.getOptions(), { id, label: `Option ${id}` }];
    mgr.setOptions(next);
    syncUrl();
  });

  clearBtn.addEventListener("click", () => {
    mgr.setOptions([]);
    syncUrl();
  });

  const setMH = (val: string) => {
    mhInput.value = val;
    mgr.setMaxHeight(val);
    syncUrl();
  };

  mhSetBtn.addEventListener("click", () => setMH(mhInput.value));
  mhUp.addEventListener("click", () => {
    const val = parseInt(mhInput.value) || 200;
    setMH(val + 10 + "px");
  });
  mhDown.addEventListener("click", () => {
    const val = parseInt(mhInput.value) || 200;
    setMH(Math.max(0, val - 10) + "px");
  });

  section.querySelectorAll('[data-role="mh-preset"]').forEach((btn) => {
    btn.addEventListener("click", () => setMH((btn as HTMLElement).dataset.value || ""));
  });

  optRenderBtn.addEventListener("click", () => {
    mgr.setRenderItem((item) => {
      const el = document.createElement("div");
      el.className = "element";
      el.dataset.id = String(item.id);
      el.style.padding = "8px";
      el.style.borderLeft = item.selected ? "4px solid orange" : "4px solid transparent";
      el.innerHTML = `<strong>${item.label}</strong> ${item.selected ? "✅" : ""}`;
      return el;
    });
  });

  optStringRenderBtn.addEventListener("click", () => {
    mgr.setRenderItem((item) => `<div class="element" data-id="${item.id}" style="color: blue;">STRING: ${item.label}</div>`);
  });

  optDefaultRenderBtn.addEventListener("click", () => {
    mgr.setRenderItem();
  });

  optEmptyBtn.addEventListener("click", () => {
    mgr.setRenderEmpty(() => `<div style="color: red; padding: 20px;">NOTHING FOUND!</div>`);
  });

  optDefaultEmptyBtn.addEventListener("click", () => {
    mgr.setRenderEmpty();
  });

  resizer.addEventListener("onLeft", () => syncUrl());
  resizer.addEventListener("onCenter", () => syncUrl());
  resizer.addEventListener("onHeight", () => syncUrl());

  destroyBtn.addEventListener("click", () => {
    mgr.destroy();
    section.remove();
  });

  if (states.highlight) {
    mgr.highlightAndScrollToElementOnTheList(states.highlight);
  }

  return mgr;
};

const initBtn = document.getElementById("init-btn");
if (initBtn) {
  initBtn.addEventListener("click", () => {
    init([
      { id: 101, label: "Option A" },
      { id: 102, label: "Option B", selected: true },
      { id: 103, label: "Option C" },
    ]);
  });
}

const loadFromUrl = () => {
  const instancesArea = document.getElementById("instances-area");
  if (instancesArea) {
    instancesArea.innerHTML = "";
  }
  instanceCounter = 0;
  setNextId(getSafeFreeOffset());

  const urlParams = new URLSearchParams(window.location.search);
  const allIds = urlStateConfig.getAllIds(urlParams);

  if (allIds.length === 0) {
    init([
      { id: 1, label: "Initial Option 1" },
      { id: 2, label: "Initial Option 2" },
    ], {});
  } else {
    allIds.forEach((id) => {
      const state = urlStateConfig.fromUrl(urlParams, id);
      if (state.options) {
        state.options.forEach((o) => {
          const numId = typeof o.id === "number" ? o.id : parseInt(String(o.id), 10);
          if (!isNaN(numId) && numId >= getNextId()) setNextId(numId + 1);
        });
      }
      init(state.options || [], state);
    });
  }

  updateUrlDisplay();
};

window.addEventListener("popstate", loadFromUrl);
loadFromUrl();

