import { MAX_LINES_PER_PAGE } from '../constants.js';

export class PageOperations {
    constructor(stateManager) {
        // Dependencies
        this.stateManager = stateManager;
        this.editorArea = null;
        this.virtualScroll = null;

        // Page management
        this.pages = [];
        this.currentPage = null;
        this.currentPageLineCount = 0;
        this.maxLinesPerPage = MAX_LINES_PER_PAGE;

        // Event handling
        this._eventHandlers = {
            cursorUpdate: null,
            pageChange: null
        };

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
    }

    addLine(line, beforeLine = null) {
        if (!line) return false;

        try {
            // Ensure we have a current page
            if (!this.currentPage) {
                const page = this._createAndSetupPage();
                if (!page) return false;
            }

            // Determine target page and position
            let targetPage = this.currentPage;
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
            if (this.currentPageLineCount >= this.maxLinesPerPage) {
                // If adding to current page and it's full, create new page
                if (targetPage === this.currentPage && !beforeLine) {
                    const newPage = this._createAndSetupPage();
                    if (!newPage) return false;

                    // Add to new page
                    const newContainer = newPage.querySelector('.editor-page-content');
                    if (!newContainer) return false;

                    newContainer.appendChild(line);
                    this.currentPageLineCount = 1;
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
            if (targetPage === this.currentPage) {
                this.currentPageLineCount++;
            }

            return true;
        } catch (error) {
            console.error('PageOperations: Error adding line:', error);
            return false;
        }
    }

    removeLine(line) {
        if (!line || !line.parentElement) {
            console.warn('PageOperations: Cannot remove line - line or parent is null');
            return false;
        }

        try {
            // Don't remove first line of first page
            if (this._isFirstLineOfFirstPage(line)) {
                console.warn('PageOperations: Cannot remove first line of first page');
                return false;
            }

            const page = line.closest('.editor-page');
            if (!page) {
                console.warn('PageOperations: Cannot remove line - page not found');
                return false;
            }

            // Cache adjacent lines before removal
            const nextLine = line.nextElementSibling;
            const prevLine = line.previousElementSibling;

            // Remove line directly from DOM
            line.remove();

            // Update page state
            if (page === this.currentPage) {
                this.currentPageLineCount--;
            }

            // Handle empty page
            if (page !== this.pages[0]) {
                const contentContainer = page.querySelector('.editor-page-content');
                if (!contentContainer || contentContainer.children.length === 0) {
                    this.deleteEmptyPage(page);
                }
            }

            // Update cursor
            const lineToFocus = prevLine || nextLine;
            if (lineToFocus) {
                this._notifyCursorUpdate(lineToFocus);
            }

            return true;
        } catch (error) {
            console.error('PageOperations: Error removing line:', error);
            return false;
        }
    }

    _createAndSetupPage() {
        try {
            const page = this._createPageElement();
            if (!this.editorArea) return null;

            this.editorArea.appendChild(page);
            if (this.virtualScroll) {
                this.virtualScroll.observePage(page);
            }
            this.pages.push(page);
            this.currentPage = page;
            page.dataset.pageNumber = this.pages.length;

            // Notify of page count change
            this._notifyPageChange();

            return page;
        } catch (error) {
            console.error('PageOperations: Error creating page:', error);
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

    _isFirstLineOfFirstPage(line) {
        const firstPage = this.pages[0];
        if (!firstPage) return false;

        const contentContainer = firstPage.querySelector('.editor-page-content');
        if (!contentContainer) return false;

        const linePage = line.closest('.editor-page');
        if (linePage !== firstPage) return false;

        return contentContainer.firstElementChild === line;
    }

    deleteEmptyPage(page, focusPreviousLine = true) {
        if (!page || page === this.pages[0]) return false;

        const container = page.querySelector('.editor-page-content');
        if (!container || container.children.length > 0) return false;

        const previousPage = page.previousElementSibling;
        const previousContainer = previousPage && previousPage.querySelector('.editor-page-content');
        const lastLine = previousContainer && previousContainer.lastElementChild;

        // Remove from virtual scroll if available
        if (this.virtualScroll) {
            this.virtualScroll.unobservePage(page);
        }

        // Remove the page
        page.remove();

        // Update state
        const pageIndex = this.pages.indexOf(page);
        if (pageIndex > 0) {
            this.pages.splice(pageIndex, 1);

            // Update current page if needed
            if (page === this.currentPage) {
                this.currentPage = this.pages[this.pages.length - 1];
                this.currentPageLineCount = this._getPageLineCount(this.currentPage);
            }

            // Update page numbers
            for (let i = pageIndex; i < this.pages.length; i++) {
                this.pages[i].dataset.pageNumber = i + 1;
            }

            // Notify of page count change
            this._notifyPageChange();
        }

        // Focus the last line of the previous page if requested
        if (focusPreviousLine && lastLine) {
            this._notifyCursorUpdate(lastLine);
        }

        return true;
    }

    // Public API methods
    getCurrentPage() {
        return this.currentPage;
    }

    hasPages() {
        return this.pages.length > 0;
    }

    getPages() {
        return this.pages;
    }

    getPageCount() {
        return this.pages.length;
    }

    setEditorArea(editorArea) {
        this.editorArea = editorArea;
        if (!this.hasPages()) {
            this._createInitialPage();
        }
    }

    setVirtualScroll(virtualScroll) {
        this.virtualScroll = virtualScroll;
    }

    onCursorUpdate(callback) {
        this._eventHandlers.cursorUpdate = callback;
    }

    onPageChange(callback) {
        this._eventHandlers.pageChange = callback;
    }

    _notifyCursorUpdate(line) {
        if (this._eventHandlers.cursorUpdate) {
            this._eventHandlers.cursorUpdate(line);
        }
    }

    _notifyPageChange() {
        if (this._eventHandlers.pageChange) {
            this._eventHandlers.pageChange(this.pages.length);
        }
        // Also update state manager
        if (this.stateManager) {
            this.stateManager.setPageCount(this.pages.length);
        }
    }

    _getPageLineCount(page) {
        if (!page) return 0;
        const container = page.querySelector('.editor-page-content');
        return container ? container.children.length : 0;
    }

    // Lifecycle methods
    async _createInitialPage() {
        if (!this.editorArea) return null;
        const page = this._createAndSetupPage();
        if (page) {
            page.dataset.pageNumber = '1';
            if (this.stateManager) {
                this.stateManager.setPageCount(1);
            }
        }
        return page;
    }

    async initialize(container) {
        if (!container) {
            throw new Error('Container element is required for PageOperations');
        }

        try {
            if (!this.hasPages()) {
                return this._createInitialPage();
            }
            return Promise.resolve();
        } catch (error) {
            console.error('PageOperations: Initialization failed:', error);
            throw error;
        }
    }

    destroy() {
        try {
            // Clean up virtual scroll observers
            if (this.virtualScroll) {
                this.pages.forEach(page => this.virtualScroll.unobservePage(page));
            }

            this.pages = [];
            this.currentPage = null;
            this.currentPageLineCount = 0;
            this.editorArea = null;
            this._eventHandlers = { cursorUpdate: null, pageChange: null };

            // Reset state manager
            if (this.stateManager) {
                this.stateManager.setPageCount(0);
            }
        } catch (error) {
            console.error('PageOperations: Error during cleanup:', error);
            throw error;
        }
    }

    // Add public method for creating pages
    createNewPage() {
        return this._createAndSetupPage();
    }
}