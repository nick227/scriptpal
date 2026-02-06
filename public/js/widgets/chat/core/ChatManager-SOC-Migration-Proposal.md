# ChatManager.js — Separation of Concerns (SOC) Migration Proposal

**Document Version:** 1.1 (MVP-focused)  
**Target File:** `public/js/widgets/chat/core/ChatManager.js`  
**Current Size:** ~1,038 lines  
**Date:** 2024

---

## Executive Summary

This proposal targets **reliability and material benefits only** — no new orchestrator layer, no premature abstractions. The main pain points causing bugs today:

1. **Response parsing scattered** — extraction logic spread across ChatManager
2. **Validation scattered** — send/history checks mixed into orchestration
3. **API + timeout mixed into ChatManager** — context building, race handling, timeout in one place

**Highest ROI fix (not in original plan):** Make the server return persisted rows and stop client-side speculative history. **Goal: UI only renders what the server saved.**

---

## Current State Analysis

### Concerns Currently Mixed in ChatManager

| Concern | Location (approx) | Lines | Notes |
|---------|-------------------|-------|-------|
| Initialization & Wiring | 46–114 | ~70 | Constructor, `initialize`, `setScriptOrchestrator`, etc. |
| Script Change Handling | 119–207 | ~90 | `handleScriptChange`, append queue flush, welcome message |
| Append Queue Management | 145–207 | ~65 | `flushAppendQueue`, `processAppendQueueForScript`, `dropQueueForOtherScripts` |
| Message Processing & Rendering | 233–264, 524–626 | ~130 | `processAndRenderMessage`, `normalizeMessage`, question buttons |
| Response/Content Extraction | 460–612 | ~150 | `extractResponseContent`, `extractMessageContent` (legacy), `_findResponseMessage`, `_extractJsonAssistantMessage` |
| User Interaction Orchestration | 309–387 | ~80 | `handleSend` (large orchestration block) |
| API Communication | 393–319 | ~35 | `getApiResponseWithTimeout` |
| Script Operations Routing | 324–388 | ~65 | `handleScriptOperations`, NEXT_FIVE_LINES → APPEND_SCRIPT mapping |
| Chat History Loading | 395–439, 565–590 | ~85 | `loadChatHistory`, `appendServerMessages` |
| Validation | 625–675 | ~50 | `validateSendConditions`, `validateHistoryConditions` |
| Processing State | 680–689 | ~10 | `startMessageProcessing`, `endMessageProcessing` |
| Error Handling & Utilities | 698–735 | ~40 | `handleError`, `safeRenderMessage`, `generateMessageId` |
| Context/Manager Delegation | 775–795 | ~20 | `setContentManager`, `setPageManager`, etc. |
| Cleanup & Lifecycle | 753–793, 797–814 | ~60 | `clearChat`, `updateChat`, `destroy` |

### Already Separated

- **ChatHistoryManager** — History persistence, script-specific history
- **ScriptOperationsHandler** — Edit/append/analyze script operations
- **ScriptContextManager** — AI chat context building
- **EventManager**, **StateManager** — Shared infrastructure

---

## Proposed Architecture

### Simplified Target (MVP)

**No new orchestrator layer. No AppendQueueManager. No tiny-service sprawl.**

```
ChatManager
  ├── ChatHistoryManager       # (existing)
  ├── ScriptContextManager     # (existing)
  ├── ScriptOperationsHandler  # (existing)
  ├── MessageNormalizer        # NEW: parsing consistency
  ├── ResponseExtractor        # NEW: single place for response parsing
  └── ChatValidationService    # NEW: validation in one place
```

### Target Module Layout

```
public/js/widgets/chat/core/
├── ChatManager.js              # Orchestrator (stays; wires modules below)
├── ChatHistoryManager.js       # (existing)
├── ScriptOperationsHandler.js  # (existing)
├── MessageNormalizer.js        # normalizeMessageShape, ensureMessageId
├── ResponseExtractor.js        # extractApiResponseContent, extractLegacyDbContent, extractFormattedScriptFromResponse
└── ChatValidationService.js    # validateSendConditions, validateHistoryConditions (return { ok, reason })
```

**Optionally:** One small helper for `getChatResponseWithTimeout` (single function, no class) if API+timeout bugs persist.

### Deferred for MVP (Do Not Add Yet)

- **ChatSendOrchestrator** — Premature; keep `handleSend` orchestration in ChatManager
- **AppendQueueManager** — Borderline premature; keep queue logic inline
- **Extra tiny services** — Only extract what directly fixes bugs (parsing, validation, API+timeout)

