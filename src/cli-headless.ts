export interface CliQueryOptions {
  model?: string;
  resume?: string;
  continueSession?: boolean;
  stream?: boolean;
}

export interface CliQueryResult {
  text: string;
  sessionId: string;
  durationMs: number;
  numTurns: number;
}

export async function cliQuery(
  prompt: string,
  options: CliQueryOptions = {},
): Promise<CliQueryResult> {
  const args: string[] = [];

  if (options.continueSession) {
    args.push("--continue", "--print");
  } else {
    args.push("-p");
  }

  args.push(prompt, "--output-format", "stream-json", "--verbose", "--dangerously-skip-permissions");

  if (options.model) {
    args.push("--model", options.model);
  }
  if (options.resume) {
    args.push("--resume", options.resume);
  }

  const env = { ...process.env };
  delete env.CLAUDECODE;

  const proc = Bun.spawn(["claude", ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env,
  });

  let text = "";
  let sessionId = "";
  let durationMs = 0;
  let numTurns = 0;
  let lastPrintedLength = 0;

  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(trimmed);
      } catch {
        continue;
      }

      if (msg.type === "assistant" && msg.message) {
        const message = msg.message as {
          content?: Array<{ type: string; text?: string }>;
        };
        if (message.content) {
          for (const block of message.content) {
            if (block.type === "text" && block.text) {
              text = block.text;
              if (options.stream && text.length > lastPrintedLength) {
                process.stdout.write(text.slice(lastPrintedLength));
                lastPrintedLength = text.length;
              }
            }
          }
        }
      } else if (msg.type === "result") {
        sessionId = (msg.session_id as string) ?? "";
        durationMs = (msg.duration_ms as number) ?? 0;
        numTurns = (msg.num_turns as number) ?? 0;
        if (msg.result && typeof msg.result === "string") {
          text = msg.result;
        }
      }
    }
  }

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderrText = await new Response(proc.stderr).text();
    throw new Error(
      `claude CLI exited with code ${exitCode}${stderrText ? ": " + stderrText.trim() : ""}`,
    );
  }

  return { text, sessionId, durationMs, numTurns };
}
