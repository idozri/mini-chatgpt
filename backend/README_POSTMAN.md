# Postman Collection Setup

This directory contains Postman collections for testing the Mini ChatGPT API.

## Files

- `Postman_Collection.json` - Main API collection with all endpoints
- `Postman_Environment.json` - Environment variables for local development

## Import Instructions

### Method 1: Import Collection and Environment

1. Open Postman
2. Click **Import** button (top left)
3. Select both `Postman_Collection.json` and `Postman_Environment.json`
4. Click **Import**

### Method 2: Import via URL (if hosted)

1. Open Postman
2. Click **Import** button
3. Select **Link** tab
4. Enter the collection URL
5. Click **Continue** → **Import**

## Environment Setup

After importing, set up the environment:

1. Click the **Environments** icon (eye icon) in the top right
2. Select **Mini ChatGPT - Local** environment
3. Verify `base_url` is set to `http://localhost:3001` (or your server URL)
4. Make sure the environment is selected (dropdown shows "Mini ChatGPT - Local")

## Usage

### Quick Start Workflow

1. **Health Check**: Verify server is running

   - `GET /healthz`

2. **Create Conversation**: Create a new conversation

   - `POST /api/conversations`
   - Copy the `id` from the response

3. **Send Message**: Send a message to the conversation

   - `POST /api/conversations/:conversationId/messages`
   - Replace `:conversationId` with the ID from step 2

4. **Get Conversation**: View conversation with messages

   - `GET /api/conversations/:conversationId`

5. **List Conversations**: View all conversations
   - `GET /api/conversations`

### Using Variables

The collection uses variables for easy testing:

- `{{base_url}}` - Base URL of the API (default: `http://localhost:3001`)
- `:conversationId` - Path variable for conversation ID

To use a conversation ID across requests:

1. After creating a conversation, copy the `id` from the response
2. Update the `conversationId` variable in the environment:
   - Click the environment icon
   - Edit `conversationId` variable
   - Paste the ID
   - Save

Or manually replace `:conversationId` in the URL path.

## Collection Structure

```
Mini ChatGPT API
├── Health Check
│   └── Health Check
├── Conversations
│   ├── Create Conversation
│   ├── List All Conversations
│   ├── Get Conversation
│   └── Delete Conversation
└── Messages
    └── Send Message
```

## Example Requests

### Create Conversation

```json
POST /api/conversations
Content-Type: application/json

{
  "title": "My New Conversation"
}
```

### Send Message

```json
POST /api/conversations/clx1234567890/messages
Content-Type: application/json

{
  "content": "What is the weather like?",
  "role": "user"
}
```

### Get Conversation with Pagination

```
GET /api/conversations/clx1234567890?limit=20&cursor=eyJpZCI6...
```

## Testing Tips

1. **Start with Health Check**: Always verify the server is running first
2. **Save Conversation ID**: After creating a conversation, save the ID for subsequent requests
3. **Test Pagination**: Use the `cursor` from responses to test pagination
4. **Test Error Cases**: Try invalid IDs, missing fields, etc.
5. **Monitor Logs**: Check server logs for detailed error messages

## Troubleshooting

### Server Not Responding

- Verify server is running: `npm run dev` in backend directory
- Check `base_url` is correct in environment
- Verify port 3001 is not in use

### 404 Errors

- Ensure conversation ID is correct (CUID format)
- Check the conversation exists via List All Conversations

### Validation Errors

- Check request body matches schema
- Verify Content-Type header is `application/json`
- Ensure required fields are present

### LLM Errors (502)

- Check LLM provider configuration in `.env`
- Verify `MOCK_LLM_BASE_URL` or `OLLAMA_BASE_URL` is accessible
- Check LLM service logs

## Automated Testing

You can use Postman's test scripts to automate testing. Example:

```javascript
pm.test('Status code is 201', function () {
  pm.response.to.have.status(201);
});

pm.test('Response has conversation ID', function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData.id).to.exist;

  // Save ID for next request
  pm.environment.set('conversationId', jsonData.id);
});
```

## Export/Share

To share the collection:

1. Right-click on collection → **Export**
2. Choose **Collection v2.1**
3. Share the JSON file

To update:

1. Right-click on collection → **Export**
2. Replace the existing `Postman_Collection.json` file
