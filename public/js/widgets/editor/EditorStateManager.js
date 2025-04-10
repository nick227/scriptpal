import { WidgetStateManager } from '../WidgetStateManager.js';

export class EditorStateManager extends WidgetStateManager {
    constructor() {
        // Initialize with editor-specific state
        super({
            // Core state
            currentFormat: null,
            currentPage: 1,
            pageCount: 1,
            content: '',
            selection: null,
            canUndo: false,
            canRedo: false,
            chapters: [],

            // Page state
            pages: [],
            pageMetrics: new Map(),
            currentLineCount: 0,

            // Chapter state
            currentChapterNumber: 1,
            numberOfChapters: 0,

            // Line state
            currentLine: null,
            lastContent: '',
            pendingChanges: false,

            // Format state
            formatFlow: {},
            formatCycle: [],

            // Processing state
            isProcessing: false,
            processingQueue: Promise.resolve(),

            // Additional state
            ready: false,
            error: null
        });

        // Add editor-specific validators
        this.validators = {
            ...this.validators,
            // Core validators
            currentFormat: (value) => typeof value === 'string' || value === null,
            currentPage: (value) => Number.isInteger(value) && value > 0,
            pageCount: (value) => Number.isInteger(value) && value >= 0,
            content: (value) => typeof value === 'string',
            selection: (value) => value === null || (typeof value === 'object' && 'start' in value && 'end' in value),
            canUndo: (value) => typeof value === 'boolean',
            canRedo: (value) => typeof value === 'boolean',
            chapters: (value) => Array.isArray(value),

            // Page validators
            pages: (value) => Array.isArray(value),
            pageMetrics: (value) => value instanceof Map,
            currentLineCount: (value) => typeof value === 'number' && value >= 0,

            // Line validators
            currentLine: (value) => value === null || value instanceof HTMLElement,
            lastContent: (value) => typeof value === 'string',
            pendingChanges: (value) => typeof value === 'boolean',

            // Format validators
            formatFlow: (value) => typeof value === 'object',
            formatCycle: (value) => Array.isArray(value),

            // Processing validators
            isProcessing: (value) => typeof value === 'boolean',
            processingQueue: (value) => value instanceof Promise,

            // Additional validators
            ready: (value) => typeof value === 'boolean',
        };
    }

    // Editor-specific state methods
    getCurrentFormat() {
        return this.getState('currentFormat');
    }

    setCurrentFormat(format) {
        this.setState('currentFormat', format);
    }

    getCurrentPage() {
        return this.getState('currentPage');
    }

    setCurrentPage(page) {
        this.setState('currentPage', page);
    }

    getPageCount() {
        return this.getState('pageCount');
    }

    setPageCount(count) {
        this.setState('pageCount', count);
    }

    getContent() {
        return this.getState('content');
    }

    setContent(content) {
        this.setState('content', content);
        this.markDirty(true);
    }

    getSelection() {
        return this.getState('selection');
    }

    setSelection(selection) {
        this.setState('selection', selection);
    }

    setHistoryState(canUndo, canRedo) {
        this.setState('canUndo', canUndo);
        this.setState('canRedo', canRedo);
    }

    getChapters() {
        return this.getState('chapters');
    }

    setChapters(chapters) {
        this.setState('chapters', chapters);
    }

    getCurrentChapterNumber() {
        return this.getState('currentChapterNumber');
    }

    setCurrentChapterNumber(chapterNumber) {
        this.setState('currentChapterNumber', chapterNumber);
    }

    getNumberOfChapters() {
        return this.getState('numberOfChapters');
    }

    setNumberOfChapters(numberOfChapters) {
        this.setState('numberOfChapters', numberOfChapters);
    }

    addChapter(chapter) {
        this.setState('chapters', [...this.getState('chapters'), chapter]);
        this.setState('numberOfChapters', this.getState('numberOfChapters') + 1);
    }

