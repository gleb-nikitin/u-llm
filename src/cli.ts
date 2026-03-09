import { sdkQuery } from "./sdk-query";
import { cliQuery } from "./cli-headless";
import { upsertSession, getLatestSessionId, listSessions } from "./session-store";

function printUsage(): void {
  console.error(
    "Usage: bun run src/cli.ts [options] <prompt>",
  );
  console.error("");
  console.error("Options:");
  console.error("  --via <method>     Connection method: sdk (default) or cli");
  console.error("  --model <model>    Model to use (default: sonnet)");
  console.error("  --resume <id>      Resume a session by ID");
  console.error("  --continue         Continue most recent session");
  console.error("  --stream           Show text as it arrives");
  console.error("  --sessions         List stored sessions");
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
  }

  let model: string | undefined;
  let via: "sdk" | "cli" = "sdk";
  let prompt: string | undefined;
  let resume: string | undefined;
  let continueSession = false;
  let stream = false;
  let showSessions = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model") {
      i++;
      if (i >= args.length) {
        console.error("Error: --model requires a value");
        printUsage();
      }
      model = args[i];
    } else if (args[i] === "--via") {
      i++;
      if (i >= args.length) {
        console.error("Error: --via requires a value");
        printUsage();
      }
      const val = args[i];
      if (val !== "sdk" && val !== "cli") {
        console.error(`Error: --via must be "sdk" or "cli", got "${val}"`);
        printUsage();
      }
      via = val as "sdk" | "cli";
    } else if (args[i] === "--resume") {
      i++;
      if (i >= args.length) {
        console.error("Error: --resume requires a session ID");
        printUsage();
      }
      resume = args[i];
    } else if (args[i] === "--continue") {
      continueSession = true;
    } else if (args[i] === "--stream") {
      stream = true;
    } else if (args[i] === "--sessions") {
      showSessions = true;
    } else if (args[i].startsWith("--")) {
      console.error(`Error: unknown option ${args[i]}`);
      printUsage();
    } else {
      prompt = args[i];
    }
  }

  if (showSessions) {
    listSessions();
    return;
  }

  if (!prompt) {
    printUsage();
    return;
  }

  // Resolve --continue to a session ID
  if (continueSession && !resume) {
    if (via === "cli") {
      // CLI path handles --continue natively
    } else {
      const latestId = getLatestSessionId();
      if (!latestId) {
        console.error("Error: no sessions to continue");
        process.exit(1);
      }
      resume = latestId;
    }
  }

  try {
    let result;
    if (via === "cli") {
      result = await cliQuery(prompt, {
        model,
        resume,
        continueSession: continueSession && !resume,
        stream,
      });
    } else {
      result = await sdkQuery(prompt, { model, resume, stream });
    }

    if (stream) {
      // Streaming already wrote text to stdout, just add final newline
      process.stdout.write("\n");
    } else {
      process.stdout.write(result.text + "\n");
    }
    console.error(
      `session_id=${result.sessionId} duration_ms=${result.durationMs} num_turns=${result.numTurns}`,
    );

    // Persist session
    if (result.sessionId) {
      await upsertSession(result.sessionId, prompt);
    }
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
