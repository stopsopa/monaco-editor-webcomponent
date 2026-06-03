import { test, expect } from "@playwright/test";

import { softNavigate, clickSelector, prepare, compareSelectedItems } from "../../test/lib.ts";

/**
 * /bin/bash playwright.sh vite-project/src/App.e2e.ts
 * /bin/bash playwright.sh -- vite-project/src/App.e2e.ts
 * /bin/bash playwright.sh -- --debug -- vite-project/src/App.e2e.ts
 *
 * ./node_modules/.bin/playwright codegen http://0.0.0.0:5678/vite-project/dist/
 *
 * /bin/bash playwright.sh -- vite-project/src/App.e2e.ts -g "build list"
 * /bin/bash playwright.sh -- --debug -g "build list" -- vite-project/src/App.e2e.ts
 *
 */
test("nvaite to preselect 3", async ({ page }) => {
  await prepare(page, '[data-testid="composite-select-demo"]');

  await softNavigate(
    page,
    '/vite-project/dist/composite-select-demo?emp-1=1&s-1=%5B"google_keep.png"%2C"chatgpt.png"%2C"claude.png"%5D',
  );

  await compareSelectedItems(page, '[data-testid="selectedItems"]', [
    { color: "#4285f4", id: "google_keep.png", img: "google_keep.png", label: "google_keep", selected: true },
    { color: "#0f9d58", id: "chatgpt.png", img: "chatgpt.png", label: "chatgpt", selected: true },
    { color: "#0f9d58", id: "claude.png", img: "claude.png", label: "claude", selected: true },
  ]);
});

test("remove one from preselected 3", async ({ page }) => {
  await prepare(page, '[data-testid="composite-select-demo"]');

  await softNavigate(
    page,
    '/vite-project/dist/composite-select-demo?emp-1=1&s-1=%5B"google_keep.png"%2C"chatgpt.png"%2C"claude.png"%5D',
  );

  await clickSelector(page, '[data-remove="chatgpt.png"]');

  // console.log();

  await compareSelectedItems(page, '[data-testid="selectedItems"]', [
    { color: "#4285f4", id: "google_keep.png", img: "google_keep.png", label: "google_keep", selected: true },
    { color: "#0f9d58", id: "claude.png", img: "claude.png", label: "claude", selected: true },
  ]);
});

test("build list", async ({ page }) => {
  await prepare(page, '[data-testid="composite-select-demo"]');
  // await page.goto('http://0.0.0.0:5678/vite-project/dist/');

  await page.getByTestId("composite-select-demo").click();

  await page.getByRole("button", { name: "google_drive.png" }).click();
  await page.getByRole("button", { name: "google_keep.png" }).click();
  await page.locator("composite-select").getByRole("textbox").click();
  await page
    .locator("div")
    .filter({ hasText: /^albattani$/ })
    .click();
  await page.getByRole("button", { name: "OK" }).click();

  await expect(page.locator("body")).toHaveCount(1);
});
