// @ts-ignore
import React from "react";
import "./monaco-diff.js";
export const MonacoDiff = React.forwardRef((props, ref) => {
  const { theme, language, original, modified, originalLanguage, modifiedLanguage, children, ...rest } = props;
  const internalRef = React.useRef(null);
  const setRef = React.useCallback(
    (node) => {
      internalRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref],
  );
  React.useLayoutEffect(() => {
    const el = internalRef.current;
    if (el && el.getManager) {
      let active = true;
      (async () => {
        try {
          await el.whenReady();
          if (!active) return;
          const mgr = el.getManager();
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
        } catch (err) {
          console.error("MonacoDiff wrapper error:", err);
        }
      })();
      return () => {
        active = false;
      };
    }
  }, [original, modified, originalLanguage, modifiedLanguage]);
  const wcProps = { ...rest, ref: setRef };
  if (theme !== undefined) wcProps["theme"] = theme;
  if (language !== undefined) wcProps["language"] = language;
  return React.createElement("monaco-diff", wcProps, children);
});
export default MonacoDiff;
