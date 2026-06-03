import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { SelectedSection } from "composite-select/selected-section/react";
import type { SelectedSectionManager } from "composite-select/selected-section/SelectedSectionManager";
import type { Item } from "composite-select/types";
import { SelectedSection as SelectedSectionWC } from "composite-select/selected-section/selected-section";
import selectedListCss from "composite-select/composition/selected-section/SelectedSectionManager.css?inline";

SelectedSectionWC.cssText = selectedListCss;

const imgDataJson: Record<string, string[]> = {
  "#f44336": ["gmail.png", "youtube.png"],
  "#4285f4": ["google_drive.png", "google_calendar.png", "google_keep.png"],
  "#0f9d58": ["chatgpt.png", "claude.png", "gemini.png", "perplexity.png"],
  "#ff9800": ["tools.png", "timeanddate.png", "t3chat.png", "ai.png"],
};

type CustomItem = Item & {
  color: string;
  img: string;
};

export default function SelectedSectionDemo() {
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
        href="https://github.com/stopsopa/select-component/blob/main/vite-project/src/pages/SelectedSectionDemo.tsx"
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
  const slRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState(false);
  const [showInput, setShowInput] = useState(true);
  const [value, setValue] = useState("");
  const [selected, setSelected] = useState<CustomItem[]>([
    { id: 1, label: "Item 1", color: "#ccc", img: "" },
    { id: 2, label: "Item 2", color: "#ccc", img: "" },
  ]);

  const [counters, setCounters] = useState({
    change: 0,
    focus: 0,
    delete: 0,
    clear: 0,
    changeValue: 0,
  });

  const getManager = (): SelectedSectionManager<Item> | undefined => slRef.current?.getManager();

  const addItem = () => {
    const newId = Math.floor(Math.random() * 10000);
    setSelected((prev) => [...prev, { id: newId, label: `New Item ${newId}`, color: "#ccc", img: "" }]);
  };

  const addTemplate = (color: string, img: string) => {
    const newId = Math.floor(Math.random() * 10000);
    setSelected((prev) => [
      ...prev,
      {
        id: newId,
        label: img.split(".")[0],
        color,
        img,
      },
    ]);
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
        <SelectedSection<CustomItem>
          ref={slRef}
          selected={selected}
          loading={loading}
          disabled={disabled}
          error={error}
          label="Select options"
          value={value}
          show-input={showInput}
          onChange={(selected: CustomItem[]) => {
            setCounters((prev) => ({ ...prev, change: prev.change + 1 }));
            setSelected(selected);
          }}
          onInputChange={(detail: any) => {
            setCounters((prev) => ({ ...prev, changeValue: prev.changeValue + 1 }));
            setValue(detail.value);
            if (detail.originalEvent.type === "keydown") {
              if (detail.key === "Enter" && detail.value.trim()) {
                setSelected((prev) => [
                  ...prev,
                  {
                    id: Math.floor(Math.random() * 10000),
                    label: detail.value.trim(),
                    color: "#ccc",
                    img: "",
                  } as CustomItem,
                ]);
                setValue("");
              }
              if (detail.key === "Backspace" && detail.value === "") {
                setSelected((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
              }
            }
          }}
          onDelete={(id: number | string) => {
            setCounters((prev) => ({ ...prev, delete: prev.delete + 1 }));
            setSelected((prev) => prev.filter((item) => String(item.id) !== String(id)));
          }}
          onClear={() => {
            setCounters((prev) => ({ ...prev, clear: prev.clear + 1 }));
            setSelected([]);
          }}
          onFocus={() => setCounters((prev) => ({ ...prev, focus: prev.focus + 1 }))}
        />
      </div>

      <div style={{ fontSize: "14px", marginBottom: "15px" }}>
        <strong>Events:</strong> Change: {counters.change}, Value: {counters.changeValue}, Focus: {counters.focus},
        Delete: {counters.delete}, Clear: {counters.clear}
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h4 style={{ marginTop: 0, marginBottom: "10px" }}>Templates</h4>
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {Object.entries(imgDataJson).map(([color, images]) =>
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

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button className="gcp-css" onClick={addItem}>
          Add Item
        </button>
        <button className="gcp-css white" onClick={() => getManager()?.setFocus()}>
          Focus
        </button>

        <button
          className="gcp-css white"
          onClick={() => {
            const el = slRef.current as any;
            if (el && el.setRenderItem) {
              el.setRenderItem((item: CustomItem) => {
                const div = document.createElement("div");
                div.className = "element";
                div.dataset.id = String(item.id);
                div.style.border = `2px solid ${item.color || "black"}`;
                div.style.display = "flex";
                div.style.alignItems = "center";
                div.style.gap = "5px";
                div.style.padding = "5px";
                div.style.background = "#fff";
                if (item.img) {
                  const img = document.createElement("img");
                  img.src = `/img/${item.img}`;
                  img.style.width = "20px";
                  img.style.height = "20px";
                  img.style.objectFit = "contain";
                  div.appendChild(img);
                }
                const label = document.createElement("label");
                label.textContent = item.label;
                const del = document.createElement("div");
                del.dataset.remove = String(item.id);
                div.appendChild(label);
                div.appendChild(del);
                return div;
              });
            }
          }}
        >
          Set Custom Render Item
        </button>
        <button
          className="gcp-css white"
          onClick={() => {
            const el = slRef.current as any;
            if (el && el.setRenderList) {
              el.setRenderList((selected: any[], defaultRenderList: (s: any[]) => HTMLElement[]) => {
                const elements = defaultRenderList(selected);
                const groups = [];
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
                  chunk.forEach((child) => groupDiv.appendChild(child));
                  groups.push(groupDiv);
                }
                return groups;
              });
            }
          }}
        >
          Set Custom Render List
        </button>
        <button
          className="gcp-css white"
          onClick={() => {
            const el = slRef.current as any;
            if (el) {
              if (el.setRenderItem) el.setRenderItem();
              if (el.setRenderList) el.setRenderList();
            }
          }}
        >
          Reset Templates
        </button>

        <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <input type="checkbox" checked={loading} onChange={(e) => setLoading(e.target.checked)} /> Loading
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <input type="checkbox" checked={disabled} onChange={(e) => setDisabled(e.target.checked)} /> Disabled
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <input type="checkbox" checked={error} onChange={(e) => setError(e.target.checked)} /> Error
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <input type="checkbox" checked={showInput} onChange={(e) => setShowInput(e.target.checked)} /> Show Input
        </label>
      </div>

      <pre
        style={{
          background: "#f8f8f8",
          padding: "10px",
          fontSize: "12px",
          marginTop: "15px",
          border: "1px solid #eee",
        }}
      >
        {JSON.stringify(selected, null, 2)}
      </pre>
    </div>
  );
}
