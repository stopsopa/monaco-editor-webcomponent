/**
 * React wrapper for `<composite-monaco-diff>`.
 *
 *   import { MonacoDiff } from "composite-monaco-diff/react";
 *
 *   <MonacoDiff theme="vs-dark" language="javascript" original={a} modified={b} />
 *
 *   // editable + controlled:
 *   <MonacoDiff editable modified={text} onChange={({ modified }) => setText(modified)} />
 *
 *   // access to the element / Monaco:
 *   const ref = useRef<MonacoDiffElement>(null);
 *   <MonacoDiff ref={ref} />
 *   const { editor, monaco } = await ref.current.whenReady();
 *
 * Important:
 *   - `react` is an optional peer dependency of the package; this file is the only one that needs it.
 *   - `theme` is global in Monaco (all Monaco editors on the page change), see composite-monaco-diff.ts.
 *   - `language` is the shared language; `originalLanguage` / `modifiedLanguage` win over it per side.
 *   - Without `editable` the editor is a read-only viewer and `onChange` never fires.
 *   - Props are pushed to the element synchronously in a layout effect, so the first editor model is
 *     created with the right text already (no empty first frame).
 */
import * as React from "react";
import "./composite-monaco-diff.js";
import type { MonacoDiffElement } from "./composite-monaco-diff.js";
import type { MonacoDiffContent } from "./MonacoDiffManager.js";

export type { MonacoDiffElement, MonacoDiffContent };

export type MonacoDiffProps = {
  className?: string;
  style?: React.CSSProperties;
  id?: string;

  /** Monaco theme. Global: changes every Monaco editor on the page. */
  theme?: string;
  /** Shared language of both sides. */
  language?: string;

  original?: string;
  modified?: string;
  /** Wins over `language` for the original side. */
  originalLanguage?: string;
  /** Wins over `language` for the modified side. */
  modifiedLanguage?: string;

  /** Allow typing in the modified side. Default: false (viewer). */
  editable?: boolean;
  /** Called when the user edits the text (requires `editable`). */
  onChange?: (content: MonacoDiffContent) => void;

  children?: React.ReactNode;
};

export const MonacoDiff: React.ForwardRefExoticComponent<MonacoDiffProps & React.RefAttributes<MonacoDiffElement>> =
  React.forwardRef<MonacoDiffElement, MonacoDiffProps>(function MonacoDiff(props, ref) {
    const {
      theme,
      language,
      original,
      modified,
      originalLanguage,
      modifiedLanguage,
      editable,
      onChange,
      children,
      ...rest
    } = props;

    const internalRef = React.useRef<MonacoDiffElement | null>(null);

    const setRef = React.useCallback(
      (node: MonacoDiffElement | null) => {
        internalRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    // Text: only real strings are forwarded (a broken URL decoder handing over null must not reach Monaco).
    React.useLayoutEffect(() => {
      const el = internalRef.current;
      if (!el) return;
      if (typeof original === "string" && el.original !== original) el.original = original;
      if (typeof modified === "string" && el.modified !== modified) el.modified = modified;
    }, [original, modified]);

    // Per-side languages. The shared `language` travels as an attribute; the element applies one
    // precedence rule (per-side wins), so the order in which these change does not matter.
    React.useLayoutEffect(() => {
      const el = internalRef.current;
      if (!el) return;
      el.originalLanguage = originalLanguage;
      el.modifiedLanguage = modifiedLanguage;
    }, [originalLanguage, modifiedLanguage]);

    const onChangeRef = React.useRef(onChange);
    onChangeRef.current = onChange;

    React.useEffect(() => {
      const el = internalRef.current;
      if (!el) return;

      const listener = (event: Event) => {
        // `change` also bubbles up from other elements when children are rendered inside
        if (event.target !== el) return;
        onChangeRef.current?.((event as CustomEvent<MonacoDiffContent>).detail);
      };

      el.addEventListener("change", listener);
      return () => {
        el.removeEventListener("change", listener);
      };
    }, []);

    const wcProps: Record<string, unknown> = { ...rest, ref: setRef };

    if (theme !== undefined) wcProps["theme"] = theme;
    if (language !== undefined) wcProps["language"] = language;
    // "" / undefined instead of true / false: React 18 would stringify `false` into editable="false"
    if (editable) wcProps["editable"] = "";

    return React.createElement("composite-monaco-diff", wcProps, children);
  });

export default MonacoDiff;
