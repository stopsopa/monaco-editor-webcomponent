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

/**
 * Helpers for the Monaco diff pages.
 *
 * They work for both flavours of pages: `<composite-monaco-diff>` (editor inside a shadow root) and a bare
 * MonacoDiffManager mounted into a light-DOM container (web-component/manager/index.html).
 */

const EDITOR_TIMEOUT = 15_000;

/** Background colour of the original pane of the first diff editor on the page, or null while it is not there. */
export async function getEditorBackground(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const host = document.querySelector("composite-monaco-diff");
    const root: ParentNode = host?.shadowRoot ?? document;
    const target = root.querySelector(".original-in-monaco-diff-editor");
    return target ? window.getComputedStyle(target).backgroundColor : null;
  });
}

/** Waits until the first diff editor is rendered with the given background colour ("rgb(30, 30, 30)" = vs-dark). */
export async function expectEditorBackground(page: Page, color: string) {
  await expect.poll(() => getEditorBackground(page), { timeout: EDITOR_TIMEOUT }).toBe(color);
}

export type DiffState = {
  original: string;
  modified: string;
  originalLanguage: string;
  modifiedLanguage: string;
  readOnly: boolean;
  /** how many Monaco diff editors are mounted inside this element (must always be 1) */
  editors: number;
};

/** Waits for the n-th `<composite-monaco-diff>` to be ready and returns what its editor really contains. */
export async function getDiffState(page: Page, index = 0): Promise<DiffState> {
  await expect(page.locator("composite-monaco-diff").nth(index)).toBeAttached({ timeout: EDITOR_TIMEOUT });

  return page.evaluate(async (index) => {
    const el = document.querySelectorAll("composite-monaco-diff")[index] as any;
    const ready = await el.whenReady();
    return {
      original: ready.original.getValue() as string,
      modified: ready.modified.getValue() as string,
      originalLanguage: ready.original.getLanguageId() as string,
      modifiedLanguage: ready.modified.getLanguageId() as string,
      readOnly: el.getManager().isReadOnly() as boolean,
      editors: el.shadowRoot.querySelectorAll(".monaco-diff-editor").length as number,
    };
  }, index);
}

/**
 * Collects uncaught page errors; assert `errors` is empty at the end of a test.
 *
 * "Canceled" is skipped: it is Monaco's internal CancellationError, rejected (and handled by nobody inside
 * Monaco) when an editor is disposed while a diff computation is still pending. Harmless.
 */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    if (error.message === "Canceled") return;
    errors.push(error.message);
  });
  return errors;
}
