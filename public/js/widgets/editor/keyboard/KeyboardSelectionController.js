/**
 * Manages keyboard-driven line selection state.
 * Handles shift+click, shift+arrow selection, and .selected class logic.
 */
export class KeyboardSelectionController {
    /**
     * @param {object} options
     * @param {HTMLElement} options.editorArea
     * @param {object} options.pageManager
     * @param {function} [options.debugLog]
     */
    constructor (options) {
        this.editorArea = options.editorArea;
        this.pageManager = options.pageManager;
        this._debugLog = options.debugLog || (() => {});

        this.selectionStart = null;
        this.selectionEnd = null;
    }

    /**
     * Set editor area reference (for late initialization).
     * @param {HTMLElement} editorArea
     */
    setEditorArea (editorArea) {
        this.editorArea = editorArea;
    }

    /**
     * Handle click for selection tracking.
     * @param {MouseEvent} event
     * @param {HTMLElement} scriptLine
     */
    handleClick (event, scriptLine) {
        if (!scriptLine) {
            this.clear();
            return;
        }

        if (event.shiftKey && this.selectionStart) {
            event.preventDefault();
            this.selectionEnd = scriptLine;
            this.updateRange(this.selectionStart, this.selectionEnd);
        } else {
            this.clear(false);
            this.selectionStart = scriptLine;
            this.selectionEnd = null;
            scriptLine.classList.add('selected');
        }
    }

    /**
     * Extend selection with shift+arrow.
     * @param {string} direction - 'up' or 'down'
     * @param {HTMLElement} currentLine
     * @returns {boolean} - Whether selection was extended
     */
    extendSelection (direction, currentLine) {
        if (!this.selectionStart) {
            this.selectionStart = currentLine;
        }

        const nextLine = direction === 'up'
            ? this.pageManager.getPreviousLine(currentLine)
            : this.pageManager.getNextLine(currentLine);

        if (nextLine) {
            this.selectionEnd = nextLine;
            this.updateRange(this.selectionStart, this.selectionEnd);
            return true;
        }

        return false;
    }

    /**
     * Update line selection between start and end lines.
     * @param {HTMLElement} startLine
     * @param {HTMLElement} endLine
     */
    updateRange (startLine, endLine) {
        if (!startLine || !endLine) {
            return;
        }

        this._clearDOMSelection();

        const lines = this._collectLinesBetween(startLine, endLine);

        lines.forEach(line => {
            line.classList.add('selected');
        });

        endLine.focus();
        const range = document.createRange();
        range.selectNodeContents(endLine);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        this._debugLog('[KeyboardSelectionController] Selection updated:', {
            selectedCount: lines.length
        });
    }

    /**
     * Clear all line selections.
     * @param {boolean} [clearState=true] - Whether to clear selection state
     */
    clear (clearState = true) {
        this._clearDOMSelection();

        if (clearState) {
            this.selectionStart = null;
            this.selectionEnd = null;
            this._debugLog('[KeyboardSelectionController] Selection cleared');
        }
    }

    /**
     * Get selected lines from DOM.
     * @returns {NodeList}
     */
    getSelectedLines () {
        if (!this.editorArea) {
            return [];
        }
        return this.editorArea.querySelectorAll('.script-line.selected');
    }

    /**
     * Check if any lines are selected.
     * @returns {boolean}
     */
    hasSelection () {
        return this.getSelectedLines().length > 0;
    }

    /**
     * Get selection count.
     * @returns {number}
     */
    getSelectionCount () {
        return this.getSelectedLines().length;
    }

    /**
     * Check if there's a range selection (start and end).
     * @returns {boolean}
     */
    hasRangeSelection () {
        return Boolean(this.selectionStart && this.selectionEnd);
    }

    /**
     * Clear DOM selection classes only.
     */
    _clearDOMSelection () {
        if (!this.editorArea) {
            return;
        }
        const selectedLines = this.editorArea.querySelectorAll('.script-line.selected');
        selectedLines.forEach(line => {
            line.classList.remove('selected');
        });
    }

    /**
     * Collect all lines between start and end (inclusive).
     * @param {HTMLElement} startLine
     * @param {HTMLElement} endLine
     * @returns {HTMLElement[]}
     */
    _collectLinesBetween (startLine, endLine) {
        const lines = [];
        let currentLine = startLine;

        const after = this._isLineAfter(endLine, startLine);

        while (currentLine) {
            lines.push(currentLine);

            if (currentLine === endLine) {
                break;
            }

            currentLine = after
                ? this.pageManager.getNextLine(currentLine)
                : this.pageManager.getPreviousLine(currentLine);

            if (lines.length > 100) {
                console.warn('[KeyboardSelectionController] Selection loop detected, breaking');
                break;
            }
        }

        return lines;
    }

    /**
     * Check if lineA is after lineB in DOM order.
     * @param {HTMLElement} lineA
     * @param {HTMLElement} lineB
     * @returns {boolean}
     */
    _isLineAfter (lineA, lineB) {
        if (!lineA || !lineB) {
            return false;
        }
        return (lineA.compareDocumentPosition(lineB) & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
    }

    /**
     * Destroy and clean up.
     */
    destroy () {
        this.clear();
        this.editorArea = null;
        this.pageManager = null;
    }
}
