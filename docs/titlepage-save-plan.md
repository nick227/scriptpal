# Title Page Save Improvements

## Core principle

`ScriptStore.queuePatch()` is the only persistence entry point. Every UI component (TitlePage, editor, keyboard shortcuts, autosave) simply queues patches; the store serializes them into API calls. Nothing else talks directly to the server.

## New architecture

Introduce a unified patch queue inside `ScriptStore`:

1. `queuePatch(scriptId, { title?, author?, content? }, reason)` merges the incoming values into the latest pending patch for that script using last-write-wins semantics (newer fields override).
2. One HTTP request per script can be in flight at a time; additional patches wait for the current request to finish, then flush immediately.
3. The queue flushes automatically after a short idle debounce (500‑1000 ms) or when explicitly triggered by manual saves or TitlePage actions.
4. The store emits save state events so the toolbar/UI can react:
   * `SAVE_DIRTY` – new unsaved patch is queued.
   * `SAVE_SAVING` – request is in flight.
   * `SAVE_SAVED` – API responded successfully.
   * `SAVE_ERROR` – request failed (includes error details).

## Title page changes

1. Replace the direct `ScriptStore.updateScript` calls with `queuePatch(scriptId, { title, author }, 'title-page')`.
2. Do not pass editor content or version numbers; the store already keeps the latest state and version.
3. Keep only an optional debounce (400 ms) before enqueueing, plus the existing optimistic `updateScriptTitle` UI updates. The TitlePage no longer has to worry about formatting/content correctness.

## Editor save changes

1. Collapse `EditorSaveService` into a thin debouncer: on content changes, schedule a single save after 500‑1000 ms (reset timer on further edits).
2. When the timer fires, call `ScriptStore.queuePatch(scriptId, { content }, 'editor')`.
3. If a request is already running, let the store buffer the latest patch (last-write-wins). Remove `isSaving`, `pendingContent`, `MIN_CHANGE_INTERVAL`, `MAX_CHANGES_BEFORE_SAVE`, autosave loops, and counters—`queuePatch` and the single timer handle everything.

## Validation strategy

1. Replace “validate or abort” with “normalize or repair.” Every patch is accepted; validation returns warnings (logged to console/UI) but never blocks the save.
2. The client should automatically wrap plain lines with default tags (e.g., `<action>`) to keep them in sync. Validation can still surface errors, but the server ultimately normalizes the payload.

## Toolbar state machine

1. The toolbar reads save state events emitted by `ScriptStore` and renders them directly: `idle → dirty → saving → saved | error`.
2. No flicker, no inferred timers—just set the appropriate state when the store emits `SAVE_DIRTY`, `SAVE_SAVING`, `SAVE_SAVED`, or `SAVE_ERROR`.
3. Surface error messages (token, reason) until the next successful save or user acknowledgment.

## Persistence clarification

1. `PersistenceManager` stays for cursors, scroll, and “last opened script” convenience only.
2. API success is the sole definition of persistence; if the API rejects or the patch queue fails, do not overwrite local storage with the failed data. Instead, keep the script marked dirty and surface that via the toolbar state machine.
3. On reload, rehydrate from `localStorage`, but always reconcile with whichever script the server returns (API push wins).

## Deletions

- Remove any client-side content validation that blocks saves (e.g., `validateContent` rejecting and skipping `queuePatch`).
- Drop direct `ScriptStore.updateScript` calls from `TitlePageManager`; route through `queuePatch` instead.
- Delete redundant autosave timers, counters, and `EditorSaveService` helpers that duplicate the queue’s responsibility.
