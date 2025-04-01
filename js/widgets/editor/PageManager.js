export class PageManager {
    constructor(stateManager) {
        if (!stateManager) {
            throw new Error('StateManager is required for PageManager');
        }

        // Store state manager reference
        this.stateManager = stateManager;

        // Initialize container reference
        this.container = null;

        // Initialize handlers for legacy support
        this._handlers = {
            pageChange: null,
            overflow: null,
            pageSelect: null
        };

        // Initialize observer
        this._observer = null;
    }

    async initialize() {
        try {
            // Reset state
            this.clear();

            // Initialize observer
            await this.setupPageObserver();

            return true;
        } catch (error) {
            console.error('Failed to initialize PageManager:', error);
            throw error;
        }
    }

    setContainer(container) {
        if (!container || !(container instanceof HTMLElement)) {
            throw new Error('Invalid container element provided to PageManager');
        }
        this.container = container;
        this.setupPageObserver();
    }

    async setupPageObserver() {
        try {
            // Cleanup existing observer
            await this.cleanupObserver();

            // Create new observer with error handling
            this._observer = new IntersectionObserver(
                this.handleIntersection.bind(this), { threshold: 0.5 }
            );

            // Observe existing pages with validation
            const pages = this.stateManager.getPages();
            if (pages.length > 0) {
                await this.observeExistingPages();
            }

            return true;
        } catch (error) {
            console.error('Failed to setup page observer:', error);
            this._observer = null;
            throw error;
        }
    }

    async cleanupObserver() {
        if (this._observer) {
            try {
                this._observer.disconnect();
            } catch (error) {
                console.warn('Error disconnecting observer:', error);
            } finally {
                this._observer = null;
            }
        }
    }

    handleIntersection(entries) {
        try {
            entries.forEach(entry => {
                if (!(entry.target instanceof HTMLElement)) {
                    console.warn('Invalid intersection target:', entry.target);
                    return;
                }

                const pageNumber = this.getPageNumber(entry.target);
                if (entry.isIntersecting && pageNumber !== -1) {
                    this.notifyPageSelect(pageNumber);
                    this.stateManager.setCurrentPage(pageNumber + 1);
                }
            });
        } catch (error) {
            console.error('Error handling intersection:', error);
        }
    }

    async observeExistingPages() {
        if (!this._observer) {
            throw new Error('Observer not initialized');
        }

        const pages = this.stateManager.getPages();
        const validPages = pages.filter(page => {
            if (!(page instanceof HTMLElement)) {
                console.warn('Invalid page element:', page);
                return false;
            }
            return true;
        });

        validPages.forEach(page => {
            try {
                this._observer.observe(page);
            } catch (error) {
                console.warn(`Failed to observe page:`, error);
            }
        });
    }

    async addLine(line) {
        if (!line) return null;

        try {
            // Get current page or create new one
            let currentPage = this.getCurrentPage();
            if (!currentPage) {
                currentPage = this.createPage();
            }

            // Add line to page
            currentPage.appendChild(line);

            // Update state
            this.stateManager.setCurrentLine(line);

            // Check for overflow
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    if (currentPage.scrollHeight > currentPage.clientHeight) {
                        this.moveContentToNextPage(line);
                    }
                    resolve();
                });
            });

            return line;
        } catch (error) {
            console.error('Failed to add line:', error);
            throw error;
        }
    }

    moveContentToNextPage(line) {
        // Remove the line from current page
        line.parentNode.removeChild(line);

        // Create new page
        const newPage = this.createPage();

        // Add line to new page
        newPage.appendChild(line);

        // Update current page in state
        this.stateManager.setCurrentPage(this.getPageCount());

        // Notify page change
        this.notifyPageChange();
    }

    async _processLine(line) {
        try {
            const currentPage = this.getCurrentPage();
            if (!currentPage) {
                await this.createNewPage();
            }

            const updatedCurrentPage = this.getCurrentPage();
            if (!updatedCurrentPage) {
                throw new Error('Failed to create new page');
            }

            // Add line to current page
            updatedCurrentPage.appendChild(line);

            // Check and handle overflow
            const hasOverflow = await this.checkPageOverflow();
            if (hasOverflow) {
                await this.handlePageOverflow(line);
            }

            return line;
        } catch (error) {
            console.error('Error processing line:', error);
            throw error;
        }
    }

    async checkPageOverflow() {
        const currentPage = this.getCurrentPage();
        if (!currentPage) return false;

        // Get page metrics
        const metrics = this.stateManager.getPageMetrics();
        const pageMetrics = metrics.get(currentPage) || {
            height: currentPage.clientHeight,
            scrollHeight: currentPage.scrollHeight
        };

        // Update metrics in state
        metrics.set(currentPage, pageMetrics);
        this.stateManager.setPageMetrics(metrics);

        // Check if content exceeds page height
        return pageMetrics.scrollHeight > pageMetrics.height;
    }

    async handlePageOverflow(line) {
        // Create new page
        const newPage = await this.createNewPage();

        // Move the overflowing line to new page
        newPage.appendChild(line);

        // Update current page in state
        this.stateManager.setCurrentPage(this.getPageCount());

        // Notify changes
        this.notifyPageChange();
        return newPage;
    }

    createPage() {
        try {
            const page = document.createElement('div');
            page.className = 'editor-page';
            page.setAttribute('role', 'region');
            page.setAttribute('aria-label', `Page ${this.getPageCount() + 1}`);

            if (this.editorArea) {
                this.editorArea.appendChild(page);

                // Update state
                const pages = this.getPages();
                pages.push(page);
                this.stateManager.setPages(pages);
                this.stateManager.setPageCount(this.getPageCount() + 1);

                // Setup observer if available
                if (this._observer) {
                    try {
                        this._observer.observe(page);
                    } catch (error) {
                        console.warn('Failed to observe new page:', error);
                    }
                }

                // Notify change
                this.notifyPageChange();
            }

            return page;
        } catch (error) {
            console.error('Failed to create page:', error);
            throw error;
        }
    }

    async createNewPage() {
        try {
            // Create the page element
            const page = this.createPage();
            if (!page || !(page instanceof HTMLElement)) {
                throw new Error('Invalid page element created');
            }

            // Validate container
            if (!this.container || !(this.container instanceof HTMLElement)) {
                throw new Error('Container not initialized or invalid');
            }

            // Add to DOM
            this.container.appendChild(page);

            // Update state
            const pages = this.stateManager.getPages();
            pages.push(page);
            this.stateManager.setPages(pages);
            this.stateManager.setCurrentLine(null);

            // Setup observer if available
            if (this._observer) {
                try {
                    this._observer.observe(page);
                } catch (error) {
                    console.warn('Failed to observe new page:', error);
                }
            }

            // Notify change
            this.notifyPageChange();

            return page;
        } catch (error) {
            console.error('Failed to create new page:', error);
            throw error;
        }
    }

    clear() {
        // Cleanup observer first
        if (this._observer) {
            this._observer.disconnect();
            this._observer = null;
        }

        // Clear container
        if (this.editorArea) {
            this.editorArea.innerHTML = '';
        }

        // Reset state
        this.stateManager.setPages([]);
        this.stateManager.setCurrentLine(null);
        this.stateManager.setPageMetrics(new Map());
        this.stateManager.setPageCount(0);

        // Notify changes
        this.notifyPageChange();
    }

    async destroy() {
        try {
            // Cleanup observer
            await this.cleanupObserver();

            // Clear content and state
            this.clear();

            // Clear handlers
            this._handlers = {};
            this.container = null;

        } catch (error) {
            console.error('Error during PageManager destruction:', error);
            throw error;
        }
    }

    // Notification methods (for legacy support)
    notifyPageChange() {
        const pageCount = this.getPageCount();
        this.stateManager.setPageCount(pageCount);
        if (this._handlers.pageChange) {
            this._handlers.pageChange(pageCount);
        }
    }

    notifyOverflow() {
        const currentPage = this.getCurrentPage();
        if (this._handlers.overflow && currentPage) {
            this._handlers.overflow(currentPage);
        }
    }

    // Event handlers (for legacy support)
    onPageChange(callback) {
        this._handlers.pageChange = callback;
    }

    onOverflow(callback) {
        this._handlers.overflow = callback;
    }

    onPageSelect(callback) {
        this._handlers.pageSelect = callback;
    }

    // Getters that use state manager
    getPageCount() {
        return this.stateManager.getPages().length;
    }

    getCurrentPage() {
        try {
            const pages = Array.from(this.editorArea.children || [])
                .filter(child => child.classList.contains('editor-page'));
            return pages[pages.length - 1] || null;
        } catch (error) {
            console.error('Error getting current page:', error);
            return null;
        }
    }

    getPages() {
        return this.stateManager.getPages() || [];
    }

    getFirstPage() {
        try {
            const pages = this.stateManager.getPages();
            const firstPage = pages[0];
            if (firstPage && !(firstPage instanceof HTMLElement)) {
                throw new Error('First page is not a valid HTML element');
            }
            return firstPage || null;
        } catch (error) {
            console.error('Error getting first page:', error);
            return null;
        }
    }

    getCurrentPageNumber() {
        return this.stateManager.getCurrentPage() - 1;
    }

    getPageNumber(page) {
        return this.stateManager.getPages().indexOf(page);
    }

    notifyPageSelect(pageNumber) {
        if (this._handlers.pageSelect) {
            this._handlers.pageSelect(pageNumber);
        }
    }

    hasPages() {
        return this.getPageCount() > 0;
    }

    setEditorArea(editorArea) {
        this.editorArea = editorArea;
        if (this.editorArea) {
            // Create initial page if none exists
            if (!this.hasPages()) {
                this.createPage();
            }
        }
    }
}

