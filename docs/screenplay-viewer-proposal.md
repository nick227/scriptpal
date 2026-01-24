# Screenplay Viewer Proposal

## Objective
Deliver a distraction-free public screenplay page that reuses the exact editor line layout, formatting rules, and styles already defined for script editing (no new markup or CSS). The existing viewer should stop dumping raw JSON into a `<pre>` block and instead render the script as `.script-line` elements via a read-only helper so public readers see the same polished typography without pulling in editor state or behaviors, while preserving the editor’s width, padding, and offset system so the viewer still feels like sitting inside the same page canvas.

## Key Reuse Points
- **Parsing & storage format**: `ScriptDocument.fromStorage` already handles JSON line payloads returned by the API, including legacy tag-based data. Reusing that parser keeps serialization logic centralized and prevents diverging formats.
- **DOM structure**: We should introduce a `LineFormatter.createStaticLine` helper (or similar) that manufactures `.script-line` nodes without editor listeners, `StateManager`, or `contentEditable`, ensuring read-only behavior.
- **Styles**: The `.script-line` rules (including format-specific adjustments) already live under `public/css/components/editor.css`. Reusing them avoids duplicating margins, fonts, or format-specific colors in a separate stylesheet. Wrap the viewer content in a semantic `.editor-page` container (e.g., `<div class="editor-page public-script-viewer">`) so rules scoped to `.editor-page .script-line` continue to apply.
- **Metadata UI**: Keep the metadata/title display, but drop the copy button so the distraction-free page doesn’t expose clipboard features or editor affordances.

## Proposed Implementation
1. Import or instantiate the necessary pieces inside `public/js/pages/publicScriptViewerPage.js`:
   - `ScriptDocument` (from `widgets/editor/model/ScriptDocument.js`) to parse stored script content.
   - `LineFormatter` (from `widgets/editor/LineFormatter.js`) and/or a new `LineFormatter.createStaticLine` helper to fabricate read-only `.script-line` DOM nodes without `StateManager`, listeners, or `contentEditable`.
2. After we fetch the script:
   - Parse `script.content` with `ScriptDocument.fromStorage(script.content || '')`.
   - For each parsed line, create a static `.script-line` node with the matching format and set its text content to the parsed `content`. Ensure each line is non-editable and free of editor events.
   - Append the rendered lines to `.public-script-viewer__content`, which should itself live inside something like `<div class="editor-page public-script-viewer">` so existing `.editor-page` styles stay intact, including the width, margins, and padding that define the editor page canvas so the public view visually aligns with the editor’s layout.
3. Keep the metadata display but remove the copy button entirely so the viewer stays read-only and distraction-free.
4. If necessary, add a subtle scroll wrapper around `.public-script-viewer__content` so very long scripts still feel like the editor page without exposing editing affordances.

## Risks & Mitigations
- **Editor dependencies**: `LineFormatter` currently expects a `StateManager`, attaches selection/focus handlers, and assumes `contentEditable`. Introduce `LineFormatter.createStaticLine` (or a similar readonly factory) so the viewer can reuse the formatting logic without coupling to editor state or listeners.
- **Performance**: Rendering via the formatter helper reuses existing logic; even if the viewer renders many lines at once, it follows the same patterns as the editor, so no extra parsing or CSS recalculations are introduced.
- **Security / editing**: Ensure viewer-generated nodes are non-editable and no keyboard/selection handlers fire on the public page.

## Next Steps
1. Prototype the viewer rendering logic directly in `public/js/pages/publicScriptViewerPage.js`, leveraging `ScriptDocument` and the new static line helper.
2. Test with public scripts in JSON format to confirm the layout matches the editor.
3. If needed, extract shared helpers (e.g., `createViewerLines(document)` or `renderScriptLines(container, linesData)`) for reuse across future reader components.
