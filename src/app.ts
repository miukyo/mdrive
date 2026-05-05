import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { staticPlugin } from "@elysiajs/static";
import { swagger } from "@elysiajs/swagger";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { authRouter } from "./http/routes/auth.js";
import { foldersRouter } from "./http/routes/folders.js";
import { filesRouter } from "./http/routes/files.js";
import { streamRouter } from "./http/routes/stream.js";
import { indexingRouter } from "./http/routes/indexing.js";
import { shareRouter } from "./http/routes/share.js";
import { transfersRouter } from "./http/routes/transfers.js";
import { thumbnailRouter } from "./http/routes/thumbnail.js";

export const app = new Elysia()
  .use(cors({ origin: config.CORS_ORIGIN }))
  .use(
    swagger({
      path: "/docs",
      provider: "scalar",
      documentation: {
        info: {
          title: "Telegram Drive API",
          version: "2.0.0",
          description: "High-performance Telegram-based cloud storage API built with Elysia and Bun.",
        },
        tags: [
          { name: "Auth", description: "Authentication and session management" },
          { name: "Folders", description: "Folder creation and management" },
          { name: "Files", description: "File upload, download, and management" },
          { name: "Stream", description: "Media streaming with range support" },
          { name: "Index", description: "Search and storage statistics" },
          { name: "Share", description: "Public sharing and ZIP generation" },
          { name: "Transfers", description: "Real-time progress monitoring (SSE)" },
        ],
      },
    }),
  )
  .group("/api", (app) =>
    app
      .use(authRouter)
      .use(foldersRouter)
      .use(filesRouter)
      .use(streamRouter)
      .use(indexingRouter)
      .use(shareRouter)
      .use(transfersRouter)
      .use(thumbnailRouter),
  )
  .get("/health", () => ({ status: "ok" }))
  .use(staticPlugin({ assets: "dist-frontend", prefix: "/" }))
  .onError(({ code, error, set }) => {
    console.error(`Error [${code}]:`, error);
    
    // Safely extract status code and message
    const isError = error instanceof Error;
    const statusCode = isError && "statusCode" in error ? (error as any).statusCode : 500;
    const message = isError ? error.message : (error as any)?.message || "Internal Server Error";

    set.status = statusCode;
    return {
      error: {
        message,
      },
    };
  })
  // Fallback for SPA routing
  .get("*", async () => {
    const file = Bun.file(path.join(process.cwd(), "dist-frontend", "index.html"));
    if (await file.exists()) {
      return new Response(file);
    }
    return new Response("Not Found", { status: 404 });
  });
