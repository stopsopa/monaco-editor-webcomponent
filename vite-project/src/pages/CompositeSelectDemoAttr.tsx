import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, memo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { NavigateFunction } from "react-router-dom";
// import { CompositeSelect } from "composite-select/composite-select/react";
// import type { CompositeManager } from "composite-select";
import modURLSearchParams from "./params/modURLSearchParams.ts";

// import { CompositeSelect as CompositeSelectElement } from "composite-select/composite-select/composite-select";

// import type { PositionType } from "composite-select/container/ContainerManager";

// import "composite-select/floating-label-pattern.css";
// import "composite-select/composition/selected-section/SelectedSectionManager.css";
// import "composite-select/composition/options-section/OptionsSectionManager.css";

import type { Item } from "composite-select/types";

type CustomItem = Item & {
  color: string;
  img: string;
};

import {
  deduplicateArrayById,
  sortById,
  togglePresenceOnTheList,
  markSelectedByIds,
} from "composite-select/composite-select/helpers";
import debounce from "composite-select/composite-select/debounce";

import { searchNames as searchNamesOriginal } from "./namesSource";

function searchNames(name: string | undefined, num: number = 10): CustomItem[] {
  const found = searchNamesOriginal(name, num);
  return found.map((f) => ({
    ...f,
    color: "#4285f4",
    img: "google_drive.png",
  })) as CustomItem[];
}

const allScientists = searchNames("", Infinity);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const imgDataJson: Record<string, string[]> = {
  "#f44336": ["gmail.png", "youtube.png"],
  "#4285f4": ["google_drive.png", "google_calendar.png", "google_keep.png"],
  "#0f9d58": ["chatgpt.png", "claude.png", "gemini.png", "perplexity.png"],
  "#ff9800": ["tools.png", "timeanddate.png", "t3chat.png", "ai.png"],
};

const { useQueryParams, separateIndexedSearchParams } = modURLSearchParams(
  {
    selectedIds: {
      default: [] as string[],
      getParam: "s",
      encode: (value) => JSON.stringify(value),
      decode: (value) => {
        try {
          return JSON.parse(value);
        } catch {
          return [];
        }
      },
    },
    emptyList: {
      default: false,
      getParam: "emp",
      encode: (value) => (value ? "1" : "0"),
      decode: (value) => value === "1",
    },
    selectedValue: {
      default: "",
      getParam: "sv",
      encode: (value) => value,
      decode: (value) => value,
    },
    selectedLabel: {
      default: "selected label",
      getParam: "sla",
      encode: (value) => value,
      decode: (value) => value,
    },
    selectedDisabled: {
      default: false,
      getParam: "sd",
      encode: (value) => (value ? "1" : "0"),
      decode: (value) => value === "1",
    },
    selectedError: {
      default: false,
      getParam: "se",
      encode: (value) => (value ? "1" : "0"),
      decode: (value) => value === "1",
    },
    selectedLoading: {
      default: false,
      getParam: "slo",
      encode: (value) => (value ? "1" : "0"),
      decode: (value) => value === "1",
    },
    selectedShowInput: {
      default: true,
      getParam: "ssi",
      encode: (value) => (value ? "1" : "0"),
      decode: (value) => value === "1",
    },
    optionsDisabled: {
      default: false,
      getParam: "od",
      encode: (value) => (value ? "1" : "0"),
      decode: (value) => value === "1",
    },
    optionsLoading: {
      default: false,
      getParam: "ol",
      encode: (value) => (value ? "1" : "0"),
      decode: (value) => value === "1",
    },
    optionsShowFilter: {
      default: true,
      getParam: "sf",
      encode: (value) => (value ? "1" : "0"),
      decode: (value) => value === "1",
    },
    optionsShowFooter: {
      default: true,
      getParam: "sfo",
      encode: (value) => (value ? "1" : "0"),
      decode: (value) => value === "1",
    },
    optionsPosition: {
      default: "cover-bottom" as PositionType,
      getParam: "op",
      encode: (value) => value,
      decode: (value) => value as PositionType,
    },
    optionsLabel: {
      default: "options label",
      getParam: "ola",
      encode: (value) => value,
      decode: (value) => value,
    },
    activeTemplates: {
      default: [] as string[],
      getParam: "t",
      encode: (value) => JSON.stringify(value),
      decode: (value) => {
        try {
          return JSON.parse(value);
        } catch {
          return [];
        }
      },
    },
    optionsRender: {
      default: "default" as "default" | "custom" | "string",
      getParam: "or",
      encode: (value) => value,
      decode: (value) => value as "default" | "custom" | "string",
    },
    optionsCustomEmpty: {
      default: false,
      getParam: "oce",
      encode: (value) => (value ? "1" : "0"),
      decode: (value) => value === "1",
    },
    optionsMaxHeight: {
      default: "300px",
      getParam: "omh",
      encode: (value) => value,
      decode: (value) => value,
    },
  },
  (key, i?: number) => `${key}-${i}`,
);

