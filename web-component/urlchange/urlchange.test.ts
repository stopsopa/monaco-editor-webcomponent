import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";

import modURLSearchParams, { listOf, oneOf, onUrlChange } from "./urlchange.ts";
import { hasExplicitInstanceIds, nextInstanceId, parseInstanceIds, withInstanceIds } from "./instanceIds.ts";

/**
 * Run after a build (urlchange.ts imports the compiled ./toolsURLSearchParams.js):
 *
 * node --test web-component/urlchange/urlchange.test.ts
 *
 * The module only needs window.location, window.add/removeEventListener and history - stubbed below.
 */
type Entry = { url: string };

let entries: Entry[] = [];
let calls: string[] = [];

function installBrowserStub(search: string) {
  entries = [{ url: `http://test.local/page${search}` }];
  calls = [];

  const current = () => new URL(entries[entries.length - 1].url);

  const history = {
    state: null,
    pushState(_state: unknown, _title: string, url: string) {
      calls.push("push");
      entries.push({ url: new URL(url, current()).toString() });
    },
    replaceState(_state: unknown, _title: string, url: string) {
      calls.push("replace");
      entries[entries.length - 1] = { url: new URL(url, current()).toString() };
    },
  };

  const window = {
    get location() {
      const url = current();
      return { search: url.search, href: url.toString() };
    },
    addEventListener() {},
    removeEventListener() {},
  };

  Object.assign(globalThis, { window, history });
}

const search = () => (globalThis as unknown as { window: { location: { search: string } } }).window.location.search;

const config = {
  text: { default: "", getParam: "t", encode: (v: string) => v, decode: (v: string) => v },
  mode: { default: "a" as "a" | "b", getParam: "m", encode: (v: "a" | "b") => v, decode: oneOf(["a", "b"], "a") },
  list: { default: ["x"] as ("x" | "y")[], getParam: "l", ...listOf(["x", "y"]) },
};

describe("oneOf / listOf", () => {
  it("oneOf falls back for unknown values", () => {
    const decode = oneOf(["radio1", "radio2"], "radio2");
    assert.strictEqual(decode("radio1"), "radio1");
    assert.strictEqual(decode("bogus"), "radio2");
    assert.strictEqual(decode(""), "radio2");
  });

  it("listOf round-trips the empty list", () => {
    const codec = listOf(["item1", "item2"]);
    assert.deepStrictEqual(codec.decode(codec.encode([])), []);
  });

  it("listOf round-trips values and drops unknown ones", () => {
    const codec = listOf(["item1", "item2"]);
    assert.deepStrictEqual(codec.decode(codec.encode(["item2", "item1"])), ["item2", "item1"]);
    assert.deepStrictEqual(codec.decode("item1.bogus..item2"), ["item1", "item2"]);
  });
});

