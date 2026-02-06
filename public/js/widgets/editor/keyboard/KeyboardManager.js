import { getCircularFormat, getNextFormat, FORMAT_FLOW } from '../../../constants/formats.js';
import { debugLog } from '../../../core/logger.js';

import { KeyboardEditController } from './KeyboardEditController.js';
import { KeyboardSelectionController } from './KeyboardSelectionController.js';

/**
 * Thin dispatcher for keyboard events.
 * Routes events to appropriate controllers.
 */
export class KeyboardManager {
    constructor(options) {
        this.stateManager = options.stateManager;
        this.pageManager = options.pageManager;
        this.contentManager = options.contentManager;
        this.lineFormatter = options.lineFormatter;
        this.domHandler = options.domHandler || null;
        this.autocomplete = options.autocomplete;
        this.saveService = options.saveService;
        this.history = options.history;
        this.debug = options.debug === true;

        this._debugLog = (...args) => {
            if (this.debug) {
                debugLog(...args);
            }
        };

        // Format flow for cycling
        this.formatFlow = Object.keys(FORMAT_FLOW);

        // Autocomplete tracking
        this._autocompleteAccepted = false;
        this._autocompleteAcceptedLineId = null;

        // IME/composition
        this._isComposing = false;

        // Initialize controllers
        this.selectionController = new KeyboardSelectionController({
            editorArea: null, // Set in initialize()
            pageManager: this.pageManager,
            debugLog: this._debugLog
        });

        this.editController = new KeyboardEditController({
            contentManager: this.contentManager,
            pageManager: this.pageManager,
            lineFormatter: this.lineFormatter,
            domHandler: this.domHandler,
            saveService: this.saveService,
            debugLog: this._debugLog
        });

        // Bind handlers
        this._boundHandlers = {
            keydown: this._handleKeyDown.bind(this),
            click: this._handleClick.bind(this),
            compositionstart: () => { this._isComposing = true; },
            compositionend: () => { this._isComposing = false; }
        };
    }

    initialize(editorArea) {
        if (!editorArea) {
            console.error('[KeyboardManager] No editor area provided');
            return;
        }

        this.editorArea = editorArea;
        this.selectionController.setEditorArea(editorArea);

        editorArea.addEventListener('keydown', this._boundHandlers.keydown);
        editorArea.addEventListener('click', this._boundHandlers.click);
        editorArea.addEventListener('compositionstart', this._boundHandlers.compositionstart);
        editorArea.addEventListener('compositionend', this._boundHandlers.compositionend);

        this._debugLog('[KeyboardManager] Initialized');
    }

    destroy() {
        if (this.editorArea) {
            this.editorArea.removeEventListener('keydown', this._boundHandlers.keydown);
            this.editorArea.removeEventListener('click', this._boundHandlers.click);
            this.editorArea.removeEventListener('compositionstart', this._boundHandlers.compositionstart);
            this.editorArea.removeEventListener('compositionend', this._boundHandlers.compositionend);
        }

        this.selectionController.destroy();
        this.editController.destroy();
    }

    // ==============================================
    // Event Handlers
    // ==============================================

