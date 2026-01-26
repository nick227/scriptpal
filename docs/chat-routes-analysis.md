# Chat Routes Analysis

## Scope
This document covers the server chat-related routes, how each route builds AI context, whether script content is appended to prompts, which routes expect script content in the response, and where flows diverge. It also calls out obvious improvements based on current behavior.

## Chat Routes (Server)

### Primary Chat
- `POST /chat` → `chatController.startChat`
  - Auth: `validateSession`
  - Routes to full-script generation, append-page generation, or standard intent routing based on prompt patterns and context flags.
  - Source: `server/routes.js`

### Chat History
- `GET /chat/messages` → `chatController.getChatMessages`
- `POST /chat/messages` → `chatController.addChatMessage`
- `DELETE /chat/messages/:scriptId` → `chatController.clearChatMessages`
  - Auth: `validateSession`
  - Source: `server/routes.js`

### Script-Adjacent Generation
- `POST /script/:id/append-page` → `appendPageController.appendPage`
  - Auth: `validateSession`
  - Direct append-page flow (bypasses chat routing).
  - Source: `server/routes.js`
- `POST /script/:scriptId/next-lines` → `nextLinesController.trigger`
  - Auth: `validateSession`
  - Uses `NEXT_FIVE_LINES` contract and validates a formatted script payload.
  - Source: `server/routes.js`

### System Prompts
- `POST /system-prompts` → `systemPromptController.trigger`
  - Auth: `validateSession`
  - Uses pre-defined prompt definitions to route into script conversation chains.
  - Source: `server/routes.js`

## Script Context Handling (Prompt Input)

### Appends Script Content to Prompt
These flows include the current script inside the user prompt.
- `AppendPageChain.buildMessages` uses:
  - `Current script:\n${context.scriptContent}`
  - Source: `server/controllers/langchain/chains/edit/AppendPageChain.js`
- `AppendScriptChain.buildMessages` uses:
  - `Current script:\n${scriptContent}`
  - Source: `server/controllers/langchain/chains/edit/AppendScriptChain.js`
- `NextFiveLinesChain.buildMessages` uses:
  - `Script context to maintain continuity:\n${context.scriptContent}`
  - Source: `server/controllers/langchain/chains/edit/NextFiveLinesChain.js`
- `FullScriptChain.buildMessages` uses:
  - `Current script:\n${scriptContent}`
  - Source: `server/controllers/langchain/chains/edit/FullScriptChain.js`
- `DefaultChain.buildMessages` uses:
  - `Script content:\n${scriptContent}` when `includeScriptContext` is true
  - Source: `server/controllers/langchain/chains/base/DefaultChain.js`

### Does Not Append Script Content
- General chat without script context (`INTENT_TYPES.GENERAL_CONVERSATION`)
  - `Chat.buildContext` sets `includeScriptContext: false`
  - Source: `server/controllers/chat/Chat.js`

## Script Content in Response

### Response Includes Script Content (Separate Field)
- `NextFiveLinesChain.formatResponse` returns:
  - `response`: assistant explanation
  - `metadata.formattedScript`: five new formatted lines
  - Source: `server/controllers/langchain/chains/edit/NextFiveLinesChain.js`
- `NextLinesController.trigger` validates `metadata.formattedScript`
  - Source: `server/controllers/nextLinesController.js`

### Response Includes Script Content as Main Text
- `AppendPageChain.formatResponse` and `FullScriptChain.formatResponse` return:
  - `response`: the formatted script content
  - Source: `server/controllers/langchain/chains/edit/AppendPageChain.js`
  - Source: `server/controllers/langchain/chains/edit/FullScriptChain.js`
- `appendPageController.appendPage` and `chatController.startChat` wrap that response as `response.content`
  - Source: `server/controllers/appendPageController.js`
  - Source: `server/controllers/chatController.js`

## Divergent Flows