    removeChapter(chapter) {
        this.setState('chapters', this.getState('chapters').filter(c => c !== chapter));
        this.setState('numberOfChapters', this.getState('numberOfChapters') - 1);
    }


    // Page state methods
    getPages() {
        return this.getState('pages');
    }

    setPages(pages) {
        this.setState('pages', pages);
    }

    getPageMetrics() {
        return this.getState('pageMetrics');
    }

    setPageMetrics(metrics) {
        this.setState('pageMetrics', metrics);
    }

    // Line state methods
    getCurrentLine() {
        return this.getState('currentLine');
    }

    getCurrentLineNumber() {
        return this.getState('currentLineNumber');
    }

    setCurrentLineNumber(lineNumber) {
        this.setState('currentLineNumber', lineNumber);
    }

    setCurrentLine(line) {
        this.setState('currentLine', line);
    }

    getLastContent() {
        return this.getState('lastContent');
    }

    setLastContent(content) {
        this.setState('lastContent', content);
    }

    // Processing state methods
    isProcessing() {
        return this.getState('isProcessing');
    }

    setProcessing(processing) {
        this.setState('isProcessing', processing);
    }

    getProcessingQueue() {
        return this.getState('processingQueue');
    }

    setProcessingQueue(queue) {
        this.setState('processingQueue', queue);
    }

    // Format state methods
    getFormatFlow() {
        return this.getState('formatFlow');
    }

    setFormatFlow(flow) {
        this.setState('formatFlow', flow);
    }

    getFormatCycle() {
        return this.getState('formatCycle');
    }

    setFormatCycle(cycle) {
        this.setState('formatCycle', cycle);
    }

    // Additional state methods
    getReady() {
        return this.getState('ready');
    }

    setReady(ready) {
        this.setState('ready', ready);
    }

    getError() {
        return this.getState('error');
    }

    setError(error) {
        this.setState('error', error);
    }

    // Editor-specific state keys
    static KEYS = {
        ...WidgetStateManager.KEYS,
        // Core keys
        CURRENT_FORMAT: 'currentFormat',
        CURRENT_PAGE: 'currentPage',
        PAGE_COUNT: 'pageCount',
        CONTENT: 'content',
        SELECTION: 'selection',
        CAN_UNDO: 'canUndo',
        CAN_REDO: 'canRedo',
        CHAPTERS: 'chapters',

        // Page keys
        PAGES: 'pages',
        PAGE_METRICS: 'pageMetrics',
        CURRENT_LINE_COUNT: 'currentLineCount',

        // Line keys
        CURRENT_LINE: 'currentLine',
        LAST_CONTENT: 'lastContent',
        PENDING_CHANGES: 'pendingChanges',

        // Format keys
        FORMAT_FLOW: 'formatFlow',
        FORMAT_CYCLE: 'formatCycle',

        // Processing keys
        IS_PROCESSING: 'isProcessing',
        PROCESSING_QUEUE: 'processingQueue',

        // Additional keys
        READY: 'ready',
        ERROR: 'error'
    };

    // Additional state methods
    getCurrentState() {
        return {
            content: this.getContent(),
            pageCount: this.getPageCount(),
            currentFormat: this.getCurrentFormat(),
            currentPage: this.getCurrentPage(),
            timestamp: Date.now()
        };
    }

    markDirty(isDirty) {
        this.setState('pendingChanges', isDirty);
    }

    reset() {
        this.constructor();
    }

    _createAndSetupPage() {
        try {
            const page = this._createPageElement();
            this.editorArea.appendChild(page);
            this.virtualScroll.observePage(page);
            this.state.pages.push(page);
            this.state.currentPage = page;
            page.dataset.pageNumber = this.state.pages.length;

            // Notify of page count change
            this._notifyPageChange();

            return page;
        } catch (error) {
            console.error('PageManager: Error creating page:', error);
            return null;
        }
    }

    deleteEmptyPage(page) {
        // Updates state.pages when removing pages
    }
}