import { VirtualScrollManager } from './page/VirtualScrollManager.js';
import { PageOperations } from './page/PageOperations.js';
import { MAX_LINES_PER_PAGE } from './constants.js';

// State management class
class PageManagerState {
    constructor() {
        this.pages = [];
        this.currentPage = null;
        this.currentPageLineCount = 0;
        this.maxLinesPerPage = MAX_LINES_PER_PAGE;
        this.totalLines = 0;
    }

    clear() {
        this.pages = [];
        this.currentPage = null;
        this.currentPageLineCount = 0;
        this.totalLines = 0;
    }

    validateState() {
        let actualTotal = 0;
        this.pages.forEach((page, index) => {
            const container = page.querySelector('.editor-page-content');
            if (container) {
                const count = container.children.length;
                if (index === this.pages.length - 1) {
                    this.currentPageLineCount = count;
                }
                actualTotal += count;
                page.dataset.pageNumber = index + 1;
            }
        });
        this.totalLines = actualTotal;
        this.currentPage = this.pages[this.pages.length - 1] || null;
        return actualTotal;
    }

    fastRemovePage(page) {
        const pageIndex = this.pages.indexOf(page);
        if (pageIndex > 0) { // Don't remove first page
            this.pages.splice(pageIndex, 1);
            if (page === this.currentPage) {
                this.currentPage = this.pages[this.pages.length - 1];
                this.currentPageLineCount = this._getPageLineCount(this.currentPage);
            }
            // Update page numbers for remaining pages
            for (let i = pageIndex; i < this.pages.length; i++) {
                this.pages[i].dataset.pageNumber = i + 1;
            }
            return true;
        }
        return false;
    }

    _getPageLineCount(page) {
        if (!page) return 0;
        const container = page.querySelector('.editor-page-content');
        return container ? container.children.length : 0;
    }
}

export class PageManager {
    constructor(container) {
        this.container = container;
        this.editorArea = null;
        this.loadingBar = null;
        this.state = new PageManagerState();
        this.virtualScroll = new VirtualScrollManager({ buffer: 2 });

        // Cache static values
        this.PAGE_HEIGHT = 1056;
        this.PAGE_MARGIN = 30;
        this.CONTENT_HEIGHT = this.PAGE_HEIGHT - (this.PAGE_MARGIN * 2);
        this.PAGE_STYLES = {
            width: '8.5in',
            height: '11in',
            minHeight: `${this.PAGE_HEIGHT}px`,
            padding: `${this.PAGE_MARGIN}px`
        };

        // Initialize components
        this.operations = new PageOperations();

        // Event handling
        this._eventHandlers = {
            pageChange: null,
            overflow: null,
            pageSelect: null,
            cursorUpdate: null
        };
    }

    addLine(line, beforeLine = null) {
        if (!line) return false;

        try {
            // Ensure we have a current page
            if (!this.state.currentPage) {
                const page = this._createAndSetupPage();
                if (!page) return false;
            }

            // Determine target page and position
            let targetPage = this.state.currentPage;
            let targetContainer = targetPage.querySelector('.editor-page-content');

            // If beforeLine is provided, find its page
            if (beforeLine) {
                const beforePage = beforeLine.closest('.editor-page');
                if (beforePage) {
                    targetPage = beforePage;
                    targetContainer = targetPage.querySelector('.editor-page-content');
                }
            }

            // Check if current page is full
            if (this.state.currentPageLineCount >= this.state.maxLinesPerPage) {
                // If adding to current page and it's full, create new page
                if (targetPage === this.state.currentPage && !beforeLine) {
                    const newPage = this._createAndSetupPage();
                    if (!newPage) return false;

                    // Add to new page
                    const newContainer = newPage.querySelector('.editor-page-content');
                    if (!newContainer) return false;

                    newContainer.appendChild(line);
                    this.state.currentPageLineCount = 1;
                    this.state.totalLines++;
                    return true;
                }
            }

            // Add to target page
            if (!targetContainer) return false;

            if (beforeLine) {
                targetContainer.insertBefore(line, beforeLine);
            } else {
                targetContainer.appendChild(line);
            }

            // Update state
            if (targetPage === this.state.currentPage) {
                this.state.currentPageLineCount++;
            }
            this.state.totalLines++;

            return true;
        } catch (error) {
            console.error('PageManager: Error adding line:', error);
            return false;
        }
    }