### 1) Pattern Short-Circuiting (Bypasses Intent Router)
`POST /chat` first checks for full-script and append-page patterns and can bypass the chat router.
```257:322:server/controllers/chatController.js
const forceFullScript = Boolean(context.forceFullScript);
const shouldGenerateFullScript = scriptId && (forceFullScript || isFullScriptRequest(req.body.prompt));
if (shouldGenerateFullScript) {
  // ...
}

const forceAppend = Boolean(context.forceAppend);
if (scriptId && (forceAppend || isAppendPageRequest(req.body.prompt))) {
  // ...
}
```
Outcome: these calls skip `Chat.processMessage`, bypass intent classification, and do not use chat history.

### 2) Intent-Based Chat Routing
`POST /chat` falls back to `Chat.processMessage()` when patterns do not match.
```37:82:server/controllers/chat/Chat.js
const classification = await this.intentClassifier.classify(classifierContext, prompt);
let intent = this.resolveIntent(classification?.intent);
if (!intent) {
  intent = this.determineIntent(prompt, script);
}
const preparedContext = await this.buildContext(script, context, prompt, intent);
const response = await router.route(intentResult, preparedContext, prompt);
```
Outcome: script context is conditionally included based on intent; chat history is enabled for script intents.

### 3) Dedicated Append-Page Endpoint
`POST /script/:id/append-page` routes directly into `generateAppendPage()` and returns script output.
```26:44:server/controllers/appendPageController.js
const result = await generateAppendPage({ scriptId, userId: req.userId, prompt });
const responsePayload = buildAiResponse({ /* ... */ response: { content: result.responseText } });
```
Outcome: no intent classification or chat history.

### 4) Next-Five-Lines Contract Flow
`POST /script/:scriptId/next-lines` routes to `NEXT_FIVE_LINES` intent and requires `formattedScript`.
```53:79:server/controllers/nextLinesController.js
const response = await router.route(intentResult, context, NEXT_FIVE_LINES_PROMPT.userPrompt);
const formattedScript = response?.metadata?.formattedScript || response?.formattedScript;
// validate formattedScript and return buildAiResponse(...)
```
Outcome: response must include a separate formatted script payload (contracted).

### 5) System Prompt Routing
`POST /system-prompts` uses predefined prompts and routes through the intent router.
```33:44:server/controllers/systemPromptController.js
const enrichedContext = { /* ... */ systemInstruction: definition.systemInstruction, ...context };
const response = await router.route(intentResult, enrichedContext, definition.userPrompt);
```
Outcome: user prompt is the system prompt definition, not end-user text.

## Response Shape Variations

- `POST /chat` (pattern short-circuit) returns `buildAiResponse` with `response.content`.
- `POST /chat` (router path) returns `buildAiResponse` with `response.response` (chain format).
- `POST /script/:id/append-page` returns `buildAiResponse` with `response.content`.
- `POST /script/:scriptId/next-lines` returns `buildAiResponse` with `response.metadata.formattedScript` and `response.response`.
- `POST /system-prompts` returns raw chain response (not wrapped with `buildAiResponse`).

## Core Problems

1) Script content appears in multiple shapes (main text vs metadata).

2) Script context is labeled inconsistently, hurting determinism.

3) Empty / invalid script can still flow into append logic.

4) `/chat` may retry semantic failures, causing zero-line appends.

5) Script normalization is scattered, making behavior drift over time.

## High-Impact Fixes (In Order)

### 1) Standardize script context prefix
Use one string everywhere:
`SCRIPT CONTEXT (do not repeat or rewrite existing lines):`

Apply to all script-aware chains.
Immediate quality improvement, zero risk.

### 2) Add a hard “non-empty script” gate
If script output is missing / empty / whitespace → do not append.

Add this check in:
- `NextFiveLinesChain` (fail closed)
- `ChatManager` before intent swap
- `ScriptOperationsHandler` (last defense)

Fixes the zero-lines bug.

### 3) Stop semantic retries in `/chat`
If append/full validation fails:
- Return chat-only response.
- Do not retry append chains.

Retries are only for transport errors.

