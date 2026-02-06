import { EventManager } from '../../core/EventManager.js';
import { debugLog } from '../../core/logger.js';

import { AutocompleteManager } from './AutocompleteManager.js';
import { EDITOR_EVENTS } from './constants.js';
import { EditorDocumentService } from './EditorDocumentService.js';
import { EditorInputController } from './EditorInputController.js';
import { EditorRenderController } from './EditorRenderController.js';

/**
 * Orchestrates editor services and phases.
 */
export class EditorCoordinator {
    /**
     * @param options
     */
    constructor(options) {
        this.container = options.container;
        this.stateManager = options.stateManager;
        this.pageManager = options.pageManager;
        this.lineFormatter = options.lineFormatter;
        this.domHandler = options.domHandler;
        this.documentService = new EditorDocumentService();
        this.renderController = new EditorRenderController({
            domHandler: this.domHandler,
            pageManager: this.pageManager
        });
        this.inputController = new EditorInputController({
            stateManager: this.stateManager,
            pageManager: this.pageManager,
            lineFormatter: this.lineFormatter,
            domHandler: this.domHandler,
            contentManager: this
        });

        this.events = new EventManager();
        this.autocomplete = null;

        this._contentUpdateTimeout = null;
        this._contentPersistTimeout = null;
        this._persistDelay = 300;
        this._opQueue = Promise.resolve();
        this._pendingFocus = null;
        this._domHandlerEditIntentHandler = null;

        this.callbacks = {
            onChange: options.onChange,
            onCursorMove: options.onCursorMove,
            onFormat: options.onFormat
        };

        this.perfStats = {
            serializeCount: 0,
            serializeTotalMs: 0,
            renderCount: 0,
            renderTotalMs: 0
        };
    }

    /**
     *
     * @param eventType
     * @param handler
     */
    on(eventType, handler) {
        return this.events.subscribe(eventType, handler);
    }

    /**
     *
     * @param eventType
     * @param handler
     */
    off(eventType, handler) {
        this.events.unsubscribe(eventType, handler);
    }

    /**
     *
     * @param eventType
     * @param data
     */
    emit(eventType, data) {
        this.events.publish(eventType, data);
    }

    /**
     *
     */
    removeAllListeners() {
        this.events.clear();
    }

    /**
     *
     */
    async initialize() {
        try {
            await this.initializeCriticalPhase();
            await this.initializeEventPhase();
            this.deferOptionalFeatures();
            return true;
        } catch (error) {
            console.error('[EditorCoordinator] ❌ Initialization failed:', error);
            return false;
        }
    }

    /**
     *
     */
    async initializeCriticalPhase() {
        // Phase 1: Validate dependencies + DOM
        if (!this.domHandler) {
            throw new Error('EditorCoordinator: domHandler is required');
        }
        if (!this.lineFormatter) {
            throw new Error('EditorCoordinator: lineFormatter is required');
        }

        await this.domHandler.initialize();

        this.editorArea = this.container.querySelector('.editor-area');
        if (!this.editorArea) {
            console.error('[EditorCoordinator] Editor area not found in container');
            throw new Error('Editor area not found');
        }

        // Phase 2: Adapters
        if (!this.autocomplete) {
            this.autocomplete = new AutocompleteManager({
                contentManager: this,
                stateManager: this.stateManager,
                editorArea: this.editorArea
            });
            this.autocomplete.initialize();
        } else if (typeof this.autocomplete.setEditorArea === 'function') {
            this.autocomplete.setEditorArea(this.editorArea);
        }

        this.inputController.setAutocomplete(this.autocomplete);
        this.inputController.setContentManager(this);
    }

