export class PageBreakManager {
    /**
     * @param {object} pageManager
     */
    constructor (pageManager) {
        this.pageManager = pageManager;
    }

    createPageBreakElement (options = {}) {
        const type = options.type || 'manual';
        const label = options.label || 'Page Break';

        const pageBreak = document.createElement('div');
        pageBreak.className = 'page-break';
        pageBreak.setAttribute('data-page-break-type', type);
        pageBreak.setAttribute('data-page-break-id', this._generatePageBreakId());

        const indicator = document.createElement('div');
        indicator.className = 'page-break-indicator';
        indicator.textContent = label;
        pageBreak.appendChild(indicator);

        return pageBreak;
    }

    insertPageBreak (options = {}) {
        return [{ type: 'INSERT_PAGE_BREAK', options }];
    }

    removePageBreak (pageBreakElement) {
        return [{ type: 'REMOVE_PAGE_BREAK', pageBreakElement }];
    }

    getAllPageBreaks () {
        const { editorArea } = this.pageManager;
        return editorArea ? Array.from(editorArea.querySelectorAll('.page-break')) : [];
    }

    getPageBreaksByType (type) {
        return this.getAllPageBreaks().filter(breakElement => (
            breakElement.dataset.pageBreakType === type
        ));
    }

    destroy () {
        this.pageManager = null;
    }

    _generatePageBreakId () {
        return `pagebreak_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }
}
