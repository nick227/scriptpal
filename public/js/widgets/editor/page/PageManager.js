import { debugLog } from '../../../core/logger.js';
import { MAX_LINES_PER_PAGE } from '../constants.js';

import { PageBreakManager } from './PageBreakManager.js';
import { PageFactory } from './PageFactory.js';
import { PageOperations } from './PageOperations.js';

export class PageManager {
    constructor (container) {
        if (!container || !(container instanceof HTMLElement)) {
            throw new Error('Valid DOM container element is required for PageManager');
        }

        this.container = container;
        this.editorArea = container;
        this.maxLinesPerPage = MAX_LINES_PER_PAGE;
        this.pages = [];
        this.currentPage = null;
        this._destroyed = false;
        this._pageIdCounter = 0;
        this._lineToPageIndex = new Map();

        this._handlers = {
            pageChange: null,
            pageCountChange: null
        };

        this.pageFactory = new PageFactory();
        this.operations = new PageOperations();
        this.pageBreakManager = new PageBreakManager(this);

        this._intentHandlers = {
            ADD_PAGE: this._applyAddPage.bind(this),
            REMOVE_PAGE: this._applyRemovePage.bind(this),
            ADD_LINE: this._applyAddLine.bind(this),
            REMOVE_LINE: this._applyRemoveLine.bind(this),
            NAVIGATE_TO_PAGE: this._applyNavigateToPage.bind(this),
            INSERT_PAGE_BREAK: this._applyInsertPageBreak.bind(this),
            REMOVE_PAGE_BREAK: this._applyRemovePageBreak.bind(this)
        };
    }

    initialize () {
        if (!this._ensureActive('initialize')) {
            return false;
        }

        if (!this.editorArea.classList.contains('editor-area')) {
            this.editorArea.classList.add('editor-area');
        }

        if (this.pages.length === 0) {
            this._applyIntents(this.operations.addPage(), { returnType: 'ADD_PAGE' });
        }

        this._rebuildLineMap();
        return true;
    }

    onPageChange (callback) {
        if (!this._ensureActive('onPageChange')) {
            return false;
        }

        if (typeof callback === 'function') {
            this._handlers.pageChange = callback;
        }
        return true;
    }

    onPageCountChange (callback) {
        if (!this._ensureActive('onPageCountChange')) {
            return false;
        }

        if (typeof callback === 'function') {
            this._handlers.pageCountChange = callback;
        }
        return true;
    }

    _notifyPageChange () {
        if (this._handlers.pageChange) {
            this._handlers.pageChange(this.currentPage);
        }
    }

    _notifyPageCountChange () {
        if (this._handlers.pageCountChange) {
            this._handlers.pageCountChange(this.pages.length);
        }
    }

    _syncPageMetadata () {
        this.pages.forEach((page, index) => {
            page.dataset.pageIndex = String(index);
            if (!page.dataset.pageId) {
                page.dataset.pageId = this._generatePageId();
            }
        });
    }

    getPages () {
        if (!this._ensureActive('getPages')) {
            return [];
        }

        return this.pages;
    }

    getPageCount () {
        if (!this._ensureActive('getPageCount')) {
            return 0;
        }

        return this.pages.length;
    }

    getCurrentPage () {
        if (!this._ensureActive('getCurrentPage')) {
            return null;
        }

        return this.currentPage;
    }

    getNextLine (line) {
        if (!this._ensureActive('getNextLine')) {
            return null;
        }
        return line ? line.nextElementSibling : null;
    }

    getPreviousLine (line) {
        if (!this._ensureActive('getPreviousLine')) {
            return null;
        }
        return line ? line.previousElementSibling : null;
    }

    getNextPage (currentPage) {
        if (!this._ensureActive('getNextPage')) {
            return null;
        }
        const index = this.pages.indexOf(currentPage);
        return index >= 0 ? this.pages[index + 1] || null : null;
    }

    getPreviousPage (currentPage) {
        if (!this._ensureActive('getPreviousPage')) {
            return null;
        }
        const index = this.pages.indexOf(currentPage);
        return index > 0 ? this.pages[index - 1] : null;
    }

    setCurrentPage (page) {
        if (!this._ensureActive('setCurrentPage')) {
            return false;
        }

        if (!page) {
            this.currentPage = null;
            this._notifyPageChange();
            return true;
        }

        if (!this.pages.includes(page)) {
            debugLog('PageManager.setCurrentPage: page not managed by PageManager.');
            return false;
        }

        this.currentPage = page;
        this._notifyPageChange();
        return true;
    }