    /**
     *
     */
    async initializeEventPhase() {
        // Phase 3: Input routing
        this.inputController.setCallbacks({
            onCursorMove: (position) => {
                this.emit(EDITOR_EVENTS.CURSOR_MOVE, position);
                this.emit('cursorMoved', position);
                if (this.callbacks.onCursorMove) {
                    this.callbacks.onCursorMove(position);
                }
                if (this.autocomplete && position?.line) {
                    this.autocomplete.updateSuggestionForLine(position.line);
                }
            },
            onFormatChange: (payload) => {
                const format = payload && typeof payload === 'object' ? payload.format : payload;
                const lineElement = payload && typeof payload === 'object' ? payload.line : null;
                this.emit(EDITOR_EVENTS.FORMAT_CHANGE, format);
                if (this.callbacks.onFormat) {
                    this.callbacks.onFormat(format);
                }
                if (this.autocomplete && lineElement) {
                    this.autocomplete.updateSuggestionForLine(lineElement);
                }
            },
            onFocusOut: (event) => {
                const { target } = event;
                if (target.classList.contains('script-line')) {
                    this.emit(EDITOR_EVENTS.FOCUS_OUT, event);
                }
                if (this.autocomplete) {
                    this.autocomplete.clearSuggestion();
                }
            },
            onFocusIn: (event) => {
                const { target } = event;
                if (target.classList.contains('script-line') && this.autocomplete) {
                    this.autocomplete.updateSuggestionForLine(target);
                }
            },
            onInput: (event) => {
                if (event.target.classList.contains('script-line')) {
                    this.syncLineContentFromDOM(event.target);
                    if (this.autocomplete) {
                        this.autocomplete.updateSuggestionForLine(event.target);
                    }
                }
            }
        });

        this.inputController.initialize(this.editorArea);

        if (this.domHandler) {
            this._domHandlerEditIntentHandler = (payload) => {
                this._handleEditIntent(payload);
            };
            this.domHandler.on('editIntent', this._domHandlerEditIntentHandler);
        }
    }

    /**
     *
     */
    deferOptionalFeatures() {
        setTimeout(() => {
            if (this.autocomplete && typeof this.autocomplete.setEditorArea === 'function') {
                this.autocomplete.setEditorArea(this.editorArea);
            }
        }, 100);
    }

    /**
     * Phase 1: Interpret input
     * Phase 2: Mutate document
     * Phase 3: Render
     * Phase 4: Emit + persist
     * @param content
     * @param root0
     * @param root0.isEdit
     * @param root0.preserveState
     * @param root0.source
     * @param root0.focus
     */
    async updateContent(content, { isEdit = false, preserveState = false, source = null, focus = false } = {}) {
        try {
            if (content === null || content === undefined) {
                console.warn('[EditorCoordinator] Invalid content provided');
                return false;
            }

            if (source === 'initial_load' && !this.domHandler.isInitialized) {
                await this.domHandler.initialize();
            }

            this.documentService.setContent(content || '');

            const renderStart = performance.now();
            const success = await this.renderController.renderDocument(this.documentService.getDocument(), {
                isEdit,
                preserveState,
                source,
                focus
            });
            const renderDuration = performance.now() - renderStart;
            this._recordPerf('render', renderDuration, source);

            if (!success) {
                console.error('[EditorCoordinator] Failed to update DOM content');
                return false;
            }

            await new Promise(resolve => setTimeout(resolve, 100));
            this._emitContentChange({ source });
            this.refreshSpeakerSuggestions();
            return true;
        } catch (error) {
            console.error('[EditorCoordinator] Error updating content:', error);
            return false;
        }
    }

    /**
     *
     */
    getContent() {
        return this.documentService.getContent();
    }

    /**
     *
     */
    getPlainText() {
        return this.documentService.getPlainText();
    }

    /**
     *
     */
    getLines() {
        return this.documentService.getLines();
    }

    /**
     *
     * @param lineId
     */
    getLineById(lineId) {
        return this.documentService.getLineById(lineId);
    }

    /**
     *
     * @param lineId
     */
    getLineContentById(lineId) {
        return this.documentService.getLineContentById(lineId);
    }

    /**
     *
     * @param lineId
     */
    isLineEmptyById(lineId) {
        return this.documentService.isLineEmptyById(lineId);
    }

    /**
     *
     * @param lineId
     */
    getLineIndex(lineId) {
        return this.documentService.getLineIndex(lineId);
    }

    /**
     *
     */
    getLineCount() {
        return this.documentService.getLineCount();
    }

    /**
     *
     */
    getWordCount() {
        return this.documentService.getWordCount();
    }

    /**
     *
     */
    getCharacterCount() {
        return this.documentService.getCharacterCount();
    }

    /**
     *
     */
    getChapterCount() {
        return this.documentService.getChapterCount();
    }

