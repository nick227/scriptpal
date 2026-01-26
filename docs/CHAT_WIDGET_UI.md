# Chat Widget UI State

## Snapshot
- The chat UI uses one shared brain: `ChatManager` owns API calls, history, and script intent logic.
- The modern widget builds its DOM inside `.chatbot-container`, renders through a modern message renderer, and emits semantic events for user intent.
- Classic widget usage has been retired in favor of `ChatIntegration`.

## Primary UI Modules (Code Signature)

### `public/js/widgets/chat/core/ChatManager.js`
- Export: `ChatManager extends BaseManager`
- Constructor: `new ChatManager(stateManager, api, eventManager)`
- Init: `initialize(elements)`
  - Renderer via `RendererFactory.createMessageRenderer(elements.messagesContainer, this)`
  - Subscribes to `StateManager.KEYS.CURRENT_SCRIPT`
- Core send path: `handleSend(message)`
  - Renders user message, calls `api.getChatResponse(message, scriptContext)`
  - Renders assistant response and persists to `ChatHistoryManager`
  - Handles intent-driven script operations (EDIT/WRITE/ANALYZE/APPEND)
- History: `loadChatHistory(messages)`, `loadCurrentScriptHistory()`, `clearCurrentScriptHistory()`
- Utilities: `processAndRenderMessage()`, `extractResponseContent()`, `processQuestionButtons()`
- Message model (normalized): `{ id, role, type, content, timestamp, status, metadata, intent }`

### `public/js/widgets/chat/ui/ModernChatWidget.js`
- Export: `ModernChatWidget extends BaseWidget`
- Constructor: `new ModernChatWidget({ container }, stateManager, eventManager)`
- Init: `initialize()`
  - Calls `createModernUI()` and binds events
- DOM signature (built at runtime):
  - `.chat-header` with actions: `[data-action="settings|minimize|close"]`
  - `.chat-messages` with `.message` blocks
  - `.typing-indicator`
  - `.chat-input-area` with `#user-input` and buttons `[data-action="emoji|attach|voice|send"]`
  - `.chat-controls` with `[data-action="clear|export|history"]`
- Events: on send publishes `EventManager.EVENTS.CHAT.REQUEST_SEND`
- Feature hooks publish intent events (emoji/file/voice, export/history/settings/minimize/close)

### `public/js/widgets/chat/integration/ChatIntegration.js`
- Export: `ChatIntegration`
- Constructor: `new ChatIntegration(api, stateManager, eventManager)`
- Init: `initialize()`
  - Instantiates `ModernChatWidget` and `ChatManager`
  - Subscribes to script events for context (`SCRIPT.SELECTED`, `SCRIPT.UPDATED`)
  - Bridges UI intent events (`CHAT.REQUEST_SEND`, `CHAT.REQUEST_CLEAR`, `CHAT.REQUEST_HISTORY`)

### Legacy cleanup
- Classic chat widget and `ScriptPalChat` glue were removed in favor of `ChatIntegration` + `ChatManager`.

## CSS Surface Area

### Modern styles
- `public/css/components/chat-modern.css`
  - Full gradient UI with `.chat-header`, `.chat-input-area`, `.typing-indicator`, `.chat-controls`, animations
  - `data-renderer="modern"` on `.chat-messages` enables the modern message renderer
  - Quick reply buttons render as `.quick-replies` with `.quick-reply` chips

## UI Entry Points
- Demo: `public/chat-demo.html`
  - Instantiates `ModernChatWidget` + `ChatManager` with a mock API
- App wiring: `public/js/classes/WidgetLifecycleManager.js` + `public/js/classes/ui.js` (modern chat integration)

## API Connections

### Client-side API calls
- `ScriptPalAPI.getChatResponse(content, context)`
  - Endpoint: `POST /api/chat`
  - Payload: `{ prompt, context }`
  - Context includes localStorage keys: `currentScriptId`, `currentScriptTitle`, `currentScriptVersion`
- `ScriptPalAPI.getChatMessages(scriptId, limit, offset)`
  - Endpoint: `GET /api/chat/messages?scriptId=&limit=&offset=`
- `ScriptPalAPI.addChatMessage(scriptId, message)`
  - Endpoint: `POST /api/chat/messages`
- `ScriptPalAPI.clearChatMessages(scriptId)`
  - Endpoint: `DELETE /api/chat/messages/:scriptId`

### Server-side routes
- `server/controllers/chatController.js`
  - `startChat` handles `/api/chat` and calls `Chat.processMessage(prompt, context)`
  - `getChatMessages`, `addChatMessage`, `clearChatMessages` handle chat history persistence

## Current State Notes
- Modern UI is visually complete, mobile-first, and event-driven; feature hooks publish intent events for future wiring (emoji, files, voice, export/history, settings, minimize/close).
- One shared `ChatManager` drives chat behavior to keep logic consistent.
