# Chat Consolidation Summary

This document lists the chat-flow consolidations completed so far and the next recommended steps.

## New developer intro

The chat system has four main layers. Keep changes scoped to the correct layer to avoid regressions:

- Controllers: authenticate, authorize, select intent, and coordinate the flow. Avoid adding business logic here.
- Context builders: deterministic assembly of script metadata and prompt context. If you need a new field, add it here once.
- Chains: pure execution of AI calls with formatting and validation. Do not reach back into controllers.
- Response builders: shape, validation, and safety of responses before they reach the client.

When adding new chat features:

- Start with intent detection in `intentUtils` and keep patterns centralized.
- Add context fields through `scriptContextUtils` (or a dedicated context helper).
- Keep validation outcomes explicit (`valid`, `recoverable_invalid`, `fatal_invalid`).
- Prefer small, composable helpers over large generic builders.

## Completed consolidations

- Shared script header formatting for append-style prompts.
  - Added `buildScriptHeader()` and reused it across append/full/next-lines chains.
- Shared script line sanitization.
  - Added `sanitizeScriptLines()` and reused it in `ScriptPageAppendChain` and `ScriptFullChain`.
- Shared context override filtering.
  - Added `filterContextOverrides()` and used it in `chatController` and `Chat`.
- Shared chain response extraction for append/full services.
  - Added `extractChainResponse()` and used it in `AppendPageService` and `FullScriptService`.
- Centralized intent pattern detection.
  - Added `intentUtils` and routed both `chatController` and `Chat` through it.
- Centralized script context assembly.
  - Added `buildScriptInfo()` and `buildScriptContextPayload()` for title/description/content/metadata.
- Centralized chain config defaults.
  - Added `chainConfigUtils` for chat and next-five-lines configs.
- Extracted next-five-lines context assembly.
  - Added `nextFiveLinesContext` to keep `chatController` lean.
- Standardized intent result creation.
  - `Chat` now uses `createIntentResult()` from `aiResponse.js`.
- Consistent system instruction usage in append/full chains.
  - Chains now honor `context.systemInstruction` when provided.
- Centralized script access + ownership enforcement.
  - Added `loadOwnedScript()` for a single ownership gate.
- Consolidated response wrapping and validation.
  - `buildValidatedChatResponse()` is the single validation/response gateway.

## Recommended next consolidations

1. Unify remaining context builders.
  - Only do this if more than two call sites remain.
2. Consider moving prompt-resolution into a shared helper.
  - Standardize prompt lookup and instruction sourcing when new prompt types are added.
3. Consolidate response wrapping for any new intent types.
  - Keep `buildValidatedChatResponse` as the single validation/response gateway.

