/**
 * React demo, imperative flavour: <MonacoDiff> gets no props, everything is pushed through the element ref
 * and its manager. Page chrome, URL state and form controls are in MonacoDiffDemoPage.tsx.
 */
import { useLayoutEffect, useRef } from "react";
import MonacoDiffDemoPage from "./MonacoDiffDemoPage";
import type { DemoEditorProps } from "./MonacoDiffDemoPage";
import { MonacoDiff } from "../../../web-component/react";
import type { MonacoDiffElement } from "../../../web-component/react";

function ImperativeEditor({ theme, language, original, modified }: DemoEditorProps) {
  // Ref to the underlying <composite-monaco-diff> web component element
  const diffRef = useRef<MonacoDiffElement>(null);

  // Imperative updates via the manager — avoids attribute round-trips
  useLayoutEffect(() => {
    const el = diffRef.current;
    if (!el) return;

    // All of these are safe before the editor is ready: the manager keeps the values and uses them
    // when it creates the editor, so there is no need to wait for whenReady() here.
    const mgr = el.getManager();

    // Theme — global in Monaco: this changes every Monaco editor on the page
    mgr.setTheme(theme);

    // Shared language of both sides
    mgr.setLanguage(language);

    // Text
    mgr.setOriginal(original);
    mgr.setModified(modified);
  }, [theme, language, original, modified]);

  /* theme/language/original/modified are driven via the manager ref, not as attributes */
  return <MonacoDiff ref={diffRef} />;
}

export default function MonacoDiffDemo() {
  return (
    <MonacoDiffDemoPage
      title="Monaco Diff React Demo - Js"
      sourceFile="MonacoDiffDemo.tsx"
      renderEditor={(props) => <ImperativeEditor {...props} />}
    />
  );
}
