# DECISIONS.md

## Database Choice

### Development: SQLite
For local development, we used **SQLite** because it is lightweight, file-based, and requires zero setup.  
It integrates seamlessly with **Prisma**, allowing developers to focus on logic and schema design without managing a running database service.  
SQLite is also fast for small-scale testing and supports all Prisma features, making it ideal for quick iterations.

### Production: PostgreSQL
In Docker and production environments, we switched to **PostgreSQL**.  
PostgreSQL is more robust, scalable, and supports concurrent writes, transactions, and advanced indexing — all essential for multi-user or production scenarios.  
It also ensures consistency and reliability when scaling horizontally or deploying across containers.  
Since Prisma uses the same schema definition for both SQLite and Postgres, the migration is seamless.

**Why PostgreSQL is a better choice for production:**
- Full ACID compliance and better concurrency handling.
- Rich SQL features: JSONB, indexing, window functions, and views.
- Horizontal scalability and performance under load.
- Native Docker image for reliable containerization.

---

## Schema and Migrations

Database schema is defined via **Prisma Migrate**.  
Each schema change generates a deterministic migration file, ensuring repeatable and predictable database setups across environments.  
Migrations can be re-run multiple times and will always yield the same schema, enabling reproducibility.

---

## Pagination

Pagination is implemented using **cursor-based pagination** for performance and scalability.  
This method avoids heavy `OFFSET` queries and ensures stable results even when records are added or removed between requests.

---

## Cancel / Retry / Timeout

The LLM adapter implements **request cancellation**, **retry logic**, and **timeout control** to ensure reliability.  
- **Cancel:** Uses `AbortSignal` to terminate requests on user cancel.  
- **Retry:** Retries failed requests up to 2 times using exponential backoff (500ms, 1000ms).  
- **Timeout:** Enforces a 12s request timeout to prevent hanging requests.

---

## LLM Adapter Design

We implemented two adapters:
1. **Mock LLM Adapter** — used for local testing and development, simulates responses with delays and errors.  
2. **Ollama LLM Adapter** — connects to a local or remote Ollama service for real completions.  

The adapter architecture follows a **pluggable provider pattern**, allowing switching providers via the `LLM_PROVIDER` environment variable.

---

## Tradeoffs and Design Rationale

| Decision | Tradeoff | Reasoning |
|-----------|-----------|-----------|
| SQLite in development | Limited concurrency | Simpler setup and fast feedback |
| Postgres in Docker | Requires service container | Scalable and production-ready |
| Prisma ORM | Slight overhead | Strong type safety and schema migrations |
| Cursor pagination | Slightly more complex queries | Better performance and consistency |
| Retry/timeout logic | Added code complexity | Improves network reliability |
| Mock LLM | Not real responses | Enables local testing and CI reliability |

---

**Summary:**  
The system is designed to balance developer simplicity (SQLite + mock adapters) with production robustness (Postgres + real LLM).  
This architecture ensures easy local development, reproducibility, and smooth scaling to real-world workloads.
