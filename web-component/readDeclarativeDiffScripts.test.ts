import assert from "node:assert";
import { describe, it } from "node:test";

import { normalizeDeclarativeText, readDeclarativeDiffScripts, readOffset } from "./MonacoDiffManager.ts";

/**
 * Run after a build (MonacoDiffManager.ts imports the compiled ./trimLeft.js):
 *
 * node --test web-component/readDeclarativeDiffScripts.test.ts
 *
 * No DOM is needed: readDeclarativeDiffScripts only calls querySelectorAll / getAttribute / textContent,
 * so a tiny fake host is enough.
 */
type FakeScript = { type: string; text: string; attrs?: Record<string, string> };

function fakeHost(scripts: FakeScript[]): HTMLElement {
  const nodes = scripts.map((script) => ({
    textContent: script.text,
    getAttribute: (name: string) => (name === "type" ? script.type : (script.attrs?.[name] ?? null)),
  }));

  return {
    // the real selector keeps only text/original + text/modified children
    querySelectorAll: () => nodes.filter((node) => ["text/original", "text/modified"].includes(node.getAttribute("type")!)),
  } as unknown as HTMLElement;
}

const body = (text: string) => `\n      ${text}\n    `;

describe("readOffset", () => {
  it("missing attribute means 0", () => {
    assert.strictEqual(readOffset(null, "text/original"), 0);
  });

  it("empty attribute means 0", () => {
    assert.strictEqual(readOffset("  ", "text/original"), 0);
  });

  it("accepts 0", () => {
    assert.strictEqual(readOffset("0", "text/original"), 0);
  });

  it("accepts a positive integer", () => {
    assert.strictEqual(readOffset("3", "text/original"), 3);
  });

  for (const bad of ["abc", "-1", "3abc", "2.7"]) {
    it(`rejects >${bad}<`, () => {
      assert.throws(() => readOffset(bad, "text/modified"), /data-offset must be a non-negative integer, got >/);
    });
  }
});

describe("normalizeDeclarativeText", () => {
  it("drops the line break after the opening tag and the indentation before the closing tag", () => {
    assert.strictEqual(normalizeDeclarativeText("\n      a\n        b\n    ", 0), "a\n  b");
  });

  it("keeps blank lines inside the content and does not pad them", () => {
    assert.strictEqual(normalizeDeclarativeText("\n    a\n\n    b\n  ", 2), "  a\n\n  b");
  });

  it("leaves single line content alone", () => {
    assert.strictEqual(normalizeDeclarativeText("const a = 1;", 0), "const a = 1;");
  });
});

describe("readDeclarativeDiffScripts", () => {
  it("returns null without scripts", () => {
    assert.strictEqual(readDeclarativeDiffScripts(fakeHost([])), null);
  });

  it("reads both sides without data-offset", () => {
    const result = readDeclarativeDiffScripts(
      fakeHost([
        { type: "text/original", text: body("const a = 1;"), attrs: { lang: "javascript" } },
        { type: "text/modified", text: body("const a = 2;"), attrs: { lang: "typescript" } },
      ]),
    );

    assert.deepStrictEqual(result, {
      original: "const a = 1;",
      modified: "const a = 2;",
      originalLanguage: "javascript",
      modifiedLanguage: "typescript",
    });
  });

  it("applies data-offset per script", () => {
    const result = readDeclarativeDiffScripts(
      fakeHost([
        { type: "text/original", text: body("a"), attrs: { "data-offset": "0" } },
        { type: "text/modified", text: body("b"), attrs: { "data-offset": "3" } },
      ]),
    );

    assert.strictEqual(result?.original, "a");
    assert.strictEqual(result?.modified, "   b");
    assert.strictEqual(result?.originalLanguage, undefined);
  });

  it("ignores other script children", () => {
    const result = readDeclarativeDiffScripts(
      fakeHost([
        { type: "application/json", text: "{}" },
        { type: "text/original", text: "a" },
        { type: "text/modified", text: "b" },
      ]),
    );

    assert.strictEqual(result?.original, "a");
  });

  it("reports the missing side precisely", () => {
    assert.throws(
      () => readDeclarativeDiffScripts(fakeHost([{ type: "text/original", text: "a" }])),
      /missing <script type="text\/modified">/,
    );
  });

  it("reports duplicates", () => {
    assert.throws(
      () =>
        readDeclarativeDiffScripts(
          fakeHost([
            { type: "text/original", text: "a" },
            { type: "text/original", text: "b" },
            { type: "text/modified", text: "c" },
          ]),
        ),
      /duplicate <script type="text\/original">/,
    );
  });

  it("reports a wrong data-offset", () => {
    assert.throws(
      () =>
        readDeclarativeDiffScripts(
          fakeHost([
            { type: "text/original", text: "a", attrs: { "data-offset": "x" } },
            { type: "text/modified", text: "b" },
          ]),
        ),
      /data-offset must be a non-negative integer/,
    );
  });
});
