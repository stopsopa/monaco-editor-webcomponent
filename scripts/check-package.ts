/**
 * Guards the npm package definition. Three checks, all read-only:
 *
 *   1. package.json (what is published) and package.dev.json (what is installed for development) are two
 *      hand-maintained files that get swapped by bash/swap-files-v2.sh. The fields they share must be equal:
 *      name, version, type, description, scripts, keywords, author, license.
 *   2. Every file referenced from package.json ("main", "types", "module", "exports") exists.
 *      A wildcard entry ("./*": { "types": "./dist/types/*.d.ts", "import": "./dist/esm/*.js" }) cannot be
 *      checked file by file, so instead: every condition has to match at least one file, and all
 *      conditions have to match the same set (a .js without its .d.ts, or the other way round, is reported).
 *   3. `npm pack --dry-run` lists only files from the whitelist (dist/, web-component/Module.js, README.md,
 *      LICENSE, package.json) - nothing else may be published by accident.
 *
 * Usage (from the project root, AFTER a build - checks 2 and 3 need dist/ and web-component/Module.js;
 * plain `node`, native type stripping, no flags needed):
 *
 *   node scripts/check-package.ts            # run all checks, exit 1 on the first group of problems
 *   node scripts/check-package.ts --help
 *
 * As a module:
 *
 *   import { checkPackage } from "./scripts/check-package.ts";
 *   const problems = checkPackage(projectRoot);   // string[] - empty means everything is fine
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const th = (msg: string) => new Error(`scripts/check-package.ts error: ${msg}`);

const SHARED_FIELDS = ["name", "version", "type", "description", "scripts", "keywords", "author", "license"] as const;

const ALLOWED_IN_TARBALL = [/^dist\//, /^web-component\/Module\.js$/, /^README\.md$/, /^LICENSE$/, /^package\.json$/];

type Json = Record<string, unknown>;

function readJson(file: string): Json {
  if (!existsSync(file)) {
    throw th(`file >${file}< does not exist`);
  }
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Json;
  } catch (e) {
    throw th(`file >${file}< is not valid json: ${String(e)}`);
  }
}

/** Collects every string leaf of the "exports" tree (the file targets). */
function collectTargets(node: unknown, out: string[]): string[] {
  if (typeof node === "string") {
    out.push(node);
  } else if (node && typeof node === "object") {
    for (const value of Object.values(node)) {
      collectTargets(value, out);
    }
  }
  return out;
}

export function checkSharedFields(pkg: Json, dev: Json): string[] {
  const problems: string[] = [];
  for (const field of SHARED_FIELDS) {
    const a = JSON.stringify(pkg[field]);
    const b = JSON.stringify(dev[field]);
    if (a !== b) {
      problems.push(`package.json and package.dev.json differ in "${field}": >${a}< vs >${b}<`);
    }
  }
  return problems;
}

/** "exports" as a subpath map. The shorthand forms (a string, or a bare conditions object) mean ".". */
function exportsMap(exportsField: unknown): Record<string, unknown> {
  if (exportsField === undefined) {
    return {};
  }
  if (exportsField && typeof exportsField === "object" && Object.keys(exportsField).every((k) => k.startsWith("."))) {
    return exportsField as Record<string, unknown>;
  }
  return { ".": exportsField };
}

/**
 * Expands a wildcard target ("./dist/esm/*.js") against the files on disk.
 * Returns what the "*" stands for in each match ("react", "urlchange/urlchange", …) - like Node,
 * "*" also matches across "/".
 */
function expandWildcardTarget(root: string, target: string): string[] {
  const [prefix, suffix] = target.split("*") as [string, string];
  const baseDir = join(root, prefix.slice(0, prefix.lastIndexOf("/") + 1));

  if (!existsSync(baseDir)) {
    return [];
  }

  return readdirSync(baseDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `./${relative(root, join(entry.parentPath, entry.name)).split(sep).join("/")}`)
    .filter((file) => file.length > prefix.length + suffix.length && file.startsWith(prefix) && file.endsWith(suffix))
    .map((file) => file.slice(prefix.length, file.length - suffix.length))
    .sort();
}

