import { useEffect } from "react";

import { useLocation, useSearchParams } from "react-router-dom";

import { createUseQueryParams } from "./createUseQueryParams.tsx";

const useQueryParams = createUseQueryParams({
  text: {
    default: "",
    encode: (value: string) => value,
    decode: (value: string) => value,
  },
  radio: {
    default: "option1",
    encode: (value: string) => value,
    decode: (value: string) => value,
  },
  multiSelect: {
    default: [] as string[],
    encode: (value: string[]) => JSON.stringify(value),
    decode: (value: string) => {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    },
  },
  checkboxA: {
    default: false,
    encode: (value: boolean) => (value ? "true" : "false"),
    decode: (value: string) => value === "true",
  },
  checkboxB: {
    default: true,
    encode: (value: boolean) => (value ? "true" : "false"),
    decode: (value: string) => value === "true",
  },
});

export default function UrlSerialiser() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = searchParams.get("page");
  const filter = searchParams.get("filter");

  const { params, diff, setParam } = useQueryParams(location.search);

  useEffect(() => {
    // create style element and put some styles
    const style = document.createElement("style");
    style.innerHTML = `
            .url-ser-container {
                padding: 20px;
            }
            .url-ser-flex {
                display: flex;
                gap: 40px;
            }
            .url-ser-form {
                display: flex;
                flex-direction: column;
                gap: 20px;
                flex: 1;
                max-width: 400px;
            }
            .url-ser-input {
                width: 100%;
                padding: 5px;
            }
            .url-ser-select {
                width: 100%;
                padding: 5px;
                height: 100px;
            }
            .url-ser-label-margin {
                margin-right: 10px;
            }
            .url-ser-dump-container {
                flex: 1;
                padding: 20px;
                background: #f5f5f5;
                border-radius: 8px;
            }
            .url-ser-pre {
                white-space: pre-wrap;
            }
        `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="url-ser-container">
      <h5>UrlSerialiser Demo Form</h5>
      <a href={window.location.href.split("?")[0]} className="gcp-css">
        off
      </a>
      |
      <a href="./" className="gcp-css">
        up ..
      </a>
      <span style={{ padding: "0 10px" }}>|</span>
      <a
        href="https://github.com/stopsopa/select-component/blob/main/vite-project/src/pages/UrlSerialiser.tsx"
        className="gcp-css"
      >
        source
      </a>
      <hr />
      <div className="url-ser-flex">
        <form className="url-ser-form">
          <label>
            <strong>Text Input:</strong>
            <br />
            <input
              type="text"
              value={params.text}
              onChange={(e) => {
                console.log(`setParam("text", "${e.target.value}")`);
                setParam("text", e.target.value);
              }}
              className="url-ser-input"
            />
          </label>

          <fieldset>
            <legend>
              <strong>Radio Group:</strong>
            </legend>
            {["option1", "option2", "option3"].map((opt) => (
              <label key={opt} className="url-ser-label-margin">
                <input
                  type="radio"
                  value={opt}
                  checked={params.radio === opt}
                  onChange={(e) => setParam("radio", e.target.value)}
                />
                {opt}
              </label>
            ))}
          </fieldset>

          <label>
            <strong>Multiple Select:</strong>
            <br />
            <select
              multiple
              value={params.multiSelect}
              onChange={(e) =>
                setSearchParams(
                  setParam(
                    "multiSelect",
                    Array.from(e.target.selectedOptions, (option) => option.value),
                  ),
                )
              }
              className="url-ser-select"
            >
              <option value="item1">Item 1</option>
              <option value="item2">Item 2</option>
              <option value="item3">Item 3</option>
              <option value="item4">Item 4</option>
            </select>
          </label>

          <fieldset>
            <legend>
              <strong>Checkboxes:</strong>
            </legend>
            <label className="url-ser-label-margin">
              <input
                type="checkbox"
                checked={params.checkboxA}
                onChange={(e) => setSearchParams(setParam("checkboxA", e.target.checked))}
              />
              Checkbox A
            </label>
            <label>
              <input
                type="checkbox"
                checked={params.checkboxB}
                onChange={(e) => setSearchParams(setParam("checkboxB", e.target.checked))}
              />
              Checkbox B
            </label>
          </fieldset>
        </form>

        <div className="url-ser-dump-container">
          <strong>State Dump:</strong>
          <pre className="url-ser-pre">
            {JSON.stringify({ url: { page, filter }, hook: { params, diff } }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
