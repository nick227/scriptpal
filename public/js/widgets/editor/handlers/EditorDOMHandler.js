import { EventManager } from '../../../core/EventManager.js';
import { debugLog } from '../../../core/logger.js';
import { RendererFactory } from '../../../renderers.js';
import { EDITOR_EVENTS } from '../constants.js';
import { LineFormatter } from '../LineFormatter.js';
import { ScriptDocument } from '../model/ScriptDocument.js';

import { DocumentParser } from './DocumentParser.js';
import { EditorCaretManager } from './EditorCaretManager.js';
import { EditorInputBridge } from './EditorInputBridge.js';
import { EditorRendererAdapter } from './EditorRendererAdapter.js';
import { EditorSelectionManager } from './EditorSelectionManager.js';

/**
 * Facade / composition root for editor DOM operations.
 * Wires sub-modules and exposes public API for EditorCoordinator.
 */
export class EditorDOMHandler {
    /**
     * @param {object} options
     * @param {HTMLElement} options.container
     * @param {object} options.stateManager
     * @param {object} options.pageManager
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

        // Shared resources
        this.lineFormatter = new LineFormatter(this.stateManager);
        this.lineElementMap = new Map();
        this.events = new EventManager();

        // Initialize renderer
        this.renderer = RendererFactory.createEditorRenderer(this.container, {
            lineFormatter: this.lineFormatter,
            pageManager: this.pageManager
        });

        // Initialize sub-modules
        this.parser = new DocumentParser(this.lineFormatter);

        this.caretManager = new EditorCaretManager(
            this.container,
            this.lineElementMap
        );

        this.selectionManager = new EditorSelectionManager(
            this.caretManager,
            this.emit.bind(this)
        );

        this.rendererAdapter = new EditorRendererAdapter(
            this.container,
            this.renderer,
            this.pageManager,
            this.lineFormatter,
            this.lineElementMap
        );

        this.inputBridge = new EditorInputBridge(
            this.container,
            this.caretManager,
            this.emit.bind(this)
        );

        this.onFormatCommand = null;
    }

    // ==============================================
    // Event API
    // ==============================================

    /**
     * @param {string} eventType
     * @param {Function} handler
     */
    on (eventType, handler) {
        return this.events.subscribe(eventType, handler);
    }

    /**
     * @param {string} eventType
     * @param {Function} handler
     */
    off (eventType, handler) {
        this.events.unsubscribe(eventType, handler);
    }

    /**
     * @param {string} eventType
     * @param {*} data
     */
    emit (eventType, data) {
        this.events.publish(eventType, data);
    }

    // ==============================================
    // Lifecycle
    // ==============================================

