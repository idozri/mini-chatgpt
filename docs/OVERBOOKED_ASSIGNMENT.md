# 🧪 Full-Stack Home Assignment — “Mini ChatGPT”

Build a minimal ChatGPT-style web app. You must first implement the app using a mock LLM, and then extend your implementation to support a real local LLM via **Ollama**. Swapping between mock and real LLM must be configurable via **environment variables** — no code changes allowed to toggle between them.

You can use any language/framework for frontend and backend. Storage must be a real DB (see below).

You must deliver working Dockerfiles for:

- `mock-llm` (use the reference server below — keep it as-is)
- `backend`
- `frontend`

…and your own `docker-compose.yml` to run everything together (no templates provided).

---

## 🔎 UI Requirement

This will be tested on **mobile (narrow screens)** and **desktop**. Your UI must look good and remain fully usable on both.

---

## 🚦 LLM Progression (Mandatory Flow)

1. **Step 1** — Implement using the provided mock-llm. Confirm all features work against it.
2. **Step 2** — Add a real LLM integration via **Ollama**. The backend must use a pluggable adapter so that switching between mock and Ollama only requires changing environment variables.

**Suggested envs:**

```env
LLM_PROVIDER=mock|ollama
MOCK_LLM_BASE_URL=http://mock-llm:8080
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3
```

The backend must detect the provider via `LLM_PROVIDER` and route to the correct adapter. Both adapters must return the same response shape:

```ts
{
  completion: string;
}
```

**Adapter contract (example; language-agnostic):**

```ts
interface LlmAdapter {
  complete(input: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  }): Promise<{ completion: string }>;
}
```

**Mock adapter:** `POST ${MOCK_LLM_BASE_URL}/complete` with `{ content }` (build content from joined conversation history).

**Ollama adapter:** Call Ollama’s HTTP API to generate a completion from `OLLAMA_MODEL`; normalize response to `{ completion }`.

---

## 🎯 Core Features

1. **Basic Chat UI**

   - Send a message.
   - Cancel a send in progress.
   - While waiting for a response (or after cancel), input must be disabled until resolved.
   - No streaming required.

2. **Conversations**

   - Left panel to list conversations.
   - Start a new conversation.
   - Delete a conversation.
   - Each conversation has a hard-coded running index title: `Conversation #1`, `Conversation #2`, …
   - Conversation is continuous (history preserved and sent to the backend/LLM).

3. **Reliability / Resilience**

   - Backend calls the LLM adapter (mock or Ollama).
   - Handle:
     - Random 500 errors (retry up to 2 times with back-off).
     - Random hangs (client timeout ≤ 12s; abort request; surface a friendly error).
   - A Cancel must abort the in-flight backend → LLM call and re-enable input.

4. **Storage — REQUIRED (No in-memory)**

   - Use a real database (SQLite/Postgres/MySQL/Mongo, your choice).
   - Persist conversations/messages across service restarts.
   - Ship the DB as a container in your compose and connect your backend to it.
   - Include DB migrations (any tool you like) and a repeatable init process.

5. **Optimistic UI (Delete with Undo)**

   - Deleting a conversation should be optimistic in the UI and offer an Undo for ~5 seconds.
   - If not undone, the backend delete proceeds.
   - If undone, the conversation is restored without a full reload.

6. **Paginated Endpoints**

   - Messages for a conversation must be cursor-paginated (not offset).
   - Provide API to fetch older/newer pages.
   - Conversation list may be simple or paginated — your choice — but messages endpoint must be paginated.

7. **Real LLM Integration via Ollama (Required)**

   - After mock integration, add support for Ollama.
   - Switching between mock and Ollama must be config-only via `LLM_PROVIDER`.
   - Use any model available in Ollama (e.g. `llama3`).

8. **Developer Notes (`DECISIONS.md`)**

   - Which DB you chose and why.
   - Schema & migration approach.
   - Retry, timeout, cancel behavior.
   - Pagination model.
   - LLM adapter structure and how switching is implemented.
   - Tradeoffs.

9. **Craftsmanship Expectations**
   - Accessibility & keyboard UX.
   - Polished empty/loading/error states.
   - Type-safe API validation.
   - Structured logging with correlation IDs.
   - `/healthz` and `/readyz` endpoints.
   - Minimal tests or pre-commit hooks.

