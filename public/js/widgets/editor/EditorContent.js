// Event types
import { EventManager } from '../../core/EventManager.js';
import { debugLog } from '../../core/logger.js';

// Autocomplete functionality now consolidated into EditorToolbar.js
import { EDITOR_EVENTS } from './constants.js';
import { KeyboardManager } from './keyboard/KeyboardManager.js';
import { ScriptDocument } from './model/ScriptDocument.js';

/**
 *
 */
export class EditorContent {
    /**
     *
     * @param options
     */
    constructor (options) {
        this.container = options.container;
        this.stateManager = options.stateManager;
        this.pageManager = options.pageManager;
        this.contentManager = null; // ContentManager functionality consolidated into this class
        this.lineFormatter = options.lineFormatter;
        this.domHandler = options.domHandler;
        this.document = new ScriptDocument();
        this.events = new EventManager();

        debugLog('[EditorContent] Dependencies:', {
            container: !!this.container,
            stateManager: !!this.stateManager,
            pageManager: !!this.pageManager,
            contentManager: !!this.contentManager,
            lineFormatter: !!this.lineFormatter,
            domHandler: !!this.domHandler
        });

        // Validate required dependencies
        if (!this.domHandler) {
            throw new Error('EditorContent: domHandler is required');
        }
        if (!this.lineFormatter) {
            throw new Error('EditorContent: lineFormatter is required');
        }

        // Initialize components
        // Autocomplete functionality now handled by EditorToolbar

        // Initialize content management
        this._contentUpdateTimeout = null;
        this._contentChangeTimeout = null;

        // Add content management methods
        this.debouncedContentUpdate = this._debouncedContentUpdate.bind(this);
        this.autocomplete = null;
        this.keyboardManager = new KeyboardManager({
            stateManager: this.stateManager,
            pageManager: this.pageManager,
            contentManager: this,
            lineFormatter: this.lineFormatter,
            autocomplete: this.autocomplete,
            saveService: null, // Will be set later via setSaveService
            history: null // Will be set later via setHistory
        });
        this.perfStats = {
            serializeCount: 0,
            serializeTotalMs: 0,
            renderCount: 0,
            renderTotalMs: 0
        };

        // Store callbacks
        this.callbacks = {
            onChange: options.onChange,
            onCursorMove: options.onCursorMove,
            onFormat: options.onFormat
        };

        // Bind methods
        this.handleContentChange = this.handleContentChange.bind(this);
        this.scheduleContentChange = this.scheduleContentChange.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handleClick = this.handleClick.bind(this);

        // Format changes are now command-based via document updates
    }

    on (eventType, handler) {
        return this.events.subscribe(eventType, handler);
    }

    off (eventType, handler) {
        this.events.unsubscribe(eventType, handler);
    }

    emit (eventType, data) {
        this.events.publish(eventType, data);
    }

    removeAllListeners () {
        this.events.clear();
    }

    /**
     *
     */
    async initialize () {
        try {
            const startTime = performance.now();

            // Phase 1: Critical setup
            await this.initializeCriticalPhase();

            // Phase 2: Event system setup
            await this.initializeEventPhase();

            // Phase 3: Optional features (deferred)
            this.deferOptionalFeatures();

            const endTime = performance.now();
            return true;
        } catch (error) {
            console.error('[EditorContent] ❌ Initialization failed:', error);
            return false;
        }
    }

    /**
     * Initialize critical components for basic functionality
     */
    async initializeCriticalPhase () {
        const phaseStartTime = performance.now();

        // Validate domHandler is available
        if (!this.domHandler) {
            throw new Error('DOM handler is not available');
        }

        // Initialize DOM handler
        await this.domHandler.initialize();

        // Get editor area
        this.editorArea = this.container.querySelector('.editor-area');
        debugLog('[EditorContent] Looking for editor area:', {
            container: this.container,
            editorArea: this.editorArea,
            containerHTML: this.container.innerHTML.substring(0, 200) + '...'
        });

        if (!this.editorArea) {
            console.error('[EditorContent] Editor area not found in container');
            throw new Error('Editor area not found');
        }

    }

