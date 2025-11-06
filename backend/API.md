# API Documentation

Mini ChatGPT Backend API Documentation

**Base URL**: `http://localhost:3001` (default)

All endpoints return JSON responses. The API uses standard HTTP status codes.

---

## Table of Contents

- [Health Check](#health-check)
- [Conversations](#conversations)
  - [Create Conversation](#create-conversation)
  - [List Conversations](#list-conversations)
  - [Get Conversation](#get-conversation)
  - [Delete Conversation](#delete-conversation)
- [Messages](#messages)
  - [Send Message](#send-message)
- [Error Responses](#error-responses)

---

## Health Check

### `GET /healthz`

Check if the server is running.

**Response**

- **Status**: `200 OK`

**Response Body**

```json
{
  "status": "ok"
}
```

**Example**

```bash
curl http://localhost:3001/healthz
```

---

## Conversations

### Create Conversation

**`POST /api/conversations`**

Create a new conversation.

**Request Body**

```json
{
  "title": "My New Conversation"
}
```

**Validation Rules**

- `title`: string, required, 1-200 characters

**Response**

- **Status**: `201 Created`

**Response Body**

```json
{
  "id": "clx1234567890",
  "title": "My New Conversation",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "lastMessageAt": null
}
```

**Error Responses**

- `400 Bad Request` - Validation error
  ```json
  {
    "error": "Invalid request",
    "details": [
      {
        "path": ["title"],
        "message": "String must contain at least 1 character(s)"
      }
    ]
  }
  ```

- `500 Internal Server Error` - Server error

**Example**

```bash
curl -X POST http://localhost:3001/api/conversations \
  -H "Content-Type: application/json" \
  -d '{"title": "My New Conversation"}'
```

---

### List Conversations

**`GET /api/conversations`**

Get all conversations, ordered by creation date (newest first).

**Response**

- **Status**: `200 OK`

**Response Body**

```json
[
  {
    "id": "clx1234567890",
    "title": "My Conversation",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "lastMessageAt": "2025-01-15T11:00:00.000Z",
    "_count": {
      "messages": 5
    }
  },
  {
    "id": "clx0987654321",
    "title": "Another Conversation",
    "createdAt": "2025-01-14T09:15:00.000Z",
    "lastMessageAt": null,
    "_count": {
      "messages": 0
    }
  }
]
```

**Response Fields**

- `id`: Unique conversation identifier (CUID)
- `title`: Conversation title
- `createdAt`: ISO 8601 timestamp of creation
- `lastMessageAt`: ISO 8601 timestamp of last message (null if no messages)
- `_count.messages`: Total number of messages in the conversation

**Error Responses**

- `500 Internal Server Error` - Server error

**Example**

```bash
curl http://localhost:3001/api/conversations
```

---

### Get Conversation

**`GET /api/conversations/:id`**

Get a single conversation with paginated messages.

**Path Parameters**

- `id`: Conversation ID (CUID)

**Query Parameters**

- `cursor` (optional): Base64url-encoded cursor for pagination
- `limit` (optional): Number of messages per page (default: 20, max: 100)

**Response**

- **Status**: `200 OK`

**Response Body**

```json
{
  "id": "clx1234567890",
  "title": "My Conversation",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "lastMessageAt": "2025-01-15T11:00:00.000Z",
  "messages": {
    "items": [
      {
        "id": "cly1111111111",
        "role": "user",
        "content": "Hello!",
        "createdAt": "2025-01-15T10:30:00.000Z"
      },
      {
        "id": "cly2222222222",
        "role": "assistant",
        "content": "Hi there! How can I help you?",
        "createdAt": "2025-01-15T10:30:05.000Z"
      }
    ],
    "nextCursor": "eyJpZCI6ImNseTIyMjIyMjIyMjIiLCJjcmVhdGVkQXQiOiIyMDI1LTAxLTE1VDEwOjMwOjA1LjAwMFoifQ",
    "prevCursor": "eyJpZCI6ImNseTExMTExMTExMTEiLCJjcmVhdGVkQXQiOiIyMDI1LTAxLTE1VDEwOjMwOjAwLjAwMFoifQ",
    "hasMore": true
  }
}
```

**Response Fields**

- `id`: Conversation ID
- `title`: Conversation title
- `createdAt`: ISO 8601 timestamp of creation
- `lastMessageAt`: ISO 8601 timestamp of last message
- `messages.items`: Array of message objects
  - `id`: Message ID (CUID)
  - `role`: Message role (`"user"` or `"assistant"`)
  - `content`: Message content
  - `createdAt`: ISO 8601 timestamp
- `messages.nextCursor`: Cursor for next page (null if no more pages)
- `messages.prevCursor`: Cursor for previous page (null if no previous page)
- `messages.hasMore`: Boolean indicating if more messages exist

**Pagination**

Messages are returned in descending order (newest first). Use `nextCursor` to fetch older messages:

```bash
GET /api/conversations/clx1234567890?cursor=eyJpZCI6...&limit=20
```

**Error Responses**

- `404 Not Found` - Conversation not found
  ```json
  {
    "error": "Conversation not found"
  }
  ```

- `500 Internal Server Error` - Server error

**Example**

```bash
# Get first page
curl http://localhost:3001/api/conversations/clx1234567890?limit=20

# Get next page
curl "http://localhost:3001/api/conversations/clx1234567890?cursor=eyJpZCI6...&limit=20"
```

---

### Delete Conversation

**`DELETE /api/conversations/:id`**

Delete a conversation and all its messages (cascade delete).

**Path Parameters**

- `id`: Conversation ID (CUID)

**Response**

- **Status**: `204 No Content` (no response body)

**Error Responses**

- `404 Not Found` - Conversation not found
  ```json
  {
    "error": "Conversation not found"
  }
  ```

- `500 Internal Server Error` - Server error

**Example**

```bash
curl -X DELETE http://localhost:3001/api/conversations/clx1234567890
```

---

## Messages

### Send Message

**`POST /api/conversations/:id/messages`**

Send a message to a conversation and receive an LLM-generated response.

**Path Parameters**

- `id`: Conversation ID (CUID)

**Request Body**

```json
{
  "content": "What is the weather like?",
  "role": "user"
}
```

**Validation Rules**

- `content`: string, required, 1-10000 characters
- `role`: enum, optional, `"user"` or `"assistant"` (default: `"user"`)

**Response**

- **Status**: `201 Created`

**Response Body**

```json
{
  "userMessage": {
    "id": "cly3333333333",
    "conversationId": "clx1234567890",
    "role": "user",
    "content": "What is the weather like?",
    "createdAt": "2025-01-15T11:00:00.000Z"
  },
  "assistantMessage": {
    "id": "cly4444444444",
    "conversationId": "clx1234567890",
    "role": "assistant",
    "content": "I don't have access to real-time weather data...",
    "createdAt": "2025-01-15T11:00:05.000Z"
  }
}
```

**Response Fields**

- `userMessage`: The created user message object
- `assistantMessage`: The LLM-generated assistant message object

**Behavior**

1. Validates the conversation exists
2. Creates and saves the user message
3. Fetches conversation history for LLM context
4. Calls the configured LLM provider (mock or Ollama)
5. Creates and saves the assistant response
6. Updates the conversation's `lastMessageAt` timestamp
7. Returns both messages

**LLM Integration**

The endpoint uses the configured LLM provider (set via `LLM_PROVIDER` environment variable):

- **Mock Provider**: Calls `MOCK_LLM_BASE_URL/complete`
- **Ollama Provider**: Calls `OLLAMA_BASE_URL/api/generate`

Both providers support:
- Retry logic (2 retries with exponential backoff: 500ms, 1000ms)
- 12-second timeout
- Request cancellation via AbortSignal

**Error Responses**

- `400 Bad Request` - Validation error
  ```json
  {
    "error": "Invalid request",
    "details": [
      {
        "path": ["content"],
        "message": "String must contain at least 1 character(s)"
      }
    ]
  }
  ```

- `404 Not Found` - Conversation not found
  ```json
  {
    "error": "Conversation not found"
  }
  ```

- `499 Client Closed Request` - Request cancelled/aborted
  ```json
  {
    "error": "Request cancelled"
  }
  ```

- `502 Bad Gateway` - LLM service unavailable
  ```json
  {
    "error": "LLM service unavailable",
    "messageId": "cly3333333333"
  }
  ```
  Note: The user message is still saved even if LLM fails.

- `500 Internal Server Error` - Server error

**Example**

```bash
curl -X POST http://localhost:3001/api/conversations/clx1234567890/messages \
  -H "Content-Type: application/json" \
  -d '{"content": "What is the weather like?", "role": "user"}'
```

---

## Error Responses

All endpoints may return the following error responses:

### Standard Error Format

```json
{
  "error": "Error message",
  "details": [] // Optional: Validation error details
}
```

### HTTP Status Codes

- `200 OK` - Successful GET request
- `201 Created` - Successful POST request (resource created)
- `204 No Content` - Successful DELETE request
- `400 Bad Request` - Invalid request (validation errors)
- `404 Not Found` - Resource not found
- `499 Client Closed Request` - Request cancelled
- `500 Internal Server Error` - Server error
- `502 Bad Gateway` - LLM service unavailable

---

## Data Models

### Conversation

```typescript
{
  id: string;              // CUID
  title: string;           // 1-200 characters
  createdAt: string;       // ISO 8601 timestamp
  lastMessageAt: string | null;  // ISO 8601 timestamp or null
}
```

### Message

```typescript
{
  id: string;              // CUID
  conversationId: string;  // CUID (foreign key)
  role: "user" | "assistant";
  content: string;         // 1-10000 characters
  createdAt: string;      // ISO 8601 timestamp
}
```

### Paginated Response

```typescript
{
  items: T[];              // Array of items
  nextCursor: string | null;  // Base64url-encoded cursor
  prevCursor: string | null;  // Base64url-encoded cursor
  hasMore: boolean;       // Whether more items exist
}
```

---

## Environment Configuration

The API behavior is controlled by environment variables:

- `DATABASE_URL` - Prisma database connection string (default: `file:./dev.db`)
- `PORT` - Server port (default: `3001`)
- `LLM_PROVIDER` - LLM provider: `"mock"` or `"ollama"` (default: `"mock"`)
- `MOCK_LLM_BASE_URL` - Mock LLM service URL (required when `LLM_PROVIDER=mock`)
- `OLLAMA_BASE_URL` - Ollama service URL (required when `LLM_PROVIDER=ollama`)
- `OLLAMA_MODEL` - Ollama model name (required when `LLM_PROVIDER=ollama`)
- `LOG_LEVEL` - Logging level (default: `"debug"` in development, `"info"` in production)

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- All IDs are CUIDs (Collision-resistant Unique Identifiers)
- The API uses cursor-based pagination for better performance with large datasets
- CORS is enabled for all origins
- Request/response logging is enabled via Pino (except for `/healthz`)
- The LLM adapter automatically retries failed requests (2 retries with exponential backoff)
- LLM requests timeout after 12 seconds

