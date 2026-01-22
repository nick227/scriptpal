import { PAGE_STYLES, PAGE_MARGIN, CONTENT_HEIGHT } from '../constants.js';

export class PageFactory {
    /**
     * Create a new page element.
     * @param {object} options
     * @param {number} options.pageIndex
     * @param {string} options.pageId
     * @param {boolean} [options.isLoaded]
     * @returns {HTMLElement}
     */
    createPageElement (options = {}) {
        const page = document.createElement('div');
        page.className = 'editor-page';
        page.setAttribute('role', 'document');
        page.setAttribute('aria-label', 'Script Page');

        page.dataset.pageId = options.pageId;
        page.dataset.pageIndex = String(options.pageIndex);
        page.dataset.loaded = String(options.isLoaded !== false);

        Object.assign(page.style, PAGE_STYLES);

        const contentContainer = document.createElement('div');
        contentContainer.className = 'editor-page-content page-content';
        contentContainer.style.height = `${CONTENT_HEIGHT}px`;
        contentContainer.style.padding = `${PAGE_MARGIN}px`;

        page.appendChild(contentContainer);
        return page;
    }
}
