# AI Markup Reintegration Map

## Goal
Re-enable AI output with custom script tags (e.g., `<speaker>Nick</speaker>`) across AI-generated content so formatting is explicit, consistent with the site-wide format list, and no longer dependent on heuristics.

## Current State Summary (for context)
- Append-page flow forces **plain text only** (no tags) and rejects `<`/`>` in output.
- The frontend append path infers format using regex heuristics and defaults to `action`.
- Edit/write flow already expects **tagged** values via command schema.

## Target State
- Append-page responses include script tags that match the shared format list.
- The frontend uses tag parsing (not heuristics) when tags are present.
- All script formats remain consistent across frontend and backend.

## Changes Required (by area)

### 1) Server: Append-page chain prompt + validation
**Files**
- `server/controllers/langchain/chains/edit/AppendPageChain.js`

**Changes**
- Update `SYSTEM_INSTRUCTION` to require XML-style tags from the approved list (header, action, speaker, dialog, directions, chapter-break).
- Update `validateAppendText`:
  - Remove the check that rejects `<` or `>` characters.
  - Add validation that each non-empty line is a valid tagged line.

**Why**
- This enables deterministic format output and aligns AI output with the tag-based storage format.

### 2) Server: Append-page service response expectations (if any)
**Files**
- `server/controllers/script-services/AppendPageService.js`

**Changes**
- Ensure it does not post-process or strip tags.
- Confirm any downstream parsing expects tags and passes through raw content.

**Why**
- Preserve tag integrity from the chain through to the client.

### 3) Frontend: Append formatting (prefer tags when present)
**Files**
- `public/js/managers/ScriptOrchestrator.js`

**Changes**
- In `handleScriptAppend`, detect tagged lines:
  - If a line is tagged, parse `<tag>content</tag>` and use the tag as `format`.
  - Only fall back to `determineContentFormat` when a line is untagged.

**Why**
- Tags should be authoritative; heuristics only for legacy or malformed lines.

### 4) Frontend: Shared format list alignment
**Files**
- `public/js/constants/formats.js`
- Any server-side format list used by validation or parsing

**Changes**
- Ensure the allowed tag names in AI prompts and validators are drawn from the same list as `VALID_FORMATS`.
- If server and client lists differ, consolidate or document the canonical list.

**Why**
- The user requirement is site-wide consistency. Tag lists must not drift.

## Optional Hardening (Recommended if you agree)
- Add a single utility for tag parsing (shared by append and edit flows) to avoid duplication.
- Centralize tag validation so invalid tags fail fast server-side and do not reach the editor.

## Expected Impact
**Pros**
- Significant accuracy improvement for dialog vs action classification.
- Reduced reliance on heuristics.
- Consistent formatting across append and edit/write paths.

**Cons**
- AI must reliably output correctly tagged lines.
- Validation updates are required to accept tagged output.

## Implementation Order (low risk to high)
1) Update `AppendPageChain` prompt + validator.
2) Update frontend append to prefer tags.
3) Align/centralize format list references.

## Validation Plan
- Generate append-page output and confirm:
  - No validation errors on tagged lines.
  - Lines render in editor with correct format classes.
  - Stored JSON includes correct `format` per line.

