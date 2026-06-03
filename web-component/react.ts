// @ts-ignore
import * as React from "react";
import "./monaco-diff.js";
import type { MonacoTheme } from "./monaco-diff.js";
import type { MonacoDiffManager } from "./MonacoDiffManager.js";

export type MonacoDiffProps = {
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  key?: React.Key;
  ref?: React.Ref<HTMLElement>;

  theme?: MonacoTheme;
  language?: string;

  original?: string;
  modified?: string;
  originalLanguage?: string;
  modifiedLanguage?: string;

  children?: React.ReactNode;
};

export const MonacoDiff: (props: MonacoDiffProps & React.RefAttributes<HTMLElement>) => React.ReactElement = React.forwardRef((props: MonacoDiffProps, ref: React.ForwardedRef<HTMLElement>) => {
  const { theme, language, original, modified, originalLanguage, modifiedLanguage, children, ...rest } = props;

  const internalRef = React.useRef<HTMLElement>(null);

  const setRef = React.useCallback(
    (node: HTMLElement | null) => {
      internalRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLElement | null>).current = node;
      }
    },
    [ref],
  );

  React.useLayoutEffect(() => {
    const el = internalRef.current as any;
    if (el && el.getManager) {
      let active = true;
      (async () => {
        try {
          await el.whenReady();
          if (!active) return;
          const mgr = el.getManager() as MonacoDiffManager;
          const editor = mgr.getEditor();
          if (editor) {
            const model = editor.getModel();
            if (model) {
              if (original !== undefined && model.original.getValue() !== original) {
                model.original.setValue(original);
              }
              if (modified !== undefined && model.modified.getValue() !== modified) {
                model.modified.setValue(modified);
              }
              const monaco = mgr.getMonaco();
              if (monaco) {
                if (originalLanguage !== undefined) {
                  monaco.editor.setModelLanguage(model.original, originalLanguage);
                }
                if (modifiedLanguage !== undefined) {
                  monaco.editor.setModelLanguage(model.modified, modifiedLanguage);
                }
              }
            }
          }
        } catch (err: any) {
          console.error("MonacoDiff wrapper error:", err);
        }
      })();
      return () => {
        active = false;
      };
    }
  }, [original, modified, originalLanguage, modifiedLanguage]);

  const wcProps: Record<string, any> & { ref: React.RefCallback<HTMLElement> } = { ...rest, ref: setRef };

  if (theme !== undefined) wcProps["theme"] = theme;
  if (language !== undefined) wcProps["language"] = language;

  
  return React.createElement("monaco-diff", wcProps, children);
});

export default MonacoDiff;
