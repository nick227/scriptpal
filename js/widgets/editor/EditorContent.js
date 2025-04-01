import { BaseWidget } from '../BaseWidget.js';
import { LineFormatter } from './LineFormatter.js';
import { PageManager } from './PageManager.js';
import { Autocomplete } from './Autocomplete.js';
export class EditorContent extends BaseWidget {
    constructor(options) {
        if (!options || !options.editorContainer) {
            throw new Error('Editor container element is required');
        }
        if (!options.stateManager) {
            throw new Error('StateManager is required for EditorContent');
        }

        // Call super with required elements
        super({
            editorContainer: options.editorContainer
        });

        // Store container reference
        this.container = options.editorContainer;

        // Store state manager reference
        this.stateManager = options.stateManager;

        // Initialize components
        this.lineFormatter = null;
        this.pageManager = null;
        this.editorArea = null;
        this.autocomplete = null;

        // Initialize event system
        this._eventHandlers = new Map();
        this._eventTypes = Object.freeze({
            CHANGE: 'change',
            FORMAT_CHANGE: 'formatChange',
            PAGE_CHANGE: 'pageChange',
            LINE_CHANGE: 'lineChange',
            UNDO: 'undo',
            REDO: 'redo',
            ERROR: 'error',
            AUTOCOMPLETE: 'autocomplete'
        });

        // State tracking
        this._lastContent = '';
        this._pendingChanges = false;
        this._debounceTimeout = null;

        // Bind event handlers once
        this._boundHandlers = {
            keydown: this.handleKeydown.bind(this),
            input: this.handleInput.bind(this),
            click: this.handleClick.bind(this),
            selectionChange: this.handleSelectionChange.bind(this),
            autocomplete: this.handleAutocomplete.bind(this),
            paste: this.handlePaste.bind(this)
        };
    }

    validateElements() {
        if (!this.container || !(this.container instanceof HTMLElement)) {
            throw new Error('Editor container element is required and must be a valid HTMLElement');
        }
    }

