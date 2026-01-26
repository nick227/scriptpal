# Chat Implementation Roadmap

## 1. Vision & Goals
- Deliver a resilient chat experience that keeps history strictly scoped to `userId` + `scriptId`, enforces consistent message contracts, and scales modular logic for extensibility.
- Prioritize traceability for the most common user complaint (cross-user history bleed) while preparing the codebase for the proposed helper classes (`MessageProcessor`, `ScriptOperationsHandler`, `ChatValidator`, `ChatPerformanceManager`).

## 2. Phase 1 (Immediate Stabilization - weeks 1-2)
1. **Secure the history boundary**
   - Restrict `chatController` endpoints (`getChatMessages`, `startChat`, `clearChatMessages`) to requests containing a valid `req.userId`; log read/write operations with `{ userId, scriptId }` for diagnostics (`server/controllers/chatController.js:20`, `:94`, `:165`).
   - Update `chatMessageRepository.listByUser` and `create` to assert `userId`/`scriptId`, rejecting otherwise (`server/repositories/chatMessageRepository.js:4`).
   - Ensure front-end API calls send authentication cookies (e.g., `fetch` with `credentials: 'include'`) and bind the `ChatHistoryManager` cache to `userId:scriptId`.
2. **Establish monitoring & tests**
   - Add integration tests covering multiple users accessing the same script, verifying isolation, and rejecting unauthenticated history calls.
   - Log every persistence boundary (client add, server save, repository write) to support the “no userId → no history” principle.

## 3. Phase 2 (Modularization & Contracts - weeks 3-5)
1. **MessageProcessor Service**
  - Extract `processResponse`, `extractResponseContent`, `normalizeMessage`, and related helper logic into a stateless `MessageProcessor` that outputs `{ content, role, metadata, intent }` for rendering and persistence (`public/js/widgets/chat/core/ChatManager.js:114`, `:501`).
   - Update `ChatManager` to depend on the processor, simplifying message orchestration.
2. **ScriptOperationsHandler**
  - Move `handleScriptEdit`, `_handleScriptAnalysis`, `handleScriptAppend`, and `handleLineInsertion` into a dedicated handler that maps intents to orchestrator calls (`public/js/widgets/chat/core/ChatManager.js:402`, `:453`, `:493`).
   - Align naming conventions (no inconsistent `_` prefixes) and ensure error handling funnels through `handleError`.
3. **ChatValidator & Performance Manager**
   - Introduce `ChatValidator` to replace `validateSendConditions`/`validateHistoryConditions` and return structured feedback.
  - Extract caching/batching into `ChatPerformanceManager`, exposing stats and hooks while keeping `ChatManager` lean (`public/js/widgets/chat/core/ChatManager.js:760`, `:828`).

## 4. Phase 3 (Standards, Observability, Stabilization - weeks 6-8)
1. **Error/Response/Event Standardization**
   - Define a shared error handling contract where every try/catch invokes `handleError(context)` and optionally rethrows.
   - Normalize server response schema (e.g., `Chat.formatResponse`) so the front-end processor can rely on a single shape (`server/controllers/chat/Chat.js:32`).
   - Publish events through documented enums (e.g., `EventManager.EVENTS.CHAT.*`) and retire mixed strings like `CHAT:MESSAGE_ADDED`.
2. **Testing & telemetry**
   - Expand unit tests for `ChatHistoryManager`, `MessageProcessor`, and the new validator/performance helpers.
   - Surface `getPerformanceStats` metrics in logs or telemetry events to monitor caching/batching health.
3. **Client UX improvements**
   - Clear chat caches on user switches/restarts and ensure `ChatHistoryManager` never reuses stale data when `userId` changes.
   - Align renderer updates with the new processor for consistent event flow.

## 5. Rolling Deliverables & Communication
- Publish short updates after each phase so the team knows which stability issues were fixed (history isolation, auth coverage), which components were refactored (message/script handlers), and what standards were enforced (errors, events).
- Update `docs/chat-strategy-plan.md` to reference completed milestones and note any deviations discovered during implementation.

## 6. Follow-up (Post-Roadmap)
- Evaluate telemetry around chat history requests to catch regression early.
- Consider further splitting `ChatManager` into smaller widgets (e.g., separate UI + orchestration layers) once the helper services prove stable.
