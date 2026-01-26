import { EventManager } from '../../../core/EventManager.js';
import { RendererFactory } from '../../../renderers.js';
import { EDITOR_EVENTS } from '../constants.js';
import { LineFormatter } from '../LineFormatter.js';
import { ScriptDocument } from '../model/ScriptDocument.js';
import { debugLog } from '../../../core/logger.js';

/**
 *
 */
export class EditorDOMHandler {
    /**
     *
     * @param options
     */
    constructor (options) {
        if (!options.container || !options.stateManager || !options.pageManager) {
            throw new Error('Required options not provided to EditorDOMHandler');
        }

        this.container = options.container;
        this.stateManager = options.stateManager;
        this.pageManager = options.pageManager;
        this.currentLine = null;
        this.isInitialized = false;
        this.lineFormatter = new LineFormatter(this.stateManager);
        this.lineElementMap = new Map();

        // Selection handling (consolidated from EditorSelectionHandler)
        this.selectedLines = new Set();
        this.selectionStart = null;

        // Initialize editor renderer
        this.renderer = RendererFactory.createEditorRenderer(this.container, {
            lineFormatter: this.lineFormatter,
            pageManager: this.pageManager
        });

        // Event handling
        this.events = new EventManager();
        this._eventsBound = false;
        this.onFormatCommand = null;
    }

    /**
     *
     */
    setupEventListeners () {
        if (this._eventsBound) {
            return;
        }
        this._eventsBound = true;

        // Listen for cursor movement
        this.container.addEventListener('click', (event) => {
            const line = event.target.closest('.script-line');
            if (line) {
                const cursorPos = this.getCursorPosition(line);
                if (cursorPos.position) {
                    this.emit(EDITOR_EVENTS.CURSOR_MOVE, cursorPos);
                }
            }
        });

        // Listen for keyup for cursor position changes
        this.container.addEventListener('keyup', (event) => {
            const line = event.target.closest('.script-line');
            if (line) {
                const cursorPos = this.getCursorPosition(line);
                if (cursorPos.position) {
                    this.emit(EDITOR_EVENTS.CURSOR_MOVE, cursorPos);
                }
            }
        });

    }

    /**
     *
     */
    getContent () {
        try {
            const lines = [];
            const scriptLines = this.container.querySelectorAll('.script-line');

            scriptLines.forEach(line => {
                const format = line.getAttribute('data-format') || 'action';
                const text = line.textContent.trim();
                if (text) {
                    lines.push(`<${format}>${text}</${format}>`);
                }
            });

            return lines.join('\n');
        } catch (error) {
            console.error('[DOM] Error getting content:', error);
            return '';
        }
    }

    // Event handling methods
    /**
     *
     * @param eventType
     * @param handler
     */
    on (eventType, handler) {
        return this.events.subscribe(eventType, handler);
    }

    /**
     *
     * @param eventType
     * @param handler
     */
    off (eventType, handler) {
        this.events.unsubscribe(eventType, handler);
    }

    /**
     *
     * @param eventType
     * @param data
     */
    emit (eventType, data) {
        this.events.publish(eventType, data);
    }

    /**
     *
     */
    async initialize () {
        try {

            // Ensure editor area exists
            let editorArea = this.container.querySelector('.editor-area');
            if (!editorArea) {
                editorArea = document.createElement('div');
                editorArea.className = 'editor-area';
                this.container.appendChild(editorArea);
            }

            // Wait for page manager to be ready
            const firstPage = await this._ensureFirstPage();
            if (!firstPage) {
                throw new Error('Failed to create or get first page');
            }

            // Create initial line if needed
            await this._ensureInitialLine(firstPage);

            // Set up event listeners
            this.setupEventListeners();

            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('[EditorDOMHandler] Initialization failed:', error);
            throw error;
        }
    }

    /**
     *
     */
    async _ensureFirstPage () {
        try {
            let firstPage = this.pageManager.getCurrentPage();
            if (!firstPage) {
                firstPage = await this.pageManager.createNewPage();
            } else {
            }
            return firstPage;
        } catch (error) {
            console.error('[EditorDOMHandler] Error ensuring first page:', error);
            return null;
        }
    }

