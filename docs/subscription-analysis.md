# Front-End Subscription Analysis

This document summarizes the front-end subscription model: EventManager pub/sub, StateManager state subscriptions, and DOM/component event listeners. It focuses on where subscriptions are created and which handlers respond.

## Subscription Layers

1. EventManager (app-level events)
   - Central pub/sub hub used by controllers, widgets, and managers.
   - Supports contextual unsubscribe in `BaseWidget`.

2. StateManager (reactive state)
   - Key-based subscriptions (e.g., `CURRENT_SCRIPT`, `SCRIPTS`, `USER`).
   - Subscribers are invoked immediately with current value.

3. UI / component listeners
   - DOM listeners attached in widgets (click/input/keydown).
   - Component event emitters (e.g., editor content emits change events).

## Core Infrastructure

- `public/js/core/EventManager.js`
  - `subscribe`, `publish`, `unsubscribe`, `unsubscribeAll`, `once`
  - Event namespaces: AUTH, CHAT, AI, SYSTEM_PROMPT, SCRIPT, EDITOR, UI, TITLE_PAGE, ERROR

- `public/js/core/StateManager.js`
  - `subscribe`, `setState`, `getState`
  - Typed schemas for keys

- `public/js/widgets/BaseWidget.js`
  - Convenience `subscribeToState` and context-based `unsubscribeAll`

## EventManager Subscriptions

### Scripts
- `public/js/controllers/ScriptsController.js`
  - `SCRIPT:SELECT_REQUESTED` -> handleSelectRequested
  - `SCRIPT:CREATE_REQUESTED` -> handleCreateRequested
  - `SCRIPT:DELETE_REQUESTED` -> handleDeleteRequested
  - `SCRIPT:LIST_REQUESTED` -> handleListRequested
  - `SCRIPT:SELECTED` -> handleScriptSelected

- `public/js/widgets/script/ScriptListWidget.js`
  - `SCRIPT:LIST_UPDATED` -> handleScriptListUpdate
  - Publishes create/select/delete/list requests

- `public/js/widgets/script/ScriptWidget.js`
  - Publishes `SCRIPT:CREATE_REQUESTED` and `SCRIPT:SELECT_REQUESTED`

### Chat
- `public/js/widgets/chat/ChatEventBridge.js`
  - `CHAT:REQUEST_SEND` -> handleRequestSend
  - `CHAT:REQUEST_CLEAR` -> handleRequestClear
  - `CHAT:REQUEST_HISTORY` -> handleRequestHistory
  - `CHAT:REQUEST_EXPORT` -> handleRequestExport
  - `SCRIPT:SELECTED` -> handleScriptSelected
  - `AI:RESPONSE_RECEIVED` -> handleAIResponse

- `public/js/widgets/chat/PromptHelperBridge.js`
  - `SYSTEM_PROMPT:READY` -> handlePromptReady
  - `SYSTEM_PROMPT:FIRED` -> handlePromptFired
  - `SYSTEM_PROMPT:FAILED` -> handlePromptFailed

### Editor and AI
- `public/js/widgets/editor/EditorWidget.js`
  - Subscribes to editor save state events (save dirty/saving/saved/error)

- `public/js/widgets/editor/ai/AILineInsertionManager.js`
  - `AI:RESPONSE_RECEIVED` -> handleAIResponse

- `public/js/widgets/editor/context/ScriptContextManager.js`
  - `EDITOR:CONTENT_CHANGE` -> handleContentChange
  - `EDITOR:PAGE_CHANGE` -> handlePageChange

### Persistence and UI
- `public/js/managers/PersistenceManager.js`
  - `SCRIPT:DELETED`, `CHAT:MESSAGE_ADDED`, `UI:FULLSCREEN_CHANGED`,
    `CHAT:CONTAINER_MINIMIZED`

- `public/js/widgets/ui/FullscreenManager.js`
  - `UI:FULLSCREEN_TOGGLE` -> handleToggle

- `public/js/widgets/auth/AuthenticationManager.js`
  - `AUTH:LOGIN`, `AUTH:LOGOUT`, `AUTH:REGISTER`

## StateManager Subscriptions

Most frequent keys and consumers:

- `CURRENT_SCRIPT`
  - `ChatManager`, `ChatHistoryManager`, `TitlePageManager`,
    `ScriptContextManager`, `AILineInsertionManager`, `PersistenceManager`,
    `ScriptListWidget`

- `SCRIPTS`
  - `ScriptListWidget`, `ScriptWidget`

- `USER`
  - `ScriptsController`, `ChatHistoryManager`, `AuthenticationManager`

- `AUTHENTICATED`
  - `AuthenticationManager`

## DOM / Component Event Listeners

### Editor
- `EditorContent`, `EditorToolbar`, `KeyboardManager`, `LineFormatter`
  - Keyboard, input, click, mouse events tied to editor behaviors

### Chat
- `ModernChatWidget`
  - Input, keydown, paste, click (send, resize, focus)
- `PromptHelperWidget`
  - Prompt helper button handlers

### Scripts
- `ScriptListWidget` and `ScriptWidget`
  - Click listeners for select/create/delete actions

### Global
- `PersistenceManager`: `beforeunload`, `visibilitychange`
- `FullscreenManager`: `fullscreenchange` variants, `resize`, `keydown`

## Listener Architecture Summary

- EventManager coordinates cross-feature intent (controller-driven).
- StateManager pushes reactive updates into UI and service layers.
- Widgets own DOM listeners; controllers/managers own app-level subscriptions.
- `BaseWidget` provides consistent lifecycle cleanup for widgets.