    /**
     * Apply command-based edits to the editor content.
     * @param {Array} commands
     * @param options
     * @returns {Promise<object>}
     */
    async applyCommands(commands = [], options = {}) {
        // Phase 1: Interpret input
        if (!Array.isArray(commands) || commands.length === 0) {
            return { success: false, reason: 'no_commands' };
        }

        // Phase 2: Mutate document
        const result = this.documentService.applyCommands(commands);
        if (!result.success) {
            return result;
        }

        // Phase 3: Render
        const { source = 'commands', skipRender = false } = options;
        if (!skipRender) {
            const renderStart = performance.now();
            await this.renderController.renderDocument(this.documentService.getDocument(), {
                source,
                allowInPlace: true,
                skipFocus: true
            });
            const renderDuration = performance.now() - renderStart;
            this._recordPerf('render', renderDuration, source);
        }

        // Phase 4: Emit + persist
        const content = this.getContent();
        this.emit(EDITOR_EVENTS.CONTENT_UPDATED, { content, source, timestamp: Date.now() });
        this._emitContentChange({ source });
        this.refreshSpeakerSuggestions();

        return { success: true, results: result.results, content, inverseCommands: result.inverseCommands };
    }

    /**
     * Append multiple line items to the end of the document.
     * @param {Array} lines
     * @param {object} options
     * @returns {Promise<object>}
     */
    async appendLines(lines = [], options = {}) {
        return this._enqueueOperation(async () => {
            const startIndex = this.documentService.getLineCount();
            const commands = lines
                .map((line, index) => this.documentService.createAddCommandAtIndex(startIndex + index, {
                    format: line.format,
                    content: line.content
                }))
                .filter(Boolean);

            const source = options.source || 'append';
            const result = await this.applyCommands(commands, { source });
            if (!result || !result.success) {
                return { success: false, reason: 'append_failed', result };
            }

            const lineElements = this.editorArea.querySelectorAll('.script-line');
            const element = lineElements.length > 0 ? lineElements[lineElements.length - 1] : null;
            const lastLine = lines[lines.length - 1];

            return {
                success: true,
                element,
                format: lastLine.format,
                result
            };
        });
    }

    /**
     * Set format for the current line
     * @param format
     */
    setCurrentLineFormat(format) {
        const selectedLine = this.domHandler.container.querySelector('.script-line.selected');
        const currentLine = selectedLine || this.domHandler.getCurrentLine();
        if (!currentLine || !this.lineFormatter.isValidFormat(format)) {
            return;
        }
        if (selectedLine && selectedLine !== this.domHandler.getCurrentLine()) {
            this.domHandler.currentLine = selectedLine;
            this.stateManager.setCurrentLine(selectedLine);
        }
        const lineId = currentLine.dataset.lineId || this.ensureLineId(currentLine);
        this.applyFormat(lineId, { format });
    }

    /**
     *
     * @param direction
     */
    cycleFormat(direction = 1) {
        const currentLine = this.domHandler.getCurrentLine();
        if (!currentLine) return;
        const lineId = currentLine.dataset.lineId || this.ensureLineId(currentLine);
        this.applyFormat(lineId, { direction });
    }

