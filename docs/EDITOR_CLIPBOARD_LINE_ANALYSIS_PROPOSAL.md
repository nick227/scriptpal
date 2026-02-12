# Editor Clipboard (Cut/Copy/Paste) Deep Dive and Proposal

## Scope
This analysis focuses on editor-level cut/copy/paste within the script editor, especially with multi-line selection and format preservation.

Primary code paths reviewed:
- `public/js/widgets/editor/keyboard/KeyboardManager.js`
- `public/js/widgets/editor/keyboard/KeyboardSelectionController.js`
- `public/js/widgets/editor/EditorInputController.js`
- `public/js/widgets/editor/EditorCoordinator.js`
- `public/js/widgets/editor/EditorDocumentService.js`
- `public/js/widgets/editor/model/ScriptDocument.js`
- `public/js/widgets/editor/handlers/EditorSelectionManager.js`
- `public/js/widgets/editor/page/PageManager.js`
- `public/js/widgets/editor/constants.js`

## Short Answer: Is this possible and advisable?
Yes, and yes.

- **Possible**: The command/document model already supports line-structured operations (`ADD`, `EDIT`, `DELETE`, `MERGE_LINES`) and can preserve line `format + content` cleanly.
- **Advisable**: Current behavior relies on browser defaults for clipboard and does not provide deterministic script-editor semantics. This creates correctness risk and user inconsistency.

## Current State (What Exists Today)

### 1) No explicit clipboard handling
`EditorInputController` listens to `focusin`, `focusout`, and `input`, but not `copy`, `cut`, or `paste`.
- `public/js/widgets/editor/EditorInputController.js:61`
- `public/js/widgets/editor/EditorInputController.js:77`

`KeyboardManager` global shortcuts currently only handles `Ctrl+S`.
- `public/js/widgets/editor/keyboard/KeyboardManager.js:153`

There is no editor contract today for Ctrl/Cmd+C, Ctrl/Cmd+X, Ctrl/Cmd+V.

### 2) Multi-select exists, but only deletion is integrated
`KeyboardSelectionController` tracks line selections using `.selected` classes and a start/end pointer.
- `public/js/widgets/editor/keyboard/KeyboardSelectionController.js:34`
- `public/js/widgets/editor/keyboard/KeyboardSelectionController.js:151`

`KeyboardManager._handleDelete` consumes range selection and calls `deleteSelectedLines`.
- `public/js/widgets/editor/keyboard/KeyboardManager.js:302`
- `public/js/widgets/editor/keyboard/KeyboardManager.js:310`

This is the only operation that uses the multi-select line set end-to-end.

### 3) Selection model split (important)
There are two selection systems:
- Keyboard selection (`.selected` classes): `KeyboardSelectionController`
- DOM semantic selection manager (`EditorSelectionManager`) with start/end offsets

`EditorSelectionManager` is mostly not wired into keyboard editing flow.
- `public/js/widgets/editor/handlers/EditorSelectionManager.js:23`
- `public/js/widgets/editor/handlers/EditorSelectionManager.js:64`

### 4) Source of truth during typing is DOM-first sync
On input, DOM text is read and synced into model via `syncLineContentFromDOM`.
- `public/js/widgets/editor/EditorCoordinator.js:188`
- `public/js/widgets/editor/EditorCoordinator.js:569`

This is workable for typing, but for clipboard operations it is better to make mutation intent explicit and model-driven.

### 5) Document layer can preserve formatting already
`EditorDocumentService` command model supports line `format` and `content` in structured commands.
- `public/js/widgets/editor/EditorDocumentService.js:186`
- `public/js/widgets/editor/EditorDocumentService.js:268`
- `public/js/widgets/editor/EditorDocumentService.js:249`

`ScriptDocument` persists line-level structured format/content as JSON.
- `public/js/widgets/editor/model/ScriptDocument.js:252`

This is the right substrate for formatted clipboard operations.

## Why Clipboard Is Fragile Right Now

1. Browser-default clipboard behavior is driving outcome.
- No editor intent layer for copy/cut/paste.

