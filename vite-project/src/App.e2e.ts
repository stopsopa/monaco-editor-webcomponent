import { test, expect } from "@playwright/test";

import { expectEditorBackground, getDiffState } from "../../test/lib.ts";

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

  await expectEditorBackground(page, "rgb(30, 30, 30)");
});

test("white", async ({ page }) => {
  await page.goto("/vite-project/dist/");
  await page.getByTestId("composite-monaco-diff-demo").click();
  await page.getByRole("banner").getByRole("combobox").selectOption("vs");

  // don't goto but just check if path and search is equal to /vite-project/dist/composite-monaco-diff?theme=vs
  await expect(page).toHaveURL("/vite-project/dist/composite-monaco-diff?theme=vs");

  await expectEditorBackground(page, "rgb(255, 255, 254)");
});

test("dark attr", async ({ page }) => {
  await page.goto("/vite-project/dist/");
  await page.getByTestId("composite-monaco-diff-demo-attr").click();

  await expectEditorBackground(page, "rgb(30, 30, 30)");
});

test("white attr", async ({ page }) => {
  await page.goto("/vite-project/dist/");
  await page.getByTestId("composite-monaco-diff-demo-attr").click();

  await expectEditorBackground(page, "rgb(30, 30, 30)");

  await page.getByRole("banner").getByRole("combobox").selectOption("vs");

  // don't goto but just check if path and search is equal to /vite-project/dist/composite-monaco-diff?theme=vs
  await expect(page).toHaveURL("/vite-project/dist/composite-monaco-diff-attr?theme=vs");

  await expectEditorBackground(page, "rgb(255, 255, 254)");
});

for (const route of ["composite-monaco-diff", "composite-monaco-diff-attr"]) {
  const base = `/vite-project/dist/${route}`;

  test(`${route}: props reach the editor, typing in the textarea updates it and the URL`, async ({ page }) => {
    await page.goto(base);

    const initial = await getDiffState(page);
    expect(initial.original).toBe("// Original code\nconst a = 1;\nconsole.log(a);");
    expect(initial.modified).toBe("// Modified code\nconst a = 2;\nconsole.log(a);");
    expect(initial.editors).toBe(1);

    await page.getByTestId("instance-1").locator("textarea").nth(1).fill("typed text");

    await expect.poll(async () => (await getDiffState(page)).modified).toBe("typed text");
    // lz-string compressed, written after the debounce
    await expect(page).toHaveURL(/[?&]mod-1=[^&]+/);
  });

  test(`${route}: broken values in the URL never reach the editor`, async ({ page }) => {
    // orig-1= decompresses to null, theme/lang are not valid options
    await page.goto(`${base}?orig-1=&theme=bogus&lang-1=nope`);

    const state = await getDiffState(page);
    expect(state.original).toBe("// Original code\nconst a = 1;\nconsole.log(a);");
    expect(state.originalLanguage).toBe("javascript");

    await expect(page.getByRole("banner").getByRole("combobox")).toHaveValue("vs-dark");
    await expectEditorBackground(page, "rgb(30, 30, 30)");
  });

  test(`${route}: add instance, switch language away and back, destroy`, async ({ page }) => {
    await page.goto(base);

    await getDiffState(page);

    // adding keeps instance #1 (it has only default values, so no keys of its own in the URL)
    await page.getByTestId("add-instance").click();

    await expect(page).toHaveURL(`${base}?ids=1%2C2`);
    await expect(page.locator("composite-monaco-diff")).toHaveCount(2);

    // back to the default language removes lang-2 from the URL - the instance must stay
    await page.getByTestId("language-2").selectOption("typescript");
    await expect(page).toHaveURL(`${base}?ids=1%2C2&lang-2=typescript`);
    await expect.poll(async () => (await getDiffState(page, 1)).modifiedLanguage).toBe("typescript");

    await page.getByTestId("language-2").selectOption("javascript");
    await expect(page).toHaveURL(`${base}?ids=1%2C2`);
    await expect(page.locator("composite-monaco-diff")).toHaveCount(2);

    // destroying an instance that has only default values works
    await page.getByTestId("instance-1").getByRole("button", { name: "Destroy" }).click();

    await expect(page).toHaveURL(`${base}?ids=2`);
    await expect(page.locator("composite-monaco-diff")).toHaveCount(1);
    await expect(page.getByTestId("instance-2")).toBeVisible();
  });
}
