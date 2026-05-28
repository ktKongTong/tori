import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const pkgName = process.argv[2] ?? "node-steam-family-group-api";

function walk(dir) {
  if (!fs.existsSync(dir)) return [];

  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      out.push(...walk(full));
    } else if (stat.isFile() && full.endsWith(".js")) {
      out.push(full);
    }
  }

  return out;
}

function hasKnownRuntimeExt(spec) {
  return /\.(js|mjs|cjs|json|node|wasm|css)$/i.test(spec);
}

function patchSpecifier(file, spec) {
  if (!spec.startsWith(".")) return spec;
  if (hasKnownRuntimeExt(spec)) return spec;

  const fromDir = path.dirname(file);
  const abs = path.resolve(fromDir, spec);
  const cleanSpec = spec.replace(/\/$/, "");

  const candidates = [
    [abs + ".js", cleanSpec + ".js"],
    [abs + ".mjs", cleanSpec + ".mjs"],
    [path.join(abs, "index.js"), cleanSpec + "/index.js"],
    [path.join(abs, "index.mjs"), cleanSpec + "/index.mjs"],
  ];

  for (const [target, replacement] of candidates) {
    if (fs.existsSync(target)) return replacement;
  }

  return spec;
}

function patchFile(file) {
  const before = fs.readFileSync(file, "utf8");

  let after = before;

  // import x from "./foo"
  // export * from "./foo"
  after = after.replace(
    /\b(from\s*["'])(\.{1,2}\/[^"']+)(["'])/g,
    (_, a, spec, b) => a + patchSpecifier(file, spec) + b,
  );

  // import "./foo"
  after = after.replace(
    /\b(import\s*["'])(\.{1,2}\/[^"']+)(["'])/g,
    (_, a, spec, b) => a + patchSpecifier(file, spec) + b,
  );

  // import("./foo")
  after = after.replace(
    /\b(import\s*\(\s*["'])(\.{1,2}\/[^"']+)(["']\s*\))/g,
    (_, a, spec, b) => a + patchSpecifier(file, spec) + b,
  );

  if (after !== before) {
    fs.writeFileSync(file, after);
    return true;
  }

  return false;
}

let entry;
try {
  entry = require.resolve(pkgName);
} catch (err) {
  console.error(`[patch-esm] Cannot resolve package: ${pkgName}`);
  console.error(err);
  process.exit(1);
}

// require condition usually resolves to lib/cjs/index.js
// package root = ../../ from lib/cjs
const pkgRoot = path.resolve(path.dirname(entry), "../..");
const esmDir = path.join(pkgRoot, "lib", "esm");

if (!fs.existsSync(esmDir)) {
  console.error(`[patch-esm] ESM dir not found: ${esmDir}`);
  process.exit(1);
}

const files = walk(esmDir);
let changed = 0;

for (const file of files) {
  if (patchFile(file)) changed++;
}

console.log(`[patch-esm] ${pkgName}`);
console.log(`[patch-esm] scanned: ${files.length} files`);
console.log(`[patch-esm] changed: ${changed} files`);
console.log(`[patch-esm] esm dir: ${esmDir}`);
