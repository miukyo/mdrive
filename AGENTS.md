# AGENTS

This repository contains the Express API for Telegram Drive. Use this guide when making changes.

## Quick start

- Install: bun install
- Env:
  - DATABASE_URL=postgres://user:pass@localhost:5432/telegram_drive
  - CORS_ORIGIN=http://localhost:5173
  - PORT=3000
- DB schema: psql "$DATABASE_URL" -f db/schema.sql
- Run: bun run index.ts

## API docs

- OpenAPI JSON: /openapi.json
- Scalar docs: /docs

## Key folders

- src/http/routes: HTTP endpoints
- src/services: Telegram and helper logic
- src/repositories: Postgres access
- src/openapi.json: API spec
- db/schema.sql: Database schema

## File-by-file overview

- index.ts: App entrypoint; boots the Express server.
- src/app.ts: App wiring, middleware, and route mounts.
- src/config.ts: Runtime configuration from environment variables.
- src/db.ts: Postgres connection pool wrapper.
- src/openapi.json: OpenAPI spec served at /openapi.json and /docs.
- src/models.ts: Shared API/data types used by services and routes.
- src/http/errors.ts: API error class and centralized error handler.
- src/http/streamTokens.ts: Token issuance for streaming and previews.
- src/http/routes/auth.ts: Login + session lifecycle endpoints.
- src/http/routes/files.ts: File list/search/upload/download/delete/move endpoints.
- src/http/routes/folders.ts: Folder scan/create/delete endpoints.
- src/http/routes/preview.ts: Preview and thumbnail endpoints.
- src/http/routes/stream.ts: Streaming media endpoint.
- src/http/routes/transfers.ts: SSE progress subscription endpoint.
- src/http/routes/indexing.ts: Index refresh/search/cleanup endpoints.
- src/http/routes/share.ts: Public share links and ZIP download.
- src/repositories/sessions.ts: Session persistence in Postgres.
- src/repositories/index.ts: Indexed file/folder cache queries.
- src/repositories/shares.ts: Share token storage.
- src/services/telegram.ts: GramJS client lifecycle and auth helpers.
- src/services/drive.ts: Telegram drive operations (files/folders/search).
- src/services/preview.ts: Media download + caching helpers.
- src/services/indexer.ts: Indexing and cleanup routines.
- src/services/progress.ts: In-memory SSE progress fanout.

## Notes

- Use x-session-id header for authenticated API calls.
- Indexing and share links depend on cached data in Postgres; run POST /api/index/refresh after changes.
- File downloads are streamed in chunks to reduce memory usage.
