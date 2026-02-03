# Editor Line Format Logic

## Format constants & flow
- `public/js/constants/formats.js` defines `VALID_FORMATS` (`header`, `action`, `speaker`, `dialog`, `directions`, `chapter-break`), `DEFAULT_FORMAT` (`action`), the `FORMAT_FLOW` progression (`header → action`, `speaker → dialog`, `dialog ↔ speaker`, `directions → dialog`, `chapter-break → header`) and the circular `FORMAT_CYCLE`/`getNextFormat` helpers that power keyboard shortcuts and automated transitions.
- `LineFormatter` and the keyboard handler both import those helpers so every new line is stamped with the same state machine.

## DOM representation & styling
- `LineFormatter.createFormattedLine`/`createStaticLine` creates a `div.script-line` with `data-format`, `role="textbox"`, and a `format-<type>` class, which matches the `.format-...` selectors in `public/css/components/editor.css` to paint uppercase headers, indented speakers, centered chapter breaks, italicized directions, etc.
- `LineFormatter.applyFormatToLine` removes stale format classes, updates `data-format`, adds the new `format-<type>` class and keeps the `script-line` baseline so serialization always has a predictable DOM shape.

## Detection & heuristics
- `parseScriptContent` chunks `.split(/\r?\n/)`, skips blank lines, cleans whitespace, and calls `determineFormat`, which prioritizes `isSceneHeader`, `isSpeaker`, `isDialog`, `isDirection`, `isChapterBreak`, defaulting to `dialog` if nothing else matches.
- `applyContextualRules` corrects short all-caps lines into speakers and moves parenthetical-heavy speakers into dialog; `isSceneHeader` looks for INT/EXT keywords, `isSpeaker` enforces all-caps with optional parentheticals, `isDialog` expects prior speaker/mixed case, `isDirection` checks common camera/action starters, and `isChapterBreak` looks for markdown/CHAPTER/ACT markers.
- `ScriptFormatter.format` (used during imports or API payloads) normalizes existing `<tag>` markup or plain text heuristics (`HEADER:`/`SPEAKER:` prefixes, `---` for chapter breaks) and validates the serialized XML tags.

## Data model & enforcement
- `EditorDocumentService` wraps `ScriptDocument` (which stores `ScriptLine` objects with stable IDs) and exposes command builders (`ADD`/`EDIT`/`DELETE`) plus `resolveLineFormat` to sanitize every mutation before it hits the model.
- `applyCommands` converts every command into structured operations, resolves formats, snapshots inverse commands for undo, and always calls `ensureMinimumLine` after mutations.
- `ensureMinimumLine` now inserts a `header` line whenever the document is empty, guaranteeing the first line of **any freshly-loaded or newly-created script** starts as a scene heading even if the persisted content was blank.

## Editor interaction
- Keyboard/toolbar actions route through `LineFormatter.setLineFormat`, `EditorCoordinator.applyFormat`, and `EditorRenderController`, allowing the UI to toggle `format-<type>` classes, apply `FORMAT_FLOW`, and keep the CSS consistent.
- Autosave/history emit sanitized content via `EditorDocumentService.getContent` which serializes the structured model back to JSON.

## Summary
- The line format pattern is central: constants → model → DOM → CSS/styling → serialization.
- Detection heuristics + `resolveLineFormat` keep imported or AI-generated lines valid, while `EditorDocumentService` ensures the model always has at least one line and that line now defaults to the `header` format so new scripts begin with a scene heading.
