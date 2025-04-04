import { MAX_LINES_PER_PAGE, MAX_OVERFLOW, LINE_HEIGHT } from '../constants.js';

export class PageOperations {
    constructor(measurement) {
        this.measurement = measurement;
        this.pagePool = [];
        this.activePages = new Set();
        this.poolSize = 5; // Keep 5 pages in pool by default
        this.pageTemplate = this._createPageTemplate();
        this._rebalanceTimeout = null;
        this._pendingOperations = new Map();

        // Fixed line count configuration
        // Standard page height: 996px (1056 - 60px margins)
        // Standard line height: ~22px (20px + 2px spacing)
        this.LINES_PER_PAGE = MAX_LINES_PER_PAGE; // Use constant from shared file
        this.MAX_OVERFLOW = MAX_OVERFLOW; // Maximum allowed overflow for speaker-dialog pairs

        // Special format heights:
        // Action: 22px
        // Character: 22px
        // Dialog: 22px
        // Parenthetical: 22px
        // Transition: 22px
    }

    _createPageTemplate() {
        const template = document.createElement('template');
        template.innerHTML = `
            <div class="editor-page" role="document" aria-label="Script Page">
                <div class="editor-page-content"></div>
            </div>
        `;
        return template;
    }

    createPage() {
        // Try to reuse from pool first
        let page = this.pagePool.pop();
        if (!page) {
            // Create new if pool is empty
            page = this.pageTemplate.content.cloneNode(true).firstElementChild;
        } else {
            // Clean up reused page
            const content = page.querySelector('.editor-page-content');
            content.innerHTML = '';
            page.style.opacity = '1';
            page.classList.remove('rebalancing');
        }
        this.activePages.add(page);
        return page;
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

        // Maintain pool size
        if (this.pagePool.length < this.poolSize) {
            this.pagePool.push(page);
        } else {
            page.remove(); // Remove if pool is full
        }
    }

    async moveLinesAcrossPages(sourceLines, targetPage, beforeLine = null) {
        const contentContainer = targetPage.querySelector('.editor-page-content');
        if (!contentContainer) return { success: false, error: 'No content container' };

        try {
            // Move lines in a single operation
            const fragment = document.createDocumentFragment();
            sourceLines.forEach(line => fragment.appendChild(line));

            if (beforeLine) {
                contentContainer.insertBefore(fragment, beforeLine);
            } else {
                contentContainer.appendChild(fragment);
            }

            return { success: true };
        } catch (error) {
            console.error('Error moving lines:', error);
            return { success: false, error };
        }
    }

    preallocatePages(count = 2) {
        while (this.pagePool.length < count) {
            const page = this.pageTemplate.content.cloneNode(true).firstElementChild;
            this.pagePool.push(page);
        }
    }

    cleanup() {
        // Release all pages back to pool
        this.activePages.forEach(page => this.releasePage(page));
        // Clear excess pages from pool
        while (this.pagePool.length > this.poolSize) {
            const page = this.pagePool.pop();
            page.remove();
        }
    }

    addLine(page, line, afterLine = null) {
        if (!page || !line) return false;

        // Execute immediately instead of queuing
        const contentContainer = page.querySelector('.editor-page-content');
        if (!contentContainer) return false;

        if (afterLine) {
            afterLine.after(line);
        } else {
            contentContainer.appendChild(line);
        }

        return true;
    }

    removeLine(line) {
        if (!line || !line.parentElement) return false;

        // Execute immediately instead of queuing
        line.remove();
        return true;
    }

    moveLine(line, targetPage, afterLine = null) {
        if (!line || !targetPage) return false;

        // Execute immediately instead of queuing
        if (afterLine) {
            afterLine.after(line);
        } else {
            const contentContainer = targetPage.querySelector('.editor-page-content');
            if (!contentContainer) return false;
            contentContainer.appendChild(line);
        }

        return true;
    }

    _queueOperation(operation) {
        const pageId = operation.page.dataset.pageNumber;
        if (!this._pendingOperations.has(pageId)) {
            this._pendingOperations.set(pageId, []);
        }
        this._pendingOperations.get(pageId).push(operation);

        this._scheduleProcessing();
    }

    _scheduleProcessing() {
        if (this._rebalanceTimeout) {
            clearTimeout(this._rebalanceTimeout);
        }

        this._rebalanceTimeout = setTimeout(() => {
            this._processOperations();
        }, 100);
    }

    _processOperations() {
        const pages = Array.from(this._pendingOperations.keys()).sort();
        // Process operations page by page
        pages.forEach(pageId => {
            const operations = this._pendingOperations.get(pageId);
            operations.forEach(operation => {
                switch (operation.type) {
                    case 'add':
                        this._executeAdd(operation);
                        break;
                    case 'remove':
                        this._executeRemove(operation);
                        break;
                    case 'move':
                        this._executeMove(operation);
                        break;
                }
            });
        });

        this._pendingOperations.clear();
        this._rebalanceTimeout = null;
    }

    _executeAdd(operation) {
        const { page, line, afterLine } = operation;
        const contentContainer = page.querySelector('.editor-page-content');
        if (!contentContainer) return;

        if (afterLine) {
            afterLine.after(line);
        } else {
            contentContainer.appendChild(line);
        }
    }

