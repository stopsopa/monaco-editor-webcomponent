import { expect, type Page } from "@playwright/test";

export async function softNavigate(page: Page, url: string) {
  await page.evaluate((url) => {
    window.history.pushState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
  }, url);
}

export async function querySelector(page: Page, selector: string) {
  const linkLocator = page.locator(selector);
  await expect(linkLocator).toHaveCount(1);

  return linkLocator;
}

export async function clickSelector(page: Page, selector: string) {
  const selectorLocator = await querySelector(page, selector);

  await selectorLocator.click();
}

export async function prepare(page: Page, link: string) {
  await page.goto("/vite-project/dist/");

  const linkLocator = await querySelector(page, link);

  await expect(linkLocator).toHaveText("CompositeSelect Manager Demo");
}

type Options1Type = {
  decodeJson: boolean;
  formatter?: (data: any) => any;
};
export async function compareSelectedItems(page: Page, selector: string, data: string | any[], options?: Options1Type) {
  const { decodeJson = true, formatter } = options || {};

  const selectedItems = page.locator(selector);

  await expect.poll(async () => {
    try {
      let content = await selectedItems.innerHTML();
      if (decodeJson) {
        content = JSON.parse(content);
      }
      if (typeof formatter === "function") {
        content = formatter(content);
      }
      return content;
    } catch (e) {
      return null;
    }
  }).toEqual(data);
}