### Invariant Rule

**ChatManager never constructs chat rows manually.**

All rendered rows must originate from:
- Server `history` (persisted rows from API response), or
- Serializer (e.g. when loading from DB via `loadChatHistory` → `appendServerMessages`).

This prevents regressions. No speculative row construction.

---

## Highest ROI: Server Returns Persisted Rows

**Priority:** Do this first. Fixes the root cause of history/UI drift.

**Current problem:** Client speculatively adds messages to history and renders before the server confirms. If persistence fails or response shape differs, UI and DB diverge.

**Goal:** UI only renders what the server saved.

### Server Response Contract (Explicit)

Define the contract explicitly to prevent quiet drift between backend and frontend during refactors:

```json
{
  "history": [
    { "id": "...", "role": "user", "content": "...", "timestamp": "..." },
    { "id": "...", "role": "assistant", "content": "...", "timestamp": "..." }
  ],
  "intent": "APPEND_SCRIPT",
  "response": { ... }
}
```

- **`history`** — Persisted rows (user + assistant messages). Always present on success.
- **`intent`** — Script operation intent (e.g. `APPEND_SCRIPT`, `ANALYZE_SCRIPT`).
- **`response`** — Optional legacy / AI metadata (questions, analysis, etc.).

### Client Behavior (Binary)

**If `history` exists → use only history.** Render via `appendServerMessages`; no speculative `addMessage()`.

**Else → treat as error.** Toast + retry. No silent fallback. For MVP reliability: **fail loud.**

Silent fallback reintroduces drift.

---

## Phase 1: Extract Pure / Low-Dependency Modules

**Risk:** Low  
**Effort:** Small  
**Dependencies:** None

### 1.1 MessageNormalizer

**Responsibility:** Normalize message shape and ensure IDs.

**Split conceptually** (even if same file):
- `normalizeMessageShape(messageData, type)` — normalizes role, content, timestamp, metadata
- `ensureMessageId(message)` — adds ID if missing (client fallback when server ID not present)

**Why split:** Makes future server IDs easier to prioritize over client IDs. Avoids mixing normalization and ID generation in one "do everything" function.

**Interface:**
```js
// MessageNormalizer.js
export function normalizeMessageShape(messageData, type) { ... }
export function ensureMessageId(message) { ... }  // client fallback; prefer server ID when available
```

**ChatManager change:** Import and call both; use `ensureMessageId` only when server did not provide ID.

---

### 1.2 ResponseExtractor

**Responsibility:** Extract message content from API responses and legacy DB shapes.

**Separate "API" vs "DB legacy"** — avoid one giant "do everything" function. Prevents accidental new code paths using legacy extraction.

**Interface:**
```js
// ResponseExtractor.js
export function extractApiResponseContent(data) { ... }  // canonical API response (data.response)
export function extractLegacyDbContent(data) { ... }     // @deprecated — old DB records only
export function extractFormattedScriptFromResponse(response) { ... }
```

- **`extractApiResponseContent`** — Use for new API responses. Canonical shape: `data.response.message` etc.
- **`extractLegacyDbContent`** — Use only when hydrating old chat history from DB. Clearly deprecated; do not use for new API paths.

**ChatManager change:** Import and use `extractApiResponseContent` for API; `extractLegacyDbContent` only in `loadChatHistory` / legacy hydration.

---

### 1.3 ChatValidationService

**Responsibility:** Validate send and history conditions.

**Return errors, not booleans.** Instead of `return false`, return `{ ok: false, reason: 'EMPTY_MESSAGE' }`.

**Why:** Better logging, better UX later (toast specific reason), easier tests. Still MVP-simple.

**Interface:**
```js
// ChatValidationService.js
export function validateSendConditions(options) {
  const { message, renderer, api, isProcessing } = options;
  // Returns: { ok: true } | { ok: false, reason: 'EMPTY_MESSAGE' | 'NO_RENDERER' | 'ALREADY_PROCESSING' | ... }
}
export function validateHistoryConditions(options) {
  const { messages, renderer } = options;
  // Returns: { ok: true } | { ok: false, reason: 'NOT_ARRAY' | 'NO_RENDERER' | ... }
}
```

**ChatManager change:** Call validators; if `result.ok === false`, handle `result.reason` (log, toast, early return).

---

## Phase 2: Optional — Extract API + Timeout (If It Keeps Causing Bugs)

**Risk:** Low  
**Effort:** Small  

If `getApiResponseWithTimeout` continues to cause bugs (race conditions, unclear timeout handling), extract it to a single focused function:

