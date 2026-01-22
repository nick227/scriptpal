# Script Persistence Flow

This review traces how editor changes travel from the UI through validation, API persistence, and back to the browser / `StateManager`. It highlights the gaps that stop metadata-only edits and stray lines from sticking, so reviewers can focus on fixing them.

## 1. Source of truth and caching

- `ScriptStore` holds the canonical `scripts` array, `currentScriptId`, and `StateManager` entries (`public/js/stores/ScriptStore.js`). Every create/select/update call updates both the in-memory cache and `StateManager.KEYS.SCRIPTS` / `CURRENT_SCRIPT`, then emits events (`SCRIPT:SELECTED`, `SCRIPT:UPDATED`, etc.) so widgets/persistence know about the change.
- `PersistenceManager` subscribes to `StateManager.KEYS.CURRENT_SCRIPT` and, on every change, serializes the metadata (`title`, `author`, `content`, `versionNumber`, cursor/scroll) into `localStorage` keys like `currentScriptState` and `currentScriptTitle`. That data is loaded on `loadPersistedState` whenever the page refreshes, which rehydrates `StateManager` and helps bust the gap before the API returns fresh data (`public/js/managers/PersistenceManager.js:44-210`).

## 2. Editor → save service → store → API flow

1. Editor edits emit `EDITOR_EVENTS.CONTENT_CHANGE`, which `EditorSaveService` hears via `setupListeners`. It normalizes the string, enforces minimum spacing (`MIN_CHANGE_INTERVAL`, change count), and schedules a save after a short delay (`scheduleSave`) or immediately when a manual save/line change occurs (`public/js/widgets/editor/save/EditorSaveService.js:90-220`).
2. `EditorSaveService.save` normalizes/validates the content with `ScriptFormatter` (wrapping in `<script>` tags, checking known tags, rejecting inline-only content, etc.). On validation failure it now emits `SAVE_ABORT_VALIDATION` (with the error message and normalized snippet), sets the toolbar to `error`, schedules a reset (`scheduleToolbarState('idle', 2000)`), logs the issue, and aborts without calling `ScriptStore.updateScript` at all (`public/js/widgets/editor/save/EditorSaveService.js:240-420`). When validation passes it logs `SAVE_START` and `SAVE_CALL_STORE` before proceeding.
3. When validation passes, `save` calls `ScriptStore.updateScript` with the normalized string, current title/author, and the script’s version number.
4. `ScriptStore.updateScript` now trims the content and only runs `ScriptFormatter.format` when non-empty; empty strings are sent straight through so metadata-only edits (title/author) still reach the API. Otherwise, the formatter enforces its rules and `validateFormat` must pass before the remote call (`public/js/stores/ScriptStore.js:200-260`).
5. The API (`ScriptPalAPI.updateScript`) sends the payload to `/script/:id`, which is validated again server-side before creating a new `ScriptVersion` and `ScriptCommand` via `server/models/script.js` (`server/controllers/scriptController.js`, `server/models/script.js`).
6. The response is re-standardized, the cache and `StateManager` are refreshed, and `PersistenceManager` writes the fresh metadata. The editor widgets receive `SCRIPT.UPDATED` and repaint the UI.

## 3. Remaining issues

- **Silent validation failures**: `EditorSaveService.validateContent` fully aborts on validation errors and only toggles the toolbar to `error` briefly before reverting. Users never see a descriptive message about what tags or structure were missing, so “lines not persisting” look like a platform bug. The toolbar should surface the error (tooltip, toast, or persistent status) and maybe include a link to the expected format.
- **Metadata-only updates still rely on API success before persistence**: the persistence pipeline now hinges on the API successfully storing the metadata-only request that carries an empty content string. TitlePageManager logs `TITLE_PAGE.PERSIST_TRIGGER` / `TITLE_PAGE.SAVE_TRIGGER` each time it calls `ScriptStore.updateScript`, including the scriptId, title, author, typeof content, length, and versionNumber, so you can verify the payload actually reaches the store and API. Without a successful response the store never refreshes and persistence never mirrors the new title/author.
- **No retry or offline queue**: `EditorSaveService` drops saves if the toolbar is already saving or if validation fails and never retries (other than manual re-edit). Consider queueing pending content so only the latest version is lost on failure, or surface `Pending` state until the network request resolves.

## 4. Suggested improvements

1. **Surface validation errors**: extend `EditorSaveService.setToolbarState` (or add a dedicated `setStatusMessage`) to show the validation error message and prevent the toolbar from briefly flickering `error` without detail.
2. **Auto-wrap/repair plain lines**: before failing, try wrapping plain text lines with `<action>` (or another default tag) so most writes succeed without demanding the user type tags explicitly.
3. **Queue unsaved edits**: when `save` is already running, keep the pending normalized content and retry after the current request settles (already partially handled by `pendingContent`, but consider retrying validation instead of discarding lines).
4. **Confirm metadata-only state**: add telemetry/logging around updates that send empty content (see `TITLE_PAGE.*` logs) to confirm they still flow through persistence and the server acknowledges them, helping trace why title/author sometimes revert.