describe("trackUrl", () => {
  const handles: { disconnect: () => void }[] = [];

  beforeEach(() => installBrowserStub(""));

  afterEach(() => {
    while (handles.length) handles.pop()!.disconnect();
  });

  const track = (options?: Parameters<ReturnType<typeof modURLSearchParams<typeof defaults>>["trackUrl"]>[1]) => {
    const seen: (typeof defaults)[] = [];
    const handle = modURLSearchParams<typeof defaults>(config).trackUrl((params) => seen.push(params), options);
    handles.push(handle);
    return { handle, seen };
  };

  const defaults = { text: "", mode: "a" as "a" | "b", list: ["x"] as ("x" | "y")[] };

  it("fires on mount with defaults", () => {
    const { seen } = track();
    assert.deepStrictEqual(seen, [defaults]);
    assert.deepStrictEqual(calls, []);
  });

  it("setParam writes the URL itself (replaceState by default)", () => {
    const { handle, seen } = track();
    handle.setParam("text", "hello");
    assert.strictEqual(search(), "?t=hello");
    assert.deepStrictEqual(calls, ["replace"]);
    assert.strictEqual(seen[seen.length - 1].text, "hello");
  });

  it("two consecutive setParam calls both end up in the URL", () => {
    const { handle } = track();
    handle.setParam("text", "hello");
    handle.setParam("mode", "b");
    assert.strictEqual(search(), "?m=b&t=hello");
    assert.deepStrictEqual(handle.getParams(), { ...defaults, text: "hello", mode: "b" });
  });

  it("replace: false creates history entries", () => {
    const { handle } = track({ replace: false });
    handle.setParam("text", "one");
    handle.setParam("text", "two");
    assert.deepStrictEqual(calls, ["push", "push"]);
    assert.strictEqual(entries.length, 3);
  });

  it("a value equal to the default is removed from the URL", () => {
    const { handle } = track();
    handle.setParam("mode", "b");
    handle.setParam("mode", "a");
    assert.strictEqual(search(), "");
  });

  it("an empty list is kept distinct from the default and decodes to []", () => {
    const { handle } = track();
    handle.setParam("list", []);
    assert.strictEqual(search(), "?l=");
    assert.deepStrictEqual(handle.getParams().list, []);
  });

  it("invalid and default values are normalised out of the URL on mount", () => {
    installBrowserStub("?m=bogus&t=keep&other=1&l=x");
    const { seen } = track();
    assert.deepStrictEqual(seen[0], { ...defaults, text: "keep" });
    assert.strictEqual(search(), "?other=1&t=keep");
    assert.deepStrictEqual(calls, ["replace"]);
  });

  it("write: false never touches history but still reports the would-be state", () => {
    const { handle, seen } = track({ write: false });
    handle.setParam("text", "hello");
    assert.strictEqual(search(), "");
    assert.deepStrictEqual(calls, []);
    assert.strictEqual(seen[seen.length - 1].text, "hello");
  });

  it("reacts to external history changes of tracked keys only", () => {
    const { seen } = track();
    history.replaceState(null, "", "?unrelated=1");
    assert.strictEqual(seen.length, 1);
    history.replaceState(null, "", "?unrelated=1&t=ext");
    assert.strictEqual(seen.length, 2);
    assert.strictEqual(seen[1].text, "ext");
  });

  it("debounceMs: onChange and getParams are immediate, the URL follows on flush", () => {
    const { handle, seen } = track({ debounceMs: 10_000 });
    handle.setParam("text", "h");
    handle.setParam("text", "he");
    handle.setParam("mode", "b");
    assert.strictEqual(search(), "");
    assert.strictEqual(seen[seen.length - 1].text, "he");
    assert.deepStrictEqual(handle.getParams(), { ...defaults, text: "he", mode: "b" });
    handle.flush();
    assert.strictEqual(search(), "?m=b&t=he");
    assert.deepStrictEqual(calls, ["replace"]);
  });

  it("disconnect drops a pending debounced write and restores history", () => {
    const nativeReplace = history.replaceState;
    const { handle } = track({ debounceMs: 10_000 });
    assert.notStrictEqual(history.replaceState, nativeReplace);
    handle.setParam("text", "lost");
    handle.disconnect();
    handle.flush();
    assert.strictEqual(search(), "");
    assert.strictEqual(history.replaceState, nativeReplace);
  });

  it("a listener added during notification is not called in the same pass", () => {
    let inner = 0;
    const off: (() => void)[] = [];
    off.push(
      onUrlChange(() => {
        if (off.length === 1) off.push(onUrlChange(() => inner++));
      }),
    );
    history.replaceState(null, "", "?a=1");
    assert.strictEqual(inner, 0);
    history.replaceState(null, "", "?a=2");
    assert.strictEqual(inner, 1);
    off.forEach((fn) => fn());
  });
});

describe("instanceIds", () => {
  it("reads ids and key suffixes", () => {
    assert.deepStrictEqual(parseInstanceIds(new URLSearchParams("ids=2,1&t-3=x&other=1")), [1, 2, 3]);
  });

  it("ignores junk in ids", () => {
    assert.deepStrictEqual(parseInstanceIds(new URLSearchParams("ids=1,,x,2abc, 4 ")), [1, 4]);
  });

  it("nextInstanceId", () => {
    assert.strictEqual(nextInstanceId([]), 1);
    assert.strictEqual(nextInstanceId([1, 5]), 6);
  });

  it("withInstanceIds / hasExplicitInstanceIds", () => {
    const params = withInstanceIds(new URLSearchParams("t-1=a"), [1, 2]);
    assert.strictEqual(params.get("ids"), "1,2");
    assert.ok(hasExplicitInstanceIds(params, [1, 2]));
    assert.ok(!hasExplicitInstanceIds(new URLSearchParams("t-1=a"), [1]));
    assert.strictEqual(withInstanceIds(params, []).has("ids"), false);
  });
});
