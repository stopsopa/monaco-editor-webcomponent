import { test, expect } from "@playwright/test";

import { collectPageErrors, getDiffState } from "../test/lib.ts";

/**
 * Every published example has to render real content with the code of this commit.
 *
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- docs/examples.e2e.ts
 */
for (const n of [1, 2, 3, 4, 5]) {
  test(`docs/example${n}.html renders both sides`, async ({ page }) => {
    const errors = collectPageErrors(page);

    const failedRequests: string[] = [];
    page.on("requestfailed", (request) => failedRequests.push(request.url()));

    await page.goto(`/docs/example${n}.html`);

    const state = await getDiffState(page);

    // example 5 fills the editor from JavaScript after the element exists
    await expect
      .poll(async () => (await getDiffState(page)).original)
      .toContain("const loadMonaco = (vsPath = VS_PATH) =>");

    expect((await getDiffState(page)).modified).toContain("new Promise((resolve, reject) => {");
    expect(state.editors).toBe(1);

    expect(errors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
}

test("docs/api.html has no reference to a local dev server", async ({ page }) => {
  await page.goto("/docs/api.html");

  const html = await page.content();

  expect(html).not.toContain("0.0.0.0");
  expect(html).not.toContain("localhost");
});
