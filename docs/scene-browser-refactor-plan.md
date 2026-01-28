# Generic Item List Refactor Proposal

## Goal
Turn the current scene-specific UI into a reusable Item List system built from
domain-agnostic building blocks (ListModel, ListView, ModalEditor, and
PanelNavigation). Keep domain words only at the edges (stores and adapters) so
Characters, Outline, Themes, and future panels can reuse the same infrastructure.

## Current State (Key Observations)
- `SceneBrowserWidget` mixes data/state, UI rendering, and DOM events.
- `SceneEditorModal` is a UI component but also manages payload shaping and AI flow.
- `SidePanelWidget` hard-codes targets to `user-scripts` and `user-scenes`.

## Target Direction
1. Split Item List into `ListModel` + `ListView` + thin Controller.
2. Replace Scene-specific naming with generic files and functions.
3. Extract `PanelNavigation` as reusable navigation wiring.
4. Convert `SceneEditorModal` into a generic `ModalEditor` (view + controller).

## Proposed Refactor (Front-End)

### 1) Item list model split (generic)
**New module**
`public/js/widgets/list/ListModel.js`
- Owns items array, ordering, inline rename state, and drag state.
- Emits update callbacks for UI, no DOM access.
- Uses injected adapter for store access and labels.
- Exposes minimal API:
  - `setItems(items)`
  - `startRename(itemId)`
  - `commitRename(itemId, value)`
  - `cancelRename()`
  - `reorder(sourceId, targetId)`
  - `openEditor(item)` / `saveItem(itemId, payload)`
  - `deleteItem(itemId)`

**Adapter responsibilities**
- Provide CRUD + reorder + AI generate functions.
- Provide labels like list title, empty state text, modal title.
- Convert domain entities to UI-safe fields (id/title/tags).

### 2) Item list view split (generic)
**New module**
`public/js/widgets/list/ListView.js`
- Pure UI: renders panel grid + modal grid.
- Emits semantic actions: `edit`, `delete`, `rename`, `drag`, `open-modal`.
- Accepts adapter labels and callbacks from controller.
- Does not touch store or `StateManager`.

### 3) Controller wiring (thin)
**New module**
`public/js/widgets/list/ListController.js`
- Connects `ListModel` + `ListView`.
- Subscribes to `StateManager` and passes items into model/view.
- Receives domain adapter and passes it to model/view.

### 4) Modal editor split (generic)
**New module**
`public/js/widgets/editor/ModalEditorView.js`
- Form UI (inputs, open/close).
- Emits `save` and `ai-generate`.

**New module**
`public/js/widgets/editor/ModalEditorController.js`
- Handles payload shaping and calls adapter functions.
- No domain words in file/class names.

**Adapters**
- Provide field configuration and label copy.
- Provide AI generation handler and save handler.

### 5) Side panel navigation extraction
**New module**
`public/js/widgets/ui/PanelNavigation.js`
- Generic helper that registers buttons and toggles panels by target.
- Accepts a target->selector map and `setActive(target)` / `destroy()`.

**Refactor `SidePanelWidget`**
- Uses `PanelNavigation` instead of custom target handling.
- Accepts configurable targets at construction.
- Keeps minimize behavior here.

## Incremental Steps (Minimal Risk)
1. Extract `PanelNavigation` and update `SidePanelWidget` usage.
2. Add `ListModel` with adapters for scenes; no UI changes.
3. Add `ListView` and move render/event code into it.
4. Add `ListController` to wire everything together.
5. Replace `SceneEditorModal` with `ModalEditorView` + controller.

## Notes for Upcoming Features
- Characters/Outline/Themes each provide a small adapter only.
- The list, modal, and panel navigation code stays unchanged.

## Out of Scope (For This Refactor)
- Server routes and new models for characters/outline/themes.
- UI design changes unrelated to extraction.
