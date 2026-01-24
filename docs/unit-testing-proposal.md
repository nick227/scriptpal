# Unit Testing Proposal

## Motivation
We just spent significant time tracking down why the `#visibility-select` dropdown always reverted to `private` even though the database recorded `public`. The bug surfaced in production behavior and required tracing across `TitlePageManager`, `PersistenceManager`, and the serialized snapshot. A focused unit-testing suite would have caught the divergence earlier by exercising the metadata persistence logic in isolation, giving us quicker feedback and a firmer safety net for future refactors.

## Goals
1. **Prevent regressions** in metadata handling when we change how scripts are saved, serialized, or restored (title, author, visibility, etc.).
2. **Exercise edge cases** such as metadata-only patches, session reloads while the editor is locked, or visibility changes without content updates.
3. **Document expected behaviors** of core components so engineers can clearly see what must remain stable (e.g., visibility propagation from store to UI).

## Suggested Tests
| Scope | Description | Why it matters |
| --- | --- | --- |
| `TitlePageManager` | Mock `ScriptStore`, `StateManager`, and persisted state to assert the visibility dropdown reflects the cleaned value after each `handleScriptChange` or persisted-state hydrate. | Directly validates the UI contract that was failing in the bug scenario. |
| `PersistenceManager` | Unit test `handleScriptChange` to ensure snapshots include title/author/visibility and that `isSnapshotEqual` respects metadata fields. | Prevents us from silently skipping persistence when only metadata changes. |
| `ScriptStore` | Simulate metadata-only patch flush and confirm `updateScript` includes the normalized visibility and triggers `setCurrentScript`. | Ensures the backend receives metadata updates and the store updates the cached state. |
| Integration-style controller | Optionally, a small test for `ScriptsController` or `App` bootstrap to confirm `StateManager` and widgets react to simulated reload events (mock storage and API responses). | Reinforces that the layered architecture still wires together as expected during reload/persistence cycles. |

## Infrastructure
- Use the existing Jest configuration (`public/js/__tests__`, `jest.config.js`), targeting modules under `public/js/widgets` and `public/js/managers`.
- Provide lightweight mocks for DOM nodes (`document.createElement`, `localStorage`) via `jest-environment-jsdom`.
- Add fixtures or factory helpers for script metadata (title/author/visibility) so tests stay readable and reusable.
- Capture console output only when necessary (e.g., verifying warning paths) to avoid noisy logs.

## Metrics
- Aim for 70–80% coverage on the TitlePageManager + PersistenceManager modules before expanding to broader widgets.
- Track failures related to metadata/visibility regression tests in CI so the team notices immediately.

## Next Steps
1. Add `TitlePageManager` and `PersistenceManager` tests as described above, mocking `ScriptStore` responses to drive the behavior.
2. Refine our fixtures based on `ScriptStore.standardizeScript` output, ensuring tests mirror real metadata objects.
3. Run `npx jest public/js/__tests__` upon each push to keep regressions from sneaking into the codebase.
4. Gradually extend the suite to other critical managers (e.g., `ScriptStore`, `AuthWidget`) once the core metadata tests pass consistently.

This proposal keeps the focus on the visibility-related workflow that almost broke on reload and builds a solid foundation for future feature work.