    /**
     *
     * @param page
     */
    async _ensureInitialLine (page) {
        try {
            const content = page.querySelector('.editor-page-content') || page.querySelector('.page-content');
            if (!content) {
                throw new Error('Page content container not found');
            }

            // Check for existing lines
            let line = content.querySelector('.script-line');
            if (!line) {
                line = await this.renderer.insertLine({
                    id: ScriptDocument.createLineId(),
                    format: 'header',
                    text: ''
                }, 0);
            }

            this.currentLine = line;
            this.stateManager.setCurrentLine(line);

            // Focus after a short delay to ensure DOM is ready
            setTimeout(() => this.setFocus(line), 0);

            return line;
        } catch (error) {
            console.error('[EditorDOMHandler] Error ensuring initial line:', error);
            return null;
        }
    }

    // Helper method to safely get cursor position
    /**
     *
     * @param line
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
            console.warn('Failed to get cursor position:', error);
            return { line, position: null };
        }
    }

    // Line creation and management
    /**
     *
     * @param options
     */
    createLine (options = {}) {
        const format = options.format || this.lineFormatter.DEFAULT_FORMAT;
        const lineElement = this.renderer._createLineElement({
            id: options.id || ScriptDocument.createLineId(),
            format: format,
            text: options.content || ''
        });
        if (lineElement?.dataset?.lineId) {
            this.lineElementMap.set(lineElement.dataset.lineId, lineElement);
        }
        return lineElement;
    }

    /**
     *
     * @param content
     */
    _parseScriptContent (content) {
        if (!content || typeof content !== 'string') return [];

        const trimmed = content.trim();
        if (trimmed && (trimmed[0] === '{' || trimmed[0] === '[')) {
            try {
                const parsed = JSON.parse(trimmed);
                const rawLines = Array.isArray(parsed?.lines) ? parsed.lines : Array.isArray(parsed) ? parsed : null;
                if (rawLines) {
                    return rawLines.map(line => {
                        const format = this.lineFormatter.isValidFormat(line?.format)
                            ? line.format
                            : this.lineFormatter.DEFAULT_FORMAT;
                        const text = typeof line?.content === 'string'
                            ? line.content
                            : typeof line?.text === 'string'
                                ? line.text
                                : '';
                        return {
                            id: line?.id || ScriptDocument.createLineId(),
                            text,
                            format
                        };
                    });
                }
            } catch (error) {
                // Fall through to legacy parsing
            }
        }

        const lines = content.split('\n');

        return lines.map(line => {
            const trimmedLine = line.trim();

            if (!trimmedLine) {
                return {
                    id: ScriptDocument.createLineId(),
                    text: '',
                    format: this.lineFormatter.DEFAULT_FORMAT
                };
            }

            const tagMatch = trimmedLine.match(/<([\w-]+)>(.*?)<\/\1>/);
            if (tagMatch) {
                const format = tagMatch[1].toLowerCase();
                return {
                    id: ScriptDocument.createLineId(),
                    text: tagMatch[2],
                    format: this.lineFormatter.isValidFormat(format) ? format : this.lineFormatter.DEFAULT_FORMAT
                };
            }

            return {
                id: ScriptDocument.createLineId(),
                text: trimmedLine,
                format: this.lineFormatter.DEFAULT_FORMAT
            };
        });
    }

    /**
     *
     * @param line
     * @param afterElement
     */
    addLine (line, afterElement = null) {
        if (!line) return;
        let anchorLineId = null;
        if (afterElement && afterElement.dataset && afterElement.dataset.lineId) {
            anchorLineId = afterElement.dataset.lineId;
        }
        this.pageManager.addLine(line, anchorLineId);
        this.emit(EDITOR_EVENTS.LINE_CHANGE, { type: 'add', line });
    }

    /**
     *
     * @param line
     */
    removeLine (line) {
        if (!line) return;
        this.pageManager.removeLine(line);
        this.emit(EDITOR_EVENTS.LINE_CHANGE, { type: 'remove', line });
    }

