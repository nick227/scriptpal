# Front-End API Analysis (index.html – Editor, Chat, Auth)

Analysis of server requests for the main app entry: `index.html` → `appBootstrap.js` → `initScriptPal.js`, covering load order, loops, and redundant or wasteful calls.

---

## 1. Entry and Load Order

### 1.1 Bootstrap chain

| Step | File | What runs |
|------|------|------------|
| 1 | `index.html` | Loads `appBootstrap.js` (module) |
| 2 | `appBootstrap.js` | `requireAuth()` → then `import('../initScriptPal.js')` if authenticated |
| 3 | `initScriptPal.js` | Renders topbar, creates App, API, User, PersistenceManager, shared widgets, then `AuthenticatedAppBootstrap.init()` |

### 1.2 API request order (authenticated user, first load)

| # | When | Caller | Endpoint | Purpose |
|---|------|--------|----------|---------|
| 1 | Before initScriptPal | `authGate.requireAuth` → `user.checkSession()` | `GET /user/current` | Session check (gate) |
| 2 | After persistenceManager.ready | `initScriptPal` → `user.checkSession()` | `GET /user/current` | Session check again (redundant) |
| 3 | After handleAuthChange(true) | `ScriptsController.handleUserChange` → `scriptStore.ensureUserHasScripts(user.id)` | `GET /script?userId={id}` | Load user’s script list |
| 4a | If URL has slug | `ScriptsController` → `scriptStore.loadScriptBySlug(slug)` | `GET /script/slug/{slug}` | Load script by slug |
| 4b | If no slug | `ScriptsController` → `scriptStore.selectInitialScript()` → `loadScript(id)` | `GET /script/{id}` | Load script by id (from stored id or first in list) |
| 5 | If user has no scripts | `scriptStore.ensureUserHasScripts` → `createScript()` | `POST /script` | Create “Untitled Script” |
| 6 | After current script is set | `ChatHistoryManager.initialize` / `handleScriptChange` | `GET /chat/messages?scriptId={id}` (or messages by script) | Load chat history for current script |
| 7 | When auth state is set | `TokenWatchWidget.handleAuthState` → `fetchAndRender()` | `GET /user/token-watch` | Token usage display |

So on a normal load you get: **2× session checks**, **1× script list**, **1× script body** (by slug or id), optionally **1× create script**, **1× chat messages**, **1× token-watch**.

---

## 2. Redundant or Wasteful Requests

### 2.1 Double session check

- **Where:** `appBootstrap.js` calls `requireAuth()` which uses a new `ScriptPalAPI` + `ScriptPalUser` and calls `user.checkSession()` → `GET /user/current`. Then `initScriptPal.js` creates a **new** `ScriptPalAPI` and `ScriptPalUser` and calls `user.checkSession()` again after `persistenceManager.ready`.
- **Effect:** Two `GET /user/current` in quick succession. The first instance is only used for the gate and is then dropped.
- **Recommendation:** Either pass the result of `requireAuth()` (e.g. `user` / `authenticated`) into initScriptPal and skip the second session check, or gate without creating a second API/user in initScriptPal and have a single session check after persistence is ready.

### 2.2 Two API instances on load

- **Where:** `authGate.js` does `new ScriptPalAPI(); new ScriptPalUser(api);` and `initScriptPal.js` does the same again. No shared instance between gate and app.
- **Effect:** Redundant object creation and two session checks as above.
- **Recommendation:** Single API (and optionally User) instance for the app lifecycle, created once after auth is confirmed (e.g. in initScriptPal or a small bootstrap that both gate and init use).

### 2.3 Editor content save – no debounce (loop-like behavior)

