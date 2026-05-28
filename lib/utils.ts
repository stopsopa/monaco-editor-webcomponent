import { it as rawIt, type TestFn, type TestOptions } from "node:test";

const modeAllowedValues = ["serial", "parallel"];

const th = (msg: string) => new Error(`utils.ts error: ${msg}`);

let mode: "serial" | "parallel";
export function setMode(m: "serial" | "parallel") {
  mode = m;
}

/**
 * determineMode(import.meta.url);
 */
export function determineMode(importMetaUrl: string) {
  const regex = /\.(serial|parallel)\.test\.(ts|js)$/;

  if (!regex.test(importMetaUrl)) {
    throw th(`importMetaUrl doesn't match ${regex}, it is ${importMetaUrl}`);
  }

  const extract = importMetaUrl.match(regex);

  if (extract?.length !== 3) {
    throw th(
      `importMetaUrl didn't extract parts ${regex}, it is ${importMetaUrl}`,
    );
  }

  mode = extract[1] as "serial" | "parallel";
}

function check() {
  if (!modeAllowedValues.includes(mode)) {
    throw th(
      `mode ${mode} is not allowed. Allowed values are ${modeAllowedValues.join(", ")}`,
    );
  }

  if (typeof process?.env?.CONCURRENCY !== "string") {
    throw th("CONCURRENCY environment variable is required");
  }

  if (!/^\d+$/.test(process.env.CONCURRENCY)) {
    throw th("CONCURRENCY environment variable must be a number");
  }

  if (mode === "serial") {
    if (process.env.CONCURRENCY !== "1") {
      throw th(
        `CONCURRENCY environment variable must be 1 for serial mode, it is ${process.env.CONCURRENCY}`,
      );
    }

    return;
  }

  if (mode === "parallel") {
    if (process.env.CONCURRENCY === "1") {
      throw th(
        "CONCURRENCY environment variable must be > 1 for parallel mode, it is 1",
      );
    }

    return;
  }

  throw th(`Invalid mode: ${mode}`);
}

export const it = Object.assign(
  function (name?: string, fn?: TestFn): Promise<void> {
    check();
    return rawIt(name, fn);
  },
  {
    only: function (name?: string, fn?: TestFn): Promise<void> {
      check();
      const options: TestOptions = {
        only: true,
      };
      return rawIt(name, options, fn);
    },
  },
);
