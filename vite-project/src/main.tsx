import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";

// Expose global helpers to toggle strict mode and reload
(window as any).enableStrictMode = () => {
  localStorage.setItem("strict", "true");
  console.log("Strict Mode ENABLED. Reloading...");
  window.location.reload();
};

(window as any).disableStrictMode = () => {
  localStorage.removeItem("strict");
  console.log("Strict Mode DISABLED. Reloading...");
  window.location.reload();
};

// Toggle StrictMode via URL or localStorage
const USE_STRICT_MODE =
  new URLSearchParams(window.location.search).has("strict") || localStorage.getItem("strict") === "true";

console.log(
  `%cReact Strict Mode is currently ${USE_STRICT_MODE ? "ON" : "OFF"}`,
  `color: ${USE_STRICT_MODE ? "#10b981" : "#ef4444"}; font-weight: bold; font-size: 14px;`,
);
console.log("💡 Run enableStrictMode() or disableStrictMode() in this console to toggle.");

const getBasename = () => {
  let path = window.location.pathname;
  if (path.startsWith("/vite-project/dist")) {
    return "/vite-project/dist";
  }
  return "/";
};

const AppTree = (
  <BrowserRouter basename={getBasename()}>
    <App />
  </BrowserRouter>
);

createRoot(document.getElementById("root")!).render(USE_STRICT_MODE ? <StrictMode>{AppTree}</StrictMode> : AppTree);