export default function CompositeSelectDemo() {
  const location = useLocation();
  const navigate = useNavigate();

  const instances = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const indexes = new Set<number>();
    params.forEach((_, key) => {
      const match = key.match(/-(\d+)$/);
      if (match) {
        indexes.add(parseInt(match[1], 10));
      }
    });
    const parsed = Array.from(indexes).sort((a, b) => a - b);
    return parsed.length > 0 ? parsed : [1];
  }, [location.search]);

  const addInstance = useCallback(() => {
    const nextIndex = instances.length > 0 ? Math.max(...instances) + 1 : 1;
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.set(`sv-${nextIndex}`, "default value");
    navigate({ search: currentParams.toString() }, { replace: true });
  }, [instances, navigate]);

  const removeInstance = useCallback(
    (id: number) => {
      const nextSearchParams = new URLSearchParams(window.location.search);
      const childParams = separateIndexedSearchParams(nextSearchParams, id);
      let changed = false;
      childParams.forEach((_, key) => {
        nextSearchParams.delete(key);
        changed = true;
      });

      if (changed) {
        navigate({ search: nextSearchParams.toString() }, { replace: true });
      }
    },
    [navigate],
  );

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <Link to="/" style={{ marginRight: "15px" }} className="gcp-css">
        &larr; Back to Home
      </Link>
      <button onClick={addInstance} className="gcp-css">
        Initialize New Instance
      </button>
      <span style={{ padding: "0 10px" }}>|</span>
      <a href={window.location.href.split("?")[0]} className="gcp-css">
        off
      </a>
      <span style={{ padding: "0 10px" }}>|</span>
      <a href="./" className="gcp-css">
        up ..
      </a>
      <span style={{ padding: "0 10px" }}>|</span>
      <a
        href="https://github.com/stopsopa/select-component/blob/main/vite-project/src/pages/CompositeSelectDemo.tsx"
        className="gcp-css"
      >
        source
      </a>
      <div style={{ display: "flex", flexDirection: "column", gap: "30px", marginTop: "20px" }}>
        {instances.map((id) => {
          const search = separateIndexedSearchParams(location.search, id).toString();
          return <DemoInstance key={id} id={id} search={search} navigate={navigate} onRemove={removeInstance} />;
        })}
      </div>
      <hr />
    </div>
  );
}