// Could improve performance by batching:
const batchUpdate = (operations) => {
    requestAnimationFrame(() => {
        operations.forEach(op => op());
    });
};

class FormatManager {
    constructor() {
        this.flows = {
            natural: ['ACTION', 'SPEAKER', 'DIALOG'],
            special: ['HEADER', 'DIRECTIONS']
        };
        this.activeFlow = 'natural';
    }

    getNextFormat(current, flow = this.activeFlow) {
        const flowArray = this.flows[flow];
        const index = flowArray.indexOf(current);
        return flowArray[(index + 1) % flowArray.length];
    }
}

class BaseStateManager {
    constructor(initialState = {}, validators = {}) {
        this.state = new Map(Object.entries(initialState));
        this.validators = validators;
        this.subscribers = new Map();
    }

    setState(key, value, options = {}) {
        const { validate = true, notify = true } = options;

        if (validate && !this.validate(key, value)) return false;

        const oldValue = this.state.get(key);
        this.state.set(key, value);

        if (notify && oldValue !== value) {
            this.notifySubscribers(key, value);
        }

        return true;
    }

    // ... common functionality
}

export class AppStateManager extends BaseStateManager {
    constructor() {
        super({
            loading: false,
            authenticated: false,
            currentView: null,
            // ... app state
        }, {
            loading: (value) => typeof value === 'boolean',
            // ... app validators
        });
    }
}

export class EditorStateManager extends BaseStateManager {
    constructor() {
        super({
            currentFormat: null,
            currentPage: 1,
            pageCount: 1,
            // ... editor state
        }, {
            currentFormat: (value) => typeof value === 'string' || value === null,
            // ... editor validators
        });
    }
}

export const StateTypes = {
    App: {
        LOADING: 'loading',
        AUTH: 'authenticated',
        // ...
    },
    Editor: {
        FORMAT: 'currentFormat',
        PAGE: 'currentPage',
        // ...
    }
};

class CompositeStateManager {
    constructor(managers) {
        this.managers = new Map(managers);
    }

    getState(domain, key) {
        const manager = this.managers.get(domain);
        return manager ? manager.getState(key) : null;
    }

    setState(domain, key, value) {
        const manager = this.managers.get(domain);
        return manager ? manager.setState(key, value) : false;
    }
}

// Usage:
const stateManager = new CompositeStateManager([
    ['app', new AppStateManager()],
    ['editor', new EditorStateManager()]
]);