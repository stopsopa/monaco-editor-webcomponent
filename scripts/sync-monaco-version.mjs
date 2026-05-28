#!/usr/bin/env node
/**
 * Reads monaco-editor version from node_modules, probes CDNs, patches MonacoDiffManager.ts
 * between // autogenerate v and // autogenerate ^, copies min/vs to public/monaco/vs.
 * Run manually after install/upgrade: pnpm run monaco:sync
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const PROBE_TIMEOUT_MS = 15_000;
const AUTOGEN_START = "// autogenerate v";
const AUTOGEN_END = "// autogenerate ^";
const MANAGER_REL = "web-component/web-component/MonacoDiffManager.ts";

function printCdnInspectHint(name, inspectUrls, log = console.log) {
  const url = inspectUrls[name];
  if (url) {
    log(`         inspect available versions: ${url}`);
  }
}

/** HEAD request; probes loader.js under the vs base URL. */
async function probeCdn(name, vsBase) {
  const url = `${vsBase}/loader.js`;

  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    return {
      name,
      vsBase,
      url,
      ok: res.ok,
      status: res.status,
      error: res.ok ? null : res.statusText || `HTTP ${res.status}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { name, vsBase, url, ok: false, status: null, error: message };
  }
}

function patchAutogenerateBlock(filePath, config) {
  const content = readFileSync(filePath, "utf8");
  const start = content.indexOf(AUTOGEN_START);
  const end = content.indexOf(AUTOGEN_END);

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      `${filePath} must contain "${AUTOGEN_START}" and "${AUTOGEN_END}" (end after start)`,
    );
  }

  const block = `${AUTOGEN_START}
export const MONACO_GENERATED = ${JSON.stringify(config, null, 2)} as const;
${AUTOGEN_END}`;

  const next =
    content.slice(0, start) + block + content.slice(end + AUTOGEN_END.length);

  writeFileSync(filePath, next);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const require = createRequire(join(root, "package.json"));

const monacoPkgPath = require.resolve("monaco-editor/package.json");
const monacoPkg = JSON.parse(readFileSync(monacoPkgPath, "utf8"));
const version = monacoPkg.version;

const CDN_INSPECT_URLS = {
  jsdelivr: `https://cdn.jsdelivr.net/npm/monaco-editor@${version}/`,
  unpkg: `https://app.unpkg.com/monaco-editor@${version}`,
  cdnjs: "https://cdnjs.com/libraries/monaco-editor",
};

const config = {
  version,
  cdn: {
    jsdelivr: `https://cdn.jsdelivr.net/npm/monaco-editor@${version}/min/vs`,
    unpkg: `https://unpkg.com/monaco-editor@${version}/min/vs`,
    cdnjs: `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${version}/min/vs`,
  },
  self: "/monaco/vs",
};

console.log(`\nCDN probe (HEAD ${config.version} → …/min/vs/loader.js):\n`);

const cdnProbes = await Promise.all(
  Object.entries(config.cdn).map(([name, vsBase]) => probeCdn(name, vsBase)),
);

for (const probe of cdnProbes) {
  const label = probe.ok ? "OK" : "MISSING";
  const status = probe.status ?? "—";
  console.log(`  [${label}] ${probe.name} HTTP ${status}`);
  console.log(`         ${probe.url}`);
  if (probe.error) {
    console.log(`         ${probe.error}`);
    printCdnInspectHint(probe.name, CDN_INSPECT_URLS);
  }
}

const failedProbes = cdnProbes.filter((p) => !p.ok);
if (failedProbes.length > 0) {
  console.error(`\nError: CDN probe failed for monaco-editor@${version}:`);
  for (const probe of failedProbes) {
    console.error(`  ${probe.name}: ${probe.error ?? "unreachable"}`);
    console.error(`    ${probe.url}`);
    printCdnInspectHint(probe.name, CDN_INSPECT_URLS, console.error);
  }
  console.error(
    "\nFix: bump/downgrade monaco-editor, run pnpm run monaco:sync after install, or use data-wc-monaco=self.\n",
  );
  process.exit(1);
}

config.cdnProbe = Object.fromEntries(
  cdnProbes.map((p) => [p.name, { ok: p.ok, status: p.status, url: p.url, vsBase: p.vsBase }]),
);

console.log("");

const managerPath = join(root, MANAGER_REL);
patchAutogenerateBlock(managerPath, config);
console.log(`Patched autogenerate block in ${MANAGER_REL}`);

const vsSrc = join(dirname(monacoPkgPath), "min/vs");
const vsDest = join(root, "public/monaco/vs");

if (existsSync(vsSrc)) {
  mkdirSync(join(root, "public/monaco"), { recursive: true });
  cpSync(vsSrc, vsDest, { recursive: true });
  console.log(`Copied min/vs → public/monaco/vs (${version})`);
} else {
  console.warn(`Warning: ${vsSrc} not found — skipped copy to public/monaco/vs`);
}

console.log(`\nmonaco-editor@${version} — done.\n`);
