import assert from "node:assert";
// import { describe, beforeEach } from "node:test";
import path from "node:path";
import { it, determineMode } from "./utils.ts";

import createCachePool from "./cacheTemplate.ts";

determineMode(import.meta.url);

const __dirname = path.dirname(new URL(import.meta.url).pathname);

/**
 * node --test server/cacheTemplate.parallel.test.ts
 * SILENT=false /bin/bash ts.sh --test server/cacheTemplate.parallel.test.ts
 * SILENT=false /bin/bash ts.sh --test-only --test server/cacheTemplate.parallel.test.ts
 */

// "_" is a virtual sentinel filename — dirname() resolves to the templates dir
// so relative template names like "child.html" resolve correctly.
const templatesParent = path.join(__dirname, "templates");

let produceRender: ReturnType<typeof createCachePool>;

const getCache = () => produceRender.getCache();

let prepare = (cache = false) => {
  produceRender = createCachePool(cache);

  return produceRender(path.join(templatesParent, "_"));
};

it("child", () => {
  const render = prepare(false);

  const result = render("child.html", { test: "test" });

  assert.strictEqual(result, "<abc>test</abc>\n");

  {
    const cache = getCache();

    const keys = Array.from(cache.keys()).map((p) =>
      path.relative(templatesParent, p),
    );

    assert.deepStrictEqual(keys, []);
  }
});

it("parent", () => {
  const render = prepare(false);

  const result = render("parent.html", { test: "test" });

  assert.strictEqual(result, "<h1>parent</h1>\n<abc>test</abc>\n\n");
});

it("interpolate", () => {
  const render = prepare(false);

  const result = render("child.html", { test: "test<br />" });

  assert.strictEqual(result, "<abc>test<br /></abc>\n");
});

it("escape", () => {
  const render = prepare(false);

  const result = render("escape.html", { test: "test<br />" });

  assert.strictEqual(result, `<abc class="escape.html">test&lt;br /&gt;</abc>
`);
});

it("parent.dynamic", () => {
  const render = prepare(false);

  const result = render("parent.dynamic.html", {
    test: "test <br />",
    child: "escape.html",
  });

  assert.strictEqual(
    result,
    `<h1>parent</h1>
<abc class="escape.html">test &lt;br /&gt;</abc>

`,
  );
});

// cache on
it("cache:on child", () => {
  const render = prepare(true);

  const result = render("child.html", { test: "test" });

  assert.strictEqual(result, "<abc>test</abc>\n");
});

it("cache:on parent", () => {
  const render = prepare(true);

  const result = render("parent.html", { test: "test" });

  assert.strictEqual(result, "<h1>parent</h1>\n<abc>test</abc>\n\n");

  {
    const cache = getCache();

    const keys = Array.from(cache.keys()).map((p) =>
      path.relative(templatesParent, p),
    );

    assert.deepStrictEqual(keys, ["parent.html", "child.html"]);
  }
});

it("cache:on interpolate", () => {
  const render = prepare(true);

  const result = render("child.html", { test: "test<br />" });

  assert.strictEqual(result, "<abc>test<br /></abc>\n");
});

it("cache:on escape", () => {
  const render = prepare(true);

  const result = render("escape.html", { test: "test<br />" });

  assert.strictEqual(result, `<abc class="escape.html">test&lt;br /&gt;</abc>
`);
});

it("cache:on parent.dynamic", () => {
  const render = prepare(true);

  const result = render("parent.dynamic.html", {
    test: "test <br />",
    child: "escape.html",
  });

  assert.strictEqual(
    result,
    `<h1>parent</h1>
<abc class="escape.html">test &lt;br /&gt;</abc>

`,
  );
});

it("cache:on relative", () => {
  const render = prepare(true);

  const result = render("relative/parent.html", {
    test: "test <br />",
  });

    console.log(`
      wtf
      >${result}<
      
      `)

  assert.strictEqual(
    result,
    `<h1>relative parent</h1>
<span class="d.test">test &lt;br /&gt;</span>
<span class="d.inj">test from relative parent</span>
<span data-test="goup"><abc class="escape.html">test &lt;br /&gt;</abc>
</span>

`,
  );

  {
    const cache = getCache();

    const keys = Array.from(cache.keys()).map((p) =>
      path.relative(templatesParent, p),
    );

    assert.deepStrictEqual(keys, [
      "relative/parent.html",
      "relative/child/child.html",
      "escape.html",
    ]);
  }
});

it("cache:on relative + cache", () => {
  const render = prepare(true);

  const template = render("relative/parent.html");

  {
    const result = template({
      test: "test <br />",
    });

    assert.strictEqual(
      result,
      `<h1>relative parent</h1>
<span class="d.test">test &lt;br /&gt;</span>
<span class="d.inj">test from relative parent</span>
<span data-test="goup"><abc class="escape.html">test &lt;br /&gt;</abc>
</span>

`,
    );
  }

  {
    const cache = getCache();

    const keys = Array.from(cache.keys()).map((p) =>
      path.relative(templatesParent, p),
    );

    console.log(`
    
    >${JSON.stringify(keys)}<
    
    `);

    assert.deepStrictEqual(keys, [
      "relative/parent.html",
      "relative/child/child.html",
      "escape.html",
    ]);
  }
});

it("custom options override", () => {
  const customRender = createCachePool(false, {
    interpolate: /<#=([\s\S]+?)#>/g,
    escape: /<#-([\s\S]+?)#>/g,
    evaluate: /<#([\s\S]+?)#>/g,
    variable: "data",
  })(path.join(templatesParent, "_"));

  const result = customRender("custom.html", { test: "test" });
  assert.strictEqual(result, `<abc data-id="custom">\n  test\n</abc>\n`);
});

// error cases
it("error: no parentFile", () => {
  try {
    produceRender("");

    throw new Error("should not get here");
  } catch (e) {
    assert.strictEqual(
      String(e),
      "Error: cacheTemplate error: parentFile is required",
    );
  }
});

it("error: parentFile must be absolute path", () => {
  try {
    createCachePool()(path.join("relative", "_"));
    throw new Error("should not get here");
  } catch (e) {
    assert.match(
      String(e),
      /parentFileAbsolute must be absolute path/,
    );
  }
});

it("cache: hit", () => {
  const render = prepare(true);
  const result1 = render("child.html", { test: "test1" });
  const result2 = render("child.html", { test: "test2" });
  assert.strictEqual(result1, "<abc>test1</abc>\n");
  assert.strictEqual(result2, "<abc>test2</abc>\n");
});

it("error: render failure", () => {
  const render = prepare(false);
  try {
    render("non-existent-file.html");
    throw new Error("should not get here");
  } catch (e) {
    assert.match(
      String(e),
      /error/,
    );
  }
});

it("cache: reset", () => {
  const render = prepare(true);
  render("child.html", { test: "test1" });

  // verify cache is populated
  const cache = getCache();
  assert.strictEqual(cache.size > 0, true);

  // call resetCache() which executes cache.clear()
  produceRender.resetCache();

  // verify cache is empty
  assert.strictEqual(cache.size, 0);
});
