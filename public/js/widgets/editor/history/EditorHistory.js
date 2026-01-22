import { EDITOR_EVENTS } from '../constants.js';
import { debugLog } from '../../../core/logger.js';

/**
 *
 */
export class EditorHistory {
    /**
     *
     * @param stateManager
     */
    constructor (stateManager) {
        if (!stateManager) throw new Error('StateManager is required');

        this.stateManager = stateManager;
        this.history = [];
        this.currentIndex = -1;
        this.maxHistory = 100;
        this.eventHandlers = new Map();

        // Page history tracking
        this.pageHistory = [];
        this.currentPageIndex = -1;
        this.maxPageHistory = 50;
        this.pageManager = null;
        this.content = null;

        // Performance optimizations
        this._pageStateCache = new Map();
        this._cacheExpiry = 30000; // 30 seconds
        this._lastCacheCleanup = 0;
        this._batchPageOperations = [];
        this._isBatching = false;
    }

    /**
     *
     */
    async initialize () {
        // Set up initial state
        const currentState = this.stateManager.getCurrentState();
        if (currentState) {
            this.saveState(currentState);
        }
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
     * Save a new state to history
     * @param {object} state - The state to save
     * @param {boolean} force - Whether to force save even if state is similar
     */
    saveState (state, force = false) {
        if (!state || typeof state !== 'object') {
            console.warn('[EditorHistory] Invalid state provided');
            return false;
        }

        // Check if state is meaningfully different
        if (!force && this._isStateSimilar(state)) {
            return false;
        }

        // Remove any future states if we're not at the end
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }

        // Create state snapshot with metadata
        const stateSnapshot = {
            ...state,
            type: 'state',
            timestamp: Date.now(),
            id: this._generateStateId()
        };

        // Add new state
        this.history.push(stateSnapshot);
        this.currentIndex++;

        // Trim history if it exceeds max size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.currentIndex--;
        }

        debugLog('[EditorHistory] State saved:', {
            id: stateSnapshot.id,
            contentLength: state.content ? state.content.length : 0,
            historySize: this.history.length,
            currentIndex: this.currentIndex
        });

