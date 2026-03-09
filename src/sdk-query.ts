import { query } from "@anthropic-ai/claude-agent-sdk";

export interface SdkQueryOptions {
  model?: string;
  resume?: string;
  stream?: boolean;
}

export interface SdkQueryResult {
  text: string;
  sessionId: string;
  durationMs: number;
  numTurns: number;
}

export async function sdkQuery(
  prompt: string,
  options: SdkQueryOptions = {},
): Promise<SdkQueryResult> {
  const { model = "sonnet", resume, stream } = options;

  let text = "";
  let sessionId = "";
  let durationMs = 0;
  let numTurns = 0;

  const queryOptions: Record<string, unknown> = {
    model,
    permissionMode: "default",
    cwd: process.cwd(),
  };

  if (resume) {
    queryOptions.resume = resume;
  }
  if (stream) {
    queryOptions.includePartialMessages = true;
  }

  for await (const message of query({
    prompt,
    options: queryOptions as Parameters<typeof query>[0]["options"],
  })) {
    if (stream && "message" in message) {
      const msg = message as {
        message?: { content?: Array<{ type: string; text?: string }> };
      };
      if (msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === "text" && block.text) {
            const newText = block.text;
            if (newText.length > text.length) {
              process.stdout.write(newText.slice(text.length));
              text = newText;
            }
          }
        }
      }
    }

    if ("result" in message) {
      const m = message as {
        session_id: string;
        duration_ms: number;
        num_turns: number;
        result?: string | null;
      };
      sessionId = m.session_id;
      durationMs = m.duration_ms;
      numTurns = m.num_turns;
      if (m.result) {
        text = m.result;
      }
    }
  }

  return { text, sessionId, durationMs, numTurns };
}
