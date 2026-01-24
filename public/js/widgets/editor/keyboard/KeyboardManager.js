import { getCircularFormat, getNextFormat, FORMAT_FLOW } from '../../../constants/formats.js';
import { EDITOR_EVENTS } from '../constants.js';
import { debugLog } from '../../../core/logger.js';
// EditorFormatFSM functionality now consolidated into EditorToolbar.js

/**
 *
 */
export class KeyboardManager {
    /**
     *
     * @param options
     */
    constructor (options) {
        this.stateManager = options.stateManager;
        this.pageManager = options.pageManager;
        this.contentManager = options.contentManager;
        this.lineFormatter = options.lineFormatter;
        this.autocomplete = options.autocomplete;
        this.saveService = options.saveService; // Add save service reference
        this.history = options.history; // Add history service reference
        this.debug = options.debug === true;
        this._debugLog = (...args) => {
            if (this.debug) {
                debugLog(...args);
            }
        };

        // Initialize format FSM
        // Format FSM functionality now handled by EditorToolbar
        this.formatFSM = null;

        // Use centralized format flow
        this.formatFlow = Object.keys(FORMAT_FLOW);

        // Selection tracking
        this.selectionStart = null;
        this.selectionEnd = null;

        // History tracking
        this.lastSavedState = null;
        this.stateChangeThreshold = 100; // ms between state saves

        // Bind handlers
        this._boundHandlers = {
            keydown: this._handleKeyDown.bind(this),
            click: this._handleClick.bind(this)
        };
    }

    /**
     *
     * @param editorArea
     */
    initialize (editorArea) {
        if (!editorArea) {
            console.error('[KeyboardManager] No editor area provided for initialization');
            return;
        }
        this.editorArea = editorArea;

        this._debugLog('[KeyboardManager] About to attach event listeners to:', {
            editorArea: editorArea,
            tagName: editorArea.tagName,
            className: editorArea.className,
            id: editorArea.id
        });

        if (this.debug) {
            // Add a simple test listener to see if ANY keydown events are being captured
            editorArea.addEventListener('keydown', (event) => {
                this._debugLog('[KeyboardManager] RAW KEYDOWN EVENT:', {
                    key: event.key,
                    ctrlKey: event.ctrlKey,
                    target: event.target,
                    targetTagName: event.target.tagName,
                    targetClassName: event.target.className
                });
            });
        }

        editorArea.addEventListener('keydown', this._boundHandlers.keydown);
        editorArea.addEventListener('click', this._boundHandlers.click);

        this._debugLog('[KeyboardManager] Event listeners attached successfully');
        this._debugLog('[KeyboardManager] Initialized with editor area');
    }

    /**
     * Handle click events for selection
     * @param {MouseEvent} event - The click event
     */
    _handleClick (event) {
        const scriptLine = event.target.closest('.script-line');

        if (!scriptLine) {
            // Click outside script lines - clear selection
            this._clearLineSelection();
            this.selectionStart = null;
            this.selectionEnd = null;
            return;
        }

        if (event.shiftKey && this.selectionStart) {
            // Handle shift+click selection
            event.preventDefault();
            this.selectionEnd = scriptLine;
            this._updateLineSelection(this.selectionStart, this.selectionEnd);
        } else {
            // Start new selection point
            this._clearLineSelection();
            this.selectionStart = scriptLine;
            this.selectionEnd = null;
            // Add selection class to the clicked line
            scriptLine.classList.add('selected');
        }
    }

    /**
     *
     */
    destroy () {
        if (this.editorArea) {
            this.editorArea.removeEventListener('keydown', this._boundHandlers.keydown);
            this.editorArea.removeEventListener('click', this._boundHandlers.click);
            this._clearLineSelection();
            this.selectionStart = null;
            this.selectionEnd = null;
        }
    }

