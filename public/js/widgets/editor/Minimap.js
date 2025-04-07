import { BaseWidget } from '../BaseWidget.js';

export class Minimap extends BaseWidget {
    constructor(elements) {
        if (!elements || !elements.minimapContainer) {
            throw new Error('Minimap container element is required');
        }
        super(elements);
        this.requiredElements = ['minimapContainer'];

        this.scale = 0.15; // 15% of original size
        this.isDragging = false;
        this.viewport = null;
        this._handlers = {
            pageSelect: null,
            chapterSelect: null
        };
    }

    async initialize() {
        this.validateElements();
        this.createMinimap();
        this.setupEventListeners();
    }

    createMinimap() {
        // Create minimap container
        this.minimap = this.createElement('div', 'minimap');
        this.elements.minimapContainer.appendChild(this.minimap);

        // Create viewport indicator
        this.viewport = this.createElement('div', 'minimap-viewport');
        this.minimap.appendChild(this.viewport);

        // Create chapters container
        this.chaptersContainer = this.createElement('div', 'minimap-chapters');
        this.minimap.appendChild(this.chaptersContainer);
    }

    setupEventListeners() {
        this.minimap.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.minimap.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.minimap.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.minimap.addEventListener('mouseleave', this.handleMouseUp.bind(this));
    }

    handleMouseDown(e) {
        if (e.target === this.minimap || e.target === this.viewport) {
            this.isDragging = true;
            this.updateViewportPosition(e);
        }
    }

    handleMouseMove(e) {
        if (this.isDragging) {
            this.updateViewportPosition(e);
        }
    }

    handleMouseUp() {
        this.isDragging = false;
    }

    updateViewportPosition(e) {
        const rect = this.minimap.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Calculate page number based on position
        const pageNumber = Math.floor(y / (rect.height * this.scale));
        if (this._handlers.pageSelect) {
            this._handlers.pageSelect(pageNumber);
        }
    }

    updateViewport(pageNumber, totalPages) {
        if (!this.viewport) return;

        const height = this.minimap.clientHeight;
        const viewportHeight = height * (1 / totalPages);
        const viewportTop = (pageNumber / totalPages) * height;

        this.viewport.style.top = `${viewportTop}px`;
        this.viewport.style.height = `${viewportHeight}px`;
    }

    updateChapters(chapters) {
        if (!this.chaptersContainer) return;

        this.chaptersContainer.innerHTML = '';
        chapters.forEach(chapter => {
            const chapterElement = this.createChapterElement(chapter);
            this.chaptersContainer.appendChild(chapterElement);
        });
    }

    createChapterElement(chapter) {
        const element = this.createElement('div', 'minimap-chapter');
        element.textContent = chapter.title;
        element.style.top = `${(chapter.pageNumber / this.totalPages) * 100}%`;

        return element;
    }

    setTotalPages(totalPages) {
        this.totalPages = totalPages;
    }

    onPageSelect(callback) {
        this._handlers.pageSelect = callback;
    }

    onChapterSelect(callback) {
        this._handlers.chapterSelect = callback;
    }

    destroy() {
        if (this.minimap) {
            this.minimap.removeEventListener('mousedown', this.handleMouseDown);
            this.minimap.removeEventListener('mousemove', this.handleMouseMove);
            this.minimap.removeEventListener('mouseup', this.handleMouseUp);
            this.minimap.removeEventListener('mouseleave', this.handleMouseUp);
            this.minimap.remove();
        }

        this.minimap = null;
        this.viewport = null;
        this.chaptersContainer = null;
        this._handlers = null;

        super.destroy();
    }
}