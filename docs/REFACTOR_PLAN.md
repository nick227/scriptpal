# ScriptPal Major Refactor Plan

## Goals
- Simplify architecture into standard web-app concepts.
- Standardize module boundaries (data, domain, UI).
- Consolidate duplicated event and lifecycle systems.
- Remove custom "game-engine" abstractions with a hard deletion milestone.

## Current State (Key Findings)
- `public/js/core/Engine.js` drives a per-frame loop, but only `ChatScene` uses it for scroll checks.
- `public/js/core/Scene.js` and scene subclasses behave like view controllers, not game scenes.
- `Scene` does not define `emit`, yet `ChatScene` and `ScriptsScene` call `this.emit`, which will throw unless patched elsewhere.
- Two parallel patterns exist: custom scenes in `public/js/presentation/*` and event-driven widgets/managers in `public/js/widgets` and `public/js/managers`.
- Event infrastructure is centralized in `public/js/core/EventManager.js` but not consistently integrated.

## Target Architecture (Proposal)
- Replace "Engine/Scene" with a standard UI lifecycle manager:
  - `AppController` (init, teardown, route/screen switch).
  - Feature controllers for Editor, Chat, Scripts.
- Use event bus consistently:
  - One global `EventManager` instance owned by `AppController`.
  - Features subscribe/emit via the shared instance.
- Separate layers:
  - `data/` (API, persistence, stores).
  - `domain/` (orchestrators, command/query handlers).
  - `ui/` (widgets, renderers, controllers).
- No requestAnimationFrame or update loops:
  - Explicit triggers only: scroll, resize, mutation, API response, user input.
  - If a trigger cannot be named, the logic does not belong.

## Refactor Phases

### Phase 1: Inventory and Stabilization
- Audit entry points and wiring in `public/js/App.js` and `public/js/app.js`.
- Map all event flows using `EventManager.EVENTS` to identify required subscriptions.
- Add temporary adapters so current UI continues to work while refactor begins.
- Add tests for any `emit` usage in scenes to prevent regressions.

### Phase 2: Replace Engine/Scene
- Create `public/js/core/AppController.js`:
  - `init()`, `destroy()`, `setActiveView(name)`.
  - Own a single `EventManager` instance.
- Convert each scene to a controller:
  - `EditorScene` -> `EditorController`.
  - `ChatScene` -> `ChatController`.
  - `ScriptsScene` -> `ScriptsController`.
- Remove per-frame logic:
  - Replace `ChatScene.onUpdate` with event-driven triggers (scroll, resize, mutation).
  - No requestAnimationFrame. No update loops.
- Deletion milestone:
  - Phase 2 ends with zero references to `Engine` or `Scene`.
  - No compatibility layer survives Phase 3.

### Phase 3: Consolidate Event Handling
- Standardize all event publish/subscribe through `EventManager`.
- Remove direct DOM custom event usage where it duplicates `EventManager` events.
- Ensure every feature cleans up subscriptions on teardown.

### Phase 4: Module Consolidation
- Merge overlapping managers and widgets:
  - Identify redundant chat/editor managers and unify APIs.
- Normalize naming conventions and file locations:
  - `presentation/*` should live under `ui/*`.
  - `managers/*` and `application/*` should map to `domain/*`.
- Domain guardrails:
  - Domain never touches the DOM.
  - Domain emits events or returns commands; UI decides how to render.
  - If a "manager" violates this, split it.

### Phase 5: Cleanup and Deletion
- Delete unused layers and dead code.
- Update imports to new module paths.
- Run tests and update any snapshots.

## Proposed File Moves (Initial)
- `public/js/presentation/Editor/*` -> `public/js/ui/editor/*`
- `public/js/presentation/Chat/*` -> `public/js/ui/chat/*`
- `public/js/presentation/Scripts/*` -> `public/js/ui/scripts/*`
- `public/js/application/*` -> `public/js/domain/*`
- `public/js/managers/*` -> `public/js/domain/*` (merge where possible)

## Risks and Mitigations
- Risk: Event wiring regressions during removal of `Scene`/`Engine`.
  - Mitigation: introduce `AppController` first and swap wiring behind the same public API.
- Risk: DOM lifecycle changes break initialization order.
  - Mitigation: enforce explicit `init()` order and add smoke tests for each controller.

## Success Criteria
- No per-frame loop unless explicitly required.
- Single lifecycle owner for app startup, teardown, and view switching.
- Consistent event bus usage across UI, domain, and data layers.
- Reduced number of top-level concepts and directories.

## Recommended Refactor Order
- Introduce `AppController` (owns `EventManager`), initialize existing scenes/controllers unchanged.
- Convert one feature fully (Chat is ideal, already event-heavy).
- Delete `Engine.js` and `Scene.js` immediately after the second conversion.
- Normalize directory structure only after behavior is stable.
