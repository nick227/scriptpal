# AI Script Content Generation Plan

## Current LangChain chat flow
- `POST /api/chat` validates the prompt and scriptId before instantiating `Chat` and calling `processMessage` (`server/controllers/chatController.js:175`).
- `Chat.processMessage` (`server/controllers/chat/Chat.js:63`) loads the most recent script via `ScriptManager`, runs the intent classifier, normalizes script content with `ChainHelper.extractTextFromStructuredContent`, builds the full context, and routes the request through `IntentRouter` (`server/controllers/langchain/router/index.js:60`).
- Only two intents live in the registry today (`INTENT_TYPES.SCRIPT_CONVERSATION` and `GENERAL_CONVERSATION`, `server/controllers/langchain/chains/registry.js:6`), so the classifier (`server/controllers/langchain/chains/system/IntentClassifier.js:17`) either lets App scripts rerun through `AppendScriptChain` (`server/controllers/langchain/chains/edit/AppendScriptChain.js:7`) or falls back to a general-purpose conversation chain.
- System-wide behavior is dictated by `COMMON_PROMPT_INSTRUCTIONS`, which enforces the screenplay markup tags and response structure that any chain is expected to respect (`server/controllers/langchain/constants.js:118`).
- Client scripts already stash rich context (metadata, version, timers) before the chat call, so duplicating that sanitized view on the API side is simply a matter of mirroring `Chat.buildContext`'s merge strategy (`server/controllers/chat/Chat.js:139`). The companion guide documents the client-side context pipeline and how it feeds `/api/chat` (`docs/script-data-to-prompt-analysis.md:5`).

## Feature goal
We need an AI routine that can take a prompt such as "write the next page for me," see the user's current screenplay, and return 20-22 properly formatted `<header>/<action>/<speaker>/<dialog>` lines. The UI will append that chunk to the editor for the writer to keep, tweak, or delete. This flow should be focused exclusively on **adding** new lines rather than editing or deleting existing ones.

## Proposed approach

### 1. Dedicated endpoint (API surface)
- Add a dedicated `POST /api/scripts/:scriptId/ai/continue` (or similar) endpoint that bypasses intent classification and only handles the "continue script" scenario. This keeps a tight contract and avoids the classifier dismissing well-formed prompts because they don't match the existing two intents.
- The handler should reuse `ScriptManager.getScript` (`server/controllers/script-services/ScriptManager.js:3`) to validate that the `scriptId` exists, fetch `content`/`title`, and return a 404 if it does not.
- Mirror `Chat.buildContext`'s normalization by running the script content through `ChainHelper.extractTextFromStructuredContent` before sending it to the chain (`server/controllers/langchain/chains/helpers/ChainHelper.js:4`). Include metadata (`status`, `versionNumber`, `updatedAt`) so the model understands what version of the story it is extending.
- The endpoint should accept a short user prompt and optional tuning hints (tone, pacing, scene notes) inside `context` so future client iterations can steer the output without touching the classifier.

### 2. Intent/chain-level work
- Introduce a new intent such as `INTENT_TYPES.SCREENPLAY_CONTINUATION` (extend `server/controllers/langchain/constants.js:17`) and register a `ScreenplayContinuationChain` in `chainRegistry` (`server/controllers/langchain/chains/registry.js:6`). This new chain can extend `BaseChain` but override `SYSTEM_INSTRUCTION` to explicitly ask for 20‑22 lines, scene continuity, and confirmation that formatting tags were used.
- The chain's `buildMessages` should always append the entire sanitized script content (similar to `AppendScriptChain.buildMessages` at `server/controllers/langchain/chains/edit/AppendScriptChain.js:19`), add the user's directive, and layer in `COMMON_PROMPT_INSTRUCTIONS` so the response stays aligned with existing markup rules (`server/controllers/langchain/constants.js:118`).
- Offer extra chain metadata such as `linesGenerated` and `tone` in the response to help the UI describe the chunk before appending. This can live alongside the existing `response` field that the UI already expects.
- If the model fails to respect the line count, the chain should detect that (e.g., count newline-delimited elements) and either retry with an adjusted system prompt or return a friendly error that the UI can surface.

### 3. Response contract & front-end integration
- Return a structured object from the endpoint:
  - `response`: string containing the 20‑22 screenplay lines (markup preserved).
  - `metadata`: includes `scriptId`, `scriptTitle`, `linesGenerated`, `modelInstructionVersion`, and `timestamp`.
  - `type`: reuse `INTENT_TYPES.SCREENPLAY_CONTINUATION` so the UI knows this payload should be appended (stacked with existing `type` handling from `Chat.formatResponse`).
- Document this endpoint for the frontend team so they can append the chunk via the same editor path that already accepts assistant responses. The frontend already manages context (`docs/script-data-to-prompt-analysis.md:5`), so no extra plumbing should be required beyond pointing the "write the next page" button at the new endpoint.

### 4. Measurement & safeguards
- Log prompts and responses just like the main chat call (`Chat.historyManager`), but tag them with the new intent so you can monitor how often the "next page" generator is used.
- To keep hallucinations in check, enforce a maximum script context length (use `VALIDATION_RULES` from `constants.js:81`) and return a user-friendly error if the script is too long-suggest trimming the scene or splitting the request.
- Keep the existing `chainConfig` pattern from `Chat.buildContext` so you can fine-tune temperature or token budgets per request without altering the router.

## Next steps
1. Sketch the endpoint payload and response contract with the frontend, then build the handler that wires `ScriptManager`, the new intent/chain, and the router.
2. Template the new system instruction so it includes the "20‑22 lines" requirement and the screenplay tags mandated in `COMMON_PROMPT_INSTRUCTIONS` (`server/controllers/langchain/constants.js:118`).
3. Add telemetry/backfill so the writer can review what the AI appended and either accept or discard it before it becomes part of the saved script.
