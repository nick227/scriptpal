# Screenplay Editor Code Analysis

## Scope
This document summarizes the current screenplay editor implementation, its
features, and the rough code shape. It focuses on the runtime editor, line
formatting flow, and interaction behavior (keyboard/mouse).

## Editor architecture at a glance
- `EditorWidget` is the orchestrator. It builds and wires core components
  (`EditorContent`, `EditorDOMHandler`, `LineFormatter`, `PageManager`,
  `EditorSaveService`, `EditorHistory`, etc.), then sets up event wiring.
- `EditorContent` is the runtime content manager. It initializes the editor
  area, registers delegated event listeners, manages keyboard handling, and
  exposes `updateContent`/`applyCommands`.
- `EditorDOMHandler` owns DOM rendering, page integration, line creation, and
  cursor/focus events. It also serializes the editor content.
- `KeyboardManager` handles line navigation, line selection, editing commands,
  and format switching logic.
- `LineFormatter` centralizes format validation, format changes, and line
  creation behaviors. It uses the `FORMAT_FLOW` constants as the primary
  “next format” logic.

## Line formats and flow
The editor is built around a fixed set of line formats:
`header`, `action`, `speaker`, `dialog`, `directions`, `chapter-break`.

The default flow is centralized in `public/js/constants/formats.js`:
- `header → action`
- `speaker → dialog`
- `dialog → speaker`
- `directions → dialog`
- `chapter-break → header`

This creates the screenplay pattern the UI encourages, especially the
`speaker → dialog → speaker → dialog` loop. The user can still switch line
types on demand via keyboard or mouse.

## Current editor features
### Editing and navigation
- **Enter creates a new line** and uses format flow to set its format.
- **Shift+Enter keeps the current format** when creating a new line.
- **Arrow Up/Down** navigates to previous/next line.
- **Tab** moves to next/previous line (Shift+Tab).
- **Clicking** sets selection/focus; Shift+Click selects a range.
- **Multi-line selection** (Shift+Arrow) highlights a range of lines.

### Line format changes
- **Ctrl+Arrow** cycles line format (left/up = previous, right/down = next).
- **Left/Right arrows at line edges** change the line format.
- **Tab** can also cycle formats depending on handler order.
- **Toolbar format dropdown** lets mouse users switch the active line format.
- `LineFormatter` validates formats and updates classes/data attributes.

### Content serialization and parsing
- The DOM is serialized into XML-like tagged content:
  `<header>...</header>`, `<dialog>...</dialog>`, etc.
- `EditorDOMHandler` parses these tags when loading existing content.
- Line content is stored as `div.script-line` elements with
  `data-format="<format>"`.

### Page and rendering behavior
- `PageManager` is used for line insertion and removal across pages.
- `EditorDOMHandler` creates pages and renders content in chunks.
- `EditorContent` maintains chunked rendering helpers for large scripts.

### Undo/redo and auto-save
- `KeyboardManager` wires Ctrl+Z/Ctrl+Y to history.
- `EditorSaveService` can be triggered on line changes.

## How the editor handles the “line type” model
1. **Line format constants** live in `public/js/constants/formats.js`.
2. **Format flow** is applied by `KeyboardManager` and `LineFormatter`.
3. **DOM representation** uses `data-format` + `format-<type>` class.
4. **Serialization** writes XML tags; parsing reads them back in.

This is where the “heading → character → dialog → character → dialog” behavior
comes from: `header → action` is a scene header start; `speaker ↔ dialog`
creates the alternating character/dialog loop.

## Primary file map (rough shape)
- `public/js/widgets/editor/EditorWidget.js`  
  Component orchestration, initialization, and event wiring.
- `public/js/widgets/editor/EditorContent.js`  
  DOM event delegation, content update/apply logic, and keyboard manager setup.
- `public/js/widgets/editor/handlers/EditorDOMHandler.js`  
  DOM creation, focus management, content render/parse, and selection.
- `public/js/widgets/editor/keyboard/KeyboardManager.js`  
  Keyboard navigation, selection, format changes, and line operations.
- `public/js/widgets/editor/LineFormatter.js`  
  Format validation, format application, and line creation helpers.
- `public/js/constants/formats.js`  
  Valid formats + flow rules used by editor components.

## Notable event flow (rough)
- User input → `KeyboardManager` → line change → `EditorContent` emits
  `CONTENT_CHANGE` → autosave/history hooks run.
- Format change → `LineFormatter` updates line DOM + state manager →
  `EditorContent` emits `FORMAT_CHANGE`.

## Notes
- Format detection exists for imported content, but normal editing uses the
  explicit format flow and `data-format` on each line.
- The editor relies on delegated event handling on `.editor-area` to avoid
  per-line listeners.

## Core problems
- DOM is the source of truth instead of a document model.
- Lines have no stable IDs (position-based only).
- Format-flow logic is interpreted in multiple places.
- Serialization format is doing too much (storage + logic).

## Why this matters
- AI command-based edits will fight the DOM.
- Undo/redo becomes brittle.
- Partial (page/line) updates are unreliable.
- Collaboration is blocked.

## Missing piece
Thin document model:

ScriptDocument { lines[] }

ScriptLine { id, format, content }

## Minimal fix
- Assign stable lineIds.
- Keep DOM as a renderer, not the model.
- Have LineFormatter return commands, not DOM mutations.
- Apply commands to the document, then re-render.