    // Focus management
    /**
     *
     * @param line
     */
    setFocus (line = null) {
        try {
            // If no specific line is provided, focus the current line
            const targetLine = line || this.currentLine;

            if (!targetLine) {
                console.warn('[EditorDOMHandler] No line available to focus');
                return;
            }

            // Ensure the line is in the DOM
            if (!document.body.contains(targetLine)) {
                console.warn('[EditorDOMHandler] Attempted to focus line not in DOM');
                return;
            }

            // Focus the line and move cursor to the end
            targetLine.focus();

            // Set cursor to end of line
            const range = document.createRange();
            const selection = window.getSelection();

            range.selectNodeContents(targetLine);
            range.collapse(false);

            selection.removeAllRanges();
            selection.addRange(range);

            // Update state
            this.currentLine = targetLine;
            this.stateManager.setCurrentLine(targetLine);

            // Emit focus event
            this.emit('focus', targetLine);

        } catch (error) {
            console.error('[EditorDOMHandler] Error setting focus:', error);
        }
    }

    /**
     *
     */
    getCurrentLine () {
        return this.currentLine;
    }

    // Line navigation
    /**
     *
     * @param line
     */
    getNextLine (line) {
        if (!line) return null;
        return line.nextElementSibling;
    }

    /**
     *
     * @param line
     */
    getPreviousLine (line) {
        if (!line) return null;
        return line.previousElementSibling;
    }

    /**
     *
     */
    getFirstLine () {
        const firstPage = this.pageManager.getPages()[0];
        if (!firstPage) return null;
        const content = firstPage.querySelector('.editor-page-content') || firstPage.querySelector('.page-content');
        return content ? content.firstElementChild : null;
    }

    /**
     *
     */
    getLastLine () {
        const pages = this.pageManager.getPages();
        const lastPage = pages[pages.length - 1];
        if (!lastPage) return null;
        const content = lastPage.querySelector('.editor-page-content') || lastPage.querySelector('.page-content');
        return content ? content.lastElementChild : null;
    }

    // Line format
    /**
     *
     * @param line
     * @param format
     */
    setLineFormat (line, format) {
        if (!line || !this.lineFormatter.isValidFormat(format)) return;
        this.lineFormatter.applyFormatToLine(line, format);
        this.emit(EDITOR_EVENTS.FORMAT_CHANGE, { line, format });
        this.stateManager.setCurrentFormat(format);
    }

    // Cleanup
    /**
     *
     */
    destroy () {
        // Remove event listeners
        if (this.container) {
            this.container.removeEventListener('click', this.handleClick);
            this.container.removeEventListener('keyup', this.handleKeyup);
        }

        // Clear event handlers
        if (this.events) {
            this.events.clear();
        }

        // Cleanup line formatter
        if (this.lineFormatter) {
            this.lineFormatter.destroy();
        }

        // Reset state
        this.container = null;
        this.currentLine = null;
        this.isInitialized = false;
        this.lineFormatter = null;
        this.renderer = null;
        this.events = null;
    }

    /**
     *
     * @param lineId
     */
    focusLine (lineId) {
        const line = this.getLine(lineId);
        if (line) {
            line.focus();
        }
    }

