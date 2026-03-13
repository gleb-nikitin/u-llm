import { query } from "@anthropic-ai/claude-agent-sdk";
import { join } from "path";

export interface SdkEvent {
  type: "token" | "tool_use" | "tool_result" | "thinking" | "system" | "result";
  text?: string;
  tool?: string;
  input?: unknown;
  summary?: string;
  result?: string;
  subtype?: string;
  session_id?: string;
  model?: string;
  usage?: unknown;
  stop_reason?: string;
  num_turns?: number;
  cost_usd?: number;
  duration_ms?: number;
}

export interface SdkQueryOptions {
  model?: string;
  effort?: string;
  resume?: string;
  forkSession?: boolean;
  stream?: boolean;
  onDelta?: (text: string) => void;
  onEvent?: (event: SdkEvent) => void;
  systemPrompt?: string | { type: "preset"; preset: "claude_code"; append?: string };
  persistSession?: boolean;
  maxTurns?: number;
  permissionMode?: string;
  cwd?: string;
}

export interface SdkQueryResult {
  text: string;
  sessionId: string;
  actualModel: string;
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
    effort,
    resume,
    forkSession,
    stream,
    onDelta,
    onEvent,
    systemPrompt,
    persistSession,
    maxTurns = 100,
    permissionMode = "bypassPermissions",
    cwd,
  } = options;

  let text = "";
  let sessionId = "";
  let actualModel = "";
  let durationMs = 0;
  let numTurns = 0;
  let costUsd = 0;

  const queryOptions: Record<string, unknown> = {
    model,
    permissionMode,
    maxTurns,
    cwd: cwd ?? join(import.meta.dir, ".."),
    sandbox: { enabled: false },
    settingSources: ["project"],
    mcpServers: {
      "code-indexer": {
        type: "http",
        url: "http://127.0.0.1:8978/sse",
      },
    },
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
  if (effort) {
    queryOptions.effort = effort;
  }
  if (stream || onEvent) {
    queryOptions.includePartialMessages = true;
  }

  for await (const message of query({
    prompt,
    options: queryOptions as Parameters<typeof query>[0]["options"],
  })) {
    // Capture actual model from AssistantMessage (ground truth, set by API)
    if (!actualModel && "message" in message) {
      const m = message as { message?: { model?: string } };
      if (m.message?.model) {
        actualModel = m.message.model;
      }
    }

    if (onEvent && "type" in message && (message as { type?: string }).type === "system") {
      const sysMsg = message as { type: string; subtype?: string; session_id?: string };
      onEvent({
        type: "system",
        subtype: sysMsg.subtype,
        session_id: sysMsg.session_id,
      });
    }

    if ((stream || onEvent) && "message" in message) {
      const msg = message as {
        message?: {
          content?: Array<{
            type: string;
            text?: string;
            name?: string;
            input?: unknown;
            content?: unknown;
          }>;
          model?: string;
          usage?: unknown;
          stop_reason?: string;
        };
      };
      if (msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === "text" && block.text) {
            const newText = block.text;
            if (newText.length > text.length) {
              const delta = newText.slice(text.length);
              if (onDelta) {
                onDelta(delta);
              } else if (!onEvent) {
                process.stdout.write(delta);
              }
              if (onEvent) {
                onEvent({
                  type: "token",
                  text: delta,
                  model: msg.message?.model,
                  usage: msg.message?.usage,
                  stop_reason: msg.message?.stop_reason,
                });
              }
              text = newText;
            }
          } else if (block.type === "tool_use" && block.name) {
            if (onEvent) {
              // Truncate input at 100 chars
              let truncatedInput = block.input;
              if (typeof block.input === "string") {
                truncatedInput = block.input.slice(0, 100);
              } else if (block.input) {
                const jsonStr = JSON.stringify(block.input);
                truncatedInput = jsonStr.slice(0, 100);
              }
              onEvent({
                type: "tool_use",
                tool: block.name,
                input: truncatedInput,
              });
            }
          } else if (block.type === "tool_result") {
            if (onEvent) {
              // tool_result carries result text in `content` (ToolResultBlockParam), not `input`
              const raw = block.content;
              const resultStr = raw
                ? typeof raw === "string"
                  ? raw
                  : JSON.stringify(raw)
                : "completed";
              onEvent({
                type: "tool_result",
                tool: block.name,
                result: resultStr.slice(0, 400),
              });
            }
          } else if (block.type === "thinking" && block.text) {
            if (onEvent) {
              // No truncation for thinking
              onEvent({
                type: "thinking",
                text: block.text,
              });
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
        subtype?: string;
        model?: string;
      };
      sessionId = m.session_id;
      durationMs = m.duration_ms;
      numTurns = m.num_turns;
      costUsd = m.total_cost_usd ?? 0;
      if (m.result) {
        text = m.result;
      }
      if (m.subtype && m.subtype !== "success") {
        const errorText = `[SDK ${m.subtype}] turns=${m.num_turns} cost=$${(m.total_cost_usd ?? 0).toFixed(4)}`;
        console.warn(`[sdk-query] ${errorText}`);
        if (!text) {
          text = errorText;
        }
      }
      if (onEvent) {
        onEvent({
          type: "result",
          subtype: m.subtype,
          session_id: m.session_id,
          model: m.model ?? actualModel,
          num_turns: m.num_turns,
          cost_usd: m.total_cost_usd ?? 0,
          duration_ms: m.duration_ms,
        });
      }
    }
  }

  return { text, sessionId, actualModel, durationMs, numTurns, costUsd };
}
