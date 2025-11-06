# backend - Mini ChatGPT Server

Production-ready Express + Prisma server for the Mini ChatGPT project.

## Features

- **TypeScript** with strict type checking
- **Express.js** with async/await and middleware support
- **Prisma ORM** with SQLite (easy to switch to Postgres)
- **LLM Adapter System** supporting mock and Ollama providers
- **Resilience**: Retry with exponential backoff, 12s timeout, AbortController support
- **Cursor-based pagination** for messages
- **Structured logging** with Pino
- **Docker** multi-stage build

## Setup

### Prerequisites

- Node.js 20+
- npm or pnpm

### Installation

```bash
npm install
```

### Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
DATABASE_URL="file:./dev.db"
PORT=3001
LLM_PROVIDER=mock
MOCK_LLM_BASE_URL=http://localhost:3000
```

## Development

```bash
# Start dev server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## API Endpoints

### Health Check

- `GET /healthz` - Health check endpoint

### Conversations

- `POST /api/conversations` - Create new conversation
- `GET /api/conversations` - List all conversations
- `GET /api/conversations/:id` - Get conversation with paginated messages
  - Query params: `cursor` (optional), `limit` (default: 20)
- `DELETE /api/conversations/:id` - Delete conversation

### Messages

- `POST /api/conversations/:id/messages` - Send message and get LLM reply

## Docker

### Build

```bash
docker build -t backend .
```

### Run

```bash
docker run -p 3001:3001 \
  -e DATABASE_URL="file:./data.db" \
  -e LLM_PROVIDER=mock \
  -e MOCK_LLM_BASE_URL=http://host.docker.internal:3000 \
  backend
```

## LLM Providers

### Mock Provider

Set `LLM_PROVIDER=mock` and configure `MOCK_LLM_BASE_URL`.

The mock provider expects a POST request to `/complete` with:

```json
{
  "messages": [{ "role": "user", "content": "Hello" }]
}
```

And returns:

```json
{
  "completion": "Response text"
}
```

### Ollama Provider

Set `LLM_PROVIDER=ollama` and configure:

- `OLLAMA_BASE_URL` (default: http://localhost:11434)
- `OLLAMA_MODEL` (e.g., llama2)

## Resilience Features

- **Retries**: Up to 2 retries with exponential backoff (500ms, 1000ms)
- **Timeout**: 12 seconds per LLM call
- **Cancellation**: Supports AbortController for request cancellation

## Project Structure

```
backend/
├── src/
│   ├── index.ts          # Entry point
│   ├── app.ts            # Express app setup
│   ├── routes/           # API routes
│   ├── lib/              # Core libraries (prisma, logger, llmAdapter)
│   └── utils/            # Utilities (pagination)
├── prisma/
│   └── schema.prisma     # Database schema
└── Dockerfile            # Multi-stage Docker build
```
