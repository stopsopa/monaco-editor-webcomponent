/**
 * React demo, declarative flavour: everything is passed to <MonacoDiff> as props.
 * Page chrome, URL state and form controls are in MonacoDiffDemoPage.tsx.
 */
import MonacoDiffDemoPage from "./MonacoDiffDemoPage";
import { MonacoDiff } from "../../../web-component/react";

export default function MonacoDiffDemoAttr() {
  return (
    <MonacoDiffDemoPage
      title="Monaco Diff React Demo - Attr"
      sourceFile="MonacoDiffDemoAttr.tsx"
      renderEditor={({ theme, language, original, modified }) => (
        <MonacoDiff theme={theme} language={language} original={original} modified={modified} />
      )}
    />
  );
}
