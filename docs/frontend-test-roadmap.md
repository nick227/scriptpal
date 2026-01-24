# Frontend Test Cleanup Roadmap

## Current status
- Jest reports 59 suites, 1252 tests; about 47 suites (estimated ~601 tests) fail with a mix of missing dependencies, unimplemented browser APIs, and additional `AICommandManager`/`ScriptStore` wiring gaps.
- Left unchecked, that makes the suite unusable for quick MVP iterations, so we need a divide‑and‑conquer approach before re‑enabling the full run.

## Failure buckets
1. **Editor auto-save / save service**
   - Tests in `public/js/__tests__/widgets/editor/EditorSaveService.test.js` fail because `scriptStore` helpers like `getCurrentScriptId` and `setLastSavedContent` are missing on the mocked service and because debounced calls never resolve.
   - Result: 16+ assertions for save triggering, validation, debouncing, and error handling currently throw before asserting anything.
2. **Authentication notifications**
   - `AuthenticationManager` still calls `alert()` in `showSuccess`/`showError`, and Jest’s jsdom environment throws `Error: Not implemented: window.alert`.
   - While the underlying logic mostly works, the missing browser API surfaces as loud console errors that obscure other failures.
3. **Requirements / AI helpers**
   - Almost every `public/js/__tests__/requirements/*` suite either throws (`AICommandManager is required for AILineInsertionManager`) or crashes afterwards because supporting managers (keyboard, selection, actions) aren’t mocked correctly.
   - Each requirement exercise spawns dozens of additional tests (AI response parsing, performance, integration) that keep piling on the failure tally.
4. **Editor keyboard & selection**
   - Tests under `public/js/__tests__/requirements/requirement-17-multi-line-selection.test.js` fail because `KeyboardManager.operations` states assume DOM nodes that aren’t mounted, so `operations` becomes `null` and the event handler blows up.
5. **General DOM / browser gaps**
   - Some suites access `window.alert`, `window.prompt`, or expect `window.getSelection`; others rely on `ResizeObserver`, `IntersectionObserver`, etc., which we already stub, but a few helpers still rely on unmet APIs.

## Divide-and-conquer plan
1. **Stabilize the shared environment**
   - Expand `public/jest.setup.js` to stub `alert/confirm/prompt`, and return a small `Selection` stub so keyboard tests stop hitting `null`.
   - Add dedicated mocks for `scriptStore`, `AICommandManager`, and other injection points so their consumers can resolve without needing the full application.
2. **Focus on feature buckets**
   - ***Auto-save / Save service***: mock `ScriptStore`, ensure `EditorSaveService` can call `save`, and add explicit, test-only helpers for last saved content or debouncing to keep the promise chain alive.
   - ***Authentication & Global UI***: replace `alert` calls with a test-friendly notification helper or keep the stub in setup.
   - ***AI requirements***: introduce simplified `AICommandManager`/`AILineInsertionManager` mocks, then re-enable one requirement at a time and let their tests guide the real implementation.
   - ***Keyboard / selection***: feed DOM stubs or factory helpers so `KeyboardManager` can operate on the expected structure instead of `null`.
3. **Gradually re-enable suites**
   - Once a bucket is stabilized, remove it from the ignore list in `public/jest.config.js`, update snapshots, and ensure the new tests execute without throwing.
   - Add more granular jest patterns (e.g., `testPathIgnorePatterns`) to cycle through buckets during cleanup.

## MVP-friendly configuration (temporary)
- Keep the root `jest.config.js` running the most actionable suites by temporarily ignoring these directories:
  - `public/js/__tests__/requirements/`
  - `public/js/__tests__/widgets/editor/`
  - `public/js/__tests__/widgets/auth/`
- As those buckets are fixed, remove their ignore entries so the suite reports meaningful pass/fail data again.

## Next actions
- Introduce lightweight mocks for `ScriptStore`, `AICommandManager`, and `KeyboardManager` consumers to enable incremental fixes.
- Once each bucket passes, remove the related ignore pattern and rerun `npm run test:frontend`.
