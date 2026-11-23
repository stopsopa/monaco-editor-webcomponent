import { test, expect } from "@playwright/test";

import { collectPageErrors, expectEditorBackground, getDiffState } from "../../../test/lib.ts";

/**
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh web-component/web-component/from-scripts/index.e2e.ts
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- web-component/web-component/from-scripts/index.e2e.ts
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- --debug -- web-component/web-component/from-scripts/index.e2e.ts
 *
 * ./node_modules/.bin/playwright codegen http://localhost:8089/web-component/manager/index.html
 *
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- web-component/web-component/from-scripts/index.e2e.ts -g "build list"
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- --debug -- web-component/web-component/from-scripts/index.e2e.ts
 * NODE_API_PROTOCOL=http NODE_API_HOST=0.0.0.0 NODE_API_PORT=8089 /bin/bash playwright.sh -- --debug -g "build list" -- web-component/web-component/from-scripts/index.e2e.ts
 *
 */
const PAGE = "/web-component/web-component/from-scripts/index.html";

test("default", async ({ page }) => {
  await page.goto(PAGE);

  await expectEditorBackground(page, "rgb(255, 255, 254)");
});

test("dark", async ({ page }) => {
  await page.goto(PAGE);

  await page.getByLabel("Theme").selectOption("vs-dark");

  await expect(page).toHaveURL(`${PAGE}?theme=vs-dark`);

  await expectEditorBackground(page, "rgb(30, 30, 30)");
});

test("declarative content: de-indented, data-offset applied, no blank first/last line, read-only", async ({ page }) => {
  await page.goto(PAGE);

  const state = await getDiffState(page);

  // data-offset="3" in the page -> every line starts with 3 spaces after the common indentation is removed
  expect(state.original.split("\n")[0]).toBe("   const loadMonaco = (vsPath = VS_PATH) =>");
  expect(state.original.endsWith("     });")).toBe(true);
  expect(state.modified).toContain('script.added = "stuff";');
  // empty lines are not padded
  expect(state.original.split("\n")).toContain("");
  expect(state.readOnly).toBe(true);
  expect(state.editors).toBe(1);
});

test("moving the element keeps the editor, removing + re-attaching restores the content", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto(PAGE);

  await getDiffState(page);

  const result = await page.evaluate(async () => {
    const el = document.querySelector("composite-monaco-diff") as any;
    const managerBefore = el.getManager();

    // 1. plain move inside the document
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const sameManagerAfterMove = el.getManager() === managerBefore;

    // 2. change the content through the API, then really remove the element
    el.modified = "changed through the api";
    el.remove();
    await new Promise((resolve) => setTimeout(resolve, 50));

    let hasManagerWhileDetached = true;
    try {
      el.getManager();
    } catch {
      hasManagerWhileDetached = false;
    }

    // whenReady() on a detached element is a pending promise, not an exception
    const pending = el.whenReady();

    document.body.appendChild(el);
    const ready = await pending;

    return {
      sameManagerAfterMove,
      hasManagerWhileDetached,
      modified: ready.modified.getValue(),
      originalFirstLine: ready.original.getValue().split("\n")[0],
      editors: el.shadowRoot.querySelectorAll(".monaco-diff-editor").length,
    };
  });

  expect(result).toEqual({
    sameManagerAfterMove: true,
    hasManagerWhileDetached: false,
    modified: "changed through the api",
    originalFirstLine: "   const loadMonaco = (vsPath = VS_PATH) =>",
    editors: 1,
  });

  expect(errors).toEqual([]);
});

test("removing the element while Monaco is still loading does not leave an editor behind", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto(PAGE);

  const result = await page.evaluate(async () => {
    const el = document.createElement("composite-monaco-diff") as any;
    document.body.appendChild(el);
    const manager = el.getManager();
    const ready = manager.whenReady().then(
      () => "resolved",
      (error: Error) => error.name,
    );

    // destroyed before it had any chance to become ready
    manager.destroy();
    el.remove();

    const outcome = await ready;
    await new Promise((resolve) => setTimeout(resolve, 300));

    return { outcome, editors: el.shadowRoot.querySelectorAll(".monaco-diff-editor").length };
  });

  expect(result).toEqual({ outcome: "MonacoDiffDestroyedError", editors: 0 });
  expect(errors).toEqual([]);
});

test("wrong markup rejects whenReady() with the real reason and dispatches an error event", async ({ page }) => {
  await page.goto(PAGE);

  const result = await page.evaluate(async () => {
    const el = document.createElement("composite-monaco-diff") as any;
    el.innerHTML = `<script type="text/original">a</scr` + `ipt>`;

    let eventMessage = "";
    el.addEventListener("error", (event: CustomEvent) => {
      eventMessage = event.detail.error.message;
    });

    document.body.appendChild(el);

    const message = await el.whenReady().then(
      () => "resolved",
      (error: Error) => error.message,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    return { message, eventMessage };
  });

  expect(result.message).toContain('missing <script type="text/modified">');
  expect(result.eventMessage).toBe(result.message);
});

test("per-script lang wins over the language attribute, at creation and on later changes", async ({ page }) => {
  await page.goto(PAGE);

  const result = await page.evaluate(async () => {
    const el = document.createElement("composite-monaco-diff") as any;
    el.setAttribute("language", "json");
    el.innerHTML =
      `<script type="text/original" lang="typescript">const a: number = 1;</scr` +
      `ipt>` +
      `<script type="text/modified">const a = 2;</scr` +
      `ipt>`;
    document.body.appendChild(el);

    const ready = await el.whenReady();
    const atCreation = [ready.original.getLanguageId(), ready.modified.getLanguageId()];

    el.setAttribute("language", "css");
    const afterChange = [ready.original.getLanguageId(), ready.modified.getLanguageId()];

    el.removeAttribute("language");
    const afterRemoval = [ready.original.getLanguageId(), ready.modified.getLanguageId()];

    return { atCreation, afterChange, afterRemoval };
  });

  expect(result).toEqual({
    atCreation: ["typescript", "json"],
    afterChange: ["typescript", "css"],
    afterRemoval: ["typescript", "javascript"],
  });
});

test("editable attribute: user edits are reported through the change event", async ({ page }) => {
  await page.goto(PAGE);

  await getDiffState(page);

  const result = await page.evaluate(async () => {
    const el = document.querySelector("composite-monaco-diff") as any;
    const { editor, modified } = await el.whenReady();

    const events: string[] = [];
    el.addEventListener("change", (event: CustomEvent) => events.push(event.detail.modified.split("\n")[0]));

    // programmatic replacement is not a user edit
    el.modified = "line one";

    el.setAttribute("editable", "");
    const readOnlyAfterAttribute = el.getManager().isReadOnly();

    // what typing does: an edit operation on the modified editor
    editor.getModifiedEditor().executeEdits("e2e", [
      { range: modified.getFullModelRange(), text: "typed by the user", forceMoveMarkers: true },
    ]);

    return { events, readOnlyAfterAttribute };
  });

  expect(result).toEqual({ events: ["typed by the user"], readOnlyAfterAttribute: false });
});
