/**
 * Tracks multi-line selection state.
 * Translates DOM selection → semantic selection.
 * Read-only w.r.t. content - only tracks selection state.
 */
export class EditorSelectionManager {
    /**
     * @param {EditorCaretManager} caretManager - Caret manager for offset translation
     * @param {function} emit - Event emitter function
     */
    constructor (caretManager, emit) {
        this.caretManager = caretManager;
        this.emit = emit;

        this.selectedLines = new Set();
        this.selectionStart = null;
    }

    /**
     * Get current selection information.
     * @returns {{range: Range, startLine: HTMLElement, endLine: HTMLElement, startOffset: number, endOffset: number, isMultiLine: boolean}|null}
     */
    getSelection () {
        const selection = window.getSelection();
        if (!selection.rangeCount) {
            return null;
        }

        const range = selection.getRangeAt(0);
        const startLine = range.startContainer.parentElement?.closest('.script-line');
        const endLine = range.endContainer.parentElement?.closest('.script-line');

        if (!startLine || !endLine) {
            return null;
        }

        const logicalStartOffset = this.caretManager.getLogicalCaretOffset(
            startLine,
            range.startContainer,
            range.startOffset
        );
        const logicalEndOffset = this.caretManager.getLogicalCaretOffset(
            endLine,
            range.endContainer,
            range.endOffset
        );

        return {
            range,
            startLine,
            endLine,
            startOffset: logicalStartOffset ?? range.startOffset,
            endOffset: logicalEndOffset ?? range.endOffset,
            isMultiLine: startLine !== endLine
        };
    }

    /**
     * Select multiple lines.
     * @param {HTMLElement} startLine - First line to select
     * @param {HTMLElement} endLine - Last line to select
     * @returns {boolean} - Success
     */
    selectLines (startLine, endLine) {
        if (!startLine || !endLine) {
            return false;
        }

        try {
            const range = document.createRange();
            range.setStartBefore(startLine);
            range.setEndAfter(endLine);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            // Update selected lines set
            this.selectedLines.clear();
            let currentLine = startLine;
            while (currentLine && currentLine !== endLine.nextSibling) {
                this.selectedLines.add(currentLine);
                currentLine = currentLine.nextElementSibling;
            }

            this.emit('selectionChanged', {
                selectedLines: Array.from(this.selectedLines),
                isMultiLine: this.selectedLines.size > 1
            });

            return true;
        } catch (error) {
            console.error('[EditorSelectionManager] Error selecting lines:', error);
            return false;
        }
    }

    /**
     * Clear current selection.
     */
    clearSelection () {
        const selection = window.getSelection();
        selection.removeAllRanges();
        this.selectedLines.clear();
        this.selectionStart = null;
        this.emit('selectionCleared');
    }

    /**
     * Get selected lines.
     * @returns {HTMLElement[]}
     */
    getSelectedLines () {
        return Array.from(this.selectedLines);
    }

    /**
     * Check if multiple lines are selected.
     * @returns {boolean}
     */
    isMultiLineSelected () {
        return this.selectedLines.size > 1;
    }

    /**
     * Set selection start for shift+click.
     * @param {HTMLElement} line
     */
    setSelectionStart (line) {
        this.selectionStart = line;
    }

    /**
     * Get selection start line.
     * @returns {HTMLElement|null}
     */
    getSelectionStart () {
        return this.selectionStart;
    }
}