2. Multi-line visual selection is not equal to clipboard range selection.
- `updateRange` focuses/selects the end line contents, not the entire selected-line block as a semantic clipboard payload.
- `public/js/widgets/editor/keyboard/KeyboardSelectionController.js:81`

3. No format-aware clipboard serialization.
- No custom MIME or internal structured payload.

4. No atomic transaction semantics for clipboard edits.
- Paste/cut can involve many line mutations; today there is no dedicated transaction contract for this path.

## Format Preservation: How to Do It Safely

### Clipboard payload strategy (recommended)
Write two formats on copy/cut:
- `application/x-scriptpal-lines+json` (internal, format-preserving)
- `text/plain` (external compatibility)

Suggested internal payload:
```json
{
  "version": 1,
  "type": "scriptpal-lines",
  "lines": [
    { "format": "speaker", "content": "JOHN" },
    { "format": "dialog", "content": "I never left." }
  ]
}
```

Notes:
- Do not preserve original `id` values when pasting; let insert create new IDs.
- Preserve line order and exact `format + content`.

### Paste resolution
On paste, resolve in order:
1. If `application/x-scriptpal-lines+json` exists and valid -> format-preserving line insert/replace.
2. Else parse `text/plain`.

Plain text paste rules:
- Single-line paste into caret: inline insert into current line content.
- Multi-line plain text paste: split into lines, assign first line to current insertion point, create additional lines using either:
- current line format for all inserted lines (simple mode), or
- format inference via explicit parser policy (advanced mode).

## Impact on Other Lines and Systems

### Line/index/page impacts
Cut/paste shifts document indices and can reflow pages.
- Page boundaries already rely on sibling traversal and are fragile around structural edits.
- `public/js/widgets/editor/page/PageManager.js:127`

Expected side effects:
- Neighbor line indices change.
- Pagination/redistribution runs after render updates.
- Focus target must be explicitly restored.

### Autocomplete impacts
Speaker suggestions derive from document lines and refresh after command application.
- `public/js/widgets/editor/EditorCoordinator.js:517`
- `public/js/widgets/editor/EditorCoordinator.js:396`

Clipboard operations that add/remove speaker lines will correctly affect suggestions if routed through `applyCommands`.

### History/undo impacts
Clipboard should be one atomic undo step for one user action.
Current command batch history integration is in `EditorWidget.applyCommands` (AI path), not necessarily used by keyboard edit flows.
- `public/js/widgets/editor/EditorWidget.js:1159`
- `public/js/widgets/editor/history/EditorHistory.js:226`

If clipboard bypasses command batching, undo granularity will feel broken.

### Formatting side effects
Formatting should never be modified as a side-effect of clipboard ingestion except by explicit policy.
- Preserve source line format when internal payload exists.
- Never auto-shift adjacent lines just because paste occurred.

## Proposal: Clipboard Intent Layer

## Architecture changes
Add `EditorClipboardController` (new component owned by `EditorInputController` or `KeyboardManager`):
- Handles `copy`, `cut`, `paste` events.
- Converts selection state -> clipboard payload.
- Converts clipboard payload -> document commands.
- Enforces one keypress/clipboard event = one resolved intent.

### New intents
- `clipboardCopy`
- `clipboardCut`
- `clipboardPaste`

Execution owner should be single dispatcher (same principle as keyboard intent ownership).

## Selection contract for clipboard
Define precedence clearly:
1. If `.selected` line-range exists (`KeyboardSelectionController.hasRangeSelection`) -> line-block operation.
2. Else use DOM caret/range in current line -> inline operation.

This avoids ambiguity between visual line-selection and text-range selection.

## Command mapping

### Copy
- No model mutation.
- Build payload from selected line IDs (or inline substring).

### Cut
- Copy payload first.
- Then execute one command batch:
- Line mode: `DELETE` commands for selected line IDs.
- Inline mode: one `EDIT` (or split + merge sequence if multi-line DOM range).

### Paste
- Intercept browser paste and prevent default.
- Parse payload.
- Execute one command batch:
- Replace selection if active.
- Insert lines at caret/anchor.
- Preserve source formats for internal payload.
- Set deterministic focus/caret after completion.