    /**
     * Initialize the editor DOM.
     * @returns {Promise<boolean>}
     */
    async initialize () {
        try {
            let editorArea = this.container.querySelector('.editor-area');
            if (!editorArea) {
                editorArea = document.createElement('div');
                editorArea.className = 'editor-area';
                this.container.appendChild(editorArea);
            }

            const firstPage = await this._ensureFirstPage();
            if (!firstPage) {
                throw new Error('Failed to create or get first page');
            }

            await this._ensureInitialLine(firstPage);

            this.inputBridge.setup();
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('[EditorDOMHandler] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Clean up resources.
     */
    destroy () {
        this.inputBridge.teardown();

        if (this.events) {
            this.events.clear();
        }

        if (this.lineFormatter) {
            this.lineFormatter.destroy();
        }

        this.container = null;
        this.currentLine = null;
        this.isInitialized = false;
        this.lineFormatter = null;
        this.renderer = null;
        this.events = null;
    }

    // ==============================================
    // Content & Rendering (delegate to rendererAdapter)
    // ==============================================

    /**
     * @param {string|ScriptDocument} content
     * @param {object} [options]
     * @returns {Promise<boolean>}
     */
    async updateContent (content, options = {}) {
        debugLog('[EditorDOMHandler] Starting content update:', {
            contentLength: content ? content.length : 0,
            options
        });

        const preferredLineId = this._getPreferredLineId(options);

        const success = await this.rendererAdapter.updateContent(
            content,
            c => this.parser.parse(c),
            options
        );

        if (success) {
            this._restoreCurrentLine(preferredLineId, options);
        }

        return success;
    }

    /**
     * @param {ScriptDocument} document
     * @param {object} [options]
     * @returns {Promise<boolean>}
     */
    async renderDocument (document, options = {}) {
        const preferredLineId = this._getPreferredLineId(options);

        debugLog('[EditorDOMHandler] renderDocument:', {
            lineCount: document?.lines?.length || 0,
            preferredLineId,
            focus: Boolean(options.focus),
            source: options.source || null
        });

        const success = await this.rendererAdapter.renderDocument(document, options);

        if (success) {
            this._restoreCurrentLine(preferredLineId, options);
        }

        return success;
    }

    // ------------------------------------------
    // Renderer helpers only.
    // DO NOT call for user-initiated edits.
    // Use EditorCoordinator commands instead.
    // ------------------------------------------

    /**
     * Update a line's DOM representation.
     * Renderer helper - not for user edits.
     * @param {string} lineId
     * @param {object} [updates]
     * @returns {HTMLElement|null}
     */
    updateLineById (lineId, updates = {}) {
        return this.rendererAdapter.updateLineById(lineId, updates);
    }

    /**
     * Remove a line from the DOM.
     * Renderer helper - not for user edits.
     * @param {string} lineId
     * @returns {boolean}
     */
    removeLineById (lineId) {
        return this.rendererAdapter.removeLineById(lineId);
    }

    /**
     * Append a line to the DOM.
     * Renderer helper - not for user edits.
     * @param {object} lineData
     * @returns {HTMLElement|null}
     */
    appendLine (lineData) {
        return this.rendererAdapter.appendLine(lineData);
    }

    // ==============================================
    // Caret & Focus (delegate to caretManager)
    // ==============================================

    /**
     * @param {string} lineId
     * @param {object} [options]
     * @returns {HTMLElement|null}
     */
    placeCaret (lineId, options = {}) {
        return this.caretManager.placeCaret(lineId, options);
    }

    /**
     * @param {HTMLElement} line
     * @returns {{line: HTMLElement, position: Range|null}}
     */
    getCursorPosition (line) {
        return this.caretManager.getCursorPosition(line);
    }

    /**
     * @param {HTMLElement} lineElement
     * @param {Node} container
     * @param {number} offset
     * @returns {number|null}
     */
    getLogicalCaretOffset (lineElement, container, offset) {
        return this.caretManager.getLogicalCaretOffset(lineElement, container, offset);
    }

    // ==============================================
    // Selection (delegate to selectionManager)
    // ==============================================

    /**
     * @returns {object|null}
     */
    getSelection () {
        return this.selectionManager.getSelection();
    }

    /**
     * @param {HTMLElement} startLine
     * @param {HTMLElement} endLine
     * @returns {boolean}
     */
    selectLines (startLine, endLine) {
        return this.selectionManager.selectLines(startLine, endLine);
    }

    /**
     * Clear selection.
     */
    clearSelection () {
        this.selectionManager.clearSelection();
    }

    /**
     * @returns {HTMLElement[]}
     */
    getSelectedLines () {
        return this.selectionManager.getSelectedLines();
    }

    /**
     * @returns {boolean}
     */
    isMultiLineSelected () {
        return this.selectionManager.isMultiLineSelected();
    }

    // ==============================================
    // Line Navigation
    // ------------------------------------------
    // DOM traversal helpers for internal use.
    // These assume flat DOM structure and will break
    // with paging, virtualization, or collapsible blocks.
    // ==============================================

    /**
     * Get current focused line.
     * @returns {HTMLElement|null}
     */
    getCurrentLine () {
        return this.currentLine;
    }

    /**
     * Get next sibling line element.
     * DOM traversal helper.
     * @param {HTMLElement} line
     * @returns {HTMLElement|null}
     */
    getNextLine (line) {
        return line?.nextElementSibling || null;
    }

    /**
     * Get previous sibling line element.
     * DOM traversal helper.
     * @param {HTMLElement} line
     * @returns {HTMLElement|null}
     */
    getPreviousLine (line) {
        return line?.previousElementSibling || null;
    }

    /**
     * Get first line in the editor.
     * DOM traversal helper.
     * @returns {HTMLElement|null}
     */
    getFirstLine () {
        const firstPage = this.pageManager.getPages()[0];
        if (!firstPage) return null;
        const content = firstPage.querySelector('.editor-page-content') ||
            firstPage.querySelector('.page-content');
        return content?.firstElementChild || null;
    }

    /**
     * Get last line in the editor.
     * DOM traversal helper.
     * @returns {HTMLElement|null}
     */
    getLastLine () {
        const pages = this.pageManager.getPages();
        const lastPage = pages[pages.length - 1];
        if (!lastPage) return null;
        const content = lastPage.querySelector('.editor-page-content') ||
            lastPage.querySelector('.page-content');
        return content?.lastElementChild || null;
    }

    // ==============================================
    // Line Format
    // ==============================================

    /**
     * @param {HTMLElement} line
     * @param {string} format
     */
    setLineFormat (line, format) {
        if (!line || !this.lineFormatter.isValidFormat(format)) return;
        this.lineFormatter.applyFormatToLine(line, format);
        this.emit(EDITOR_EVENTS.FORMAT_CHANGE, { line, format });
        this.stateManager.setCurrentFormat(format);
    }

    // ==============================================
    // Line Operations (emit intents to Coordinator)
    // ==============================================

    /**
     * @param {HTMLElement} scriptLine
     * @param {Selection} selection
     */
    async splitLine (scriptLine, selection) {
        const lineId = scriptLine?.dataset?.lineId || null;
        this.emit('editIntent', {
            type: 'SPLIT_LINE',
            lineId,
            selection
        });
        return null;
    }

    /**
     * @param {HTMLElement} scriptLine
     */
    async mergeWithNextLine (scriptLine) {
        const lineId = scriptLine?.dataset?.lineId || null;
        this.emit('editIntent', {
            type: 'MERGE_WITH_NEXT',
            lineId
        });
        return false;
    }

    /**
     * Delete selected lines.
     * @returns {Promise<boolean>}
     */
    async deleteSelectedLines () {
        const lineIds = this.selectionManager.getSelectedLines()
            .map(line => line.dataset?.lineId)
            .filter(Boolean);

        this.selectionManager.clearSelection();
        this.emit('editIntent', {
            type: 'DELETE_SELECTED_LINES',
            lineIds
        });

        return lineIds.length > 0;
    }

    // ==============================================
    // Legacy line add/remove
    // ------------------------------------------
    // Renderer helpers only.
    // DO NOT call for user-initiated edits.
    // Use EditorCoordinator commands instead.
    // ==============================================

    /**
     * Add a line element to the page.
     * Renderer helper - not for user edits.
     * @param {HTMLElement} line
     * @param {HTMLElement} [afterElement]
     */
    addLine (line, afterElement = null) {
        if (!line) return;
        let anchorLineId = null;
        if (afterElement?.dataset?.lineId) {
            anchorLineId = afterElement.dataset.lineId;
        }
        this.pageManager.addLine(line, anchorLineId);
        this.emit(EDITOR_EVENTS.LINE_CHANGE, { type: 'add', line });
    }

    /**
     * Remove a line element from the page.
     * Renderer helper - not for user edits.
     * @param {HTMLElement} line
     */
    removeLine (line) {
        if (!line) return;
        this.pageManager.removeLine(line);
        this.emit(EDITOR_EVENTS.LINE_CHANGE, { type: 'remove', line });
    }

    // ==============================================
    // Internal helpers
    // ==============================================

    /**
     * @returns {Promise<HTMLElement|null>}
     */
    async _ensureFirstPage () {
        try {
            let firstPage = this.pageManager.getCurrentPage();
            if (!firstPage) {
                firstPage = await this.pageManager.createNewPage();
            }
            return firstPage;
        } catch (error) {
            console.error('[EditorDOMHandler] Error ensuring first page:', error);
            return null;
        }
    }

    /**
     * @param {HTMLElement} page
     * @returns {Promise<HTMLElement|null>}
     */
    async _ensureInitialLine (page) {
        try {
            const content = page.querySelector('.editor-page-content') ||
                page.querySelector('.page-content');
            if (!content) {
                throw new Error('Page content container not found');
            }

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
            return line;
        } catch (error) {
            console.error('[EditorDOMHandler] Error ensuring initial line:', error);
            return null;
        }
    }

    /**
     * @param {object} [options]
     * @returns {string|null}
     */
    _getPreferredLineId (options = {}) {
        if (options.focus !== true || options.skipFocus) {
            return null;
        }
        return this.currentLine?.dataset?.lineId || null;
    }

    /**
     * @param {string} lineId
     * @param {object} [options]
     */
    _restoreCurrentLine (lineId, options = {}) {
        if (options.focus !== true || options.skipFocus) {
            return;
        }

        let line = null;
        if (lineId) {
            line = this.rendererAdapter.getLineElementById(lineId);
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
}
