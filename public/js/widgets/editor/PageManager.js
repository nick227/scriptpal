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
        this.operations = new PageOperations();
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

        // Event handling
        this._eventHandlers = {
            pageChange: null,
            overflow: null,
            pageSelect: null,
            cursorUpdate: null
        };
    }

    // Add new methods for handling overflow
    handlePageOverflow(page) {
        if (!page) return;

        const container = page.querySelector('.editor-page-content');
        if (!container) return;

        const lines = Array.from(container.children);
        if (lines.length <= MAX_LINES_PER_PAGE) return;

        // Get overflow lines
        const overflowLines = lines.slice(MAX_LINES_PER_PAGE);

        // Move overflow lines to next page
        this.redistributeLines(overflowLines, page);
    }

    redistributeLines(lines, sourcePage) {
        if (!lines.length) return;

        let currentPage = sourcePage;
        let remainingLines = [...lines];

        while (remainingLines.length > 0) {
            // Get or create next page
            let nextPage = currentPage.nextElementSibling;
            if (!nextPage || !nextPage.classList.contains('editor-page')) {
                nextPage = this.operations.createNewPage();
                if (!nextPage) {
                    console.error('Failed to create new page for content redistribution');
                    break;
                }
            }

            // Get existing lines from next page
            const nextContainer = nextPage.querySelector('.editor-page-content');
            const existingLines = Array.from(nextContainer.children);

            // Combine overflow lines with existing lines
            const allLines = [...remainingLines, ...existingLines];

            // Clear next page
            while (nextContainer.firstChild) {
                nextContainer.firstChild.remove();
            }

            // Fill next page up to MAX_LINES_PER_PAGE
            const linesToMove = allLines.slice(0, MAX_LINES_PER_PAGE);
            linesToMove.forEach(line => {
                nextContainer.appendChild(line);
            });

            // Update remaining lines
            remainingLines = allLines.slice(MAX_LINES_PER_PAGE);
            currentPage = nextPage;
        }

        // Update page numbers and state
        this.updatePageNumbers();
        if (this._eventHandlers.pageChange) {
            this._eventHandlers.pageChange(this.getPages().length);
        }
    }

    updatePageNumbers() {
        const pages = this.getPages();
        pages.forEach((page, index) => {
            page.dataset.pageNumber = index + 1;
        });
    }

    addLine(line, beforeLine = null) {
        const added = this.operations.addLine(line, beforeLine);
        if (added) {
            // Get the page where the line was added
            const page = line.closest('.editor-page');
            if (page) {
                // Handle any overflow caused by the addition
                this.handlePageOverflow(page);
            }
        }
        return added;
    }

    removeLine(line) {
        return this.operations.removeLine(line);
    }

    getCurrentPage() {
        return this.operations.getCurrentPage();
    }

    hasPages() {
        return this.operations.hasPages();
    }

    getPages() {
        return this.operations.getPages();
    }

    getPageCount() {
        return this.operations.getPageCount();
    }

    setEditorArea(editorArea) {
        this.editorArea = editorArea;
        this.operations.setEditorArea(editorArea);
        this.virtualScroll.initialize(this.container);
    }

    onPageChange(callback) {
        this.operations.onPageChange(callback);
    }

    onCursorUpdate(callback) {
        this.operations.onCursorUpdate(callback);
    }

    async initialize() {
        if (!this.container) {
            throw new Error('Container element is required for PageManager');
        }

        try {
            this.virtualScroll.initialize(this.container);
            return this.operations.initialize(this.container);
        } catch (error) {
            console.error('PageManager: Initialization failed:', error);
            throw error;
        }
    }

    destroy() {
        try {
            this.virtualScroll.destroy();
            this.operations.destroy();
            this.editorArea = null;
        } catch (error) {
            console.error('PageManager: Error during cleanup:', error);
            throw error;
        }
    }

    // Override the existing deleteEmptyPage to handle cascading content
    deleteEmptyPage(page) {
        if (!page || page === this.getPages()[0]) return false;

        const container = page.querySelector('.editor-page-content');
        if (!container || container.children.length > 0) return false;

        // Get all subsequent pages
        let currentPage = page;
        const subsequentPages = [];
        while (currentPage.nextElementSibling &&
            currentPage.nextElementSibling.classList.contains('editor-page')) {
            subsequentPages.push(currentPage.nextElementSibling);
            currentPage = currentPage.nextElementSibling;
        }

        // Remove the empty page
        if (this.virtualScroll) {
            this.virtualScroll.unobservePage(page);
        }
        page.remove();

        // Redistribute content from subsequent pages
        if (subsequentPages.length > 0) {
            const allLines = [];
            subsequentPages.forEach(page => {
                const container = page.querySelector('.editor-page-content');
                if (container) {
                    Array.from(container.children).forEach(line => {
                        allLines.push(line);
                    });
                }
            });

            // Remove all subsequent pages
            subsequentPages.forEach(page => {
                if (this.virtualScroll) {
                    this.virtualScroll.unobservePage(page);
                }
                page.remove();
            });

            // Redistribute all collected lines
            if (allLines.length > 0) {
                const firstPage = this.getPages()[0];
                this.redistributeLines(allLines, firstPage);
            }
        }

        return true;
    }
}