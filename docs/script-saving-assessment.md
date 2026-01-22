# Script Saving Inputs & Rendering Assessment

This note documents how title/author inputs are saved and rendered, highlights where they can drop when the page reloads, and references the key files/methods that participate in the round-trip pipeline.

## 1. Title Page Input → Patch Queue

- `TitlePageManager` renders title/author inputs whose `value` is derived from `this.titlePageData`. The inputs are now render-only: they do not mutate the store directly, they only update `titlePageData` and enqueue the patch.
- `handleTitleInputChange` / `handleAuthorInputChange` both call `scheduleTitlePersist`, which delegates to `ScriptStore.queuePatch(scriptId, { title?, author? }, 'title-page')`. `queuePatch` now applies the patch locally before scheduling the API flush, so the store and `CURRENT_SCRIPT` immediately reflect the typed values.
- The `[TITLE_PAGE] PERSIST_TRIGGER` log still prints both fields, giving you a reliable snapshot of the data being persisted.

## 2. Patch Queue → API → State

- `ScriptStore.queuePatch()` merges pending patches, emits `SAVE_DIRTY`, schedules a flush, and eventually calls `updateScript()` with the latest `title/author/content` payload.  
- `updateScript()` formats and validates content, then issues the PUT via `ScriptPalAPI.updateScript()` (which logs `[API] Updating script`). Final success triggers `SAVE_SAVED` and updates both `StateManager.KEYS.SCRIPTS` and `CURRENT_SCRIPT`.

## 3. Persistence & Rehydration

- `PersistenceManager` no longer stores the full script blob—only the script ID plus cursor/scroll context—so a reload starts from the API response rather than a stale local copy.  
- `loadPersistedState` restores the requested ID and cursor/scroll positions, but it no longer sets `StateManager.KEYS.CURRENT_SCRIPT`; that happens after the API list load.
- `ScriptsController.handleUserChange` always calls `scriptStore.selectScript(preferredId)` after `loadScripts`, ensuring `ScriptStore.setCurrentScript` publishes the canonical metadata even when a stub persisted script exists.

## 4. Rendering Concerns

- `TitlePageManager.handleScriptChange` only renders the current script—it no longer mutates the store. Each script change updates `titlePageData`, which drives `updateTitlePageDisplay`, and the handler logs the new metadata so you can confirm both fields arrive after a reload.
- If the log doesn’t appear, the component isn’t subscribing quickly enough (check `EditorWidget`’s optional component phase). If it does appear but inputs still feel stale, force `updateTitlePageDisplay()` so the DOM copies whatever `titlePageData` holds.

## 5. Recommendations

1. Keep the `handleScriptChange` log in place until you observe the title page reacting to reloads; if it never runs, fix the optional-component wiring in `EditorWidget.initialize`.  
2. Once the log fires, verify the inputs are populated and the console shows `queuePatch`/`SAVE_*`/`[API]` logs with the live values.  
3. Continue keeping persistence scoped to IDs and context so the API remains the single source of truth for title/author.
