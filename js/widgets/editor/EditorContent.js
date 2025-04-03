import { BaseWidget } from '../BaseWidget.js';
import { LineFormatter } from './LineFormatter.js';
import { PageManager } from './PageManager.js';
import { Autocomplete } from './Autocomplete.js';
import { EventManager } from '../../core/EventManager.js';
import { ContentManager } from './content/ContentManager.js';
import { DOMManager } from './content/DOMManager.js';

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
        this.autocomplete = null;

        // Bind event handlers
        this._boundHandlers = {
            keydown: this.handleKeydown.bind(this),
            input: this.handleInput.bind(this),
            paste: this.handlePaste.bind(this),
            click: this.handleClick.bind(this),
            selectionChange: this.handleSelectionChange.bind(this)
        };
    }

    async initialize() {
        try {
            // Initialize DOM
            const editorArea = await this.domManager.initialize();
            this.editorArea = editorArea;
            console.log('EditorContent: Initialized with editor area:', editorArea);

            // Initialize page manager
            this.pageManager.setEditorArea(editorArea);

            // Set up the keydown handler in LineFormatter
            this.lineFormatter.setKeydownHandler(this._boundHandlers.keydown);

            // Initialize content manager
            this.contentManager = new ContentManager({
                editorArea,
                stateManager: this.stateManager,
                lineFormatter: this.lineFormatter,
                pageManager: this.pageManager,
                handleInput: this._boundHandlers.input,
                handlePaste: this._boundHandlers.paste,
                handleSelectionChange: this._boundHandlers.selectionChange
            });

            // Set up event listeners
            this.setupEventListeners();

            // Create initial line if no content
            const lines = this.editorArea.querySelectorAll('.script-line');
            if (lines.length === 0) {
                console.log('EditorContent: No lines found, creating initial header line');
                const initialLine = this.lineFormatter.createFormattedLine('header');
                initialLine.contentEditable = 'true';

                // Ensure page exists and add line
                if (!this.pageManager.hasPages()) {
                    console.log('EditorContent: No pages exist, creating initial page');
                    await this.pageManager._createInitialPage();
                }

                await this.pageManager.addLine(initialLine);
                console.log('EditorContent: Initial line added:', initialLine);

                // Ensure the line is properly added to DOM
                if (!this.editorArea.querySelector('.script-line')) {
                    console.warn('EditorContent: Initial line not found in DOM after adding');
                    const currentPage = this.pageManager.getCurrentPage();
                    if (currentPage) {
                        console.log('EditorContent: Adding line directly to current page');
                        currentPage.appendChild(initialLine);
                    }
                }

                // Set up initial state
                this.stateManager.setCurrentLine(initialLine);
                this.stateManager.setCurrentFormat('header');

                // Focus the line
                initialLine.focus();

                // Emit initial content
                const content = this.getContent();
                console.log('EditorContent: Emitting initial content:', content);
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

        console.log('EditorContent: Setting up event listeners');

        // Remove any existing listeners
        this.removeEventListeners();

        // Editor area level listeners for non-keydown events
        this.editorArea.addEventListener('input', this._boundHandlers.input);
        this.editorArea.addEventListener('paste', this._boundHandlers.paste);
        this.editorArea.addEventListener('click', this._boundHandlers.click);

        // Keep editor area non-editable
        this.editorArea.contentEditable = 'false';

        // Selection change at document level
        document.addEventListener('selectionchange', this._boundHandlers.selectionChange);

        console.log('EditorContent: Event listeners setup complete');
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

        // Handle shift+arrow keys
        if (event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            this.lineFormatter.handleShiftArrowKeys(event);
        }

        // Handle multi-line deletion
        if ((event.key === 'Delete' || event.key === 'Backspace') && this.selectedLines.size > 0) {
            event.preventDefault();

            // Get all selected lines
            const selectedLines = Array.from(this.selectedLines);

            // Check if first line is selected
            const firstLine = this.editorArea.querySelector('.script-line');
            if (selectedLines.includes(firstLine)) {
                // If first line is selected, keep it but clear its content
                firstLine.textContent = '';

                // Remove all other selected lines except first
                selectedLines.forEach(line => {
                    if (line !== firstLine) {
                        line.remove();
                    }
                });

                // Ensure first line is header format
                this.lineFormatter.setLineFormat(firstLine, 'header');

                // Focus first line
                firstLine.focus();
                this.stateManager.setCurrentLine(firstLine);
            } else {
                // Remove all selected lines if first line not included
                selectedLines.forEach(line => line.remove());

                // Focus on appropriate line
                const prevLine = selectedLines[0].previousElementSibling;
                const nextLine = selectedLines[selectedLines.length - 1].nextElementSibling;
                const lineToFocus = prevLine || nextLine;
                if (lineToFocus) {
                    lineToFocus.focus();
                    this.stateManager.setCurrentLine(lineToFocus);
                }
            }

            this.clearSelection();

            // Emit change event
            requestAnimationFrame(() => {
                const content = this.getContent();
                this.emit(EditorContent.EVENTS.CHANGE, content);
            });

            return;
        }

        // Handle single line backspace at start of line
        if (event.key === 'Backspace') {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            const isAtStart = range.startOffset === 0 &&
                (!range.startContainer.previousSibling ||
                    range.startContainer === scriptLine && !range.startContainer.textContent.trim());

            if (isAtStart) {
                const previousLine = scriptLine.previousElementSibling;
                // If this is first line or trying to merge with first line, prevent deletion
                if (!previousLine || !scriptLine.previousElementSibling) {
                    event.preventDefault();
                    return;
                }

                if (previousLine && previousLine.classList.contains('script-line')) {
                    event.preventDefault();

                    // Get the content to merge
                    const contentToMerge = scriptLine.textContent;

                    // Create a range at the end of the previous line
                    const newRange = document.createRange();
                    const lastTextNode = Array.from(previousLine.childNodes)
                        .filter(node => node.nodeType === Node.TEXT_NODE)
                        .pop() || previousLine;

                    newRange.setStart(lastTextNode, lastTextNode.length || 0);
                    newRange.setEnd(lastTextNode, lastTextNode.length || 0);

                    // Move cursor to end of previous line
                    selection.removeAllRanges();
                    selection.addRange(newRange);

                    // Merge content if any
                    if (contentToMerge.trim()) {
                        previousLine.textContent = previousLine.textContent + contentToMerge;
                    }

                    // Remove the current line if it's not the first line
                    if (scriptLine !== this.editorArea.querySelector('.script-line')) {
                        scriptLine.remove();
                    }

                    // Emit change event
                    requestAnimationFrame(() => {
                        const content = this.getContent();
                        this.emit(EditorContent.EVENTS.CHANGE, content);
                    });
                }
            }
        }

        if (event.key === 'Enter' && !event.shiftKey) {
            const handled = this.lineFormatter.handleEnterKey(event);
            if (handled) {
                // Emit change event after new line is created
                requestAnimationFrame(() => {
                    console.log('EditorContent: Enter key created new line, getting content');
                    const content = this.getContent();
                    console.log('EditorContent: Emitting CHANGE event with content:', content);
                    this.emit(EditorContent.EVENTS.CHANGE, content);
                });

                event.preventDefault();
                event.stopPropagation();
                return false;
            }
        }
    }

    handleInput(event) {
        if (event.inputType === 'insertCompositionText') return;

        console.log('EditorContent: Input event, getting content');
        // Get current content and emit change event
        const content = this.getContent();
        console.log('EditorContent: Emitting CHANGE event with content:', content);
        this.emit(EditorContent.EVENTS.CHANGE, content);

        // Trigger content manager update
        this.contentManager.debouncedContentUpdate();
    }

    handlePaste(event) {
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

        // Emit change event after paste
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
            this.editorArea.removeEventListener('paste', this._boundHandlers.paste);
            this.editorArea.removeEventListener('click', this._boundHandlers.click);
        }
    }

    // Public API methods
    setContent(content, isHistoryOperation = false) {
        this.contentManager.setContent(content, isHistoryOperation);
    }

    getContent() {
        console.log('EditorContent: Getting content from contentManager');
        const content = this.contentManager.getContent();
        console.log('EditorContent: Retrieved content:', content);
        return content;
    }

    setLineFormat(format) {
        this.contentManager.setLineFormat(format);
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
}

// Could improve performance by batching:
const batchUpdate = (operations) => {
    requestAnimationFrame(() => {
        operations.forEach(op => op());
    });
};