    /**
     *
     * @param content
     * @param options
     */
    async updateContent (content, options = {}) {
        try {
            debugLog('[EditorDOMHandler] Starting content update:', {
                contentLength: content ? content.length : 0,
                options
            });

            if (content instanceof ScriptDocument) {
                return this.renderDocument(content, options);
            }

            // Parse content into lines
            const lines = this._parseScriptContent(content);

            // Get first page from page manager
            let firstPage = this.pageManager.getCurrentPage();

            // If no current page, get the first page
            if (!firstPage) {
                const pages = this.pageManager.getPages();
                firstPage = pages.length > 0 ? pages[0] : null;
            }

            // If still no page, create one
            if (!firstPage) {
                firstPage = await this.pageManager.createNewPage();
                if (!firstPage) {
                    console.error('[EditorDOMHandler] Failed to create first page');
                    return false;
                }
            }

            // Create initial line if content is empty
            if (lines.length === 0) {
                const pages = this.pageManager.getPages();
                this._clearPageContent(pages);
                const initialLine = this.createLine({ format: 'header' });
                if (initialLine) {
                    const content = firstPage.querySelector('.editor-page-content') || firstPage.querySelector('.page-content');
                    if (content) {
                        content.appendChild(initialLine);
                        await this.setFocus(initialLine);
                    }
                }
                return true;
            }

            // Ensure we have enough pages for content
            const linesPerPage = 20; // Typical lines per page
            const requiredPages = Math.ceil(lines.length / linesPerPage);
            const currentPages = this.pageManager.getPages().length;

            debugLog('[EditorDOMHandler] Page requirements:', {
                required: requiredPages,
                current: currentPages
            });

            // Ensure we have enough pages (append when possible)
            const capacityOk = await this.pageManager.ensurePageCapacity(requiredPages, { forceReset: false });
            if (!capacityOk) {
                console.warn('[EditorDOMHandler] Page capacity check failed, retrying with reset');
                await this.pageManager.waitForPages(requiredPages, 2);
            }

            const pages = this.pageManager.getPages();
            this._clearPageContent(pages);

            // Render content across pages
            const result = await this.renderer.renderContentChunk(lines, {
                ...options,
                startPage: firstPage
            });

            if (!result.success) {
                console.error('[EditorDOMHandler] Failed to render content chunks');
                return false;
            }

            this._rebuildLineElementMap();

            const shouldFocus = options.focus === true && !options.skipFocus;
            if (shouldFocus) {
                const preferredLineId = this._getPreferredLineId(options);
                // Set focus after a short delay to ensure DOM is ready
                setTimeout(async () => {
                    const targetLine = preferredLineId
                        ? this._getLineElementById(preferredLineId)
                        : firstPage.querySelector('.script-line');
                    if (targetLine) {
                        await this.setFocus(targetLine);
                    } else {
                        console.warn('[EditorDOMHandler] No line found to focus after content update');
                    }
                }, 100);
            }

            return true;
        } catch (error) {
            console.error('[EditorDOMHandler] Error updating content:', error);
            return false;
        }
    }

    /**
     * @param {ScriptDocument} document
     * @param {object} options
     */
    async renderDocument (document, options = {}) {
        if (!document || !Array.isArray(document.lines)) {
            console.error('[EditorDOMHandler] Invalid document for render');
            return false;
        }

        const preferredLineId = this._getPreferredLineId(options);
        debugLog('[EditorDOMHandler] renderDocument:', {
            lineCount: document.lines.length,
            preferredLineId,
            focus: Boolean(options.focus),
            allowInPlace: Boolean(options.allowInPlace),
            source: options.source || null
        });
        const lines = document.lines.map(line => ({
            id: line.id,
            format: line.format,
            text: line.content
        }));

        if (options.allowInPlace && this._tryInPlaceUpdate(lines)) {
            this._restoreCurrentLine(preferredLineId, options);
            return true;
        }

        if (options.allowInPlace && await this._renderWithLineReuse(lines)) {
            this._restoreCurrentLine(preferredLineId, options);
            return true;
        }

        const pages = this.pageManager.getPages();
        this._clearPageContent(pages);

        const result = await this.renderer.renderContentChunk(lines, options);
        if (!result || !result.success) {
            return false;
        }

        this._rebuildLineElementMap();

        if (options.source === 'append') {
            const domLines = Array.from(this.container.querySelectorAll('.script-line')).slice(0, 5);
            console.log('[EditorDOMHandler] append render sample', domLines.map(line => ({
                format: line.getAttribute('data-format'),
                className: line.className,
                text: line.textContent
            })));
        }

        this._restoreCurrentLine(preferredLineId, options);

        return true;
    }

    _getPreferredLineId (options = {}) {
        if (options.focus !== true || options.skipFocus) {
            return null;
        }

        const current = this.currentLine;
        if (current?.dataset?.lineId) {
            return current.dataset.lineId;
        }

        return null;
    }

