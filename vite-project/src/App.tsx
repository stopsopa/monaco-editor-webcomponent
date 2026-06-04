import { Routes, Route, Link } from "react-router-dom";
import MonacoDiffDemoAttr from "./pages/MonacoDiffDemoAttr";
import MonacoDiffDemo from "./pages/MonacoDiffDemo";

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
            <Link to="/monaco-diff-attr" data-testid="monaco-diff-demo-attr" className="gcp-css">
              Monaco Diff Demo Attr
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
      <Route path="/monaco-diff" element={<MonacoDiffDemo />} />
      <Route path="/monaco-diff-attr" element={<MonacoDiffDemoAttr />} />
    </Routes>
  );
}

export default App;
