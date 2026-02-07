import { getNextFormat } from '../../../constants/formats.js';

/**
 * Handles keyboard-driven edit execution.
 * Manages edit queue, enter handling, deletions, and merges.
 */
export class KeyboardEditController {
    /**
     * @param {object} options
     * @param {object} options.contentManager
     * @param {object} options.pageManager
     * @param {object} options.lineFormatter
     * @param {object} [options.domHandler]
     * @param {object} [options.saveService]
     * @param {function} [options.debugLog]
     */
    constructor (options) {
        this.stateManager = options.stateManager || null;
        this.contentManager = options.contentManager;
        this.pageManager = options.pageManager;
        this.lineFormatter = options.lineFormatter;
        this.domHandler = options.domHandler || null;
        this.saveService = options.saveService || null;
        this._debugLog = options.debugLog || (() => {});

        this._editQueue = Promise.resolve();
    }

    /**
     * Enqueue an edit operation for serialized execution.
     * @param {function} action - Async action to execute
     * @returns {Promise}
     */
    enqueue (action) {
        this._editQueue = this._editQueue.then(() => Promise.resolve(action()))
            .catch((error) => {
                console.error('[KeyboardEditController] Edit queue error:', error);
            });
        return this._editQueue;
    }

    /**
     * Handle Enter key press - split line and create new line.
     * @param {HTMLElement} scriptLine
     * @param {KeyboardEvent} [event]
     * @param {object} context - { content, cursorPos, currentFormat }
     */
    async handleEnter (scriptLine, event, context) {
        if (this.stateManager?.isEditorReadOnly?.()) return;
        const { content, cursorPos, currentFormat } = context;

        let newFormat;
        if (event?.shiftKey) {
            newFormat = currentFormat;
        } else {
            newFormat = this.lineFormatter
                ? this.lineFormatter.getNextFormatInFlow(currentFormat, 1)
                : getNextFormat(currentFormat);
        }

        const beforeText = cursorPos < content.length ? content.substring(0, cursorPos) : content;
        const afterText = cursorPos < content.length ? content.substring(cursorPos) : '';

        const lineId = scriptLine.dataset.lineId || this.contentManager?.ensureLineId(scriptLine);
        if (!lineId) {
            console.error('[KeyboardEditController] Missing lineId for enter handling');
            return;
        }

        return this.enqueue(async () => {
            await this.contentManager.insertLineAfter(lineId, {
                format: newFormat,
                content: afterText,
                updateCurrentContent: beforeText,
                focus: true
            });
        });
    }

    /**
     * Handle inline character deletion (backspace/delete within line).
     * @param {KeyboardEvent} event
     * @param {HTMLElement} scriptLine
     * @param {object} context - { content, startOffset, endOffset }
     * @returns {boolean} - Whether deletion was handled
     */
    handleInlineDeletion (event, scriptLine, context) {
        if (this.stateManager?.isEditorReadOnly?.()) return true;
        const { content, startOffset, endOffset } = context;
        const hasSelection = startOffset !== endOffset;

        const lineId = scriptLine.dataset.lineId || this.contentManager?.ensureLineId(scriptLine);
        if (!lineId) {
            return true;
        }

        let newContent = content;
        let focusOffset = startOffset;

        if (hasSelection) {
            newContent = `${content.slice(0, startOffset)}${content.slice(endOffset)}`;
        } else if (event.key === 'Backspace') {
            if (startOffset === 0) {
                return true;
            }
            newContent = `${content.slice(0, startOffset - 1)}${content.slice(startOffset)}`;
            focusOffset = startOffset - 1;
        } else if (event.key === 'Delete') {
            if (startOffset >= content.length) {
                return true;
            }
            newContent = `${content.slice(0, startOffset)}${content.slice(startOffset + 1)}`;
            focusOffset = startOffset;
        }

        this.enqueue(() => {
            this.contentManager.updateLineByIdWithFocus(lineId, { content: newContent }, { offset: focusOffset });
        });

        return true;
    }

    /**
     * Handle empty line deletion.
     * @param {HTMLElement} scriptLine
     * @param {string} direction - 'previous' or 'next'
     */
    handleEmptyLineDelete (scriptLine, direction) {
        if (this.stateManager?.isEditorReadOnly?.()) return;
        const targetLine = direction === 'previous'
            ? this.pageManager.getPreviousLine(scriptLine)
            : this.pageManager.getNextLine(scriptLine);

        if (!targetLine || !this.contentManager) {
            return;
        }

        const lineId = scriptLine.dataset.lineId || this.contentManager.ensureLineId(scriptLine);
        const focusLineId = targetLine.dataset?.lineId;

        if (!lineId) {
            return;
        }

        return this.contentManager.deleteLinesById([lineId], { focusLineId });
    }