    _restoreCurrentLine (lineId, options = {}) {
        if (options.focus !== true || options.skipFocus) {
            return;
        }

        let line = null;
        if (lineId) {
            line = this._getLineElementById(lineId);
        }

        if (!line) {
            line = this.container.querySelector('.script-line');
        }

        if (line) {
            this.currentLine = line;
            this.stateManager.setCurrentLine(line);
            debugLog('[EditorDOMHandler] Restored current line:', {
                lineId: line.dataset?.lineId || null,
                format: line.getAttribute?.('data-format') || null,
                usedFallback: !lineId
            });
        } else {
            console.warn('[EditorDOMHandler] Failed to restore current line', { lineId });
        }
    }

    _tryInPlaceUpdate (lines) {
        const domLines = this.container.querySelectorAll('.script-line');
        if (domLines.length !== lines.length) {
            return false;
        }

        for (let i = 0; i < lines.length; i++) {
            const domLine = domLines[i];
            const line = lines[i];
            const domId = domLine.dataset.lineId;
            if (!domId || domId !== line.id) {
                return false;
            }

            const formatClass = `format-${line.format}`;
            if (domLine.getAttribute('data-format') !== line.format || !domLine.classList.contains(formatClass)) {
                debugLog('[EditorDOMHandler] In-place format fix:', {
                    lineId: domLine.dataset.lineId,
                    from: domLine.getAttribute('data-format'),
                    to: line.format,
                    className: domLine.className
                });
                this.lineFormatter.applyFormatToLine(domLine, line.format);
            }

            if (domLine.textContent !== line.text) {
                domLine.textContent = line.text;
            }
        }

        return true;
    }

    _clearPageContent (pages = []) {
        pages.forEach(page => {
            const content = page.querySelector('.editor-page-content') || page.querySelector('.page-content');
            if (content && content.children.length > 0) {
                content.innerHTML = '';
            }
        });
    }

    _getLineElementById (lineId) {
        const cached = this.lineElementMap.get(lineId);
        if (cached && cached.isConnected) {
            return cached;
        }
        const line = this.container.querySelector(`[data-line-id="${lineId}"]`);
        if (line) {
            this.lineElementMap.set(lineId, line);
        }
        return line;
    }

    _rebuildLineElementMap () {
        this.lineElementMap.clear();
        const domLines = this.container.querySelectorAll('.script-line');
        domLines.forEach(line => {
            if (line.dataset?.lineId) {
                this.lineElementMap.set(line.dataset.lineId, line);
            }
        });
    }

    async _renderWithLineReuse (lines) {
        if (!this.pageManager || !this.renderer) {
            return false;
        }

        const requiredPages = Math.ceil(lines.length / this.pageManager.maxLinesPerPage);
        const existingPages = this.pageManager.getPages();
        const hasEnoughPages = existingPages.length >= requiredPages;
        if (!hasEnoughPages) {
            const ready = await this.pageManager.ensurePageCapacity(requiredPages, { forceReset: false });
            if (!ready) {
                return false;
            }
        }

        const pages = this.pageManager.getPages();
        pages.forEach(page => {
            const content = page.querySelector('.editor-page-content') || page.querySelector('.page-content');
            if (content) {
                content.textContent = '';
            }
        });

        const usedIds = new Set();
        let lineIndex = 0;
        const { maxLinesPerPage } = this.pageManager;

        for (let pageIndex = 0; pageIndex < pages.length && lineIndex < lines.length; pageIndex++) {
            const page = pages[pageIndex];
            const content = page.querySelector('.editor-page-content') || page.querySelector('.page-content');
            if (!content) {
                return false;
            }

            const fragment = document.createDocumentFragment();
            for (let i = 0; i < maxLinesPerPage && lineIndex < lines.length; i++, lineIndex++) {
                const line = lines[lineIndex];
                let element = this.lineElementMap.get(line.id);
                if (!element) {
                    element = this.renderer._createLineElement(line);
                } else {
                    const formatClass = `format-${line.format}`;
                    if (element.getAttribute('data-format') !== line.format || !element.classList.contains(formatClass)) {
                        debugLog('[EditorDOMHandler] Reuse format fix:', {
                            lineId: line.id,
                            from: element.getAttribute('data-format'),
                            to: line.format,
                            className: element.className
                        });
                        this.lineFormatter.applyFormatToLine(element, line.format);
                    }
                    if (element.textContent !== line.text) {
                        element.textContent = line.text;
                    }
                }
                if (element) {
                    usedIds.add(line.id);
                    element.dataset.lineId = line.id;
                    fragment.appendChild(element);
                    this.lineElementMap.set(line.id, element);
                }
            }

            content.appendChild(fragment);
            page.dataset.loaded = 'true';
        }

        Array.from(this.lineElementMap.keys()).forEach(lineId => {
            if (!usedIds.has(lineId)) {
                const element = this.lineElementMap.get(lineId);
                if (element && element.parentNode) {
                    element.parentNode.removeChild(element);
                }
                this.lineElementMap.delete(lineId);
            }
        });

        return true;
    }