- **Where:** `EditorSaveService` subscribes to `EDITOR_EVENTS.CONTENT_PERSIST`. Every content change (e.g. DOM sync, batch edits, typing) triggers `_emitContentChange` in `EditorCoordinator`, which emits `CONTENT_PERSIST` immediately. `EditorSaveService.handleContentChange()` calls `flushSave('auto')` → `scriptStore.queuePatch()` + `scriptStore.flushPatch()` → **PUT /script/:id**.
- **Effect:** Every content change that passes the “normalized content changed” check can cause a PUT. Rapid typing or many small edits = many PUTs. This is intentional (no timer) but is the main “on a loop” server traffic from the editor.
- **Reference:** See `docs/auto-save-analysis.md` for full pipeline.
- **Recommendation:** If reducing server load is a goal, consider debouncing or throttling auto-save (e.g. 500–1000 ms) while keeping immediate save on focus-out, manual save, and page exit.

### 2.4 Token watch polling

- **Where:** `TokenWatchWidget.schedulePoll()` uses `setTimeout(..., POLL_INTERVAL)` with `POLL_INTERVAL = 30000` (30 s). Each tick calls `fetchAndRender()` → `api.getTokenWatch()` → **GET /user/token-watch**, then reschedules.
- **Effect:** One request every 30 s while the app is open and user is authenticated. Not redundant per se, but a fixed recurring request.
- **Recommendation:** Keep as-is or increase interval if token usage updates do not need to be real-time.

---

## 3. Recurring / Loop-Like Behavior Summary

| Source | Interval / Trigger | Request | Notes |
|--------|--------------------|---------|--------|
| **PersistenceManager** | `setInterval(..., 30000)` | None (localStorage only) | `saveCurrentState()` → localStorage only; no server call. |
| **TokenWatchWidget** | Every 30 s | `GET /user/token-watch` | Polling for token usage. |
| **Editor content** | Every content change | `PUT /script/:id` | No debounce; each change can trigger one PUT if content actually changed. |
| **Title page** | Debounced (e.g. 400 ms) | `PUT /script/:id` | TitlePageManager uses a short persist delay then `queuePatch` + `flushPatch`. |

There is no other timer-based or event-loop that repeatedly hits the server from the index/editor/chat/auth flow; chat history is loaded on script switch, not on a timer.

---

## 4. Who Calls Which Endpoints (index-relevant)

| Endpoint / area | Callers |
|-----------------|--------|
| **GET /user/current** | `AuthService.getCurrentUser()` ← `ScriptPalUser.checkSession()` (authGate + initScriptPal). |
| **GET /script?userId=** | `ScriptService.getAllScriptsByUser()` ← `ScriptStore.loadScripts()` ← `ScriptStore.ensureUserHasScripts()` ← `ScriptsController.handleUserChange()`. Also `ScriptListWidget.refresh()` (user-triggered). |
| **GET /script/:id** | `ScriptService.getScript()` ← `ScriptStore.loadScript()` ← `ScriptsController` (slug recovery, initial load by id), and when user selects a script from list. |
| **GET /script/slug/:slug** | `ScriptService.getScriptBySlug()` ← `ScriptStore.loadScriptBySlug()` ← `ScriptsController.handleUserChange()` when URL has slug. |
| **PUT /script/:id** | `ScriptService.updateScript()` ← `ScriptStore.updateScript()` ← `ScriptStore.flushPatch()` ← EditorSaveService (content), TitlePageManager (title/author/description/visibility). |
| **POST /script** | `ScriptService.createScript()` ← `ScriptStore.createScript()` ← `ScriptStore.ensureUserHasScripts()` when user has no scripts, or “New Script” UI. |
| **GET /chat/messages** (by script) | `ChatService.getChatMessages(scriptId)` ← `ChatHistoryManager.loadScriptHistory()` on script change and when ChatHistoryManager initializes with a current script. |
| **GET /user/token-watch** | `AuthService.getTokenWatch()` ← `TokenWatchWidget.fetchAndRender()` (initial + every 30 s). |

Auth (login/logout) and other endpoints (e.g. entities, media, brainstorm) are used from their own flows (auth page, side panels, etc.), not from the initial index load sequence above.

---

## 5. Load-Order Diagram (Simplified)

