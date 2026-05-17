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

const baseApp = new Elysia()
  .use(cors({ origin: config.CORS_ORIGIN }));

export const app = (
  process.env.NODE_ENV === "production"
    ? baseApp
    : baseApp.use(
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
)
  .use(staticPlugin({ 
    assets: path.resolve(process.cwd(), "dist-frontend"), 
    prefix: "/" 
  }))
  .get("/health", () => ({ status: "ok" }))
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
  // Fallback for SPA routing and static files
  .get("*", async ({ path: requestPath, headers }) => {
    const relPath = requestPath.startsWith("/") ? requestPath.slice(1) : requestPath;
    const filePath = path.join(process.cwd(), "dist-frontend", relPath || "index.html");
    const file = Bun.file(filePath);
    
    if (await file.exists()) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".js": "application/javascript",
        ".mjs": "application/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
      };

      return new Response(file, {
        headers: {
          "Content-Type": mimeTypes[ext] || file.type || "application/octet-stream",
        },
      });
    }

    // Only serve index.html for navigation requests (HTML)
    if (headers["accept"]?.includes("text/html")) {
      const indexFile = Bun.file(path.join(process.cwd(), "dist-frontend", "index.html"));
      if (await indexFile.exists()) {
        return new Response(indexFile, {
          headers: { "Content-Type": "text/html" }
        });
      }
    }
    return new Response("Not Found", { status: 404 });
  });