    /**
     *
     * @param lineId
     * @param root0
     * @param root0.format
     * @param root0.direction
     */
    applyFormat(lineId, { format, direction } = {}) {
        if (!lineId) {
            return null;
        }

        const line = this.documentService.getLineById(lineId);
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
     * @param command
     */
    applyFormatCommand(command) {
        if (!command || command.type !== 'setFormat') {
            return null;
        }

        const editCommand = this.documentService.createEditCommandById(command.lineId, {
            format: command.format
        });
        if (!editCommand) {
            return null;
        }

        this.applyCommands([editCommand], { source: 'format', skipRender: true });
        this.renderController.updateLineById(command.lineId, {
            format: command.format
        });
        this.stateManager.setCurrentFormat(command.format);
        this.emit(EDITOR_EVENTS.FORMAT_CHANGE, command.format);
        return editCommand;
    }

    /**
     *
     */
    refreshSpeakerSuggestions() {
        if (!this.stateManager) {
            return;
        }
        const seen = new Set();
        const suggestions = [];
        for (const line of this.documentService.getLines()) {
            if (line.format !== 'speaker') {
                continue;
            }
            const trimmed = (line.content || '').trim();
            if (!trimmed) {
                continue;
            }
            const normalized = trimmed.toUpperCase();
            if (seen.has(normalized)) {
                continue;
            }
            seen.add(normalized);
            suggestions.push(normalized);
        }
        this.stateManager.setAutocompleteSuggestions('speaker', suggestions);
    }

    /**
     *
     */
    clearSelection() {
        const selection = window.getSelection();
        selection.removeAllRanges();
    }

    /**
     *
     * @param saveService
     */
    setSaveService(saveService) {
        this.inputController.setSaveService(saveService);
    }

    /**
     *
     * @param history
     */
    setHistory(history) {
        this.inputController.setHistory(history);
    }

    /**
     *
     * @param lineElement
     */
    syncLineContentFromDOM(lineElement) {
        if (!lineElement || !lineElement.classList.contains('script-line')) {
            return;
        }

        const lineId = this.ensureLineId(lineElement);
        if (!lineId) return;

        const content = lineElement.textContent || '';
        const existing = this.documentService.getLineById(lineId);

        if (existing && existing.content === content) {
            return;
        }

        const command = this.documentService.createEditCommandById(lineId, {
            content
        });

        if (command) {
            this.applyCommands([command], { source: 'input', skipRender: true });
        }
    }

    /**
     *
     * @param lineElement
     */
    ensureLineId(lineElement) {
        if (lineElement.dataset.lineId) {
            return lineElement.dataset.lineId;
        }

        const domFormat = lineElement.getAttribute('data-format') || 'action';
        const domContent = lineElement.textContent || '';

        const modelLines = this.documentService.getLines();
        for (const modelLine of modelLines) {
            if (modelLine.format === domFormat && modelLine.content === domContent) {
                lineElement.dataset.lineId = modelLine.id;
                debugLog('[EditorCoordinator] Bound lineId from document by content match:', {
                    lineId: modelLine.id,
                    format: modelLine.format
                });
                return modelLine.id;
            }
        }

        console.warn('[EditorCoordinator] DOM line without lineId not found in model - rejecting:', {
            format: domFormat,
            contentLength: domContent.length
        });
        return null;
    }

    /**
     *
     * @param lineId
     * @param options
     */
    async insertLineAfter(lineId, options = {}) {
        return this._enqueueOperation(async () => {
            const { format = 'action', content = '', updateCurrentContent, focus = true } = options;
            const updatePayload = updateCurrentContent !== undefined
                ? (updateCurrentContent && typeof updateCurrentContent === 'object'
                    ? updateCurrentContent
                    : { content: updateCurrentContent })
                : null;
            const wasLastLine = this.documentService.getLineIndex(lineId) === this.documentService.getLineCount() - 1;
            const insertCommand = this.documentService.createAddCommandAfterLine(lineId, { format, content });
            const commands = [];
            if (updateCurrentContent !== undefined) {
                const editPayload = {
                    ...(updatePayload?.format !== undefined ? { format: updatePayload.format } : {}),
                    ...(updatePayload?.content !== undefined ? { content: updatePayload.content } : {})
                };
                const editCommand = this.documentService.createEditCommandById(lineId, editPayload);
                if (editCommand) {
                    commands.push(editCommand);
                }
            }
            if (insertCommand) {
                commands.push(insertCommand);
            }

            const result = this.documentService.applyCommands(commands);
            if (!result.success) {
                return null;
            }

            const insertIndex = insertCommand ? insertCommand.lineNumber : this.documentService.getLineCount() - 1;
            const newLine = this.documentService.getLines()[insertIndex] || null;

            const requiredPages = this._getRequiredPageCount();
            const currentPages = this.pageManager.getPageCount();
            const canIncremental = wasLastLine && requiredPages === currentPages;

            if (updateCurrentContent !== undefined) {
                const renderContent = updatePayload?.content ?? updateCurrentContent;
                this.renderController.updateLineById(lineId, { content: renderContent });
            }

            if (canIncremental && newLine) {
                this.renderController.appendLine({
                    id: newLine.id,
                    format: newLine.format,
                    text: newLine.content
                });
            } else {
                await this.renderController.renderDocument(this.documentService.getDocument(), {
                    source: 'line_insert',
                    allowInPlace: true,
                    skipFocus: true
                });
            }

            if (focus && newLine) {
                this._setFocusIntent(newLine.id, { position: 'start' });
            }

            this._applyFocusIntent();
            this._emitContentChange({ source: 'line_insert' });
            return newLine;
        });
    }

    /**
     *
     * @param lineIds
     * @param options
     */
    async deleteLinesById(lineIds = [], options = {}) {
        return this._enqueueOperation(async () => {
            if (!Array.isArray(lineIds) || lineIds.length === 0) {
                return null;
            }

            const remainingFocusId = options.focusLineId || null;
            const targetLineId = lineIds.length === 1 ? lineIds[0] : null;
            const targetIndex = targetLineId ? this.documentService.getLineIndex(targetLineId) : -1;
            const wasLastLine = targetIndex === this.documentService.getLineCount() - 1;

            const commands = lineIds
                .map(lineId => this.documentService.createDeleteCommandById(lineId))
                .filter(Boolean);

            const result = this.documentService.applyCommands(commands);
            if (!result.success) {
                return null;
            }

            const requiredPages = this._getRequiredPageCount();
            const currentPages = this.pageManager.getPageCount();
            const canIncremental = targetLineId &&
                lineIds.length === 1 &&
                wasLastLine &&
                requiredPages === currentPages &&
                this.documentService.getLineCount() > 0;

            if (canIncremental) {
                this.renderController.removeLineById(targetLineId);
            } else {
                await this.renderController.renderDocument(this.documentService.getDocument(), {
                    source: 'line_delete',
                    allowInPlace: true,
                    skipFocus: true
                });
            }

            if (remainingFocusId) {
                this._setFocusIntent(remainingFocusId, { position: 'end' });
            }

            this._applyFocusIntent();
            this._emitContentChange({ source: 'line_delete' });
            return true;
        });
    }

    /**
     *
     * @param toLineId
     * @param fromLineId
     * @param options
     */
    async mergeLinesById(toLineId, fromLineId, options = {}) {
        return this._enqueueOperation(async () => {
            if (!toLineId || !fromLineId) {
                return null;
            }

            const command = {
                command: 'MERGE_LINES',
                toLineId,
                fromLineId
            };

            const result = this.documentService.applyCommands([command]);
            if (!result.success) {
                return null;
            }

            await this.renderController.renderDocument(this.documentService.getDocument(), {
                source: 'line_merge',
                allowInPlace: true,
                skipFocus: true
            });

            if (options.focus !== false) {
                this._setFocusIntent(toLineId, { position: 'end' });
            }

            this._applyFocusIntent();
            this._emitContentChange({ source: 'line_merge' });
            return true;
        });
    }

    /**
     *
     * @param lineId
     * @param updates
     */
    updateLineById(lineId, updates = {}) {
        const command = this.documentService.createEditCommandById(lineId, updates);
        if (!command) {
            return null;
        }
        this.applyCommands([command], { source: 'line_edit', skipRender: true });
        this.renderController.updateLineById(lineId, updates);
        return command;
    }

    /**
     *
     * @param lineId
     * @param updates
     * @param focusOptions
     */
    updateLineByIdWithFocus(lineId, updates = {}, focusOptions = {}) {
        const command = this.updateLineById(lineId, updates);
        if (!command) {
            return null;
        }
        if (focusOptions) {
            this._setFocusIntent(lineId, focusOptions);
            this._applyFocusIntent();
        }
        return command;
    }

    /**
     *
     * @param lineText
     */
    getLineFormat(lineText) {
        const match = lineText.match(/<([\w-]+)>([\s\S]*)<\/\1>/);
        if (!match) {
            return 'action';
        }
        return match[1].toLowerCase();
    }

    /**
     *
     */
    _getRequiredPageCount() {
        return Math.ceil(this.documentService.getLineCount() / this.pageManager.maxLinesPerPage);
    }

    /**
     *
     * @param root0
     * @param root0.source
     */
    _emitContentChange({ source } = {}) {
        const serializeStart = performance.now();
        const content = this.getContent();
        const serializeDuration = performance.now() - serializeStart;
        this._recordPerf('serialize', serializeDuration, source);

        this.emit(EDITOR_EVENTS.CONTENT_CHANGE, content);
        this.emit('contentChanged', { content, source });
        if (this.callbacks.onChange) {
            this.callbacks.onChange(content);
        }

        if (this._contentPersistTimeout) {
            clearTimeout(this._contentPersistTimeout);
        }
        this._contentPersistTimeout = setTimeout(() => {
            this.emit(EDITOR_EVENTS.CONTENT_PERSIST, content);
        }, this._persistDelay);
    }

    /**
     *
     * @param payload
     */
    _handleEditIntent(payload) {
        const { type } = payload;

        if (type === 'SPLIT_LINE') {
            const { lineId, selection } = payload;
            const line = this.documentService.getLineById(lineId);
            if (!line) {
                return null;
            }

            const cursorPosition = selection.startOffset;
            const beforeText = line.content.substring(0, cursorPosition);
            const afterText = line.content.substring(cursorPosition);
            const nextFormat = this.lineFormatter.getDefaultNextFormat
                ? this.lineFormatter.getDefaultNextFormat(line.format)
                : line.format;

            return this.insertLineAfter(lineId, {
                format: nextFormat,
                content: afterText,
                updateCurrentContent: { content: beforeText },
                focus: true
            });
        }

        if (type === 'MERGE_WITH_NEXT') {
            const { lineId } = payload;
            const lineIndex = this.documentService.getLineIndex(lineId);
            const nextLine = lineIndex >= 0 ? this.documentService.getLines()[lineIndex + 1] : null;
            if (!nextLine) {
                return null;
            }
            return this.mergeLinesById(lineId, nextLine.id, { focus: true });
        }

        if (type === 'DELETE_SELECTED_LINES') {
            const { lineIds } = payload;
            if (!Array.isArray(lineIds) || lineIds.length === 0) {
                return null;
            }
            const indexes = lineIds
                .map(id => this.documentService.getLineIndex(id))
                .filter(index => index >= 0)
                .sort((a, b) => a - b);
            if (indexes.length === 0) {
                return null;
            }

            const minIndex = indexes[0];
            const maxIndex = indexes[indexes.length - 1];
            const lines = this.documentService.getLines();
            let focusLineId = null;
            if (maxIndex + 1 < lines.length) {
                focusLineId = lines[maxIndex + 1].id;
            } else if (minIndex - 1 >= 0) {
                focusLineId = lines[minIndex - 1].id;
            }

            return this.deleteLinesById(lineIds, { focusLineId });
        }

        return null;
    }

    /**
     *
     * @param type
     * @param duration
     */
    _recordPerf(type, duration) {
        if (type === 'render') {
            this.perfStats.renderCount += 1;
            this.perfStats.renderTotalMs += duration;
        } else if (type === 'serialize') {
            this.perfStats.serializeCount += 1;
            this.perfStats.serializeTotalMs += duration;
        }
    }

    /**
     *
     * @param operation
     */
    _enqueueOperation(operation) {
        this._opQueue = this._opQueue.then(operation)
            .catch((error) => {
                console.error('[EditorCoordinator] Operation failed:', error);
                return null;
            });
        return this._opQueue;
    }

    /**
     *
     * @param lineId
     * @param options
     */
    _setFocusIntent(lineId, options = {}) {
        if (!lineId) {
            return;
        }
        this._pendingFocus = {
            lineId,
            options
        };
    }

    /**
     *
     */
    _applyFocusIntent() {
        if (!this._pendingFocus) {
            return null;
        }
        const { lineId, options } = this._pendingFocus;
        this._pendingFocus = null;
        return this.renderController.placeCaret(lineId, options);
    }

    /**
     *
     */
    destroy() {
        if (this.domHandler && this._domHandlerEditIntentHandler) {
            this.domHandler.off('editIntent', this._domHandlerEditIntentHandler);
            this._domHandlerEditIntentHandler = null;
        }
        if (this.inputController) {
            this.inputController.destroy();
        }
        if (this.autocomplete) {
            this.autocomplete.destroy();
        }
        if (this.domHandler) {
            this.domHandler.destroy();
        }
        if (this.lineFormatter) {
            this.lineFormatter.destroy();
        }
        this.removeAllListeners();

        if (this._contentUpdateTimeout) {
            clearTimeout(this._contentUpdateTimeout);
            this._contentUpdateTimeout = null;
        }
        if (this._contentPersistTimeout) {
            clearTimeout(this._contentPersistTimeout);
            this._contentPersistTimeout = null;
        }

        this.container = null;
        this.editorArea = null;
        this.stateManager = null;
        this.pageManager = null;
        this.lineFormatter = null;
        this.domHandler = null;
        this.documentService = null;
        this.renderController = null;
        this.inputController = null;
        this.autocomplete = null;
        this.callbacks = null;
        this.events = null;
    }
}
