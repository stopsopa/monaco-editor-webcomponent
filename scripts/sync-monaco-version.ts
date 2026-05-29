#!/usr/bin/env node
/**
 * Reads monaco-editor version from node_modules, probes CDNs, optionally patches
 * MonacoDiffManager.ts between // autogenerate v and // autogenerate ^, copies min/vs
 * to public/monaco/vs.
 *
 *   pnpm run monaco / npm run monaco — probe + print block; do not patch; exit 1
 *   pnpm run monaco --skip / npm run monaco --skip — patch only if exactly one source fails; exit 0
 *   npm run monaco -- --skip — same (--skip on argv; npm also accepts npm run monaco --skip via npm_config_skip)
 *   pnpm run monaco:skip / npm run monaco:skip — always passes --skip to the script
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROBE_TIMEOUT_MS = 15_000;
const AUTOGEN_START = "// autogenerate v";
const AUTOGEN_END = "// autogenerate ^";
const MANAGER_REL = "web-component/MonacoDiffManager.ts";

export type MonacoGeneratedConfig = {
  version: string;
  vs: string[];
};

type VsCandidate = { name: string; vsBase: string };

type ProbeResult = {
  name: string;
  vsBase: string;
  url: string;
  ok: boolean;
  status: number | null;
  error: string | null;
  local: boolean;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const require = createRequire(join(root, "package.json"));

/** Script argv `--skip`, or `npm run monaco --skip` (npm does not forward argv; sets npm_config_skip). */
function isSkipMode(argv: string[]): boolean {
  if (argv.includes("--skip")) {
    return true;
  }
  const npmSkip = process.env.npm_config_skip;
  return npmSkip !== undefined && npmSkip !== "false" && npmSkip !== "0";
}

function printCdnInspectHint(
  name: string,
  inspectUrls: Record<string, string>,
  log: (...args: unknown[]) => void = console.log,
): void {
  const url = inspectUrls[name];
  if (url) {
    log(`         inspect available versions: ${url}`);
  }
}

