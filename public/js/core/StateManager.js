/**
 * State key definitions as a frozen enum
 * Prevents typos and ensures consistency across the application
 */
export const STATE_KEYS = Object.freeze({
    // Authentication state
    AUTHENTICATED: 'authenticated',
    USER: 'user',

    // Loading states
    LOADING: 'loading',
    EDITOR_LOADING: 'editorLoading',
    CHAT_LOADING: 'chatLoading',
    AUTH_LOADING: 'authLoading',

    // Application state
    CURRENT_VIEW: 'currentView',
    READY: 'ready',
    ERROR: 'error',

    // Script state
    CURRENT_SCRIPT: 'currentScript',
    CURRENT_SCRIPT_ID: 'currentScriptId',
    CURRENT_SCRIPT_ERROR: 'currentScriptError',
    SCRIPTS: 'scripts',
    SCENES: 'scenes',
    CURRENT_SCENE_ID: 'currentSceneId',
    CHARACTERS: 'characters',
    CURRENT_CHARACTER_ID: 'currentCharacterId',
    LOCATIONS: 'locations',
    CURRENT_LOCATION_ID: 'currentLocationId',
    THEMES: 'themes',
    CURRENT_THEME_ID: 'currentThemeId',
    MEDIA: 'media',
    CURRENT_MEDIA_ID: 'currentMediaId',

    // Chat state
    CHAT_HISTORY: 'chatHistory',
    TOKEN_USAGE: 'tokenUsage',

    // UI state
    UI_STATE: 'uiState',

    // Editor state
    CONTENT: 'content',
    CURRENT_LINE: 'currentLine',
    CURRENT_FORMAT: 'currentFormat',
    PAGE_COUNT: 'pageCount',
    CURRENT_PAGE: 'currentPage',
    HISTORY_STATE: 'historyState',
    EDITOR_READY: 'editorReady',
    IS_FROM_EDIT: 'isFromEdit',
    CAN_UNDO: 'canUndo',
    CAN_REDO: 'canRedo',
    IS_DIRTY: 'isDirty',

    // Version preview (editorMode: 'edit' | 'version-preview')
    EDITOR_MODE: 'editorMode',
    EDITOR_PREVIEW_VERSION: 'editorPreviewVersion'
});

/**
 * State value schemas for validation
 */
export const STATE_SCHEMAS = Object.freeze({
    [STATE_KEYS.AUTHENTICATED]: { type: 'boolean', default: false },
    [STATE_KEYS.USER]: { type: 'object', default: null, nullable: true },
    [STATE_KEYS.LOADING]: { type: 'boolean', default: false },
    [STATE_KEYS.EDITOR_LOADING]: { type: 'boolean', default: false },
    [STATE_KEYS.CHAT_LOADING]: { type: 'boolean', default: false },
    [STATE_KEYS.AUTH_LOADING]: { type: 'boolean', default: false },
    [STATE_KEYS.CURRENT_VIEW]: { type: 'string', default: null, nullable: true },
    [STATE_KEYS.READY]: { type: 'boolean', default: false },
    [STATE_KEYS.ERROR]: { type: 'object', default: null, nullable: true },
    [STATE_KEYS.CURRENT_SCRIPT]: { type: 'object', default: null, nullable: true },
    [STATE_KEYS.CURRENT_SCRIPT_ID]: { type: 'number', default: null, nullable: true },
    [STATE_KEYS.CURRENT_SCRIPT_ERROR]: { type: 'object', default: null, nullable: true },
    [STATE_KEYS.SCRIPTS]: { type: 'array', default: [] },
    [STATE_KEYS.SCENES]: { type: 'array', default: [] },
    [STATE_KEYS.CURRENT_SCENE_ID]: { type: 'number', default: null, nullable: true },
    [STATE_KEYS.CHARACTERS]: { type: 'array', default: [] },
    [STATE_KEYS.CURRENT_CHARACTER_ID]: { type: 'number', default: null, nullable: true },
    [STATE_KEYS.LOCATIONS]: { type: 'array', default: [] },
    [STATE_KEYS.CURRENT_LOCATION_ID]: { type: 'number', default: null, nullable: true },
    [STATE_KEYS.THEMES]: { type: 'array', default: [] },
    [STATE_KEYS.CURRENT_THEME_ID]: { type: 'number', default: null, nullable: true },
    [STATE_KEYS.MEDIA]: { type: 'array', default: [] },
    [STATE_KEYS.CURRENT_MEDIA_ID]: { type: 'number', default: null, nullable: true },
    [STATE_KEYS.CHAT_HISTORY]: { type: 'array', default: [] },
    [STATE_KEYS.TOKEN_USAGE]: { type: 'object', default: null, nullable: true },
    [STATE_KEYS.UI_STATE]: { type: 'object', default: null, nullable: true },
    [STATE_KEYS.CONTENT]: { type: 'string', default: '' },
    [STATE_KEYS.CURRENT_LINE]: { type: 'object', default: null, nullable: true },
    [STATE_KEYS.CURRENT_FORMAT]: { type: 'string', default: 'action' },
    [STATE_KEYS.PAGE_COUNT]: { type: 'number', default: 0 },
    [STATE_KEYS.CURRENT_PAGE]: { type: 'number', default: 1 },
    [STATE_KEYS.HISTORY_STATE]: { type: 'object', default: { canUndo: false, canRedo: false } },
    [STATE_KEYS.EDITOR_READY]: { type: 'boolean', default: false },
    [STATE_KEYS.IS_FROM_EDIT]: { type: 'boolean', default: false },
    [STATE_KEYS.CAN_UNDO]: { type: 'boolean', default: false },
    [STATE_KEYS.CAN_REDO]: { type: 'boolean', default: false },
    [STATE_KEYS.IS_DIRTY]: { type: 'boolean', default: false },
    [STATE_KEYS.EDITOR_MODE]: { type: 'string', default: 'edit' },
    [STATE_KEYS.EDITOR_PREVIEW_VERSION]: { type: 'number', default: null, nullable: true }
});

