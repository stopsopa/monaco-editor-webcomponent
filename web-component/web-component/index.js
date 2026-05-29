import "../CenterAndHeightResizer.js";
import modURLSearchParams from "../urlchange/urlchange.js";
import { MonacoDiffManager } from "./MonacoDiffManager.js";
const instanceKeyFn = (key, i) => `${key}-${i}`;
function createResizerParamConfig(resizer) {
  return {
    left: {
      default: resizer.getAttribute("left") ?? "100px",
      getParam: "l",
      encode: (value) => value,
      decode: (value) => value,
    },
    center: {
      default: resizer.getAttribute("center") ?? "1200px",
      getParam: "c",
      encode: (value) => value,
      decode: (value) => value,
    },
    height: {
      default: resizer.getAttribute("height") ?? "100px",
      getParam: "h",
      encode: (value) => value,
      decode: (value) => value,
    },
  };
}
/** Indexed URL params (`l-0`, `c-0`, `h-0`, …) ↔ resizer attributes; drag events write back to the URL. */
function wireResizerUrlSync(resizer, index) {
  const config = createResizerParamConfig(resizer);
  const { trackUrl } = modURLSearchParams(config, instanceKeyFn);
  const applyParams = (params) => {
    resizer.setAttribute("left", params.left);
    resizer.setAttribute("center", params.center);
    resizer.setAttribute("height", params.height);
  };
  const { setParams, setParam } = trackUrl((params) => applyParams(params), { ctx: index, fireOnMount: true });
  const syncToUrl = () => {
    setParams({
      left: resizer.getAttribute("left") ?? config.left.default,
      center: resizer.getAttribute("center") ?? config.center.default,
      height: resizer.getAttribute("height") ?? config.height.default,
    });
  };
  resizer.addEventListener("onLeft", syncToUrl);
  resizer.addEventListener("onCenter", syncToUrl);
  resizer.addEventListener("onHeight", syncToUrl);
}
document.querySelectorAll("center-and-height-resizer").forEach((el, index) => {
  wireResizerUrlSync(el, index);
});
const original = `
function hello() {
  console.log('before');
  return 1;
}
`.trim();
const modified = `
function helloWorld() {
  console.log('after');
  return 2;
}
`.trim();
const container = document.getElementById("container");
if (!container) {
  throw new Error("Missing #container element");
}
const mgr = new MonacoDiffManager(container, {
  original,
  modified,
  language: "javascript",
});
await mgr.whenReady();