### 4) Normalize where script output lives
Rule going forward:
- Script → `response.metadata.formattedScript`
- Chat text → `response.content` / `response.response`

Wrap append/full responses to include metadata (keep backward compatibility).

### 5) Centralize script normalization
Create one helper:
- `normalizeScriptForPrompt`
- `normalizeScriptForAppend`

Use it everywhere instead of duplicating logic.
Reduces drift and simplifies future changes.

### 6) Make chat history usage explicit
Either document per route or add a `useChatHistory` flag.
Prevents future confusion.

## Roadmap for Standardizing Chat Flows

### Phase 0 — Align on contracts (same-day)
- Define the canonical script context prefix and store it in one shared constant.
- Document the standard response envelope rules:
  - Script → `response.metadata.formattedScript`
  - Chat text → `response.content` / `response.response`
- Add one invariant explicitly: Editor must never receive empty or unvalidated script lines.
- Decide where the non-empty script gate is enforced (chain, chat manager, and UI).

### Phase 1 — Low-risk consistency fixes (1–2 days)
- Update all script-aware chains to use the same script context prefix.
- Add the hard non-empty script gate in `NextFiveLinesChain`, `ChatManager`, and `ScriptOperationsHandler`.
- Log once when the non-empty gate blocks output (single telemetry event, e.g. `AI_SCRIPT_BLOCKED_EMPTY`).
- Stop semantic retries in `/chat` (fall back to chat-only when validation fails).

### Phase 2 — Normalize responses (2–4 days)
- Wrap append/full-script responses so `metadata.formattedScript` is always present.
- Keep backward compatibility by still returning `response.content` where needed.
- Update frontend parsing to prefer `metadata.formattedScript` and fall back only if missing.
- Define precedence explicitly: frontend always prefers `metadata.formattedScript`, `response.content` is legacy only.

### Phase 3 — Centralize normalization (3–5 days)
- Create `normalizeScriptForPrompt` and `normalizeScriptForAppend` helper(s).
- Replace scattered normalization calls with the helper(s).
- Verify no regressions in prompt content and append formatting.
- Keep helpers pure (no side effects, no editor access).

### Phase 4 — Make history usage explicit (1–2 days)
- Document per-route behavior first; add `useChatHistory` later if needed.
- Align any UI assumptions around history display and retention.

### Phase 5 — Cleanup and guardrails (ongoing)
- Remove deprecated response shapes once clients no longer rely on them.
- Add lightweight contract tests for script-output routes.
- Track a single source of truth for intent short-circuit patterns.

## Obvious Improvements (Recommended)

1) **Unify script-context prompt prefixes**
   - Today, script context uses different labels (`Current script`, `Script content`, etc.).
   - Standardize to one label and reuse in `AppendPageChain`, `AppendScriptChain`, `NextFiveLinesChain`, `FullScriptChain`, `DefaultChain`.

2) **Normalize response shape**
   - `systemPromptController` returns raw chain output while other routes wrap with `buildAiResponse`.
   - Unify response envelopes or document the divergence explicitly so clients do not need special-casing.

3) **Centralize pattern matching for `/chat` short-circuits**
   - Full-script and append-page detection lives only in `chatController`.
   - If the frontend also detects these patterns, consider a shared utility or single source of truth.

4) **Consolidate script content normalization**
   - `Chat.buildContext`, `AppendPageService`, `FullScriptService`, and `NextLinesController` all normalize script content.
   - Centralize normalization to reduce divergence and easier to evolve formatting behavior.

5) **Make chat history usage explicit**
   - Chat history is disabled for general conversation and append/full-script services.
   - Document why history is disabled or provide an explicit flag to callers for consistent expectations.

## One-Paragraph Takeaway
Your system’s core design is sound. The biggest wins now come from standardizing script context labels, normalizing where script output lives, and adding one hard non-empty validation gate before append. These changes improve script formatting reliability, eliminate zero-line failures, and make future routes predictable without changing APIs or flow structure.
