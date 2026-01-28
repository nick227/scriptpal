# Token Watch Proposal

## 1. AI tracking schema review
- The authoritative persistence point for AI interactions today is `chat_messages` (`docs/scriptpal-data-schema.md:54-72`). It already captures `prompt_tokens`, `completion_tokens`, `total_tokens`, and `cost_usd`, which gives us the raw numbers needed to report spend per session, script, or user.
- The singleton `AIClient` tracks global totals, cost, response time, and success/failure counts before any per-user breakdown (`server/services/AIClient.js:8-333`). Those metrics prove we already surface tokens and cost at the request level, but the aggregation is global, leaving the user-facing surface blank.

## 2. MVP goals for the Token Watch feature
1. Surface each authenticated user's token spend and USD cost as a badge in the shared top bar so they can monitor consumption without leaving the editor.
2. Provide a dedicated `GET /api/user/token-watch` endpoint that returns the latest per-user totals (prompt/completion split, total tokens, USD) in near real-time.
3. Feed the widget from the new route while ensuring data ingestion captures every AI completion.

## 3. Data capture plan
1. **Extend chat persistence** � when the chains receive a completion, the OpenAI response already contains `usage`. Propagate that through `BaseChain.execute` into the metadata the router returns and ensure `ChatHistoryManager.saveInteraction` writes `prompt_tokens`, `completion_tokens`, `total_tokens`, and `cost_usd` fields alongside the normal content. `chatMessageRepository.create` should accept those fields so the schema in `chat_messages` is fully utilized.
2. **Aggregate per-user totals** � either via a lightweight read on `chat_messages` or via a small aggregate table (e.g., `UserTokenUsage` with `user_id`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `cost_usd`, `updated_at`). For MVP we can `SUM` the `chat_messages` rows for a user over the last 24 hours/entire history (adding the aggregate table later if the query becomes heavy). The endpoint should return both lifetime and recent totals when possible.
3. **Optionally cache** � we can cache the last few totals in memory (per-user map) and refresh it whenever we log a new completion to avoid repeated SUM scans. The cache should TTL out every 30 seconds so the widget stays accurate.

## 4. API design
- **Route:** `GET /api/user/token-watch` (under `/api`) with `validateSession` middleware.
- **Input:** no body, just the session cookie. Future enhancements can accept `interval=hourly|daily|lifetime` query parameters.
- **Response:**
  ```json
  {
    "userId": 123,
    "tokens": {
      "prompt": 512,
      "completion": 1024,
      "total": 1536
    },
    "costUsd": 0.0048,
    "lastUpdated": "2026-01-25T12:34:56.789Z"
  }
  ```
- **Implementation:** use Prisma (`UserTokenUsage` model or direct aggregation of `chat_messages`) to build the totals and attach `lastUpdated`. If we add `UserTokenUsage`, provide `tokenUsageRepository.incrementUsage(userId, metrics, timestamp)` and expose a `getForUser(userId)` helper.

## 5. Top bar widget design
- Extend `public/js/layout/sharedLayout.js` to emit a dedicated container for the token badge (e.g., `<div class="token-watch-widget" aria-live="polite"><span class="token-watch__value">�</span></div>` placed next to the auth controls).
- Introduce a `TokenWatchWidget` under `public/js/widgets/` that:
  1. Receives the new container, `ScriptPalAPI`, `StateManager`, and `EventManager` (similar to `AuthWidget`).
  2. Fetches `/api/user/token-watch` on initialization and every 30s while the user is authenticated.
  3. Subscribes to `EventManager.EVENTS.CHAT.MESSAGE_RECEIVED` (or equivalent) so a new AI completion triggers an immediate refresh.
  4. Exposes `loading`, `error`, and `value` states (e.g., show spinner while fetching, the formatted cost/tokens on success, and a warning badge on error) and toggles its visibility based on `StateManager.KEYS.AUTHENTICATED`.
- Update `public/js/initScriptPal.js` to instantiate the token widget right after `renderSharedTopBar()` and wire it similarly to the auth widget (pass shared elements, `stateManager`, `eventManager`, and `ScriptPalAPI`).
- Add `STATE_KEYS.TOKEN_USAGE` (or similar) to the `StateManager` schema so other widgets can consume the same data if needed later.

## 6. Client-side API updates
- Extend `public/js/constants.js` with an `API_ENDPOINTS.TOKEN_WATCH = '/token-watch'` entry.
- Add `ScriptPalAPI.prototype.getTokenWatch()` calling `/api/user/token-watch` (assuming `/api/user` is the base path) or `/api/user/token-watch` directly.
- The widget should call this method via the `ScriptPalAPI` instance and format the returned tokens/cost for display (`1,536 tokens � $0.0048`).

## 7. MVP checklist
- [ ] Capture `usage` objects from every `AIClient.generateCompletion` call and persist tokens/cost with each chat message.
- [ ] Build (or reuse) an aggregate query/repository that can quickly return a per-user summary.
- [ ] Add authenticated route `GET /api/user/token-watch` with session validation and the new repository logic.
- [ ] Create `TokenWatchWidget`, wire it into the shared top bar, and keep it in sync via polling + chat events.
- [ ] Document the new schema/table/model and (`ScriptPalAPI`) endpoint so other teams can reuse the data.

## 8. Testing & rollout notes
- Unit tests should cover the new repository methods and the API handler to ensure totals are calculated correctly (the existing Jest suite can be extended with `prisma` mocks).
- Manual QA should verify the badge renders for logged-in users, updates after a new AI completion, handles auth transitions, and gracefully shows errors when the server route fails.
- Future iterations can add thresholds/alerts (e.g., highlight when spend exceeds a budget) and expose historical charts without modifying the stored schema.