    /**
     * Initialize event system
     */
    async initializeEventPhase () {
        const phaseStartTime = performance.now();

        // Initialize keyboard manager
        this.keyboardManager.initialize(this.editorArea);

        // Set up event listeners
        this.setupEventListeners();

    }

    /**
     * Defer optional features for performance
     */
    deferOptionalFeatures () {
        // Defer autocomplete initialization
        setTimeout(() => {
            if (this.autocomplete && typeof this.autocomplete.setEditorArea === 'function') {
                this.autocomplete.setEditorArea(this.editorArea);
            }
        }, 100);
    }

    /**
     *
     */
    setupEventListeners () {
        // Store event handlers for cleanup
        this._eventHandlers = {
            cursorMove: (position) => {
                this.emit(EDITOR_EVENTS.CURSOR_MOVE, position);
                if (this.callbacks.onCursorMove) {
                    this.callbacks.onCursorMove(position);
                }
            },
            formatChange: (format) => {
                this.emit(EDITOR_EVENTS.FORMAT_CHANGE, format);
                if (this.callbacks.onFormat) {
                    this.callbacks.onFormat(format);
                }
            },
            focusOut: (event) => {
                const { target } = event;
                if (target.classList.contains('script-line')) {
                    this.emit(EDITOR_EVENTS.FOCUS_OUT, event);
                }
            },
            input: (event) => {
                if (event.target.classList.contains('script-line')) {
                    this.syncLineContentFromDOM(event.target);
                    this.scheduleContentChange();
                }
            },
            keydown: (event) => {
                if (event.target.classList.contains('script-line')) {
                    this.handleKeydown(event);
                }
            },
            click: (event) => {
                if (event.target.classList.contains('script-line')) {
                    this.handleClick(event);
                }
            }
        };

        // Set up cursor move events
        this.domHandler.on(EDITOR_EVENTS.CURSOR_MOVE, this._eventHandlers.cursorMove);

        // Set up format change events
        this.domHandler.on(EDITOR_EVENTS.FORMAT_CHANGE, this._eventHandlers.formatChange);

        // Set up focus out events
        if (this.editorArea) {
            this.editorArea.addEventListener('focusout', this._eventHandlers.focusOut);

            // Use event delegation for line events to prevent memory leaks
            this.editorArea.addEventListener('input', this._eventHandlers.input);
            this.editorArea.addEventListener('keydown', this._eventHandlers.keydown);
            this.editorArea.addEventListener('click', this._eventHandlers.click);
        }
    }

    /**
     *
     * @param content
     */
    handleContentChange (content) {
        this.emit(EDITOR_EVENTS.CONTENT_CHANGE, content);
        if (this.callbacks.onChange) {
            this.callbacks.onChange(content);
        }
    }

    /**
     * Delegate keydown handling to KeyboardManager
     * @param {KeyboardEvent} event
     */
    handleKeydown (event) {
        if (this.keyboardManager && typeof this.keyboardManager._handleKeyDown === 'function') {
            this.keyboardManager._handleKeyDown(event);
        }
    }

    /**
     * Delegate click handling to KeyboardManager
     * @param {MouseEvent} event
     */
    handleClick (event) {
        if (this.keyboardManager && typeof this.keyboardManager._handleClick === 'function') {
            this.keyboardManager._handleClick(event);
        }
    }

    /**
     * Debounce full-content emission to avoid per-keystroke serialization.
     */
    scheduleContentChange () {
        if (this._contentChangeTimeout) {
            clearTimeout(this._contentChangeTimeout);
        }

        this._contentChangeTimeout = setTimeout(() => {
            const content = this.getContent();
            this.handleContentChange(content);
        }, 150);
    }

