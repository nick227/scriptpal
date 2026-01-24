/**
 * PersistenceManager - Manages application state persistence across page loads
 * Handles script state, chat state, UI state, and user preferences
 */

import { EventManager } from '../core/EventManager.js';
import { StateManager } from '../core/StateManager.js';
import { debugLog } from '../core/logger.js';

export function saveRawToStorage (key, value) {
    localStorage.setItem(key, value);
}

export function saveJsonToStorage (key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

export function loadRawFromStorage (key) {
    return localStorage.getItem(key);
}

export function loadJsonFromStorage (key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('[PersistenceManager] Failed to parse storage data:', error);
        return null;
    }
}

export function removeFromStorage (key) {
    localStorage.removeItem(key);
}

/**
 * PersistenceManager class for managing application persistence
 */
export class PersistenceManager {
    /**
     * Constructor
     * @param {object} options - Configuration options
     * @param {object} options.stateManager - State manager for current state tracking
     * @param {object} options.eventManager - Event manager for notifications
     * @param {object} options.api - API service for server-side persistence
     */
    constructor (options) {
        if (!options.stateManager) {
            throw new Error('StateManager is required for PersistenceManager');
        }
        if (!options.eventManager) {
            throw new Error('EventManager is required for PersistenceManager');
        }
        if (!options.api) {
            throw new Error('API is required for PersistenceManager');
        }

        this.stateManager = options.stateManager;
        this.eventManager = options.eventManager;
        this.api = options.api;

        // Persistence configuration
        this.storageKeys = {
            CURRENT_SCRIPT_ID: 'currentScriptId',
            CURRENT_SCRIPT_STATE: 'currentScriptState',
            SCRIPT_CURSOR_POSITION: 'scriptCursorPosition',
            SCRIPT_SCROLL_POSITION: 'scriptScrollPosition',
            CHAT_STATE: 'chatState',
            UI_STATE: 'uiState',
            USER_PREFERENCES: 'userPreferences',
            SESSION_DATA: 'sessionData'
        };

        // Persistence state
        this.isInitialized = false;
        this.autoSaveInterval = null;
        this.autoSaveDelay = 30000; // 30 seconds

        // Event handlers
        this.eventHandlers = new Map();
        this.requestedScriptId = null;

        // Persistence cache helpers
        this.lastPersistedScriptSnapshot = null;

        // Initialize
        this.ready = this.initialize();
    }

    /**
     * Initialize the persistence manager
     */
    async initialize () {
        debugLog('[PersistenceManager] Initializing...');

        // Set up event listeners
        this.setupEventListeners();

        // Load persisted state
        await this.loadPersistedState();

        // Start auto-save
        this.startAutoSave();

        this.isInitialized = true;
        debugLog('[PersistenceManager] Initialized successfully');
    }

