# Scenes Feature Post-Op Analysis

## Overview
Scenes are implemented as planning metadata tied to scripts, with independent CRUD + ordering and a grid-based UI that supports a small panel and a full-screen modal. The feature is intentionally non-authoritative to script content.

## Goals Met
- Schema added for scenes with title, description, notes, tags, and sort index.
- Script ownership enforced for all scene routes.
- Scene browser widget supports add, edit, delete, and drag reordering.
- Two display sizes: side panel and full-screen modal.

## Key Behavior Notes
- Scenes remain separate from script content. No script lines are mutated by scene actions.
- Reorder updates scene sort indexes only.
- No auto sync between script edits and scenes.

## Technical Summary
- Backend: new `Scene` model, migration, controller, and routes.
- Front-end: new scene store/controller, new widgets (browser + editor modal), new API methods, and new state keys.
- Layout: side panel navigation now toggles Scripts vs Scenes.

## UX Observations
- Grid tiles are readable and sortable.
- Add/edit flow uses a dedicated modal to avoid cluttering the grid.
- Full-screen modal uses the same grid and actions to keep behaviors consistent.

## Risks / Follow-ups
- Tags are stored as JSON; UI uses comma-delimited inputs. No validation beyond trimming.
- Reorder requires the current script selection; no fallback behavior.
- The editor modal uses a simple form and does not validate minimum content beyond title.
- Sort index has no guardrails (gaps, collisions, negative values).
- No optimistic locking on reorder.
- No recovery when script context is lost.
- No batch reorder or undo.

## UX / Interaction Gaps
- No inline rename.
- No quick tag toggle.
- No keyboard-first flow (add → name → enter).
- No bulk actions (delete, tag, archive).
- No visual state for “unscheduled / inactive”.

## Future Considerations
- Optional AI actions should remain append-only for script output.
- Consider per-tile quick-edit fields only if density becomes an issue.
- Add keyboard shortcuts for reorder/add when needed.
