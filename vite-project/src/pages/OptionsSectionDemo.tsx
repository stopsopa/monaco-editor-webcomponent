import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { OptionsSection } from "composite-select/options-section/react";
import type { OptionsSectionManager } from "composite-select/options-section/OptionsSectionManager";
import type { Item } from "composite-select/types";
import { OptionsSection as OptionsSectionWC } from "composite-select/options-section/options-section";
import optionsListCss from "composite-select/composition/options-section/OptionsSectionManager.css?inline";

OptionsSectionWC.cssText = optionsListCss;

type CustomItem = Item & {
  color: string;
  img: string;
};

export default function OptionsSectionDemo() {
  const [instances, setInstances] = useState<number[]>([1]);

  const addInstance = () => {
    setInstances((prev) => [...prev, (prev[prev.length - 1] || 0) + 1]);
  };

  const removeInstance = (id: number) => {
    setInstances((prev) => prev.filter((i) => i !== id));
  };

  return (
    <div className="gcp-css" style={{ padding: "20px" }}>
      <Link to="/" className="gcp-css" style={{ marginRight: "15px" }}>
        &larr; Back to Home
      </Link>
      <button className="gcp-css" onClick={addInstance}>
        Initialize New Instance
      </button>
      <span style={{ padding: "0 10px" }}>|</span>

      <a
        href="https://github.com/stopsopa/select-component/blob/main/vite-project/src/pages/OptionsSectionDemo.tsx"
        className="gcp-css"
      >
        source
      </a>

      <div style={{ display: "flex", flexDirection: "column", gap: "30px", marginTop: "20px" }}>
        {instances.map((id) => (
          <DemoInstance key={id} id={id} onRemove={() => removeInstance(id)} />
        ))}
      </div>
    </div>
  );
}

