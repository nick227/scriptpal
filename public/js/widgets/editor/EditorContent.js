import { BaseWidget } from '../BaseWidget.js';
import { LineFormatter } from './LineFormatter.js';
import { PageManager } from './PageManager.js';
import { Autocomplete } from './Autocomplete.js';
import { EventManager } from '../../core/EventManager.js';
import { ContentManager } from './content/ContentManager.js';
import { DOMManager } from './content/DOMManager.js';
import { ContentEvents } from './content/ContentEvents.js';

export class EditorContent extends BaseWidget {
    static EVENTS = {
        CHANGE: 'EDITOR:CHANGE',
        FORMAT_CHANGE: 'EDITOR:FORMAT_CHANGE',
        PAGE_CHANGE: 'EDITOR:PAGE_CHANGE',
        LINE_CHANGE: 'EDITOR:LINE_CHANGE',
        LINE_ADDED: 'EDITOR:LINE_ADDED',
        UNDO: 'EDITOR:UNDO',
        REDO: 'EDITOR:REDO',
        ERROR: 'EDITOR:ERROR',
        AUTOCOMPLETE: 'EDITOR:AUTOCOMPLETE'
    };

    constructor(options) {
        if (!options || !options.editorContainer) {
            throw new Error('Editor container element is required');
        }
        if (!options.stateManager) {
            throw new Error('StateManager is required for EditorContent');
        }

        super({ editorContainer: options.editorContainer });

        // Store state manager reference
        this.stateManager = options.stateManager;

        // Initialize event system
        this._eventManager = new EventManager();

        // Add selection tracking
        this.selectedLines = new Set();
        this.selectionStart = null;

        // Initialize managers
        this.domManager = new DOMManager({
            container: options.editorContainer,
            stateManager: this.stateManager
        });

        // Initialize components
        this.lineFormatter = new LineFormatter(this.stateManager);
        this.pageManager = new PageManager(options.editorContainer);
        this.autocomplete = new Autocomplete(this.stateManager);

        // Initialize content events
        this.contentEvents = new ContentEvents({
            stateManager: this.stateManager,
            lineFormatter: this.lineFormatter,
            pageManager: this.pageManager,
            emitChange: () => {
                const content = this.getContent();
                this.emit(EditorContent.EVENTS.CHANGE, content);
            }
        });

        // Subscribe to content events
        this.contentEvents.on('formatChange', (format) => {
            this.emit(EditorContent.EVENTS.FORMAT_CHANGE, format);
        });

        this.contentEvents.on('selectionClear', () => {
            this.clearSelection();
        });

        // Bind event handlers
        this._boundHandlers = {
            keydown: this.handleKeydown.bind(this),
            input: this.handleInput.bind(this),
            import: this.handleImport.bind(this),
            click: this.handleClick.bind(this),
            selectionChange: this.handleSelectionChange.bind(this)
        };
    }