/** Probe loader.js — HTTP HEAD for CDNs, filesystem for /monaco/vs (self). */
async function probeVsSource(name: string, vsBase: string, projectRoot: string): Promise<ProbeResult> {
  const loaderUrl = `${vsBase}/loader.js`;

  if (vsBase.startsWith("/")) {
    const localFile = join(projectRoot, "public", vsBase.replace(/^\//, ""), "loader.js");
    const ok = existsSync(localFile);
    return {
      name,
      vsBase,
      url: loaderUrl,
      ok,
      status: ok ? 200 : null,
      error: ok ? null : `Not found: ${localFile}`,
      local: true,
    };
  }

  try {
    const res = await fetch(loaderUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    return {
      name,
      vsBase,
      url: loaderUrl,
      ok: res.ok,
      status: res.status,
      error: res.ok ? null : res.statusText || `HTTP ${res.status}`,
      local: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { name, vsBase, url: loaderUrl, ok: false, status: null, error: message, local: false };
  }
}

export function formatAutogenerateBlock(config: MonacoGeneratedConfig): string {
  return `${AUTOGEN_START}
export const MONACO_GENERATED = ${JSON.stringify(config, null, 2)} as const;
${AUTOGEN_END}`;
}

export function printAutogenerateBlock(config: MonacoGeneratedConfig): void {
  console.log("\n--- Autogenerate block (MonacoDiffManager.ts) ---\n");
  console.log(formatAutogenerateBlock(config));
  console.log("--- end ---\n");
}

function patchAutogenerateBlock(filePath: string, config: MonacoGeneratedConfig): void {
  const content = readFileSync(filePath, "utf8");
  const start = content.indexOf(AUTOGEN_START);
  const end = content.indexOf(AUTOGEN_END);

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`${filePath} must contain "${AUTOGEN_START}" and "${AUTOGEN_END}" (end after start)`);
  }

  const block = formatAutogenerateBlock(config);
  const next = content.slice(0, start) + block + content.slice(end + AUTOGEN_END.length);
  writeFileSync(filePath, next);
}

function printProbeResults(probes: ProbeResult[], inspectUrls: Record<string, string>): void {
  for (const probe of probes) {
    const label = probe.ok ? "OK" : "MISSING";
    const statusLabel = probe.local ? "local" : `HTTP ${probe.status ?? "—"}`;
    console.log(`  [${label}] ${probe.name} ${statusLabel}`);
    console.log(`         ${probe.url}`);
    if (probe.error) {
      console.log(`         ${probe.error}`);
      if (probe.name === "self") {
        console.log(`         (served from public/monaco/vs after monaco:skip copy)`);
      } else {
        printCdnInspectHint(probe.name, inspectUrls);
      }
    }
  }
}

function printFailedProbes(failedProbes: ProbeResult[], version: string, inspectUrls: Record<string, string>): void {
  console.error(`\nError: CDN probe failed for monaco-editor@${version}:`);
  for (const probe of failedProbes) {
    console.error(`  ${probe.name}: ${probe.error ?? "unreachable"}`);
    console.error(`    ${probe.url}`);
    if (probe.name !== "self") {
      printCdnInspectHint(probe.name, inspectUrls, console.error);
    }
  }
  console.error("\nFix: bump/downgrade monaco-editor, run pnpm install, then pnpm run monaco -- --skip.\n");
}

/** With --skip: patch + exit 0 only when exactly one probe failed and at least one succeeded. */
function skipModeAllowsPatch(workingCount: number, failedCount: number): boolean {
  return failedCount === 1 && workingCount > 0;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const skip = isSkipMode(argv);

  const monacoPkgPath = require.resolve("monaco-editor/package.json");
  const monacoPkg = JSON.parse(readFileSync(monacoPkgPath, "utf8")) as { version: string };
  const version = monacoPkg.version;

  const cdnInspectUrls: Record<string, string> = {
    jsdelivr: `https://cdn.jsdelivr.net/npm/monaco-editor@${version}/`,
    unpkg: `https://app.unpkg.com/monaco-editor@${version}`,
    cdnjs: "https://cdnjs.com/libraries/monaco-editor",
  };

  const vsSrc = join(dirname(monacoPkgPath), "min/vs");
  const vsDest = join(root, "public/monaco/vs");

  if (existsSync(vsSrc)) {
    mkdirSync(join(root, "public/monaco"), { recursive: true });
    cpSync(vsSrc, vsDest, { recursive: true });
    console.log(`Copied min/vs → public/monaco/vs (${version})\n`);
  } else {
    console.warn(`Warning: ${vsSrc} not found — skipped copy to public/monaco/vs\n`);
  }

  const vsCandidates: VsCandidate[] = [
    { name: "jsdelivr", vsBase: `https://cdn.jsdelivr.net/npm/monaco-editor@${version}/min/vs` },
    { name: "unpkg", vsBase: `https://unpkg.com/monaco-editor@${version}/min/vs` },
    { name: "cdnjs", vsBase: `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${version}/min/vs` },
    { name: "self", vsBase: "/monaco/vs" },
  ];

  console.log(`CDN probe (monaco-editor@${version} → …/min/vs/loader.js):\n`);

  const cdnProbes = await Promise.all(vsCandidates.map(({ name, vsBase }) => probeVsSource(name, vsBase, root)));

  printProbeResults(cdnProbes, cdnInspectUrls);

  const failedProbes = cdnProbes.filter((p) => !p.ok);
  const workingProbes = cdnProbes.filter((p) => p.ok);

  const config: MonacoGeneratedConfig = {
    version,
    vs: workingProbes.map((p) => p.vsBase),
  };

  console.log(`\nvs load order (working): ${config.vs.length > 0 ? config.vs.join(" → ") : "(none)"}\n`);

  printAutogenerateBlock(config);

  if (failedProbes.length > 0) {
    printFailedProbes(failedProbes, version, cdnInspectUrls);
  }

  const managerPath = join(root, MANAGER_REL);
  const workingCount = workingProbes.length;
  const failedCount = failedProbes.length;

  if (!skip) {
    console.log(
      `Not patching ${MANAGER_REL} (re-run with --skip when exactly one source fails: pnpm run monaco --skip, npm run monaco --skip, or npm run monaco:skip).\n`,
    );
    process.exit(1);
  }

  if (!skipModeAllowsPatch(workingCount, failedCount)) {
    if (failedCount === 0) {
      console.error(
        `Not patching ${MANAGER_REL}: --skip applies only when exactly one source fails (all ${workingCount} OK).\n`,
      );
    } else if (failedCount > 1) {
      console.error(
        `Not patching ${MANAGER_REL}: --skip requires exactly one rejected source (${failedCount} failed, ${workingCount} OK).\n`,
      );
    } else {
      console.error(`Not patching ${MANAGER_REL}: no working sources.\n`);
    }
    process.exit(1);
  }

  patchAutogenerateBlock(managerPath, config);
  console.log(`Patched autogenerate block in ${MANAGER_REL}`);
  console.log(`\nmonaco-editor@${version} — done (${failedCount} rejected, ${workingCount} in vs list).\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