    /**
     * Set up event listeners
     */
    setupEventListeners () {
        // Listen for script changes
        this.stateManager.subscribe(StateManager.KEYS.CURRENT_SCRIPT, this.handleScriptChange.bind(this));
        this.eventManager.subscribe(EventManager.EVENTS.SCRIPT.DELETED, this.handleScriptDeleted.bind(this));

        // Listen for chat changes
        this.eventManager.subscribe(EventManager.EVENTS.CHAT.MESSAGE_ADDED, this.handleChatChange.bind(this));

        // Listen for UI state changes
        this.eventManager.subscribe(EventManager.EVENTS.UI.FULLSCREEN_CHANGED, this.handleUIStateChange.bind(this));
        this.eventManager.subscribe(EventManager.EVENTS.CHAT.CONTAINER_MINIMIZED, this.handleUIStateChange.bind(this));

        // Listen for beforeunload to save state
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));

        // Listen for page visibility changes
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }

    /**
     * Handle script changes
     * @param {object} script - The current script
     */
    async handleScriptChange (script) {
        if (!script) {
            this.clearCurrentScriptState();
            return;
        }

        const snapshot = {
            scriptId: script.id ? Number(script.id) : null,
            cursorPosition: this.getCursorPosition(),
            scrollPosition: this.getScrollPosition(),
            title: script.title || '',
            author: script.author || '',
            visibility: script.visibility || 'private'
        };

        if (!snapshot.scriptId) {
            return;
        }

        debugLog('[PersistenceManager] Script changed, saving context for script:', snapshot.scriptId);
        console.log('[PersistenceManager] snapshot', snapshot);

        if (this.isSnapshotEqual(this.lastPersistedScriptSnapshot, snapshot)) {
            return;
        }

        this.lastPersistedScriptSnapshot = snapshot;
        this.requestedScriptId = snapshot.scriptId;

        this.saveToStorage(this.storageKeys.CURRENT_SCRIPT_ID, snapshot.scriptId);
        this.saveToStorage(this.storageKeys.CURRENT_SCRIPT_STATE, {
            scriptId: snapshot.scriptId,
            cursorPosition: snapshot.cursorPosition,
            scrollPosition: snapshot.scrollPosition,
            title: snapshot.title,
            author: snapshot.author,
            visibility: snapshot.visibility
        });

        saveJsonToStorage(this.storageKeys.SCRIPT_CURSOR_POSITION, snapshot.cursorPosition);
        saveJsonToStorage(this.storageKeys.SCRIPT_SCROLL_POSITION, snapshot.scrollPosition);

        this.eventManager.publish(EventManager.EVENTS.PERSISTENCE.SCRIPT_STATE_SAVED, {
            scriptId: snapshot.scriptId,
            context: snapshot
        });
    }

    /**
     * Handle script deletion
     * @param {object} event
     */
    handleScriptDeleted (event) {
        if (!event || !event.scriptId) {
            return;
        }

        const currentScriptId = this.loadFromStorage(this.storageKeys.CURRENT_SCRIPT_ID);
        if (currentScriptId && String(currentScriptId) === String(event.scriptId)) {
            this.clearCurrentScriptState();
        }
    }

    /**
     * Clear current script persistence
     */
    clearCurrentScriptState () {
        removeFromStorage(this.storageKeys.CURRENT_SCRIPT_ID);
        removeFromStorage(this.storageKeys.CURRENT_SCRIPT_STATE);
        removeFromStorage(this.storageKeys.SCRIPT_CURSOR_POSITION);
        removeFromStorage(this.storageKeys.SCRIPT_SCROLL_POSITION);
        removeFromStorage('currentScriptVersion');
        removeFromStorage('currentScriptTitle');
        this.lastPersistedScriptSnapshot = null;
        this.requestedScriptId = null;
    }

    /**
     * Handle chat changes
     * @param {object} event - Chat change event
     */
    async handleChatChange (event) {
        if (!event.scriptId) {
            return;
        }

        debugLog('[PersistenceManager] Chat changed, saving state for script:', event.scriptId);

        // Save chat state
        const chatState = {
            scriptId: event.scriptId,
            lastMessage: event.message,
            timestamp: new Date().toISOString(),
            messageCount: this.getChatMessageCount(event.scriptId)
        };

        this.saveToStorage(this.storageKeys.CHAT_STATE, chatState);

        // Emit chat state saved event
        this.eventManager.publish(EventManager.EVENTS.PERSISTENCE.CHAT_STATE_SAVED, {
            scriptId: event.scriptId,
            chatState
        });
    }

    /**
     * Handle UI state changes
     * @param {object} event - UI state change event
     */
    async handleUIStateChange (event) {
        debugLog('[PersistenceManager] UI state changed, saving state');

        // Save UI state
        const uiState = {
            fullscreenMode: this.getFullscreenState(),
            chatMinimized: this.getChatMinimizedState(),
            chatPosition: this.getChatPosition(),
            chatSize: this.getChatSize(),
            lastUpdated: new Date().toISOString()
        };

        this.saveToStorage(this.storageKeys.UI_STATE, uiState);

        // Emit UI state saved event if eventManager is available
        if (this.eventManager) {
            this.eventManager.publish(EventManager.EVENTS.PERSISTENCE.UI_STATE_SAVED, {
                uiState
            });
        }
    }

    /**
     * Handle before unload
     * @param {Event} event - Before unload event
     */
    async handleBeforeUnload (event) {
        debugLog('[PersistenceManager] Page unloading, saving final state');

        // Save current state
        await this.saveCurrentState();

        // Save session data
        await this.saveSessionData();
    }

    /**
     * Handle visibility change
     * @param {Event} event - Visibility change event
     */
    async handleVisibilityChange (event) {
        if (document.hidden) {
            debugLog('[PersistenceManager] Page hidden, saving state');
            await this.saveCurrentState();
        } else {
            debugLog('[PersistenceManager] Page visible, loading state');
            await this.loadPersistedState();
        }
    }

    /**
     * Load persisted state from storage
     */
    async loadPersistedState () {
        try {
            debugLog('[PersistenceManager] Loading persisted state...');

            const completeState = loadJsonFromStorage('scriptpal_complete_state');
            if (completeState) {
                const { scriptState, chatState, uiState } = completeState;

                if (scriptState) {
                    await this.restoreScriptState(scriptState);
                }

                if (chatState) {
                    await this.restoreChatState(chatState);
                }

                if (uiState) {
                    await this.restoreUIState(uiState);
                }

                this.eventManager.publish(EventManager.EVENTS.PERSISTENCE.STATE_LOADED, {
                    currentScriptId: scriptState ? scriptState.scriptId : undefined,
                    cursorPosition: scriptState ? scriptState.cursorPosition : undefined,
                    scrollPosition: scriptState ? scriptState.scrollPosition : undefined,
                    chatState,
                    uiState,
                    userPreferences: null
                });

                return completeState;
            }

            const currentScriptId = this.loadFromStorage(this.storageKeys.CURRENT_SCRIPT_ID);
            if (currentScriptId) {
                debugLog('[PersistenceManager] Found persisted script ID:', currentScriptId);
            }

            const scriptSnapshot = this.loadFromStorage(this.storageKeys.CURRENT_SCRIPT_STATE);
            if (scriptSnapshot) {
                debugLog('[PersistenceManager] Found persisted script context:', scriptSnapshot);
            }

            const cursorPosition = this.loadFromStorage(this.storageKeys.SCRIPT_CURSOR_POSITION);
            if (cursorPosition) {
                debugLog('[PersistenceManager] Found persisted cursor position');
            }

            const scrollPosition = this.loadFromStorage(this.storageKeys.SCRIPT_SCROLL_POSITION);
            if (scrollPosition) {
                debugLog('[PersistenceManager] Found persisted scroll position');
            }

            const chatState = this.loadFromStorage(this.storageKeys.CHAT_STATE);
            if (chatState) {
                debugLog('[PersistenceManager] Found persisted chat state for script:', chatState.scriptId);
            }

            const uiState = this.loadFromStorage(this.storageKeys.UI_STATE);
            if (uiState) {
                debugLog('[PersistenceManager] Found persisted UI state');
            }

            const userPreferences = this.loadFromStorage(this.storageKeys.USER_PREFERENCES);
            if (userPreferences) {
                debugLog('[PersistenceManager] Found persisted user preferences');
            }

            const hasData = [
                currentScriptId,
                scriptSnapshot,
                cursorPosition,
                scrollPosition,
                chatState,
                uiState,
                userPreferences
            ].some(value => value !== null && value !== undefined);

            if (!hasData) {
                return null;
            }

            const restoredContext = {
                scriptId: currentScriptId ? Number(currentScriptId) : scriptSnapshot?.scriptId,
                cursorPosition: cursorPosition || scriptSnapshot?.cursorPosition,
                scrollPosition: scrollPosition || scriptSnapshot?.scrollPosition
            };

            await this.restoreScriptState(restoredContext);

            if (chatState) {
                await this.restoreChatState(chatState);
            }

            if (uiState) {
                await this.restoreUIState(uiState);
            }

            this.eventManager.publish(EventManager.EVENTS.PERSISTENCE.STATE_LOADED, {
                currentScriptId: restoredContext.scriptId,
                cursorPosition: restoredContext.cursorPosition,
                scrollPosition: restoredContext.scrollPosition,
                chatState,
                uiState,
                userPreferences
            });

            return {
                currentScriptId: restoredContext.scriptId,
                cursorPosition: restoredContext.cursorPosition,
                scrollPosition: restoredContext.scrollPosition,
                chatState,
                uiState,
                userPreferences
            };

        } catch (error) {
            console.error('[PersistenceManager] Failed to load persisted state:', error);
            return null;
        }
    }

    /**
     * Save current state to storage
     */
    async saveCurrentState () {
        try {
            // Check if stateManager is still available
            if (!this.stateManager) {
                console.warn('[PersistenceManager] StateManager not available, skipping state save');
                return;
            }

            const currentScript = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
            if (currentScript) {
                await this.handleScriptChange(currentScript);
            }

            await this.handleUIStateChange({});

            debugLog('[PersistenceManager] Current state saved');

        } catch (error) {
            console.error('[PersistenceManager] Failed to save current state:', error);
        }
    }

    /**
     * Save session data
     */
    async saveSessionData () {
        try {
            const sessionData = {
                lastActive: new Date().toISOString(),
                sessionDuration: this.getSessionDuration(),
                actionsPerformed: this.getActionsPerformed(),
                errorsEncountered: this.getErrorsEncountered()
            };

            this.saveToStorage(this.storageKeys.SESSION_DATA, sessionData);

        } catch (error) {
            console.error('[PersistenceManager] Failed to save session data:', error);
        }
    }

    /**
     * Start auto-save functionality
     */
    startAutoSave () {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        this.autoSaveInterval = setInterval(async () => {
            await this.saveCurrentState();
        }, this.autoSaveDelay);

        debugLog('[PersistenceManager] Auto-save started');
    }

    /**
     * Stop auto-save functionality
     */
    stopAutoSave () {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }

        debugLog('[PersistenceManager] Auto-save stopped');
    }

    /**
     * Save data to storage
     * @param {string} key - Storage key
     * @param {any} data - Data to save
     */
    saveToStorage (key, data) {
        try {
            saveJsonToStorage(key, data);
        } catch (error) {
            console.error('[PersistenceManager] Failed to save to storage:', error);
        }
    }

    /**
     * Load data from storage
     * @param {string} key - Storage key
     * @returns {any} - Loaded data
     */
    loadFromStorage (key) {
        try {
            return loadJsonFromStorage(key);
        } catch (error) {
            console.error('[PersistenceManager] Failed to load from storage:', error);
            return null;
        }
    }

    /**
     * Clear all persisted data
     */
    clearAllData () {
        try {
            Object.values(this.storageKeys).forEach(key => {
                removeFromStorage(key);
            });

            debugLog('[PersistenceManager] All persisted data cleared');

            // Emit data cleared event
            this.eventManager.publish(EventManager.EVENTS.PERSISTENCE.DATA_CLEARED, {});

        } catch (error) {
            console.error('[PersistenceManager] Failed to clear data:', error);
        }
    }

    /**
     * Get cursor position
     * @returns {object} - Cursor position
     */
    getCursorPosition () {
        // This would be implemented to get the current cursor position
        // For now, return a placeholder
        return { line: 0, column: 0 };
    }

    /**
     * Get scroll position
     * @returns {object} - Scroll position
     */
    getScrollPosition () {
        // This would be implemented to get the current scroll position
        // For now, return a placeholder
        return { x: 0, y: 0 };
    }

    /**
     * Get chat message count
     * @param {string} scriptId - Script ID
     * @returns {number} - Message count
     */
    getChatMessageCount (scriptId) {
        // This would be implemented to get the chat message count
        // For now, return a placeholder
        return 0;
    }

    /**
     * Get fullscreen state
     * @returns {boolean} - Fullscreen state
     */
    getFullscreenState () {
        // This would be implemented to get the fullscreen state
        // For now, return a placeholder
        return false;
    }

    /**
     * Get chat minimized state
     * @returns {boolean} - Chat minimized state
     */
    getChatMinimizedState () {
        // This would be implemented to get the chat minimized state
        // For now, return a placeholder
        return false;
    }

    /**
     * Get chat position
     * @returns {object} - Chat position
     */
    getChatPosition () {
        // This would be implemented to get the chat position
        // For now, return a placeholder
        return { x: 0, y: 0 };
    }

    /**
     * Get chat size
     * @returns {object} - Chat size
     */
    getChatSize () {
        // This would be implemented to get the chat size
        // For now, return a placeholder
        return { width: 300, height: 400 };
    }

    /**
     * Get session duration
     * @returns {number} - Session duration in milliseconds
     */
    getSessionDuration () {
        // This would be implemented to get the session duration
        // For now, return a placeholder
        return 0;
    }

    /**
     * Get actions performed
     * @returns {number} - Number of actions performed
     */
    getActionsPerformed () {
        // This would be implemented to get the actions performed count
        // For now, return a placeholder
        return 0;
    }

    /**
     * Get errors encountered
     * @returns {number} - Number of errors encountered
     */
    getErrorsEncountered () {
        // This would be implemented to get the errors encountered count
        // For now, return a placeholder
        return 0;
    }

    /**
     * Restore script state
     * @param {object} scriptState - Script state to restore
     */
    async restoreScriptState (scriptState) {
        if (!scriptState) {
            return;
        }

        try {
            debugLog('[PersistenceManager] Restoring script context for script:', scriptState.scriptId);
            console.log('[PersistenceManager] restoring scriptState', scriptState);

            const scriptId = scriptState.scriptId || scriptState.id;
            if (this.stateManager && scriptId) {
                this.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT_ID, Number(scriptId));
            }

            if (scriptId) {
                this.requestedScriptId = Number(scriptId);
            }

            if (scriptState.cursorPosition) {
                this.setCursorPosition(scriptState.cursorPosition);
            }

            if (scriptState.scrollPosition) {
                this.setScrollPosition(scriptState.scrollPosition);
            }

            this.eventManager.publish(EventManager.EVENTS.PERSISTENCE.SCRIPT_STATE_RESTORED, {
                scriptState
            });

        } catch (error) {
            console.error('[PersistenceManager] Failed to restore script state:', error);
        }
    }

    /**
     * Restore chat state
     * @param {object} chatState - Chat state to restore
     */
    async restoreChatState (chatState) {
        if (!chatState) {
            return;
        }

        try {
            debugLog('[PersistenceManager] Restoring chat state for script:', chatState.scriptId);

            if (this.stateManager && Array.isArray(chatState.messages)) {
                this.stateManager.setState(StateManager.KEYS.CHAT_HISTORY, chatState.messages);
            }

            // Emit chat state restored event
            this.eventManager.publish(EventManager.EVENTS.PERSISTENCE.CHAT_STATE_RESTORED, {
                chatState
            });

        } catch (error) {
            console.error('[PersistenceManager] Failed to restore chat state:', error);
        }
    }

    /**
     * Restore UI state
     * @param {object} uiState - UI state to restore
     */
    async restoreUIState (uiState) {
        if (!uiState) {
            return;
        }

        try {
            debugLog('[PersistenceManager] Restoring UI state');

            if (this.stateManager) {
                this.stateManager.setState(StateManager.KEYS.UI_STATE, uiState);
        }

            // Emit UI state restored event
            this.eventManager.publish(EventManager.EVENTS.PERSISTENCE.UI_STATE_RESTORED, {
                uiState
            });

        } catch (error) {
            console.error('[PersistenceManager] Failed to restore UI state:', error);
        }
    }

    /**
     * Check if the script context snapshots match
     * @param {object|null} a
     * @param {object|null} b
     */
    isSnapshotEqual (a, b) {
        if (!a || !b) {
            return false;
        }

        return a.scriptId === b.scriptId &&
            JSON.stringify(a.cursorPosition) === JSON.stringify(b.cursorPosition) &&
            JSON.stringify(a.scrollPosition) === JSON.stringify(b.scrollPosition) &&
            a.title === b.title &&
            a.author === b.author &&
            a.visibility === b.visibility;
    }

    /**
     * Set cursor position
     * @param {object} position - Cursor position
     */
    setCursorPosition (position) {
        // This would be implemented to set the cursor position
        debugLog('[PersistenceManager] Setting cursor position:', position);
    }

    /**
     * Set scroll position
     * @param {object} position - Scroll position
     */
    setScrollPosition (position) {
        // This would be implemented to set the scroll position
        debugLog('[PersistenceManager] Setting scroll position:', position);
    }

    /**
     * Get storage usage
     * @returns {object} - Storage usage information
     */
    getStorageUsage () {
        try {
            let totalSize = 0;
            const usage = {};

            Object.entries(this.storageKeys).forEach(([key, storageKey]) => {
                const data = loadRawFromStorage(storageKey);
                if (data) {
                    const { size } = new Blob([data]);
                    usage[key] = size;
                    totalSize += size;
                }
            });

            return {
                totalSize,
                usage,
                totalSizeKB: Math.round(totalSize / 1024 * 100) / 100
            };

        } catch (error) {
            console.error('[PersistenceManager] Failed to get storage usage:', error);
            return { totalSize: 0, usage: {}, totalSizeKB: 0 };
        }
    }

    /**
     * Destroy the persistence manager
     */
    // ==============================================
    // Missing Methods for Test Compatibility
    // ==============================================

    /**
     * Save script state to localStorage
     * @param {object} scriptState - Script state to save
     */
    async saveScriptState (scriptState) {
        if (!scriptState) return;

        this.saveToStorage('scriptpal_script_state', scriptState);
        this.eventManager.publish('PERSISTENCE:SCRIPT_STATE_SAVED', { scriptState });
    }

    /**
     * Save chat state to localStorage
     * @param {object} chatState - Chat state to save
     */
    async saveChatState (chatState) {
        if (!chatState) return;

        this.saveToStorage('scriptpal_chat_state', chatState);
        this.eventManager.publish('PERSISTENCE:CHAT_STATE_SAVED', { chatState });
    }

    /**
     * Save UI state to localStorage
     * @param {object} uiState - UI state to save
     */
    async saveUIState (uiState) {
        if (!uiState) return;

        this.saveToStorage('scriptpal_ui_state', uiState);
        this.eventManager.publish('PERSISTENCE:UI_STATE_SAVED', { uiState });
    }

    /**
     * Save complete application state
     * @param {object} completeState - Complete state to save
     */
    async saveCompleteState (completeState) {
        if (!completeState) return;

        this.saveToStorage('scriptpal_complete_state', completeState);
        this.eventManager.publish('PERSISTENCE:COMPLETE_STATE_SAVED', { completeState });
    }

    /**
     * Auto-save script state
     * @param {object} scriptState - Script state to auto-save
     */
    async autoSaveScriptState (scriptState) {
        await this.saveScriptState(scriptState);
    }

    /**
     * Auto-save chat state
     * @param {object} chatState - Chat state to auto-save
     */
    async autoSaveChatState (chatState) {
        await this.saveChatState(chatState);
    }

    /**
     * Auto-save UI state
     * @param {object} uiState - UI state to auto-save
     */
    async autoSaveUIState (uiState) {
        await this.saveUIState(uiState);
    }

    /**
     * Clear all persisted data
     */
    async clearPersistedData () {
        this.clearAllData();
        this.eventManager.publish('PERSISTENCE:DATA_CLEARED');
    }

    /**
     * Migrate persisted data for version updates
     * @param {object} oldData - Old format data
     */
    async migratePersistedData (oldData) {
        // Simple migration - just return the data as-is for now
        return oldData;
    }

    /**
     * Get data size information
     */
    getDataSize () {
        const usage = this.getStorageUsage();
        return {
            totalSize: usage.totalSize,
            scriptStateSize: usage.scriptStateSize,
            chatStateSize: usage.chatStateSize,
            uiStateSize: usage.uiStateSize
        };
    }

    /**
     * Restore persisted state (alias for loadPersistedState)
     */
    async restorePersistedState () {
        return await this.loadPersistedState();
    }

    /**
     *
     */
    destroy () {
        try {
            // Stop auto-save
            this.stopAutoSave();

            // Save final state only if managers are still available
            if (this.stateManager && this.eventManager) {
                this.saveCurrentState();
            }

            // Clear event handlers
            if (this.eventHandlers) {
                this.eventHandlers.clear();
            }

            // Clear references
            this.stateManager = null;
            this.eventManager = null;
            this.api = null;
            this.eventHandlers = null;

            debugLog('[PersistenceManager] Destroyed');
        } catch (error) {
            console.error('[PersistenceManager] Error during destroy:', error);
        }
    }
}
