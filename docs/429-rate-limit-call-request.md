# 429 Rate Limit — Root Causes & Call Request

Intermittent `429 Too many requests from this IP, please try again later.` on production and local. This doc breaks down current code paths that hit the API and proposes fixes.

---

## 1. Backend rate limit (current behavior)

| Item | Location | Value |
|------|----------|--------|
| Middleware | `server/middleware/security.js` | `getRateLimitConfig()` |
| Library | `express-rate-limit` | Applied to all `/api` routes |
| Key | `_getRateLimitKey(req)` | `user:${req.userId}` → `session:${sessionToken}` → **`req.ip`** |
| Max (auth) | `server/config/index.js` | `RATE_LIMIT_MAX_AUTH` ?? `RATE_LIMIT_MAX` (default **100**) |
| Max (anon) | Same | `RATE_LIMIT_MAX_ANON` ?? `RATE_LIMIT_MAX` (default **100**) |
| Window | Env `RATE_LIMIT_WINDOW` | Default **900000** ms (15 min) |
| Response | `security.js` handler | `429` + `{ error: 'Too many requests from this IP...', retryAfter }` |

So: **100 requests per 15 minutes per key**. If `userId` or session cookie is missing, the key falls back to **IP**, so all users behind the same NAT (or same machine) share one bucket.

---

## 2. Client API call breakdown

### 2.1 Script list & script load (ScriptStore + ScriptsController)

| Caller | Method | Endpoint | When |
|--------|--------|----------|------|
| `ScriptsController.handleUserChange` | GET | `/api/script?userId={id}` | On login and when USER state changes (via `ensureUserHasScripts`) |
| Same flow, slug in URL | GET | `/api/script/slug/{slug}` | If path has `/mine/{slug}` |
| Same flow, no slug | GET | `/api/script/{id}` | `selectInitialScript` → `selectScript(id)` → `loadScript(id)` |
| `ScriptListWidget` refresh | GET | `/api/script?userId={id}` | User clicks refresh (`loadScripts(userId, { force: true })`) |
| `ScriptStore.loadScript(id)` | GET | `/api/script/{id}` | Script selection, version load, slug load, recovery |
| `ScriptStore.loadScriptBySlug(slug)` | GET | `/api/script/slug/{slug}` | URL has slug |
| `EditorWidget` version picker | GET | `/api/script/{id}/versions` | Opening version dropdown |
| `EditorWidget` version load | GET | `/api/script/{id}?version={n}` | Selecting a version |

**Startup burst (authenticated, with slug):**  
`ensureUserHasScripts` → **GET list** → then **GET by slug** (or **GET by id** if no slug) → often **2–3 script requests** in quick succession. If slug 404 and recovery runs: **ensureUserHasScripts** again (list) + **loadScript(fallback.id)** (+ optional **GET by slug** retry).

### 2.2 Script writes (ScriptStore + EditorSaveService)

| Caller | Method | Endpoint | When |
|--------|--------|----------|------|
| `EditorSaveService.handleContentChange` | (debounce 800ms) → `flushSave` → `queuePatch` + `flushPatch` | PUT | `/api/script/{id}` |
| `EditorSaveService.handleFocusOut` | Immediate `flushSave` | PUT | `/api/script/{id}` |
| `EditorSaveService.handleManualSave` | Immediate `flushSave` | PUT | `/api/script/{id}` |

No batching: each flush is one PUT. Heavy typing + focus blurs can cause many PUTs in a short time.

### 2.3 Token watch (TokenWatchWidget)

| Caller | Method | Endpoint | When |
|--------|--------|----------|------|
| `TokenWatchWidget.handleAuthState(true)` | GET | `/api/user/token-watch` | On login |
| `TokenWatchWidget.setupEventListeners` | GET | Same | On every `CHAT.MESSAGE_ADDED` |
| `TokenWatchWidget.schedulePoll` | GET | Same | Every **60s** (`POLL_INTERVAL = 60000`) |

So: 1 on auth, 1 per chat message, 1 per minute. Multiple tabs = multiple pollers.

### 2.4 Auth / user

| Caller | Method | Endpoint | When |
|--------|--------|----------|------|
| `ScriptPalUser.checkSession` | GET | `/api/user` (or session check) | Before authenticated bootstrap |
| Auth widget / login | POST | Auth endpoints | Login |

### 2.5 Chat

| Caller | Method | Endpoint | When |
|--------|--------|----------|------|
| Chat send message | POST | `/api/chat` | Per user message |

### 2.6 Other stores (scenes, characters, locations, media, themes)

Loads are typically on-demand (e.g. when opening a panel or selecting a script), not all at once at bootstrap. They still count toward the same 100/15min.

---

## 3. Retry & error handling (client)

| File | Behavior |
|------|----------|
| `public/js/services/api/APIConfig.js` | `shouldRetry(status, method)`: retries only for **5xx** and **status 0**. **429 is not retried**. |
| `public/js/services/api/HttpClient.js` | Uses `shouldRetry`; no special handling for 429 or `Retry-After`. |
| `public/js/stores/ScriptStore.js` | `isRateLimitError(error)` exists (status 429 or message "too many requests") but is **not used** for retry or backoff. |
| `public/js/core/BaseManager.js` | `handleError(error, context)` only logs and sets `StateManager.KEYS.ERROR`. |

So: 429 responses are not retried with delay; user just sees failure. No client-side throttling or queue.

---

## 4. Root causes (summary)

