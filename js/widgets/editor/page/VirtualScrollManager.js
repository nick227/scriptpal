export class VirtualScrollManager {
    constructor(options) {
        this.enabled = true;
        this.buffer = options.buffer || 2;
        this.visiblePages = new Set();
        this.pageCache = new Map();
        this.observer = null;
        this.viewportHeight = 0;
        this.container = null;
        this.pageHeight = 0;
        this._scrollTimeout = null;
        this._resizeTimeout = null;
        this._batchTimeout = null;
        this._pendingOperations = new Map();
        this._initializing = false;

        // Bind methods
        this._handleScroll = this._handleScroll.bind(this);
        this._handleResize = this._handleResize.bind(this);
        this._processBatch = this._processBatch.bind(this);
    }

    initialize(container) {
        this._initializing = true;
        this.container = container;
        this.setupIntersectionObserver();
        this.addEventListeners();
        this._handleResize();

        // Wait for initial operations to complete
        if (this._batchTimeout) {
            clearTimeout(this._batchTimeout);
            this._processBatch();
        }
        this._initializing = false;
    }

    setupIntersectionObserver() {
        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    const page = entry.target;
                    const pageNumber = parseInt(page.dataset.pageNumber);

                    if (entry.isIntersecting) {
                        this.visiblePages.add(pageNumber);
                        this._queueOperation(pageNumber, 'load');
                    } else {
                        this.visiblePages.delete(pageNumber);
                        this._queueOperation(pageNumber, 'unload');
                    }
                });
            }, { rootMargin: '200% 0px' }
        );
    }

    addEventListeners() {
        if (this.container) {
            this.container.addEventListener('scroll', this._handleScroll);
            window.addEventListener('resize', this._handleResize);
        }
    }

    _handleScroll() {
        if (!this._scrollTimeout) {
            this._scrollTimeout = setTimeout(() => {
                this.updateVisiblePages();
                this._scrollTimeout = null;
            }, 100);
        }
    }

    _handleResize() {
        if (!this._resizeTimeout) {
            this._resizeTimeout = setTimeout(() => {
                this.viewportHeight = window.innerHeight;
                this.pageHeight = this.calculatePageHeight();
                this.updateVisiblePages();
                this._resizeTimeout = null;
            }, 100);
        }
    }

    calculatePageHeight() {
        const page = this.container.querySelector('.editor-page');
        return page ? page.offsetHeight : 1100;
    }

    _queueOperation(pageNumber, operation) {
        // During initialization, process operations immediately
        if (this._initializing) {
            if (operation === 'load') {
                this.loadPage(pageNumber);
            } else {
                this.unloadPage(pageNumber);
            }
            return;
        }

        this._pendingOperations.set(pageNumber, operation);

        if (!this._batchTimeout) {
            this._batchTimeout = setTimeout(this._processBatch, 50);
        }
    }

    _processBatch() {
        if (this._pendingOperations.size === 0) return;

        // Process all loads first
        for (const [pageNumber, operation] of this._pendingOperations.entries()) {
            if (operation === 'load') {
                this.loadPage(pageNumber);
            }
        }

        // Then process unloads
        for (const [pageNumber, operation] of this._pendingOperations.entries()) {
            if (operation === 'unload') {
                this.unloadPage(pageNumber);
            }
        }

        this._pendingOperations.clear();
        this._batchTimeout = null;
    }

    updateVisiblePages() {
        if (!this.container) return;

        const scrollTop = this.container.scrollTop;
        const viewportHeight = this.viewportHeight;
        const totalPages = this.getTotalPages();

        const startPage = Math.max(0, Math.floor(scrollTop / this.pageHeight) - this.buffer);
        const endPage = Math.min(totalPages - 1, Math.ceil((scrollTop + viewportHeight) / this.pageHeight) + this.buffer);

        // Batch all operations
        for (let i = 0; i < totalPages; i++) {
            const page = this.getPageElement(i);
            if (!page) continue;

            if (i >= startPage && i <= endPage) {
                page.style.display = '';
                this._queueOperation(i, 'load');
            } else {
                page.style.display = 'none';
                this._queueOperation(i, 'unload');
            }
        }
    }

    loadPage(pageNumber) {
        const page = this.getPageElement(pageNumber);
        if (!page || page.dataset.loaded === 'true') return;

        const cachedContent = this.pageCache.get(pageNumber);
        if (cachedContent) {
            page.innerHTML = cachedContent;
            page.dataset.loaded = 'true';
        }
    }

    unloadPage(pageNumber) {
        const page = this.getPageElement(pageNumber);
        if (!page || page.dataset.loaded !== 'true') return;

        this.pageCache.set(pageNumber, page.innerHTML);
        const height = page.offsetHeight;
        page.innerHTML = '';
        page.style.height = `${height}px`;
        page.dataset.loaded = 'false';
    }

    getPageElement(pageNumber) {
        return this.container.querySelector(`[data-page-number="${pageNumber}"]`);
    }

    getTotalPages() {
        return this.container.querySelectorAll('.editor-page').length;
    }

    observePage(page) {
        if (this.observer && page) {
            this.observer.observe(page);
        }
    }

    unobservePage(page) {
        if (this.observer && page) {
            this.observer.unobserve(page);
        }
    }

    destroy() {
        if (this.container) {
            this.container.removeEventListener('scroll', this._handleScroll);
        }
        window.removeEventListener('resize', this._handleResize);

        if (this.observer) {
            this.observer.disconnect();
        }

        if (this._scrollTimeout) {
            clearTimeout(this._scrollTimeout);
        }
        if (this._resizeTimeout) {
            clearTimeout(this._resizeTimeout);
        }
        if (this._batchTimeout) {
            clearTimeout(this._batchTimeout);
            this._pendingOperations.clear();
        }

        this.pageCache.clear();
        this.visiblePages.clear();
    }
}