        return true;
    }

    /**
     *
     */
    undo () {
        if (!this.canUndo()) return false;

        const currentEntry = this.history[this.currentIndex];
        if (!currentEntry) return false;

        if (currentEntry.type === 'commands') {
            if (!this._applyCommandEntry(currentEntry, true)) {
                return false;
            }
            this.currentIndex--;
            this.emit(EDITOR_EVENTS.UNDO);
            return true;
        }

        if (this.currentIndex <= 0) return false;
        this.currentIndex--;
        const state = this.history[this.currentIndex];

        if (state) {
            this.stateManager.applyState(state);
            this.emit(EDITOR_EVENTS.UNDO);
            return true;
        }
        return false;
    }

    /**
     *
     */
    redo () {
        if (!this.canRedo()) return false;

        const nextEntry = this.history[this.currentIndex + 1];
        if (!nextEntry) return false;

        if (nextEntry.type === 'commands') {
            if (!this._applyCommandEntry(nextEntry, false)) {
                return false;
            }
            this.currentIndex++;
            this.emit(EDITOR_EVENTS.REDO);
            return true;
        }

        this.currentIndex++;
        const state = this.history[this.currentIndex];

        if (state) {
            this.stateManager.applyState(state);
            this.emit(EDITOR_EVENTS.REDO);
            return true;
        }
        return false;
    }

    /**
     *
     */
    canUndo () {
        if (this.currentIndex < 0) return false;
        const entry = this.history[this.currentIndex];
        if (entry && entry.type === 'commands') return true;
        return this.currentIndex > 0;
    }

    /**
     *
     */
    canRedo () {
        return this.currentIndex < this.history.length - 1;
    }

    /**
     *
     */
    clear () {
        this.history = [];
        this.currentIndex = -1;
    }

    /**
     * Store a command batch in history for undo/redo.
     * @param {Array} commands
     * @param {Array} inverseCommands
     * @param {object} metadata
     */
    pushCommandBatch (commands = [], inverseCommands = [], metadata = {}) {
        if (!Array.isArray(commands) || commands.length === 0) {
            console.warn('[EditorHistory] Invalid command batch');
            return false;
        }

        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }

        const entry = {
            type: 'commands',
            commands,
            inverseCommands,
            metadata,
            timestamp: Date.now(),
            id: this._generateStateId()
        };

        this.history.push(entry);
        this.currentIndex++;

        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.currentIndex--;
        }

        return true;
    }

    /**
     * Check if a state is similar to the current state
     * @param {object} newState - The new state to compare
     * @returns {boolean} - Whether the state is similar
     * @private
     */
    _isStateSimilar (newState) {
        if (this.history.length === 0) return false;

        const currentState = this._getLastStateEntry();
        if (!currentState) return false;

        // Compare key properties
        const keyProperties = ['content', 'cursorPosition', 'format', 'selection'];
        for (const prop of keyProperties) {
            if (newState[prop] !== currentState[prop]) {
                return false;
            }
        }

        return true;
    }

    /**
     * Generate a unique state ID
     * @returns {string} - Unique state ID
     * @private
     */
    _generateStateId () {
        return `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get current state information
     * @returns {object} - Current state info
     */
    getCurrentStateInfo () {
        if (this.currentIndex < 0 || this.currentIndex >= this.history.length) {
            return null;
        }

        const state = this.history[this.currentIndex];
        return {
            id: state.id,
            timestamp: state.timestamp,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            historySize: this.history.length,
            currentIndex: this.currentIndex
        };
    }

    /**
     * Get history statistics
     * @returns {object} - History statistics
     */
    getStats () {
        return {
            totalStates: this.history.length,
            currentIndex: this.currentIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            maxHistory: this.maxHistory,
            oldestState: this.history.length > 0 ? this.history[0].timestamp : null,
            newestState: this.history.length > 0 ? this.history[this.history.length - 1].timestamp : null
        };
    }

    /**
     *
     */
    destroy () {
        this.clear();
        this.eventHandlers.clear();
        this.stateManager = null;
        this.content = null;
    }

    _applyCommandEntry (entry, useInverse) {
        if (!this.content || typeof this.content.applyCommands !== 'function') {
            console.warn('[EditorHistory] Content not available for command undo/redo');
            return false;
        }

        const commands = useInverse ? entry.inverseCommands : entry.commands;
        if (!Array.isArray(commands) || commands.length === 0) {
            return false;
        }

        this.content.applyCommands(commands, {
            source: useInverse ? 'undo' : 'redo'
        });

        return true;
    }

    _getLastStateEntry () {
        if (this.history.length === 0) return null;

        for (let i = this.currentIndex; i >= 0; i--) {
            const entry = this.history[i];
            if (entry && entry.type === 'state') {
                return entry;
            }
        }

        return null;
    }

    // ==============================================
    // History Service Functionality (consolidated from HistoryService.js)
    // ==============================================

    /**
     * Save state with text, cursor position, and format
     * @param text
     * @param cursorPosition
     * @param format
     */
    saveStateWithDetails (text, cursorPosition, format) {
        // Only save if state is meaningfully different
        if (this._isStateDifferent(text, cursorPosition, format)) {
            if (this.history.length >= this.maxHistory) {
                this.history.shift();
            }

            this.history.push({ text, cursorPosition, format });
            this.currentIndex = this.history.length - 1;
        }
    }

    /**
     * Check if state is different from current
     * @param text
     * @param cursorPosition
     * @param format
     */
    _isStateDifferent (text, cursorPosition, format) {
        if (this.history.length === 0) {
            return true;
        }

        const lastState = this.history[this.history.length - 1];
        return lastState.text !== text ||
               lastState.cursorPosition !== cursorPosition ||
               lastState.format !== format;
    }

    /**
     * Get undo stack
     */
    getUndoStack () {
        return this.history.slice(0, this.currentIndex + 1);
    }

    /**
     * Get redo stack
     */
    getRedoStack () {
        return this.history.slice(this.currentIndex + 1);
    }

    /**
     * Clear all history
     */
    clearHistory () {
        this.history = [];
        this.currentIndex = -1;
    }

    /**
     * Get history statistics
     */
    getHistoryStats () {
        return {
            totalStates: this.history.length,
            currentIndex: this.currentIndex,
            canUndo: this.currentIndex > 0,
            canRedo: this.currentIndex < this.history.length - 1,
            maxHistory: this.maxHistory,
            totalPageStates: this.pageHistory.length,
            currentPageIndex: this.currentPageIndex,
            canPageUndo: this.currentPageIndex > 0,
            canPageRedo: this.currentPageIndex < this.pageHistory.length - 1,
            maxPageHistory: this.maxPageHistory
        };
    }

    // ==============================================
    // Page History Management
    // ==============================================

    /**
     * Set the page manager for page history tracking
     * @param {object} pageManager - The page manager instance
     */
    setPageManager (pageManager) {
        this.pageManager = pageManager;
    }

    /**
     * Save a page state to history
     * @param {object} pageState - The page state to save
     * @param {boolean} force - Whether to force save even if state is similar
     */
    savePageState (pageState, force = false) {
        if (!pageState || typeof pageState !== 'object') {
            console.warn('[EditorHistory] Invalid page state provided');
            return false;
        }

        // Check if page state is meaningfully different
        if (!force && this._isPageStateSimilar(pageState)) {
            return false;
        }

        // Remove any future page states if we're not at the end
        if (this.currentPageIndex < this.pageHistory.length - 1) {
            this.pageHistory = this.pageHistory.slice(0, this.currentPageIndex + 1);
        }

        // Create page state snapshot with metadata
        const pageStateSnapshot = {
            ...pageState,
            timestamp: Date.now(),
            id: this._generatePageStateId()
        };

        // Add new page state
        this.pageHistory.push(pageStateSnapshot);
        this.currentPageIndex++;

        // Trim page history if it exceeds max size
        if (this.pageHistory.length > this.maxPageHistory) {
            this.pageHistory.shift();
            this.currentPageIndex--;
        }

        debugLog('[EditorHistory] Page state saved:', {
            id: pageStateSnapshot.id,
            pageIndex: pageState.pageIndex,
            pageHistorySize: this.pageHistory.length,
            currentPageIndex: this.currentPageIndex
        });

        return true;
    }

    /**
     * Undo page navigation
     */
    undoPage () {
        if (!this.canPageUndo()) return false;

        this.currentPageIndex--;
        const pageState = this.pageHistory[this.currentPageIndex];

        if (pageState && this.pageManager) {
            this.pageManager.navigateToPage(pageState.pageIndex);
            this.emit(EDITOR_EVENTS.PAGE_UNDO);
            return true;
        }
        return false;
    }

    /**
     * Redo page navigation
     */
    redoPage () {
        if (!this.canPageRedo()) return false;

        this.currentPageIndex++;
        const pageState = this.pageHistory[this.currentPageIndex];

        if (pageState && this.pageManager) {
            this.pageManager.navigateToPage(pageState.pageIndex);
            this.emit(EDITOR_EVENTS.PAGE_REDO);
            return true;
        }
        return false;
    }

    /**
     * Check if page undo is possible
     */
    canPageUndo () {
        return this.currentPageIndex > 0;
    }

    /**
     * Check if page redo is possible
     */
    canPageRedo () {
        return this.currentPageIndex < this.pageHistory.length - 1;
    }

    /**
     * Get current page state
     */
    getCurrentPageState () {
        return this.pageHistory[this.currentPageIndex] || null;
    }

    /**
     * Clear page history
     */
    clearPageHistory () {
        this.pageHistory = [];
        this.currentPageIndex = -1;
    }

    /**
     * Check if page state is similar to the last saved state
     * @param {object} pageState - The page state to check
     * @returns {boolean} - True if similar
     */
    _isPageStateSimilar (pageState) {
        if (this.pageHistory.length === 0) return false;

        const lastState = this.pageHistory[this.currentPageIndex];
        if (!lastState) return false;

        // Compare key page properties
        return lastState.pageIndex === pageState.pageIndex &&
               lastState.pageId === pageState.pageId &&
               lastState.lineCount === pageState.lineCount;
    }

    /**
     * Generate a unique page state ID
     * @returns {string} - Unique page state ID
     */
    _generatePageStateId () {
        return `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get page history for debugging
     * @returns {Array} - Array of page states
     */
    getPageHistory () {
        return [...this.pageHistory];
    }

    /**
     * Get page undo stack
     * @returns {Array} - Array of page states that can be undone
     */
    getPageUndoStack () {
        return this.pageHistory.slice(0, this.currentPageIndex + 1);
    }

    /**
     * Get page redo stack
     * @returns {Array} - Array of page states that can be redone
     */
    getPageRedoStack () {
        return this.pageHistory.slice(this.currentPageIndex + 1);
    }

    // ==============================================
    // Performance Optimization Methods
    // ==============================================

    /**
     * Cache page state for performance
     * @param key
     * @param pageState
     * @param ttl
     */
    cachePageState (key, pageState, ttl = null) {
        const expiry = ttl || this._cacheExpiry;
        this._pageStateCache.set(key, {
            data: pageState,
            timestamp: Date.now(),
            expiry: expiry
        });

        this._cleanupPageCacheIfNeeded();
    }

    /**
     * Get cached page state
     * @param key
     */
    getCachedPageState (key) {
        const cached = this._pageStateCache.get(key);
        if (!cached) {
            return null;
        }

        const now = Date.now();
        if (now - cached.timestamp > cached.expiry) {
            this._pageStateCache.delete(key);
            return null;
        }

        return cached.data;
    }

    /**
     * Clean up expired page cache entries
     */
    _cleanupPageCacheIfNeeded () {
        const now = Date.now();
        if (now - this._lastCacheCleanup < 60000) { // Cleanup every minute
            return;
        }

        this._lastCacheCleanup = now;
        const expiredKeys = [];

        this._pageStateCache.forEach((value, key) => {
            if (now - value.timestamp > value.expiry) {
                expiredKeys.push(key);
            }
        });

        expiredKeys.forEach(key => this._pageStateCache.delete(key));

        if (expiredKeys.length > 0) {
        }
    }

    /**
     * Batch page operations for better performance
     * @param operation
     */
    batchPageOperation (operation) {
        this._batchPageOperations.push(operation);

        if (!this._isBatching) {
            this._isBatching = true;
            requestAnimationFrame(() => {
                this._processBatchPageOperations();
            });
        }
    }

    /**
     * Process batched page operations
     */
    _processBatchPageOperations () {
        if (this._batchPageOperations.length === 0) {
            this._isBatching = false;
            return;
        }

        // Process all batched operations
        this._batchPageOperations.forEach(operation => {
            try {
                operation();
            } catch (error) {
                console.error('[EditorHistory] Error in batched page operation:', error);
            }
        });

        // Clear the batch
        this._batchPageOperations = [];
        this._isBatching = false;
    }

    /**
     * Optimized page state saving with caching
     * @param pageState
     * @param force
     */
    async savePageStateOptimized (pageState, force = false) {
        const cacheKey = `page_${pageState.pageIndex}_${pageState.pageId}`;
        const cached = this.getCachedPageState(cacheKey);

        if (cached && !force) {
            return cached;
        }

        const result = this.savePageState(pageState, force);

        if (result) {
            this.cachePageState(cacheKey, pageState);
        }

        return result;
    }

    /**
     * Get performance statistics
     */
    getPerformanceStats () {
        return {
            pageStateCacheSize: this._pageStateCache.size,
            batchQueueSize: this._batchPageOperations.length,
            isBatching: this._isBatching,
            totalPageStates: this.pageHistory.length,
            currentPageIndex: this.currentPageIndex,
            lastCacheCleanup: this._lastCacheCleanup
        };
    }

    /**
     * Clear all caches
     */
    clearCaches () {
        this._pageStateCache.clear();
        this._batchPageOperations = [];
        this._isBatching = false;
    }
}
