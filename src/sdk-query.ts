import { query } from "@anthropic-ai/claude-agent-sdk";

export interface SdkQueryOptions {
  model?: string;
  resume?: string;
  forkSession?: boolean;
  stream?: boolean;
  onDelta?: (text: string) => void;
  systemPrompt?: string | { type: "preset"; preset: "claude_code"; append?: string };
  persistSession?: boolean;
  maxTurns?: number;
  permissionMode?: string;
}

export interface SdkQueryResult {
  text: string;
  sessionId: string;
  durationMs: number;
  numTurns: number;
  costUsd: number;
}

export async function sdkQuery(
  prompt: string,
  options: SdkQueryOptions = {},
): Promise<SdkQueryResult> {
  const {
    model = "sonnet",
    resume,
    forkSession,
    stream,
    onDelta,
    systemPrompt,
    persistSession,
    maxTurns = 200,
    permissionMode = "bypassPermissions",
  } = options;

  let text = "";
  let sessionId = "";
  let durationMs = 0;
  let numTurns = 0;
  let costUsd = 0;

  const queryOptions: Record<string, unknown> = {
    model,
    permissionMode,
    maxTurns,
    cwd: process.cwd(),
  };

  if (resume) {
    queryOptions.resume = resume;
  }
  if (forkSession) {
    queryOptions.forkSession = true;
  }
  if (systemPrompt !== undefined) {
    queryOptions.systemPrompt = systemPrompt;
  }
  if (persistSession !== undefined) {
    queryOptions.persistSession = persistSession;
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
              const delta = newText.slice(text.length);
              if (onDelta) {
                onDelta(delta);
              } else {
                process.stdout.write(delta);
              }
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
        total_cost_usd?: number;
      };
      sessionId = m.session_id;
      durationMs = m.duration_ms;
      numTurns = m.num_turns;
      costUsd = m.total_cost_usd ?? 0;
      if (m.result) {
        text = m.result;
      }
    }
  }

  return { text, sessionId, durationMs, numTurns, costUsd };
}
