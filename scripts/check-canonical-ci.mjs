#!/usr/bin/env node
// CI-compatible canonical drift check.
// Compares 000-docs/000-*.md files against pinned SHA-256 hashes
// in scripts/canonical-hashes.json (no access to irsb-solver needed).
//
// Exit 0 = all hashes match, Exit 1 = drift or missing file.

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const hashFile = resolve(__dirname, "canonical-hashes.json");
const docsDir = resolve(__dirname, "..", "000-docs");

const RED = "\x1b[0;31m";
const GREEN = "\x1b[0;32m";
const NC = "\x1b[0m";

if (!existsSync(hashFile)) {
  console.error(`${RED}[ERROR]${NC} Hash file not found: ${hashFile}`);
  console.error("Run 'pnpm canonical:refresh' to generate it.");
  process.exit(1);
}

const hashes = JSON.parse(readFileSync(hashFile, "utf-8"));
const entries = Object.entries(hashes);

if (entries.length === 0) {
  console.error(`${RED}[ERROR]${NC} No entries found in ${hashFile}`);
  process.exit(1);
}

console.log("Checking canonical doc hashes...\n");

let hasDrift = false;

for (const [filename, expected] of entries) {
  const filePath = resolve(docsDir, filename);

  if (!existsSync(filePath)) {
    console.log(`${RED}[MISSING]${NC} ${filename}`);
    hasDrift = true;
    continue;
  }

  const content = readFileSync(filePath);
  const actual = createHash("sha256").update(content).digest("hex");

  if (actual === expected) {
    console.log(`${GREEN}[OK]${NC} ${filename}`);
  } else {
    console.log(`${RED}[DRIFT]${NC} ${filename}`);
    console.log(`  Expected: ${expected.slice(0, 16)}...`);
    console.log(`  Actual:   ${actual.slice(0, 16)}...`);
    hasDrift = true;
  }
}

console.log();
if (hasDrift) {
  console.log(
    `${RED}Drift detected! Update docs from irsb-solver, then run 'pnpm canonical:refresh'.${NC}`
  );
  process.exit(1);
} else {
  console.log(
    `${GREEN}All ${entries.length} canonical doc(s) match pinned hashes.${NC}`
  );
}
