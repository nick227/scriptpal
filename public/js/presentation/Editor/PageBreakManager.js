/**
 * PageBreakManager - Single responsibility: Manage page breaks
 * Under 300 lines, focused on page break functionality only
 */
export class PageBreakManager {
    /**
     *
     * @param container
     */
    constructor (container) {
        this.container = container;
        this.pageBreaks = new Map();
        this.eventHandlers = new Map();
    }

    /**
     * Create a page break element
     * @param id
     * @param label
     */
    createPageBreak (id, label = 'PAGE BREAK') {
        const pageBreak = document.createElement('div');
        pageBreak.className = 'page-break';
        pageBreak.dataset.pageBreakId = id;

        const indicator = document.createElement('div');
        indicator.className = 'page-break-indicator';
        indicator.textContent = label;
        pageBreak.appendChild(indicator);

        // Store event handlers for cleanup
        const clickHandler = (e) => this.handlePageBreakClick(e);
        const dblClickHandler = (e) => this.handlePageBreakDoubleClick(e);

        pageBreak.addEventListener('click', clickHandler);
        pageBreak.addEventListener('dblclick', dblClickHandler);

        this.eventHandlers.set(id, { click: clickHandler, dblclick: dblClickHandler });
        this.pageBreaks.set(id, pageBreak);

        return pageBreak;
    }

    /**
     * Insert page break at position
     * @param id
     * @param position
     * @param label
     */
    insertPageBreak (id, position, label) {
        const pageBreak = this.createPageBreak(id, label);

        if (position >= this.container.children.length) {
            this.container.appendChild(pageBreak);
        } else {
            this.container.insertBefore(pageBreak, this.container.children[position]);
        }

        return pageBreak;
    }

    /**
     * Remove page break
     * @param id
     */
    removePageBreak (id) {
        const pageBreak = this.pageBreaks.get(id);
        if (pageBreak) {
            // Remove event listeners
            const handlers = this.eventHandlers.get(id);
            if (handlers) {
                pageBreak.removeEventListener('click', handlers.click);
                pageBreak.removeEventListener('dblclick', handlers.dblclick);
                this.eventHandlers.delete(id);
            }

            pageBreak.remove();
            this.pageBreaks.delete(id);
        }
    }

    /**
     * Handle page break click
     * @param event
     */
    handlePageBreakClick (event) {
        event.stopPropagation();
        const pageBreakId = event.currentTarget.dataset.pageBreakId;
        // Emit event or call callback
    }

    /**
     * Handle page break double click
     * @param event
     */
    handlePageBreakDoubleClick (event) {
        event.stopPropagation();
        const pageBreakId = event.currentTarget.dataset.pageBreakId;
        // Emit event or call callback
    }

    /**
     * Clean up all page breaks
     */
    destroy () {
        this.pageBreaks.forEach((pageBreak, id) => {
            this.removePageBreak(id);
        });
    }
}
