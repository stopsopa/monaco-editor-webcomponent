import { test, expect } from "@playwright/test";

import { expectEditorBackground } from "../../test/lib.ts";

/**
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh web-component/manager/index.e2e.ts
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- web-component/manager/index.e2e.ts
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- --debug -- web-component/manager/index.e2e.ts
 *
 * ./node_modules/.bin/playwright codegen http://localhost:8089/web-component/manager/index.html
 *
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- web-component/manager/index.e2e.ts -g "build list"
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- --debug -- web-component/manager/index.e2e.ts
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- --debug -g "build list" -- web-component/manager/index.e2e.ts
 *
 */
test("default", async ({ page }) => {
  await page.goto("/web-component/manager/index.html");

  await expectEditorBackground(page, "rgb(255, 255, 254)");
});

test("dark", async ({ page }) => {
  await page.goto("/web-component/manager/index.html");

  await page.getByLabel("Theme").selectOption("vs-dark");

  await expect(page).toHaveURL("/web-component/manager/index.html?theme=vs-dark");

  await expectEditorBackground(page, "rgb(30, 30, 30)");
});

test("the size declared in the HTML is the default (300px editor is not shrunk by the URL sync)", async ({ page }) => {
  await page.goto("/web-component/manager/index.html");

  await expectEditorBackground(page, "rgb(255, 255, 254)");

  const resizer = page.locator("center-and-height-resizer").nth(1);

  await expect(resizer).toHaveAttribute("height", "300px");

  // defaults are not written to the URL
  await expect(page).toHaveURL("/web-component/manager/index.html");
});

test("invalid values in the URL fall back to the defaults and are removed from the URL", async ({ page }) => {
  await page.goto("/web-component/manager/index.html?lang=bogus&theme=nope&h-1=450px");

  await expectEditorBackground(page, "rgb(255, 255, 254)");

  await expect(page.getByLabel("Language")).toHaveValue("javascript");
  await expect(page.getByLabel("Theme")).toHaveValue("");
  await expect(page.locator("center-and-height-resizer").nth(1)).toHaveAttribute("height", "450px");

  await expect(page).toHaveURL("/web-component/manager/index.html?h-1=450px");
});