function DemoInstance({ id, onRemove }: { id: number; onRemove: () => void }) {
  const olRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [showFooter, setShowFooter] = useState(true);
  const [showFilter, setShowFilter] = useState(true);
  const [label, setLabel] = useState("Search options...");
  const [value, setValue] = useState("");
  const [options, setOptions] = useState<CustomItem[]>([
    { id: 1, label: "Option 1", selected: undefined } as CustomItem,
    { id: 2, label: "Option 2", selected: true } as CustomItem,
  ]);
  const [maxHeight, setMaxHeight] = useState("");
  const [mhInput, setMhInput] = useState("");

  const setMH = (val: string) => {
    setMhInput(val);
    setMaxHeight(val);
  };

  const stepMH = (delta: number) => {
    let current = parseInt(mhInput) || 0;
    current += delta;
    if (current < 0) current = 0;
    setMH(current + "px");
  };

  const [counters, setCounters] = useState({
    change: 0,
    pick: 0,
    ok: 0,
    cancel: 0,
    highlight: 0,
  });

  const getManager = (): OptionsSectionManager<CustomItem> | undefined => olRef.current?.getManager();

  const addRandom = () => {
    const newId = Math.floor(Math.random() * 10000);
    setOptions((prev) => [...prev, { id: newId, label: `Random ${newId}`, color: "#ccc", img: "" } as CustomItem]);
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
      <h3 style={{ marginTop: 0 }}>Instance #{id}</h3>
      <button className="gcp-css" onClick={onRemove} style={{ position: "absolute", top: "20px", right: "20px" }}>
        Destroy
      </button>

      <div style={{ border: "1px dashed #ccc", padding: "10px", background: "#fafafa", marginBottom: "15px" }}>
        <OptionsSection<CustomItem>
          ref={olRef}
          options={options}
          loading={loading}
          disabled={disabled}
          label={label}
          value={value}
          max-height={maxHeight}
          show-footer={showFooter}
          show-filter={showFilter}
          onInputChange={(e: any, _previous: string | undefined, _origin: string) => {
            setValue(e.target.value);
          }}
          onItemPick={(picked: CustomItem) => {
            setCounters((prev) => ({ ...prev, pick: prev.pick + 1 }));

            setOptions((prev) =>
              prev.map((opt) => (String(opt.id) === String(picked.id) ? { ...opt, selected: !opt.selected } : opt)),
            );
          }}
          onOk={() => setCounters((prev) => ({ ...prev, ok: prev.ok + 1 }))}
          onCancel={() => setCounters((prev) => ({ ...prev, cancel: prev.cancel + 1 }))}
          onHighlightChange={() => setCounters((prev) => ({ ...prev, highlight: prev.highlight + 1 }))}
        />
      </div>

      <div style={{ fontSize: "14px", marginBottom: "15px" }}>
        <strong>Events:</strong> Change: {counters.change}, Pick: {counters.pick}, Ok: {counters.ok}, Cancel:{" "}
        {counters.cancel}, Highlight: {counters.highlight}
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "15px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <input type="checkbox" checked={loading} onChange={(e) => setLoading(e.target.checked)} /> Loading
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <input type="checkbox" checked={disabled} onChange={(e) => setDisabled(e.target.checked)} /> Disabled
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <input type="checkbox" checked={showFooter} onChange={(e) => setShowFooter(e.target.checked)} /> Footer
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <input type="checkbox" checked={showFilter} onChange={(e) => setShowFilter(e.target.checked)} /> Filter
        </label>
      </div>

      <div style={{ marginTop: "15px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
          <span style={{ minWidth: "120px" }}>
            🔍 <strong>Input & List</strong>:
          </span>
          <button className="gcp-css" onClick={() => getManager()?.setFocus()}>
            Focus Input
          </button>
          <button
            className="gcp-css"
            onClick={() => {
              const mgr = getManager();
              if (mgr) {
                const newId = Math.floor(Math.random() * 10000);
                const currentOptions = mgr.getOptions() as CustomItem[];
                const newList = [
                  ...currentOptions,
                  { id: newId, label: `Dynamic Option ${newId}`, color: "#ccc", img: "" } as CustomItem,
                ];
                mgr.setOptions(newList);
                setOptions(newList);
              } else {
                addRandom();
              }
            }}
          >
            Add Random Option
          </button>
          <button
            className="gcp-css"
            onClick={() => {
              const mgr = getManager();
              if (mgr) {
                mgr.setOptions([]);
                setOptions([]);
              }
            }}
          >
            Clear Options
          </button>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
            <div className="gcp-css input-wrapper" style={{ maxWidth: "300px", marginBottom: 0 }}>
              <input
                type="text"
                id={`inject-label-${id}`}
                placeholder=" "
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <label htmlFor={`inject-label-${id}`}>Inject label</label>
            </div>
          </div>
          <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
            <div className="gcp-css input-wrapper" style={{ maxWidth: "300px", marginBottom: 0 }}>
              <input
                type="text"
                id={`inject-value-${id}`}
                placeholder=" "
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <label htmlFor={`inject-value-${id}`}>Inject value</label>
            </div>
          </div>
          <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "2px" }}>
              <button
                className="gcp-css white"
                onClick={() => stepMH(-10)}
                style={{ padding: "0 8px", minWidth: "auto" }}
              >
                ▼
              </button>
              <div className="gcp-css input-wrapper" style={{ maxWidth: "150px", marginBottom: 0 }}>
                <input
                  type="text"
                  id={`maxheight-input-${id}`}
                  placeholder=" "
                  value={mhInput}
                  onChange={(e) => setMhInput(e.target.value)}
                />
                <label htmlFor={`maxheight-input-${id}`}>Max height</label>
              </div>
              <button
                className="gcp-css white"
                onClick={() => stepMH(10)}
                style={{ padding: "0 8px", minWidth: "auto" }}
              >
                ▲
              </button>
            </div>
            <button className="gcp-css" onClick={() => setMH(mhInput)}>
              Set
            </button>
            {["200px", "300px", "400px", "600px", ""].map((val) => (
              <button key={val} className="gcp-css white" onClick={() => setMH(val)}>
                {val || "Reset"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
          <span style={{ minWidth: "120px" }}>
            🎨 <strong>Render</strong>:
          </span>
          <button
            className="gcp-css"
            onClick={() => {
              getManager()?.setRenderItem((item: Item) => {
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
            }}
          >
            Set Custom Render
          </button>
          <button
            className="gcp-css"
            onClick={() => {
              getManager()?.setRenderItem(
                (item: Item) => `
                <div class="element" data-id="${item.id}" style="border: 1px solid #ccc; margin: 2px; border-radius: 20px; padding: 5px 15px; background: ${item.selected ? "#e8f5e9" : "white"}; color: ${item.selected ? "#2e7d32" : "#333"};">
                  <span style="font-size: 1.2em; vertical-align: middle;">${item.selected ? "✅" : "⬜"}</span>
                  <strong style="margin-left: 10px;">${item.label}</strong>
                  <small style="margin-left: auto; opacity: 0.5;">#${item.id}</small>
                </div>
              `,
              );
            }}
          >
            Set String Render
          </button>
          <button className="gcp-css" onClick={() => getManager()?.setRenderItem()}>
            Set Default Render
          </button>
          <button
            className="gcp-css"
            onClick={() => {
              getManager()?.setRenderEmpty(
                () =>
                  `<div style="padding: 40px; text-align: center; color: #ff5252; font-weight: bold; border: 2px dashed #ff5252; border-radius: 8px;">⚠️ Custom Empty State!</div>`,
              );
            }}
          >
            Set Custom Empty
          </button>
          <button className="gcp-css" onClick={() => getManager()?.setRenderEmpty()}>
            Set Default Empty
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "5px" }}>All Options:</div>
          <pre
            style={{
              background: "#f8f8f8",
              padding: "10px",
              fontSize: "10px",
              border: "1px solid #eee",
              margin: 0,
              overflow: "auto",
              maxHeight: "300px",
            }}
          >
            {JSON.stringify(options, null, 2)}
          </pre>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "5px" }}>Selected:</div>
          <pre
            style={{
              background: "#f8f8f8",
              padding: "10px",
              fontSize: "10px",
              border: "1px solid #eee",
              margin: 0,
              overflow: "auto",
              maxHeight: "300px",
            }}
          >
            {JSON.stringify(
              options.filter((o) => o.selected),
              null,
              2,
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
