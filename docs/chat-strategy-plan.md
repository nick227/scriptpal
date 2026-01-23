# Chat Strategy Plan

## 1. Situation Snapshot
- The chat widget is growing in scope and currently keeps a lot of behavior inside `ChatManager`, making it hard to reason about user-facing flows, script operations, and history integration (`public/js/widgets/chat/ChatManager.js:14`, `public/js/widgets/chat/ChatManager.js:114`, `public/js/widgets/chat/ChatManager.js:319`).
- Chat history should already live per user and per script, but the symptom users report is that it "jumps" between sessions—suggesting that either the front-end fails to scope API calls to the authenticated `userId` or the back-end request pipeline is not always receiving/propagating that identity (`server/controllers/chatController.js:38`, `server/controllers/chatController.js:165`).
- We have modularization ideas (message processing, script handlers, validation, caching) and standardization opportunities (error handling, response shape, event naming) that would reduce surface area for future regressions.

## 2. End-to-End Flow Overview
1. **Front-end**: `ChatManager` orchestrates user input, rendering, script intent handling, and history updates while delegating persistence to `ChatHistoryManager` (`public/js/widgets/chat/ChatManager.js:47`, `public/js/widgets/chat/ChatManager.js:402`).
2. **Front-end history**: `ChatHistoryManager` caches script-specific stories, pushes new messages into a per-script map, and calls `api.getChatMessages`/`api.clearChatMessages` to sync with the server (`public/js/widgets/chat/ChatHistoryManager.js:20`, `public/js/widgets/chat/ChatHistoryManager.js:100`).
3. **API layer**: `chatController.startChat` drops into the `Chat` use case with `req.userId` and `scriptId`, whereas `getChatMessages`/`clearChatMessages` wrap `chatMessageRepository` calls that already filter by user and script (`server/controllers/chatController.js:20`, `server/controllers/chatController.js:48`, `server/controllers/chatController.js:94`, `server/controllers/chatController.js:133`, `server/controllers/chatController.js:165`).
4. **Server logic**: `Chat.processMessage` builds context (including history from `ChatHistoryManager`), routes through LangChain, and persists every assistant response via `historyManager.saveInteraction(...)` (`server/controllers/chat/Chat.js:51`, `server/controllers/chat/Chat.js:78`, `server/controllers/chat/Chat.js:142`).
5. **Persistence**: `server/controllers/chat/ChatHistoryManager` funnels to `chatMessageRepository`, which is the single writer to `prisma.chatMessage` and already scopes queries by `userId`/`scriptId` (`server/controllers/chat/ChatHistoryManager.js:9`, `server/controllers/chat/ChatHistoryManager.js:116`; `server/repositories/chatMessageRepository.js:4`).

## 3. Primary Pain Points
- **History not tied to user sessions**: Users with different `userId`s still see overlapping histories, indicating we either drop `req.userId` before hitting `ChatHistoryManager` or the front-end fails to request `getChatMessages` per authenticated session and script. We need to validate the auth middleware, ensure every chat endpoint logs the incoming `userId`, and possibly add a guard that rejects history access without it (`server/controllers/chatController.js:20`, `server/controllers/chatController.js:165`).
- **Monolithic `ChatManager`**: Message extraction (`processAndRenderMessage`, `processResponse`, `extractResponseContent`, `normalizeMessage`), script intent handling, validation, and caching all live inside the same class, making testing and reuse harder (`public/js/widgets/chat/ChatManager.js:114`, `public/js/widgets/chat/ChatManager.js:319`, `public/js/widgets/chat/ChatManager.js:402`, `public/js/widgets/chat/ChatManager.js:655`, `public/js/widgets/chat/ChatManager.js:760`).
- **Inconsistent patterns**: Error handling is mixed (`handleSend` vs. `safeRenderMessage` vs. `handleError`), response shapes vary (`Chat.formatResponse` vs. raw objects), and private helpers use both `_underscore` and plain names (`_handleScriptAnalysis` vs. `handleScriptAnalysis`). Events follow multiple naming styles (`CHAT:MESSAGE_ADDED`, `EventManager.EVENTS.CHAT.ERROR`).

## 4. Strategic Initiatives
### 4.1. Guarantee per-user, per-script history
- Instrument `chatController` and `ChatHistoryManager` with user/session IDs so we can trace when history is saved or queried (`chatController.getChatMessages` and `Chat.historyManager`).
- Add defensive checks in `chatMessageRepository.listByUser` to reject empty `userId`s and log what scripts are being requested (`server/repositories/chatMessageRepository.js:4`).
- Ensure the front-end `api` layer (used by `ChatHistoryManager`) includes cookies/headers/session tokens so `req.userId` is always populated; consider attaching the resolved `userId` to the `ChatHistoryManager` instance so client-side caches never mix users.
- Expand integration tests to cover multiple user IDs hitting `getChatMessages` and verifying isolation, and add a smoke test that writes a message via `ChatController.addChatMessage` and reads it back under the same user.

