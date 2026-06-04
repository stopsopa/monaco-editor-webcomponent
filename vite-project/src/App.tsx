import { Routes, Route, Link } from "react-router-dom";
import MonacoDiffDemoAttr from "./pages/MonacoDiffDemoAttr";
// import CompositeSelectDemo from "./pages/CompositeSelectDemo";
// import CompositeSelectDemoAttr from "./pages/CompositeSelectDemoAttr";
// import OptionsSectionDemo from "./pages/OptionsSectionDemo";
// import SelectedSectionDemo from "./pages/SelectedSectionDemo";
// import UrlSerialiser from "./pages/UrlSerialiser";
// import ModURLSearchParamsComponent from "./pages/params/ModURLSearchParamsComponent";
// import "composite-select/floating-label-pattern.css";
import "./App.css";

function Home() {
  return (
    <div className="homepage" style={{ padding: "40px" }}>
      <h1>Monaco Diff React Demos</h1>
      <nav>
        <ul>
          <li>
            <Link to="/monaco-diff" data-testid="monaco-diff-demo" className="gcp-css">
              Monaco Diff Demo
            </Link>
          </li>

          <li>
            <Link to="/composite-select-demo" data-testid="composite-select-demo" className="gcp-css">
              CompositeSelect Manager Demo
            </Link>
          </li>
          <li>
            <Link to="/composite-select-demo-attr" data-testid="composite-select-demo-attr" className="gcp-css">
              CompositeSelect Manager Demo (Attr)
            </Link>
          </li>
          <li>
            <Link to="/options-section-demo" data-testid="options-section-demo" className="gcp-css">
              OptionsSection Section Demo
            </Link>
          </li>
          <li>
            <Link to="/selected-section-demo" data-testid="selected-section-demo" className="gcp-css">
              SelectedSection Section Demo
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/monaco-diff" element={<MonacoDiffDemoAttr />} />
      {/* <Route path="/composite-select-demo-attr" element={<CompositeSelectDemoAttr />} />
      <Route path="/options-section-demo" element={<OptionsSectionDemo />} />
      <Route path="/selected-section-demo" element={<SelectedSectionDemo />} />
      <Route path="/url-serialiser" element={<UrlSerialiser />} />
      <Route path="/url-serialiser-mod" element={<ModURLSearchParamsComponent />} /> */}
    </Routes>
  );
}

export default App;
