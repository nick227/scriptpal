# Script Line Formatting Deep Dive

This document traces how script lines are formatted, stored, and rendered in the editor.
It focuses on the line type system (header/action/speaker/dialog/directions/chapter-break),
the keyboard/toolbar flows that change formats, and the save/load path used on reload.

## High-level flow

Editor content is stored as structured JSON lines. A full round trip looks like:

1. User edits a contenteditable `.script-line` div with a `data-format`.
2. `EditorContent.syncLineContentFromDOM()` updates `ScriptDocument` (line id, format, text).
3. `ScriptDocument.toStorageString()` serializes JSON `{ version, lines: [...] }`.
4. `EditorSaveService` schedules a patch via `ScriptStore.queuePatch()`.
5. `ScriptStore.updateScript()` passes structured JSON through without mutation.
6. On reload, `ScriptDocument.fromStorage()` parses JSON into lines and re-renders via `EditorDOMHandler` + `EditorRenderer` + `LineFormatter`.

## Format types and styling

Format definitions live in `public/js/constants/formats.js`. The canonical values are:

`header`, `action`, `speaker`, `dialog`, `directions`, `chapter-break`

Each format is rendered by a `.script-line` with a matching CSS class:

```269:389:public/css/components/editor.css
.script-line {
    min-height: var(--line-height-loose);
    padding: var(--spacing-xs) 0;
    /* ... */
}
.script-line.format-header { text-transform: uppercase; font-weight: bold; }
.script-line.format-action { margin: 0 0 var(--spacing-sm) 0; }
.script-line.format-speaker { margin-left: var(--speaker-left); text-transform: uppercase; }
.script-line.format-dialog { margin-left: var(--dialog-left); }
.script-line.format-directions { font-style: italic; text-align: right; }
.script-line.format-chapter-break { padding-left: 90px; background: var(--color-bg-light); }
.script-line.format-chapter-break::after { content: 'CHAPTER: '; font-weight: bold; }
```

Note: CSS contains `.script-line.format-break` but no JS uses a `break` format.

## Where formats are defined and validated

The central format constants and state machine live in `public/js/constants/formats.js`:

- `VALID_FORMATS` and `VALID_FORMAT_VALUES`
- `DEFAULT_FORMAT` (action)
- `FORMAT_FLOW` and `getNextFormat()` (the auto-flow for Enter / cycle)

`LineFormatter` wraps this and is used by the renderer and format commands:

```66:92:public/js/constants/formats.js
export const FORMAT_FLOW = Object.freeze({
    header: 'action',
    action: 'action',
    speaker: 'dialog',
    dialog: 'speaker',
    directions: 'dialog',
    'chapter-break': 'header'
});
```

## Line creation and DOM structure

The renderer creates a line DOM element for each `ScriptDocument` line:

- `EditorRenderer._createLineElement()` calls `LineFormatter.createFormattedLine(format)`.
- `LineFormatter.createFormattedLine()` creates a `div.script-line`, sets `data-format`,
  and applies `.format-{format}`.

```643:662:public/js/renderers.js
const lineElement = this.lineFormatter.createFormattedLine(format);
lineElement.dataset.lineId = line.id;
lineElement.textContent = line.text;
```

Each line is `contenteditable` and expected to hold its format in `data-format`.

## Format change entry points

### Toolbar selection

Toolbar format selection uses `EditorToolbar` to call
`EditorContent.setCurrentLineFormat(format)`, which applies the command to both
document and DOM.

```564:568:public/js/widgets/editor/EditorWidget.js
toolbar.onFormatSelected((format) => {
    content.setCurrentLineFormat(format);
});
```

### Keyboard format flow on Enter

Enter is handled in `KeyboardManager._handleEnter()` which advances format
using `LineFormatter.getNextFormatInFlow()` and inserts a new line with the new format.

```614:673:public/js/widgets/editor/keyboard/KeyboardManager.js
const currentFormat = scriptLine.getAttribute('data-format');
const newFormat = this.lineFormatter.getNextFormatInFlow(currentFormat, 1);
const newLine = await this.contentManager.insertLineAfter(lineId, {
    format: newFormat,
    content: afterText,
    updateCurrentContent: beforeText,
    focus: true
});
```

Shift+Enter keeps the same format.

### Shift + Arrow format cycling

`KeyboardManager._handleLineNavigation()` handles Shift+Arrow to cycle formats.
The cycle uses the same `getNextFormatInFlow()` helper.

```303:345:public/js/widgets/editor/keyboard/KeyboardManager.js
if (event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown' ...)) {
    const direction = (event.key === 'ArrowUp' || event.key === 'ArrowLeft') ? -1 : 1;
    const newFormat = this.lineFormatter.getNextFormatInFlow(currentFormat, direction);
    this._applyFormatCommand(scriptLine, newFormat);
}
```

### Arrow-left / Arrow-right at line boundaries

When the cursor is at the line start/end, left/right arrows also cycle format.

```452:480:public/js/widgets/editor/keyboard/KeyboardManager.js
if ((event.key === 'ArrowLeft' && isAtStart) || (event.key === 'ArrowRight' && isAtEnd)) {
    const newFormat = this.lineFormatter.getNextFormatInFlow(currentFormat, direction);
    this._applyFormatCommand(scriptLine, newFormat);
}
```

### Selection vs formatting

Shift+Arrow is reserved for format cycling; selection is handled by click + drag.

## Format changes applied to model + DOM

