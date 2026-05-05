import { Elysia, t } from "elysia";
import {
  addProgressClient,
  removeProgressClient,
  ProgressClient,
} from "../../services/progress.js";
import { ApiError } from "../errors.js";

export const transfersRouter = new Elysia({ prefix: "/transfers" })
  .derive(({ headers, query }) => {
    const sessionId = (headers["x-session-id"] as string) || (query.session_id as string);
    return { 
      sessionId,
      hasSession: !!sessionId 
    };
  })
  .onBeforeHandle(({ hasSession, set }) => {
    if (!hasSession) {
      set.status = 401;
      return {
        error: { message: "Unauthorized: missing session ID" },
      };
    }
  })
  .get("/events", ({ sessionId, set }) => {
    set.headers["Content-Type"] = "text/event-stream";
    set.headers["Cache-Control"] = "no-cache";
    set.headers["Connection"] = "keep-alive";

    const stream = new ReadableStream({
      start(controller) {
        const client: ProgressClient = {
          write: (data: string) => {
            try {
              controller.enqueue(new TextEncoder().encode(data));
            } catch (e) {
              // Ignore if controller is closed
            }
          },
        };

        addProgressClient(sessionId!, client);

        // Keep-alive heartbeat
        const interval = setInterval(() => {
          client.write(": keep-alive\n\n");
        }, 30000);

        return () => {
          clearInterval(interval);
          removeProgressClient(sessionId!, client);
        };
      },
      cancel() {
        // Handled by return in start if using standard stream, 
        // but Elysia might need it here.
      }
    });

    return new Response(stream, { headers: set.headers as any });
  }, {
    query: t.Object({
      session_id: t.Optional(t.String({ description: "Session ID (alternative to header)" })),
    }),
    detail: {
      summary: "Subscribe to transfer progress (SSE)",
      description: "Server-Sent Events endpoint for real-time progress updates on uploads and other background tasks.",
      tags: ["Transfers"],
    }
  });
