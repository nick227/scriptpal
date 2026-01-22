export class PageOperations {
    /**
     * @param {object} pageManager
     * @param {object} pageFactory
     */
    constructor (pageManager, pageFactory) {
        this.pageManager = pageManager;
        this.pageFactory = pageFactory;
    }

    addPage () {
        const pageIndex = this.pageManager.pages.length;
        const pageId = `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const page = this.pageFactory.createPageElement({ pageIndex, pageId });
        this.pageManager.editorArea.appendChild(page);
        this.pageManager.pages.push(page);
        this.pageManager._syncPageMetadata();

        if (!this.pageManager.currentPage) {
            this.pageManager.setCurrentPage(page);
        }
        this.pageManager._notifyPageCountChange();
        return page;
    }

    removePage (page) {
        const index = this.pageManager.pages.indexOf(page);
        if (index === -1) {
            return false;
        }

        page.remove();
        this.pageManager.pages.splice(index, 1);
        this.pageManager._syncPageMetadata();
        this.pageManager._notifyPageCountChange();

        if (this.pageManager.currentPage === page) {
            this.pageManager.setCurrentPage(this.pageManager.pages[0] || null);
        }

        return true;
    }

    addLine (line, afterLine = null) {
        const targetPage = this._getTargetPage(afterLine);
        if (!targetPage) {
            return false;
        }

        const container = this._getContentContainer(targetPage);
        if (!container) {
            return false;
        }

        if (afterLine && afterLine.parentNode === container) {
            container.insertBefore(line, afterLine.nextSibling);
        } else {
            container.appendChild(line);
        }

        if (this._isPageFull(targetPage)) {
            this.addPage();
        }

        return true;
    }

    removeLine (line) {
        if (!line || !line.parentNode) {
            return false;
        }
        line.parentNode.removeChild(line);
        return true;
    }

    getLineCount () {
        const { editorArea } = this.pageManager;
        return editorArea.querySelectorAll('.script-line').length;
    }

    getNextLine (line) {
        return line ? line.nextElementSibling : null;
    }

    getPreviousLine (line) {
        return line ? line.previousElementSibling : null;
    }

    getNextPage (currentPage) {
        const index = this.pageManager.pages.indexOf(currentPage);
        return index >= 0 ? this.pageManager.pages[index + 1] || null : null;
    }

    getPreviousPage (currentPage) {
        const index = this.pageManager.pages.indexOf(currentPage);
        return index > 0 ? this.pageManager.pages[index - 1] : null;
    }

    getPageByIndex (index) {
        return this.pageManager.pages[index] || null;
    }

    navigateToPage (pageIndex) {
        const page = this.getPageByIndex(pageIndex);
        if (!page) {
            return false;
        }

        this.pageManager.setCurrentPage(page);
        page.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
    }

    _getTargetPage (afterLine) {
        if (afterLine && typeof afterLine.closest === 'function') {
            const page = afterLine.closest('.editor-page');
            if (page) {
                return page;
            }
        }

        if (this.pageManager.currentPage) {
            return this.pageManager.currentPage;
        }

        return this.pageManager.pages[this.pageManager.pages.length - 1] || null;
    }

    _getContentContainer (page) {
        return page.querySelector('.editor-page-content') || page.querySelector('.page-content');
    }

    _getLineCountInPage (page) {
        const container = this._getContentContainer(page);
        return container ? container.querySelectorAll('.script-line').length : 0;
    }

    _isPageFull (page) {
        return this._getLineCountInPage(page) >= this.pageManager.maxLinesPerPage;
    }
}
