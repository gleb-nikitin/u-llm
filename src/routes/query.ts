import { Hono } from "hono";
import { sdkQuery } from "../sdk-query";
import { cliQuery } from "../cli-headless";
import { upsertSession } from "../session-store";

interface QueryBody {
  prompt: string;
  model?: string;
  via?: "sdk" | "cli";
  resume?: string;
  stream?: boolean;
}

const app = new Hono();

app.post("/", async (c) => {
  const body = await c.req.json<QueryBody>();
  const { prompt, model, via = "sdk", resume, stream = false } = body;

  const queryFn = via === "cli" ? cliQuery : sdkQuery;

  if (stream) {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const onDelta = (text: string) => {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "delta", text })}\n\n`,
            ),
          );
        };
        try {
          const result = await queryFn(prompt, {
            model,
            resume,
            stream: true,
            onDelta,
          });
          if (result.sessionId) {
            await upsertSession(result.sessionId, prompt);
          }
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "result",
                result: result.text,
                session_id: result.sessionId,
                duration_ms: result.durationMs,
                num_turns: result.numTurns,
              })}\n\n`,
            ),
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: message })}\n\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  }

  try {
    const result = await queryFn(prompt, { model, resume });
    if (result.sessionId) {
      await upsertSession(result.sessionId, prompt);
    }
    return c.json({
      result: result.text,
      session_id: result.sessionId,
      duration_ms: result.durationMs,
      num_turns: result.numTurns,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

export default app;
