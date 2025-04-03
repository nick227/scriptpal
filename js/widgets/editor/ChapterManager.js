import { BaseWidget } from '../BaseWidget.js';

export class ChapterManager extends BaseWidget {
    constructor() {
        super();
        this.chapters = new Map();
        this._handlers = {
            chapterChange: null,
            chapterSelect: null,
            chapterReorder: null
        };
        this._pageIndex = new Map(); // Index for quick page lookups
    }

    async initialize() {
        // Initialize base widget
        await super.initialize();
    }

    createChapter(title, pageNumber) {
        // Validate page number
        if (pageNumber < 0) return null;

        const chapter = {
            id: `chapter-${Date.now()}`,
            title,
            pageNumber,
            timestamp: Date.now(),
            order: this.chapters.size // Maintain chapter order
        };

        this.chapters.set(chapter.id, chapter);
        this._pageIndex.set(pageNumber, chapter);
        this.notifyChapterChange();
        return chapter;
    }

    getChapterAtPage(pageNumber) {
        return this._pageIndex.get(pageNumber) || null;
    }

    reorderChapters(chapterIds) {
        // Update chapter order
        chapterIds.forEach((id, index) => {
            const chapter = this.chapters.get(id);
            if (chapter) {
                chapter.order = index;
            }
        });

        // Sort chapters by order
        const sortedChapters = Array.from(this.chapters.values())
            .sort((a, b) => a.order - b.order);

        // Update page index
        this._pageIndex.clear();
        sortedChapters.forEach(chapter => {
            this._pageIndex.set(chapter.pageNumber, chapter);
        });

        this.notifyChapterChange();
        this.notifyChapterReorder(sortedChapters);
    }

    getChapters() {
        return Array.from(this.chapters.values())
            .sort((a, b) => a.order - b.order);
    }

    onChapterChange(callback) {
        this._handlers.chapterChange = callback;
    }

    onChapterSelect(callback) {
        this._handlers.chapterSelect = callback;
    }

    onChapterReorder(callback) {
        this._handlers.chapterReorder = callback;
    }

    notifyChapterChange() {
        if (this._handlers.chapterChange) {
            this._handlers.chapterChange(this.getChapters());
        }
    }

    notifyChapterSelect(chapter) {
        if (this._handlers.chapterSelect) {
            this._handlers.chapterSelect(chapter);
        }
    }

    notifyChapterReorder(chapters) {
        if (this._handlers.chapterReorder) {
            this._handlers.chapterReorder(chapters);
        }
    }

    loadChapters(chapters) {
        if (!Array.isArray(chapters)) {
            console.warn('Invalid chapters data:', chapters);
            return;
        }

        // Clear existing chapters
        this.chapters.clear();
        this._pageIndex.clear();

        // Load new chapters
        chapters.forEach((chapter, index) => {
            if (!chapter.id) {
                chapter.id = `chapter-${Date.now()}-${index}`;
            }
            if (typeof chapter.order === 'undefined') {
                chapter.order = index;
            }
            this.chapters.set(chapter.id, chapter);
            this._pageIndex.set(chapter.pageNumber, chapter);
        });

        // Notify listeners
        this.notifyChapterChange();
    }

    destroy() {
        this.chapters.clear();
        this._pageIndex.clear();
        this._handlers = null;
        super.destroy();
    }
}