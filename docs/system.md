# System Overview

This file describes the UI loading flow and the basic API shape for the ScriptPal
script-writing AI assistant platform, based on the current code in `public/` and
`server/`.

## UI Loading Process

- `public/index.html` defines the base DOM containers:
  - `.user-scripts`, `.editor-container`, `.chatbot-container`, `.chat-messages`,
    and auth forms in the navbar.
- The page loads `public/js/init-clean.js` as the entry script.
- `init-clean.js` creates a global `window.scriptPalApp`, then calls `App.init()`.
- `public/js/app.js` initializes core systems, creates scenes, and starts the engine:
  - `EditorScene`, `ChatScene`, `ScriptsScene` are created and registered.
  - The engine switches to the editor scene by default.
  - The engine starts the update loop and dispatches updates to the active scene.
- Scene initialization is DOM-driven:
  - `EditorScene` attaches to `.editor-container` and creates page renderer/breaks.
  - `ChatScene` attaches to `.chatbot-container`/`.chat-messages` and sets up input.
  - `ScriptsScene` attaches to `.user-scripts` and renders a (currently mock) list.
- Loading indicators are basic DOM toggles:
  - `public/js/ui/LoadingManager.js` toggles button/input state and the
    `.loading-indicator` text when invoked by UI managers.

## Basic API Shape

### Base URL

- Front-end requests are built against `http://localhost:3001/api` in
  `public/js/classes/api.js`.
- Requests are JSON with `Content-Type: application/json`.
- Auth is cookie-based; `fetch` uses `credentials: 'include'`.
- Health endpoints are exposed without the `/api` prefix.

### Health/Status (no auth)

- `GET /health`, `GET /healthz`
- `GET /ready`, `GET /readyz`
- `GET /live`
- `GET /metrics`
- `GET /status`

### Auth & User

- `POST /api/login` (login with email)
- `POST /api/logout`
- `POST /api/user` (create user)
- `GET /api/user/current` (current session user)
- `GET /api/user/:id`, `PUT /api/user/:id`

### Chat

- `GET /api/welcome/buttons` (welcome button data)
- `POST /api/chat` (chat request)
- `GET /api/chat/history`
- `POST /api/chat/history`
- `GET /api/script/:scriptId/chat/history`
- `DELETE /api/script/:scriptId/chat/history`

### Scripts

- `GET /api/script` (all scripts for user)
- `POST /api/script` (create)
- `GET /api/script/:id`
- `PUT /api/script/:id`
- `GET /api/script/:id/profile`
- `GET /api/script/:id/stats`

### Conversations

- `GET /api/conversation/:id`
- `POST /api/conversation`

### Story Elements

- `GET /api/script/:scriptId/elements`
- `POST /api/script/:scriptId/elements`
- `GET /api/element/:id`
- `PUT /api/element/:id`
- `DELETE /api/element/:id`

### Personas

- `GET /api/script/:scriptId/personas`
- `POST /api/script/:scriptId/personas`
- `GET /api/persona/:id`
- `PUT /api/persona/:id`
- `DELETE /api/persona/:id`
