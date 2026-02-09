import { debugLog } from '../../../core/logger.js';
import { redistributeOverflowingContent } from '../../../utils/pageRedistribution.js';
import { ScriptDocument } from '../model/ScriptDocument.js';

/**
 * EditorRendererAdapter - RENDERING AUTHORITY.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * RENDERER CONTRACT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Input: Array<ScriptLine>
 *   { id: string, format: string, content: string }
 *
 * Responsibilities:
 *   - Translate document → DOM
 *   - Line reuse optimization
 *   - Page clearing
 *   - lineId → element mapping
 *
 * Rules:
 *   - Renderer is STATELESS and DUMB
 *   - NO semantic logic
 *   - NO format decisions (use resolveLineFormat upstream)
 *   - NO ID generation (use ScriptDocument.createLineId)
 *   - All format changes go through lineFormatter.applyFormatToLine()
 *
 * EditorRenderer must NEVER be imported outside this adapter.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
export class EditorRendererAdapter {
    /**
     * @param {HTMLElement} container - Editor container
     * @param {object} renderer - EditorRenderer instance
     * @param {object} pageManager - PageManager instance
     * @param {object} lineFormatter - LineFormatter instance
     * @param {Map} lineElementMap - Shared line element cache
     */
    constructor (container, renderer, pageManager, lineFormatter, lineElementMap) {
        this.container = container;
        this.renderer = renderer;
        this.pageManager = pageManager;
        this.lineFormatter = lineFormatter;
        this.lineElementMap = lineElementMap;
    }

    /**
     * Render a ScriptDocument to DOM.
     * @param {ScriptDocument} document - Document to render
     * @param {object} [options] - Render options
     * @returns {Promise<boolean>}
     */
    async renderDocument (document, options = {}) {
        if (!document || !Array.isArray(document.lines)) {
            console.error('[EditorRendererAdapter] Invalid document for render');
            return false;
        }

        debugLog('[EditorRendererAdapter] renderDocument:', {
            lineCount: document.lines.length,
            allowInPlace: Boolean(options.allowInPlace),
            source: options.source || null
        });

        // Standardize on { id, format, content } - no property renaming
        const lines = document.lines.map(line => ({
            id: line.id,
            format: line.format,
            content: line.content
        }));

        // Try in-place update first (fastest)
        if (options.allowInPlace && this._tryInPlaceUpdate(lines)) {
            return true;
        }

        // Try line reuse (faster than full rebuild)
        if (options.allowInPlace && await this._renderWithLineReuse(lines)) {
            await this._redistributeOverflowingContent();
            return true;
        }

        // Full rebuild
        const pages = this.pageManager.getPages();
        this._clearPageContent(pages);

        const result = await this.renderer.renderContentChunk(lines, options);
        if (!result || !result.success) {
            return false;
        }

        await this._redistributeOverflowingContent();
        this._rebuildLineElementMap();
        return true;
    }

    /**
     * Update content from raw string or ScriptDocument.
     * @param {string|ScriptDocument} content - Content to render
     * @param {function} parseContent - Parser function for string content
     * @param {object} [options] - Render options
     * @returns {Promise<boolean>}
     */
    async updateContent (content, parseContent, options = {}) {
        try {
            debugLog('[EditorRendererAdapter] Starting content update:', {
                contentLength: content ? content.length : 0,
                options
            });

            if (content instanceof ScriptDocument) {
                return this.renderDocument(content, options);
            }

            // Parse content into lines
            const lines = parseContent(content);

            // Get first page from page manager
            let firstPage = this.pageManager.getCurrentPage();
            if (!firstPage) {
                const pages = this.pageManager.getPages();
                firstPage = pages.length > 0 ? pages[0] : null;
            }
            if (!firstPage) {
                firstPage = await this.pageManager.createNewPage();
                if (!firstPage) {
                    console.error('[EditorRendererAdapter] Failed to create first page');
                    return false;
                }
            }

            // Create initial line if content is empty
            if (lines.length === 0) {
                const pages = this.pageManager.getPages();
                this._clearPageContent(pages);
                const initialLine = this.renderer._createLineElement({
                    id: ScriptDocument.createLineId(),
                    format: 'header',
                    text: ''
                });
                if (initialLine) {
                    const contentEl = firstPage.querySelector('.editor-page-content') ||
                        firstPage.querySelector('.page-content');
                    if (contentEl) {
                        contentEl.appendChild(initialLine);
                        if (initialLine.dataset?.lineId) {
                            this.lineElementMap.set(initialLine.dataset.lineId, initialLine);
                        }
                    }
                }
                return true;
            }

            // Ensure page capacity
            const requiredPages = Math.ceil(lines.length / this.pageManager.maxLinesPerPage);
            const capacityOk = await this.pageManager.ensurePageCapacity(requiredPages, { forceReset: false });
            if (!capacityOk) {
                console.warn('[EditorRendererAdapter] Page capacity check failed, retrying');
                await this.pageManager.waitForPages(requiredPages, 2);
            }

            const pages = this.pageManager.getPages();
            this._clearPageContent(pages);

            const result = await this.renderer.renderContentChunk(lines, {
                ...options,
                startPage: firstPage
            });

            if (!result.success) {
                console.error('[EditorRendererAdapter] Failed to render content chunks');
                return false;
            }

            await this._redistributeOverflowingContent();
            this._rebuildLineElementMap();
            return true;
        } catch (error) {
            console.error('[EditorRendererAdapter] Error updating content:', error);
            return false;
        }
    }

    /**
     * Try to update lines in place (no DOM reconstruction).
     * @param {Array} lines - Lines to render
     * @returns {boolean}
     */
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
            if (domLine.getAttribute('data-format') !== line.format ||
                !domLine.classList.contains(formatClass)) {
                debugLog('[EditorRendererAdapter] In-place format fix:', {
                    lineId: domLine.dataset.lineId,
                    from: domLine.getAttribute('data-format'),
                    to: line.format
                });
                this.lineFormatter.applyFormatToLine(domLine, line.format);
            }

            if (domLine.textContent !== line.content) {
                domLine.textContent = line.content;
            }
        }

        return true;
    }

    /**
     * Render with line element reuse.
     * @param {Array} lines - Lines to render
     * @returns {Promise<boolean>}
     */
    async _renderWithLineReuse (lines) {
        if (!this.pageManager || !this.renderer) {
            return false;
        }

        const requiredPages = Math.ceil(lines.length / this.pageManager.maxLinesPerPage);
        const existingPages = this.pageManager.getPages();

        if (existingPages.length < requiredPages) {
            const ready = await this.pageManager.ensurePageCapacity(requiredPages, { forceReset: false });
            if (!ready) {
                return false;
            }
        }

        const pages = this.pageManager.getPages();
        pages.forEach(page => {
            const content = page.querySelector('.editor-page-content') ||
                page.querySelector('.page-content');
            if (content) {
                content.textContent = '';
            }
        });

        const usedIds = new Set();
        let lineIndex = 0;
        const { maxLinesPerPage } = this.pageManager;

        for (let pageIndex = 0; pageIndex < pages.length && lineIndex < lines.length; pageIndex++) {
            const page = pages[pageIndex];
            const content = page.querySelector('.editor-page-content') ||
                page.querySelector('.page-content');
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
                    if (element.getAttribute('data-format') !== line.format ||
                        !element.classList.contains(formatClass)) {
                        this.lineFormatter.applyFormatToLine(element, line.format);
                    }
                    if (element.textContent !== line.content) {
                        element.textContent = line.content;
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

        // Remove unused elements
        Array.from(this.lineElementMap.keys()).forEach(lineId => {
            if (!usedIds.has(lineId)) {
                const element = this.lineElementMap.get(lineId);
                if (element?.parentNode) {
                    element.parentNode.removeChild(element);
                }
                this.lineElementMap.delete(lineId);
            }
        });

        return true;
    }

    _redistributeOverflowingContent () {
        const pageManager = this.pageManager;
        redistributeOverflowingContent({
            getPages: () => pageManager.getPages(),
            createNewPage: () => pageManager.createNewPage(),
            onPagesChanged: () => pageManager.rebuildLineMap?.()
        });
    }

    /**
     * Clear all page content.
     * @param {HTMLElement[]} [pages]
     */
    _clearPageContent (pages = []) {
        pages.forEach(page => {
            const content = page.querySelector('.editor-page-content') ||
                page.querySelector('.page-content');
            if (content?.children.length > 0) {
                content.innerHTML = '';
            }
        });
    }

    /**
     * Rebuild lineElementMap from DOM.
     */
    _rebuildLineElementMap () {
        this.lineElementMap.clear();
        const domLines = this.container.querySelectorAll('.script-line');
        domLines.forEach(line => {
            if (line.dataset?.lineId) {
                this.lineElementMap.set(line.dataset.lineId, line);
            }
        });
    }

    /**
     * Get line element by ID (cached).
     * @param {string} lineId
     * @returns {HTMLElement|null}
     */
    getLineElementById (lineId) {
        const cached = this.lineElementMap.get(lineId);
        if (cached?.isConnected) {
            return cached;
        }
        const line = this.container.querySelector(`[data-line-id="${lineId}"]`);
        if (line) {
            this.lineElementMap.set(lineId, line);
        }
        return line;
    }

    /**
     * Append a line to the last page.
     * @param {object} lineData
     * @returns {HTMLElement|null}
     */
    appendLine (lineData) {
        const pages = this.pageManager.getPages();
        const lastPage = pages[pages.length - 1];
        if (!lastPage) {
            return null;
        }

        const contentContainer = lastPage.querySelector('.editor-page-content') ||
            lastPage.querySelector('.page-content');
        if (!contentContainer) {
            return null;
        }

        const lineElement = this.renderer._createLineElement(lineData);
        if (!lineElement) {
            return null;
        }

        contentContainer.appendChild(lineElement);
        if (lineElement.dataset?.lineId) {
            this.lineElementMap.set(lineElement.dataset.lineId, lineElement);
        }
        return lineElement;
    }

    /**
     * Remove a line by ID.
     * @param {string} lineId
     * @returns {boolean}
     */
    removeLineById (lineId) {
        if (!lineId) {
            return false;
        }
        const line = this.getLineElementById(lineId);
        if (!line?.parentNode) {
            return false;
        }
        line.parentNode.removeChild(line);
        this.lineElementMap.delete(lineId);
        return true;
    }

    /**
     * Update a line by ID.
     * @param {string} lineId
     * @param {object} [updates]
     * @returns {HTMLElement|null}
     */
    updateLineById (lineId, updates = {}) {
        if (!lineId) {
            return null;
        }
        const line = this.getLineElementById(lineId);
        if (!line) {
            return null;
        }

        if (updates.format && this.lineFormatter.isValidFormat(updates.format)) {
            this.lineFormatter.applyFormatToLine(line, updates.format);
        }

        if (updates.content !== undefined) {
            line.textContent = updates.content;
        }

        return line;
    }
}
