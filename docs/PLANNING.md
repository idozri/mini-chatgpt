## Project Overview

OverBooked is a full-stack conversational AI client that orchestrates a chat UI, a Node/TypeScript backend, and pluggable LLM providers (mock and Ollama) backed by a persistent Postgres store. The repository is organized as a pnpm workspace with service-specific packages under the monorepo root.

## Architectural Principles

- **Separation of concerns**: keep UI, API routes, domain services, persistence, and infrastructure in distinct modules.
- **Testability**: design pure services (adapters, repositories) behind interfaces to make unit and integration tests straightforward.
- **Config-driven behavior**: all environment-dependent logic (LLM provider selection, DB URLs, feature flags) flows through typed config modules; no hard-coded values in feature code.
- **Resilience first**: implement retries, timeouts, cancellation, and structured logging to satisfy reliability requirements from the assignment.
- **Documentation parity**: update `README.md`, `DECISIONS.md`, and `TASK.md` whenever behavior or setup steps change.

## Repository Layout

- `docs/` — assignment brief and supporting documentation.
- `frontend/` — React + Vite client (already provided); enhancements live here.
- `backend/` — Node/TypeScript Express service with Prisma ORM (to be created).
- `packages/` — shared utilities (e.g., schema validators) should live in dedicated subdirectories when needed.
- `tests/` — top-level directory mirroring service structure for automated tests executed via pnpm.
- `docker/` — optional helper files (entrypoints, scripts) for container builds.

## Tooling & Conventions

- **Package manager**: pnpm workspaces; root `package.json` coordinates scripts (`pnpm lint`, `pnpm test`, `pnpm dev`).
- **Language**: Node.js (LTS 20) with TypeScript across backend and shared packages. Frontend remains TypeScript via Vite.
- **Linting/Formatting**: ESLint + Prettier with consistent configs shared via workspace. Follow existing frontend rules where possible.
- **Testing**: Vitest for unit/integration tests; Supertest for HTTP assertions on Express; Playwright reserved for future e2e if needed.
- **Git Hooks**: Husky-based pre-commit running `pnpm lint` and targeted tests (planned under `ops-docs`).

## Backend Structure

```
backend/
  src/
    app.ts            # Express app wiring, routes registration
    server.ts         # HTTP server bootstrap, graceful shutdown
    config/           # environment parsing with zod
    routes/           # express route handlers (conversation, messages, health)
    controllers/      # translate HTTP layer to services (validation + serialization)
    services/         # business logic (conversation lifecycle, pagination)
    repositories/     # Prisma data access
    adapters/
      llm/
        index.ts      # factory returning provider implementation
        mock.ts       # mock LLM adapter
        ollama.ts     # Ollama adapter
    lib/
      logger.ts       # pino logger with correlation IDs
      retry.ts        # backoff helpers
    middleware/
      error.ts
      correlation.ts
    schemas/          # zod schemas shared with frontend via shared package when needed
  prisma/
    schema.prisma     # DB schema definition
    migrations/       # Prisma migrations
  tests/
    integration/      # HTTP layer tests (Vitest + Supertest)
    unit/             # isolated service/adapters tests
```

## Naming & Coding Guidelines

- Prefer `camelCase` for variables/functions, `PascalCase` for classes/types, and `kebab-case` for file names except React components (use `PascalCase`).
- Controllers return typed DTOs; do not expose Prisma models directly.
- Use `async/await`; never mix with promise chains unless necessary.
- Include inline `// Reason:` comments when logic is non-trivial (e.g., retry decisions, pagination calculations).
- Employ dependency injection via factory functions for services and adapters to support testing.

## Logging & Observability

- Instantiate a `pino` logger in `lib/logger.ts` with middleware to attach a `x-correlation-id` header or generate a UUID fallback.
- Emit structured logs for key events: request start/finish, retry attempts, timeout cancellations, and database errors.
- Health endpoints: `/healthz` (dependency checks) and `/readyz` (readiness; DB connectivity, migrations applied).

## LLM Adapter Strategy

- Implement `LlmAdapter` interface with `complete` method returning `{ completion: string }`.
- Use factory selecting `mock` or `ollama` based on `LLM_PROVIDER`; default to `mock` when unset for local dev.
- Mock adapter calls `POST ${MOCK_LLM_BASE_URL}/complete` with joined conversation content; include retry/backoff.
- Ollama adapter targets `/api/generate` (per Ollama HTTP API), streaming disabled, with typed response handling and consistent error surface.

## Database & Pagination

- Use Postgres (Docker container) with Prisma. Core tables: `Conversation` (with `displayIndex` auto-increment, `deletedAt` soft-delete marker, `lastMessageAt`) and `Message` (enum `MessageRole`, text content, timestamps).
- Cursor pagination relies on `created_at` plus `id` tie-breakers; expose `nextCursor` / `prevCursor` as base64-encoded tokens.
- Persist conversation titles as generated `Conversation #<n>` derived from the `displayIndex` sequence and schedule hard deletes once `deletedAt` exceeds the undo grace period.

## Retry, Timeout, and Cancellation

- Wrap outbound LLM calls in a helper supporting up to two retries with exponential backoff (e.g., 250ms, 750ms) while honoring a total timeout ≤ 12s.
- When the frontend cancels a request, propagate AbortController signals through fetch/axios (planned using `undici` or native fetch once stable in Node 20).

## Deployment & Containers

- `frontend/Dockerfile`: multi-stage build (Node builder → nginx/alpine runner) serving the static bundle with cache-busting assets.
- `backend/Dockerfile`: multi-stage build compiling TypeScript, running `prisma generate`, and using a slim Node runtime with non-root user.
- `docker-compose.yml`: orchestrates Postgres, mock-llm, backend, frontend, and optional Ollama; injects env files, configures networks, health checks, and a shared volume (`postgres-data`).
- Compose will leverage wait-for scripts or healthcheck dependencies so backend starts after Postgres and mock-llm are healthy.
- Documentation updates (`README.md`, `DECISIONS.md`) must track container commands, migration steps, and adapter tradeoffs as they evolve.

## Documentation Expectations

- Keep `PLANNING.md` updated with architectural changes.
- `DECISIONS.md` must capture database choice, pagination method, adapters, retry strategies, and tradeoffs as they evolve.
- `README.md` includes setup (pnpm install, prisma migrate, docker compose) and service commands.

