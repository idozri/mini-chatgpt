# OverBooked

OverBooked is a full-stack chat application that pairs a React frontend with an Express/TypeScript backend and pluggable LLM providers (mock + Ollama). The repository is managed with pnpm workspaces so shared tooling and scripts live at the monorepo root.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+

### Install Dependencies

```bash
pnpm install
```

### Development Servers

- Frontend: `pnpm dev:frontend` (Vite dev server on `http://localhost:3000`)
- Backend: `pnpm dev:backend` (Express server on `http://localhost:3001`)

> Note: The backend currently exposes health endpoints only. Conversation APIs, database access, and LLM adapters will be implemented in subsequent tasks.

### Database & Prisma

- Environment variables are defined in `backend/.env.example` (copy to `.env` when ready).
- Run `pnpm --filter backend prisma:generate` to emit the Prisma client after migrations are created.
- Initial migration command: `pnpm --filter backend prisma:migrate dev --name init` (requires Postgres).

## Repository Structure

- `frontend/`: Existing Vite + React + shadcn UI prototype waiting for API integration.
- `backend/`: Express + Prisma service scaffold with health routes, DI container, and LLM adapter stubs.
- `docs/`: Assignment brief and planning materials.
- `PLANNING.md`: Architectural decisions and implementation guidelines.
- `TASK.md`: Running checklist for development work.

## Running with Docker Compose

```bash
docker compose build
docker compose up
```

Access:

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Mock LLM: http://localhost:8080/complete
- Ollama: http://localhost:11434

Notes:

- The backend uses Postgres via Prisma. On container start, the schema is applied with `prisma db push`.
- Switch LLM provider via `LLM_PROVIDER=mock|ollama` in `docker-compose.yml`.

## Deployment Roadmap

- `DECISIONS.md` will capture tradeoffs (DB schema, pagination, adapters) as implementation progresses.