const DemoInstance = memo(function DemoInstance({
  id,
  search,
  navigate,
  onRemove,
}: {
  id: number;
  search: string;
  navigate: NavigateFunction;
  onRemove: (id: number) => void;
}) {
  const csRef = useRef<CompositeSelectElement<CustomItem>>(null);

  const [onChangeCount, setOnChangeCount] = useState(0);
  const [onFocusCount, setOnFocusCount] = useState(0);
  const [onDeleteCount, setOnDeleteCount] = useState(0);
  const [onClearCount, setOnClearCount] = useState(0);
  const [onInputChangeCount, setOnInputChangeCount] = useState(0);
  const [onOkCount, setOnOkCount] = useState(0);
  const [onCancelCount, setOnCancelCount] = useState(0);
  const [onItemPickCount, setOnItemPickCount] = useState(0);
  const [onCloseCount, setOnCloseCount] = useState(0);
  const [handleSelectedItemsChangedCount, setHandleSelectedItemsChangedCount] = useState(0);
  const [handleOptionsChangedCount, setHandleOptionsChangedCount] = useState(0);

  const [options, setOptions] = useState<CustomItem[]>([]);
  const [showDeleteSel, setShowDeleteSel] = useState(true);

  // Hook managing all URL states under this specific instance id suffix
  const { params, updatedURLSearchParams, setParam, setParams } = useQueryParams(search, navigate, id);

  console.log(`DemoInstance render ${id} >${updatedURLSearchParams}<`);

  const {
    selectedIds,
    emptyList,
    selectedValue,
    selectedLabel,
    selectedDisabled,
    selectedError,
    selectedLoading,
    selectedShowInput,
    optionsDisabled,
    optionsLoading,
    optionsShowFilter,
    optionsShowFooter,
    optionsPosition,
    optionsLabel,
    activeTemplates,
    optionsRender,
    optionsCustomEmpty,
    optionsMaxHeight,
  } = params;

  const customRenderItem = activeTemplates.includes("item");
  const customRenderList = activeTemplates.includes("list");

  const stepMaxHeight = (delta: number) => {
    let current = parseInt(optionsMaxHeight || "") || 0;
    current += delta;
    if (current < 0) current = 0;
    setParam("optionsMaxHeight", current + "px");
  };

  // Derive selectedItems by rehydrating the selectedIds (scientists and template items)
  const selectedItems = useMemo(() => {
    return selectedIds
      .map((idStr) => {
        if (idStr.includes(".")) {
          let itemColor = "#999";
          for (const [color, imgs] of Object.entries(imgDataJson)) {
            if (imgs.includes(idStr)) {
              itemColor = color;
              break;
            }
          }
          return {
            id: idStr,
            label: idStr.split(".")[0],
            color: itemColor,
            img: idStr,
          } as unknown as CustomItem;
        }
        return allScientists.find((s) => String(s.id) === idStr);
      })
      .filter(Boolean) as CustomItem[];
  }, [selectedIds]);

  const setSelectedItems = useCallback(
    (items: CustomItem[]) => {
      setParam(
        "selectedIds",
        items.map((i) => String(i.id)),
      );
    },
    [setParam],
  );

  const getManager = () => csRef.current?.getManager();

  function localDetermineSearch(mgr: CompositeManager<CustomItem>): { search: string; popupInput: boolean } {
    const setShowFilter = mgr.options.getShowFilter();
    const position = mgr.container.getPosition();
    if (!setShowFilter && position === "bottom") {
      return { search: mgr.selected.getValue() || "", popupInput: false };
    }
    return { search: mgr.options.getValue() || "", popupInput: true };
  }

  const updateCheckmarks = (currentSelected: CustomItem[]) => {
    setOptions(
      (prevOptions) =>
        markSelectedByIds(prevOptions, currentSelected.map((i) => i.id) as unknown as number[]) as CustomItem[],
    );
  };

  const fetchOptions = useCallback(
    async (search: string, currentSelected: CustomItem[] = selectedItems, overrideEmptyList?: boolean) => {
      setParams({
        optionsLoading: true,
        optionsDisabled: true,
        selectedLoading: true,
        selectedDisabled: true,
      });

      await delay(500);

      const isCurrentlyEmpty = overrideEmptyList !== undefined ? overrideEmptyList : emptyList;
      const found = isCurrentlyEmpty ? [] : deduplicateArrayById<CustomItem>(searchNames(search));
      const opts = markSelectedByIds(found, currentSelected.map((i) => i.id) as unknown as number[]) as CustomItem[];
      setOptions(sortById(opts) as CustomItem[]);

      setParams({
        optionsDisabled: false,
        optionsLoading: false,
        selectedDisabled: false,
        selectedLoading: false,
      });
    },
    [emptyList, selectedItems, setParams, setOptions],
  );

  const handleFocus = () => {
    setOnFocusCount((prev) => prev + 1);
    const mgr = getManager();
    if (mgr) {
      const { search } = localDetermineSearch(mgr);
      const selIds = selectedItems.map((i) => i.id);
      const combined = emptyList ? [] : searchNames(search);
      const opts = markSelectedByIds(combined, selIds) as CustomItem[];
      setOptions(sortById(opts) as CustomItem[]);
      setShowDeleteSel(false);
    }
  };

  const handleDelete = (idStr: string) => {
    setOnDeleteCount((prev) => prev + 1);
    const newSelected = selectedItems.filter((i) => String(i.id) !== String(idStr));
    setSelectedItems(newSelected);
  };

  // Keep everything in a latest ref to avoid stale closures in the debounced functions
  const latestRef = useRef({
    selectedItems,
    fetchOptions,
    setParam,
    options,
    setOptions,
    updateCheckmarks,
    setSelectedItems,
  });

  useLayoutEffect(() => {
    latestRef.current = {
      selectedItems,
      fetchOptions,
      setParam,
      options,
      setOptions,
      updateCheckmarks,
      setSelectedItems,
    };
  }, [selectedItems, fetchOptions, setParam, options, setOptions, updateCheckmarks, setSelectedItems]);

  const debouncedHandleChangeValueRef = useRef<
    ((detail: { originalEvent: Event; value: string; key: string; previousValue?: string }) => void) | null
  >(null);
  const debouncedHandleInputChangeRef = useRef<
    ((detail: { originalEvent: Event; value: string; previousValue?: string }) => void) | null
  >(null);

  useEffect(() => {
    debouncedHandleChangeValueRef.current = debounce(
      async (detail: { originalEvent: Event; value: string; key: string; previousValue?: string }) => {
        const mgr = getManager();
        if (!mgr) return;

        const { search, popupInput } = localDetermineSearch(mgr);

        if (popupInput === true) {
          setOnChangeCount((prev) => prev + 1);
          latestRef.current.setParam("selectedValue", search);
        }

        if (popupInput === true) {
          return;
        }

        const val = detail.value;

        if (!popupInput && detail.originalEvent.type === "keydown") {
          const key = detail.key;
          if (key === "Backspace" && val === "" && latestRef.current.selectedItems.length > 0) {
            const newSelected = [...latestRef.current.selectedItems];
            newSelected.pop();
            latestRef.current.setSelectedItems(newSelected);
            latestRef.current.updateCheckmarks(newSelected);
            return;
          }
        }

        if (search === detail.previousValue) return;

        latestRef.current.setParam("selectedValue", search);
        setOnChangeCount((prev) => prev + 1);

        await latestRef.current.fetchOptions(search, latestRef.current.selectedItems);
      },
      500,
    );

    debouncedHandleInputChangeRef.current = debounce(
      async (detail: { originalEvent: Event; value: string; previousValue?: string }) => {
        const mgr = getManager();
        if (!mgr) return;

        const { search, popupInput } = localDetermineSearch(mgr);

        if (popupInput === false) {
          return;
        }

        if (search === detail.previousValue) return;

        setOnInputChangeCount((prev) => prev + 1);
        await latestRef.current.fetchOptions(search, latestRef.current.selectedItems);
      },
      500,
    );
  }, []);

  const debouncedHandleChangeValue = useCallback(
    (detail: { originalEvent: Event; value: string; key: string; previousValue?: string }) => {
      debouncedHandleChangeValueRef.current?.(detail);
    },
    [],
  );

  const handleClear = () => {
    setOnClearCount((prev) => prev + 1);
    if (!confirm("Are you sure?")) return;

    setSelectedItems([]);
    setParam("selectedValue", "");
  };

  const handlePick = (item: CustomItem) => {
    setOnItemPickCount((prev) => prev + 1);
    const mgr = getManager();
    if (!mgr) return;

    console.log("footer", {
      state: optionsShowFooter,
      mgr: mgr.options.getShowFooter(),
    });
    if (mgr.options.getShowFooter()) {
      const newOptions = options.map((opt) => {
        if (opt.id === item.id) {
          return { ...opt, selected: !opt.selected };
        }
        return opt;
      });
      setOptions(newOptions);
    } else {
      const selectedToggled = togglePresenceOnTheList(selectedItems, item as CustomItem) as CustomItem[];
      setSelectedItems(selectedToggled);
      mgr.container.hide();
      setShowDeleteSel(true);
    }
  };

  const debouncedHandleInputChange = useCallback(
    (detail: { originalEvent: Event; value: string; previousValue?: string }) => {
      debouncedHandleInputChangeRef.current?.(detail);
    },
    [],
  );

  const handleOk = () => {
    setOnOkCount((prev) => prev + 1);
    const combined = deduplicateArrayById([...options, ...selectedItems]);
    const optionsSelected = combined.filter((i) => i.selected);
    setSelectedItems(optionsSelected);
    getManager()?.container.hide();
  };

  const handleCancel = () => {
    setOnCancelCount((prev) => prev + 1);
    getManager()?.container.hide();
  };

  const handleClose = () => {
    setOnCloseCount((prev) => prev + 1);
    setShowDeleteSel(true);
  };

  const handleSelectedItemsChanged = useCallback((_: any, reason: string) => {
    const programmaticReasons = [
      "setSelected",
      "setOptions",
      "showFooter",
      "showFilter",
      "setDisabled",
      "setLoading",
      "setValue",
      "setMaxHeight",
      "setRenderItem",
      "setRenderList",
      "setRenderEmpty",
      "setShowDelete",
      "setError",
      "setShowInput",
      "setLabel",
    ];
    if (
      programmaticReasons.includes(reason) ||
      reason.startsWith("set") ||
      reason.startsWith("show") ||
      reason === "onClear" ||
      reason === "setValue"
    ) {
      return;
    }
    setHandleSelectedItemsChangedCount((prev) => prev + 1);
  }, []);

  const handleOptionsChanged = useCallback((_: any, reason: string) => {
    const programmaticReasons = [
      "setSelected",
      "setOptions",
      "showFooter",
      "showFilter",
      "setDisabled",
      "setLoading",
      "setValue",
      "setMaxHeight",
      "setRenderItem",
      "setRenderList",
      "setRenderEmpty",
      "setShowDelete",
      "setError",
      "setShowInput",
      "setLabel",
    ];
    if (
      programmaticReasons.includes(reason) ||
      reason.startsWith("set") ||
      reason.startsWith("show") ||
      reason === "onClear" ||
      reason === "setValue"
    ) {
      return;
    }
    setHandleOptionsChangedCount((prev) => prev + 1);
  }, []);

  const handleEmptyListChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setParam("emptyList", checked);
  };

  // Sync options whenever emptyList changes or on initial mount
  useEffect(() => {
    const mgr = getManager();
    if (mgr) {
      const { search } = localDetermineSearch(mgr);
      const found = emptyList ? [] : deduplicateArrayById<CustomItem>(searchNames(search));
      const opts = markSelectedByIds(found, selectedItems.map((i) => i.id) as unknown as number[]) as CustomItem[];
      Promise.resolve().then(() => {
        setOptions(sortById(opts) as CustomItem[]);
      });
    }
  }, [emptyList, selectedItems]);

  // Sync React URL states DOWN to the manager on mount
  useEffect(() => {
    const mgr = getManager();
    if (mgr) {
      mgr.options.setShowFooter(optionsShowFooter);
      mgr.options.setShowFilter(optionsShowFilter);
      mgr.options.setDisabled(optionsDisabled);
      mgr.options.setLoading(optionsLoading);

      mgr.selected.setDisabled(selectedDisabled);
      mgr.selected.setLoading(selectedLoading);
      mgr.selected.setError(selectedError);
      mgr.selected.setShowInput(selectedShowInput);
      mgr.selected.setShowDelete(showDeleteSel);
    }
  }, []);

  // Set the global window.mgr reference for debugging
  useEffect(() => {
    const mgr = getManager();
    if (mgr) {
      (window as unknown as Record<string, unknown>).mgr = mgr;
    }
  }, []);

  useEffect(() => {
    const mgr = getManager();
    if (mgr) {
      console.log("useEffect templates", {
        customRenderItem,
        customRenderList,
        optionsRender,
        optionsCustomEmpty,
      });

      // Selected Custom Render Item
      if (customRenderItem) {
        mgr.selected.setRenderItem(function (item: CustomItem) {
          const el = document.createElement("div");
          el.className = "element";
          el.dataset.id = String(item.id);
          el.style.border = `2px solid ${item.color || "black"}`;
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.gap = "5px";
          el.style.padding = "5px";
          el.style.background = "#fff";

          if (item.img) {
            const img = document.createElement("img");
            img.src = `/img/${item.img}`;
            img.style.width = "20px";
            img.style.height = "20px";
            img.style.objectFit = "contain";
            el.appendChild(img);
          }

          const label = document.createElement("label");
          label.textContent = item.label;

          const del = document.createElement("div");
          del.dataset.remove = String(item.id);

          el.appendChild(label);
          el.appendChild(del);

          return el;
        });
      } else {
        mgr.selected.setRenderItem();
      }

      // Selected Custom Render List
      if (customRenderList) {
        mgr.selected.setRenderList(function (
          selected: CustomItem[],
          defaultRenderList: (list: CustomItem[]) => HTMLElement[],
        ) {
          const elements = defaultRenderList(selected);
          const groups: HTMLElement[] = [];
          for (let i = 0; i < elements.length; i += 3) {
            const groupDiv = document.createElement("div");
            groupDiv.style.border = "1px solid #1a73e8";
            groupDiv.style.borderRadius = "8px";
            groupDiv.style.padding = "8px";
            groupDiv.style.margin = "4px";
            groupDiv.style.display = "flex";
            groupDiv.style.gap = "8px";
            groupDiv.style.flexWrap = "wrap";
            groupDiv.style.background = "#e8f0fe";
            groupDiv.style.boxShadow = "0 2px 5px rgba(0,0,0,0.05)";
            const chunk = elements.slice(i, i + 3);
            chunk.forEach((el: HTMLElement) => groupDiv.appendChild(el));
            groups.push(groupDiv);
          }
          return groups;
        });
      } else {
        mgr.selected.setRenderList();
      }

      // Options Custom Render Item
      if (optionsRender === "custom") {
        mgr.options.setRenderItem((item: Item) => {
          const el = document.createElement("div");
          el.className = "element";
          el.style.padding = "12px";
          el.style.background = item.selected ? "#fff3e0" : "transparent";
          el.style.color = item.selected ? "#e65100" : "inherit";
          el.dataset.id = String(item.id);

          const icon = document.createElement("span");
          icon.textContent = item.selected ? "🔥 " : "❄️ ";
          icon.style.marginRight = "10px";

          const label = document.createElement("label");
          label.textContent = item.label || "";

          el.appendChild(icon);
          el.appendChild(label);
          return el;
        });
      } else if (optionsRender === "string") {
        mgr.options.setRenderItem(
          (item: Item) => `
          <div class="element" data-id="${item.id}" style="border: 1px solid #ccc; margin: 2px; border-radius: 20px; padding: 5px 15px; background: ${item.selected ? "#e8f5e9" : "white"}; color: ${item.selected ? "#2e7d32" : "#333"};">
            <span style="font-size: 1.2em; vertical-align: middle;">${item.selected ? "✅" : "⬜"}</span>
            <strong style="margin-left: 10px;">${item.label}</strong>
            <small style="margin-left: auto; opacity: 0.5;">#${item.id}</small>
          </div>
        `,
        );
      } else {
        mgr.options.setRenderItem();
      }

      // Options Custom Render Empty State
      if (optionsCustomEmpty) {
        mgr.options.setRenderEmpty(
          () =>
            `<div style="padding: 40px; text-align: center; color: #ff5252; font-weight: bold; border: 2px dashed #ff5252; border-radius: 8px;">⚠️ Custom Empty State!</div>`,
        );
      } else {
        mgr.options.setRenderEmpty();
      }
    }
  }, [customRenderItem, customRenderList, optionsRender, optionsCustomEmpty]);

  const addTemplate = (color: string, img: string) => {
    const newItem: CustomItem = {
      id: img,
      label: img.split(".")[0],
      color,
      img,
    } as unknown as CustomItem;
    const newList = [...selectedItems, newItem];
    setSelectedItems(newList);
    setOptions(
      (prevOptions) =>
        markSelectedByIds(
          prevOptions,
          newList.map((i) => i.id),
        ) as CustomItem[],
    );
  };

  return (
    <div
      style={{
        background: "white",
        padding: "20px",
        borderRadius: "12px",
        boxShadow: "0 4px 15px rgba(0, 0, 0, 0.05)",
        border: "1px solid #ddd",
        position: "relative",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Instance #{id}</h2>
      <button
        onClick={() => onRemove(id)}
        className="gcp-css"
        style={{ position: "absolute", top: "20px", right: "20px" }}
      >
        Destroy
      </button>

      <div style={{ padding: "20px", background: "#fafafa", border: "1px dashed #ccc", marginBottom: "20px" }}>
        <CompositeSelect<CustomItem>
          ref={csRef}
          selected-selected={selectedItems}
          selected-value={selectedValue}
          selected-label={selectedLabel}
          selected-disabled={selectedDisabled}
          selected-loading={selectedLoading}
          selected-error={selectedError}
          selected-show-input={selectedShowInput}
          selected-show-delete={showDeleteSel}
          selected-onFocus={handleFocus}
          selected-onDelete={handleDelete}
          selected-onInputChange={debouncedHandleChangeValue}
          selected-onClear={handleClear}
          selected-onChange={(selected) => console.log("onChange: ", selected)}
          selected-onComponentChange={handleSelectedItemsChanged}
          options-options={options}
          options-value={selectedValue}
          options-label={optionsLabel}
          options-max-height={optionsMaxHeight}
          options-show-footer={optionsShowFooter}
          options-show-filter={optionsShowFilter}
          options-disabled={optionsDisabled}
          options-loading={optionsLoading}
          options-onItemPick={handlePick}
          options-onInputChange={debouncedHandleInputChange}
          options-onOk={handleOk}
          options-onCancel={handleCancel}
          options-onComponentChange={handleOptionsChanged}
          container-position={optionsPosition}
          container-onClose={handleClose}
        ></CompositeSelect>
      </div>

      <div style={{ marginBottom: "15px", fontSize: "14px" }}>
        <strong>Input Value:</strong>
        <pre
          style={{
            display: "inline",
            background: "#eee",
            padding: "2px 5px",
            margin: "0",
            width: "auto",
            maxHeight: "none",
          }}
        >
          {selectedValue || "-"}
        </pre>
        (onChange: <span style={{ fontWeight: "bold" }}>{onChangeCount}</span>, onFocus:
        <span style={{ fontWeight: "bold" }}>{onFocusCount}</span>, onDelete:
        <span style={{ fontWeight: "bold" }}>{onDeleteCount}</span>, onClear:
        <span style={{ fontWeight: "bold" }}>{onClearCount}</span>, onInputChange:
        <span style={{ fontWeight: "bold" }}>{onInputChangeCount}</span>, onOk:
        <span style={{ fontWeight: "bold" }}>{onOkCount}</span>, onCancel:
        <span style={{ fontWeight: "bold" }}>{onCancelCount}</span>, onItemPick:
        <span style={{ fontWeight: "bold" }}>{onItemPickCount}</span>, onClose:
        <span style={{ fontWeight: "bold" }}>{onCloseCount}</span>, handleSelectedItemsChanged:
        <span style={{ fontWeight: "bold" }}>{handleSelectedItemsChangedCount}</span>, handleOptionsChanged:
        <span style={{ fontWeight: "bold" }}>{handleOptionsChangedCount}</span>)
      </div>

      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {Object.entries(imgDataJson as Record<string, string[]>).map(([color, images]) =>
            images.map((img) => (
              <button
                key={img}
                className="gcp-css white"
                onClick={() => addTemplate(color, img)}
                style={{ color, padding: "4px 8px" }}
              >
                {img}
              </button>
            )),
          )}
        </div>
      </div>

      <div style={{ marginBottom: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          className="gcp-css"
          onClick={() =>
            setParam(
              "activeTemplates",
              activeTemplates.includes("item") ? activeTemplates : [...activeTemplates, "item"],
            )
          }
        >
          Set Custom Render Item
        </button>
        <button
          className="gcp-css"
          onClick={() =>
            setParam(
              "activeTemplates",
              activeTemplates.includes("list") ? activeTemplates : [...activeTemplates, "list"],
            )
          }
        >
          Set Custom Render List
        </button>
        <button className="gcp-css" onClick={() => setParam("activeTemplates", [])}>
          Reset Templates
        </button>
      </div>

      <div style={{ marginTop: "15px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
          <span style={{ minWidth: "120px" }}>
            🔍 <strong>Input & List</strong>:
          </span>
          <button
            className="gcp-css"
            onClick={() => {
              const mgr = getManager();
              if (mgr) {
                mgr.container.show();
                mgr.options.setFocus();
              }
            }}
          >
            Focus Input
          </button>

          <div className="gcp-css checkbox-wrapper">
            <div className="checkbox-row">
              <input type="checkbox" id={`empty-list-${id}`} checked={emptyList} onChange={handleEmptyListChange} />
              <div className="content-cell">
                <label htmlFor={`empty-list-${id}`}>Empty list</label>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", width: "100%" }}>
          <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
            <span style={{ minWidth: "120px" }}>
              📏 <strong>Max Height</strong>:
            </span>
            <div style={{ display: "flex", gap: "2px" }}>
              <button
                className="gcp-css white"
                onClick={() => stepMaxHeight(-10)}
                style={{ padding: "0 8px", minWidth: "auto" }}
              >
                ▼
              </button>
              <div className="gcp-css input-wrapper" style={{ maxWidth: "150px", marginBottom: 0 }}>
                <input
                  type="text"
                  id={`maxheight-input-${id}`}
                  placeholder=" "
                  value={optionsMaxHeight || ""}
                  onChange={(e) => setParam("optionsMaxHeight", e.target.value)}
                />
                <label htmlFor={`maxheight-input-${id}`}>Max height</label>
              </div>
              <button
                className="gcp-css white"
                onClick={() => stepMaxHeight(10)}
                style={{ padding: "0 8px", minWidth: "auto" }}
              >
                ▲
              </button>
            </div>
            <button className="gcp-css" onClick={() => setParam("optionsMaxHeight", optionsMaxHeight || "")}>
              Set
            </button>
            {["200px", "300px", "400px", "600px"].map((preset) => (
              <button key={preset} className="gcp-css white" onClick={() => setParam("optionsMaxHeight", preset)}>
                {preset}
              </button>
            ))}
            <button className="gcp-css white" onClick={() => setParam("optionsMaxHeight", "")}>
              Reset
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
          <span style={{ minWidth: "120px" }}>
            🎨 <strong>Render</strong>:
          </span>
          <button className="gcp-css" onClick={() => setParam("optionsRender", "custom")}>
            Set Custom Render
          </button>
          <button className="gcp-css" onClick={() => setParam("optionsRender", "string")}>
            Set String Render
          </button>
          <button className="gcp-css" onClick={() => setParam("optionsRender", "default")}>
            Set Default Render
          </button>
          <button className="gcp-css" onClick={() => setParam("optionsCustomEmpty", true)}>
            Set Custom Empty
          </button>
          <button className="gcp-css" onClick={() => setParam("optionsCustomEmpty", false)}>
            Set Default Empty
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "20px", fontSize: "14px" }}>
        <div style={{ flex: 1, minWidth: "300px", borderRight: "1px solid #eee", paddingRight: "20px" }}>
          <h4 style={{ marginTop: 0 }}>SelectedSection (Top)</h4>
          <label>
            <input
              type="checkbox"
              checked={selectedDisabled}
              onChange={(e) => setParam("selectedDisabled", e.target.checked)}
            />
            Disabled
          </label>
          <br />
          <label>
            <input
              type="checkbox"
              checked={(function (selectedLoading) {
                console.log("selectedLoading", selectedLoading);

                return selectedLoading;
              })(selectedLoading)}
              onChange={(e) => setParam("selectedLoading", e.target.checked)}
            />
            Loading
          </label>
          <br />
          <label>
            <input
              type="checkbox"
              checked={selectedError}
              onChange={(e) => setParam("selectedError", e.target.checked)}
            />{" "}
            Error
          </label>
          <br />
          <label>
            <input
              type="checkbox"
              checked={selectedShowInput}
              onChange={(e) => setParam("selectedShowInput", e.target.checked)}
            />
            Show Input
          </label>
          <br />
          <label>
            Label: <input value={selectedLabel} onChange={(e) => setParam("selectedLabel", e.target.value)} />
          </label>
        </div>
        <div style={{ flex: 1, minWidth: "300px" }}>
          <h4 style={{ marginTop: 0 }}>OptionsSection (Dropdown)</h4>
          <label>
            <input
              type="checkbox"
              checked={optionsDisabled}
              onChange={(e) => setParam("optionsDisabled", e.target.checked)}
            />
            Disabled
          </label>
          <br />
          <label>
            <input
              type="checkbox"
              checked={optionsLoading}
              onChange={(e) => setParam("optionsLoading", e.target.checked)}
            />
            Loading
          </label>
          <br />
          <label>
            <input
              type="checkbox"
              checked={optionsShowFilter}
              onChange={(e) => setParam("optionsShowFilter", e.target.checked)}
            />
            Show Filter
          </label>
          <br />
          <label>
            <input
              type="checkbox"
              checked={optionsShowFooter}
              onChange={(e) => setParam("optionsShowFooter", e.target.checked)}
            />
            Show Footer
          </label>
          <br />
          <label>
            Position:
            <select
              value={optionsPosition}
              onChange={(e) => setParam("optionsPosition", e.target.value as PositionType)}
            >
              <option value="cover-bottom">cover-bottom</option>
              <option value="bottom">bottom</option>
              <option value="top">top</option>
              <option value="left">left</option>
              <option value="right">right</option>
            </select>
          </label>
          <br />
          <label>
            Label:
            <input value={optionsLabel} onChange={(e) => setParam("optionsLabel", e.target.value)} />
          </label>
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong>Selected Items:</strong>
          <pre
            data-testid="selectedItems"
            style={{
              background: "#f8f8f8",
              padding: "10px",
              fontSize: "12px",
              border: "1px solid #eee",
              maxHeight: "300px",
              overflow: "auto",
            }}
          >
            {JSON.stringify(selectedItems, null, 2)}
          </pre>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <strong>Options State Dump:</strong>
          <pre
            data-testid="optionsStateDump"
            style={{
              background: "#f8f8f8",
              padding: "10px",
              fontSize: "12px",
              border: "1px solid #eee",
              maxHeight: "300px",
              overflow: "auto",
            }}
          >
            {JSON.stringify(options, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
});