    /**
     *
     * @param content
     * @param root0
     * @param root0.isEdit
     * @param root0.preserveState
     * @param root0.source
     * @param root0.focus
     */
    async updateContent (content, { isEdit = false, preserveState = false, source = null, focus = false } = {}) {
        try {
            debugLog('[EditorContent] Starting content update:', {
                contentLength: content ? content.length : 0,
                isEdit,
                preserveState,
                source,
                focus
            });

            // Validate content before update
            if (content === null || content === undefined) {
                console.warn('[EditorContent] Invalid content provided');
                return false;
            }

            // For initial load, ensure DOM handler is initialized
            if (source === 'initial_load' && !this.domHandler.isInitialized) {
                await this.domHandler.initialize();
            }

            this.document = ScriptDocument.fromContent(content || '');
            this.ensureMinimumLine();

            const renderStart = performance.now();
            const success = await this.domHandler.renderDocument(this.document, {
                isEdit,
                preserveState,
                source,
                focus
            });
            const renderDuration = performance.now() - renderStart;
            this._recordPerf('render', renderDuration, source);

            if (!success) {
                console.error('[EditorContent] Failed to update DOM content');
                return false;
            }

            // Wait for a short delay to ensure DOM is updated
            await new Promise(resolve => setTimeout(resolve, 100));

            const serializeStart = performance.now();
            const contentValue = this.getContent();
            const serializeDuration = performance.now() - serializeStart;
            this._recordPerf('serialize', serializeDuration, source);
            // Emit content updated event first
            this.emit(EDITOR_EVENTS.CONTENT_UPDATED, {
                content: contentValue,
                source,
                timestamp: Date.now()
            });

            // Then emit content change event
            this.emit(EDITOR_EVENTS.CONTENT_CHANGE, {
                content: contentValue,
                source,
                timestamp: Date.now()
            });

            return true;
        } catch (error) {
            console.error('[EditorContent] Error updating content:', error);
            return false;
        }
    }

    /**
     *
     */
    getContent () {
        if (!this.document) {
            return '';
        }
        return this.document.toStorageString();
    }

    getPlainText () {
        if (!this.document) {
            return '';
        }
        return this.document.toPlainText();
    }

    getLines () {
        return this.document ? this.document.lines : [];
    }

    /**
     * Apply command-based edits to the editor content.
     * @param {Array} commands
     * @returns {Promise<object>}
     */
    async applyCommands (commands = [], options = {}) {
        if (!Array.isArray(commands) || commands.length === 0) {
            return { success: false, reason: 'no_commands' };
        }

        const results = [];
        const inverseCommands = [];
        const { source = 'ai_commands' } = options;

        const parseValue = (value) => {
            if (typeof value !== 'string') {
                return { format: 'action', content: '' };
            }

            const match = value.match(/<([\w-]+)>([\s\S]*)<\/\1>/);
            if (!match) {
                return { format: 'action', content: value };
            }

            return {
                format: match[1].toLowerCase(),
                content: match[2]
            };
        };

        const addCommands = commands.filter(cmd => cmd.command === 'ADD')
            .sort((a, b) => a.lineNumber - b.lineNumber);
        const otherCommands = commands.filter(cmd => cmd.command !== 'ADD')
            .sort((a, b) => b.lineNumber - a.lineNumber);

        const orderedCommands = [...otherCommands, ...addCommands];

        for (const cmd of orderedCommands) {
            const { command, lineNumber, value } = cmd;
            try {
                if (command === 'DELETE') {
                    const removed = this.document.removeLineByIndex(lineNumber - 1);
                    if (!removed) {
                        throw new Error(`Line ${lineNumber} not found`);
                    }
                    inverseCommands.unshift({
                        command: 'ADD',
                        lineNumber: Math.max(0, lineNumber - 1),
                        value: `<${removed.format}>${removed.content}</${removed.format}>`
                    });
                } else if (command === 'EDIT') {
                    const line = this.document.lines[lineNumber - 1];
                    if (!line) {
                        throw new Error(`Line ${lineNumber} not found`);
                    }
                    inverseCommands.unshift({
                        command: 'EDIT',
                        lineNumber,
                        value: `<${line.format}>${line.content}</${line.format}>`
                    });
                    const parsed = parseValue(value);
                    this.document.updateLine(line.id, {
                        format: parsed.format,
                        content: parsed.content
                    });
                } else if (command === 'ADD') {
                    const parsed = parseValue(value);
                    const insertIndex = Math.min(this.document.lines.length, Math.max(0, lineNumber));
                    const added = this.document.insertLineAt(insertIndex, {
                        format: parsed.format,
                        content: parsed.content
                    });
                    inverseCommands.unshift({
                        command: 'DELETE',
                        lineNumber: insertIndex + 1
                    });
                    if (!added) {
                        throw new Error(`Failed to add line at ${insertIndex}`);
                    }
                } else {
                    throw new Error(`Unknown command type: ${command}`);
                }

                results.push({ success: true, command: cmd });
            } catch (error) {
                console.error('[EditorContent] Command apply failed:', error);
                results.push({ success: false, command: cmd, error: error.message });
            }
        }

        this.ensureMinimumLine();

        const renderStart = performance.now();
        await this.domHandler.renderDocument(this.document, { source, allowInPlace: true, skipFocus: true });
        const renderDuration = performance.now() - renderStart;
        this._recordPerf('render', renderDuration, source);

        const serializeStart = performance.now();
        const content = this.getContent();
        const serializeDuration = performance.now() - serializeStart;
        this._recordPerf('serialize', serializeDuration, source);
        this.emit(EDITOR_EVENTS.CONTENT_UPDATED, { content, source, timestamp: Date.now() });
        this.emit(EDITOR_EVENTS.CONTENT_CHANGE, { content, source, timestamp: Date.now() });

        return { success: true, results, content, inverseCommands };
    }