```
index.html
  → appBootstrap.start()
      → requireAuth()
          → new ScriptPalAPI(), new ScriptPalUser()
          → user.checkSession()  → GET /user/current  [1]
          → if !authenticated: redirect
      → import('initScriptPal.js')

initScriptPal()
  → renderSharedTopBar, new App(), app.init()
  → new ScriptPalAPI(), new ScriptPalUser()  [new instances]
  → initSharedTopBarWidgets() → TokenWatchWidget, AuthWidget (no API in init)
  → persistenceManager.initialize()
      → loadPersistedState() (localStorage only)
      → startAutoSave() (30s interval → localStorage only)
  → user.checkSession()  → GET /user/current  [2] REDUNDANT
  → authWidget.updateUIForAuthenticatedUser() → setState(USER, user)
  → AuthenticatedAppBootstrap.init()
      → initUI()
          → initScriptsUI()
              → ScriptsUIBootstrap.initialize()
                  → handleUserChange(user)
                      → scriptStore.ensureUserHasScripts(user.id)  → GET /script?userId=  [3]
                      → if slug: loadScriptBySlug  → GET /script/slug/:slug  [4a]
                      → else: selectInitialScript() → loadScript(id)  → GET /script/:id  [4b]
                      → (if no scripts: createScript  → POST /script  [5])
              → EditorWidget created; setEditorWidget → handleCurrentScriptChange (editor load, no API)
      → initChat()
          → ChatManager.initialize()
              → ChatHistoryManager.initialize()
                  → if currentScript: loadScriptHistory  → GET /chat/messages  [6]
      → wireOrchestrator()
  → TokenWatchWidget: handleAuthState(true)  → fetchAndRender()  → GET /user/token-watch  [7]
  → TokenWatchWidget: schedulePoll()  → every 30s  → GET /user/token-watch
```

---

## 6. File Reference

| File | Role |
|------|------|
| `public/index.html` | Entry; loads `appBootstrap.js`. |
| `public/js/pages/appBootstrap.js` | Auth gate; first session check; loads initScriptPal. |
| `public/js/auth/authGate.js` | `requireAuth()`; creates API + User; `checkSession()`. |
| `public/js/initScriptPal.js` | Main init; second API/User/session check; persistence; bootstrap. |
| `public/js/app/bootstrap/AuthenticatedAppBootstrap.js` | initUI (scripts, scenes, …), initChat, orchestrator. |
| `public/js/services/api/ScriptPalAPI.js` | API facade. |
| `public/js/services/api/AuthService.js` | `getCurrentUser()`, `getTokenWatch()`. |
| `public/js/services/api/ScriptService.js` | getScript, getAllScriptsByUser, getScriptBySlug, updateScript, createScript. |
| `public/js/services/api/ChatService.js` | getChatMessages. |
| `public/js/services/persistence/PersistenceManager.js` | 30s auto-save to localStorage; loadPersistedState (no API). |
| `public/js/stores/ScriptStore.js` | loadScripts, loadScript, loadScriptBySlug, ensureUserHasScripts, flushPatch → updateScript. |
| `public/js/services/script/ScriptsController.js` | handleUserChange → ensureUserHasScripts, slug/initial script load. |
| `public/js/widgets/editor/save/EditorSaveService.js` | CONTENT_PERSIST → flushSave → queuePatch + flushPatch (no debounce). |
| `public/js/widgets/ui/TokenWatchWidget.js` | 30s poll → getTokenWatch(). |
| `public/js/widgets/chat/core/ChatHistoryManager.js` | Script change / init → getChatMessages(scriptId). |
| `public/js/constants.js` | API_ENDPOINTS. |

---

## 7. Recommendations Summary (Implemented)

1. **Remove duplicate session check** — Done. `appBootstrap` passes `auth` (with `user` and thus single API) into `init(preAuth)`; when `preAuth` is present, initScriptPal skips the second `checkSession()`.
2. **Single API (and optionally User) instance** — Done. One API/User created in `requireAuth()`; passed into `init(preAuth)` and reused for the app lifecycle.
3. **Editor auto-save** — Done. `EditorSaveService` debounces CONTENT_PERSIST → flushSave by 800 ms; focus-out, manual save, and page exit still flush immediately.
4. **Token watch** — Done. Polling interval increased from 30 s to 60 s in `TokenWatchWidget`.
