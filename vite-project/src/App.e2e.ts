import { test, expect } from "@playwright/test";

import { softNavigate, clickSelector, prepare, compareSelectedItems } from "../../test/lib.ts";

/**
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh vite-project/src/App.e2e.ts
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- vite-project/src/App.e2e.ts
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- --debug -- vite-project/src/App.e2e.ts
 *
 * ./node_modules/.bin/playwright codegen http://localhost:8089/vite-project/dist/
 *
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- vite-project/src/App.e2e.ts -g "build list"
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- --debug -- vite-project/src/App.e2e.ts
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- --debug -g "build list" -- vite-project/src/App.e2e.ts
 *
 */
test("default", async ({ page }) => {
  await page.goto("/vite-project/dist/");
  await page.getByTestId("monaco-diff-demo").click();
  // await page.getByRole("banner").getByRole("combobox").selectOption("vs");

  // don't goto but just check if path and search is equal to /vite-project/dist/monaco-diff?theme=vs
  // await expect(page).toHaveURL("/vite-project/dist/monaco-diff?theme=vs");

  const style = await page.evaluate(async () => {
    const timeout = 5000;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const el = document.querySelector("monaco-diff") as any;

      if (el?.shadowRoot) {
        await el.whenReady();

        const target = el.shadowRoot.querySelector(".original-in-monaco-diff-editor");

        if (target) {
          return window.getComputedStyle(target).backgroundColor;
        }
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    throw new Error("Timeout waiting for monaco-diff style");
  });

  await expect(style).toEqual("rgb(30, 30, 30)");
});

test("dark", async ({ page }) => {
  await page.goto("/vite-project/dist/");
  await page.getByTestId("monaco-diff-demo").click();
  await page.getByRole("banner").getByRole("combobox").selectOption("vs");

  // don't goto but just check if path and search is equal to /vite-project/dist/monaco-diff?theme=vs
  await expect(page).toHaveURL("/vite-project/dist/monaco-diff?theme=vs");

  const style = await page.evaluate(async () => {
    const timeout = 5000;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const el = document.querySelector("monaco-diff") as any;

      if (el?.shadowRoot) {
        await el.whenReady();

        const target = el.shadowRoot.querySelector(".original-in-monaco-diff-editor");

        if (target) {
          return window.getComputedStyle(target).backgroundColor;
        }
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    throw new Error("Timeout waiting for monaco-diff style");
  });

  await expect(style).toEqual("rgb(255, 255, 254)");
});

// test("remove one from preselected 3", async ({ page }) => {
//   await prepare(page, '[data-testid="composite-select-demo"]');

//   await softNavigate(
//     page,
//     '/vite-project/dist/composite-select-demo?emp-1=1&s-1=%5B"google_keep.png"%2C"chatgpt.png"%2C"claude.png"%5D',
//   );

//   await clickSelector(page, '[data-remove="chatgpt.png"]');

//   // console.log();

//   await compareSelectedItems(page, '[data-testid="selectedItems"]', [
//     { color: "#4285f4", id: "google_keep.png", img: "google_keep.png", label: "google_keep", selected: true },
//     { color: "#0f9d58", id: "claude.png", img: "claude.png", label: "claude", selected: true },
//   ]);
// });

// test("build list", async ({ page }) => {
//   await prepare(page, '[data-testid="composite-select-demo"]');
//   // await page.goto('http://0.0.0.0:5699/vite-project/dist/');

//   await page.getByTestId("composite-select-demo").click();

//   await page.getByRole("button", { name: "google_drive.png" }).click();
//   await page.getByRole("button", { name: "google_keep.png" }).click();
//   await page.locator("composite-select").getByRole("textbox").click();
//   await page
//     .locator("div")
//     .filter({ hasText: /^albattani$/ })
//     .click();
//   await page.getByRole("button", { name: "OK" }).click();

//   await expect(page.locator("body")).toHaveCount(1);
// });
