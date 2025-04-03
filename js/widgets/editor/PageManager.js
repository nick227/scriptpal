import { VirtualScrollManager } from './page/VirtualScrollManager.js';
import { PageMeasurement } from './page/PageMeasurement.js';
import { PageOperations } from './page/PageOperations.js';

export class PageManager {
    constructor(container) {
        this.container = container;
        this.editorArea = null;
        this.pages = [];
        this.maxHeight = 1100; // 11 inches * 100px per inch

        // Initialize components
        this.measurement = new PageMeasurement();
        this.operations = new PageOperations(this.measurement);
        this.virtualScroll = new VirtualScrollManager({
            buffer: 2
        });

        // Event handling system
        this._eventHandlers = {
            pageChange: null,
            overflow: null,
            pageSelect: null
        };
    }

    // Event handling methods
    onPageChange(callback) {
        this._eventHandlers.pageChange = callback;
    }

    _notifyPageChange() {
        if (this._eventHandlers.pageChange) {
            this._eventHandlers.pageChange(this.pages.length);
        }
    }

    setEditorArea(editorArea) {
        if (!editorArea || !(editorArea instanceof HTMLElement)) {
            throw new Error('Invalid editor area element');
        }
        this.editorArea = editorArea;
        this.container = editorArea.parentElement;

        // Re-initialize if needed
        if (this.pages.length === 0) {
            this._createInitialPage();
        }
    }

    initialize() {
        if (!this.container) {
            throw new Error('Container element is required for PageManager');
        }
        this._createInitialPage();
    }

    _createInitialPage() {
        console.log('PageManager: Creating initial page');
        const page = document.createElement('div');
        page.className = 'editor-page';
        page.setAttribute('role', 'document');
        page.setAttribute('aria-label', 'Script Page');

        // Ensure we have an editor area
        if (!this.editorArea) {
            console.error('PageManager: No editor area available for initial page');
            return null;
        }

        // Add to pages array and DOM
        this.pages.push(page);
        this.editorArea.appendChild(page);
        console.log('PageManager: Initial page created and added to DOM');

        this._notifyPageChange();
        return page;
    }

    async addLine(line) {
        console.log('PageManager: Adding line:', line);

        if (!this.editorArea) {
            console.error('PageManager: No editor area available');
            return false;
        }

        try {
            // Get or create first page if none exists
            let currentPage = this.getCurrentPage();
            if (!currentPage) {
                console.log('PageManager: No current page, creating initial page');
                currentPage = this._createInitialPage();
                if (!currentPage) {
                    console.error('PageManager: Failed to create initial page');
                    return false;
                }
            }

            // Double check page is in pages array
            if (!this.pages.includes(currentPage)) {
                console.log('PageManager: Current page not in pages array, adding it');
                this.pages.push(currentPage);
            }

            // Ensure page is in DOM
            if (!currentPage.isConnected) {
                console.log('PageManager: Page not in DOM, attaching to editor area');
                this.editorArea.appendChild(currentPage);
            }

            console.log('PageManager: Adding line to page:', currentPage);

            // Add line to page
            currentPage.appendChild(line);

            // Ensure line is in DOM before proceeding
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    if (line.isConnected) {
                        console.log('PageManager: Line added and confirmed in DOM');
                        resolve();
                    } else {
                        console.warn('PageManager: Line not in DOM, retrying');
                        // Double check page is in DOM
                        if (!currentPage.isConnected) {
                            this.editorArea.appendChild(currentPage);
                        }
                        currentPage.appendChild(line);
                        requestAnimationFrame(resolve);
                    }
                });
            });

            // Verify line was added successfully
            if (!this.editorArea.querySelector('.script-line')) {
                console.warn('PageManager: No script lines found after addition, verifying structure');
                console.log('PageManager: Current DOM structure:', this.editorArea.innerHTML);
            }

            console.log('PageManager: Line added successfully');
            this._notifyPageChange();
            return true;

        } catch (error) {
            console.error('PageManager: Failed to add line:', error);
            return false;
        }
    }

    createPage() {
        console.log('PageManager: Creating new page');
        const page = document.createElement('div');
        page.className = 'editor-page';
        page.setAttribute('role', 'document');
        page.setAttribute('aria-label', 'Script Page');
        // Don't add to DOM here - let addLine handle that
        console.log('PageManager: New page created:', page);
        return page;
    }

    removeLine(line) {
        if (!line || !line.parentElement) return false;
        line.remove();
        this.rebalancePages();
        return true;
    }

    rebalancePages() {
        if (this.pages.length === 0) return;

        const firstPage = this.pages[0];
        let currentPage = firstPage;
        let nextPage;

        // Process all lines in sequence
        const allLines = Array.from(this.container.querySelectorAll('.script-line'));
        allLines.forEach(line => {
            const pageHeight = this.measurement.getPageHeight(currentPage);
            const lineHeight = this.measurement.getLineHeight(line);

            if (pageHeight + lineHeight > this.maxHeight) {
                // Create new page if needed
                nextPage = document.createElement('div');
                nextPage.className = 'editor-page';
                currentPage.after(nextPage);
                this.pages.push(nextPage);
                currentPage = nextPage;
            }

            currentPage.appendChild(line);
        });

        // Remove empty pages
        this.pages = this.pages.filter(page => {
            if (page.children.length === 0 && page !== firstPage) {
                page.remove();
                return false;
            }
            return true;
        });

        this._notifyPageChange();
    }

    hasPages() {
        // Check both array and DOM
        return this.pages.length > 0 && this.editorArea.querySelector('.editor-page') !== null;
    }

    getPageCount() {
        return this.pages.length;
    }

    getCurrentPage() {
        // First check if we have any pages in the array
        if (this.pages.length > 0) {
            const lastPage = this.pages[this.pages.length - 1];
            // Verify the page is still valid and in DOM
            if (lastPage && lastPage.isConnected) {
                return lastPage;
            } else {
                // Try to find any valid page in the array
                for (const page of this.pages) {
                    if (page && page.isConnected) {
                        return page;
                    }
                }
            }
        }

        // If no valid pages in array, check DOM directly
        if (this.editorArea) {
            const firstPage = this.editorArea.querySelector('.editor-page');
            if (firstPage) {
                // Sync our array with DOM
                this.pages = [firstPage];
                return firstPage;
            }
        }

        return null;
    }

    destroy() {
        this.pages.forEach(page => page.remove());
        this.pages = [];
        this._eventHandlers = {
            pageChange: null,
            overflow: null,
            pageSelect: null
        };
        this.container = null;
        this.editorArea = null;
    }
}

// Helper function for batching DOM updates
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