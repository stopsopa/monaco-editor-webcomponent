import assert from "node:assert";
import { it, determineMode } from "../lib/utils.ts";

import trimLeft from "./trimLeft.ts";

determineMode(import.meta.url);

/**
 * CONCURRENCY=10 node --test web-component/trimLeft.parallel.test.ts
 */
it("auto detect indentation", () => {
  const result = trimLeft(
    `
    a
      b
        c
`,
  );

  assert.strictEqual(result, ["", "a", "  b", "    c", ""].join("\n"));
});

it("auto detect indentation ignores blank lines", () => {
  const result = trimLeft(
    `
    
      a

        b

`,
  );

  assert.strictEqual(result, ["", "", "a", "", "  b", "", ""].join("\n"));
});

it("auto detect does nothing when one line starts at column 0", () => {
  const result = trimLeft(["a", "  b", "    c"].join("\n"));

  assert.strictEqual(result, ["a", "  b", "    c"].join("\n"));
});

it("all blank lines", () => {
  const result = trimLeft("\n\n\n");

  assert.strictEqual(result, "\n\n\n");
});

it("offset", () => {
  const result = trimLeft(["a", "  b", "    c"].join("\n"), 2);

  assert.strictEqual(result, ["  a", "    b", "      c"].join("\n"));
});

it("offset null", () => {
  try {
    const n: number | null = null;

    const k = n as unknown as number;

    trimLeft(["a", "  b", "    c"].join("\n"), k);

    throw new Error(`shouldn't happen`);
  } catch (e) {
    assert.strictEqual(String(e), "Error: offset must be a number, null");
  }
});

it("offset negative", () => {
  try {
    trimLeft(["a", "  b", "    c"].join("\n"), -2);

    throw new Error(`shouldn't happen`);
  } catch (e) {
    assert.strictEqual(String(e), "Error: offset must be a non-negative number, -2");
  }
});
