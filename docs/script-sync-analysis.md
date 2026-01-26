# Script Sync Analysis: AI Requests

This document summarizes how script content stays in sync when AI requests append or edit the script.

## High-Level Flow

1. The AI response is validated and routed as an append or edit intent.
2. The client appends content into the editor document.
3. The editor emits content change events.
4. Autosave queues a patch and persists the updated script to the server.
5. The server updates the stored script content.

## AI Append Flow (Client)

1. `ScriptOperationsHandler` receives the AI response and validates it.
2. It extracts `formattedScript` (or response content) and calls the script orchestrator.
3. `ScriptOrchestrator.handleScriptAppend` converts the appended lines into editor line items.
4. The editor renders the new lines into the current script document.
5. The editor emits content change events after the render.

Key entry points:
- `public/js/widgets/chat/core/ScriptOperationsHandler.js`
- `public/js/services/script/ScriptOrchestrator.js`
- `public/js/widgets/editor/EditorContent.js`

## Autosave and Persistence

1. `EditorSaveService` listens for editor content changes.
2. It compares the latest content to the last saved version.
3. If changed, it queues a patch using `ScriptStore.queuePatch`.
4. `ScriptStore.flushPatch` persists the patch to the API via `updateScript`.
5. The server updates the database record in `scriptController.updateScript`.

Key entry points:
- `public/js/widgets/editor/save/EditorSaveService.js`
- `public/js/stores/ScriptStore.js`
- `server/controllers/scriptController.js`

## Server-Side Context for AI Requests

1. The server loads the current script content from the database.
2. The content is normalized before being injected into AI prompts.
3. The `ScriptNextLinesChain` builds messages for the AI call using the normalized script context.

Key entry points:
- `server/controllers/chatController.js`
- `server/controllers/chat/Chat.js`
- `server/controllers/langchain/chains/script/ScriptNextLinesChain.js`
- `server/controllers/langchain/chains/helpers/ChainInputUtils.js`

## Notes on Sync Risks

- If an AI response is malformed but still passes validation, it can be appended and saved.
- Autosave persists whatever is currently in the editor, so incorrect appended lines become the new script state.
- Script context for AI requests comes from the saved script content, so any bad append affects future prompts.

