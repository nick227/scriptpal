/**
 * ChatHistoryManager - Manages script-specific chat history by querying the API for every load
 */

import { StateManager } from '../../../core/StateManager.js';
import { EventManager } from '../../../core/EventManager.js';

/**
 * ChatHistoryManager class for managing script-specific chat history
 */
export class ChatHistoryManager {
    /**
     * @param {object} options - Configuration options
     * @param {object} options.api - API service for persistence
     * @param {object} options.stateManager - State manager for current script tracking
     * @param {object} options.eventManager - Event manager for notifications
     */
    constructor(options) {
        if (!options.api) throw new Error('API service is required');
        if (!options.stateManager) throw new Error('State manager is required');
        if (!options.eventManager) throw new Error('Event manager is required');

        this.api = options.api;
        this.stateManager = options.stateManager;
        this.eventManager = options.eventManager;

        this.currentScriptId = null;
        this.currentUserId = this.stateManager.getState(StateManager.KEYS.USER)?.id || null;
        this.lastHistory = [];

        this._scriptListener = this.handleScriptChange.bind(this);
        this._userListener = this.handleUserChange.bind(this);

        this.initialize();
    }

    /**
     * Initialize subscriptions and hydrate history
     */
    async initialize() {
        this.stateManager.subscribe(StateManager.KEYS.CURRENT_SCRIPT, this._scriptListener);
        this.stateManager.subscribe(StateManager.KEYS.USER, this._userListener);

        const currentScript = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
        if (currentScript?.id) {
            await this.loadScriptHistory(currentScript.id);
        }
    }

    /**
     * Ensure user+script context exists
     * @private
     */
    _hasHistoryScope(scriptId, context) {
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
     * Clear local history snapshot
     */
    resetHistoryStorage() {
        this.lastHistory = [];
    }

    appendHistory(messages = []) {
        if (!Array.isArray(messages) || messages.length === 0) {
            return;
        }

        this.lastHistory = [...this.lastHistory, ...messages];
        this.emitHistoryUpdated(this.currentScriptId, messages);
    }

    emitHistoryUpdated(scriptId, messages) {
        if (!scriptId || !this.eventManager) {
            return;
        }

        this.eventManager.publish(EventManager.EVENTS.CHAT.HISTORY_UPDATED, {
            scriptId,
            messages
        });
    }

    /**
     * Emit history update events so listeners know the latest batch
     */
    /**
     * React to script changes by reloading history every time
     */
    async handleScriptChange(script) {
        if (!script || !script.id) {
            console.debug('[ChatHistoryManager] Script not selected yet');
            return;
        }

        this.currentScriptId = script.id;

        if (this._hasHistoryScope(script.id, 'handleScriptChange')) {
            await this.loadScriptHistory(script.id);
        }
    }

    /**
     * React to user changes and refresh history
     */
    async handleUserChange(user) {
        const newUserId = user?.id || null;
        if (this.currentUserId === newUserId) {
            return;
        }

        this.currentUserId = newUserId;
        this.resetHistoryStorage();

        const currentScript = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
        if (currentScript?.id && this._hasHistoryScope(currentScript.id, 'handleUserChange')) {
            await this.loadScriptHistory(currentScript.id);
        }
    }

    /**
     * Load chat history for a specific script (always calls GET /chat/messages)
     */
    async loadScriptHistory(scriptId) {
        if (!scriptId) {
            console.warn('[ChatHistoryManager] No script ID provided');
            return [];
        }

        if (!this._hasHistoryScope(scriptId, 'loadScriptHistory')) {
            return [];
        }

        this.currentScriptId = scriptId;

        try {
            const rawHistory = await this.api.getChatMessages(scriptId);
            const processedHistory = this.processHistoryData(rawHistory);
            this.lastHistory = processedHistory;
            this.emitHistoryUpdated(scriptId, processedHistory);
            return processedHistory;
        } catch (error) {
            console.error('[ChatHistoryManager] Failed to load chat history:', error);
            this.handleError(error, 'loadScriptHistory');
            return [];
        }
    }

    /**
     * Get history for a specific script
     */
    getScriptHistory(scriptId) {
        if (!scriptId || !this._hasHistoryScope(scriptId, 'getScriptHistory')) {
            return [];
        }

        if (String(scriptId) !== String(this.currentScriptId)) {
            return [];
        }

        return this.lastHistory;
    }

    /**
     * Get current script history
     */
    getCurrentScriptHistory() {
        return this.getScriptHistory(this.currentScriptId);
    }

    /**
     * Clear history for a specific script via the API
     */
    async clearScriptHistory(scriptId) {
        if (!scriptId) {
            console.warn('[ChatHistoryManager] No script ID provided for clearing history');
            return false;
        }

        if (!this._hasHistoryScope(scriptId, 'clearScriptHistory')) {
            return false;
        }

        try {
            await this.api.clearChatMessages(scriptId);
            if (String(this.currentScriptId) === String(scriptId)) {
                this.lastHistory = [];
                this.emitHistoryUpdated(scriptId, []);
            }
            return true;
        } catch (error) {
            console.error('[ChatHistoryManager] Failed to clear chat history:', error);
            this.handleError(error, 'clearScriptHistory');
            return false;
        }
    }

    /**
     * Normalize API responses
     */
    processHistoryData(rawHistory) {
        if (!Array.isArray(rawHistory)) {
            return [];
        }

        return rawHistory;
    }

    /**
     * Handle errors
     */
    handleError(error, context) {
        const errorDetails = {
            context,
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        };

        console.error(`[ChatHistoryManager] Error in ${context}:`, errorDetails);
    }

    /**
     * Destroy the history manager and remove listeners
     */
    destroy() {
        try {
            this.stateManager.unsubscribe(StateManager.KEYS.CURRENT_SCRIPT, this._scriptListener);
            this.stateManager.unsubscribe(StateManager.KEYS.USER, this._userListener);
        } catch (error) {
            console.warn('[ChatHistoryManager] Error while unsubscribing listeners', error);
        }

        this.resetHistoryStorage();
        this.currentScriptId = null;
        this.currentUserId = null;
    }
}
