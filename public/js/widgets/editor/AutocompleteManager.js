import { EDITOR_EVENTS } from './constants.js';

export class AutocompleteManager {
    /**
     * @param {object} options
     * @param {EditorContent} options.contentManager
     * @param {HTMLElement} options.editorArea
     * @param {EditorStateManager} options.stateManager
     */
    constructor (options = {}) {
        this.contentManager = options.contentManager || null;
        this.editorArea = options.editorArea || null;
        this.stateManager = options.stateManager || null;
        this.suggestions = [];
        this.currentSuggestion = null;
        this._handlers = {
            suggestions: this.handleSuggestionsUpdate.bind(this)
        };
    }

    /**
     * Initialize autocomplete manager
     */
    initialize () {
        if (this.stateManager) {
            this.stateManager.on(EDITOR_EVENTS.AUTOCOMPLETE_SUGGESTIONS, this._handlers.suggestions);
            const initial = this.stateManager.getAutocompleteSuggestions('speaker');
            this.suggestions = Array.isArray(initial) ? initial : [];
        }
    }

    /**
     * Update the container reference (useful if created before editorArea exists)
     * @param {HTMLElement} editorArea
     */
    setEditorArea (editorArea) {
        this.editorArea = editorArea;
    }

    /**
     *
     */
    destroy () {
        if (this.stateManager) {
            this.stateManager.off(EDITOR_EVENTS.AUTOCOMPLETE_SUGGESTIONS, this._handlers.suggestions);
        }
        this.clearSuggestion();
        this.contentManager = null;
        this.editorArea = null;
        this.stateManager = null;
    }

    /**
     * Handle state updates for suggestions
     * @param {object} payload
     * @param {string} payload.format
     * @param {string[]} payload.suggestions
     */
    handleSuggestionsUpdate (payload) {
        if (!payload || payload.format !== 'speaker') {
            return;
        }
        this.suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
        const activeLine = this._getActiveLine();
        if (activeLine) {
            this.updateSuggestionForLine(activeLine);
        }
    }

    /**
     * Determine suggestion for the provided line
     * @param {HTMLElement} lineElement
     */
    updateSuggestionForLine (lineElement) {
        if (!lineElement || !lineElement.classList.contains('script-line')) {
            this.clearSuggestion();
            return false;
        }

        const format = lineElement.getAttribute('data-format') || '';
        if (format !== 'speaker') {
            this.clearSuggestionForLine(lineElement);
            return false;
        }

        const rawText = lineElement.textContent || '';
        const trimmedText = rawText.trim();
        if (!trimmedText) {
            this.clearSuggestionForLine(lineElement);
            return false;
        }

        const suggestion = this.findSuggestion(trimmedText);
        if (!suggestion) {
            this.clearSuggestionForLine(lineElement);
            return false;
        }

        this.applySuggestion(lineElement, suggestion, trimmedText);
        return true;
    }

    /**
     * Accept the current suggestion for the given line
     * @param {HTMLElement} lineElement
     */
    acceptSuggestion (lineElement) {
        const hasSuggestion = this.hasActiveSuggestion(lineElement) &&
            Boolean(this.currentSuggestion?.fullSuggestion);
        if (!hasSuggestion) {
            return false;
        }

        const { fullSuggestion } = this.currentSuggestion;
        lineElement.textContent = fullSuggestion;

        if (this.contentManager && typeof this.contentManager.syncLineContentFromDOM === 'function') {
            this.contentManager.syncLineContentFromDOM(lineElement);
        }

        this.moveCaretToEnd(lineElement);
        this.clearSuggestion();
        this.updateSuggestionForLine(lineElement);
        return true;
    }

    /**
     * Check if the line currently has an active suggestion
     * @param {HTMLElement} lineElement
     */
    hasActiveSuggestion (lineElement) {
        if (!this.currentSuggestion || !lineElement) {
            return false;
        }

        const expectedId = this.currentSuggestion.lineId;
        const actualId = this._getLineId(lineElement);
        if (expectedId && actualId) {
            return expectedId === actualId && lineElement.dataset.autocompleteSuffix;
        }

        return this.currentSuggestion.lineElement === lineElement;
    }

    /**
     * Find a matching suggestion that begins with the provided text
     * @param {string} text
     */
    findSuggestion (text) {
        if (!text) {
            return null;
        }
        const normalized = text.toLowerCase();
        for (const candidate of this.suggestions) {
            if (typeof candidate !== 'string') continue;
            const cleaned = candidate.trim();
            if (!cleaned || cleaned.length <= text.length) {
                continue;
            }
            if (cleaned.toLowerCase().startsWith(normalized)) {
                return cleaned;
            }
        }
        return null;
    }

    /**
     *
     * @param {HTMLElement} lineElement
     * @param {string} suggestion
     * @param {string} baseText
     */
    applySuggestion (lineElement, suggestion, baseText) {
        const suffix = suggestion.slice(baseText.length);
        if (!suffix) {
            this.clearSuggestionForLine(lineElement);
            return;
        }

        if (this.currentSuggestion && this.currentSuggestion.lineElement !== lineElement) {
            this.clearSuggestion();
        }

        lineElement.setAttribute('data-autocomplete-suffix', suffix);
        lineElement.classList.add('has-autocomplete');
        const lineId = this._getLineId(lineElement);
        this.currentSuggestion = {
            lineElement,
            lineId,
            fullSuggestion: suggestion,
            baseText,
            suffix
        };

        if (this.stateManager) {
            this.stateManager.setAutocompleteCurrentSuggestion('speaker', suggestion);
        }
    }

    /**
     *
     * @param {HTMLElement} lineElement
     */
    clearSuggestionForLine (lineElement) {
        if (!lineElement) {
            return;
        }

        if (this.currentSuggestion && this.currentSuggestion.lineElement === lineElement) {
            this.currentSuggestion = null;
            if (this.stateManager) {
                this.stateManager.setAutocompleteCurrentSuggestion('speaker', null);
            }
        }
        this.removeAutocompleteAttributes(lineElement);
    }

    /**
     *
     */
    clearSuggestion () {
        if (this.currentSuggestion) {
            this.removeAutocompleteAttributes(this.currentSuggestion.lineElement);
            this.currentSuggestion = null;
        }
        if (this.stateManager) {
            this.stateManager.setAutocompleteCurrentSuggestion('speaker', null);
        }
    }

    /**
     *
     * @param {HTMLElement} lineElement
     */
    removeAutocompleteAttributes (lineElement) {
        if (!lineElement) {
            return;
        }
        lineElement.removeAttribute('data-autocomplete-suffix');
        lineElement.classList.remove('has-autocomplete');
    }

    /**
     * Get the dataset line id if present
     * @param {HTMLElement} lineElement
     * @returns {string|null}
     */
    _getLineId (lineElement) {
        if (!lineElement) {
            return null;
        }
        return lineElement.dataset?.lineId || null;
    }

    /**
     *
     */
    _getActiveLine () {
        if (typeof document === 'undefined') {
            return null;
        }
        const active = document.activeElement;
        return active ? active.closest('.script-line') : null;
    }

    /**
     *
     * @param {HTMLElement} lineElement
     */
    moveCaretToEnd (lineElement) {
        try {
            const selection = window.getSelection();
            if (!selection) {
                return;
            }
            const range = document.createRange();
            range.selectNodeContents(lineElement);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        } catch (error) {
            console.warn('[AutocompleteManager] Failed to move caret:', error);
        }
    }
}
