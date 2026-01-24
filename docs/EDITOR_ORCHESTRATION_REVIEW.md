# Editor Orchestration Review (Quick)

## What’s Actually Broken
- Chat can fire append before editor + orchestrator exist.
- Append attempts silently no-op (`hasOrchestrator: false`).
- Init relies on timing, not signals.
- Warnings mask real failures.

## Root Causes
- Orchestrator wired once, too early.
- No single source of truth for “editor ready”.
- Append is fire-and-forget, not durable.

## Required Fixes (In Order)
1. **Explicit wiring**
   - Wire orchestrator on editor-ready.
   - Wire on script-selected.
   - Auth-init is optional.
2. **Append queue**
   - Buffer AI append payloads.
   - Replay on editor-ready + script-present.
3. **Single readiness gate**
   - One `EDITOR_READY` signal.
   - All chat → editor ops gated on it.
4. **Warning hygiene**
   - Suppress chat-history warnings when idle or no script.

## What You Already Fixed
- Rewired orchestrator on `EDITOR_AREA_READY`.
  - ✅ Mitigates late editor init.
  - ❌ Does not solve dropped appends.

## Clear Next Step (Minimal, High-Impact)
- Add a tiny append queue in `ChatManager` (or `ScriptOperationsHandler`).
- Hard-fail append when no script is selected (user-visible message).