    /**
     * Set format for the current line
     * @param format
     */
    setCurrentLineFormat (format) {
        const currentLine = this.domHandler.getCurrentLine();
        if (!currentLine || !this.lineFormatter.isValidFormat(format)) {
            return;
        }
        const lineId = currentLine.dataset.lineId || this.ensureLineId(currentLine);
        this.applyFormat(lineId, { format });
    }

    /**
     *
     * @param direction
     */
    cycleFormat (direction = 1) {
        const currentLine = this.domHandler.getCurrentLine();
        if (!currentLine) return;
        const lineId = currentLine.dataset.lineId || this.ensureLineId(currentLine);
        this.applyFormat(lineId, { direction });
    }

    /**
     * Apply a format change by explicit format or direction.
     * @param {string} lineId
     * @param {object} options
     * @param {string} [options.format]
     * @param {number} [options.direction]
     */
    applyFormat (lineId, { format, direction } = {}) {
        if (!lineId) {
            return null;
        }

        const line = this.document.getLineById(lineId);
        const currentFormat = line?.format || this.lineFormatter.DEFAULT_FORMAT;
        const nextFormat = format || this.lineFormatter.getNextFormatInFlow(currentFormat, direction || 1);
        const command = this.lineFormatter.setLineFormat(lineId, nextFormat);
        if (command) {
            this.applyFormatCommand(command);
        }
        return command;
    }

    /**
     *
     */
    clearSelection () {
        const selection = window.getSelection();
        selection.removeAllRanges();
    }

    /**
     * Set the save service for auto-save functionality
     * @param {EditorSaveService} saveService - The save service instance
     */
    setSaveService (saveService) {
        if (this.keyboardManager) {
            this.keyboardManager.saveService = saveService;
        }
    }

    /**
     * Set the history service for undo/redo functionality
     * @param {EditorHistory} history - The history service instance
     */
    setHistory (history) {
        if (this.keyboardManager) {
            this.keyboardManager.history = history;
        }
    }

    /**
     * @param {HTMLElement} lineElement
     */
    syncLineContentFromDOM (lineElement) {
        if (!lineElement || !lineElement.classList.contains('script-line')) {
            return;
        }

        const lineId = this.ensureLineId(lineElement);
        const content = lineElement.textContent || '';
        const format = lineElement.getAttribute('data-format') || 'action';
        const existing = this.document.getLineById(lineId);
        if (existing && existing.content === content && existing.format === format) {
            return;
        }
        this.document.updateLine(lineId, { content, format });
    }

