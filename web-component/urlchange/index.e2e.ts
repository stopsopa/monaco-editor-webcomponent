import { test, expect, type Page } from "@playwright/test";

/**
 * Form state <-> URL round trips of the vanilla trackUrl demo.
 *
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- web-component/urlchange/index.e2e.ts
 */
const PAGE = "/web-component/urlchange/index.html";

const section = (page: Page, index: number) => page.locator(`.url-ser-container[data-index="${index}"]`);

async function dump(page: Page, index: number) {
  const text = await section(page, index).locator('[data-role="dump"]').textContent();
  return JSON.parse(text ?? "null");
}

test("deselecting every option of the multi select is [] after a reload, not ['']", async ({ page }) => {
  await page.goto(`${PAGE}?ids=1`);

  await section(page, 1).locator('[data-role="multi-select"]').selectOption([]);

  await expect(page).toHaveURL(`${PAGE}?ids=1&m-1=`);

  await page.reload();

  await expect.poll(async () => (await dump(page, 1)).params.multiSelect).toEqual([]);
  await expect(section(page, 1).locator('[data-role="multi-select"] option:checked')).toHaveCount(0);
});

test("an unknown radio value falls back to the default and is removed from the URL", async ({ page }) => {
  await page.goto(`${PAGE}?ids=1&r-1=bogus&m-1=item3.nope`);

  await expect(section(page, 1).locator('input[type="radio"][value="radio2"]')).toBeChecked();

  const state = await dump(page, 1);
  expect(state.params.radio).toBe("radio2");
  expect(state.params.multiSelect).toEqual(["item3"]);

  await expect(page).toHaveURL(`${PAGE}?ids=1&m-1=item3`);
});

test("typing is written to the URL (debounced) and survives a reload", async ({ page }) => {
  await page.goto(`${PAGE}?ids=1`);

  const input = section(page, 1).locator('[data-role="text"]');

  await input.focus();
  await input.press("End");
  await input.pressSequentially("-abc", { delay: 20 });

  // the dump (onChange) is immediate, the address bar follows after the debounce
  await expect.poll(async () => (await dump(page, 1)).params.text).toBe("default text-abc");
  await expect(page).toHaveURL(`${PAGE}?ids=1&t-1=default+text-abc`);

  await page.reload();

  await expect(section(page, 1).locator('[data-role="text"]')).toHaveValue("default text-abc");
});

test("add, deep link and delete instances", async ({ page }) => {
  // t-3 is a deep link without `ids`: the instance is found by its key and then made explicit
  await page.goto(`${PAGE}?t-3=cccc`);

  await expect(page).toHaveURL(`${PAGE}?ids=3&t-3=cccc`);
  await expect(page.locator(".url-ser-container")).toHaveCount(1);

  await page.getByRole("button", { name: "Add Text Param" }).click();

  await expect(page).toHaveURL(`${PAGE}?ids=3%2C4&t-3=cccc`);
  await expect(page.locator(".url-ser-container")).toHaveCount(2);

  // an instance with non-default params is removed together with its keys
  await section(page, 3).getByRole("button", { name: "Delete Component #3" }).click();

  await expect(page).toHaveURL(`${PAGE}?ids=4`);
  await expect(page.locator(".url-ser-container")).toHaveCount(1);

  // an instance with only default values can be deleted too
  await section(page, 4).getByRole("button", { name: "Delete Component #4" }).click();

  await expect(page).toHaveURL(PAGE);
  await expect(page.locator(".url-ser-container")).toHaveCount(0);
});