    createNewPage () {
        if (!this._ensureActive('createNewPage')) {
            return null;
        }

        return this._applyIntents(this.operations.addPage(), { returnType: 'ADD_PAGE' });
    }

    removePage (page) {
        if (!this._ensureActive('removePage')) {
            return false;
        }

        return this._applyIntents(this.operations.removePage(page), { returnType: 'REMOVE_PAGE' });
    }

    addLine (line, anchorLineId = null) {
        if (!this._ensureActive('addLine')) {
            return false;
        }

        const targetPageIndex = this._resolveTargetPageIndex(anchorLineId);
        if (targetPageIndex === null) {
            return false;
        }
        const targetPage = this.pages[targetPageIndex] || null;
        const pageLineCount = targetPage ? this._getLineCountInPage(targetPage) : 0;
        return this._applyIntents(
            this.operations.addLine(line, targetPageIndex, anchorLineId, pageLineCount, this.maxLinesPerPage),
            { returnType: 'ADD_LINE' }
        );
    }

    removeLine (line) {
        if (!this._ensureActive('removeLine')) {
            return false;
        }

        return this._applyIntents(this.operations.removeLine(line), { returnType: 'REMOVE_LINE' });
    }

    navigateToPage (pageIndex) {
        if (!this._ensureActive('navigateToPage')) {
            return false;
        }

        return this._applyIntents(this.operations.navigateToPage(pageIndex), { returnType: 'NAVIGATE_TO_PAGE' });
    }

    ensurePageCapacity (requiredPages, options = {}) {
        if (!this._ensureActive('ensurePageCapacity')) {
            return false;
        }

        const forceReset = options.forceReset === true;

        if (forceReset) {
            this._clearPages();
        }

        while (this.pages.length < requiredPages) {
            this._applyIntents(this.operations.addPage(), { returnType: 'ADD_PAGE' });
        }

        this._syncPageMetadata();
        this._notifyPageCountChange();
        return true;
    }

