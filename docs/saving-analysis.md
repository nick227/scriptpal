# Saving Analysis

## Auto-save orchestration (`public/js/widgets/editor/save/EditorSaveService.js:1-74`)
- **Trigger points**: every `EDITOR_EVENTS.CONTENT_CHANGE` fires `handleContentChange`, which normalizes the script text, compares it to the previous normalized value, and if different calls `scheduleSave('auto')`. The same normalization check protects against redundant saves when Paste/formatting does not change normalized content.
- **Throttle window**: `scheduleSave` delays the actual persistence call by `debounceDelay = 5000 ms`. This keeps autosave from firing on every keystroke while still persisting within a few edits.
- **Manual save parity**: `handleManualSave` is bound both to the toolbar save button and `Ctrl+S` through `toolbar.onSave(this.handleManualSave)` and `_handleGlobalShortcuts` respectively. Both funnels end in `flushSave('manual')`, so the path, telemetry, and patch queue are identical for keyboard and button saves.
- **Autosave hooks beyond typing**:
  * `handleFocusOut` flushes immediately when the editor loses focus (`EDITOR_EVENTS.FOCUS_OUT`), ensuring work isn’t lost when the user tabs away.
  * ~~`handlePageExit`~~ (removed) — server saves on unload were disabled; see `docs/autosave.md`.

## Flush details (`EditorSaveService.flushSave:39-70`)
- **Dirty detection**: If there’s no selected script ID or the normalized content matches the currently saved script body, the flush short-circuits and returns `false` without hitting the network.
- **Patch queue**: When a change is detected, `scriptStore.queuePatch` stages the new content under the `"editor"` source, and producing `options.immediate` will also run `flushPatch` so page-exit saves can push right away.
- **State sync**: `lastNormalizedContent` is updated whenever a flush occurs so subsequent autosaves only fire when fresh edits appear again.

## Persistence-level auto-save (`public/js/managers/PersistenceManager.js:70-275`)
- **30‑second heartbeat**: `PersistenceManager.startAutoSave()` spins up a `setInterval(..., autoSaveDelay)` using `autoSaveDelay = 30000` to periodically capture the current script/chat/UI context via `saveCurrentState()`. This is distinct from the editor’s content save; it keeps cursor position, scroll, chat history, and UI preferences durable in `localStorage`.
- **Visibility/page lifecycle**:
  * `beforeunload` and `visibilitychange` also call `saveCurrentState`, mirroring the editor save service by persisting when the tab loses focus or unloads.
  * When the document becomes hidden, a save runs immediately (`handleVisibilityChange`), while visibility returning reloads previously persisted context.
- **Script change events**: Whenever `StateManager.KEYS.CURRENT_SCRIPT` swings to a different script, `handleScriptChange` snapshots the new ID, title, cursor, and scroll positions, writing them to storage only when they differ from the previous snapshot.

## Recommendations
1. Continue relying on the single `flushSave` pipeline so `Ctrl+S` and the save button stay in sync; avoid introducing separate persistence layers that duplicate the patch queue.
2. Keep the 5-second debounce for autosave to preserve performance, but ensure heavy import/AI rewrites manually call `flushSave('manual', { immediate: true })` after the transformation.
3. Save on exit removed; rely on debounce, focus-out, and manual save.
