import React, { useEffect, useMemo, useCallback } from "react";

import { useLocation, useNavigate } from "react-router-dom";

import type { NavigateFunction } from "react-router-dom";

import modURLSearchParams from "./modURLSearchParams.ts";

const radioOptions = ["radio1", "radio2", "radio3"] as const;
type RadioOptionType = (typeof radioOptions)[number];
const defaultRadioOption: RadioOptionType = radioOptions[0];

const selectOptions = ["item1", "item2", "item3", "item4"] as const;
type SingleOptionType = (typeof selectOptions)[number];

type MultiSelectOptionsArray = SingleOptionType[];

/**
 * Let's define parameters names and their keys to represent them in URL
 * And also default values, encoding and decoding functions
 */
const { useQueryParams, separateIndexedSearchParams } = modURLSearchParams(
  {
    text: {
      default: "",
      getParam: "t",
      encode: (value) => value,
      decode: (value) => value,
    },
    radio: {
      default: defaultRadioOption as RadioOptionType,
      getParam: "r",
      encode: (value) => value,
      decode: (value) => value as RadioOptionType,
    },
    multiSelect: {
      default: [] as MultiSelectOptionsArray,
      getParam: "m",
      encode: (value) => JSON.stringify(value),
      decode: (value) => {
        try {
          return JSON.parse(value);
        } catch {
          return [];
        }
      },
    },
    checkboxA: {
      default: false,
      getParam: "c1",
      encode: (value) => (value ? "1" : "0"),
      decode: (value) => value === "1",
    },
    checkboxB: {
      default: true,
      getParam: "c2",
      encode: (value) => (value ? "1" : "0"),
      decode: (value) => value === "1",
    },
  },
  (key, i?: number) => `${key}-${i}`,
);

export default function ParentComponent() {
  const location = useLocation();
  const navigate = useNavigate();

  const list = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const indexes = new Set<number>();
    params.forEach((_, key) => {
      const match = key.match(/-(\d+)$/);
      if (match) {
        indexes.add(parseInt(match[1], 10));
      }
    });
    return Array.from(indexes).sort((a, b) => a - b);
  }, [location.search]);

  /**
   * Process of extracting list is little bit messy but I don't want to add more complexity to modURLSearchParams hook
   * We would need to find a way to correlate the way how we add prefix with the process of extracting the list for given index in prefix
   * So let's keep it custom
   */
  const addComponent = useCallback(() => {
    const nextIndex = list.length > 0 ? Math.max(...list) + 1 : 1;

    // We read from window.location.search directly instead of location.search to avoid
    // having location.search in the dependency array, which would recreate this callback
    // on every keystroke.
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.set(`t-${nextIndex}`, "");
    navigate({ search: currentParams.toString() }, { replace: true });
  }, [list, navigate]);

  /**
   * We have to wrap deleteItem with useCallback otherwise we will trigger rerender of children
   * We have to wrap to make sure we will pass exactly the same instance according to === compare which React.memo uses
   */
  const deleteItem = useCallback(
    (i: number) => {
      // 1. Read live query params
      // Reading from window.location.search directly instead of location.search.
      // If we used location.search, we would have to add it to the dependency array.
      // This would recreate deleteItem on every keystroke, which would break
      // React.memo(ChildComponent) and trigger expensive re-renders for all sibling components.
      // Conversely, omitting it from the dependency array would cause stale closures.
      const nextSearchParams = new URLSearchParams(window.location.search);

      // 2. Find only keys belonging to index i
      const childParams = separateIndexedSearchParams(nextSearchParams, i);

      let changed = false;
      childParams.forEach((_, key) => {
        nextSearchParams.delete(key);
        changed = true;
      });

      // 3. Update URL if changed
      if (changed) {
        navigate({ search: nextSearchParams.toString() }, { replace: true });
      }
    },
    [navigate],
  );

  useEffect(() => {
    // sprinkle some css styles in simples way
    const style = document.createElement("style");
    style.innerHTML = getCss();
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div>
      <span style={{ padding: "5px" }}></span>
      <a href={window.location.href.split("?")[0]} className="gcp-css">
        off
      </a>
      <span style={{ padding: "5px" }}>|</span>
      <a href="./" className="gcp-css">
        up ..
      </a>
      <span style={{ padding: "5px" }}>|</span>
      <a href="?t-1=aaa&t-3=cccc" className="gcp-css">
        1, 3 example
      </a>
      <span style={{ padding: "0 10px" }}>|</span>
      <a
        href="https://github.com/stopsopa/monaco-editor-webcomponent/blob/main/vite-project/src/pages/params/ModURLSearchParamsComponent.tsx"
        className="gcp-css"
      >
        source
      </a>
      <hr />
      <button onClick={addComponent}>Add Text Param</button> {list.join(", ")}
      <div>
        {list.map((i) => {
          const search = separateIndexedSearchParams(location.search, i).toString();
          /**
           * passing onDelete={deleteItem} like so is important because we are passing the same instance of function
           * that will not trigger rerender of children
           *
           * when you do
           *
           * onDelete={() => deleteItem(i)}
           *
           * you will trigger rerender of children because you are passing new instance of function
           * in each parent render bo basically on every url change
           *
           * But then that means we have to pass i={i} to ChildComponent so that it knows which
           *
           * for it to be able to call deleteItem(i) - by passing it's index i
           */
          return <ChildComponent key={i} i={i} search={search} navigate={navigate} onDelete={deleteItem} />;
        })}
      </div>
    </div>
  );
}
/**
 * Another aspect is that we have to wrap with React.memo() becaue parent will rerender
 * on any url change so it will cascade down to children
 *
 * React.memo() work like useMemo() but for components where props are used as array of dependencies for useMemo()
 * So be careful to pass the same propos (the same values according to === operator) to the children components.
 */
