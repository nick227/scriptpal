import { EDITOR_EVENTS } from '../constants.js';

/**
 * EditorStateManager - Manages the state of the editor
 * Consolidated to remove duplicate methods and improve maintainability
 */
export class EditorStateManager {
    /**
     * Initialize state
     */
    constructor () {
        this.state = {
            ready: false,
            error: null,
            content: '',
            currentLine: null,
            currentFormat: 'text',
            currentPage: 1,
            pageCount: 1,
            isDirty: false,
            canUndo: false,
            canRedo: false,
            selection: null,
            autocomplete: {
                speaker: {
                    suggestions: [],
                    currentSuggestion: null
                }
            }
        };
        this.eventHandlers = new Map();
    }

    /**
     * Initialize the manager
     */
    async initialize () {
        return true;
    }

    /**
     * Subscribe to events
     * @param {string} event
     * @param {Function} handler
     */
    on (event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event).add(handler);
    }

    /**
     * Unsubscribe an event handler
     * @param {string} event
     * @param {Function} handler
     */
    off (event, handler) {
        if (!this.eventHandlers.has(event)) {
            return;
        }
        this.eventHandlers.get(event).delete(handler);
    }

    /**
     * Subscribe to specific state key changes (alias for on)
     * @param {string} key
     * @param {Function} handler
     */
    subscribe (key, handler) {
        this.on(key, handler);
    }

    /**
     * Emit events
     * @param {string} event
     * @param {any} data
     */
    emit (event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => handler(data));
        }
    }

    // ==========================================
    // Getters
    // ==========================================

    /**
     *
     */
    isReady () {
        return this.state.ready;
    }

    /**
     *
     */
    getError () {
        return this.state.error;
    }

    /**
     *
     */
    getContent () {
        return this.state.content;
    }

    /**
     *
     */
    getCurrentLine () {
        return this.state.currentLine;
    }

    /**
     *
     */
    getCurrentFormat () {
        return this.state.currentFormat;
    }

    /**
     *
     */
    getCurrentPage () {
        return this.state.currentPage;
    }

    /**
     *
     */
    getPageCount () {
        return this.state.pageCount;
    }

    /**
     *
     */
    isDirty () {
        return this.state.isDirty;
    }

    /**
     * Get a specific state value
     * @param {string} key
     */
    getState (key) {
        return this.state[key];
    }

    /**
     * Get autocomplete state for a format
     * @param {string} format
     */
    getAutocompleteState (format) {
        const autocomplete = this.state.autocomplete || {};
        return autocomplete[format] || { suggestions: [], currentSuggestion: null };
    }

    /**
     * Get autocomplete suggestions for a format
     * @param {string} format
     */
    getAutocompleteSuggestions (format) {
        const state = this.getAutocompleteState(format);
        return state.suggestions || [];
    }

    /**
     * Get the current autocomplete suggestion for a format
     * @param {string} format
     */
    getAutocompleteCurrentSuggestion (format) {
        return this.getAutocompleteState(format).currentSuggestion;
    }

    /**
     * Get full state object clone
     */
    getCurrentState () {
        return { ...this.state };
    }

    // ==========================================
    // Setters
    // ==========================================

    /**
     * Generic state setter
     * @param {string} key
     * @param {any} value
     */
    setState (key, value) {
        this.state[key] = value;
        this.emit(EDITOR_EVENTS.STATE_CHANGE, { [key]: value });
    }

    /**
     * Ensure autocomplete state entry exists for a format
     * @param {string} format
     * @private
     */
    _ensureAutocompleteFormat (format) {
        if (!this.state.autocomplete) {
            this.state.autocomplete = {};
        }
        if (!this.state.autocomplete[format]) {
            this.state.autocomplete[format] = {
                suggestions: [],
                currentSuggestion: null
            };
        }
        return this.state.autocomplete[format];
    }

    /**
     * Set autocomplete suggestions for a format
     * @param {string} format
     * @param {string[]} suggestions
     */
    setAutocompleteSuggestions (format, suggestions = []) {
        if (!format) {
            return;
        }
        const normalized = Array.isArray(suggestions) ? suggestions : [];
        const formatState = this._ensureAutocompleteFormat(format);
        formatState.suggestions = normalized;
        this.emit(EDITOR_EVENTS.AUTOCOMPLETE_SUGGESTIONS, {
            format,
            suggestions: normalized
        });
    }

    /**
     * Store the active autocomplete suggestion
     * @param {string} format
     * @param {string|null} suggestion
     */
    setAutocompleteCurrentSuggestion (format, suggestion) {
        if (!format) {
            return;
        }
        const formatState = this._ensureAutocompleteFormat(format);
        if (formatState.currentSuggestion === suggestion) {
            return;
        }
        formatState.currentSuggestion = suggestion;
        this.emit(EDITOR_EVENTS.AUTOCOMPLETE_CURRENT, {
            format,
            currentSuggestion: suggestion
        });
    }

    /**
     *
     * @param ready
     */
    setReady (ready) {
        this.state.ready = ready;
        this.emit(EDITOR_EVENTS.STATE_CHANGE, { ready });
    }

    /**
     *
     * @param error
     */
    setError (error) {
        this.state.error = error;
        this.emit(EDITOR_EVENTS.STATE_CHANGE, { error });
    }

    /**
     *
     * @param content
     */
    setContent (content) {
        this.state.content = content;
        this.emit(EDITOR_EVENTS.CONTENT_CHANGE, content);
    }

    /**
     *
     * @param line
     */
    setCurrentLine (line) {
        this.state.currentLine = line;
        this.emit(EDITOR_EVENTS.STATE_CHANGE, { currentLine: line });
    }

    /**
     * Set current format
     * Emits both FORMAT_CHANGE and STATE_CHANGE
     * @param {string} format
     */
    setCurrentFormat (format) {
        this.state.currentFormat = format;
        this.emit(EDITOR_EVENTS.FORMAT_CHANGE, format);
        this.emit(EDITOR_EVENTS.STATE_CHANGE, { currentFormat: format });
    }

    /**
     *
     * @param page
     */
    setCurrentPage (page) {
        this.state.currentPage = page;
        this.emit(EDITOR_EVENTS.PAGE_CHANGE, page);
    }

    /**
     *
     * @param count
     */
    setPageCount (count) {
        this.state.pageCount = count;
        this.emit(EDITOR_EVENTS.STATE_CHANGE, { pageCount: count });
    }

    /**
     *
     * @param selection
     */
    setSelection (selection) {
        this.state.selection = selection;
        this.emit(EDITOR_EVENTS.STATE_CHANGE, { selection });
    }

    /**
     *
     * @param isDirty
     */
    markDirty (isDirty) {
        this.state.isDirty = isDirty;
        this.emit(EDITOR_EVENTS.STATE_CHANGE, { isDirty });
    }

    /**
     *
     * @param canUndo
     * @param canRedo
     */
    setHistoryState (canUndo, canRedo) {
        this.state.canUndo = canUndo;
        this.state.canRedo = canRedo;
        this.emit(EDITOR_EVENTS.STATE_CHANGE, { canUndo, canRedo });
    }

    /**
     * Apply multiple state updates
     * @param {object} newState
     */
    applyState (newState) {
        Object.assign(this.state, newState);
        this.emit(EDITOR_EVENTS.STATE_CHANGE, newState);
    }

    /**
     * Reset state to initial values
     */
    reset () {
        this.state = {
            ready: false,
            error: null,
            content: '',
            currentLine: null,
            currentFormat: 'text',
            currentPage: 1,
            pageCount: 1,
            isDirty: false,
            canUndo: false,
            canRedo: false,
            selection: null,
            autocomplete: {
                speaker: {
                    suggestions: [],
                    currentSuggestion: null
                }
            }
        };
        this.emit(EDITOR_EVENTS.STATE_CHANGE, this.state);
    }

    /**
     * Destroy manager and clear handlers
     */
    destroy () {
        this.reset();
        this.eventHandlers.clear();
    }
}
