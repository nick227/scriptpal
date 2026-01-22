/**
 * PageRenderer - Single responsibility: Render pages to DOM
 * Under 300 lines, focused on rendering only
 */
export class PageRenderer {
    /**
     *
     * @param container
     */
    constructor (container) {
        this.container = container;
        this.pages = new Map();
        this.currentPageId = null;
    }

    /**
     * Render a page
     * @param page
     */
    renderPage (page) {
        const pageElement = this.createPageElement(page);
        this.pages.set(page.id, pageElement);
        this.container.appendChild(pageElement);
        return pageElement;
    }

    /**
     * Create page DOM element
     * @param page
     */
    createPageElement (page) {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'page';
        pageDiv.dataset.pageId = page.id;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'page-content';
        contentDiv.textContent = page.content;

        pageDiv.appendChild(contentDiv);
        return pageDiv;
    }

    /**
     * Update page content
     * @param page
     */
    updatePage (page) {
        const pageElement = this.pages.get(page.id);
        if (pageElement) {
            const contentDiv = pageElement.querySelector('.page-content');
            contentDiv.textContent = page.content;
        }
    }

    /**
     * Remove page from DOM
     * @param pageId
     */
    removePage (pageId) {
        const pageElement = this.pages.get(pageId);
        if (pageElement) {
            pageElement.remove();
            this.pages.delete(pageId);
        }
    }

    /**
     * Clear all pages
     */
    clear () {
        this.pages.forEach(pageElement => pageElement.remove());
        this.pages.clear();
    }

    /**
     * Get page element by ID
     * @param pageId
     */
    getPageElement (pageId) {
        return this.pages.get(pageId);
    }
}