const ChildComponent = React.memo(function ChildComponent({
  i,
  search,
  navigate,
  onDelete,
}: {
  i: number;
  search: string;
  navigate: NavigateFunction;
  onDelete: (i: number) => void;
}) {
  const { params, updatedURLSearchParams, setParam, setParams } = useQueryParams(search, navigate, i);

  console.log(`render child ${i} >${search}<`);

  // you can interact with parameters using these two methods
  // setParam("radio", "option2");
  // setParams({
  //   multiSelect: ["item3", "item4"],
  //   radio: "option2",
  // });

  return (
    <div className="url-ser-container">
      <div className="url-ser-flex">
        <form className="url-ser-form">
          <label>
            <strong>Text Input:</strong>
            <br />
            <input
              type="text"
              value={params.text}
              onChange={(e) => {
                console.log(`set text input ${i} setParam(  ${e.target.value}  )`);
                setParam("text", e.target.value);
              }}
              className="url-ser-input"
            />
          </label>

          <fieldset>
            <legend>
              <strong>Radio Group:</strong>
            </legend>
            {radioOptions.map((opt) => (
              <label key={opt} className="url-ser-label-margin">
                <input
                  type="radio"
                  value={opt}
                  checked={params.radio === opt}
                  onChange={(e) => setParam("radio", e.target.value as RadioOptionType)}
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
                setParam(
                  "multiSelect",
                  Array.from(e.target.selectedOptions, (option) => option.value as SingleOptionType),
                )
              }
              className="url-ser-select"
            >
              {selectOptions.map((l) => {
                return (
                  <option key={l} value={l}>
                    {l}
                  </option>
                );
              })}
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
                onChange={(e) => setParam("checkboxA", e.target.checked)}
              />
              Checkbox A
            </label>
            <label>
              <input
                type="checkbox"
                checked={params.checkboxB}
                onChange={(e) => setParam("checkboxB", e.target.checked)}
              />
              Checkbox B
            </label>
          </fieldset>

          <div className="buttons">
            <button type="button" onClick={() => onDelete(i)} className="url-ser-delete-btn red">
              Delete Component #{i}
            </button>

            <button
              type="button"
              onClick={() => {
                /**
                 * That will trigger all of these changes in one go
                 *
                 * see console.log in chrome developer tools - only one render
                 */
                if (params.radio === "radio2") {
                  setParams({
                    text: `text-${i} second state`,
                    radio: "radio3",
                    multiSelect: [selectOptions[1], selectOptions[selectOptions.length - 2]],
                    checkboxA: true,
                    checkboxB: false,
                  });

                  return;
                }
                setParams({
                  text: `text-${i}`,
                  radio: "radio2",
                  multiSelect: [selectOptions[0], selectOptions[selectOptions.length - 1]],
                  checkboxA: false,
                  checkboxB: true,
                });
              }}
              className="url-ser-delete-btn"
            >
              Reconfigure #{i}
            </button>
          </div>
        </form>

        <div className="url-ser-dump-container">
          <pre className="url-ser-pre">
            {JSON.stringify({ params, path: updatedURLSearchParams.toString() }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
});

function getCss() {
  return `
.url-ser-container {
    padding: 20px;
    &:not(:last-child){
        border-bottom: 1px solid gray;
    }
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
.buttons {
    display: flex;
    flex-direction: row;
    gap: 10px;
.url-ser-delete-btn {
    padding: 8px 12px;
    background-color: #4d6effff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    &.red {
    background-color: #ff4d4f;
    }
    &:hover {
        background-color: #ff7875;
    }
}
    }
`;
}
