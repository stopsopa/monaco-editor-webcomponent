import { MonacoDiffManager } from "./MonacoDiffManager.js";
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
const inlineCheckbox = document.querySelector(".inline-it");
const swapBtn = document.getElementById("swap-btn");
const mgr = new MonacoDiffManager(container, {
  original,
  modified,
  language: "javascript",
});
void mgr.whenReady().then(() => {
  inlineCheckbox?.addEventListener("change", () => {
    mgr.setInline(!!inlineCheckbox.checked);
  });
  swapBtn?.addEventListener("click", () => {
    const left = mgr.left.get();
    const right = mgr.right.get();
    mgr.left.set(right);
    mgr.right.set(left);
  });
});
