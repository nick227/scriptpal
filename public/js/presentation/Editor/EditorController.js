/**
 * EditorController - Main editor controller using clean architecture
 * Focused on orchestrating editor components
 */
import { Controller } from '../../core/Controller.js';

import { PageBreakManager } from './PageBreakManager.js';
import { PageRenderer } from './PageRenderer.js';

/**
 *
 */
export class EditorController extends Controller {
    /**
     *
     */
    constructor () {
        super('Editor');
        this.pageRenderer = null;
        this.pageBreakManager = null;
        this.container = null;
    }

    /**
     * Initialize the editor controller
     */
    onEnter () {
        this.setupContainer();
        this.initializeComponents();
    }

    /**
     * Setup container element
     */
    setupContainer () {
        this.container = document.querySelector('.editor-container');
        if (!this.container) {
            throw new Error('Editor container not found');
        }
    }

    /**
     * Initialize editor components
     */
    initializeComponents () {
        this.pageRenderer = new PageRenderer(this.container);
        this.addComponent('pageRenderer', this.pageRenderer);

        this.pageBreakManager = new PageBreakManager(this.container);
        this.addComponent('pageBreakManager', this.pageBreakManager);
    }

    /**
     * Exit the editor controller
     */
    onExit () {
        this.cleanup();
    }

    /**
     * Clean up resources
     */
    cleanup () {
        if (this.pageRenderer) {
            this.pageRenderer.clear();
        }

        if (this.pageBreakManager) {
            this.pageBreakManager.destroy();
        }
    }

    /**
     * Public API methods for external use
     */

    /**
     * Add a new page
     * @param page
     */
    addPage (page) {
        return this.pageRenderer.renderPage(page);
    }

    /**
     * Update a page
     * @param page
     */
    updatePage (page) {
        this.pageRenderer.updatePage(page);
    }

    /**
     * Remove a page
     * @param pageId
     */
    removePage (pageId) {
        this.pageRenderer.removePage(pageId);
    }

    /**
     * Insert a page break
     * @param id
     * @param position
     * @param label
     */
    insertPageBreak (id, position, label) {
        return this.pageBreakManager.insertPageBreak(id, position, label);
    }

    /**
     * Remove a page break
     * @param id
     */
    removePageBreak (id) {
        this.pageBreakManager.removePageBreak(id);
    }
}