    _executeRemove(operation) {
        const { line } = operation;
        line.remove();
    }

    _executeMove(operation) {
        const { page, line, afterLine } = operation;
        if (afterLine) {
            afterLine.after(line);
        } else {
            page.appendChild(line);
        }
    }

    destroy() {
        if (this._rebalanceTimeout) {
            clearTimeout(this._rebalanceTimeout);
        }
        this._pendingOperations.clear();
    }

    async breakPage(page, triggerLine) {
        if (!page || !triggerLine) return null;

        const contentContainer = page.querySelector('.editor-page-content');
        if (!contentContainer) return null;

        const lines = Array.from(contentContainer.children);
        const triggerIndex = lines.indexOf(triggerLine);

        if (triggerIndex === -1) return null;

        // Create new page for overflow
        const nextPage = this.createPage();
        page.after(nextPage);

        // Move overflow lines to new page
        const overflowLines = lines.slice(triggerIndex);
        await this.moveLinesAcrossPages(overflowLines, nextPage);

        return nextPage;
    }

    async rebalancePages(pages, lines, options = {}) {
        // Simple fixed-count distribution
        const pageBreaks = this._calculateFixedBreaks(lines);
        await this._applyPageBreaks(pages, pageBreaks, lines);
    }

    _countActualLines(element) {
        // Get the computed style to check line height
        const style = window.getComputedStyle(element);
        const elementHeight = element.offsetHeight;
        const lineHeight = parseInt(style.lineHeight) || LINE_HEIGHT; // Use constant from shared file

        // Count explicit line breaks in the text content
        const explicitBreaks = (element.textContent.match(/\n/g) || []).length;

        // Count wrapped lines based on element height
        const wrappedLines = Math.ceil(elementHeight / lineHeight);

        // Return the maximum of wrapped lines or explicit breaks + 1
        return Math.max(wrappedLines, explicitBreaks + 1);
    }

    _getTotalLineCount(elements) {
        return elements.reduce((total, element) => {
            return total + this._countActualLines(element);
        }, 0);
    }

    _calculateFixedBreaks(lines) {
        const pageBreaks = [];
        let startIndex = 0;
        let currentLineCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const element = lines[i];
            const elementLines = this._countActualLines(element);

            // Check if adding this element would exceed page limit
            if (currentLineCount + elementLines > this.LINES_PER_PAGE) {
                // Special case: check for speaker-dialog pairs
                if (i < lines.length - 1 &&
                    element.classList.contains('format-speaker') &&
                    lines[i + 1].classList.contains('format-dialog')) {
                    // If this is a speaker and next is dialog, check if both can fit
                    const nextElementLines = this._countActualLines(lines[i + 1]);
                    if (currentLineCount + elementLines + nextElementLines <= this.LINES_PER_PAGE + this.MAX_OVERFLOW) {
                        // Allow slight overflow for speaker-dialog pairs
                        currentLineCount += elementLines;
                        continue;
                    }
                }

                // Add break before current element
                pageBreaks.push({
                    startIndex,
                    endIndex: i,
                    lineCount: currentLineCount
                });

                // Start new page
                startIndex = i;
                currentLineCount = elementLines;
            } else {
                currentLineCount += elementLines;
            }
        }

        // Add final page if there are remaining lines
        if (startIndex < lines.length) {
            pageBreaks.push({
                startIndex,
                endIndex: lines.length,
                lineCount: currentLineCount
            });
        }

        return pageBreaks;
    }

    async _applyPageBreaks(pages, pageBreaks, lines, isFirstChunk = true) {
        // Pre-allocate required pages
        this.preallocatePages(Math.min(pageBreaks.length, 5));

        // Track existing pages for reuse
        const existingPages = new Set(pages);
        let currentPage = pages[0];
        let pageIndex = 0;

        // Process each chunk of lines
        for (const { startIndex, endIndex, lineCount }
            of pageBreaks) {
            const chunkLines = lines.slice(startIndex, endIndex);
            if (chunkLines.length === 0) continue;

            // Verify line count before applying
            const actualLineCount = this._getTotalLineCount(chunkLines);
            if (actualLineCount > this.LINES_PER_PAGE + this.MAX_OVERFLOW) { // Allow small overflow for speaker-dialog
                console.warn(`Page ${pageIndex + 1} has ${actualLineCount} lines, exceeding limit of ${this.LINES_PER_PAGE}`);
            }

            // Get or create page
            if (!currentPage) {
                currentPage = this.createPage();
                if (pageIndex > 0 && pages[pageIndex - 1]) {
                    pages[pageIndex - 1].after(currentPage);
                }
            }
            existingPages.delete(currentPage);

            // Clear existing content
            const content = currentPage.querySelector('.editor-page-content');
            if (content) {
                content.innerHTML = '';
            }

            // Move lines to page
            await this.moveLinesAcrossPages(chunkLines, currentPage);

            // Setup for next page
            pages[pageIndex] = currentPage;
            pageIndex++;
            currentPage = currentPage.nextElementSibling;
        }

        // Remove any unused pages
        for (const page of existingPages) {
            page.remove();
        }

        // Update pages array to match new reality
        pages.length = pageIndex;
    }
}