    /**
     * @param {HTMLElement} lineElement
     */
    ensureLineId (lineElement) {
        if (lineElement.dataset.lineId) {
            return lineElement.dataset.lineId;
        }

        const lines = this.editorArea.querySelectorAll('.script-line');
        let index = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i] === lineElement) {
                index = i;
                break;
            }
        }
        const existing = index >= 0 ? this.document.lines[index] : null;
        if (existing) {
            lineElement.dataset.lineId = existing.id;
            debugLog('[EditorContent] Bound lineId from document:', {
                lineId: existing.id,
                index,
                format: existing.format
            });
            return existing.id;
        }

        const lineId = ScriptDocument.createLineId();
        lineElement.dataset.lineId = lineId;
        this.document.insertLineAt(index, {
            id: lineId,
            format: lineElement.getAttribute('data-format') || 'action',
            content: lineElement.textContent || ''
        });
        console.warn('[EditorContent] Created new lineId for DOM line:', {
            lineId,
            index,
            format: lineElement.getAttribute('data-format') || 'action'
        });
        return lineId;
    }

    /**
     * @param {object} command
     */
    applyFormatCommand (command) {
        if (!command || command.type !== 'setFormat') {
            return null;
        }

        const updated = this.document.updateLine(command.lineId, {
            format: command.format
        });
        if (!updated) {
            return null;
        }

        this.domHandler.updateLineById(command.lineId, {
            format: command.format
        });

        this.stateManager.setCurrentFormat(command.format);
        const content = this.getContent();
        this.emit(this.constructor.EVENTS.CHANGE, content);
        this.emit(this.constructor.EVENTS.FORMAT_CHANGE, command.format);
        this.debouncedContentUpdate();

        return updated;
    }

    /**
     * @param {string} lineId
     * @param {object} options
     */
    async insertLineAfter (lineId, options = {}) {
        const { format = 'action', content = '', updateCurrentContent, focus = true } = options;
        if (updateCurrentContent !== undefined) {
            this.document.updateLine(lineId, { content: updateCurrentContent });
        }

        const wasLastLine = this.document.getLineIndex(lineId) === this.document.lines.length - 1;
        const newLine = this.document.insertLineAfter(lineId, { format, content });
        const requiredPages = this._getRequiredPageCount();
        const currentPages = this.pageManager.getPageCount();
        const canIncremental = wasLastLine && requiredPages === currentPages;

        if (updateCurrentContent !== undefined) {
            this.domHandler.updateLineById(lineId, { content: updateCurrentContent });
        }

        if (canIncremental && newLine) {
            this.domHandler.appendLine({
                id: newLine.id,
                format: newLine.format,
                text: newLine.content
            });
        } else {
            await this.domHandler.renderDocument(this.document, { source: 'line_insert', allowInPlace: true, skipFocus: true });
        }

        if (focus && newLine) {
            this.domHandler.focusLineById(newLine.id, { position: 'start' });
        }
        const updatedContent = this.getContent();
        this.emit(EDITOR_EVENTS.CONTENT_CHANGE, updatedContent);
        this.debouncedContentUpdate();
        return newLine;
    }

    /**
     * @param {string[]} lineIds
     * @param {object} options
     */
    async deleteLinesById (lineIds = [], options = {}) {
        if (!Array.isArray(lineIds) || lineIds.length === 0) {
            return null;
        }

        const remainingFocusId = options.focusLineId || null;
        const targetLineId = lineIds.length === 1 ? lineIds[0] : null;
        const targetIndex = targetLineId ? this.document.getLineIndex(targetLineId) : -1;
        const wasLastLine = targetIndex === this.document.lines.length - 1;

        lineIds.forEach(lineId => this.document.removeLineById(lineId));
        this.ensureMinimumLine();

        const requiredPages = this._getRequiredPageCount();
        const currentPages = this.pageManager.getPageCount();
        const canIncremental = targetLineId &&
            lineIds.length === 1 &&
            wasLastLine &&
            requiredPages === currentPages &&
            this.document.lines.length > 0;

        if (canIncremental) {
            this.domHandler.removeLineById(targetLineId);
        } else {
            await this.domHandler.renderDocument(this.document, { source: 'line_delete', allowInPlace: true, skipFocus: true });
        }

        if (remainingFocusId) {
            this.domHandler.focusLineById(remainingFocusId, { position: 'end' });
        }
        const content = this.getContent();
        this.emit(EDITOR_EVENTS.CONTENT_CHANGE, content);
        this.debouncedContentUpdate();
        return true;
    }

    ensureMinimumLine () {
        if (this.document.lines.length === 0) {
            this.document.insertLineAt(0, { format: 'action', content: '' });
        }
    }

    _getRequiredPageCount () {
        return Math.ceil(this.document.lines.length / this.pageManager.maxLinesPerPage);
    }

    /**
     * @param {string} lineId
     */
    getLineById (lineId) {
        return this.document.getLineById(lineId);
    }

    /**
     * @param {string} lineId
     * @param {object} updates
     */
    updateLineById (lineId, updates = {}) {
        const updated = this.document.updateLine(lineId, updates);
        if (!updated) {
            return null;
        }
        this.domHandler.updateLineById(lineId, updates);
        const content = this.getContent();
        this.emit(EDITOR_EVENTS.CONTENT_CHANGE, content);
        this.debouncedContentUpdate();
        return updated;
    }

    /**
     * @param {string} lineText
     */
    getLineFormat (lineText) {
        const match = lineText.match(/<([\w-]+)>([\s\S]*)<\/\1>/);
        if (!match) {
            return 'action';
        }
        return match[1].toLowerCase();
    }

    getChapterCount () {
        return this.document.lines.filter(line => line.format === 'chapter-break').length;
    }

    /**
     * @param {string} content
     * @param {number} startPosition
     * @param {number} endPosition
     * @param {string} format
     */
    async replaceContentRange (content, startPosition, endPosition, format = 'action') {
        const line = this.document.replaceRange(startPosition, endPosition, {
            format,
            content
        });

        await this.domHandler.renderDocument(this.document, { source: 'replace_range', allowInPlace: true, skipFocus: true });

        if (line) {
            this.domHandler.focusLineById(line.id, { position: 'end' });
        }

        const updatedContent = this.getContent();
        this.emit(EDITOR_EVENTS.CONTENT_CHANGE, updatedContent);

        return line;
    }

    /**
     *
     */
    destroy () {
        // Remove event listeners
        if (this._eventHandlers) {
            if (this.domHandler) {
                this.domHandler.off(EDITOR_EVENTS.CURSOR_MOVE, this._eventHandlers.cursorMove);
                this.domHandler.off(EDITOR_EVENTS.FORMAT_CHANGE, this._eventHandlers.formatChange);
            }

            if (this.editorArea) {
                this.editorArea.removeEventListener('focusout', this._eventHandlers.focusOut);
                this.editorArea.removeEventListener('input', this._eventHandlers.input);
                this.editorArea.removeEventListener('keydown', this._eventHandlers.keydown);
                this.editorArea.removeEventListener('click', this._eventHandlers.click);
            }

            this._eventHandlers = null;
        }

        if (this._contentUpdateTimeout) {
            clearTimeout(this._contentUpdateTimeout);
            this._contentUpdateTimeout = null;
        }

        // Clean up keyboard manager
        if (this.keyboardManager) {
            this.keyboardManager.destroy();
        }

        // Clean up autocomplete
        if (this.autocomplete) {
            this.autocomplete.destroy();
        }

        // Clean up DOM handler
        if (this.domHandler) {
            this.domHandler.destroy();
        }

        // Clean up line formatter
        if (this.lineFormatter) {
            this.lineFormatter.destroy();
        }

        // Remove all event listeners
        this.removeAllListeners();

        // Clear references
        this.container = null;
        this.editorArea = null;
        this.stateManager = null;
        this.pageManager = null;
        this.lineFormatter = null;
        this.domHandler = null;
        this.keyboardManager = null;
        this.autocomplete = null;
        this.callbacks = null;
        this.events = null;
    }

    // ==============================================
    // AI Content Manipulation Methods
    // ==============================================

    /**
     * Append content to the end of the script
     * @param {string} content - Content to append
     * @param {string} format - Format for the content
     * @returns {Promise<object>} - Result of the operation
     */
    async appendContent (content, format = 'action') {
        try {

            const newLine = this.document.insertLineAt(this.document.lines.length, {
                format,
                content
            });

            await this.domHandler.renderDocument(this.document, { source: 'append' });

            const domLine = newLine ?
                this.domHandler.focusLineById(newLine.id, { position: 'end' }) :
                null;

            // Emit content change event
            this.emit('contentChanged', {
                type: 'append',
                content: content,
                format: format,
                element: domLine
            });
            const contentValue = this.getContent();
            this.emit(EDITOR_EVENTS.CONTENT_CHANGE, contentValue);
            this.debouncedContentUpdate();

            return { success: true, element: domLine, line: newLine };
        } catch (error) {
            console.error('[EditorContent] Failed to append content:', error);
            throw error;
        }
    }

    /**
     * Prepend content to the beginning of the script
     * @param {string} content - Content to prepend
     * @param {string} format - Format for the content
     * @returns {Promise<object>} - Result of the operation
     */
    async prependContent (content, format = 'action') {
        try {

            const newLine = this.document.insertLineAt(0, {
                format,
                content
            });

            await this.domHandler.renderDocument(this.document, { source: 'prepend' });

            const domLine = newLine ?
                this.domHandler.focusLineById(newLine.id, { position: 'end' }) :
                null;

            // Emit content change event
            this.emit('contentChanged', {
                type: 'prepend',
                content: content,
                format: format,
                element: domLine
            });
            const contentValue = this.getContent();
            this.emit(EDITOR_EVENTS.CONTENT_CHANGE, contentValue);
            this.debouncedContentUpdate();

            return { success: true, element: domLine, line: newLine };
        } catch (error) {
            console.error('[EditorContent] Failed to prepend content:', error);
            throw error;
        }
    }

    /**
     * Insert content at a specific position
     * @param {string} content - Content to insert
     * @param {number} position - Position to insert at
     * @param {string} format - Format for the content
     * @returns {Promise<object>} - Result of the operation
     */
    async insertContentAt (content, position, format = 'action') {
        try {

            const newLine = this.document.insertLineAt(position, {
                format,
                content
            });

            await this.domHandler.renderDocument(this.document, { source: 'insert' });

            const domLine = newLine ?
                this.domHandler.focusLineById(newLine.id, { position: 'end' }) :
                null;

            // Emit content change event
            this.emit('contentChanged', {
                type: 'insert',
                content: content,
                format: format,
                position: position,
                element: domLine
            });
            const contentValue = this.getContent();
            this.emit(EDITOR_EVENTS.CONTENT_CHANGE, contentValue);
            this.debouncedContentUpdate();

            return { success: true, element: domLine, line: newLine };
        } catch (error) {
            console.error('[EditorContent] Failed to insert content:', error);
            throw error;
        }
    }

    /**
     * Create a new line element
     * @param {string} content - Content for the line
     * @param {string} format - Format for the line
     * @returns {HTMLElement} - The created line element
     */
    createLineElement (content, format = 'action', lineId = null) {
        const line = document.createElement('div');
        line.className = 'script-line';
        line.dataset.format = format;
        if (lineId) {
            line.dataset.lineId = lineId;
        }
        line.setAttribute('role', 'textbox');
        line.setAttribute('aria-label', `${format} line`);
        line.setAttribute('data-enable-grammarly', 'false');
        line.contentEditable = 'true';
        line.classList.add(`format-${format}`);

        // Set content
        line.textContent = content;

        // Event listeners will be handled by event delegation in setupEventListeners
        // This prevents memory leaks from individual line listeners

        return line;
    }

    /**
     * Get current content from the editor
     * @returns {string} Current editor content
     */
    _getContent () {
        return this.getContent();
    }

    /**
     * Debounced content update
     */
    _debouncedContentUpdate () {
        if (this._contentUpdateTimeout) {
            clearTimeout(this._contentUpdateTimeout);
        }

        this._contentUpdateTimeout = setTimeout(() => {
            const content = this._getContent();
            this.emit(EDITOR_EVENTS.CONTENT_CHANGE, content);
        }, 300);
    }

    _recordPerf (type, duration, source) {
        if (type === 'render') {
            this.perfStats.renderCount += 1;
            this.perfStats.renderTotalMs += duration;
        } else if (type === 'serialize') {
            this.perfStats.serializeCount += 1;
            this.perfStats.serializeTotalMs += duration;
        }
    }
}
