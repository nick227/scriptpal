## Editor Line Handling Review

### Scope
This review focuses on line-level input handling in the editor, specifically keyboard-driven line edits and click-driven caret placement. It traces the flow across the keyboard handler, document mutation path, and line DOM behaviors to document the current logic and recent merge behavior.

### Key Modules
- `public/js/widgets/editor/keyboard/KeyboardManager.js`: primary keydown handler, line navigation, delete/merge logic.
- `public/js/widgets/editor/LineFormatter.js`: line element creation and pointer/caret behavior.
- `public/js/widgets/editor/EditorCoordinator.js`: command application and document updates.
- `public/js/widgets/editor/EditorDocumentService.js`: command construction and document mutation.

### Event Flow Overview
1. The editor area dispatches `keydown` and `click` events to `KeyboardManager`.
2. `KeyboardManager` routes input across global shortcuts, autocomplete, navigation, formatting, and line content handling.
3. For edits, `KeyboardManager` uses `contentManager` (EditorCoordinator) to apply commands or line mutations.
4. `EditorCoordinator` mutates the `EditorDocumentService` and triggers render/update in `EditorRenderController` / `EditorDOMHandler`.

```140:425:public/js/widgets/editor/keyboard/KeyboardManager.js
    _handleKeyDown (event) {
        ...
        // Priority 3: Line Navigation
        if (this._handleLineNavigation(event, scriptLine)) {
            return;
        }
        // Priority 4: Line Formatting
        if (this._handleLineFormatting(event, scriptLine)) {
            return;
        }
        // Priority 5: Line Content
        this._handleLineContent(event, scriptLine);
    }
```

### Backspace/Delete Behavior
Keyboard handling prioritizes selection deletion, then merge logic (Backspace at start), then empty line deletion. Non-empty line deletes fall through to default browser behavior unless a special case is handled.

```398:420:public/js/widgets/editor/keyboard/KeyboardManager.js
            case 'Backspace':
            case 'Delete': {
                ...
                } else if (event.key === 'Backspace' && this._shouldMergeWithPreviousLine(scriptLine)) {
                    event.preventDefault();
                    this._mergeLineWithPrevious(scriptLine);
                    return true;
                } else if (scriptLine.textContent.trim() === '') {
                    event.preventDefault();
                    this._handleEmptyLineDelete(scriptLine, event.key === 'Backspace' ? 'previous' : 'next');
                    return true;
                }
                return false;
            }
```

**Merge decision**  
Merge is allowed only when the cursor is at the start of the current line, the selection is collapsed, and both the current and previous lines have content. This avoids merging empty lines or merging mid-line.

```528:603:public/js/widgets/editor/keyboard/KeyboardManager.js
    _shouldMergeWithPreviousLine (scriptLine) {
        if (!scriptLine || !this.contentManager) {
            return false;
        }
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
            return false;
        }
        const range = selection.getRangeAt(0);
        if (!scriptLine.contains(range.startContainer) || range.startOffset !== 0) {
            return false;
        }
        const previousLine = this.pageManager.getPreviousLine(scriptLine);
        if (!previousLine) {
            return false;
        }
        const currentContent = scriptLine.textContent;
        const previousContent = previousLine.textContent;
        if (!currentContent || !previousContent) {
            return false;
        }
        return true;
    }
```

**Merge action**  
The previous line is updated with concatenated content, the current line is deleted, and focus moves to the end of the updated previous line. Mutation happens through `contentManager` to keep document state consistent.

```606:653:public/js/widgets/editor/keyboard/KeyboardManager.js
    async _mergeLineWithPrevious (scriptLine) {
        const previousLine = this.pageManager.getPreviousLine(scriptLine);
        ...
        const mergedContent = `${previousLine.textContent}${scriptLine.textContent}`;
        this.contentManager.updateLineById(previousId, { content: mergedContent });
        await this.contentManager.deleteLinesById([currentId], { focusLineId: previousId });
        const updatedPreviousLine = this.editorArea.querySelector(`[data-line-id="${previousId}"]`);
        if (updatedPreviousLine) {
            this._focusLineEnd(updatedPreviousLine);
        }
    }
```

### Enter Behavior (Line Split)
Enter splits the current line at the caret, inserts a new line after, and moves the trailing text to the new line. The format for the next line is chosen by the format flow rules (or Shift+Enter keeps current format).

```634:695:public/js/widgets/editor/keyboard/KeyboardManager.js
    async _handleEnter (scriptLine, event = null) {
        ...
        const beforeText = cursorPos < content.length ? content.substring(0, cursorPos) : content;
        const afterText = cursorPos < content.length ? content.substring(cursorPos) : '';
        const lineId = scriptLine.dataset.lineId || this.contentManager.ensureLineId(scriptLine);
        ...
        const newLine = await this.contentManager.insertLineAfter(lineId, {
            format: newFormat,
            content: afterText,
            updateCurrentContent: beforeText,
            focus: true
        });
        ...
    }
```

### Click/Caret Placement
Line elements are created in `LineFormatter`. For clicks on empty lines, the caret is explicitly moved to the start. For non-empty lines, native browser caret placement is used (no manual offset math), which avoids erratic positioning.

```74:145:public/js/widgets/editor/LineFormatter.js
        line.addEventListener('click', (e) => {
            const selection = window.getSelection();
            if (selection.toString()) {
                return;
            }
            if (e.target !== line) {
                return;
            }
            if (line.textContent.length === 0) {
                const range = document.createRange();
                range.selectNodeContents(line);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        });
```

### Document Update Path
Line edits are applied through command objects (ADD/EDIT/DELETE). The coordinator applies commands to the document service, renders changes, and emits content updates.

```258:295:public/js/widgets/editor/EditorCoordinator.js
    async applyCommands (commands = [], options = {}) {
        if (!Array.isArray(commands) || commands.length === 0) {
            return { success: false, reason: 'no_commands' };
        }
        const result = this.documentService.applyCommands(commands);
        if (!result.success) {
            return result;
        }
        const { source = 'commands', skipRender = false } = options;
        if (!skipRender) {
            await this.renderController.renderDocument(this.documentService.getDocument(), {
                source,
                allowInPlace: true,
                skipFocus: true
            });
        }
        const content = this.getContent();
        this.emit(EDITOR_EVENTS.CONTENT_UPDATED, { content, source, timestamp: Date.now() });
        this._emitContentChange({ source });
        this.refreshSpeakerSuggestions();
        return { success: true, results: result.results, content, inverseCommands: result.inverseCommands };
    }
```

### Observations
- Backspace merge only triggers at line start with collapsed selection. It does not merge if either line is empty.
- Empty-line delete uses `deleteLinesById`, keeping document/model in sync before focus updates.
- Caret placement is only enforced for empty lines; all other clicks use native selection behavior to avoid cursor jumps.

### Known Gaps / Follow-Ups
- Merge behavior does not insert spacing between lines; it performs a direct string concatenation. If spacing or format normalization is needed, it should be added in `KeyboardManager._mergeLineWithPrevious`.
- The merge logic assumes the cursor offset equals 0 when at start. If a line contains a leading zero-width text node or inline elements, the check may need to account for those cases.