function checkWildcardExport(root: string, key: string, targets: string[]): string[] {
  const problems: string[] = [];
  const matches = new Map<string, Set<string>>();

  for (const target of targets) {
    if (target.split("*").length !== 2) {
      problems.push(`package.json exports >${key}<: target >${target}< has to contain exactly one "*"`);
      continue;
    }

    const found = expandWildcardTarget(root, target);

    if (found.length === 0) {
      problems.push(`package.json exports >${key}<: >${target}< matches no file (run /bin/bash build.sh first)`);
      continue;
    }

    matches.set(target, new Set(found));
  }

  // every condition has to serve the same subpaths: a .js without its .d.ts (or the reverse) is a broken import
  for (const [target, found] of matches) {
    for (const [otherTarget, otherFound] of matches) {
      for (const star of otherFound) {
        if (!found.has(star)) {
          problems.push(
            `package.json exports >${key}<: >${otherTarget.replace("*", star)}< exists ` +
              `but >${target.replace("*", star)}< does not`,
          );
        }
      }
    }
  }

  return problems;
}

export function checkTargetsExist(root: string, pkg: Json): string[] {
  const missing = (target: string) =>
    `package.json references >${target}< which does not exist (run /bin/bash build.sh first)`;

  const problems = collectTargets([pkg.main, pkg.types, pkg.module], [])
    .filter((target) => !existsSync(join(root, target)))
    .map(missing);

  for (const [key, value] of Object.entries(exportsMap(pkg.exports))) {
    const targets = Array.from(new Set(collectTargets(value, [])));

    if (key.includes("*")) {
      problems.push(...checkWildcardExport(root, key, targets));
      continue;
    }

    for (const target of targets) {
      if (target.includes("*")) {
        problems.push(`package.json exports >${key}<: target >${target}< uses "*" but the key does not`);
      } else if (!existsSync(join(root, target))) {
        problems.push(missing(target));
      }
    }
  }

  return Array.from(new Set(problems));
}

export function checkTarball(root: string): string[] {
  let raw: string;
  try {
    raw = execFileSync("npm", ["pack", "--dry-run", "--json"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    throw th(`'npm pack --dry-run --json' failed: ${String(e)}`);
  }

  const parsed = JSON.parse(raw) as { files: { path: string }[] }[];
  const files = parsed[0]?.files ?? [];

  if (files.length === 0) {
    return [`'npm pack --dry-run' lists no files`];
  }

  return files
    .map((file) => file.path)
    .filter((path) => !ALLOWED_IN_TARBALL.some((allowed) => allowed.test(path)))
    .map((path) => `>${path}< would be published but is not on the whitelist`);
}

export function checkPackage(root: string): string[] {
  const pkg = readJson(join(root, "package.json"));
  const dev = readJson(join(root, "package.dev.json"));

  return [...checkSharedFields(pkg, dev), ...checkTargetsExist(root, pkg), ...checkTarball(root)];
}

function cli(): void {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Checks the npm package definition:
  1. shared fields of package.json and package.dev.json are equal (${SHARED_FIELDS.join(", ")})
  2. every file referenced from package.json main/types/module/exports exists
     (wildcard exports: every condition matches files, and all conditions match the same set)
  3. 'npm pack --dry-run' contains only whitelisted files

Run from the project root after a build:
  node scripts/check-package.ts
`);
    process.exit(1);
  }

  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const problems = checkPackage(root);

  if (problems.length > 0) {
    console.error(`scripts/check-package.ts error: ${problems.length} problem(s):\n`);
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    console.error("");
    process.exit(1);
  }

  console.log("scripts/check-package.ts: package.json is consistent");
}

if (import.meta.main) {
  cli();
}
