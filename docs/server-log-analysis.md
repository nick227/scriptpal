# Server Log Analysis (Redundancy & Unexpected Requests)

Review of server request logs for the index/editor/chat/auth flow: redundancies, duplicate calls, and unexpected behavior.

---

## 1. URL Path Inconsistency in Logs

**Observation:** The "Request started" log line shows `url: "/api/user/current"` (and similarly `/api/script`, `/api/chat/...`) while the completion line shows `url: "/user/current"` (no `/api` prefix).

**Example:**
- Started: `"url":"/api/user/current"`
- Completed: `"url":"/user/current"`

**Likely cause:** Middleware or the logger strips the `/api` prefix before the final log. Not a functional bug but can make log correlation and debugging harder.

**Recommendation:** Use a single, consistent URL value for the whole request lifecycle (e.g. log the same `req.originalUrl` or `req.url` at start and end).

---

## 2. Duplicate GET /chat/messages (Fixed)

**Observation:** `GET /chat/messages?scriptId=2&limit=30` and `[ChatController] getChatMessages { userId: 1, scriptId: 2 }` appear twice within ~30 ms (correlationIds `3gf3r48qcll` and `eug12aoib7`).

**Cause:** Two code paths both load history for the same script on load or when `CURRENT_SCRIPT` is set:
1. **ChatHistoryManager.initialize()** – after subscribing to `CURRENT_SCRIPT`, calls `loadScriptHistory(currentScript.id)` if state already has a script.
2. **ChatHistoryManager.handleScriptChange()** or **ChatManager.handleScriptChange()** – when `CURRENT_SCRIPT` is set (or set again), both can trigger `loadScriptHistory(scriptId)` for the same script.

**Fix (implemented):**
1. **Singleton** – `ChatHistoryManager` is a singleton (`getInstance(options)`). All callers (e.g. `ChatManager`, `ChatHistoryManager.initialize()`, `handleScriptChange`) use the same instance, so in-flight and time dedupe state is shared. Tests call `resetSingleton()` for isolation.
2. **In-flight guard** – In `loadScriptHistory()`, if a load for the same `scriptId` is already in progress, return that promise so no second GET is sent.
3. **Time-based dedupe** – If the same `scriptId` was loaded within the last 2 seconds, return cached `lastHistory` without requesting.
4. Reset in-flight and time state in `resetHistoryStorage()`; `resetSingleton()` clears the singleton for tests.

---

## 3. OPTIONS Preflight for Every Request

**Observation:** Each actual request (GET/POST/PUT) is preceded by an `OPTIONS` request to the same path (e.g. OPTIONS `/api/user/current` then GET `/api/user/current`).

**Explanation:** Normal CORS behavior. For cross-origin or non-simple requests, the browser sends a preflight OPTIONS; the server responds 204; then the real request is sent. This doubles the number of logged requests but is expected and not redundant from app logic.

**Recommendation:** No change. Optionally reduce log noise by logging OPTIONS at debug level or omitting them from summary metrics.

---

## 4. Eager Load of All Entities on Script Select

**Observation:** As soon as script `2` is selected, the server receives in quick succession:
- `GET /script/2/scenes`
- `GET /script/2/characters`
- `GET /script/2/locations`
- `GET /script/2/themes`
- `GET /owners/script/2/media?role=cover`
- `GET /owners/script/2/media?role=gallery`

**Cause:** Each entity area (Scenes, Characters, Location, Themes, Media) uses a `ScriptItemController` (or equivalent) that subscribes to `CURRENT_SCRIPT` and calls `store.loadItems(scriptId)` when the current script is set or on initial `getState(CURRENT_SCRIPT)`. So all entities load as soon as a script is selected, even if the user never opens those side-panel tabs.

**Impact:** 6 extra requests per script load. Acceptable if the goal is fast tab switching; wasteful if most users only use the editor and chat.

**Recommendation (optional):** Consider lazy-loading: load scenes/characters/locations/themes/media only when the user opens the corresponding side-panel tab, and keep the current behavior if you prefer instant tab data.

---

## 5. Request Order Summary (from logs)

| Order | Method | Path | Notes |
|-------|--------|------|--------|
| 1 | OPTIONS | /api/user/current | CORS preflight |
| 2 | GET | /api/user/current | Single session check (after front-end fix) |
| 3 | OPTIONS | /api/user/token-watch | |
| 4 | OPTIONS | /api/script?userId=1 | |
| 5 | GET | /api/user/token-watch | |
| 6 | GET | /api/script?userId=1 | Script list |
| 7 | OPTIONS + GET | /api/script/slug/big-gum | Load script by slug |
| 8–13 | OPTIONS + GET | /api/script/2/scenes, characters, locations, themes, media (cover), media (gallery) | Entity eager load |
| 14–15 | OPTIONS + GET | /api/chat/messages?scriptId=2&limit=30 | Chat history (was 2x, now deduped) |

---

## 6. Chain Registration Logs

**Observation:** On startup the server logs chain registration and registry status (e.g. `chainCount: 9`, `registeredChains: [...]`). No redundancy; useful for confirming AI chains are registered.

---

## 7. File Reference (fixes)

| File | Change |
|------|--------|
| `public/js/widgets/chat/core/ChatHistoryManager.js` | Singleton (`getInstance`, `resetSingleton`); in-flight and time-based dedupe in `loadScriptHistory()`; `ChatManager` uses `getInstance()`. |

---

## 8. Recommendations Summary

1. **Log URL consistency** – Use the same request URL (e.g. `originalUrl`) in "started" and "completed" log lines.
2. **Duplicate chat history** – Addressed with a 2s dedupe in `ChatHistoryManager.loadScriptHistory()`.
3. **OPTIONS** – Treat as expected; optionally log at debug or exclude from request-count metrics.
4. **Entity eager load** – Optional: lazy-load scenes/characters/locations/themes/media when the user opens each tab instead of on script select.
