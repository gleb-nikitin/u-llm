import { Hono } from "hono";
import { sseHub, type DetailMode } from "../sse/hub";

const app = new Hono();

/**
 * GET /api/stream
 * GET /api/stream?participant={id}
 * GET /api/stream?detail=standard|minimal|verbose
 * GET /api/stream?log=on|off
 *
 * Returns an SSE stream of agent activity events.
 * Without ?participant, streams all participants.
 * With ?participant=u-llm_exec, streams only that participant's events.
 * ?detail controls verbosity: minimal (start/done/error), standard (+ token/tool_use), verbose (+ tool_result/thinking)
 * ?log=on/off controls debug logging to data/sse-debug.log
 */
app.get("/", (c) => {
  const participantId = c.req.query("participant");
  const detailParam = c.req.query("detail") || "standard";
  const logParam = c.req.query("log");

  // Handle global logging control
  if (logParam === "on") {
    sseHub.setDebugLogging(true);
  } else if (logParam === "off") {
    sseHub.setDebugLogging(false);
  }

  // Validate detail mode
  const detailMode: DetailMode = ["minimal", "standard", "verbose"].includes(
    detailParam,
  )
    ? (detailParam as DetailMode)
    : "standard";

  const readable = new ReadableStream({
    start(controller) {
      // Subscribe to SSE hub with detail mode
      const subscriberId = sseHub.subscribe(
        (data: Uint8Array) => {
          controller.enqueue(data);
        },
        participantId,
        detailMode,
      );

      // Cleanup on abort
      c.req.raw.signal?.addEventListener("abort", () => {
        sseHub.unsubscribe(subscriberId);
        controller.close();
      });
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});

/**
 * POST /api/stream/control
 * Control global streaming state and detail mode.
 * Body: { "enabled"?: boolean, "detail"?: "minimal"|"standard"|"verbose" }
 * Both fields optional — omit to keep current value.
 */
app.post("/control", async (c) => {
  const body = await c.req.json<{ enabled?: boolean; detail?: DetailMode }>();

  if (body.enabled !== undefined) {
    sseHub.setStreamingEnabled(body.enabled);
  }

  if (body.detail !== undefined) {
    const validDetail = ["minimal", "standard", "verbose"];
    if (validDetail.includes(body.detail)) {
      sseHub.setDetailMode(body.detail);
    }
  }

  return c.json(sseHub.getStatus());
});

/**
 * GET /api/stream/status
 * Get current streaming state: enabled, detail mode, client count, logging status.
 */
app.get("/status", (c) => {
  return c.json(sseHub.getStatus());
});

export default app;
