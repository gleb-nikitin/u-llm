/**
 * D1: Verify SDK forkSession behavior.
 * Run: bun scripts/test-fork.ts
 *
 * 1. Create session, say "Remember the word BANANA".
 * 2. Fork: resume with forkSession=true, ask what word.
 * 3. Verify forkSessionId !== sessionId and response contains BANANA.
 * 4. Verify original intact: resume original, ask what word.
 */

import { sdkQuery } from "../src/sdk-query";

const MODEL = "claude-haiku-4-5-20251001";

async function main() {
  console.log("=== SDK Fork Verification ===\n");

  // Step 1: Create original session
  console.log("Step 1: Creating session with word BANANA...");
  const r1 = await sdkQuery("Please remember the word BANANA. Reply with 'OK'.", {
    model: MODEL,
    persistSession: true,
  });
  const originalSessionId = r1.sessionId;
  console.log(`  sessionId: ${originalSessionId}`);
  console.log(`  response: ${r1.text.slice(0, 80)}`);

  // Step 2: Fork from original
  console.log("\nStep 2: Forking from original session...");
  const r2 = await sdkQuery("What word did I ask you to remember?", {
    model: MODEL,
    resume: originalSessionId,
    forkSession: true,
    persistSession: true,
  });
  const forkSessionId = r2.sessionId;
  console.log(`  forkSessionId: ${forkSessionId}`);
  console.log(`  response: ${r2.text.slice(0, 120)}`);

  const forkDiffers = forkSessionId !== originalSessionId;
  const forkContainsBanana = r2.text.toUpperCase().includes("BANANA");
  console.log(`  ✓ fork ID differs from original: ${forkDiffers}`);
  console.log(`  ✓ fork remembers BANANA: ${forkContainsBanana}`);

  // Step 3: Verify original is intact
  console.log("\nStep 3: Verifying original session is unchanged...");
  const r3 = await sdkQuery("What word did I ask you to remember?", {
    model: MODEL,
    resume: originalSessionId,
    persistSession: false,
  });
  console.log(`  response: ${r3.text.slice(0, 120)}`);
  const originalIntact = r3.text.toUpperCase().includes("BANANA");
  console.log(`  ✓ original still remembers BANANA: ${originalIntact}`);

  // Summary
  console.log("\n=== Results ===");
  if (forkDiffers && forkContainsBanana && originalIntact) {
    console.log("PASS: forkSession=true works correctly.");
    console.log("  - Fork creates a new session ID");
    console.log("  - Fork inherits history from original");
    console.log("  - Original session is preserved unchanged");
  } else {
    console.log("FAIL or PARTIAL:");
    if (!forkDiffers) console.log("  ✗ Fork session ID matches original — fork not detected");
    if (!forkContainsBanana) console.log("  ✗ Fork does not remember BANANA — history not inherited");
    if (!originalIntact) console.log("  ✗ Original no longer remembers BANANA — original was modified");
    console.log("\nFallback behavior: forkSession may not be supported by this SDK version.");
    console.log("In handler.ts, forking from saved will still work but may share session state.");
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
