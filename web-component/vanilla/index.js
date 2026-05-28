import "../CenterAndHeightResizer.js";

import { MonacoDiffManager } from "./MonacoDiffManager.js";

const original = `
function hello() {
  console.log('before');
  return 1;
}
`.trim();

const modified = `
function helloWorld() {
  console.log('before');
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

console.log("mgr: ", mgr);
