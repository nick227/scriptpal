/**
 *
 */
export class EventManager {
    /**
     *
     */
    constructor () {
        this.listeners = new Map();
        this.subscriptions = new Map();
    }

    // Subscribe to an event with optional context for cleanup
    /**
     *
     * @param event
     * @param callback
     * @param context
     */
    subscribe (event, callback, context = null) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        if (context) {
            if (!this.subscriptions.has(context)) {
                this.subscriptions.set(context, new Set());
            }
            this.subscriptions.get(context).add({ event, callback });
        }

        return () => this.unsubscribe(event, callback);
    }

    // Alias for subscribe to support both naming conventions
    /**
     *
     * @param event
     * @param callback
     * @param context
     */
    on (event, callback, context = null) {
        return this.subscribe(event, callback, context);
    }

    // Subscribe once and automatically unsubscribe after first event
    /**
     *
     * @param event
     * @param callback
     */
    once (event, callback) {
        const onceCallback = (data) => {
            callback(data);
            this.unsubscribe(event, onceCallback);
        };
        return this.subscribe(event, onceCallback);
    }

    /**
     *
     * @param event
     * @param callback
     */
    unsubscribe (event, callback) {
        const listeners = this.listeners.get(event);
        if (listeners) {
            listeners.delete(callback);
            if (listeners.size === 0) {
                this.listeners.delete(event);
            }
        }
    }

    // Alias for unsubscribe to support both naming conventions
    /**
     *
     * @param event
     * @param callback
     */
    off (event, callback) {
        this.unsubscribe(event, callback);
    }

    /**
     *
     * @param context
     */
    unsubscribeAll (context) {
        const subscriptions = this.subscriptions.get(context);
        if (subscriptions) {
            subscriptions.forEach(({ event, callback }) => {
                this.unsubscribe(event, callback);
            });
            this.subscriptions.delete(context);
        }
    }

    // Clear all listeners for an event or all events
    /**
     *
     * @param event
     */
    clear (event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
            this.subscriptions.clear();
        }
    }

    // Publish an event with data
    /**
     *
     * @param event
     * @param data
     */
    publish (event, data) {
        const listeners = this.listeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    // Alias for publish to support both naming conventions
    /**
     *
     * @param event
     * @param data
     */
    emit (event, data) {
        this.publish(event, data);
    }

    // Cleanup resources
    /**
     *
     */
    destroy () {
        this.clear();
        this.listeners = null;
        this.subscriptions = null;
    }

    // Common event types
    static EVENTS = {
        AUTH: {
            LOGIN: 'AUTH:LOGIN',
            LOGOUT: 'AUTH:LOGOUT',
            REGISTER: 'AUTH:REGISTER',
            PROFILE_UPDATED: 'AUTH:PROFILE_UPDATED'
        },
        CHAT: {
            REQUEST_SEND: 'CHAT:REQUEST_SEND',
            REQUEST_CLEAR: 'CHAT:REQUEST_CLEAR',
            REQUEST_EXPORT: 'CHAT:REQUEST_EXPORT',
            REQUEST_HISTORY: 'CHAT:REQUEST_HISTORY',
            REQUEST_SETTINGS: 'CHAT:REQUEST_SETTINGS',
            REQUEST_MINIMIZE: 'CHAT:REQUEST_MINIMIZE',
            REQUEST_CLOSE: 'CHAT:REQUEST_CLOSE',
            INPUT_ENHANCEMENT_REQUESTED: 'CHAT:INPUT_ENHANCEMENT_REQUESTED',
            MESSAGE_SENT: 'CHAT:MESSAGE_SENT',
            MESSAGE_RECEIVED: 'CHAT:MESSAGE_RECEIVED',
            MESSAGE_ADDED: 'CHAT:MESSAGE_ADDED',
            MESSAGE_STATUS_UPDATED: 'CHAT:MESSAGE_STATUS_UPDATED',
            BUTTON_CLICKED: 'CHAT:BUTTON_CLICKED',
            CONTAINER_MINIMIZED: 'CHAT:CONTAINER_MINIMIZED',
            CONTAINER_CLOSED: 'CHAT:CONTAINER_CLOSED',
            TYPING_START: 'CHAT:TYPING_START',
            TYPING_STOP: 'CHAT:TYPING_STOP',
            TYPING_INDICATOR_SHOW: 'CHAT:TYPING_INDICATOR_SHOW',
            TYPING_INDICATOR_HIDE: 'CHAT:TYPING_INDICATOR_HIDE',
            REACTION_ADDED: 'CHAT:REACTION_ADDED',
            FILE_UPLOADED: 'CHAT:FILE_UPLOADED',
            VOICE_RECORDING_STARTED: 'CHAT:VOICE_RECORDING_STARTED',
            VOICE_RECORDING_STOPPED: 'CHAT:VOICE_RECORDING_STOPPED',
            CLEARED: 'CHAT:CLEARED',
            EXPORTED: 'CHAT:EXPORTED'
        },
        AI: {
            RESPONSE_RECEIVED: 'AI:RESPONSE_RECEIVED',
            LINE_INSERTION_COMPLETED: 'AI:LINE_INSERTION_COMPLETED',
            LINE_INSERTION_ERROR: 'AI:LINE_INSERTION_ERROR',
            SCRIPT_BLOCKED_EMPTY: 'AI:SCRIPT_BLOCKED_EMPTY'
        },
        SYSTEM_PROMPT: {
            READY: 'SYSTEM_PROMPT:READY',
            FIRED: 'SYSTEM_PROMPT:FIRED',
            FAILED: 'SYSTEM_PROMPT:FAILED'
        },
        PERSISTENCE: {
            SCRIPT_STATE_SAVED: 'PERSISTENCE:SCRIPT_STATE_SAVED',
            CHAT_STATE_SAVED: 'PERSISTENCE:CHAT_STATE_SAVED',
            UI_STATE_SAVED: 'PERSISTENCE:UI_STATE_SAVED',
            STATE_LOADED: 'PERSISTENCE:STATE_LOADED',
            SCRIPT_STATE_RESTORED: 'PERSISTENCE:SCRIPT_STATE_RESTORED',
            CHAT_STATE_RESTORED: 'PERSISTENCE:CHAT_STATE_RESTORED',
            UI_STATE_RESTORED: 'PERSISTENCE:UI_STATE_RESTORED',
            DATA_CLEARED: 'PERSISTENCE:DATA_CLEARED'
        },
        SCRIPT: {
            SELECTED: 'SCRIPT:SELECTED',
            UPDATED: 'SCRIPT:UPDATED',
            CREATED: 'SCRIPT:CREATED',
            DELETED: 'SCRIPT:DELETED',
            LIST_UPDATED: 'SCRIPT:LIST_UPDATED',
            EDIT: 'SCRIPT:EDIT',
            CONTENT_CHANGED: 'SCRIPT:CONTENT_CHANGED',
            CONTENT_UPDATED: 'SCRIPT:CONTENT_UPDATED',
            SELECTION_CHANGED: 'SCRIPT:SELECTION_CHANGED',
            FORMAT_CHANGED: 'SCRIPT:FORMAT_CHANGED',
            STATE_CHANGED: 'SCRIPT:STATE_CHANGED',
            SYNC_COMPLETE: 'SCRIPT:SYNC_COMPLETE',
            SYNC_ERROR: 'SCRIPT:SYNC_ERROR',
            APPENDED: 'SCRIPT:APPENDED',
            PREPENDED: 'SCRIPT:PREPENDED',
            INSERTED: 'SCRIPT:INSERTED',
            ERROR: 'SCRIPT:ERROR',
            CONTEXT_UPDATED: 'SCRIPT:CONTEXT_UPDATED',
            ANALYSIS_COMPLETE: 'SCRIPT:ANALYSIS_COMPLETE',
            SAVE_DIRTY: 'SCRIPT:SAVE_DIRTY',
            SAVE_SAVING: 'SCRIPT:SAVE_SAVING',
            SAVE_SAVED: 'SCRIPT:SAVE_SAVED',
            SAVE_ERROR: 'SCRIPT:SAVE_ERROR',
            FORMAT_INVALID: 'SCRIPT:FORMAT_INVALID'
        },
        EDITOR: {
            READY: 'EDITOR:READY',
            ERROR: 'EDITOR:ERROR',
            CHANGE: 'EDITOR:CHANGE',
            CONTENT_CHANGE: 'EDITOR:CONTENT_CHANGE',
            FORMAT_CHANGE: 'EDITOR:FORMAT_CHANGE',
            CURSOR_MOVE: 'EDITOR:CURSOR_MOVE',
            PAGE_CHANGE: 'EDITOR:PAGE_CHANGE',
            STATE_CHANGE: 'EDITOR:STATE_CHANGE',
            LINE_CHANGE: 'EDITOR:LINE_CHANGE',
            LINE_ADDED: 'EDITOR:LINE_ADDED',
            UNDO: 'EDITOR:UNDO',
            REDO: 'EDITOR:REDO',
            AUTOCOMPLETE: 'EDITOR:AUTOCOMPLETE',
            EDITOR_AREA_READY: 'EDITOR:EDITOR_AREA_READY'
        },
        VIEW: {
            CHANGED: 'VIEW:CHANGED'
        },
        UI: {
            FULLSCREEN_CHANGED: 'UI:FULLSCREEN_CHANGED',
            FULLSCREEN_TOGGLE: 'UI.FULLSCREEN_TOGGLE',
            FULLSCREEN_ENTERED: 'UI.FULLSCREEN_ENTERED',
            FULLSCREEN_EXITED: 'UI.FULLSCREEN_EXITED'
        },
        TITLE_PAGE: {
            UPDATED: 'TITLE_PAGE:UPDATED',
            CREATED: 'TITLE_PAGE:CREATED',
            DELETED: 'TITLE_PAGE:DELETED',
            EDIT_STARTED: 'TITLE_PAGE.EDIT_STARTED',
            SAVED: 'TITLE_PAGE.SAVED'
        },
        ERROR: 'ERROR'
    };
}