/**
 *
 */
export class StateManager {
    // Use the frozen enum
    static KEYS = STATE_KEYS;

    /**
     *
     */
    constructor () {
        this.state = new Map();
        this.listeners = new Map();

        // Initialize all state keys with their default values
        this.initializeDefaultState();
    }

    /**
     * Initialize state with default values from schemas
     */
    initializeDefaultState () {
        Object.entries(STATE_SCHEMAS).forEach(([key, schema]) => {
            this.state.set(key, schema.default);
            this.listeners.set(key, new Set());
        });
    }

    /**
     * Validate a value against its schema
     * @param {string} key - State key
     * @param {*} value - Value to validate
     * @returns {boolean} - True if valid
     */
    validateValue (key, value) {
        const schema = STATE_SCHEMAS[key];
        if (!schema) {
            throw new Error(`Unknown state key: ${key}`);
        }

        // Check if value is null and nullable is allowed
        if (value === null) {
            return schema.nullable === true;
        }

        // Type validation
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        return actualType === schema.type;
    }

    /**
     * Get the expected type for a state key
     * @param {string} key - State key
     * @returns {string} - Expected type
     */
    getExpectedType (key) {
        const schema = STATE_SCHEMAS[key];
        if (!schema) {
            throw new Error(`Unknown state key: ${key}`);
        }
        return schema.type;
    }


    /**
     *
     * @param key
     * @param value
     */
    setState (key, value) {
        // Validate key exists in schema
        if (!STATE_SCHEMAS.hasOwnProperty(key)) {
            throw new Error(`Invalid state key: ${key}. Valid keys are: ${Object.keys(STATE_SCHEMAS).join(', ')}`);
        }

        // Validate value against schema
        if (!this.validateValue(key, value)) {
            const expectedType = this.getExpectedType(key);
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            throw new Error(`Invalid value type for state key '${key}': expected ${expectedType}, got ${actualType}`);
        }

        const oldValue = this.state.get(key);
        if (oldValue !== value) {
            this.state.set(key, value);
            this.notifyListeners(key, value, oldValue);
        }
    }

    /**
     * True when editor should not allow mutations (version-preview, future: collaboration read-only, public view).
     * Use for keyboard handlers, applyCommands, setCurrentLineFormat, insertLineAfter, deleteLinesById, flushSave.
     */
    isEditorReadOnly () {
        return this.getState(STATE_KEYS.EDITOR_MODE) === 'version-preview';
    }

    /**
     *
     * @param key
     */
    getState (key) {
        // Validate key exists in schema
        if (!STATE_SCHEMAS.hasOwnProperty(key)) {
            throw new Error(`Invalid state key: ${key}. Valid keys are: ${Object.keys(STATE_SCHEMAS).join(', ')}`);
        }

        return this.state.get(key);
    }

    /**
     *
     * @param key
     * @param listener
     */
    subscribe (key, listener) {
        // Validate key exists in schema
        if (!STATE_SCHEMAS.hasOwnProperty(key)) {
            throw new Error(`Invalid state key: ${key}. Valid keys are: ${Object.keys(STATE_SCHEMAS).join(', ')}`);
        }

        this.listeners.get(key).add(listener);
    }

    /**
     *
     * @param key
     * @param listener
     */
    unsubscribe (key, listener) {
        if (this.listeners.has(key)) {
            this.listeners.get(key).delete(listener);
        }
    }

    /**
     *
     * @param key
     * @param newValue
     * @param oldValue
     */
    notifyListeners (key, newValue, oldValue) {
        if (this.listeners.has(key)) {
            for (const listener of this.listeners.get(key)) {
                try {
                    listener(newValue, oldValue);
                } catch (error) {
                    console.error(`Error in state listener for ${key}:`, error);
                }
            }
        }
    }

    /**
     *
     */
    reset () {
        for (const [key] of this.state) {
            this.state.set(key, null);
        }
        this.notifyListeners('reset', null, null);
    }
}