1. **Burst at login**  
   Script list + (slug or script-by-id) + token watch (+ optional recovery) in a short window; plus other UI initializing. Easy to burn 5–15 requests in a few seconds.

2. **IP-based key fallback**  
   When rate limit key is IP (no userId/session), one limit is shared for all tabs and all users on that IP (e.g. office, localhost). Message says "from this IP" which matches this.

3. **No 429 retry with backoff**  
   Client does not treat 429 as retryable or honor `Retry-After`, so temporary limit hits become hard failures.

4. **Token watch frequency**  
   60s poll + per-message fetch increases request count; multiple tabs multiply it.

5. **Autosave + focus**  
   Debounced 800ms + focus-out + manual save can produce many PUTs during active editing; under 100/15min (~6.7/min) is fine on average but bursts (e.g. after idle) can coincide with other calls.

6. **No client-side throttling**  
   No global queue or throttle; every component calls the API independently, so bursts are uncoordinated.

---

## 5. Implemented mitigations

- **ScriptStore guards:** `loadScripts`, `loadScript`, and `loadScriptBySlug` now bail when `this.isLoading`: concurrent callers get current `scripts` or cached script, so duplicate GETs at bootstrap are collapsed.
- **RATE_LIMIT_MAX_AUTH:** Default raised to **300** (from 100) in `server/config/index.js`.
- **TokenWatch:** Interval removed; fetch only on **CHAT.MESSAGE_ADDED** and once on auth (no 60s poll).
- **Autosave:** Debounce increased to **1200ms**; **min interval 2.5s** between auto-saves so rapid typing + focus doesn’t burst PUTs. Manual save and focus-out are unchanged (no cooldown).

---

## 6. Proposed directions (call request) — remaining

### Backend

- **Review limit and key:**  
  - Consider higher `RATE_LIMIT_MAX_AUTH` (e.g. 200–300) or a longer window so normal bursts (login + script load + token watch) stay under.  
  - Ensure key uses session/user whenever possible (already does when cookie/session is present).  
  - Optionally use separate (stricter) limits for expensive routes (e.g. chat POST) vs read-only (GET script, token-watch).

- **429 response:**  
  - Keep sending `retryAfter` (seconds) in the response body/header so clients can back off.

### Client

- **429 = retryable with backoff:**  
  - In `APIConfig.js`, treat **429** as retryable for idempotent methods (GET, etc.).  
  - In `HttpClient.js`, on 429: use `Retry-After` if present, else exponential backoff; cap retries (e.g. 1–2 for 429) to avoid long stalls.

- **Use `isRateLimitError` for UX:**  
  - Where errors are shown (e.g. ScriptStore load failure, TokenWatchWidget), if `isRateLimitError(error)` then show a short “Too many requests; retrying in Xs” or “Please wait a moment and try again” instead of a generic error.

- **Token watch:**  
  - Increase `POLL_INTERVAL` (e.g. 2–5 min) or make polling conditional (e.g. only when chat is visible or after a message).  
  - Keep the “on message” fetch if desired, but avoid duplicate fetch when a message and the timer fire close together.

- **Optional (later):**  
  - Client-side request throttle or queue (e.g. max N concurrent, or max M requests per minute) to smooth bursts.  
  - Coalesce startup: e.g. one “bootstrap” that loads script list + user + token usage where possible to reduce parallel calls.

---

## 7. File reference (current code)

| Area | File | Relevant bits |
|------|------|----------------|
| Rate limit config | `server/middleware/security.js` | `getRateLimitConfig()`, `_getRateLimitKey`, `_getRateLimitMax` |
| Rate limit values | `server/config/index.js` | `getSecurityConfig()`, schema defaults (RATE_LIMIT_WINDOW, RATE_LIMIT_MAX) |
| Script API | `public/js/services/api/ScriptService.js` | `getScript`, `getAllScriptsByUser`, `updateScript`, etc. |
| Script load/store | `public/js/stores/ScriptStore.js` | `loadScripts`, `loadScript`, `flushPatch`, `updateScript`, `isRateLimitError` |
| Script UI flow | `public/js/services/script/ScriptsController.js` | `handleUserChange`, `ensureUserHasScripts`, slug load, `selectInitialScript` |
| Autosave | `public/js/widgets/editor/save/EditorSaveService.js` | `handleContentChange` (800ms debounce), `flushSave` |
| Token watch | `public/js/widgets/ui/TokenWatchWidget.js` | `fetchAndRender`, `schedulePoll` (60s), CHAT.MESSAGE_ADDED |
| HTTP client | `public/js/services/api/HttpClient.js` | `request()`, retry loop, no 429 handling |
| Retry rules | `public/js/services/api/APIConfig.js` | `shouldRetry(status, method)`, `RETRYABLE_STATUS_CODES` (5xx only) |
| Auth bootstrap | `public/js/initScriptPal.js` | `init()` → AuthenticatedAppBootstrap → ScriptsUIBootstrap, etc. |
| Top bar widgets | `public/js/layout/sharedTopBarWidgets.js` | `initTokenWatchWidget` |

---

## 8. Next steps

1. **Immediate:** Add 429 to retry logic with backoff (and optional `Retry-After`) in `APIConfig` + `HttpClient`; surface rate-limit-specific message in ScriptStore/TokenWatchWidget using `isRateLimitError`.  
2. **Short term:** Relax or tune server rate limit for authenticated users; optionally increase token-watch interval.  
3. **Follow-up:** Consider client throttle/queue and/or coalesced bootstrap if 429s persist after the above.
