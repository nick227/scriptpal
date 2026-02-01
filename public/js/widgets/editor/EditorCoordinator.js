import { EventManager } from '../../core/EventManager.js';
import { debugLog } from '../../core/logger.js';
import { EDITOR_EVENTS } from './constants.js';
import { AutocompleteManager } from './AutocompleteManager.js';
import { EditorDocumentService } from './EditorDocumentService.js';
import { EditorRenderController } from './EditorRenderController.js';
import { EditorInputController } from './EditorInputController.js';
import { ScriptDocument } from './model/ScriptDocument.js';

/**
 * Orchestrates editor services and phases.
 */
export class EditorCoordinator {
    /**
     * @param options
     */
    constructor (options) {
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

    async initialize () {
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

    async initializeCriticalPhase () {
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

    async initializeEventPhase () {
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
    }

    deferOptionalFeatures () {
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
     */
    async updateContent (content, { isEdit = false, preserveState = false, source = null, focus = false } = {}) {
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

    getContent () {
        return this.documentService.getContent();
    }

    getPlainText () {
        return this.documentService.getPlainText();
    }

    getLines () {
        return this.documentService.getLines();
    }

    getLineById (lineId) {
        return this.documentService.getLineById(lineId);
    }

    getLineIndex (lineId) {
        return this.documentService.getLineIndex(lineId);
    }

    getLineCount () {
        return this.documentService.getLineCount();
    }

    getWordCount () {
        return this.documentService.getWordCount();
    }

    getCharacterCount () {
        return this.documentService.getCharacterCount();
    }

    getChapterCount () {
        return this.documentService.getChapterCount();
    }

    /**
     * Apply command-based edits to the editor content.
     * @param {Array} commands
     * @returns {Promise<object>}
     */
    async applyCommands (commands = [], options = {}) {
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
     * Set format for the current line
     * @param format
     */
    setCurrentLineFormat (format) {
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

    cycleFormat (direction = 1) {
        const currentLine = this.domHandler.getCurrentLine();
        if (!currentLine) return;
        const lineId = currentLine.dataset.lineId || this.ensureLineId(currentLine);
        this.applyFormat(lineId, { direction });
    }

    applyFormat (lineId, { format, direction } = {}) {
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

    applyFormatCommand (command) {
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

    refreshSpeakerSuggestions () {
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

    clearSelection () {
        const selection = window.getSelection();
        selection.removeAllRanges();
    }

    setSaveService (saveService) {
        this.inputController.setSaveService(saveService);
    }

    setHistory (history) {
        this.inputController.setHistory(history);
    }

    syncLineContentFromDOM (lineElement) {
        if (!lineElement || !lineElement.classList.contains('script-line')) {
            return;
        }

        const lineId = this.ensureLineId(lineElement);
        const content = lineElement.textContent || '';
        const format = lineElement.getAttribute('data-format') || 'action';
        const existing = this.documentService.getLineById(lineId);
        if (existing && existing.content === content && existing.format === format) {
            return;
        }

        const command = this.documentService.createEditCommandById(lineId, {
            format,
            content
        });
        if (command) {
            this.applyCommands([command], { source: 'input', skipRender: true });
        }
    }

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
        const existing = index >= 0 ? this.documentService.getLines()[index] : null;
        if (existing) {
            lineElement.dataset.lineId = existing.id;
            debugLog('[EditorCoordinator] Bound lineId from document:', {
                lineId: existing.id,
                index,
                format: existing.format
            });
            return existing.id;
        }

        const lineId = ScriptDocument.createLineId();
        lineElement.dataset.lineId = lineId;
        const addCommand = this.documentService.createAddCommandAtIndex(index, {
            format: lineElement.getAttribute('data-format') || 'action',
            content: lineElement.textContent || ''
        });
        if (addCommand) {
            this.applyCommands([addCommand], { source: 'line_bind', skipRender: true });
        }
        console.warn('[EditorCoordinator] Created new lineId for DOM line:', {
            lineId,
            index,
            format: lineElement.getAttribute('data-format') || 'action'
        });
        return lineId;
    }

    async insertLineAfter (lineId, options = {}) {
        const { format = 'action', content = '', updateCurrentContent, focus = true } = options;
        const wasLastLine = this.documentService.getLineIndex(lineId) === this.documentService.getLineCount() - 1;
        const insertCommand = this.documentService.createAddCommandAfterLine(lineId, { format, content });
        const commands = [];
        if (updateCurrentContent !== undefined) {
            const editCommand = this.documentService.createEditCommandById(lineId, {
                content: updateCurrentContent
            });
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
            this.renderController.updateLineById(lineId, { content: updateCurrentContent });
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
            this.renderController.focusLineById(newLine.id, { position: 'start' });
        }

        this._emitContentChange({ source: 'line_insert' });
        return newLine;
    }

    async deleteLinesById (lineIds = [], options = {}) {
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
            this.renderController.focusLineById(remainingFocusId, { position: 'end' });
        }

        this._emitContentChange({ source: 'line_delete' });
        return true;
    }

    updateLineById (lineId, updates = {}) {
        const command = this.documentService.createEditCommandById(lineId, updates);
        if (!command) {
            return null;
        }
        this.applyCommands([command], { source: 'line_edit', skipRender: true });
        this.renderController.updateLineById(lineId, updates);
        return command;
    }

    getLineFormat (lineText) {
        const match = lineText.match(/<([\w-]+)>([\s\S]*)<\/\1>/);
        if (!match) {
            return 'action';
        }
        return match[1].toLowerCase();
    }

    _getRequiredPageCount () {
        return Math.ceil(this.documentService.getLineCount() / this.pageManager.maxLinesPerPage);
    }

    _emitContentChange ({ source } = {}) {
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

    _recordPerf (type, duration) {
        if (type === 'render') {
            this.perfStats.renderCount += 1;
            this.perfStats.renderTotalMs += duration;
        } else if (type === 'serialize') {
            this.perfStats.serializeCount += 1;
            this.perfStats.serializeTotalMs += duration;
        }
    }

    destroy () {
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
