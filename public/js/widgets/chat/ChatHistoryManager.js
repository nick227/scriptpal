/**
 * ChatHistoryManager - Manages script-specific chat history
 * Handles chat history storage, retrieval, and synchronization
 */

import { MESSAGE_TYPES } from '../../constants.js';
import { StateManager } from '../../core/StateManager.js';

/**
 * ChatHistoryManager class for managing script-specific chat history
 */
export class ChatHistoryManager {
    /**
     * Constructor
     * @param {object} options - Configuration options
     * @param {object} options.api - API service for persistence
     * @param {object} options.stateManager - State manager for current script tracking
     * @param {object} options.eventManager - Event manager for notifications
     */
    constructor (options) {
        if (!options.api) throw new Error('API service is required');
        if (!options.stateManager) throw new Error('State manager is required');
        if (!options.eventManager) throw new Error('Event manager is required');

        this.api = options.api;
        this.stateManager = options.stateManager;
        this.eventManager = options.eventManager;

        // Chat history storage
        this.chatHistories = new Map(); // historyKey -> { userId, scriptId, history }
        this.currentScriptId = null;
        this.maxHistorySize = 1000; // Maximum messages per script
        this.maxScripts = 50; // Maximum scripts to keep in memory

        // Performance optimizations
        this._historyCache = new Map();
        this._cacheExpiry = 60000; // 1 minute
        this._lastCacheCleanup = 0;
        this._batchSaves = [];
        this._isBatching = false;

        // Event handlers
        this.eventHandlers = new Map();

        this.currentUserId = this.stateManager.getState(StateManager.KEYS.USER)?.id || null;

        // Initialize
        this.initialize();
    }

    /**
     * Initialize the chat history manager
     */
    async initialize () {

        // Subscribe to script changes
        this.stateManager.subscribe(StateManager.KEYS.CURRENT_SCRIPT, this.handleScriptChange.bind(this));

        // Subscribe to user changes
        this.stateManager.subscribe(StateManager.KEYS.USER, this.handleUserChange.bind(this));

        // Load current script history if available
        const currentScript = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
        if (currentScript) {
            await this.loadScriptHistory(currentScript.id);
        }

    }

    /**
     * Generate history map key
     * @param {string} scriptId
     * @returns {string|null}
     */
    _createHistoryKey (scriptId) {
        if (!this.currentUserId || !scriptId) {
            return null;
        }
        return `${this.currentUserId}:${scriptId}`;
    }

    /**
     * Get cached entry by script
     * @param {string} scriptId
     */
    _getHistoryEntry (scriptId) {
        const key = this._createHistoryKey(scriptId);
        if (!key) {
            return null;
        }
        return this.chatHistories.get(key);
    }

    /**
     * Store entry for a specific script
     * @param {string} scriptId
     * @param {Array} history
     */
    _setHistoryEntry (scriptId, history) {
        const key = this._createHistoryKey(scriptId);
        if (!key) {
            return;
        }
        this.chatHistories.set(key, {
            userId: this.currentUserId,
            scriptId,
            history
        });
    }

    /**
     * Delete entry for a specific script
     * @param {string} scriptId
     */
    _deleteHistoryEntry (scriptId) {
        const key = this._createHistoryKey(scriptId);
        if (!key) {
            return;
        }
        this.chatHistories.delete(key);
    }

    /**
     * Validate that both userId and scriptId context exist
     * @param {string} scriptId
     * @param {string} context
     */
    _hasHistoryScope (scriptId, context) {
        if (!this.currentUserId) {
            console.warn(`[ChatHistoryManager] ${context} skipped: missing userId`);
            return false;
        }
        if (!scriptId) {
            console.warn(`[ChatHistoryManager] ${context} skipped: missing scriptId`);
            return false;
        }
        return true;
    }

    /**
     * Clear stored histories and caches
     */
    resetHistoryStorage () {
        this.chatHistories.clear();
        this.clearCaches();
    }

    /**
     * Handle script changes
     * @param {object} script - The new current script
     */
    async handleScriptChange (script) {
        if (!script || !script.id) {
            console.debug('[ChatHistoryManager] Script not selected yet');
            return;
        }

        const previousScriptId = this.currentScriptId;
        this.currentScriptId = script.id;

        // Load history for new script
        if (this._hasHistoryScope(script.id, 'handleScriptChange')) {
            await this.loadScriptHistory(script.id);
        }

        // Emit script change event
        this.emit('scriptChanged', {
            previousScriptId,
            currentScriptId: script.id,
            script
        });
    }

