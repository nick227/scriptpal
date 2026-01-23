# Pub/Sub Refactor Proposal (Front End)

This proposal responds to the current pub/sub critique and outlines a scoped, incremental refactor. It avoids a rewrite and targets clearer ownership, fewer buses, and explicit flow orchestration.

## Goals

- Make event ownership obvious and contracts explicit.
- Reduce fan‑out and hidden coupling.
- Separate commands, state changes, and notifications.
- Keep changes incremental and low‑risk.
- Prevent new “god objects” and cross‑widget coupling.

## Current Issues (Observed)

- Three overlapping systems (EventManager, StateManager, DOM listeners).
- Events mix commands, state, and notifications.
- Immediate StateManager callbacks cause ordering surprises.
- High fan‑out on `CURRENT_SCRIPT`, `AI:RESPONSE_RECEIVED`, etc.
- Subscription lifetimes are hard to audit.
- Workflow sequencing is implicit and hidden.

## Proposed Direction (No Rewrite)

### 1) Separate Concerns by Channel

- **Commands**: direct method calls on domain orchestrators.
- **State**: StateManager only, for data modeling and reactive UI.
- **Notifications**: EventManager only, for “this happened” signals.

### 2) Introduce Domain Orchestrators

Create one orchestrator per domain to own sequencing:

- `ScriptOrchestrator` (script load, select, create, delete, hydrate)
- `ChatOrchestrator` (chat request flow, history load, AI response routing)
- `AuthOrchestrator` (login/logout/register and session effects)

These orchestrators become the only components allowed to dispatch cross‑domain events.

#### Orchestrator Guardrails

- Orchestrators **coordinate** steps only.
- Business rules and transformations live in pure services/modules.
- Orchestrators do not own data shaping or validation.
- Split large workflows into small, named service calls.

### 3) Normalize Event Types

Adopt a consistent naming contract:

- `INTENT:*` (temporary, only during transition)
- `DOMAIN:EVENT` for notifications
- No `REQUEST_*` after refactor

Example:

- `SCRIPT:SELECTED` (notification)
- `SCRIPT:CREATED`
- `CHAT:MESSAGE_ADDED`

### 4) Reduce Fan‑Out

Replace broadcast events with higher‑level signals:

- Replace multiple `AI:RESPONSE_RECEIVED` consumers with:
  - `CHAT:MESSAGE_ADDED` for chat UI only
  - `EDITOR:INSERT_COMPLETED` for editor only

### 5) Make Flow Explicit

Move pipeline flows into orchestrators:

`Script select → load → hydrate → update UI → load chat → persist`

Each step is a direct method call within the orchestrator, not a chain of events.

### 6) Audit Subscription Lifetime

Add explicit ownership per subscription:

- Widgets subscribe via `BaseWidget` and clean up on `destroy`.
- Controllers and managers subscribe only from orchestrators.
- Avoid “global singleton” listeners unless required.

### 7) Add State Subscription Semantics

Current `StateManager.subscribe` invokes immediately, which mixes hydration and change.
Add explicit semantics:

- `subscribe(key, { immediate: false })` for change‑only callbacks
- Or split `hydrateState` (initial) vs `setState` (changes)

### 8) Scope Notifications

Notifications should carry scope to reduce blast radius:

```
{ scope: { userId?, scriptId? } }
```

Prefer domain‑local subscriptions; cross‑domain listens require justification.

### 9) Ban Cross‑Widget Coordination

Widgets never coordinate with each other via events.
Widgets react to **state only**.

## Incremental Migration Plan

### Phase 1 — Contracts and Ownership
- Add `ScriptOrchestrator` that wraps existing `ScriptsController` flows.
- Convert `SCRIPT:SELECT_REQUESTED` to direct call from widgets.
- Leave `SCRIPT:SELECTED` as the only notification.

### Phase 2 — Chat + AI Routing
- Introduce `ChatOrchestrator` that owns:
  - send → API → response → UI render
  - history load
  - system prompts
- Replace `CHAT:REQUEST_*` with direct calls.
- Keep `CHAT:MESSAGE_ADDED` as notification.

### Phase 3 — State-Driven UI Only
- Ensure UI widgets rely on `StateManager` for data.
- Remove UI‑action events that are now commands.

### Phase 4 — Event Cleanup
- Remove deprecated events and handlers.
- Stabilize naming and document contracts.

### Phase 5 — Enforce Guardrails
- Enforce scoping on EventManager payloads.
- Enforce “orchestrators only” publish rule.
- Enforce “no widget‑to‑widget events” rule.

## Example Changes (Targeted)

### Current
- `SCRIPT:SELECT_REQUESTED` (command)
- `SCRIPT:SELECTED` (notification)
- `CURRENT_SCRIPT` (state)

### Proposed
- `ScriptWidget` calls `ScriptOrchestrator.selectScript(scriptId)`
- `ScriptOrchestrator` updates state, then publishes `SCRIPT:SELECTED`
- UI subscribes to `CURRENT_SCRIPT` for rendering

## Risks and Mitigations

- **Risk**: Large fan‑out behavior changes.
  - Mitigation: isolate per‑domain orchestrator and add tests per flow.

- **Risk**: Hidden dependencies on old event names.
  - Mitigation: deprecate events in phases, keep telemetry logs during transition.

- **Risk**: Orchestrators becoming God objects.
  - Mitigation: orchestrators only coordinate; move logic to pure services.

- **Risk**: Immediate state subscription side effects.
  - Mitigation: add `immediate: false` option or split hydration from updates.

- **Risk**: Notifications still broadcast globally.
  - Mitigation: enforce scoped payloads and domain‑local subscriptions.

## Deliverables

- Orchestrator classes per domain.
- Updated widgets calling orchestrator methods for commands.
- Reduced EventManager surface (notifications only).
- Updated docs with event and state contracts.
- StateManager subscription semantics for hydration vs updates.
- Notification scope conventions in EventManager.
- A rule set that forbids widget‑to‑widget event coordination.

## Success Criteria

- Fewer event names and fewer subscription sites.
- Each domain has a single explicit flow owner.
- Event usage is “this happened,” not “please do X.”
- Debugging a flow no longer requires grepping multiple events.
- Enforced limits: per‑event subscriber cap, per‑domain event cap.
- No widget listens to another widget’s events.
