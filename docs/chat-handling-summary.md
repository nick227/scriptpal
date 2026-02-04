## Current Chat Handling Summary

### 1. Request entry
- `POST /chat` still hits `chatController.startChat` (protected by `validateSession` and `requireScriptOwnership` in middleware).  
- `startChat` validates the prompt, sets `req.chatRequestId`, loads the editable script via `loadScriptOrThrow`, and builds the shared `baseContext` plus enriched `context` (now carrying `prompt` and the correlation id) exactly once.
- A single intent map (`SCRIPT_INTENT_HANDLERS`) now routes script mutation requests (full-script, append-page, next-five-lines) before falling back to `ConversationCoordinator`/`Chat.processMessage` for general chat.

### 2. Intent dispatch
- `resolveScriptHandler(context)` inspects `context.force*` flags plus the same heuristics (`isFullScriptRequest`, `isAppendPageRequest`, `isNextFiveLinesRequest`) and returns the handler directly, so there is no intermediate intent enum and script mutations short-circuit before general chat.
- Each handler logs the request id, calls `router.route(...)`, and returns the canonical `{ message, script, metadata }` payload that `buildValidatedChatResponse` validates; BaseChain now enforces that shape before any handler response leaves the router.
- All script mutations flow through `router.route`, keeping `generateFullScript`/`generateAppendPage` out of the `/chat` dispatch path and eliminating hidden alternate stacks.

### 3. Canonical chain contracts
- All script chains now return `{ message, script, metadata }` with `metadata.generationMode` plus any intent-specific tags (`appendPage`, `lineCount`, `fullScript`, etc.).  
- Metadata tagging is added via `buildContractMetadata` inside the chains, so downstream code never has to reconstruct `formattedScript` or `lines[]`.  
- Script services simply forward the chain output with a `scriptTitle`/`intent` wrapper before `startChat` validates it via `buildValidatedChatResponse`.
- `BaseChain.execute` now logs the chain name plus `chatRequestId` (the same `req.chatRequestId` every handler carries), so every AI call, prepared message set, and response output can be correlated back to the originating request.

### 4. Validation and fallback
- `buildValidatedChatResponse` (unchanged) ensures every script mutation payload contains the required metadata; handlers now throw when validation fails so `/chat` never drifts into general conversation once a script intent fires.  
- General chat still passes through `ConversationCoordinator` → `router.route`, with the shared context that includes sanitized history/disables extra history when needed.

### 5. Observability & next steps
- Logging now clearly states which handler fired (`conversation`, `append-page`, `next-five-lines`, `full-script`) and passes normalized responses to `buildAiResponse`.  
- Remaining roadmap work includes canonicalizing validators, consolidating history/log access, and creating a prompt/schema contract test (see `docs/chat-refactor-roadmap.md` for Phase 3+).

### 6. Request flow diagram
```
POST /chat
  └ validate + build context (attach prompt + chatRequestId)
      └ resolveScriptHandler(context)?
           ├ yes → handler → router.route(script intent) → canonical `{ message, script, metadata }` → buildAiResponse
           └ no  → ConversationCoordinator → router.route(general) → buildAiResponse
```
The correlation id travels with the context/chain logs, keeping every handler, BaseChain, and AIClient call tied to the same request.
