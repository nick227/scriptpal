import { EDITOR_EVENTS } from '../constants.js';
import { debugLog } from '../../../core/logger.js';

/**
 *
 */
export class ChapterManager {
    /**
     *
     * @param stateManager
     */
    constructor (stateManager) {
        if (!stateManager) throw new Error('StateManager is required');

        this.stateManager = stateManager;
        this.content = null;
        this.chapters = new Map();
        this.eventHandlers = new Map();
    }

    /**
     *
     */
    async initialize () {
        return true;
    }

    /**
     *
     * @param content
     */
    setContent (content) {
        this.content = content;
    }

    /**
     *
     * @param stateManager
     */
    setStateManager (stateManager) {
        this.stateManager = stateManager;
    }

    /**
     *
     * @param event
     * @param handler
     */
    on (event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event).add(handler);
    }

    /**
     *
     * @param event
     * @param data
     */
    emit (event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => handler(data));
        }
    }

    /**
     * Add a new chapter break
     * @param {string} title - Chapter title (optional)
     * @param {number} pageNumber - Page number where chapter starts
     * @returns {string} - Chapter ID
     */
    addChapter (title, pageNumber) {
        const chapterId = this.generateChapterId();
        const chapterNumber = this.getNextChapterNumber();

        const chapter = {
            id: chapterId,
            title: title || `Chapter ${chapterNumber}`,
            pageNumber: pageNumber || 1,
            chapterNumber,
            timestamp: Date.now()
        };

        this.chapters.set(chapterId, chapter);
        this.emit('chapterAdded', chapter);

        debugLog('[ChapterManager] Chapter added:', chapter);
        return chapterId;
    }

    /**
     * Create a chapter break element
     * @param {string} title - Chapter title (optional)
     * @returns {HTMLElement} - Chapter break element
     */
    createChapterBreakElement (title) {
        const chapterNumber = this.getNextChapterNumber();
        const chapterTitle = title || `Chapter ${chapterNumber}`;

        const chapterBreak = document.createElement('div');
        chapterBreak.className = 'script-line chapter-break';
        chapterBreak.setAttribute('data-format', 'chapter-break');
        chapterBreak.setAttribute('data-chapter-number', chapterNumber);
        chapterBreak.innerHTML = `
            <div class="chapter-break-content">
                <div class="chapter-break-line">***</div>
                <div class="chapter-title">${chapterTitle}</div>
                <div class="chapter-break-line">***</div>
            </div>
        `;

        return chapterBreak;
    }

    /**
     * Get the next chapter number
     * @returns {number} - Next chapter number
     */
    getNextChapterNumber () {
        const chapters = this.getAllChapters();
        if (chapters.length === 0) {
            return 1;
        }

        const maxChapterNumber = Math.max(...chapters.map(ch => ch.chapterNumber || 0));
        return maxChapterNumber + 1;
    }

    /**
     *
     * @param chapterId
     */
    removeChapter (chapterId) {
        const chapter = this.chapters.get(chapterId);
        if (chapter) {
            this.chapters.delete(chapterId);
            this.emit('chapterRemoved', chapter);
            return true;
        }
        return false;
    }

    /**
     *
     * @param chapterId
     * @param updates
     */
    updateChapter (chapterId, updates) {
        const chapter = this.chapters.get(chapterId);
        if (chapter) {
            Object.assign(chapter, updates);
            this.emit('chapterUpdated', chapter);
            return true;
        }
        return false;
    }

    /**
     *
     * @param chapterId
     */
    getChapter (chapterId) {
        return this.chapters.get(chapterId);
    }

    /**
     *
     */
    getAllChapters () {
        return Array.from(this.chapters.values())
            .sort((a, b) => a.pageNumber - b.pageNumber);
    }

    /**
     *
     */
    getChapterCount () {
        return this.chapters.size;
    }

    /**
     *
     * @param pageNumber
     */
    getChapterAtPage (pageNumber) {
        return Array.from(this.chapters.values())
            .find(chapter => chapter.pageNumber === pageNumber);
    }

    /**
     *
     */
    generateChapterId () {
        return `chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Insert a chapter break at the current cursor position
     * @param {string} title - Chapter title (optional)
     * @returns {boolean} - Whether the chapter break was inserted successfully
     */
    insertChapterBreak (title) {
        if (!this.content) {
            console.warn('[ChapterManager] No content manager available');
            return false;
        }

        try {
            // Create chapter break element
            const chapterBreak = this.createChapterBreakElement(title);

            // Get current line from content manager
            const currentLine = this.content.getCurrentLine();
            if (!currentLine) {
                console.warn('[ChapterManager] No current line found');
                return false;
            }

            // Insert chapter break after current line
            const nextLine = currentLine.nextElementSibling;
            if (nextLine) {
                currentLine.parentNode.insertBefore(chapterBreak, nextLine);
            } else {
                currentLine.parentNode.appendChild(chapterBreak);
            }

            // Add chapter to tracking
            const pageNumber = this.getCurrentPageNumber();
            this.addChapter(title, pageNumber);

            // Focus the new chapter break
            chapterBreak.focus();

            debugLog('[ChapterManager] Chapter break inserted successfully');
            return true;

        } catch (error) {
            console.error('[ChapterManager] Error inserting chapter break:', error);
            return false;
        }
    }

    /**
     * Get current page number
     * @returns {number} - Current page number
     * @private
     */
    getCurrentPageNumber () {
        if (this.stateManager && typeof this.stateManager.getCurrentPage === 'function') {
            return this.stateManager.getCurrentPage() || 1;
        }
        return 1;
    }

    /**
     * Get current line from content manager
     * @returns {HTMLElement|null} - Current line element
     * @private
     */
    getCurrentLine () {
        if (this.content && typeof this.content.getCurrentLine === 'function') {
            return this.content.getCurrentLine();
        }
        return null;
    }

    /**
     *
     */
    destroy () {
        this.chapters.clear();
        this.eventHandlers.clear();
        this.content = null;
        this.stateManager = null;
    }
}