    /**
     *
     * @param event
     */
    _handleKeyDown (event) {
        this._debugLog('[KeyboardManager] KEYBOARD EVENT DETECTED!', {
            key: event.key,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            target: event.target,
            targetTagName: event.target.tagName,
            targetClassName: event.target.className
        });

        const scriptLine = event.target.closest('.script-line');
        if (!scriptLine) {
            this._debugLog('[KeyboardManager] No script line found for event target');
            this._debugLog('[KeyboardManager] Event target details:', {
                tagName: event.target.tagName,
                className: event.target.className,
                id: event.target.id,
                parentElement: event.target.parentElement?.tagName,
                parentClassName: event.target.parentElement?.className
            });

            // Check if there are any script lines in the editor area
            const allScriptLines = this.editorArea.querySelectorAll('.script-line');
            this._debugLog('[KeyboardManager] Total script lines in editor area:', allScriptLines.length);
            if (allScriptLines.length > 0) {
                this._debugLog('[KeyboardManager] First script line:', {
                    tagName: allScriptLines[0].tagName,
                    className: allScriptLines[0].className,
                    format: allScriptLines[0].getAttribute('data-format')
                });
            }
            return;
        }

        this._debugLog('[KeyboardManager] Script line found:', {
            format: scriptLine.getAttribute('data-format'),
            content: scriptLine.textContent?.substring(0, 20) + '...'
        });

        // Priority 1: Global shortcuts (Ctrl+S, etc.)
        if (this._handleGlobalShortcuts(event)) {
            return;
        }

        // Priority 2: Autocomplete
        if (this._handleAutocomplete(event, scriptLine)) {
            return;
        }

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

    /**
     * Handle global keyboard shortcuts
     * @param {KeyboardEvent} event - The keyboard event
     * @returns {boolean} - Whether the event was handled
     */
    _handleGlobalShortcuts (event) {
        // Handle Ctrl+S for manual save
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
            event.stopPropagation();
            this._handleManualSave();
            return true;
        }

        // Handle Ctrl+Z for undo
        if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
            event.preventDefault();
            event.stopPropagation();
            this._handleUndo();
            return true;
        }

        // Handle Ctrl+Y or Ctrl+Shift+Z for redo
        if ((event.ctrlKey && event.key === 'y') || (event.ctrlKey && event.key === 'z' && event.shiftKey)) {
            event.preventDefault();
            event.stopPropagation();
            this._handleRedo();
            return true;
        }