    /**
     * Merge current line with previous line.
     * @param {HTMLElement} scriptLine
     */
    async mergeLineWithPrevious (scriptLine) {
        if (this.stateManager?.isEditorReadOnly?.()) return;
        const previousLine = this.pageManager.getPreviousLine(scriptLine);
        if (!previousLine || !this.contentManager) {
            return;
        }

        const currentId = scriptLine.dataset.lineId || this.contentManager.ensureLineId(scriptLine);
        const previousId = previousLine.dataset.lineId || this.contentManager.ensureLineId(previousLine);

        if (!currentId || !previousId) {
            return;
        }

        return this.contentManager.mergeLinesById(previousId, currentId);
    }

    /**
     * Delete multiple selected lines.
     * @param {NodeList|Array} selectedLines
     * @param {function} clearSelectionFn - Callback to clear selection state
     */
    async deleteSelectedLines (selectedLines, clearSelectionFn) {
        if (this.stateManager?.isEditorReadOnly?.()) return;
        if (!selectedLines || selectedLines.length === 0) {
            return;
        }

        try {
            this._debugLog('[KeyboardEditController] Deleting selected lines:', selectedLines.length);

            const firstSelected = selectedLines[0];
            const lastSelected = selectedLines[selectedLines.length - 1];

            let lineToFocus = null;
            if (this.pageManager) {
                lineToFocus = this.pageManager.getPreviousLine(firstSelected) ||
                    this.pageManager.getNextLine(lastSelected);
            }

            const lineIds = Array.from(selectedLines)
                .map(line => line.dataset.lineId)
                .filter(Boolean);

            if (this.contentManager) {
                await this.contentManager.deleteLinesById(lineIds, {
                    focusLineId: lineToFocus?.dataset?.lineId
                });
            }

            if (clearSelectionFn) {
                clearSelectionFn();
            }

            this._debugLog('[KeyboardEditController] Selected lines deleted successfully');
        } catch (error) {
            console.error('[KeyboardEditController] Error deleting selected lines:', error);
            if (clearSelectionFn) {
                clearSelectionFn();
            }
        }
    }

    /**
     * Check if backspace should trigger merge with previous line.
     * @param {HTMLElement} scriptLine
     * @param {function} isCaretAtStartFn
     * @param {function} getContentFn
     * @returns {boolean}
     */
    shouldMergeWithPrevious (scriptLine, isCaretAtStartFn, getContentFn) {
        if (!scriptLine || !this.contentManager) {
            return false;
        }

        if (!isCaretAtStartFn(scriptLine)) {
            return false;
        }

        const previousLine = this.pageManager.getPreviousLine(scriptLine);
        if (!previousLine) {
            return false;
        }

        const currentContent = getContentFn(scriptLine);
        const previousContent = getContentFn(previousLine);

        return Boolean(currentContent && previousContent);
    }

    /**
     * Check if delete at boundary should be a no-op.
     * @param {KeyboardEvent} event
     * @param {HTMLElement} scriptLine
     * @param {object} context - { startOffset, endOffset, content }
     * @returns {boolean}
     */
    isBoundaryDeleteNoop (event, scriptLine, context) {
        if (!event || !scriptLine || !this.contentManager) {
            return false;
        }

        const { startOffset, endOffset, content } = context;

        if (startOffset !== endOffset) {
            return false;
        }

        const lineId = scriptLine.dataset.lineId || this.contentManager.ensureLineId(scriptLine);
        if (!lineId) {
            return false;
        }

        const lineIndex = this.contentManager.getLineIndex(lineId);
        const lineCount = this.contentManager.getLineCount();

        if (lineIndex === -1 || lineCount === 0) {
            return false;
        }

        if (event.key === 'Backspace' && lineIndex === 0 && startOffset === 0) {
            return true;
        }

        if (event.key === 'Delete' && lineIndex === lineCount - 1 && startOffset >= content.length) {
            return true;
        }

        return false;
    }

    /**
     * Destroy and clean up.
     */
    destroy () {
        this._editQueue = Promise.resolve();
        this.contentManager = null;
        this.pageManager = null;
        this.lineFormatter = null;
        this.domHandler = null;
        this.saveService = null;
    }
}
