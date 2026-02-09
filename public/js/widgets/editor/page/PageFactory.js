import { createPageShell } from '../../../utils/pageRedistribution.js';
import { PAGE_STYLES, PAGE_MARGIN, CONTENT_HEIGHT } from '../constants.js';

export class PageFactory {
    constructor () {
        this._pageIdCounter = 0;
    }

    generatePageId () {
        this._pageIdCounter += 1;
        return `page-${this._pageIdCounter}`;
    }

    /**
     * Create a new page element.
     * @param {object} options
     * @param {number} options.pageIndex
     * @param {string} options.pageId
     * @param {boolean} [options.isLoaded]
     * @returns {HTMLElement}
     */
    createPageElement (options = {}) {
        const { page, content } = createPageShell();
        page.setAttribute('role', 'document');
        page.setAttribute('aria-label', 'Script Page');

        const pageId = options.pageId || this.generatePageId();
        page.dataset.pageId = pageId;
        page.dataset.pageIndex = String(options.pageIndex);
        page.dataset.loaded = String(options.isLoaded !== false);

        Object.assign(page.style, PAGE_STYLES);

        content.classList.add('page-content');
        content.style.height = `${CONTENT_HEIGHT}px`;
        content.style.padding = `0 ${PAGE_MARGIN}px`;

        return page;
    }
}
