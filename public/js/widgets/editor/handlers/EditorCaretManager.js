/**
 * Manages caret placement and cursor position reporting.
 * Handles logical ↔ DOM offset translation.
 */
export class EditorCaretManager {
    /**
     * @param {HTMLElement} container - Editor container element
     * @param {Map} lineElementMap - Map of lineId → DOM element
     */
    constructor (container, lineElementMap) {
        this.container = container;
        this.lineElementMap = lineElementMap;
    }

    /**
     * Place caret in a line at specified position.
     * @param {string} lineId - Target line ID
     * @param {object} [options] - Placement options
     * @param {string} [options.position] - 'start' | 'end' (default: 'end')
     * @param {number} [options.offset] - Exact character offset
     * @returns {HTMLElement|null} - Focused line element or null
     */
    placeCaret (lineId, options = {}) {
        if (!lineId) {
            return null;
        }

        const line = this._getLineElement(lineId);
        if (!line) {
            return null;
        }

        const position = options.position || 'end';
        const offset = Number.isFinite(options.offset) ? options.offset : null;

        line.focus();

        const range = document.createRange();
        const selection = window.getSelection();

        if (offset !== null) {
            this._setRangeToOffset(range, line, offset, position);
        } else {
            range.selectNodeContents(line);
            range.collapse(position === 'start');
        }

        selection.removeAllRanges();
        selection.addRange(range);

        return line;
    }

    /**
     * Get cursor position information for a line.
     * @param {HTMLElement} line - Line element
     * @returns {{line: HTMLElement, position: Range|null}}
     */
    getCursorPosition (line) {
        if (!line || !document.contains(line)) {
            return { line, position: null };
        }

        try {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) {
                // Create a new range at the end of the line if none exists
                const range = document.createRange();
                range.selectNodeContents(line);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            return {
                line,
                position: selection.getRangeAt(0)
            };
        } catch (error) {
            console.warn('[EditorCaretManager] Failed to get cursor position:', error);
            return { line, position: null };
        }
    }

    /**
     * Convert DOM selection offset to logical text offset.
     * Accounts for intermediate DOM nodes in rich text.
     * @param {HTMLElement} lineElement - Parent line element
     * @param {Node} container - Selection container node
     * @param {number} offset - DOM offset within container
     * @returns {number|null} - Logical character offset or null
     */
    getLogicalCaretOffset (lineElement, container, offset) {
        if (!lineElement || !container || !Number.isFinite(offset)) {
            return null;
        }

        const caretRange = document.createRange();
        caretRange.setStart(lineElement, 0);
        caretRange.setEnd(container, offset);
        return caretRange.toString().length;
    }

    /**
     * @param {string} lineId
     * @returns {HTMLElement|null}
     */
    _getLineElement (lineId) {
        const cached = this.lineElementMap.get(lineId);
        if (cached && cached.isConnected) {
            return cached;
        }
        return this.container.querySelector(`[data-line-id="${lineId}"]`);
    }

    /**
     * @param {Range} range
     * @param {HTMLElement} line
     * @param {number} offset
     * @param {string} position
     */
    _setRangeToOffset (range, line, offset, position) {
        const textNode = line.firstChild && line.firstChild.nodeType === Node.TEXT_NODE
            ? line.firstChild
            : null;

        if (textNode) {
            const clampedOffset = Math.max(0, Math.min(offset, textNode.length));
            range.setStart(textNode, clampedOffset);
            range.setEnd(textNode, clampedOffset);
        } else {
            range.selectNodeContents(line);
            range.collapse(position === 'start');
        }
    }
}