```js
// apiChatHelper.js (or inline in ChatManager if preferred)
export async function getChatResponseWithTimeout(api, scriptContextManager, message, { timeout = 90000 } = {}) {
  const context = await scriptContextManager.getAIChatContext({ includeHistory: true, maxTokens: 1000 });
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timeout')), timeout)
  );
  return Promise.race([api.getChatResponse(message, { ...context }), timeoutPromise]);
}
```

**No new service class.** One function. ChatManager calls it. Keeps API + timeout + context in one testable place.

---

## Phase 3: Clean Up ChatManager

**Risk:** Low  
**Effort:** Small  

After extractions, ChatManager:
- Wires MessageNormalizer, ResponseExtractor, ChatValidationService
- Keeps `handleSend` orchestration inline (no ChatSendOrchestrator)
- Keeps append queue logic inline (no AppendQueueManager — borderline premature for MVP)
- Delegates to existing managers (ChatHistoryManager, ScriptContextManager, ScriptOperationsHandler)

### Estimated Outcome

- **ChatManager:** Still ~700–800 lines after extractions (orchestration stays)
- **New modules:** ~200–250 lines total (MessageNormalizer, ResponseExtractor, ChatValidationService)

---

## Migration Checklist

### Before Starting

- [ ] Ensure test coverage for ChatManager
- [ ] Document current public API surface (methods called externally)
- [ ] Create feature branch `refactor/chatmanager-soc`

### Highest ROI (Do First)

- [ ] **Server:** Return persisted `history` rows per contract (id, role, content, timestamp)
- [ ] **Client:** If `history` exists → use only `appendServerMessages`; no speculative `addMessage()`
- [ ] **Client:** If `history` empty/missing → treat as error; toast + retry (fail loud; no silent fallback)
- [ ] Run tests; verify no history drift

### Phase 1 — Extract Modules

- [x] Create `MessageNormalizer.js`
- [x] Create `ResponseExtractor.js`
- [x] Create `ChatValidationService.js`
- [x] Refactor ChatManager to use new modules
- [x] Run tests (35/37 pass; 2 pre-existing expectation mismatches)
- [ ] PR + review

### Phase 2 (Optional)

- [ ] Extract `getChatResponseWithTimeout` to helper if API+timeout bugs persist

### Phase 3 — Cleanup

- [ ] Remove dead code from ChatManager
- [ ] Add JSDoc to new modules
- [ ] Final PR + merge

---

## API Compatibility

The **public API** of `ChatManager` must remain stable. External callers should not need changes.

**Public methods to preserve:**

- `constructor(stateManager, api, eventManager)`
- `initialize(elements)`
- `handleSend(message)`
- `handleButtonClick(text)`
- `loadChatHistory(messages, options)`
- `loadCurrentScriptHistory()`
- `getCurrentScriptHistory()`
- `clearCurrentScriptHistory()`
- `clearChat()`
- `updateChat(chat)`
- `setRefreshManager(refreshManager)`
- `setScriptOrchestrator(orchestrator)`
- `setContentManager(contentManager)`
- `setPageManager(pageManager)`
- `setChapterManager(chapterManager)`
- `getScriptContext(options)`
- `getAIChatContext(options)`
- `destroy()`

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Regression in send/history flow | Incremental phases with tests after each; server-persisted-rows first |
| Server not returning history | Coordinate backend change; client fails loud (toast + retry) — no silent fallback |
| Circular dependencies | Keep MessageNormalizer, ResponseExtractor, ChatValidationService pure (no ChatManager import) |
| Deprecated helpers still used | Keep `extractLegacyDbContent` clearly separated; use only for legacy DB hydration |

---

## Success Criteria (MVP)

1. **Server returns persisted rows** — UI only renders what server saved; no speculative history
2. **Binary client behavior** — If history exists → use it; else → toast + retry (fail loud)
3. **Invariant** — ChatManager never constructs chat rows manually; all rows from server history or serializer
4. **Response parsing** — Single place (ResponseExtractor); `extractApiResponseContent` vs `extractLegacyDbContent` clearly separated
5. **Validation** — Single place (ChatValidationService); returns `{ ok, reason }` for better logging/UX/tests
6. **API + timeout** — Clear, testable (inline or minimal helper)
7. No change in observable behavior (tests pass, manual QA)
8. Public API of ChatManager unchanged

---

## Appendix: File Dependency Graph (Target)

```
ChatManager
  ├── ChatHistoryManager
  ├── ScriptContextManager
  ├── ScriptOperationsHandler
  ├── MessageNormalizer
  ├── ResponseExtractor
  └── ChatValidationService
```