    /**
     * @param {string} lineId
     * @param {object} updates
     */
    updateLineById (lineId, updates = {}) {
        if (!lineId) return null;
        const line = this._getLineElementById(lineId);
        if (!line) return null;

        if (updates.format && this.lineFormatter.isValidFormat(updates.format)) {
            this.lineFormatter.applyFormatToLine(line, updates.format);
        }

        if (updates.content !== undefined) {
            line.textContent = updates.content;
        }

        return line;
    }

    /**
     * @param {string} lineId
     */
    removeLineById (lineId) {
        if (!lineId) return false;
        const line = this._getLineElementById(lineId);
        if (!line || !line.parentNode) return false;
        line.parentNode.removeChild(line);
        this.lineElementMap.delete(lineId);
        return true;
    }

    /**
     * @param {object} lineData
     */
    appendLine (lineData) {
        const pages = this.pageManager.getPages();
        const lastPage = pages[pages.length - 1];
        if (!lastPage) return null;
        const contentContainer = lastPage.querySelector('.editor-page-content') || lastPage.querySelector('.page-content');
        if (!contentContainer) return null;
        const lineElement = this.renderer._createLineElement(lineData);
        if (!lineElement) return null;
        contentContainer.appendChild(lineElement);
        if (lineElement.dataset?.lineId) {
            this.lineElementMap.set(lineElement.dataset.lineId, lineElement);
        }
        return lineElement;
    }

    /**
     * @param {string} lineId
     * @param {object} [options]
     */
    focusLineById (lineId, options = {}) {
        if (!lineId) return null;
        const line = this._getLineElementById(lineId);
        if (!line) return null;

        const position = options.position || 'end';
        line.focus();

        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(line);
        range.collapse(position === 'start');
        selection.removeAllRanges();
        selection.addRange(range);

        return line;
    }

    // ==============================================
    // Selection Handling (consolidated from EditorSelectionHandler)
    // ==============================================

    /**
     * Get current selection information
     */
    getSelection () {
        const selection = window.getSelection();
        if (!selection.rangeCount) {
            return null;
        }

        const range = selection.getRangeAt(0);
        const startLine = range.startContainer.parentElement.closest('.script-line');
        const endLine = range.endContainer.parentElement.closest('.script-line');

        if (!startLine || !endLine) {
            return null;
        }

        return {
            range,
            startLine,
            endLine,
            startOffset: range.startOffset,
            endOffset: range.endOffset,
            isMultiLine: startLine !== endLine
        };
    }

    /**
     * Select multiple lines
     * @param startLine
     * @param endLine
     */
    selectLines (startLine, endLine) {
        if (!startLine || !endLine) {
            return false;
        }

        try {
            const range = document.createRange();
            range.setStartBefore(startLine);
            range.setEndAfter(endLine);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            // Update selected lines set
            this.selectedLines.clear();
            let currentLine = startLine;
            while (currentLine && currentLine !== endLine.nextSibling) {
                this.selectedLines.add(currentLine);
                currentLine = currentLine.nextElementSibling;
            }

            this.emit('selectionChanged', {
                selectedLines: Array.from(this.selectedLines),
                isMultiLine: this.selectedLines.size > 1
            });

            return true;
        } catch (error) {
            console.error('[EditorDOMHandler] Error selecting lines:', error);
            return false;
        }
    }