    removeLine(line) {
        if (!line || !line.parentElement) {
            console.warn('PageManager: Cannot remove line - line or parent is null');
            return false;
        }

        try {
            // Don't remove first line of first page
            if (this._isFirstLineOfFirstPage(line)) {
                console.warn('PageManager: Cannot remove first line of first page');
                return false;
            }

            const page = line.closest('.editor-page');
            if (!page) {
                console.warn('PageManager: Cannot remove line - page not found');
                return false;
            }

            // Cache adjacent lines before removal
            const nextLine = line.nextElementSibling;
            const prevLine = line.previousElementSibling;

            // Remove line directly from DOM
            line.remove();
            this.state.totalLines--;

            // Update page state
            if (page === this.state.currentPage) {
                this.state.currentPageLineCount--;
            }

            // Handle empty page
            if (page !== this.state.pages[0]) {
                const contentContainer = page.querySelector('.editor-page-content');
                if (!contentContainer || contentContainer.children.length === 0) {
                    this.deleteEmptyPage(page);
                }
            }

            // Validate and fix state if needed
            if (this.state.totalLines !== this.state.validateState()) {
                console.warn('PageManager: State mismatch detected and fixed');
            }

            // Update cursor
            const lineToFocus = prevLine || nextLine;
            if (lineToFocus) {
                this._notifyCursorUpdate(lineToFocus);
            }

            this._notifyPageChange();
            return true;
        } catch (error) {
            console.error('PageManager: Error removing line:', error);
            return false;
        }
    }

    _createAndSetupPage() {
        try {
            const page = this._createPageElement();
            this.editorArea.appendChild(page);
            this.virtualScroll.observePage(page);
            this.state.pages.push(page);
            this.state.currentPage = page;
            page.dataset.pageNumber = this.state.pages.length;
            return page;
        } catch (error) {
            console.error('PageManager: Error creating page:', error);
            return null;
        }
    }

    _createPageElement() {
        const page = document.createElement('div');
        page.className = 'editor-page';
        page.setAttribute('role', 'document');
        page.setAttribute('aria-label', 'Script Page');

        // Apply cached styles
        Object.assign(page.style, this.PAGE_STYLES);

        const contentContainer = document.createElement('div');
        contentContainer.className = 'editor-page-content';
        contentContainer.style.cssText = `
            min-height: ${this.CONTENT_HEIGHT}px;
            position: relative;
            overflow: hidden;
        `;

        page.appendChild(contentContainer);
        return page;
    }

    _removeEmptyPage(page) {
        const pageIndex = this.state.pages.indexOf(page);
        if (pageIndex <= 0) return; // Protect first page

        // Fast remove from DOM and tracking
        page.remove();
        this.state.pages.splice(pageIndex, 1);
        this.virtualScroll.unobservePage(page);

        // Batch update page numbers
        for (let i = pageIndex; i < this.state.pages.length; i++) {
            this.state.pages[i].dataset.pageNumber = i + 1;
        }

        // Update current page if needed
        if (page === this.state.currentPage) {
            this.state.currentPage = this.state.pages[this.state.pages.length - 1];
            this.state.currentPageLineCount = this._countLinesInPage(this.state.currentPage);
        }
    }

    _countLinesInPage(page) {
        const contentContainer = page.querySelector('.editor-page-content');
        return contentContainer && contentContainer.children.length || 0;
    }

    _isFirstLineOfFirstPage(line) {
        // Get the first page
        const firstPage = this.state.pages[0];
        if (!firstPage) {
            console.warn('PageManager: No first page found');
            return false;
        }

        // Get the content container of the first page
        const contentContainer = firstPage.querySelector('.editor-page-content');
        if (!contentContainer) {
            console.warn('PageManager: No content container found in first page');
            return false;
        }

        // Check if this line is in the first page
        const linePage = line.closest('.editor-page');
        if (linePage !== firstPage) {
            return false;
        }

        return contentContainer.firstElementChild === line;
    }