        return false;
    }

    /**
     * Handle manual save (Ctrl+S)
     * @private
     */
    _handleManualSave () {
        this._debugLog('[KeyboardManager] Manual save triggered (Ctrl+S)');
        if (this.saveService && typeof this.saveService.handleManualSave === 'function') {
            this.saveService.handleManualSave();
        }
    }

    /**
     * Handle undo (Ctrl+Z)
     * @private
     */
    _handleUndo () {
        this._debugLog('[KeyboardManager] Undo triggered (Ctrl+Z)');
        if (this.history && typeof this.history.undo === 'function') {
            const success = this.history.undo();
            if (success) {
                this._debugLog('[KeyboardManager] Undo successful');
            } else {
                this._debugLog('[KeyboardManager] Nothing to undo');
            }
        } else {
            console.warn('[KeyboardManager] History service not available for undo');
        }
    }

    /**
     * Handle redo (Ctrl+Y or Ctrl+Shift+Z)
     * @private
     */
    _handleRedo () {
        this._debugLog('[KeyboardManager] Redo triggered (Ctrl+Y)');
        if (this.history && typeof this.history.redo === 'function') {
            const success = this.history.redo();
            if (success) {
                this._debugLog('[KeyboardManager] Redo successful');
            } else {
                this._debugLog('[KeyboardManager] Nothing to redo');
            }
        } else {
            console.warn('[KeyboardManager] History service not available for redo');
        }
    }

    /**
     *
     * @param event
     * @param scriptLine
     */
    _handleAutocomplete (event, scriptLine) {
        if (!this.autocomplete || !this.autocomplete.currentSuggestion) {
            return false;
        }

        if (event.key === 'Tab') {
            if (typeof this.autocomplete.handleKeydown === 'function') {
                return this.autocomplete.handleKeydown(event);
            }
            return false;
        }

        return false;
    }

    /**
     *
     * @param event
     * @param scriptLine
     */
    _handleLineNavigation (event, scriptLine) {
        // Handle format cycling with Ctrl+Arrow keys first
        if (event.ctrlKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            this._debugLog('[KeyboardManager] Ctrl+Arrow key detected!');
            event.preventDefault();
            event.stopPropagation();

            // Determine direction based on arrow key
            let direction;
            if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                direction = -1; // Previous format
            } else {
                direction = 1;  // Next format
            }

            this._debugLog('[KeyboardManager] Ctrl+Arrow format cycling:', {
                key: event.key,
                direction,
                currentFormat: scriptLine.getAttribute('data-format')
            });

            // Use FSM for format cycling
            const currentFormat = scriptLine.getAttribute('data-format');
            // Format FSM functionality now handled by EditorToolbar
            // this.formatFSM.setState(currentFormat, false);

            const newFormat = getCircularFormat(currentFormat, direction);

            this._debugLog('[KeyboardManager] FSM format transition:', {
                from: currentFormat,
                to: newFormat,
                direction
            });

            if (this.lineFormatter) {
                this._applyFormatCommand(scriptLine, newFormat);
                this._debugLog('[KeyboardManager] Line format command applied');
            } else {
                console.error('[KeyboardManager] No lineFormatter available');
            }
            return true;
        }

        // Shift+Arrow should extend selection (not change format)
        if (event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            event.preventDefault();
            event.stopPropagation();

            if (!this.selectionStart) {
                this.selectionStart = scriptLine;
            }

            const nextLine = event.key === 'ArrowUp' ?
                this.pageManager.operations.getPreviousLine(scriptLine) :
                this.pageManager.operations.getNextLine(scriptLine);

            if (nextLine) {
                this.selectionEnd = nextLine;
                this._updateLineSelection(this.selectionStart, this.selectionEnd);
                return true;
            }

            return true;
        }

        // Regular arrow navigation (only if Ctrl is not pressed)
        if (event.ctrlKey) {
            return false; // Ctrl+arrow handled above
        }

        switch (event.key) {
            case 'ArrowUp':
            case 'ArrowDown': {
                event.preventDefault();
                // Clear any existing selection
                this._clearLineSelection();
                this.selectionStart = null;
                this.selectionEnd = null;

                const nextLine = event.key === 'ArrowUp' ?
                    this.pageManager.operations.getPreviousLine(scriptLine) :
                    this.pageManager.operations.getNextLine(scriptLine);

                if (nextLine) {
                    this._updateLineAndFocus(nextLine);
                }
                return true;
            }

            case 'ArrowLeft':
            case 'ArrowRight':
                // Handle format changing with left/right arrows
                if (this._handleArrowFormatChange(event, scriptLine)) {
                    return true;
                }
                return false;

            case 'Enter':
                this._debugLog('[KeyboardManager] Enter key pressed on line:', {
                    line: scriptLine,
                    format: scriptLine.getAttribute('data-format'),
                    content: scriptLine.textContent,
                    shiftKey: event.shiftKey
                });
                event.preventDefault();
                event.stopPropagation();
                this._debugLog('[KeyboardManager] Calling _handleEnter...');
                this._handleEnter(scriptLine, event);
                return true;

            case 'Tab': {
                event.preventDefault();
                const targetLine = event.shiftKey ?
                    this.pageManager.operations.getPreviousLine(scriptLine) :
                    this.pageManager.operations.getNextLine(scriptLine);

                if (targetLine) {
                    this._updateLineAndFocus(targetLine);
                }
                return true;
            }

            case 'Backspace':
            case 'Delete': {
                // Check if we have selected lines
                const selectedLines = this.editorArea.querySelectorAll('.script-line.selected');
                if (selectedLines.length > 1) {
                    // Multiple lines selected - delete all selected lines
                    event.preventDefault();
                    this._deleteSelectedLines(selectedLines);
                    return true;
                } else if (selectedLines.length === 1 && selectedLines[0] === scriptLine) {
                    // Single line selected - delete the line
                    event.preventDefault();
                    this._deleteSelectedLines(selectedLines);
                    return true;
                } else if (scriptLine.textContent.trim() === '') {
                    // Empty line - delete the line
                    event.preventDefault();
                    this._handleEmptyLineDelete(scriptLine, event.key === 'Backspace' ? 'previous' : 'next');
                    return true;
                }
                return false;
            }

            default:
                return false;
        }
    }

    /**
     * Handle arrow key format changes
     * @param {KeyboardEvent} event - The keyboard event
     * @param {HTMLElement} scriptLine - The script line element
     * @returns {boolean} - Whether the event was handled
     */
    _handleArrowFormatChange (event, scriptLine) {
        // Only handle left/right arrows when cursor is at the beginning/end of line
        const selection = window.getSelection();
        const range = selection.getRangeCount ? selection.getRangeAt(0) : null;

        if (!range) return false;

        const content = scriptLine.textContent || '';
        const cursorPos = range.startOffset;
        const isAtStart = cursorPos === 0;
        const isAtEnd = cursorPos === content.length;

        // Only change format if cursor is at the start (left arrow) or end (right arrow) of line
        if ((event.key === 'ArrowLeft' && isAtStart) || (event.key === 'ArrowRight' && isAtEnd)) {
            event.preventDefault();

            const currentFormat = scriptLine.getAttribute('data-format');
            const direction = event.key === 'ArrowLeft' ? -1 : 1;

            // Use FSM for format transitions
            // Format FSM functionality now handled by EditorToolbar
            // this.formatFSM.setState(currentFormat, false);
            const newFormat = getCircularFormat(currentFormat, direction);

            const selectionState = this._captureSelection(scriptLine);
            this._applyFormatCommand(scriptLine, newFormat);
            this._restoreSelection(scriptLine, selectionState);
            return true;
        }

        return false;
    }

    /**
     *
     * @param event
     * @param scriptLine
     */
    _handleLineFormatting (event, scriptLine) {
        if (event.key === 'Tab') {
            event.preventDefault();
            const currentFormat = scriptLine.getAttribute('data-format');
            const newFormat = this.lineFormatter ?
                this.lineFormatter.getNextFormatInFlow(currentFormat, 1) :
                getNextFormat(currentFormat);

            this._applyFormatCommand(scriptLine, newFormat);
            this._updateLineAndFocus(scriptLine);
            return true;
        }
        return false;
    }

    /**
     *
     * @param event
     * @param scriptLine
     */
    _handleLineContent (event, scriptLine) {
        // Tab within line for indentation
        const hasSuggestion = Boolean(this.autocomplete && this.autocomplete.currentSuggestion);
        if (event.key === 'Tab' && !hasSuggestion) {
            event.preventDefault();
            this.lineFormatter.indent(scriptLine, event.shiftKey);
            return true;
        }

        return false;
    }

    /**
     *
     * @param scriptLine
     * @param direction
     */
    _handleEmptyLineDelete (scriptLine, direction) {
        const targetLine = direction === 'previous' ?
            this.pageManager.operations.getPreviousLine(scriptLine) :
            this.pageManager.operations.getNextLine(scriptLine);

        if (!targetLine || !this.contentManager) {
            return;
        }

        const lineId = scriptLine.dataset.lineId || this.contentManager.ensureLineId(scriptLine);
        const { lineId: focusLineId } = targetLine.dataset;
        if (!lineId) {
            return;
        }

        this.contentManager.deleteLinesById([lineId], {
            focusLineId
        });
    }

    /**
     *
     * @param format
     */
    _createNewLine (format = 'action') {
        const line = document.createElement('div');
        line.className = `script-line format-${format}`;
        line.setAttribute('contenteditable', 'true');
        line.setAttribute('data-format', format);
        line.setAttribute('data-line-id', `line-${Date.now()}`);
        line.setAttribute('role', 'textbox');
        line.setAttribute('aria-label', `Script ${format} line`);
        return line;
    }

    /**
     *
     * @param line
     */
    _updateLineAndFocus (line) {
        if (!line) return;

        // Ensure line is visible and focused (with fallback for test environments)
        try {
            if (typeof line.scrollIntoView === 'function') {
                line.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } catch (error) {
            // Ignore scrollIntoView errors in test environments
        }

        const range = document.createRange();
        const sel = window.getSelection();

        try {
            range.selectNodeContents(line);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (error) {
            console.error('[KEYBOARD] Error updating line focus:', error);
        }
    }

    _captureSelection (line) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return null;
        }

        const range = selection.getRangeAt(0);
        const isInside = line.contains(range.startContainer) && line.contains(range.endContainer);
        if (!isInside) {
            return null;
        }

        return {
            startContainer: range.startContainer,
            startOffset: range.startOffset,
            endContainer: range.endContainer,
            endOffset: range.endOffset
        };
    }

    _restoreSelection (line, selectionState) {
        if (!line) return;
        if (!selectionState) {
            line.focus();
            return;
        }

        try {
            const selection = window.getSelection();
            const range = document.createRange();
            range.setStart(selectionState.startContainer, selectionState.startOffset);
            range.setEnd(selectionState.endContainer, selectionState.endOffset);
            selection.removeAllRanges();
            selection.addRange(range);
            line.focus();
        } catch (error) {
            line.focus();
        }
    }

    /**
     *
     * @param line
     */
    _focusLineEnd (line) {
        if (!line) return;
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(line);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        line.focus();
    }

    // _cycleFormat method removed - using centralized getNextFormat from constants

    /**
     * Handle Enter key press
     * @param {HTMLElement} scriptLine - The script line element
     * @param {KeyboardEvent} event - The keyboard event (optional, for shift key detection)
     */
    async _handleEnter (scriptLine, event = null) {
        if (!scriptLine) {
            console.error('[KeyboardManager] No script line provided for enter handling');
            return;
        }

        this._debugLog('[KeyboardManager] Starting enter handling for line:', {
            currentFormat: scriptLine.getAttribute('data-format'),
            content: scriptLine.textContent,
            isShiftEnter: event ? event.shiftKey : false
        });

        // Get current selection and range
        const selection = window.getSelection();
        const range = selection.getRangeCount ? selection.getRangeAt(0) : null;
        const content = scriptLine.textContent || '';
        const cursorPos = range ? range.startOffset : content.length;

        this._debugLog('[KeyboardManager] Selection info:', {
            hasRange: !!range,
            cursorPos,
            content
        });

        // Determine the format for the new line
        const currentFormat = scriptLine.getAttribute('data-format');
        let newFormat;

        // Check if this is Shift+Enter (normal newline with same format)
        if (event && event.shiftKey) {
            newFormat = currentFormat; // Keep same format for Shift+Enter
            this._debugLog('[KeyboardManager] Shift+Enter detected, keeping same format:', newFormat);
        } else {
            // Use FSM for format transitions on normal Enter
            // Format FSM functionality now handled by EditorToolbar
            // this.formatFSM.setState(currentFormat, false);
            newFormat = this.lineFormatter ?
                this.lineFormatter.getNextFormatInFlow(currentFormat, 1) :
                getNextFormat(currentFormat);
            this._debugLog('[KeyboardManager] Format transition:', {
                from: currentFormat,
                to: newFormat
            });
        }

        const beforeText = cursorPos < content.length ? content.substring(0, cursorPos) : content;
        const afterText = cursorPos < content.length ? content.substring(cursorPos) : '';
        const lineId = scriptLine.dataset.lineId || this.contentManager.ensureLineId(scriptLine);

        if (!this.contentManager || !lineId) {
            console.error('[KeyboardManager] Missing contentManager or lineId for enter handling');
            return;
        }

        const newLine = await this.contentManager.insertLineAfter(lineId, {
            format: newFormat,
            content: afterText,
            updateCurrentContent: beforeText,
            focus: true
        });

        if (newLine) {
            this._triggerAutoSave();
        }
    }

    /**
     * Update line selection between start and end lines
     * @param {HTMLElement} startLine - The start line of selection
     * @param {HTMLElement} endLine - The end line of selection
     */
    _updateLineSelection (startLine, endLine) {
        if (!startLine || !endLine) {
            console.warn('[KeyboardManager] Invalid lines for selection update');
            return;
        }

        // Clear any existing selection first (but keep state)
        this._clearLineSelection(false);

        // Get all lines between start and end
        const lines = [];
        let currentLine = startLine;

        // Determine direction based on DOM order
        const after = this._isLineAfter(endLine, startLine);

        // Collect all lines in the selection
        while (currentLine) {
            lines.push(currentLine);

            if (currentLine === endLine) {
                break;
            }

            currentLine = after ?
                this.pageManager.operations.getNextLine(currentLine) :
                this.pageManager.operations.getPreviousLine(currentLine);

            // Safety check to prevent infinite loops
            if (lines.length > 100) {
                console.warn('[KeyboardManager] Selection loop detected, breaking');
                break;
            }
        }

        // Add selection class to all lines
        lines.forEach(line => {
            line.classList.add('selected');
        });

        // Focus the end line but maintain selection
        endLine.focus();
        const range = document.createRange();
        range.selectNodeContents(endLine);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        this._debugLog('[KeyboardManager] Selection updated:', {
            startLine: startLine.textContent,
            endLine: endLine.textContent,
            selectedCount: lines.length
        });
    }

    /**
     * Clear all line selections
     * @param {boolean} clearState - Whether to clear selection state (default: true)
     */
    _clearLineSelection (clearState = true) {
        const selectedLines = this.editorArea.querySelectorAll('.script-line.selected');
        selectedLines.forEach(line => {
            line.classList.remove('selected');
        });

        // Clear selection state only if requested
        if (clearState) {
            this.selectionStart = null;
            this.selectionEnd = null;
            this._debugLog('[KeyboardManager] Selection cleared');
        }
    }

    /**
     *
     * @param lineA
     * @param lineB
     */
    _isLineAfter (lineA, lineB) {
        if (!lineA || !lineB) return false;
        return (lineA.compareDocumentPosition(lineB) & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
    }

    /**
     * Delete selected lines
     * @param {NodeList|Array} selectedLines - The lines to delete
     */
    async _deleteSelectedLines (selectedLines) {
        if (!selectedLines || selectedLines.length === 0) {
            console.warn('[KeyboardManager] No lines to delete');
            return;
        }

        try {
            this._debugLog('[KeyboardManager] Deleting selected lines:', selectedLines.length);

            // Get the line to focus after deletion
            const firstSelected = selectedLines[0];
            const lastSelected = selectedLines[selectedLines.length - 1];

            // Try to find a line to focus after deletion
            let lineToFocus = null;
            if (this.pageManager && this.pageManager.operations) {
                lineToFocus = this.pageManager.operations.getPreviousLine(firstSelected) ||
                    this.pageManager.operations.getNextLine(lastSelected);
            }

            const lineIds = Array.from(selectedLines)
                .map(line => line.dataset.lineId)
                .filter(Boolean);

            if (this.contentManager) {
                await this.contentManager.deleteLinesById(lineIds, {
                    focusLineId: lineToFocus?.dataset?.lineId
                });
            }

            // Clear selection state
            this._clearLineSelection();

            // Focus the appropriate line
            if (lineToFocus) {
                this._updateLineAndFocus(lineToFocus);
            } else {
                // Try to focus the first remaining line
                const remainingLines = this.editorArea.querySelectorAll('.script-line');
                if (remainingLines.length > 0) {
                    this._updateLineAndFocus(remainingLines[0]);
                }
            }

            this._debugLog('[KeyboardManager] Selected lines deleted successfully');
        } catch (error) {
            console.error('[KeyboardManager] Error deleting selected lines:', error);
            // Clear selection state even if deletion failed
            this._clearLineSelection();
        }
    }

    /**
     * @param {HTMLElement} scriptLine
     * @param {string} format
     */
    _applyFormatCommand (scriptLine, format) {
        if (!scriptLine || !this.contentManager || !this.lineFormatter) {
            return null;
        }
        const lineId = scriptLine.dataset.lineId || this.contentManager.ensureLineId(scriptLine);
        return this.contentManager.applyFormat(lineId, { format });
    }

    /**
     * Get current format state from FSM
     * @returns {string} - Current format
     */
    getCurrentFormat () {
        return 'dialog'; // this.formatFSM.getCurrentState();
    }

    /**
     * Set format state in FSM
     * @param {string} format - Format to set
     */
    setFormat (format) {
        if (this.formatFlow.includes(format)) {
            // this.formatFSM.setState(format);
        }
    }

    /**
     * Check if format transition is allowed
     * @param {string} format - Target format
     * @returns {boolean} - Whether transition is allowed
     */
    canTransitionTo (format) {
        return this.formatFlow.includes(format); // this.formatFSM.canTransitionTo(format);
    }

    /**
     * Get available format transitions
     * @returns {string[]} - Available formats
     */
    getAvailableFormats () {
        return [...this.formatFlow]; // this.formatFSM.getAvailableTransitions();
    }

    /**
     * Get FSM statistics
     * @returns {object} - FSM statistics
     */
    getFSMStats () {
        return { currentFormat: 'dialog', availableFormats: this.formatFlow }; // this.formatFSM.getStats();
    }

    /**
     * Reset FSM to initial state
     */
    resetFSM () {
        // this.formatFSM.reset();
    }

    /**
     * Get currently selected lines
     * @returns {NodeList} - Currently selected lines
     */
    getSelectedLines () {
        return this.editorArea.querySelectorAll('.script-line.selected');
    }

    /**
     * Check if any lines are selected
     * @returns {boolean} - Whether any lines are selected
     */
    hasSelection () {
        return this.getSelectedLines().length > 0;
    }

    /**
     * Get selection count
     * @returns {number} - Number of selected lines
     */
    getSelectionCount () {
        return this.getSelectedLines().length;
    }

    /**
     * Clear current selection
     */
    clearSelection () {
        this._clearLineSelection();
    }

    /**
     * Trigger auto-save after line changes
     * @private
     */
    _triggerAutoSave () {
        if (!this.saveService ||
            typeof this.saveService.handleLineChange !== 'function' ||
            !this.contentManager ||
            typeof this.contentManager.getContent !== 'function') {
            return;
        }

        const content = this.contentManager.getContent();
        if (content) {
            this.saveService.handleLineChange(content);
        }
    }

    /**
     * Save current state to history
     * @private
     */
    _saveStateToHistory () {
        if (!this.history || typeof this.history.saveState !== 'function') {
            return;
        }

        const now = Date.now();

        // Throttle state saves to prevent excessive history entries
        if (this.lastSavedState && (now - this.lastSavedState) < this.stateChangeThreshold) {
            return;
        }

        // Get current state from state manager
        if (this.stateManager && typeof this.stateManager.getCurrentState === 'function') {
            const currentState = this.stateManager.getCurrentState();
            if (currentState) {
                this.history.saveState(currentState);
                this.lastSavedState = now;
            }
        }
    }

    /**
     * Force save state to history (for important operations)
     * @private
     */
    _forceSaveStateToHistory () {
        if (!this.history || typeof this.history.saveState !== 'function') {
            return;
        }

        // Get current state from state manager
        if (this.stateManager && typeof this.stateManager.getCurrentState === 'function') {
            const currentState = this.stateManager.getCurrentState();
            if (currentState) {
                this.history.saveState(currentState, true); // Force save
                this.lastSavedState = Date.now();
            }
        }
    }

}
