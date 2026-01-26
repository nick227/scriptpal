# Chat Flow Summary

## Core endpoints
- `POST /chat`: main conversational entry point, routes to append/full script or intent-based chat.
- `POST /system-prompts`: triggers curated system prompts from the prompt registry.
- `POST /script/:id/append-page`: append-page generation using the append chain.
- `POST /script/:scriptId/next-lines`: next five lines flow with contract validation.
- `GET/POST/DELETE /chat/messages`: chat history CRUD for a script.

## Prompt registry and contracts
- `shared/promptRegistry.js` is the source of truth for prompt metadata, routes, and output contracts.
- `next-lines` prompt uses JSON response validation (assistant response + `metadata.formattedScript`).
- `append-page` prompt provides system instructions for line-based tagged output.

## Server-side flow
- `chatController.startChat` handles input validation and special routing:
  - Detects full script requests and returns an append-style response payload.
  - Detects append-page requests and returns an append-style response payload.
  - Otherwise delegates to `Chat.processMessage` for intent routing.
- `Chat.processMessage`:
  - Loads script context and history.
  - Classifies intent via the intent classifier.
  - Builds context and routes through the langchain router.
  - Wraps responses in a consistent payload shape.
- `nextLinesController.trigger`:
  - Loads script context.
  - Routes to the next-five-lines chain with registry prompt instructions.
  - Validates the output contract and returns a standardized response.
- `appendPageController.appendPage`:
  - Validates access and prompt input.
  - Calls `AppendPageService` and returns a standardized response.

## Chain responsibilities
- `NextFiveLinesChain` enforces JSON format and normalizes formatted script.
- `AppendPageChain` enforces 12–16 tagged lines and sanitizes tags.

## Response shape (standardized)
- Top-level payload:
  - `success`, `intent`, `confidence`, `target`, `value`, `scriptId`, `scriptTitle`, `timestamp`, `response`.
- `response`:
  - `content`: main assistant text or tagged script lines.
  - `metadata`: optional details (generation mode, formatted script, validation info).

## Frontend flow
- `ScriptPalAPI.getChatResponse` posts to `/chat` with enhanced context.
- `ChatManager.handleSend`:
  - Sends user message, renders assistant response, and triggers script operations.
  - For append intent, delegates to `ScriptOperationsHandler`.
- `ScriptOperationsHandler`:
  - Appends tagged script lines to the editor, or routes line insertion when detected.