`EditorContent.applyFormatCommand()` is the central format change handler:

1. Update `ScriptDocument` line format.
2. Update DOM line via `EditorDOMHandler.updateLineById()`.
3. Emit `FORMAT_CHANGE` and save.

```539:560:public/js/widgets/editor/EditorContent.js
const updated = this.document.updateLine(command.lineId, { format: command.format });
this.domHandler.updateLineById(command.lineId, { format: command.format });
this.stateManager.setCurrentFormat(command.format);
this.debouncedContentUpdate();
```

## Save format (serialization)

Serialization is JSON-based:

```
{
  "version": 2,
  "lines": [
    { "id": "line_...", "format": "header", "content": "INT. HOUSE" }
  ]
}
```

`EditorSaveService` passes this JSON string to `ScriptStore`, which only runs
`ScriptFormatter` for non-structured content (imports or legacy strings).

```62:68:public/js/widgets/editor/save/EditorSaveService.js
const contentValue = this.scriptStore.normalizeContent(this.content.getContent());
this.scriptStore.queuePatch(scriptId, { content: contentValue }, 'editor');
```

`ScriptFormatter` also handles raw plain text input by converting to tags, but only
in the save pipeline.

## Load format (parsing on reload)

On reload, `ScriptDocument.fromStorage()` parses JSON content first.
Legacy tag parsing is only used for old scripts and import migration.

## Import formatting

The import path is `ScriptImportWidget` -> `ScriptImportManager`. Parsing is
stubbed out (no parser entries are registered), so import currently fails early.
If parsers were active, imported lines are mapped to valid formats and converted
to structured JSON lines.

```69:92:public/js/widgets/editor/ScriptImportManager.js
initializeParsers () { return []; }
...
if (!result) { throw new Error('No suitable parser found for the text'); }
```

## Rendering on page reload

When a script is reloaded:

1. `ScriptStore.loadScript()` fetches content.
2. `EditorWidget.loadInitialContent()` calls `EditorContent.updateContent()`.
3. `ScriptDocument.fromContent()` parses lines into `{id, format, content}`.
4. `EditorDOMHandler.renderDocument()` renders each line through the renderer.
5. `LineFormatter.createFormattedLine()` applies classes and `data-format`.

This means reformatting on reload only works if:

- The stored content is structured JSON.
- The formats are recognized by `VALID_FORMATS`.

## High-level verdict

You’ve diagnosed the problem correctly: almost all complexity and fragility comes from
persisting editor state as strings instead of structure. Everything downstream (regexes,
`ScriptFormatter`, reload bugs, `chapter-break` weirdness) is a symptom, not a cause.

## What is genuinely over-engineered

### 1. String round-tripping inside the editor lifecycle

You already have:

- a canonical in-memory model (`ScriptDocument`)
- deterministic rendering
- controlled mutation paths

Yet you do:

Model → string → normalize → parse → model

That’s unnecessary work whose only purpose is to defend against your own storage format.

Rule: If save/load requires “repair,” your persistence format is wrong.

### 2. `ScriptFormatter` in the save path

`ScriptFormatter` exists to:

- fix malformed tags
- normalize structure
- compensate for regex parsing

That should never be needed for editor-generated content.

Correct role for `ScriptFormatter`:

- import
- pasted raw text
- legacy migration

If the editor created it, it should be trusted.

### 3. Six format authorities

Formats are enforced by:

- DOM attributes
- `ScriptDocument`
- `LineFormatter`
- `ScriptFormatter`
- reload regex
- `VALID_FORMATS`

That’s six places enforcing the same invariant.

Robust systems validate once, early, then trust the model.

## What is still fragile even if you “fix” regex

### 1. Regex persistence is inherently unstable

Even `([\w-]+)` fails when:

- users paste `<` / `>`
- HTML fragments appear
- tags are partially deleted
- future format names change

This will never stop producing edge bugs.

### 2. `chapter-break` is structurally undefined

Right now it is:

- sometimes empty
- sometimes self-closing
- sometimes paired
- semantically structural but stored as text

That guarantees reload bugs.

You must decide:

- structural node (recommended)
- empty text line

Not both.

### 3. Import leaks instability into editing

Import is half-wired but shares:

- formatter
- normalization
- save pipeline

This means unfinished features destabilize core editing.

Imports must be isolated until they produce valid `ScriptDocument` JSON.

## The shortest path to reliability (minimal disruption)

### Step 1 — Make `ScriptDocument` canonical end-to-end

This is the root fix.

Persist structured data, not markup:

```
{
  "lines": [
    { "id": "l1", "format": "header", "text": "INT. HOUSE" },
    { "id": "l2", "format": "action", "text": "Lights flicker." }
  ]
}
```

Effects:

- reload becomes trivial
- regex parsing disappears
- formatting bugs collapse
- `chapter-break` can be explicit

## What to check when debugging (current system)

Use this checklist to locate formatting issues:

1. Is the line DOM element missing `data-format` or the `.format-*` class?
   (`LineFormatter.applyFormatToLine()` should apply both.)
2. Does the saved content contain legacy tag strings? If so, they rely on migration parsing.
3. Is the saved content plain text (no JSON)? If yes, reload falls back to defaults.
4. Are keyboard events firing in the editor area? (`KeyboardManager` is attached
   to `.editor-area` and expects `.script-line` targets.)
5. Is formatting done via toolbar? That uses `EditorContent.setCurrentLineFormat()`.