    /**
     * Clear current selection
     */
    clearSelection () {
        const selection = window.getSelection();
        selection.removeAllRanges();
        this.selectedLines.clear();
        this.selectionStart = null;
        this.emit('selectionCleared');
    }

    /**
     * Get selected lines
     */
    getSelectedLines () {
        return Array.from(this.selectedLines);
    }

    /**
     * Check if multiple lines are selected
     */
    isMultiLineSelected () {
        return this.selectedLines.size > 1;
    }

    // ==============================================
    // Line Operations (consolidated from EditorLineOperationManager)
    // ==============================================

    /**
     * Split a line at the current cursor position
     * @param scriptLine
     * @param selection
     */
    async splitLine (scriptLine, selection) {
        try {
            // Get current format and determine next format
            const currentFormat = this.lineFormatter.getFormatForLine(scriptLine);
            const nextFormat = this.lineFormatter.getNextFlowFormat(currentFormat);

            // Get text content and split at cursor position
            const { textContent } = scriptLine;
            const { startOffset: cursorPosition } = selection;

            const beforeText = textContent.substring(0, cursorPosition);
            const afterText = textContent.substring(cursorPosition);

            // Update current line with text before cursor
            scriptLine.textContent = beforeText;

            // Create new line with text after cursor
            const newLine = this.createScriptLine(afterText, nextFormat);
            scriptLine.parentNode.insertBefore(newLine, scriptLine.nextSibling);

            // Focus the new line
            this.focusLine(newLine);

            this.emit('lineSplit', {
                originalLine: scriptLine,
                newLine: newLine,
                format: nextFormat
            });

            return newLine;
        } catch (error) {
            console.error('[EditorDOMHandler] Error splitting line:', error);
            return null;
        }
    }

    /**
     * Merge current line with the next line
     * @param scriptLine
     */
    async mergeWithNextLine (scriptLine) {
        try {
            const nextLine = scriptLine.nextElementSibling;
            if (!nextLine || !nextLine.classList.contains('script-line')) {
                return false;
            }

            // Combine text content
            const currentText = scriptLine.textContent;
            const nextText = nextLine.textContent;
            scriptLine.textContent = currentText + nextText;

            // Remove the next line
            nextLine.remove();

            // Focus the merged line
            this.focusLine(scriptLine);

            this.emit('linesMerged', {
                mergedLine: scriptLine,
                removedLine: nextLine
            });

            return true;
        } catch (error) {
            console.error('[EditorDOMHandler] Error merging lines:', error);
            return false;
        }
    }

    /**
     * Delete selected lines
     */
    async deleteSelectedLines () {
        try {
            if (this.selectedLines.size === 0) {
                return false;
            }

            const deletedLines = Array.from(this.selectedLines);

            // Remove all selected lines
            for (const line of deletedLines) {
                line.remove();
            }

            // Clear selection
            this.clearSelection();

            // Focus the line after the deleted lines (or before if no line after)
            const firstDeletedLine = deletedLines[0];
            const nextLine = firstDeletedLine.nextElementSibling;
            const prevLine = firstDeletedLine.previousElementSibling;

            if (nextLine && nextLine.classList.contains('script-line')) {
                this.focusLine(nextLine);
            } else if (prevLine && prevLine.classList.contains('script-line')) {
                this.focusLine(prevLine);
            }

            this.emit('linesDeleted', {
                deletedLines: deletedLines
            });

            return true;
        } catch (error) {
            console.error('[EditorDOMHandler] Error deleting selected lines:', error);
            return false;
        }
    }

    /**
     * Create a new script line element
     * @param text
     * @param format
     */
    createScriptLine (text = '', format = 'dialog') {
        const line = document.createElement('div');
        line.className = `script-line format-${format}`;
        line.setAttribute('data-format', format);
        line.setAttribute('data-line-id', ScriptDocument.createLineId());
        line.setAttribute('role', 'textbox');
        line.setAttribute('aria-label', `${format} line`);
        line.setAttribute('data-enable-grammarly', 'false');
        line.contentEditable = 'true';
        line.textContent = text;

        return line;
    }
}