    _handleClick(event) {
        const scriptLine = event.target.closest('.script-line');

        if (!scriptLine) {
            this.selectionController.clear();
            return;
        }

        this.selectionController.handleClick(event, scriptLine);

        // Focus empty line on click
        if (event.target === scriptLine && this._isLineEmpty(scriptLine)) {
            const selection = window.getSelection();
            if (!selection.toString()) {
                const range = document.createRange();
                range.selectNodeContents(scriptLine);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    }

    _handleKeyDown(event) {
        if (event.isComposing || this._isComposing) {
            return;
        }

        const scriptLine = event.target.closest('.script-line');
        if (!scriptLine) {
            return;
        }

        // Priority 1: Global shortcuts
        if (this._handleGlobalShortcuts(event)) {
            return;
        }

        // Priority 2: Autocomplete
        if (this._handleAutocomplete(event, scriptLine)) {
            return;
        }

        // Priority 3: Navigation & Edits
        if (this._handleNavigation(event, scriptLine)) {
            return;
        }

        // Priority 4: Formatting
        if (this._handleFormatting(event, scriptLine)) {
            return;
        }
    }

    // ==============================================
    // Priority 1: Global Shortcuts
    // ==============================================

    _handleGlobalShortcuts(event) {
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
            event.stopPropagation();
            if (this.saveService?.handleManualSave) {
                this.saveService.handleManualSave();
            }
            return true;
        }
        return false;
    }

    // ==============================================
    // Priority 2: Autocomplete
    // ==============================================

    _handleAutocomplete(event, scriptLine) {
        if (!this.autocomplete?.hasActiveSuggestion(scriptLine)) {
            return false;
        }

        if (event.key === 'Tab') {
            event.preventDefault();
            event.stopPropagation();
            const accepted = this.autocomplete.acceptSuggestion(scriptLine);
            if (accepted) {
                this._autocompleteAccepted = true;
                this._autocompleteAcceptedLineId = scriptLine.dataset?.lineId || null;
            }
            return false;
        }

        if (event.key === 'Enter') {
            this.autocomplete.acceptSuggestion(scriptLine);
            return false;
        }

        return false;
    }

    // ==============================================
    // Priority 3: Navigation & Edits
    // ==============================================

    _handleNavigation(event, scriptLine) {
        // Ctrl+Arrow: Format cycling
        if (event.ctrlKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            const direction = ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1;
            const newFormat = getCircularFormat(scriptLine.getAttribute('data-format'), direction);
            this._applyFormatCommand(scriptLine, newFormat);
            return true;
        }

        // Shift+Arrow: Extend selection
        if (event.shiftKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            this.selectionController.extendSelection(
                event.key === 'ArrowUp' ? 'up' : 'down',
                scriptLine
            );
            return true;
        }

        switch (event.key) {
            case 'ArrowUp':
            case 'ArrowDown':
                return this._handleArrowUpDown(event, scriptLine);

            case 'ArrowLeft':
            case 'ArrowRight':
                return this._handleArrowLeftRight(event, scriptLine);

            case 'Enter':
                return this._handleEnter(event, scriptLine);

            case 'Tab':
                return this._handleTab(event, scriptLine);

            case 'Backspace':
            case 'Delete':
                return this._handleDelete(event, scriptLine);

            default:
                return false;
        }
    }

    _handleArrowUpDown(event, scriptLine) {
        event.preventDefault();
        this.selectionController.clear();

        const nextLine = event.key === 'ArrowUp'
            ? this.pageManager.getPreviousLine(scriptLine)
            : this.pageManager.getNextLine(scriptLine);

        if (nextLine) {
            this._focusLine(nextLine);
        }
        return true;
    }

    _handleArrowLeftRight(event, scriptLine) {
        const content = this._getLineContent(scriptLine);
        const offsets = this._getSelectionOffsets(scriptLine);
        if (!offsets) {
            return false;
        }

        const isAtStart = offsets.startOffset === 0;
        const isAtEnd = offsets.startOffset === content.length;

        if ((event.key === 'ArrowLeft' && isAtStart) || (event.key === 'ArrowRight' && isAtEnd)) {
            event.preventDefault();
            const direction = event.key === 'ArrowLeft' ? -1 : 1;
            const newFormat = getCircularFormat(scriptLine.getAttribute('data-format'), direction);
            const selectionState = this._captureSelection(scriptLine);
            this._applyFormatCommand(scriptLine, newFormat);
            this._restoreSelection(scriptLine, selectionState);
            return true;
        }

        return false;
    }

    _handleEnter(event, scriptLine) {
        event.preventDefault();
        event.stopPropagation();

        const content = scriptLine.textContent || '';     // DOM, not model
        const offsets = this._getSelectionOffsets(scriptLine);
        const cursorPos = offsets?.startOffset ?? content.length;
        const currentFormat = scriptLine.getAttribute('data-format');

        this.editController.handleEnter(scriptLine, event, { content, cursorPos, currentFormat });
        return true;
    }

    _handleTab(event, scriptLine) {
        event.preventDefault();

        const targetLine = event.shiftKey
            ? this.pageManager.getPreviousLine(scriptLine)
            : this.pageManager.getNextLine(scriptLine);

        // Apply dialog format after autocomplete acceptance
        if (this._autocompleteAccepted && targetLine) {
            const matchesLine = !this._autocompleteAcceptedLineId ||
                this._autocompleteAcceptedLineId === scriptLine.dataset?.lineId;
            if (matchesLine) {
                this._applyFormatCommand(targetLine, 'dialog');
            }
        }

        if (targetLine) {
            this._focusLine(targetLine);
        }

        this._autocompleteAccepted = false;
        this._autocompleteAcceptedLineId = null;
        return true;
    }

    _handleDelete(event, scriptLine) {
        const selectedLines = this.selectionController.getSelectedLines();
        const hasRangeSelection = this.selectionController.hasRangeSelection();

        // Multi-line deletion
        if (hasRangeSelection && selectedLines.length >= 1) {
            event.preventDefault();
            this.editController.enqueue(() =>
                this.editController.deleteSelectedLines(selectedLines, () => this.selectionController.clear())
            );
            return true;
        }

        // Boundary no-op check
        const offsets = this._getSelectionOffsets(scriptLine);
        const content = this._getLineContent(scriptLine);
        if (offsets && this.editController.isBoundaryDeleteNoop(event, scriptLine, {
            startOffset: offsets.startOffset,
            endOffset: offsets.endOffset,
            content
        })) {
            event.preventDefault();
            return true;
        }

        // Backspace at start: merge with previous
        if (event.key === 'Backspace' && this.editController.shouldMergeWithPrevious(
            scriptLine,
            (line) => this._isCaretAtLineStart(line),
            (line) => this._getLineContent(line)
        )) {
            event.preventDefault();
            this.editController.enqueue(() => this.editController.mergeLineWithPrevious(scriptLine));
            return true;
        }

        // Empty line deletion
        if (this._isLineEmpty(scriptLine)) {
            event.preventDefault();
            this.editController.enqueue(() =>
                this.editController.handleEmptyLineDelete(scriptLine, event.key === 'Backspace' ? 'previous' : 'next')
            );
            return true;
        }

        // Inline deletion
        if (offsets) {
            event.preventDefault();
            this.editController.handleInlineDeletion(event, scriptLine, {
                content,
                startOffset: offsets.startOffset,
                endOffset: offsets.endOffset
            });
            return true;
        }

        return false;
    }

    // ==============================================
    // Priority 4: Formatting
    // ==============================================

    _handleFormatting(event, scriptLine) {
        if (event.key === 'Tab' && !this.autocomplete?.currentSuggestion) {
            event.preventDefault();
            this.lineFormatter?.indent(scriptLine, event.shiftKey);
            return true;
        }
        return false;
    }

    // ==============================================
    // Helpers
    // ==============================================

    _getLineContent(scriptLine) {
        if (!scriptLine || !this.contentManager) {
            return '';
        }
        const lineId = scriptLine.dataset.lineId || this.contentManager.ensureLineId(scriptLine);
        return lineId ? this.contentManager.getLineContentById(lineId) : '';
    }

    _isLineEmpty(scriptLine) {
        if (!scriptLine || !this.contentManager) {
            return true;
        }
        const lineId = scriptLine.dataset.lineId || this.contentManager.ensureLineId(scriptLine);
        return !lineId || this.contentManager.isLineEmptyById(lineId);
    }

    _isCaretAtLineStart(scriptLine) {
        const selection = window.getSelection();
        if (!selection?.rangeCount || !selection.isCollapsed) {
            return false;
        }

        const offsets = this._getSelectionOffsets(scriptLine);
        return offsets?.startOffset === 0 && offsets?.endOffset === 0;
    }

    _getSelectionOffsets(scriptLine) {
        const selection = window.getSelection();
        if (!selection?.rangeCount) {
            return null;
        }

        const range = selection.getRangeAt(0);
        if (!scriptLine.contains(range.startContainer) || !scriptLine.contains(range.endContainer)) {
            return null;
        }

        const startOffset = this.domHandler
            ? this.domHandler.getLogicalCaretOffset(scriptLine, range.startContainer, range.startOffset)
            : this._getOffsetWithinLine(scriptLine, range.startContainer, range.startOffset);
        const endOffset = this.domHandler
            ? this.domHandler.getLogicalCaretOffset(scriptLine, range.endContainer, range.endOffset)
            : this._getOffsetWithinLine(scriptLine, range.endContainer, range.endOffset);

        return { startOffset, endOffset };
    }

    _getOffsetWithinLine(scriptLine, container, offset) {
        const range = document.createRange();
        range.setStart(scriptLine, 0);
        range.setEnd(container, offset);
        return range.toString().length;
    }

    _applyFormatCommand(scriptLine, format) {
        if (!scriptLine || !this.contentManager || !this.lineFormatter) {
            return null;
        }
        const lineId = scriptLine.dataset.lineId || this.contentManager.ensureLineId(scriptLine);
        return this.contentManager.applyFormat(lineId, { format });
    }

    _focusLine(line) {
        if (!line) {
            return;
        }

        try {
            line.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        } catch {
            // Ignore scroll errors
        }

        const range = document.createRange();
        const sel = window.getSelection();
        try {
            range.selectNodeContents(line);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        } catch {
            // Ignore focus errors
        }
    }

    _captureSelection(line) {
        const selection = window.getSelection();
        if (!selection?.rangeCount) {
            return null;
        }

        const range = selection.getRangeAt(0);
        if (!line.contains(range.startContainer) || !line.contains(range.endContainer)) {
            return null;
        }

        return {
            startContainer: range.startContainer,
            startOffset: range.startOffset,
            endContainer: range.endContainer,
            endOffset: range.endOffset
        };
    }

    _restoreSelection(line, selectionState) {
        if (!line) {
            return;
        }

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
        } catch {
            line.focus();
        }
    }

    // ==============================================
    // Public API (for compatibility)
    // ==============================================

    getSelectedLines() {
        return this.selectionController.getSelectedLines();
    }

    hasSelection() {
        return this.selectionController.hasSelection();
    }

    getSelectionCount() {
        return this.selectionController.getSelectionCount();
    }

    clearSelection() {
        this.selectionController.clear();
    }

    getCurrentFormat() {
        return 'dialog';
    }

    setFormat() {
        // No-op - format handled by EditorToolbar
    }

    canTransitionTo(format) {
        return this.formatFlow.includes(format);
    }

    getAvailableFormats() {
        return [...this.formatFlow];
    }

    getFSMStats() {
        return { currentFormat: 'dialog', availableFormats: this.formatFlow };
    }

    resetFSM() {
        // No-op
    }
}