    async initialize() {
        try {
            // Validate elements first
            this.validateElements();

            // Initialize components
            this.lineFormatter = new LineFormatter(this.stateManager);
            this.pageManager = new PageManager(this.stateManager);

            // Create editor area if it doesn't exist
            if (!this.editorArea) {
                this.editorArea = document.createElement('div');
                this.editorArea.className = 'editor-area';
                this.editorArea.setAttribute('role', 'textbox');
                this.editorArea.setAttribute('aria-multiline', 'true');
                this.editorArea.contentEditable = 'true';
                this.editorArea.spellcheck = false;
                this.container.appendChild(this.editorArea);
            }

            // Initialize autocomplete with editor area
            this.autocomplete = new Autocomplete(this.stateManager);
            this.autocomplete.setEditorArea(this.editorArea);
            this.autocomplete.on('autocomplete', this._boundHandlers.autocomplete);

            // Initialize page manager with editor area
            this.pageManager.setEditorArea(this.editorArea);
            await this.pageManager.initialize();

            // Set up event listeners
            this.setupEventListeners();

            // Create initial page if none exists
            if (!this.pageManager.hasPages()) {
                const initialPage = this.pageManager.createPage();
                const initialLine = this.lineFormatter.createFormattedLine();
                await this.pageManager.addLine(initialLine);
                this.stateManager.setCurrentLine(initialLine);
            }

            return true;
        } catch (error) {
            console.error('Failed to initialize EditorContent:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Remove existing listeners first
        this.removeEventListeners();

        // Set up editor area event listeners
        if (this.editorArea) {
            this.editorArea.addEventListener('click', this._boundHandlers.click);
            this.editorArea.addEventListener('keydown', this._boundHandlers.keydown);
            this.editorArea.addEventListener('input', this._boundHandlers.input);
            this.editorArea.addEventListener('paste', this._boundHandlers.paste);
            this.editorArea.addEventListener('focus', () => {
                const currentLine = this.stateManager.getCurrentLine();
                if (!currentLine) {
                    const line = this.lineFormatter.createFormattedLine();
                    this.pageManager.addLine(line);
                    this.stateManager.setCurrentLine(line);
                }
            });
        }

        // Add selection change listener
        document.addEventListener('selectionchange', this._boundHandlers.selectionChange);

        // Set up page manager event listeners
        this.pageManager.onPageChange((pageCount) => {
            this.emit(this._eventTypes.PAGE_CHANGE, pageCount);
        });
    }

    removeEventListeners() {
        if (this.editorArea) {
            this.editorArea.removeEventListener('click', this._boundHandlers.click);
            this.editorArea.removeEventListener('keydown', this._boundHandlers.keydown);
            this.editorArea.removeEventListener('input', this._boundHandlers.input);
            this.editorArea.removeEventListener('paste', this._boundHandlers.paste);
        }
        document.removeEventListener('selectionchange', this._boundHandlers.selectionChange);
    }

    handleClick(event) {
        const line = event.target.closest('.script-line');
        if (line) {
            this.stateManager.setCurrentLine(line);
        }
    }

    handleAutocomplete(event) {
        if (!this.autocomplete) return;

        const result = this.autocomplete.handleEvent(event);
        if (!result) return;

        // Emit appropriate events
        if (result.accepted) {
            this.emit(this._eventTypes.AUTOCOMPLETE, result);
            this.emit(this._eventTypes.CHANGE, this.getContent());
        } else if (result.cleared) {
            this.emit(this._eventTypes.AUTOCOMPLETE, result);
        } else if (result.partial) {
            this.emit(this._eventTypes.AUTOCOMPLETE, result);
        }
    }

    handleKeydown(event) {
        // Early return for modifier key combinations (except Tab)
        if ((event.ctrlKey || event.altKey || event.metaKey) && event.key !== 'Tab') {
            return this.handleShortcuts(event);
        }

        // Get current state
        const currentLine = this.stateManager.getCurrentLine();
        if (!currentLine) return;

        // Handle special keys
        switch (event.key) {
            case 'Tab':
            case 'Enter':
                if (this.autocomplete) {
                    const result = this.autocomplete.handleEvent(event);
                    if (result && result.accepted) {
                        event.preventDefault();
                        return true;
                    }
                }
                if (event.key === 'Enter') {
                    return this.handleEnterKey(event);
                }
                return false;
            default:
                // Handle other autocomplete events (character typing)
                if (this.autocomplete) {
                    this.handleAutocomplete(event);
                }
                return false;
        }
    }

    handleEnterKey(event) {
        // Capture manually typed term before creating new line
        const currentLine = this.stateManager.getCurrentLine();
        if (currentLine) {
            const lineFormat = currentLine.getAttribute('data-format');
            if (lineFormat === 'header' || lineFormat === 'speaker') {
                const term = currentLine.textContent.trim().toUpperCase();
                if (term && !this.autocomplete.hasStaticTerm(lineFormat, term)) {
                    this.stateManager.addAutocompleteTerm(lineFormat, term);
                }
            }
        }

        // Create new line
        return this.lineFormatter.handleEnterKey(event);
    }

    handleInput() {
        this.lineFormatter.handleInput();
        this._debouncedContentUpdate();
    }

    handlePaste(event) {
        event.preventDefault();
        const text = event.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    }

    handleShortcuts(event) {
        // Undo/Redo
        if (event.ctrlKey && !event.shiftKey) {
            if (event.key === 'z') {
                event.preventDefault();
                this.emit(this._eventTypes.UNDO);
                return true;
            }
            if (event.key === 'y') {
                event.preventDefault();
                this.emit(this._eventTypes.REDO);
                return true;
            }
        }

        // Format cycling
        if (event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            event.preventDefault();
            const currentLine = this.stateManager.getCurrentLine();
            if (!currentLine) return true;

            const currentFormat = this.lineFormatter.getFormatForLine(currentLine);
            const newFormat = this.lineFormatter.cycleFormat(
                currentFormat,
                event.key === 'ArrowUp' ? 'prev' : 'next'
            );

            this.lineFormatter.setLineFormat(currentLine, newFormat);
            this.emit(this._eventTypes.FORMAT_CHANGE, newFormat);
            return true;
        }

        return false;
    }

    // Content management
    setContent(content, isHistoryOperation = false) {
        if (!content) return;

        // Clear existing content
        this.clear();

        // Process lines in batches for better performance
        const lines = content.split('\n').filter(text => text.trim());
        const batchSize = 50;
        const batches = Math.ceil(lines.length / batchSize);

        for (let i = 0; i < batches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, lines.length);
            const batch = lines.slice(start, end);

            requestAnimationFrame(() => {
                batch.forEach(text => {
                    const line = this.lineFormatter.createFormattedLine();
                    line.textContent = text;
                    this.pageManager.addLine(line);
                });
            });
        }

        // Update state
        this.stateManager.setContent(content);

        // Only mark as dirty if this is not a history operation
        if (!isHistoryOperation) {
            this.stateManager.markDirty(true);
        }
    }

    getContent() {
        const lines = Array.from(this.editorArea.querySelectorAll('.script-line'));
        return lines.map(line => line.textContent).join('\n');
    }

    clear() {
        this.pageManager.clear();
        this.stateManager.setCurrentLine(null);
        this._lastContent = '';
        this._pendingChanges = false;
        if (this._debounceTimeout) {
            clearTimeout(this._debounceTimeout);
            this._debounceTimeout = null;
        }
    }

    // Line formatting
    setLineFormat(format) {
        const currentLine = this.stateManager.getCurrentLine();
        if (!currentLine) return;

        this.lineFormatter.setLineFormat(currentLine, format);
        this.emit(this._eventTypes.FORMAT_CHANGE, format);
    }

    // Debounced content update
    _debouncedContentUpdate() {
        if (this._debounceTimeout) {
            clearTimeout(this._debounceTimeout);
        }

        this._debounceTimeout = setTimeout(() => {
            const content = this.getContent();
            if (content !== this._lastContent) {
                this._lastContent = content;
                this.stateManager.setContent(content);
                this.stateManager.markDirty(true);
                this.emit(this._eventTypes.CHANGE, content);
            }
        }, 300);
    }

    // Event handlers
    onChange(callback) {
        this.on(this._eventTypes.CHANGE, callback);
    }

    onFormatChange(callback) {
        this.on(this._eventTypes.FORMAT_CHANGE, callback);
    }

    onPageChange(callback) {
        this.on(this._eventTypes.PAGE_CHANGE, callback);
    }

    onUndo(callback) {
        this.on(this._eventTypes.UNDO, callback);
    }

    onRedo(callback) {
        this.on(this._eventTypes.REDO, callback);
    }

    // Navigation
    scrollToPage(pageNumber) {
        const pages = this.stateManager.getPages();
        if (pageNumber >= 0 && pageNumber < pages.length) {
            const page = pages[pageNumber];
            page.scrollIntoView({ behavior: 'smooth' });
        }
    }

    getCurrentPage() {
        return this.pageManager.getCurrentPage();
    }

    // Cleanup
    async cleanup() {
        try {
            // Clean up timers
            if (this._debounceTimeout) {
                clearTimeout(this._debounceTimeout);
                this._debounceTimeout = null;
            }

            // Clean up event handlers
            this.removeEventListeners();

            // Clean up component handlers
            if (this._boundHandlers) {
                Object.keys(this._boundHandlers).forEach(key => {
                    this._boundHandlers[key] = null;
                });
                this._boundHandlers = null;
            }

            // Clean up event system
            if (this._eventHandlers) {
                this._eventHandlers.clear();
                this._eventHandlers = null;
            }

            // Clean up components
            if (this.pageManager) {
                await this.pageManager.destroy();
                this.pageManager = null;
            }

            if (this.lineFormatter) {
                this.lineFormatter = null;
            }

            if (this.autocomplete) {
                this.autocomplete.destroy();
                this.autocomplete = null;
            }

            // Clean up DOM
            if (this.editorArea) {
                this.editorArea.remove();
                this.editorArea = null;
            }

            // Reset state
            this.stateManager.setCurrentLine(null);
            this._lastContent = '';
            this._pendingChanges = false;

        } catch (error) {
            console.error('Error during cleanup:', error);
            throw error;
        }
    }

    destroy() {
        this.cleanup()
            .catch(error => console.error('Error during cleanup:', error))
            .finally(() => {
                super.destroy();
            });
    }

    getLineAtIndex(index) {
        const lines = this.editorArea.querySelectorAll('.script-line');
        return lines[index] || null;
    }

    scrollToPage(pageNumber) {
        this.pageManager.scrollToPage(pageNumber);
    }

    handleSelectionChange() {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        if (!range) return;

        // Find the selected line
        let selectedLine = null;
        const container = range.commonAncestorContainer;

        if (container instanceof Element) {
            selectedLine = container.closest('.script-line');
        } else if (container.parentElement) {
            selectedLine = container.parentElement.closest('.script-line');
        }

        if (selectedLine) {
            // Update current line in state manager
            this.stateManager.setCurrentLine(selectedLine);

            // Get format of selected line
            const format = this.lineFormatter.getFormatForLine(selectedLine);
            if (format && this._boundHandlers.formatChange) {
                this._boundHandlers.formatChange(format);
            }
        }
    }

    onSelectionChange(callback) {
        this._boundHandlers.selectionChange = callback;
    }

    onAutocomplete(callback) {
        this._boundHandlers.autocomplete = callback;
    }

    // Event emission methods
    emit(eventType, data) {
        const handler = this._eventHandlers.get(eventType);
        if (handler) {
            handler(data);
        }
    }

    // Event registration methods
    on(eventType, handler) {
        if (!this._eventTypes[eventType]) {
            throw new Error(`Invalid event type: ${eventType}`);
        }
        this._eventHandlers.set(eventType, handler);
    }

    off(eventType) {
        this._eventHandlers.delete(eventType);
    }
}

// Could improve performance by batching:
const batchUpdate = (operations) => {
    requestAnimationFrame(() => {
        operations.forEach(op => op());
    });
};