    waitForPages (requiredPages, maxAttempts = 3) {
        if (!this._ensureActive('waitForPages')) {
            return false;
        }

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const success = this.ensurePageCapacity(requiredPages, {
                forceReset: attempt > 1
            });
            if (success) {
                return true;
            }
        }
        return false;
    }

    validateState () {
        if (!this._ensureActive('validateState')) {
            return false;
        }

        const domPages = Array.from(this.editorArea.querySelectorAll('.editor-page'));
        const mismatch = domPages.length !== this.pages.length
            || domPages.some((page, index) => page !== this.pages[index]);
        if (mismatch) {
            debugLog('PageManager.validateState: DOM/pages mismatch detected.');
            return false;
        }

        if (this.currentPage && !this.pages.includes(this.currentPage)) {
            this.currentPage = this.pages[0] || null;
        }

        return true;
    }

    destroy () {
        if (this._destroyed) {
            return;
        }

        if (this.pageBreakManager) {
            this.pageBreakManager.destroy();
        }

        this._clearPages();
        this.currentPage = null;
        this.container = null;
        this.editorArea = null;
        this.operations = null;
        this.pageFactory = null;
        this.pageBreakManager = null;
        this._handlers = null;
        this._intentHandlers = null;
        this._lineToPageIndex.clear();
        this._destroyed = true;
    }

    _applyIntents (intents, options = {}) {
        const { returnType } = options;
        if (!Array.isArray(intents) || intents.length === 0) {
            return returnType ? false : null;
        }

        const batchState = {
            pageStructureChanged: false
        };

        const orderedIntents = this._orderIntentsForApply(intents);
        let returnValue;
        orderedIntents.forEach(intent => {
            const result = this._applyIntent(intent, batchState);
            if (returnType && intent.type === returnType && returnValue === undefined) {
                returnValue = result;
            } else if (!returnType) {
                returnValue = result;
            }
        });

        this._enforcePageCapacity(batchState);

        if (batchState.pageStructureChanged) {
            this._syncPageMetadata();
            this._notifyPageCountChange();
        }

        if (returnType) {
            return returnValue !== undefined ? returnValue : false;
        }
        return returnValue;
    }

    _applyIntent (intent, batchState) {
        if (!intent || !intent.type) {
            return false;
        }

        const handler = this._intentHandlers[intent.type];
        if (!handler) {
            debugLog(`PageManager._applyIntent: unknown intent ${intent.type}`);
            return false;
        }

        return handler(intent, batchState);
    }

    _applyAddPage (intent, batchState) {
        if (!this.editorArea) {
            return null;
        }

        const pageIndex = this.pages.length;
        const pageId = this._generatePageId();
        const page = this.pageFactory.createPageElement({ pageIndex, pageId });
        this.editorArea.appendChild(page);
        this.pages.push(page);

        if (!this.currentPage) {
            this.setCurrentPage(page);
        }
        if (batchState) {
            batchState.pageStructureChanged = true;
        }
        return page;
    }

    _applyRemovePage (intent, batchState) {
        const page = intent.page;
        const index = this.pages.indexOf(page);
        if (index === -1) {
            return false;
        }

        this._removeLineMapForPage(page);
        page.remove();
        this.pages.splice(index, 1);

        if (this.currentPage === page) {
            this.setCurrentPage(this.pages[0] || null);
        }
        if (batchState) {
            batchState.pageStructureChanged = true;
        }
        this._rebuildLineMap();

        return true;
    }

    _applyAddLine (intent) {
        const { line, anchorLineId, targetPageIndex } = intent;
        const targetPage = this.pages[targetPageIndex] || null;
        if (!line || !targetPage) {
            return false;
        }

        const container = this._getContentContainer(targetPage);
        if (!container) {
            return false;
        }

        const anchorLine = this._getAnchorLine(targetPage, anchorLineId);
        if (anchorLine && anchorLine.parentNode === container) {
            container.insertBefore(line, anchorLine.nextSibling);
        } else {
            container.appendChild(line);
        }

        this._updateLineMapForLine(line, targetPageIndex);
        return { pageIndex: targetPageIndex, line };
    }

    _applyRemoveLine (intent, batchState) {
        const { line } = intent;
        if (!line || !line.parentNode) {
            return false;
        }
        this._removeLineMapForLine(line);
        line.parentNode.removeChild(line);
        this._pruneTrailingEmptyPages(batchState);
        return true;
    }

    _applyNavigateToPage (intent) {
        const page = this.pages[intent.pageIndex] || null;
        if (!page) {
            return false;
        }

        this.setCurrentPage(page);
        page.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
    }

    _applyInsertPageBreak (intent, batchState) {
        if (!this.editorArea) {
            return false;
        }

        const targetPageIndex = this._resolveTargetPageIndex(null);
        if (targetPageIndex === null) {
            return false;
        }

        const pageBreak = this.pageBreakManager.createPageBreakElement(intent.options);
        const nextPage = this.pages[targetPageIndex + 1] || this._applyAddPage(null, batchState);
        this.editorArea.insertBefore(pageBreak, nextPage);
        return true;
    }

    _applyRemovePageBreak (intent, batchState) {
        const pageBreakElement = intent.pageBreakElement;
        if (!pageBreakElement || !pageBreakElement.classList.contains('page-break')) {
            return false;
        }
        const { previousPage, nextPage } = this._getAdjacentPagesForBreak(pageBreakElement);
        if (!previousPage || !nextPage) {
            debugLog('PageManager._applyRemovePageBreak: missing adjacent pages.');
            return false;
        }

        const prevContainer = this._getContentContainer(previousPage);
        const nextContainer = this._getContentContainer(nextPage);
        if (!prevContainer || !nextContainer) {
            return false;
        }

        const nextLines = Array.from(nextContainer.querySelectorAll('.script-line'));
        const prevIndex = this.pages.indexOf(previousPage);
        nextLines.forEach(line => {
            prevContainer.appendChild(line);
            this._updateLineMapForLine(line, prevIndex);
        });

        pageBreakElement.remove();
        this._removeLineMapForPage(nextPage);
        nextPage.remove();
        const nextIndex = this.pages.indexOf(nextPage);
        if (nextIndex !== -1) {
            this.pages.splice(nextIndex, 1);
        }
        if (this.currentPage === nextPage) {
            this.setCurrentPage(previousPage);
        }
        if (batchState) {
            batchState.pageStructureChanged = true;
        }
        this._rebuildLineMap();
        this._pruneTrailingEmptyPages(batchState);
        return true;
    }

    _orderIntentsForApply (intents) {
        const priority = {
            ADD_PAGE: 1,
            REMOVE_PAGE: 1,
            INSERT_PAGE_BREAK: 1,
            REMOVE_PAGE_BREAK: 1,
            ADD_LINE: 2,
            REMOVE_LINE: 2,
            NAVIGATE_TO_PAGE: 3
        };

        return intents
            .map((intent, index) => ({
                intent,
                index,
                priority: priority[intent.type] || 99
            }))
            .sort((a, b) => a.priority - b.priority || a.index - b.index)
            .map(item => item.intent);
    }

    _getContentContainer (page) {
        return page.querySelector('.editor-page-content') || page.querySelector('.page-content');
    }

    _getLineCountInPage (page) {
        const container = this._getContentContainer(page);
        return container ? container.querySelectorAll('.script-line').length : 0;
    }

    _getAdjacentPagesForBreak (pageBreakElement) {
        let previousPage = pageBreakElement.previousElementSibling;
        while (previousPage && !previousPage.classList.contains('editor-page')) {
            previousPage = previousPage.previousElementSibling;
        }

        let nextPage = pageBreakElement.nextElementSibling;
        while (nextPage && !nextPage.classList.contains('editor-page')) {
            nextPage = nextPage.nextElementSibling;
        }

        return { previousPage, nextPage };
    }

    _getAnchorLine (page, anchorLineId) {
        if (!anchorLineId) {
            return null;
        }
        return page.querySelector(`[data-line-id="${anchorLineId}"]`);
    }

    _resolveTargetPageIndex (anchorLineId) {
        if (anchorLineId) {
            const pageIndex = this._findPageIndexForLineId(anchorLineId);
            if (pageIndex !== null) {
                return pageIndex;
            }
        }

        if (this.currentPage) {
            const currentIndex = this.pages.indexOf(this.currentPage);
            if (currentIndex >= 0) {
                return currentIndex;
            }
        }

        return this.pages.length > 0 ? this.pages.length - 1 : null;
    }

    _findPageIndexForLineId (anchorLineId) {
        return this._lineToPageIndex.has(anchorLineId)
            ? this._lineToPageIndex.get(anchorLineId)
            : null;
    }

    _updateLineMapForLine (line, pageIndex) {
        const lineId = line.dataset.lineId;
        if (lineId) {
            this._lineToPageIndex.set(lineId, pageIndex);
        }
    }

    _removeLineMapForLine (line) {
        const lineId = line.dataset.lineId;
        if (lineId) {
            this._lineToPageIndex.delete(lineId);
        }
    }

    _removeLineMapForPage (page) {
        const container = this._getContentContainer(page);
        if (!container) {
            return;
        }
        const lines = container.querySelectorAll('.script-line');
        lines.forEach(line => {
            this._removeLineMapForLine(line);
        });
    }

    _rebuildLineMap () {
        this._lineToPageIndex.clear();
        this.pages.forEach((page, pageIndex) => {
            const container = this._getContentContainer(page);
            if (!container) {
                return;
            }
            const lines = container.querySelectorAll('.script-line');
            lines.forEach(line => {
                this._updateLineMapForLine(line, pageIndex);
            });
        });
    }

    _enforcePageCapacity (batchState) {
        for (let pageIndex = 0; pageIndex < this.pages.length; pageIndex++) {
            const page = this.pages[pageIndex];
            const container = this._getContentContainer(page);
            if (!container) {
                continue;
            }

            let lines = container.querySelectorAll('.script-line');
            while (lines.length > this.maxLinesPerPage) {
                const overflowLine = lines[lines.length - 1];
                let nextPage = this.pages[pageIndex + 1];
                if (!nextPage) {
                    nextPage = this._applyAddPage(null, batchState);
                }

                const nextContainer = this._getContentContainer(nextPage);
                if (!nextContainer) {
                    return;
                }

                nextContainer.insertBefore(overflowLine, nextContainer.firstChild);
                this._updateLineMapForLine(overflowLine, pageIndex + 1);
                lines = container.querySelectorAll('.script-line');
            }
        }
    }

    _pruneTrailingEmptyPages (batchState) {
        let pruned = false;
        while (this.pages.length > 1) {
            const lastPage = this.pages[this.pages.length - 1];
            const container = this._getContentContainer(lastPage);
            if (!container) {
                return pruned;
            }
            const lineCount = container.querySelectorAll('.script-line').length;
            if (lineCount > 0) {
                return pruned;
            }
            this._applyRemovePage({ page: lastPage }, batchState);
            pruned = true;
        }
        return pruned;
    }

    _clearPages () {
        this.pages.forEach(page => {
            page.remove();
        });
        this.pages = [];
        this.currentPage = null;
        this._lineToPageIndex.clear();
    }

    _generatePageId () {
        if (this.pageFactory && typeof this.pageFactory.generatePageId === 'function') {
            return this.pageFactory.generatePageId();
        }
        this._pageIdCounter += 1;
        return `page-${this._pageIdCounter}`;
    }

    _ensureActive (methodName) {
        if (!this._destroyed) {
            return true;
        }
        debugLog(`PageManager.${methodName}: ignored because PageManager is destroyed.`);
        return false;
    }
}
