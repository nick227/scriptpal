# Chat AI & Script Change Flow

The chat API supports two intertwined experiences:

1. **AI-driven script changes** - a user tells the model to edit, expand, or rewrite sections of the current script.
2. **General assistant responses** - the model answers questions, gives feedback, or generates ideas without mutating the script.

This document walks through the full journey for the script-change intent and contrasts it with the conversational fallbacks.

## 1. From the chat UI to the API

- The browser `ChatManager` validates every message, shows it in the renderer, persists it locally, and triggers `getApiResponseWithTimeout` once the user prompt is ready (`public/js/widgets/chat/core/ChatManager.js:260`, `public/js/widgets/chat/core/ChatManager.js:282`, `public/js/widgets/chat/core/ChatManager.js:346`).
- That helper asks `ScriptContextManager#getAIChatContext` for the latest script metadata, content, and lightweight stats before the POST to `/api/chat` (`public/js/widgets/editor/context/ScriptContextManager.js:351`). The payload now carries `prompt`, `context`, and optional `scriptId`.
- Once the assistant returns a script-edit response, `ChatManager.handleScriptEdit` hands the returned content/commands to whatever `scriptOrchestrator` is hooked into the editor so the UI can reflect the new version (`public/js/widgets/chat/core/ChatManager.js:422`).

## 2. Backend entry and orchestration

- `/chat` is declared in `server/routes.js:34` and protected by `validateSession`, ensuring `req.userId` exists before the handler runs.
- `chatController.startChat` inspects the prompt, deduplicates `scriptId` between the body and enhanced context, constructs a `Chat` instance, and delegates to `Chat.processMessage`, wrapping everything with `handleChatError` so the response code matches the failure mode (`server/controllers/chatController.js:6`, `server/controllers/chatController.js:144`).
- `Chat.processMessage` loads the script via `ScriptManager.getScript`, decides whether to treat the request as `EDIT_SCRIPT` or general conversation, prepares the enriched context plus chat history, routes to the appropriate chain, and saves the assistant reply (`server/controllers/chat/Chat.js:14`, `server/controllers/script-services/ScriptManager.js:4`, `server/controllers/chat/ChatHistoryManager.js:9`).

## 3. Intent detection and routing

- `Chat.determineIntent` treats any verb-heavy request against a loaded script as `EDIT_SCRIPT`, otherwise it falls back to `EVERYTHING_ELSE`, which keeps intent routing deterministic without the classifier prompt (`server/controllers/chat/Chat.js:71`).
- `router.route` still maps the intent to the registered chain and guarantees a response, but because we only execute `DefaultChain` when edit heuristics fail, malicious or misclassified edit requests now surface errors instead of silently returning prose (`server/controllers/langchain/router/index.js:61`).
- The `router` looks up the intent in `chainRegistry`; if nothing matches it falls back to the `EVERYTHING_ELSE` chain, guaranteeing every request returns a response (`server/controllers/langchain/router/index.js:61`). `ChainFactory` ensures `EDIT_SCRIPT` is registered along with the default and auxiliary chains (`server/controllers/langchain/chains/ChainFactory.js:4`).

## 4. Script-change execution path

- `EditScriptChain` is the registered handler for `EDIT_SCRIPT`. Its `buildMessages` fetches the script via `EditScriptLoader.loadScriptContent` and feeds `EditScriptMessages.buildMessages` a template that enforces structured edit commands and documents the allowable tags (`server/controllers/langchain/chains/edit/EditScript.js:14`, `server/controllers/langchain/chains/edit/EditScriptLoader.js:13`, `server/controllers/langchain/chains/edit/EditScriptMessages.js:56`, `server/controllers/langchain/chains/edit/EditScriptMessages.js:103`).
- `execute` invokes `this.llm` with the `edit_script` function schema, validates the returned commands against the current script, and hands them to `ScriptVersionService.applyEdits`. That service loads the script via `scriptModel`, runs `ScriptEditHelper.editScript`, and, if changes occurred, calls `scriptModel.updateScript` to write the new version plus the command log in one transaction (`server/controllers/langchain/chains/edit/EditScript.js:19`, `server/controllers/script-services/ScriptVersionService.js:13`, `server/controllers/langchain/chains/helpers/ScriptEditHelper.js:33`, `server/models/script.js:62`).
- The response includes the edit commands, whether they succeeded, the updated content, and the new `versionNumber`. Errors bubble back through `handleChatError`, so the frontend receives meaningful status codes when, for example, the script is missing or the intent is invalid.

## 5. Conversational fallback

- If the intent is anything other than `EDIT_SCRIPT` (or the classifier returns `EVERYTHING_ELSE`), the router runs `DefaultChain`, which keeps a short system prompt, disables question generation, and formats a conversational reply (`server/controllers/langchain/chains/base/DefaultChain.js:1`).
- `BaseChain` is responsible for adding the common instructions, merging chat history, invoking `ai.generateCompletion`, and optionally generating follow-up questions via `QuestionGenerator` (`server/controllers/langchain/chains/base/BaseChain.js:186`, `server/controllers/langchain/chains/base/BaseChain.js:213`).
- The underlying `AIClient` handles retries, metrics, and cost tracking whenever LangChain needs a completion (`server/services/AIClient.js:55`, `server/lib/ai.js:4`).

## 6. Notes on observability

- Every successful cycle stores the assistant response plus the user prompt metadata, making it easy to surface history and debug low-confidence cases (`server/controllers/chat/ChatHistoryManager.js:9`, `server/controllers/chat/ChatHistoryManager.js:33`).
- `handleChatError` centralizes the mapping between LangChain/OpenAI failures and client-friendly status codes (invalid format → 400, missing script → 404, etc.) so the front end can surface the right UI state (`server/controllers/chatController.js:6`).

## Next steps

- If you need to extend the script-change experience, consider tightening `EditScriptMessages` so it covers additional tags and line-number conventions, or enhance `ScriptVersionService` to annotate why certain commands failed.
