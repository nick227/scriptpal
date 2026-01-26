# Editor History Decision

## Current Status
- Native browser undo/redo now owns `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z` flows; there is no custom key interception or `history.undo()` invocation inside `KeyboardManager` for those shortcuts (`public/js/widgets/editor/keyboard/KeyboardManager.js:200-229`). The handler still keeps `Ctrl+S` for manual save so the workflow remains familiar.
- The toolbar buttons (`.undo-button` / `.redo-button`) can remain as visual affordances, but they no longer need to tie into a bespoke undo stack until a broader versioning strategy is solidified.
- Relying on the browser simplifies interactions and avoids conflicts with the upcoming script versioning layer that manages historical states at a higher level.

## Rationale
1. A full custom command history stack adds complexity and memory pressure that outweigh the value for the majority of typing/delete workflows native undo already covers.
2. Native undo/redo preserves cursor state, selection, and per-line edits automatically; the custom stack previously required mirrors of those states, which now risk clashing with script versioning updates.
3. Removing the custom handler also keeps telemetry and undo/redo behavior consistent when working inside the browser, eliminating the need to sync two separate history services.

## Observability & Testing
- Verify that the editor no longer calls `event.preventDefault()` for `Ctrl+Z`/`Ctrl+Y` at the DOM level (see `KeyboardManager` lines 200-229).
- Reuse existing tests (e.g., `public/js/__tests__/requirements/requirement-23-undo-redo-controls.test.js`) to ensure toolbar buttons consider undo availability even though keyboard shortcuts rely on the browser.
- Monitor the script versioning feature for future opportunities to reintroduce a custom stack tied to app-level saves instead of raw keystrokes.

## Next Steps
1. Improve the native undo experience by ensuring edits trigger DOM mutations that behave well with the browser stack (e.g., avoid manual DOM rewrites that reset the undo checkpoint).
2. Coordinate with script versioning so it can optionally capture high-level state snapshots without hijacking `Ctrl+Z`/`Ctrl+Y`.
3. Reassess the need for a custom stack once versioning puts guardrails around conflicting undo/redo sources.
