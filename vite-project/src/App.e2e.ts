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
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- --debug -g "build list" -- vite-project/src/App.e2e.ts
 *
 */
test("dark", async ({ page }) => {
  await page.goto("/vite-project/dist/");
  await page.getByTestId("composite-monaco-diff-demo").click();
  // await page.getByRole("banner").getByRole("combobox").selectOption("vs");

  // don't goto but just check if path and search is equal to /vite-project/dist/composite-monaco-diff?theme=vs
  // await expect(page).toHaveURL("/vite-project/dist/composite-monaco-diff?theme=vs");

  const style = await page.evaluate(async () => {
    const timeout = 5000;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const el = document.querySelector("composite-monaco-diff") as any;
      console.log("el", el, "el?.shadowRoot", el?.shadowRoot);

      if (el?.shadowRoot) {
        await el.whenReady();

        const target = el.shadowRoot.querySelector(".original-in-monaco-diff-editor");

        console.log("target: ", target);

        if (target) {
          return window.getComputedStyle(target).backgroundColor;
        }
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    throw new Error("Timeout waiting for composite-monaco-diff style");
  });

  await expect(style).toEqual("rgb(30, 30, 30)");
});

test("white", async ({ page }) => {
  await page.goto("/vite-project/dist/");
  await page.getByTestId("composite-monaco-diff-demo").click();
  await page.getByRole("banner").getByRole("combobox").selectOption("vs");

  // don't goto but just check if path and search is equal to /vite-project/dist/composite-monaco-diff?theme=vs
  await expect(page).toHaveURL("/vite-project/dist/composite-monaco-diff?theme=vs");

  const style = await page.evaluate(async () => {
    const timeout = 5000;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const el = document.querySelector("composite-monaco-diff") as any;

      if (el?.shadowRoot) {
        await el.whenReady();

        const target = el.shadowRoot.querySelector(".original-in-monaco-diff-editor");

        if (target) {
          return window.getComputedStyle(target).backgroundColor;
        }
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    throw new Error("Timeout waiting for composite-monaco-diff style");
  });

  await expect(style).toEqual("rgb(255, 255, 254)");
});

test("dark attr", async ({ page }) => {
  await page.goto("/vite-project/dist/");
  await page.getByTestId("composite-monaco-diff-demo-attr").click();
  // await page.getByRole("banner").getByRole("combobox").selectOption("vs");

  // don't goto but just check if path and search is equal to /vite-project/dist/composite-monaco-diff?theme=vs
  // await expect(page).toHaveURL("/vite-project/dist/composite-monaco-diff?theme=vs");

  const style = await page.evaluate(async () => {
    const timeout = 5000;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const el = document.querySelector("composite-monaco-diff") as any;

      if (el?.shadowRoot) {
        await el.whenReady();

        const target = el.shadowRoot.querySelector(".original-in-monaco-diff-editor");

        if (target) {
          return window.getComputedStyle(target).backgroundColor;
        }
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    throw new Error("Timeout waiting for composite-monaco-diff style");
  });

  await expect(style).toEqual("rgb(30, 30, 30)");
});

test("white attr", async ({ page }) => {
  await page.goto("/vite-project/dist/");
  await page.getByTestId("composite-monaco-diff-demo-attr").click();

  {
    const style = await page.evaluate(async () => {
      const timeout = 5000;
      const start = Date.now();

      while (Date.now() - start < timeout) {
        const el = document.querySelector("composite-monaco-diff") as any;

        if (el?.shadowRoot) {
          await el.whenReady();

          const target = el.shadowRoot.querySelector(".original-in-monaco-diff-editor");

          if (target) {
            return window.getComputedStyle(target).backgroundColor;
          }
        }

        await new Promise((r) => setTimeout(r, 200));
      }

      throw new Error("Timeout waiting for composite-monaco-diff style");
    });

    await expect(style).toEqual("rgb(30, 30, 30)");
  }

  await page.getByRole("banner").getByRole("combobox").selectOption("vs");

  // don't goto but just check if path and search is equal to /vite-project/dist/composite-monaco-diff?theme=vs
  await expect(page).toHaveURL("/vite-project/dist/composite-monaco-diff-attr?theme=vs");

  {
    const style = await page.evaluate(async () => {
      const timeout = 5000;
      const start = Date.now();

      while (Date.now() - start < timeout) {
        const el = document.querySelector("composite-monaco-diff") as any;

        if (el?.shadowRoot) {
          await el.whenReady();

          const target = el.shadowRoot.querySelector(".original-in-monaco-diff-editor");

          if (target) {
            return window.getComputedStyle(target).backgroundColor;
          }
        }

        await new Promise((r) => setTimeout(r, 200));
      }

      throw new Error("Timeout waiting for composite-monaco-diff style");
    });

    await expect(style).toEqual("rgb(255, 255, 254)");
  }
});
