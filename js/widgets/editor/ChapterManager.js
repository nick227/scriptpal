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
            subChapters: [],
            timestamp: Date.now(),
            order: this.chapters.size // Maintain chapter order
        };

        this.chapters.set(chapter.id, chapter);
        this._pageIndex.set(pageNumber, chapter);
        this.notifyChapterChange();
        return chapter;
    }

    createSubChapter(chapterId, title, pageNumber) {
        const chapter = this.chapters.get(chapterId);
        if (!chapter) return null;

        // Validate page number
        if (pageNumber < 0) return null;

        const subChapter = {
            id: `subchapter-${Date.now()}`,
            title,
            pageNumber,
            timestamp: Date.now(),
            order: chapter.subChapters.length
        };

        chapter.subChapters.push(subChapter);
        this._pageIndex.set(pageNumber, {...subChapter, parentChapter: chapter });
        this.notifyChapterChange();
        return subChapter;
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
            chapter.subChapters.forEach(subChapter => {
                this._pageIndex.set(subChapter.pageNumber, {...subChapter, parentChapter: chapter });
            });
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

    destroy() {
        this.chapters.clear();
        this._pageIndex.clear();
        this._handlers = null;
        super.destroy();
    }
}