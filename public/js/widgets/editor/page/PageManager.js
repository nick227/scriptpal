import { MAX_LINES_PER_PAGE } from '../constants.js';

import { PageBreakManager } from './PageBreakManager.js';
import { PageFactory } from './PageFactory.js';import { PageOperations } from './PageOperations.js';

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

        this._handlers = {
            pageChange: null,
            pageCountChange: null
        };

        this.pageFactory = new PageFactory();
        this.operations = new PageOperations(this, this.pageFactory);
        this.pageBreakManager = new PageBreakManager(this);
    }

    async initialize () {
        if (!this.editorArea.classList.contains('editor-area')) {
            this.editorArea.classList.add('editor-area');
        }

        if (this.pages.length === 0) {
            this.operations.addPage();
        }

        return true;
    }

    onPageChange (callback) {
        if (typeof callback === 'function') {
            this._handlers.pageChange = callback;
        }
    }

    onPageCountChange (callback) {
        if (typeof callback === 'function') {
            this._handlers.pageCountChange = callback;
        }
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
        return this.pages;
    }

    getPageCount () {
        return this.pages.length;
    }

    getCurrentPage () {
        return this.currentPage;
    }

    setCurrentPage (page) {
        if (!page) {
            this.currentPage = null;
            this._notifyPageChange();
            return true;
        }

        if (!this.pages.includes(page)) {
            return false;
        }

        this.currentPage = page;
        this._notifyPageChange();
        return true;
    }

    createNewPage () {
        return this.operations.addPage();
    }

    addLine (line, afterLine = null) {
        return this.operations.addLine(line, afterLine);
    }

    removeLine (line) {
        return this.operations.removeLine(line);
    }

    navigateToPage (pageIndex) {
        return this.operations.navigateToPage(pageIndex);
    }

    async ensurePageCapacity (requiredPages, options = {}) {
        const forceReset = options.forceReset === true;

        if (forceReset) {
            this._clearPages();
        }

        while (this.pages.length < requiredPages) {
            this.operations.addPage();
        }

        this._syncPageMetadata();
        this._notifyPageCountChange();
        return true;
    }

    async waitForPages (requiredPages, maxAttempts = 3) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const success = await this.ensurePageCapacity(requiredPages, {
                forceReset: attempt > 1
            });
            if (success) {
                return true;
            }
        }
        return false;
    }

    validateState () {
        const domPages = Array.from(this.editorArea.querySelectorAll('.editor-page'));
        if (domPages.length !== this.pages.length) {
            this.pages = domPages;
        }

        this._syncPageMetadata();

        if (this.currentPage && !this.pages.includes(this.currentPage)) {
            this.currentPage = this.pages[0] || null;
        }

        return true;
    }

    destroy () {
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
    }

    _clearPages () {
        this.pages.forEach(page => {
            page.remove();
        });
        this.pages = [];
        this.currentPage = null;
    }

    _generatePageId () {
        return `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
}