    // Public API methods
    getCurrentPage() {
        return this.state.currentPage;
    }

    hasPages() {
        return this.state.pages.length > 0;
    }

    getPages() {
        return this.state.pages;
    }

    getPageCount() {
        return this.state.pages.length;
    }

    setEditorArea(editorArea) {
        this.editorArea = editorArea;
        if (!this.hasPages()) {
            this._createInitialPage();
        }
    }

    // Event handling
    onPageChange(callback) {
        this._eventHandlers.pageChange = callback;
    }

    _notifyPageChange() {
        if (this._eventHandlers.pageChange) {
            this._eventHandlers.pageChange(this.state.pages.length);
        }
    }

    onCursorUpdate(callback) {
        this._eventHandlers.cursorUpdate = callback;
    }

    _notifyCursorUpdate(line) {
        if (this._eventHandlers.cursorUpdate) {
            this._eventHandlers.cursorUpdate(line);
        }
    }

    // Lifecycle methods
    async _createInitialPage() {
        if (!this.editorArea) return null;
        const page = this._createAndSetupPage();
        if (page) {
            page.dataset.pageNumber = '1';
        }
        return page;
    }

    async initialize() {
        if (!this.container) {
            throw new Error('Container element is required for PageManager');
        }

        try {
            this.virtualScroll.initialize(this.container);
            if (!this.hasPages()) {
                return this._createInitialPage();
            }
            return Promise.resolve();
        } catch (error) {
            console.error('PageManager: Initialization failed:', error);
            throw error;
        }
    }

    destroy() {
        try {
            this.virtualScroll.destroy();
            this.state.clear();
            this.editorArea = null;
            this._eventHandlers = { pageChange: null, cursorUpdate: null };
        } catch (error) {
            console.error('PageManager: Error during cleanup:', error);
            throw error;
        }
    }

    deleteEmptyPage(page, focusPreviousLine = true) {
        if (!page || page === this.state.pages[0]) return false;

        const container = page.querySelector('.editor-page-content');
        if (!container || container.children.length > 0) return false;

        const previousPage = page.previousElementSibling;
        const previousContainer = previousPage && previousPage.querySelector('.editor-page-content');
        const lastLine = previousContainer && previousContainer.lastElementChild;

        // Remove the page
        page.remove();

        // Update state
        const pageIndex = this.state.pages.indexOf(page);
        if (pageIndex > 0) { // Don't remove first page
            this.state.pages.splice(pageIndex, 1);

            // Update current page if needed
            if (page === this.state.currentPage) {
                this.state.currentPage = this.state.pages[this.state.pages.length - 1];
                this.state.currentPageLineCount = this.state._getPageLineCount(this.state.currentPage);
            }

            // Update page numbers
            for (let i = pageIndex; i < this.state.pages.length; i++) {
                this.state.pages[i].dataset.pageNumber = i + 1;
            }
        }

        // Update virtual scroll if the method exists
        if (this.virtualScroll && typeof this.virtualScroll.unobservePage === 'function') {
            this.virtualScroll.unobservePage(page);
        }

        // Focus the last line of the previous page if requested
        if (focusPreviousLine && lastLine) {
            this._notifyCursorUpdate(lastLine);
        }

        this._notifyPageChange();
        return true;
    }

    releasePage(page) {
        if (!page || !this.activePages.has(page)) return;

        // Clean up page
        const content = page.querySelector('.editor-page-content');
        if (content) {
            content.innerHTML = '';
        }
        page.style.opacity = '0.5';
        page.classList.add('rebalancing');

        this.activePages.delete(page);

        // Update virtual scroll if the method exists
        if (this.virtualScroll && typeof this.virtualScroll.unobservePage === 'function') {
            this.virtualScroll.unobservePage(page);
        }

        // Maintain pool size
        if (this.pagePool.length < this.poolSize) {
            this.pagePool.push(page);
        } else {
            page.remove(); // Remove if pool is full
        }
    }
}