    /**
     * Handle user/state changes
     * @param {object|null} user
     */
    async handleUserChange (user) {
        const newUserId = user && user.id ? user.id : null;
        if (this.currentUserId === newUserId) {
            return;
        }

        const previousUserId = this.currentUserId;
        this.currentUserId = newUserId;
        this.resetHistoryStorage();

        this.emit('userChanged', {
            previousUserId,
            currentUserId: newUserId
        });

        const currentScript = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
        if (newUserId && currentScript && currentScript.id) {
            await this.loadScriptHistory(currentScript.id);
        }
    }

    /**
     * Load chat history for a specific script
     * @param {string} scriptId - The script ID
     * @returns {Promise<Array>} - The chat history for the script
     */
    async loadScriptHistory (scriptId) {
        if (!scriptId) {
            console.warn('[ChatHistoryManager] No script ID provided');
            return [];
        }

        try {
            if (!this._hasHistoryScope(scriptId, 'loadScriptHistory')) {
                return [];
            }

            // Check if history is already loaded
            const cachedEntry = this._getHistoryEntry(scriptId);
            if (cachedEntry) {
                return cachedEntry.history;
            }

            // Load from API
            const history = await this.api.getChatMessages(scriptId);
            const processedHistory = this.processHistoryData(history);

            // Store in memory
            this._setHistoryEntry(scriptId, processedHistory);

            // Clean up old histories if needed
            this.cleanupOldHistories();

            return processedHistory;
        } catch (error) {
            console.error('[ChatHistoryManager] Failed to load chat history:', error);
            this.handleError(error, 'loadScriptHistory');
            return [];
        }
    }

    /**
     * Save chat history for a specific script
     * @param {string} scriptId - The script ID
     * @param {Array} history - The chat history to save
     * @returns {Promise<boolean>} - True if saved successfully
     */
    async saveScriptHistory (scriptId, history) {
        if (!scriptId || !Array.isArray(history)) {
            console.warn('[ChatHistoryManager] Invalid parameters for saveScriptHistory');
            return false;
        }

        try {

            if (!this._hasHistoryScope(scriptId, 'saveScriptHistory')) {
                return false;
            }

            // Update local storage
            this._setHistoryEntry(scriptId, history);
            return true;
        } catch (error) {
            console.error('[ChatHistoryManager] Failed to save chat history:', error);
            this.handleError(error, 'saveScriptHistory');
            return false;
        }
    }

    /**
     * Add a message to the current script's chat history
     * @param {object} message - The message to add
     * @param {string} message.content - The message content
     * @param {string} message.type - The message type (user, assistant, error)
     * @param {object} message.metadata - Additional metadata
     * @returns {Promise<boolean>} - True if added successfully
     */
    async addMessage (message) {
        if (!this._hasHistoryScope(this.currentScriptId, 'addMessage')) {
            return false;
        }

        if (!message || !message.content) {
            console.warn('[ChatHistoryManager] Invalid message provided');
            return false;
        }

        try {
            const messageData = {
                id: this.generateMessageId(),
                content: message.content,
                type: message.type || MESSAGE_TYPES.USER,
                timestamp: Date.now(),
                scriptId: this.currentScriptId,
                metadata: message.metadata || {}
            };

            // Get current history
            const entry = this._getHistoryEntry(this.currentScriptId);
            let history = entry ? [...entry.history] : [];

            // Add message
            history.push(messageData);

            // Trim history if too long
            if (history.length > this.maxHistorySize) {
                history = history.slice(-this.maxHistorySize);
            }

            // Update local storage
            this._setHistoryEntry(this.currentScriptId, history);

            // Save to API is handled by the chat pipeline server-side

            // Emit message added event
            this.eventManager.publish('CHAT:MESSAGE_ADDED', {
                scriptId: this.currentScriptId,
                message: messageData
            });

            return true;
        } catch (error) {
            console.error('[ChatHistoryManager] Failed to add message:', error);
            this.handleError(error, 'addMessage');
            return false;
        }
    }

    /**
     * Get chat history for a specific script
     * @param {string} scriptId - The script ID
     * @returns {Array} - The chat history
     */
    getScriptHistory (scriptId) {
        if (!scriptId) {
            return [];
        }

        if (!this._hasHistoryScope(scriptId, 'getScriptHistory')) {
            return [];
        }

        return this._getHistoryEntry(scriptId)?.history || [];
    }

