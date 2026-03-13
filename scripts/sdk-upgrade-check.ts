#!/usr/bin/env bun
/**
 * SDK upgrade validation script.
 * Static mode (default): checks version, allowDangerouslySkipPermissions, typecheck, tests.
 * Live mode (--live): also runs a real SDK query.
 *
 * Usage:
 *   bun scripts/sdk-upgrade-check.ts
 *   bun scripts/sdk-upgrade-check.ts --live
 */

import { readFileSync } from "fs";
import { join } from "path";
import { $ } from "bun";

const ROOT = join(import.meta.dir, "..");
const LIVE = process.argv.includes("--live");

let passed = 0;
let failed = 0;

function ok(label: string, detail?: string) {
  console.log(`  [PASS] ${label}${detail ? ` — ${detail}` : ""}`);
  passed++;
}

function fail(label: string, detail?: string) {
  console.log(`  [FAIL] ${label}${detail ? ` — ${detail}` : ""}`);
  failed++;
}

// --- 1. SDK version ---
console.log("\n=== Static Checks ===\n");

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
const sdkVersion = pkg.dependencies?.["@anthropic-ai/claude-agent-sdk"];
console.log(`SDK version in package.json: ${sdkVersion}`);
if (sdkVersion) {
  ok("package.json has SDK version", sdkVersion);
} else {
  fail("package.json missing SDK dependency");
}

// --- 2. allowDangerouslySkipPermissions present ---
const sdkQuery = readFileSync(join(ROOT, "src/sdk-query.ts"), "utf-8");
const hasBypassGuard =
  sdkQuery.includes("allowDangerouslySkipPermissions") &&
  sdkQuery.includes("bypassPermissions");
if (hasBypassGuard) {
  ok("allowDangerouslySkipPermissions present alongside bypassPermissions");
} else {
  fail(
    "allowDangerouslySkipPermissions missing — required for SDK 0.2.x bypassPermissions",
  );
}

// --- 3. Typecheck ---
const tc = await $`bun run typecheck`.cwd(ROOT).quiet().nothrow();
if (tc.exitCode === 0) {
  ok("bun run typecheck");
} else {
  fail("bun run typecheck", tc.stderr.toString().trim().split("\n")[0]);
}

// --- 4. Tests ---
const tests = await $`bun test`.cwd(ROOT).quiet().nothrow();
const testOutput = tests.stdout.toString();
const matchPass = testOutput.match(/(\d+) pass/);
const matchFail = testOutput.match(/(\d+) fail/);
const numPass = matchPass ? parseInt(matchPass[1]) : 0;
const numFail = matchFail ? parseInt(matchFail[1]) : 0;
if (tests.exitCode === 0 && numFail === 0) {
  ok("bun test", `${numPass} pass, 0 fail`);
} else {
  fail("bun test", `${numPass} pass, ${numFail} fail`);
}

// --- 5. Live query ---
if (LIVE) {
  console.log("\n=== Live Check ===\n");
  // Unset CLAUDECODE to allow SDK to spawn a nested Claude process
  delete process.env.CLAUDECODE;
  try {
    const { sdkQuery: runQuery } = await import("../src/sdk-query.ts");
    const result = await runQuery("Reply with just: OK", {
      model: "claude-haiku-4-5-20251001",
      maxTurns: 3,
    });
    if (result.text && result.sessionId) {
      ok(
        "live sdkQuery",
        `model=${result.actualModel} session=${result.sessionId.slice(0, 8)}... turns=${result.numTurns} cost=$${result.costUsd.toFixed(4)}`,
      );
    } else {
      fail("live sdkQuery", `empty text=${!result.text} sessionId=${result.sessionId}`);
    }
  } catch (err) {
    fail("live sdkQuery", err instanceof Error ? err.message : String(err));
  }
}

// --- Summary ---
console.log(`\n${"─".repeat(40)}`);
console.log(`Result: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