All clipboard mutations should route through `EditorCoordinator.applyCommands` so `contentPersist`, rerender, and suggestion refresh remain unified.
- `public/js/widgets/editor/EditorCoordinator.js:362`

## Reliability and Concern Areas

1. **Cross-page traversal**
Current next/previous line logic uses siblings only and can fail at page edges.
- `public/js/widgets/editor/page/PageManager.js:127`

Recommendation:
- For clipboard line operations, resolve by document line index (`EditorDocumentService`) instead of sibling traversal.

2. **Dual selection systems**
Keyboard-selected lines and DOM range selection can diverge.

Recommendation:
- Normalize into one `SelectionSnapshot` object before clipboard intent execution.

3. **Large pastes**
Thousands of lines can trigger expensive full renders.

Recommendation:
- Batch commands, prefer incremental render when possible, and cap synchronous UI blocking.

4. **Clipboard security/API constraints**
`navigator.clipboard` write/read may be permission-limited in some browsers.

Recommendation:
- Primary path: event `clipboardData` in `copy/cut/paste` handlers.
- Secondary async clipboard API fallback.

## Suggested Phased Rollout

1. **Phase 1 (safe baseline)**
- Add explicit `copy/cut/paste` event handlers.
- Support line-block copy/cut/paste using `.selected` lines.
- Preserve format for internal copy/paste MIME.
- Ensure one action = one command batch.

2. **Phase 2 (inline precision)**
- Support partial line selection copy/cut/paste via offset-based selection snapshot.
- Define deterministic replacement behavior for mixed single/multi-line selections.

3. **Phase 3 (hardening)**
- Cross-page logical navigation helper.
- Performance optimizations for big pastes.
- Expanded tests.

## Test Contract (must-have)

1. Copy selected lines -> paste keeps same line formats/content.
2. Cut selected lines -> removed from model + undo restores exactly.
3. Paste internal payload in middle of script -> only intended insertion/replacement changes.
4. Paste at end of script -> same semantics as middle, only insertion index differs.
5. Plain text paste from external source -> deterministic formatting policy applied.
6. Multi-line selection + paste -> single undo step.
7. Speaker-line clipboard edits update autocomplete suggestions correctly.

## Final Recommendation
Implement clipboard as a first-class, model-driven intent system (not browser-default side effects). The existing document command architecture is strong enough to support this cleanly, and doing so will materially improve reliability, predictability, and formatting integrity.


V1 Clipboard Feature: “Copy Line Including Leading Break”
Goal

User can:

👉 Place caret anywhere in a line
👉 Press Ctrl/Cmd+C
👉 Paste elsewhere
👉 Result is a full new line inserted (same format + content)

No multi-line selection yet. No inline substring logic yet.

Behavior Rules (V1)

Copy with no selection = copy whole line

Copied payload includes:

Line content

Line format

A virtual leading newline

Paste inserts a new line at caret position

Pasted line keeps original format

Caret moves to end of pasted line

Undo restores to pre-paste state in one step

That’s it.

Internal Clipboard Payload (V1)
{
  "type": "scriptpal-line",
  "version": 1,
  "line": {
    "format": "dialog",
    "content": "I never left."
  }
}


Still also write text/plain:

I never left.

Paste Semantics

When payload type = scriptpal-line:

INSERT_LINE_AFTER(currentLine)


(or before if caret is at column 0 — optional)

No splitting. No merging. No inference.

Why This Is High ROI

Removes constant arrow-key navigation

Teaches users clipboard works “smartly”

Builds foundation for multi-line later

Avoids all selection complexity

Minimal Implementation Steps

Intercept copy event

If no DOM selection:

Get active line id

Serialize {format, content}

Intercept paste

If payload type matches:

Issue command:

ADD_LINE_AFTER(anchorLineId, format, content)


Focus new line

Explicitly Out of Scope (for now)

Partial text selection

Multi-line selection

External formatted pastes

Result

You cross the clipboard threshold with:

~100 lines of code

Zero risk to existing typing behavior

Big perceived UX upgrade

Once this feels solid, you can safely expand to multi-line later.

If you want, next we can sketch the exact command object shape for ADD_LINE_AFTER and where it plugs into EditorDocumentService.