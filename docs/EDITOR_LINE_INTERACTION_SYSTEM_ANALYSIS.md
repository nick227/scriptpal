# Editor Widget Line Interaction System Analysis

## Scope
This document describes line-level user interaction behavior in the script editor, focused on Enter (carriage return), Tab, caret movement, and autocomplete acceptance.

Primary files analyzed:
- `public/js/widgets/editor/EditorWidget.js`
- `public/js/widgets/editor/EditorCoordinator.js`
- `public/js/widgets/editor/EditorInputController.js`
- `public/js/widgets/editor/keyboard/KeyboardManager.js`
- `public/js/widgets/editor/keyboard/KeyboardEditController.js`
- `public/js/widgets/editor/AutocompleteManager.js`
- `public/js/widgets/editor/LineFormatter.js`
- `public/js/widgets/editor/page/PageManager.js`

## System Roles
- `EditorWidget` composes subsystems. It does not implement line-key behavior directly.
- `EditorCoordinator` is the content orchestrator (model commands, render, focus intent, autocomplete suggestion refresh).
- `EditorInputController` wires DOM input and keyboard handling into `KeyboardManager`.
- `KeyboardManager` is the keydown dispatcher with strict priority order.
- `KeyboardEditController` performs Enter split, deletion, merge, and queued edit execution.
- `AutocompleteManager` tracks and accepts suggestions for `speaker` lines.
- `LineFormatter` creates line DOM and applies format classes; it is not the active keydown dispatcher.

## Event Pipeline (Line-Level)
1. User types/clicks in a `.script-line` contentEditable element.
2. `KeyboardManager` handles `keydown` at editor-area level (`EditorInputController.initialize`).
3. On `input`, `EditorCoordinator.syncLineContentFromDOM` updates the model for that line.
4. `EditorCoordinator` triggers autocomplete refresh checks on cursor move, focus in/out, and input.

Key references:
- `public/js/widgets/editor/keyboard/KeyboardManager.js:122`
- `public/js/widgets/editor/EditorInputController.js:61`
- `public/js/widgets/editor/EditorCoordinator.js:149`
- `public/js/widgets/editor/EditorCoordinator.js:569`

## Keydown Priority Order
In `KeyboardManager._handleKeyDown`, handling order is:
1. Global shortcuts (`Ctrl+S`)
2. Autocomplete
3. Navigation/edits (arrows, Enter, Tab, delete/backspace)
4. Formatting fallback

Reference: `public/js/widgets/editor/keyboard/KeyboardManager.js:122`

This order is critical because autocomplete handlers can run first but still allow later Tab/Enter logic to run.

## Enter (Carriage Return) Behavior
Current behavior:
- `Enter` is intercepted and prevented in `_handleEnter`.
- Line is split at caret position.
- Before-caret text stays in current line.
- After-caret text moves to newly inserted line.
- New line format:
- `Shift+Enter`: same format as current line.
- `Enter`: next format in flow via `lineFormatter.getNextFormatInFlow(...)`.

References:
- `public/js/widgets/editor/keyboard/KeyboardManager.js:284`
- `public/js/widgets/editor/keyboard/KeyboardEditController.js:48`

Insert behavior differences:
- End-of-script insertion may use incremental append when last page has room.
- Middle-of-script insertion generally triggers broader re-render path.

Reference: `public/js/widgets/editor/EditorCoordinator.js:629`

## Tab Behavior (Current)
Current Tab path:
1. If active autocomplete suggestion exists, `_handleAutocomplete` runs first.
2. For `Tab`, suggestion is accepted and `_autocompleteAccepted` flag is set.
3. Handler returns `false`, so processing continues.
4. `_handleNavigation` then handles `Tab` and calls `_handleTab`.
5. `_handleTab` moves focus to next/previous line (if exists).
6. If autocomplete was just accepted, target line is force-formatted to `dialog`.

References:
- `public/js/widgets/editor/keyboard/KeyboardManager.js:173`
- `public/js/widgets/editor/keyboard/KeyboardManager.js:297`

Implication for your scenario:
- Mid-script, pressing `Tab` on a line with suggestion accepts suggestion and then jumps to next line.
- End-of-script, if there is no next line sibling, no jump occurs.

This is exactly why Tab currently behaves as “accept + move” in the middle, instead of “accept only”.

## Enter + Autocomplete Interaction
When suggestion is active and user presses `Enter`:
- `_handleAutocomplete` accepts suggestion.
- Returns `false`, so normal Enter split still executes.

Reference: `public/js/widgets/editor/keyboard/KeyboardManager.js:189`

Net effect: Enter with active suggestion becomes "accept suggestion + split line".

## Autocomplete Mechanics
Autocomplete is currently speaker-only:
- Suggestion source is rebuilt from existing speaker lines (uppercase unique list).
- Suggestions apply only when line format is `speaker`.
- Suggestion is represented via `data-autocomplete-suffix` and `.has-autocomplete` class.
- Accepting suggestion writes full text into line, syncs DOM to model, moves caret to end.

References:
- `public/js/widgets/editor/EditorCoordinator.js:517`
- `public/js/widgets/editor/AutocompleteManager.js:74`
- `public/js/widgets/editor/AutocompleteManager.js:107`

## Navigation Boundary Behavior
`PageManager.getNextLine` and `getPreviousLine` use DOM siblings only.
- They do not resolve cross-page neighbors.
- At page boundaries, arrow/tab navigation can stop if no sibling in the same container context.

Reference: `public/js/widgets/editor/page/PageManager.js:127`

## LineFormatter Actual Role vs Expected Role
`LineFormatter` does line creation and format class operations.
- It has `setKeydownHandler`, but this is currently unused in the active architecture.
- Key handling is delegated through `KeyboardManager` on editor-area.

References:
- `public/js/widgets/editor/LineFormatter.js:43`
- `public/js/widgets/editor/keyboard/KeyboardManager.js:75`

## Behavior Gaps Relevant to Rule Design
1. Tab acceptance conflict:
- Autocomplete acceptance on Tab does not terminate key processing.
- Result: acceptance followed by navigation jump.

2. Tab formatting fallback appears unreachable:
- `_handleNavigation` always consumes Tab and returns true.
- `_handleFormatting` Tab branch (indent/unindent) is effectively bypassed.

References:
- `public/js/widgets/editor/keyboard/KeyboardManager.js:297`
- `public/js/widgets/editor/keyboard/KeyboardManager.js:385`

3. Autocomplete side effect on target line:
- After Tab acceptance, target line is forced to `dialog` format.
- This creates implicit formatting mutation unrelated to target content.

Reference: `public/js/widgets/editor/keyboard/KeyboardManager.js:304`

## Suggested Rule Baseline (for upcoming implementation)
Use this as the intended contract before code changes:

1. `Tab` with active suggestion:
- Accept suggestion only.
- Do not move focus.
- Do not alter adjacent line format.

2. `Enter` with active suggestion:
- Accept suggestion first.
- Then apply normal Enter split logic (if desired), or define explicit alternative.

3. `Tab` without active suggestion:
- Decide one global behavior: navigation vs indent.
- Do not mix both in same key path.

4. Middle vs end-of-script:
- Keep key semantics consistent.
- End-of-script should differ only in absence of a next line, not in intent.

## Summary
Current architecture is cleanly separated, but Tab key semantics are conflicting because autocomplete and navigation both execute in the same keydown cycle. That conflict is the direct cause of "accept suggestion then jump" when editing in the middle of the script.