    /**
     * Get current script's chat history
     * @returns {Array} - The current script's chat history
     */
    getCurrentScriptHistory () {
        return this.getScriptHistory(this.currentScriptId);
    }

    /**
     * Clear chat history for a specific script
     * @param {string} scriptId - The script ID
     * @returns {Promise<boolean>} - True if cleared successfully
     */
    async clearScriptHistory (scriptId) {
        if (!scriptId) {
            console.warn('[ChatHistoryManager] No script ID provided for clearing history');
            return false;
        }

        try {
            // Clear from API
            await this.api.clearChatMessages(scriptId);

            // Clear from local storage
            this._deleteHistoryEntry(scriptId);

            // Emit history cleared event
            this.emit('historyCleared', { scriptId });

            return true;
        } catch (error) {
            console.error('[ChatHistoryManager] Failed to clear chat history:', error);
            this.handleError(error, 'clearScriptHistory');
            return false;
        }
    }

    /**
     * Process raw history data from API
     * @param {Array} rawHistory - Raw history data from API
     * @returns {Array} - Processed history data
     */
    processHistoryData (rawHistory) {
        if (!Array.isArray(rawHistory)) {
            return [];
        }

        return rawHistory.map(message => {
            const processed = {
                id: message.id || this.generateMessageId(),
                content: message.content || '',
                type: message.type || MESSAGE_TYPES.USER
            };

            if (message.timestamp) {
                processed.timestamp = message.timestamp;
            }

            if (message.scriptId) {
                processed.scriptId = message.scriptId;
            }

            if (message.metadata) {
                processed.metadata = message.metadata;
            }

            return processed;
        });
    }

