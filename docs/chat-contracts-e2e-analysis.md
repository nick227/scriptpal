# Chat Contracts End-to-End Analysis

## API Contracts

### POST /chat (startChat)
- **Request:** `{ prompt, context?: { scriptId, chatRequestId, ... } }`
- **Response:** `{ success, intent, scriptId, scriptTitle, timestamp, mode, validation, metadata, response: { message, script, metadata, type }, history: Message[], questions? }`
- **history** source: `ChatMessageSerializer.flattenRows(chatMessageRepository.listByUser(..., 2, 0))`

### GET /chat/messages
- **Query:** `scriptId`, `limit`, `offset`
- **Response:** `Message[]` — same shape as `history`

### POST /chat/messages (addChatMessage)
- **Request:** `{ scriptId, message: { type, content, metadata? } }`
- **Response:** `{ messages: Message[] }` — from `toMessages(savedRow)`

### POST /system-prompts
- **Request:** `{ promptType, scriptId?, context }`
- **Response:** `{ success, intent, ..., response: { message, script, metadata } }` — **no history**

---

## Message Shape (Serializer Output)

```ts
{
  id: string,           // 'user_123' | 'assistant_123'
  role: 'user' | 'assistant',
  type: 'user' | 'assistant',
  content: string,
  timestamp: Date,
  scriptId: number,
  metadata: object | null,
  intent, promptTokens, completionTokens, totalTokens, costUsd, userId
}
```

---

## Client Consumption

| Source | Key used | Consumer |
|--------|----------|----------|
| startChat response | `history` | ChatManager.handleSend → appendServerMessages |
| startChat response | `data.messages` (fallback) | Same |
| startChat response | `data.response` (when no history) | extractRenderableContent → processAndRenderMessage |
| getChatMessages | raw array | ChatHistoryManager._fetchScriptHistory |
| addChatMessage | `messages` | (was SystemPromptOrchestrator, now removed) |

**loadChatHistory** expects: `message.content ?? message.message`, `determineMessageType(message)` uses `role` or `type`.

---

## Misalignments

### 1. Redundant history key
- Client: `data.history ?? data.messages`
- Server: always returns `history` for startChat; `messages` only for addChatMessage
- **Impact:** Low. Fallback never triggers for startChat.

### 2. extractApiResponseContent unused
- Canonical extractor exists but is never called
- All paths use `extractRenderableContent` → `extractLegacyDbContent`
- **Impact:** Dead code; mixed use of legacy vs canonical semantics.

### 3. Serializer normalizeContent legacy path
- Tries `JSON.parse(content)` and uses `parsed.response`
- Current saves use plain strings
- **Impact:** No effect on new data; possibly handles very old records.

### 4. Script handler history limit = 2
- `listByUser(userId, scriptId, 2, 0)` — only last 2 rows
- Each assistant row can expand to 2 messages (user + assistant)
- **Impact:** Chat shows at most 4 messages after a send; may feel truncated.

---

## Data Flow

```
User sends → POST /chat
  → Script handler OR ConversationCoordinator
  → BaseChain.execute (saves) OR chain.persistAssistantMessage (saves)
  → Response includes history from listByUser(limit 2)

Client receives → history.length > 0
  ? appendServerMessages(history) → loadChatHistory → render each
  : processAndRenderMessage(extractRenderableContent(data.response))
```

---

## Implemented Fixes

1. **extractApiResponseContent** — ChatManager.handleSend now uses canonical extractor for API responses, with extractRenderableContent fallback.
2. **History limit** — startChat increased from 2 to 10 rows.
3. **ResponseExtractor JSDoc** — Clarified which extractor to use in each context.

## Remaining (Low Priority)

- **Unify history key** — Standardize on `history`; `data.messages` fallback remains for addChatMessage response compatibility.