### 4.2. Extract a Message Processing module
- Move content normalization (`processResponse`, `extractResponseContent`, `normalizeMessage`) into a `MessageProcessor` class/service that returns a canonical `{ content, metadata, intent }` shape before rendering or persisting (`public/js/widgets/chat/ChatManager.js:114`, `public/js/widgets/chat/ChatManager.js:501`).
- Let `ChatManager` focus on orchestration: it should call `messageProcessor.process(...)`, hand the result to `renderer`, and inform `ChatHistoryManager`.
- This module would be fully unit-testable (covering JSON, string, and nested-response cases) and shareable between the widget and any headless runners.

### 4.3. Introduce a Script Operations handler
- Promote `handleScriptEdit`, `handleScriptAnalysis`, `handleScriptAppend`, and `handleLineInsertion` into a `ScriptOperationsHandler` that coordinates with `scriptOrchestrator` and `eventManager` (`public/js/widgets/chat/ChatManager.js:402`, `public/js/widgets/chat/ChatManager.js:423`, `public/js/widgets/chat/ChatManager.js:453`, `public/js/widgets/chat/ChatManager.js:493`).
- The handler can expose a public API such as `handleIntent(intent, data)` and internally manage private helpers consistently (avoid `_handleScriptAnalysis`/`handleScriptAnalysis` split).
- This makes intent-specific side effects easier to swap or mock for integration tests.

### 4.4. Consolidate validation into a `ChatValidator`
- Move the logic inside `validateSendConditions` and `validateHistoryConditions` into a standalone validator that can be reused and tested independently (`public/js/widgets/chat/ChatManager.js:655`, `public/js/widgets/chat/ChatManager.js:708`).
- Return structured results (`{ passes: boolean, reasons: [] }`) so UI code can display user-friendly messages.
- This also limits future duplication when new widgets need to check renderer or API readiness.

### 4.5. Separate performance concerns into a Chat Performance Manager
- The caching, batching, and statistics methods (`cacheMessage`, `_cleanupCacheIfNeeded`, `_processBatchOperations`, `processMessageOptimized`) are already grouped; they should live as a helper/manager (`public/js/widgets/chat/ChatManager.js:760`, `public/js/widgets/chat/ChatManager.js:828`).
- Emit hooks/events for cache hits/misses so the UI can surface performance diagnostics or fallbacks (e.g., show loading state if batch queue grows).

### 4.6. Standardize error handling & contracts
- Define a shared error contract: all try/catches should call `this.handleError(err, context)` with a consistent `context` string and optionally rethrow or return safe values.
- `Chat.formatResponse` should return a fixed schema (e.g., `{ success: true, intent, scriptId, response: { content, metadata } }`) so the front-end parser (the new `MessageProcessor`) does not have to guess between string/object shapes (`server/controllers/chat/Chat.js:32`).
- Normalize event names (`CHAT:MESSAGE_ADDED` vs. `EventManager.EVENTS.CHAT.ERROR`) and ensure each manager publishes on a clearly documented enum.
- Align naming: use `_` for private helpers but keep public wrappers consistent (e.g., rename `_handleScriptAnalysis` to `_handleScriptAnalysisInternal` and expose `handleScriptAnalysis`).

### 4.7. Observability & testing
- Add structured logs at each persistence boundary (client `addMessage` event, server `chatMessageRepository.create`, etc.) to diagnose history gaps quickly.
- Expand unit/integration tests for history isolation (`public/js/__tests__` already cover some requirements; add new expectations for multiple users hitting `chatController` endpoints).
- Capture performance stats via `getPerformanceStats` and, if possible, surface them in a lightweight dashboard or telemetry event.

## 5. Next Steps
1. Wire up `docs/chat-strategy-plan.md` with the rest of the onboarding docs so the team knows where to find the plan.
2. Start with the high-impact fixes: instrument history endpoints for `userId`, follow a single user request through `ChatManager` → `ChatController` → `chatMessageRepository`, and log/validate that the returned history respects both user and script.
3. Split `ChatManager` along the proposed modules incrementally, starting with `MessageProcessor` and `ScriptOperationsHandler`, and ensure tests/documentation reference the new layers.
4. Once separation is done, iterate on standardizing error handling, event names, and method naming conventions; use the new validator/performance manager helpers where appropriate.