---

## 🔌 API Contracts (Backend)

### Create a conversation

`POST /api/conversations` → `201`

```json
{ "id": "c_123", "title": "Conversation #3", "createdAt": "ISO" }
```

### List conversations

`GET /api/conversations` → `200`

```json
[
  {
    "id": "c_123",
    "title": "Conversation #1",
    "createdAt": "ISO",
    "lastMessageAt": "ISO|null"
  }
]
```

### Get a conversation (with paginated messages)

`GET /api/conversations/:id?messagesCursor=<cursor>&limit=<int>` → `200`

```json
{
  "id": "c_123",
  "title": "Conversation #1",
  "messages": [
    { "id": "m1", "role": "user", "content": "Hi", "createdAt": "ISO" },
    { "id": "m2", "role": "assistant", "content": "Hello!", "createdAt": "ISO" }
  ],
  "pageInfo": { "nextCursor": "...", "prevCursor": "..." }
}
```

### Delete a conversation

`DELETE /api/conversations/:id` → `204`

### Send a message (and get assistant reply)

`POST /api/conversations/:id/messages`

```json
{ "content": "How are you?" }
```

Response → `200`

```json
{
  "message": {
    "id": "m123",
    "role": "user",
    "content": "How are you?",
    "createdAt": "ISO"
  },
  "reply": {
    "id": "m124",
    "role": "assistant",
    "content": "...",
    "createdAt": "ISO"
  }
}
```

On LLM 500 or timeout:

```json
{ "error": "Upstream error/timeout", "retryAfterMs": 1000 }
```

### Cancel in-flight send

Preferred: client aborts fetch (no server endpoint required).  
If implemented:
`POST /api/conversations/:id/cancel`

```json
{ "clientMessageId": "temp-uuid" }
```

→ `204`

---

## 🤖 Mock LLM (Provided)

```js
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

function randomInt(n) {
  return Math.floor(Math.random() * n);
}

app.post('/complete', async (req, res) => {
  if (Math.random() < 0.1) return;
  if (Math.random() < 0.2)
    return res.status(500).json({ error: 'mock-llm error' });

  const content = (req.body && req.body.content) || '';
  console.log('Mock LLM got:', content);

  const reply = 'This is a mock response from a pretend LLM.';
  const delayMs = 500 + randomInt(1500);
  await new Promise((r) => setTimeout(r, delayMs));

  return res.json({ completion: reply });
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log('mock-llm listening on', port));
```

---

## 📦 `mock-llm/package.json`

```json
{
  "name": "mock-llm",
  "version": "1.0.0",
  "main": "server.js",
  "license": "MIT",
  "type": "commonjs",
  "dependencies": {
    "body-parser": "^1.20.2",
    "express": "^4.19.2"
  }
}
```

---

## 🐳 `mock-llm/Dockerfile`

```Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY server.js ./
EXPOSE 8080
CMD ["node", "server.js"]
```

---

## ⚙️ Services & Ports (Expected at Runtime)

| Service  | URL                   |
| -------- | --------------------- |
| mock-llm | http://mock-llm:8080  |
| backend  | http://backend:3001   |
| frontend | http://localhost:3000 |
| ollama   | http://ollama:11434   |

---

## ✅ Acceptance Checklist

- `docker compose up` starts mock-llm, DB, backend, frontend successfully.
- Mobile & desktop: UI looks good and is usable.
- Input disabled during send and Cancel works.
- Conversation history persisted and sent to LLM.
- New/Delete conversation works.
- Backend handles retries and timeouts.
- Paginated messages return stable cursors.
- Migrations re-runnable.
- `DECISIONS.md` explains architecture, pagination, LLM adapter, tradeoffs.

---

## 🧭 Running Locally

```bash
docker compose build
docker compose up
```

Access:

- Frontend → http://localhost:3000
- Backend → http://localhost:3001
- Mock LLM → http://mock-llm:8080/complete
- Ollama → http://ollama:11434

```

---

## 📦 Submission
- **Option 1:** Private Git repo (GitHub/GitLab/Bitbucket)
- **Option 2:** ZIP file via email
```
