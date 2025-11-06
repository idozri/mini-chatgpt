# Task Log — 2025-11-05

## Active Tasks

- [x] Establish project documentation baseline (`PLANNING.md`, `TASK.md`).
- [x] Catalogue frontend gaps vs assignment requirements.
- [x] Initialize backend Express + Prisma workspace structure.
- [x] Design Postgres schema and migration plan for conversations/messages.
- [x] Outline API endpoints, pagination strategy, and LLM adapter interface.
- [x] Plan Dockerfiles, Compose layout, and documentation updates.

## Discovered During Work

- [x] Replace mock sidebar data with API-driven conversation list (create, select, delete).
- [x] Implement optimistic delete with undo toast and backend reconciliation.
- [x] Add cursor-based pagination controls for message history.
- [x] Wire chat composer to backend send endpoint with disabled state and cancel support.
- [x] Surface loading, empty, and error states for conversations and messages.
- [x] Add EllipsisVertical icon with dropdown menu for each conversation to rename conversation title (2025-01-XX): Added PATCH endpoint in backend, frontend API method, dropdown menu with rename and delete options, and dialog for editing conversation title.
- [x] Create backend Dockerfile with multi-stage build and Prisma generation step. (Completed: backend/Dockerfile with multi-stage build)
- [x] Create frontend Dockerfile serving the Vite build artifacts. (2025-11-06)
- [x] Write docker-compose.yml with Postgres, backend, frontend, mock-llm, and Ollama services. (2025-11-06)
- [x] Create production-ready Express + Prisma server in backend/ (2025-01-XX): Complete backend implementation with TypeScript, Express, Prisma (SQLite), LLM adapters (mock/ollama), resilience features (retry, timeout, abort), cursor pagination, structured logging, health check, and Dockerfile.
- [x] Auto-generate conversation titles as "Conversation #<index>" (2025-11-06): Added displayIndex field to Conversation schema, created migration to populate existing conversations with sequential indices, updated POST /api/conversations endpoint to auto-generate titles, and updated frontend to not send title in create request.

## Notes

- Update task status to `[x]` when completed and record completion context inline.
- Add new findings, blockers, or required follow-ups to “Discovered During Work” immediately.
- Run `pnpm --filter backend prisma:migrate dev --name init` after configuring Postgres to generate the initial schema migration.