    async initialize() {
        try {
            // Initialize DOM
            const editorArea = await this.domManager.initialize();
            this.editorArea = editorArea;

            // Set up autocomplete
            this.autocomplete.setEditorArea(editorArea);

            // Initialize page manager with editor area
            this.pageManager.setEditorArea(editorArea);
            await this.pageManager.initialize();

            // Set up cursor update handler
            this.pageManager.onCursorUpdate(this._handleCursorUpdate.bind(this));

            // Set up page change handler
            this.pageManager.onPageChange((pageCount) => {
                this.emit(EditorContent.EVENTS.PAGE_CHANGE, pageCount);
            });

            // Set up the keydown handler in LineFormatter
            this.lineFormatter.setKeydownHandler(this._boundHandlers.keydown);

            // Initialize content manager
            this.contentManager = new ContentManager({
                editorArea,
                stateManager: this.stateManager,
                lineFormatter: this.lineFormatter,
                pageManager: this.pageManager,
                handleInput: this._boundHandlers.input,
                handleImport: this._boundHandlers.import,
                handleSelectionChange: this._boundHandlers.selectionChange
            });

            // Set up event listeners
            this.setupEventListeners();

            // Create initial line if no content
            const lines = this.editorArea.querySelectorAll('.script-line');
            if (lines.length === 0) {
                const initialLine = this.lineFormatter.createFormattedLine('header');
                initialLine.contentEditable = 'true';

                // Initialize page manager if not already done
                if (!this.pageManager.hasPages()) {
                    await this.pageManager.initialize();
                }

                // Add the initial line
                await this.pageManager.addLine(initialLine);

                // Set up initial state
                this.stateManager.setCurrentLine(initialLine);
                this.stateManager.setCurrentFormat('header');

                // Focus the line
                initialLine.focus();

                // Emit initial content
                const content = this.getContent();
                this.emit(EditorContent.EVENTS.CHANGE, content);
            }

            return true;
        } catch (error) {
            console.error('EditorContent: Initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        if (!this.editorArea) return;


        // Remove any existing listeners
        this.removeEventListeners();

        // Editor area level listeners for non-keydown events
        this.editorArea.addEventListener('input', this._boundHandlers.input);
        this.editorArea.addEventListener('import', this._boundHandlers.import);
        this.editorArea.addEventListener('click', this._boundHandlers.click);

        // Keep editor area non-editable
        this.editorArea.contentEditable = 'false';

        // Selection change at document level
        document.addEventListener('selectionchange', this._boundHandlers.selectionChange);

    }

    handleClick(event) {
        const scriptLine = event.target.closest('.script-line');
        if (!scriptLine) {
            this.clearSelection();
            return;
        }
        const notFirstLine = scriptLine.previousElementSibling !== null;

        if (event.shiftKey && this.selectionStart && notFirstLine) {
            // Get all lines between start and current
            const lines = Array.from(this.editorArea.querySelectorAll('.script-line'));
            const startIdx = lines.indexOf(this.selectionStart);
            const currentIdx = lines.indexOf(scriptLine);

            if (startIdx > -1 && currentIdx > -1) {
                // Clear only the previous shift-click selection, not the initial selection
                this.selectedLines.forEach(line => {
                    if (line !== this.selectionStart) {
                        line.classList.remove('selected');
                        this.selectedLines.delete(line);
                    }
                });

                // Select all lines in the range
                const [from, to] = startIdx < currentIdx ? [startIdx, currentIdx] : [currentIdx, startIdx];

                for (let i = from; i <= to; i++) {
                    this.selectLine(lines[i]);
                }
            }
        } else {
            // Regular click (no shift)
            this.clearSelection();
            this.selectionStart = scriptLine;
        }

        // Update state and format
        this.stateManager.setCurrentLine(scriptLine);
        const format = this.lineFormatter.getFormatForLine(scriptLine);
        this.stateManager.setCurrentFormat(format);
        this.emit(EditorContent.EVENTS.FORMAT_CHANGE, format);
    }

    handleKeydown(event) {
        const scriptLine = event.target.closest('.script-line');
        if (!scriptLine) return;

        // Update current line in state manager
        this.stateManager.setCurrentLine(scriptLine);

        // Try autocomplete only for Tab
        if (event.key === 'Tab') {
            const autocompleteResult = this.autocomplete.handleKeydown(event);
            if (autocompleteResult) {
                this.emit(EditorContent.EVENTS.AUTOCOMPLETE, autocompleteResult);
                return;
            }
        }

        // Handle shift+arrow keys for format cycling
        if (event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            event.preventDefault();
            event.stopPropagation();
            this.contentEvents.handleFormatCycle(scriptLine, event.key === 'ArrowUp' ? 'up' : 'down');
            return;
        }

        // Handle previous and next line if they exist
        if (!event.shiftKey && event.key === 'ArrowUp' && scriptLine.previousElementSibling) {
            this.stateManager.setCurrentLine(scriptLine.previousElementSibling);
            this.emit(EditorContent.EVENTS.LINE_CHANGE, scriptLine.previousElementSibling);
            scriptLine.previousElementSibling.focus();
        }
        if (!event.shiftKey && event.key === 'ArrowDown' && scriptLine.nextElementSibling) {
            this.stateManager.setCurrentLine(scriptLine.nextElementSibling);
            this.emit(EditorContent.EVENTS.LINE_CHANGE, scriptLine.nextElementSibling);
            scriptLine.nextElementSibling.focus();
        }

        // Handle multi-line deletion
        if ((event.key === 'Delete' || event.key === 'Backspace') && this.selectedLines.size > 0) {
            event.preventDefault();
            this.contentEvents.handleMultiLineDelete(Array.from(this.selectedLines), this.editorArea);
            return;
        }

        // Handle single line deletion
        if (event.key === 'Backspace' || event.key === 'Delete') {
            const selection = window.getSelection();
            if (!selection || !selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            const line = range.startContainer.nodeType === 3 ?
                range.startContainer.parentElement :
                range.startContainer;

            if (this.contentEvents.handleLineDelete(line, event)) {
                return;
            }
        }

        // Handle enter key
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            event.stopPropagation();

            const currentFormat = this.lineFormatter.getFormatForLine(scriptLine);
            const nextFormat = this.lineFormatter.getNextFlowFormat(currentFormat);

            this.contentEvents.handleEnterKey(scriptLine, window.getSelection(), nextFormat);
            return false;
        }
    }

    handleInput(event) {
        if (event.inputType === 'insertCompositionText') return;

        const currentLine = event.target.closest('.script-line');
        if (!currentLine) return;

        // Store current selection before any operations
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const offset = range.startOffset;

        // Get current content and emit change event
        const content = this.getContent();
        this.emit(EditorContent.EVENTS.CHANGE, content);

        // Trigger content manager update
        this.contentManager.debouncedContentUpdate();

        // Ensure focus is maintained
        if (document.activeElement !== currentLine) {
            currentLine.focus();
            const newRange = document.createRange();
            const textNode = currentLine.firstChild || currentLine;
            const newOffset = Math.min(offset, textNode.length || 0);
            newRange.setStart(textNode, newOffset);
            newRange.setEnd(textNode, newOffset);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
    }

    handleImport(event) {
        event.preventDefault();
        const text = event.clipboardData.getData('text/plain');
        if (!text) return;

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const fragment = document.createTextNode(text);
        range.deleteContents();
        range.insertNode(fragment);
        range.collapse(false);

        // Emit change event after import
        const content = this.getContent();
        this.emit(EditorContent.EVENTS.CHANGE, content);

        this.contentManager.debouncedContentUpdate();
    }

    handleSelectionChange() {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        if (!range) return;

        let selectedLine = null;
        const container = range.commonAncestorContainer;

        if (container instanceof Element) {
            selectedLine = container.closest('.script-line');
        } else if (container.parentElement) {
            selectedLine = container.parentElement.closest('.script-line');
        }

        if (selectedLine) {
            this.stateManager.setCurrentLine(selectedLine);
            const format = this.lineFormatter.getFormatForLine(selectedLine);
            this.stateManager.setCurrentFormat(format);
            this.emit(EditorContent.EVENTS.FORMAT_CHANGE, format);
        }
    }

    removeEventListeners() {
        // Remove document level listener
        document.removeEventListener('selectionchange', this._boundHandlers.selectionChange);

        if (this.editorArea) {
            // Remove editor area listeners
            this.editorArea.removeEventListener('input', this._boundHandlers.input);
            this.editorArea.removeEventListener('import', this._boundHandlers.import);
            this.editorArea.removeEventListener('click', this._boundHandlers.click);
        }
    }

    // Public API methods
    setContent(content, isHistoryOperation = false) {
        this.contentManager.setContent(content, isHistoryOperation);
    }

    getContent() {
        const content = this.contentManager.getContent();
        return content;
    }

    setLineFormat(format) {
        if (!this.contentManager) {
            console.error('EditorContent: ContentManager not initialized');
            return;
        }

        // Get current line from state manager
        const currentLine = this.stateManager.getCurrentLine();
        if (!currentLine) {
            console.warn('EditorContent: No current line selected');
            return;
        }

        try {
            // Apply new format using line formatter
            this.lineFormatter.setLineFormat(currentLine, format);

            // Update state
            this.stateManager.setCurrentFormat(format);

            // Emit format change event
            this.emit(EditorContent.EVENTS.FORMAT_CHANGE, format);

            // Emit content change event since format affects content
            const content = this.getContent();
            this.emit(EditorContent.EVENTS.CHANGE, content);
        } catch (error) {
            console.error('EditorContent: Error setting line format:', error);
            this.emit(EditorContent.EVENTS.ERROR, error);
        }
    }

    clear() {
        this.contentManager.clear();
    }

    // Event system methods
    emit(eventType, data) {
        this._eventManager.publish(eventType, data);
    }

    on(eventType, handler) {
        return this._eventManager.subscribe(eventType, handler, this);
    }

    off(eventType) {
        this._eventManager.unsubscribeAll(this);
    }

    // Event registration methods
    onChange(callback) { return this.on(EditorContent.EVENTS.CHANGE, callback); }
    onFormatChange(callback) { return this.on(EditorContent.EVENTS.FORMAT_CHANGE, callback); }
    onPageChange(callback) { return this.on(EditorContent.EVENTS.PAGE_CHANGE, callback); }
    onError(callback) { return this.on(EditorContent.EVENTS.ERROR, callback); }
    onUndo(callback) { return this.on(EditorContent.EVENTS.UNDO, callback); }
    onRedo(callback) { return this.on(EditorContent.EVENTS.REDO, callback); }

    // Cleanup
    destroy() {
        try {
            this.removeEventListeners();

            if (this.contentManager) this.contentManager.destroy();
            if (this.domManager) this.domManager.destroy();
            if (this.pageManager) this.pageManager.destroy();
            if (this.autocomplete) this.autocomplete.destroy();

            this._boundHandlers = null;
            this._eventManager.unsubscribeAll(this);

        } catch (error) {
            console.error('Error during cleanup:', error);
            throw error;
        } finally {
            super.destroy();
        }
    }

    // Add selection methods
    clearSelection() {
        this.selectedLines.forEach(line => {
            line.classList.remove('selected');
        });
        this.selectedLines.clear();
        this.selectionStart = null;
    }

    selectLine(line) {
        if (!line || !line.classList.contains('script-line')) return;
        line.classList.add('selected');
        this.selectedLines.add(line);
    }

    _handleCursorUpdate(line) {
        if (!line) return;

        // Set as current line
        this.stateManager.setCurrentLine(line);

        // Update format
        const format = this.lineFormatter.getFormatForLine(line);
        this.stateManager.setCurrentFormat(format);
        this.emit(EditorContent.EVENTS.FORMAT_CHANGE, format);

        // Focus line and move cursor to end
        if (document.activeElement !== line) {
            line.focus();
            const range = document.createRange();
            const selection = window.getSelection();

            // Move cursor to end of line
            if (line.lastChild && line.lastChild.nodeType === Node.TEXT_NODE) {
                range.setStart(line.lastChild, line.lastChild.length);
                range.setEnd(line.lastChild, line.lastChild.length);
            } else {
                range.selectNodeContents(line);
                range.collapse(false);
            }

            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
}

// Could improve performance by batching:
const batchUpdate = (operations) => {
    requestAnimationFrame(() => {
        operations.forEach(op => op());
    });
};