    /**
     * Generate a unique message ID
     * @returns {string} - Unique message ID
     */
    generateMessageId () {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Clean up old chat histories to prevent memory issues
     */
    cleanupOldHistories () {
        if (this.chatHistories.size <= this.maxScripts) {
            return;
        }


        // Keep current script and most recent scripts across users
        const entries = Array.from(this.chatHistories.entries());
        const sortedEntries = entries.sort((a, b) => {
            const entryA = a[1];
            const entryB = b[1];

            if (entryA.scriptId === this.currentScriptId && entryB.scriptId !== this.currentScriptId) {
                return -1;
            }
            if (entryB.scriptId === this.currentScriptId && entryA.scriptId !== this.currentScriptId) {
                return 1;
            }

            const aLastMessage = entryA.history[entryA.history.length - 1];
            const bLastMessage = entryB.history[entryB.history.length - 1];
            const aTimestamp = aLastMessage ? aLastMessage.timestamp : 0;
            const bTimestamp = bLastMessage ? bLastMessage.timestamp : 0;

            return bTimestamp - aTimestamp;
        });

        // Keep only the most recent scripts
        const keepEntries = sortedEntries.slice(0, this.maxScripts);
        this.chatHistories.clear();

        keepEntries.forEach(([key, entry]) => {
            this.chatHistories.set(key, entry);
        });

    }

    /**
     * Get statistics about chat histories
     * @returns {object} - Statistics object
     */
    getStatistics () {
        const stats = {
            totalScripts: this.chatHistories.size,
            currentScriptId: this.currentScriptId,
            totalMessages: 0,
            scripts: []
        };

        this.chatHistories.forEach((entry, key) => {
            const history = entry.history || [];
            const scriptStats = {
                scriptId: entry.scriptId,
                userId: entry.userId,
                messageCount: history.length,
                lastMessage: history[history.length - 1] || null,
                firstMessage: history[0] || null
            };

            stats.scripts.push(scriptStats);
            stats.totalMessages += history.length;
        });

        return stats;
    }

    /**
     * Event handling methods
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
     * @param handler
     */
    off (event, handler) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).delete(handler);
        }
    }

    /**
     *
     * @param event
     * @param data
     */
    emit (event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('[ChatHistoryManager] Error in event handler:', error);
                }
            });
        }
    }

    /**
     * Error handling
     * @param {Error} error - The error object
     * @param {string} context - The context where the error occurred
     */
    handleError (error, context) {
        const errorDetails = {
            context,
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        };

        console.error(`[ChatHistoryManager] Error in ${context}:`, errorDetails);

        // Emit error event
        this.emit('error', errorDetails);
    }

    /**
     * Destroy the chat history manager
     */
    destroy () {

        this.resetHistoryStorage();

        // Clear event handlers
        this.eventHandlers.clear();

        // Reset state
        this.currentScriptId = null;
        this.currentUserId = null;

    }

    // ==============================================
    // Performance Optimization Methods
    // ==============================================

    /**
     * Batch save operations for better performance
     * @param scriptId
     * @param history
     */
    batchSave (scriptId, history) {
        this._batchSaves.push({ scriptId, history });

        if (!this._isBatching) {
            this._isBatching = true;
            requestAnimationFrame(() => {
                this._processBatchSaves();
            });
        }
    }

    /**
     * Process batched save operations
     */
    _processBatchSaves () {
        if (this._batchSaves.length === 0) {
            this._isBatching = false;
            return;
        }

        // Group saves by scriptId
        const groupedSaves = new Map();
        this._batchSaves.forEach(({ scriptId, history }) => {
            if (!groupedSaves.has(scriptId)) {
                groupedSaves.set(scriptId, []);
            }
            groupedSaves.get(scriptId).push(history);
        });

        // Process each script's saves
        groupedSaves.forEach(async (histories, scriptId) => {
            try {
                // Use the most recent history for each script
                const latestHistory = histories[histories.length - 1];
                await this.saveScriptHistory(scriptId, latestHistory);
            } catch (error) {
                console.error('[ChatHistoryManager] Error in batched save:', error);
            }
        });

        // Clear the batch
        this._batchSaves = [];
        this._isBatching = false;
    }

    /**
     * Optimized history loading with caching
     * @param scriptId
     */
    async loadScriptHistoryOptimized (scriptId) {
        const cacheKey = `history_${scriptId}`;
        const cached = this._getCachedHistory(cacheKey);

        if (cached) {
            return cached;
        }

        const history = await this.loadScriptHistory(scriptId);

        if (history) {
            this._cacheHistory(cacheKey, history);
        }

        return history;
    }

    /**
     * Cache history data
     * @param key
     * @param history
     */
    _cacheHistory (key, history) {
        this._historyCache.set(key, {
            data: history,
            timestamp: Date.now()
        });

        this._cleanupHistoryCacheIfNeeded();
    }

    /**
     * Get cached history data
     * @param key
     */
    _getCachedHistory (key) {
        const cached = this._historyCache.get(key);
        if (!cached) {
            return null;
        }

        const now = Date.now();
        if (now - cached.timestamp > this._cacheExpiry) {
            this._historyCache.delete(key);
            return null;
        }

        return cached.data;
    }

    /**
     * Clean up expired history cache entries
     */
    _cleanupHistoryCacheIfNeeded () {
        const now = Date.now();
        if (now - this._lastCacheCleanup < 120000) { // Cleanup every 2 minutes
            return;
        }

        this._lastCacheCleanup = now;
        const expiredKeys = [];

        this._historyCache.forEach((value, key) => {
            if (now - value.timestamp > this._cacheExpiry) {
                expiredKeys.push(key);
            }
        });

        expiredKeys.forEach(key => this._historyCache.delete(key));

        if (expiredKeys.length > 0) {
        }
    }

    /**
     * Get performance statistics
     */
    getPerformanceStats () {
        return {
            historyCacheSize: this._historyCache.size,
            batchQueueSize: this._batchSaves.length,
            isBatching: this._isBatching,
            totalScripts: this.chatHistories.size,
            currentScriptId: this.currentScriptId,
            lastCacheCleanup: this._lastCacheCleanup
        };
    }

    /**
     * Clear all caches
     */
    clearCaches () {
        this._historyCache.clear();
        this._batchSaves = [];
        this._isBatching = false;
    }

    /**
     * Handle external message addition
     * @param {object} message - Message to add
     */
    handleExternalMessage (message) {
        if (!message || !message.scriptId) return;

        if (!this._hasHistoryScope(message.scriptId, 'handleExternalMessage')) {
            return;
        }

        if (message.userId && message.userId !== this.currentUserId) {
            return;
        }

        if (!message.userId) {
            console.warn('[ChatHistoryManager] External message missing userId; assuming current user');
        }

        // Add to the appropriate script's history
        const entry = this._getHistoryEntry(message.scriptId);
        const history = entry ? [...entry.history, message] : [message];
        this._setHistoryEntry(message.scriptId, history);

        // Update current script if it matches
        if (this.currentScriptId === message.scriptId) {
            this.eventManager.publish('CHAT:MESSAGE_ADDED', {
                scriptId: message.scriptId,
                message
            });
        }
    }
}
