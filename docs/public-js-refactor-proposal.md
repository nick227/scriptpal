# Public JS Refactor Proposal

## Goals
- Collapse the overlapping `classes`, `controllers`, `managers`, `orchestrators`, and ad hoc `services`/`presentation` folders into a clear, service-oriented layout for the editor/chat experience.
- Fold all UI-related helpers (`public/js/ui/*`) into `public/js/widgets/*` so widgets are the single source of truth for rendering and DOM wiring.
- Reduce cognitive load by standardising how service-like code is organized, named, and composed (e.g., sync logic, persistence, formatting, and orchestrators).

## Current structure & pain points
- Service-like logic is scattered between `public/js/managers` and a lone `public/js/services/scriptFormatter.js:1`, making it hard to know where to add new functionality (`ScriptSyncService`, `ScriptOrchestrator`, `PersistenceManager`) while keeping dependencies explicit (`public/js/managers/ScriptSyncService.js:1`, `public/js/managers/ScriptOrchestrator.js:1`, `public/js/managers/PersistenceManager.js:1`).
- UI helpers live across three folders: dedicated UI managers (`public/js/ui/ViewManager.js:1`, `public/js/ui/AuthUIManager.js:1`), `classes` helpers that wire widgets (`public/js/classes/ElementManager.js:1`, `public/js/classes/UIStateBindings.js:1`, `public/js/classes/WidgetLifecycleManager.js:1`), and widget/presentation code (`public/js/widgets/*` + `public/js/presentation/*`). This duplicate structure drives repeated dependency wiring for `AuthWidget`, `ChatManager`, and the editor stack.
- Presentation controllers (`public/js/presentation/Editor/*`, `public/js/presentation/Scripts/ScriptRenderer.js:1`) shadow the newer widget-oriented implementations (`public/js/widgets/editor/EditorWidget.js:1`, `public/js/widgets/script/ScriptWidget.js:1`), creating confusion about ownership of behaviours such as page rendering, history, and script selection.
- `public/js/controllers/ScriptsController.js:1` still mediates between the editor widget and the script store even though `EditorWidget` and `ScriptOrchestrator` already bundle lifecycle logic, so developers often wonder where to implement editor load/invalidation.
- UI state/persistence wiring is split between `StateManager`/`EventManager`, `PersistenceManager`, and UI managers, which slows feature work (e.g., syncing state on script changes or chat signals) because developers must hunt through `classes/`, `managers/`, and `widgets/` to understand the data flow.

## Proposed structure
1. **`public/js/services/`**
   - Move `ScriptSyncService`, `ScriptOrchestrator`, `PersistenceManager`, and `ScriptFormatter` into this folder with names that reflect their coordination roles (e.g., `services/script/` and `services/persistence/`). Export a shared `ServiceRegistry` if needed for DI.
   - Keep these services focused on data orchestration, public APIs, and event subscription; widgets consume them via dependencies rather than re-implementing similar logic in `controllers`.
2. **`public/js/widgets/`**
   - Keep all DOM-facing components here, including `chat`, `editor`, `script`, `auth`, `public`, `uploader`, and `ui`.
   - Move `public/js/ui/*` (navigation/view managers, notification helpers, etc.) under `widgets/ui/*` and import them from widget entry points so there is only one place to look for UI helpers.
   - Deprecate `presentation/` and `controllers/` (keep them only as transitional shims) by folding their responsibilities into the widget implementations (`EditorWidget`, `ScriptWidget`, `ChatManager`). For example, `EditorController` could become a lightweight adaptor that instantiates `EditorWidget`.
3. **`public/js/core/` & `public/js/classes/`**
   - Keep low-level primitives (`EventManager`, `StateManager`, `BaseManager`, `ErrorHandler`) in `core`.
   - Move reusable utility classes (`ElementManager`, `UIStateBindings`, `WidgetLifecycleManager`) either into `widgets` as helpers or into a `lib/` folder so they aren’t duplicated between the `classes` and `ui` namespaces.
4. **`public/js/application/`**
   - Leave the command/query buses as is but update their imports to point to the reorganized services and widget entry points once the refactor is in place.

## Migration plan
1. **Service consolidation**
   - Create `public/js/services/script/ScriptSyncService.js`, `public/js/services/script/ScriptOrchestrator.js`, `public/js/services/persistence/PersistenceManager.js`, and `public/js/services/format/ScriptFormatter.js`.
   - Update imports in `public/js/widgets/chat/core/ChatManager.js:1`, `public/js/widgets/editor/EditorWidget.js:1`, and `public/js/controllers/ScriptsController.js:1` to use the new paths.
2. **UI folding**
   - Move `public/js/ui/*` into `public/js/widgets/ui/`, and have `WidgetLifecycleManager` and `ScriptPalUI` (if still used) reference the helpers from the `widgets` folder instead of the legacy namespace.
   - Update `public/js/widgets/auth/AuthWidget.js`, `ChatManager`, and `EditorWidget` to consume these helpers directly so we can eventually delete the loose `public/js/ui` folder.
3. **Presentation/controller cleanup**
   - Evaluate whether `presentation/Editor/EditorController.js` and `presentation/Scripts/ScriptRenderer.js:1` are still used; if not, remove them and re-point entry scripts to `widgets/editor/EditorWidget.js` and `widgets/script/ScriptWidget.js`.
   - Replace `ScriptsController`’s manual wiring with services where possible; if a controller is still needed, make it a thin adapter that simply wires the `EditorWidget` lifecycle to the service layer.
4. **Tests & verification**
   - Run any existing tests in `public/js/__tests__/` after moving files to ensure imports resolve.
   - Manually spot-check key entry points (`App.js`, `renderers.js`, `config.js`) to confirm they reference the new folder layout.

## Next steps
1. Agree on the canonical layout before mass moving files so the repo history stays clean.
2. Update any build or bundler config (if needed) to understand the new folders.
3. After moving files, run the UI entry flows (editor load, chat send, auth) to confirm nothing regressed.
