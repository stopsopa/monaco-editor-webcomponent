import { test, expect } from "@playwright/test";

import { expectEditorBackground, getDiffState } from "../../../test/lib.ts";

/**
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh web-component/web-component/from-js/index.e2e.ts
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- web-component/web-component/from-js/index.e2e.ts
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- --debug -- web-component/web-component/from-js/index.e2e.ts
 *
 * ./node_modules/.bin/playwright codegen http://localhost:8089/web-component/manager/index.html
 *
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- web-component/web-component/from-js/index.e2e.ts -g "build list"
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- --debug -- web-component/web-component/from-js/index.e2e.ts
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- --debug -g "build list" -- web-component/web-component/from-js/index.e2e.ts
 *
 */
test("default", async ({ page }) => {
  await page.goto("/web-component/web-component/from-js/index.html");

  await expectEditorBackground(page, "rgb(255, 255, 254)");
});

test("dark", async ({ page }) => {
  await page.goto("/web-component/web-component/from-js/index.html");

  await page.getByLabel("Theme").selectOption("vs-dark");

  await expect(page).toHaveURL("/web-component/web-component/from-js/index.html?theme=vs-dark");

  await expectEditorBackground(page, "rgb(30, 30, 30)");
});

test("content set through el.original / el.modified reaches the editor", async ({ page }) => {
  await page.goto("/web-component/web-component/from-js/index.html");

  const state = await getDiffState(page);

  expect(state.original).toContain("if (win.require && win.monaco) return resolve(win.monaco);");
  expect(state.modified).toContain("script.added = 'stuff'");
  expect(state.editors).toBe(1);
});

test("the language select changes both sides and lands in the URL", async ({ page }) => {
  await page.goto("/web-component/web-component/from-js/index.html");

  await getDiffState(page);

  await page.getByLabel("Language").selectOption("typescript");

  await expect(page).toHaveURL("/web-component/web-component/from-js/index.html?lang=typescript");

  await expect.poll(async () => (await getDiffState(page)).originalLanguage).toBe("typescript");
  expect((await getDiffState(page)).modifiedLanguage).toBe("typescript");
});
