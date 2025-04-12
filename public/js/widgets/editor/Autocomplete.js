export class Autocomplete {
    static SUPPORTED_FORMATS = ['speaker', 'header'];

    constructor(stateManager) {
        if (!stateManager) {
            throw new Error('StateManager is required for Autocomplete');
        }

        this.stateManager = stateManager;
        this.editorArea = null;
        this.currentSuggestion = null;
        this.lastSuggestionLine = null;

        // Static data for proof of concept - move to configuration later
        this.suggestions = {
            header: {
                'INT': 'INTERIOR',
                'EXT': 'EXTERIOR',
                'INTERIOR': 'INTERIOR',
                'EXTERIOR': 'EXTERIOR'
            },
            speaker: {
                'TOM': 'TOM',
                'SARAH': 'SARAH',
                'JOHN': 'JOHN',
                'JANE': 'JANE'
            }
        };

        // Enhanced cache with TTL and size limit
        this.MAX_CACHE_SIZE = 1000;
        this.CACHE_TTL = 60000; // 1 minute
        this._matchCache = new Map();
        this._cacheTimestamps = new Map();

        // Format-specific line collections cache
        this._formatLinesCache = new Map();

        // Debounce timeout
        this._keyupTimeout = null;
        this.DEBOUNCE_DELAY = 150; // ms

        // Bind methods
        this._handleKeyup = this.debounce(this.handleKeyup.bind(this), this.DEBOUNCE_DELAY);
        this._handleKeydown = this.handleKeydown.bind(this);
        this._handleFocusOut = this.handleFocusOut.bind(this);
    }

    isFormatSupported(format) {
        return Autocomplete.SUPPORTED_FORMATS.includes(format);
    }

    getSuggestionsForFormat(format) {
        return this.suggestions[format] || {};
    }

    // Debounce utility
    debounce(func, wait) {
        return (...args) => {
            clearTimeout(this._keyupTimeout);
            this._keyupTimeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Cache management
    _addToCache(key, value) {
        // Remove oldest entries if cache is full
        if (this._matchCache.size >= this.MAX_CACHE_SIZE) {
            const oldestKey = Array.from(this._cacheTimestamps.keys())
                .sort((a, b) => this._cacheTimestamps.get(a) - this._cacheTimestamps.get(b))[0];
            this._matchCache.delete(oldestKey);
            this._cacheTimestamps.delete(oldestKey);
        }

        this._matchCache.set(key, value);
        this._cacheTimestamps.set(key, Date.now());
    }

    _getFromCache(key) {
        const timestamp = this._cacheTimestamps.get(key);
        if (!timestamp) return null;

        // Check if entry is expired
        if (Date.now() - timestamp > this.CACHE_TTL) {
            this._matchCache.delete(key);
            this._cacheTimestamps.delete(key);
            return null;
        }

        return this._matchCache.get(key);
    }

    // Format-specific line collection management
    _updateFormatLines(format) {
        if (!this.editorArea) return;

        const lines = Array.from(this.editorArea.querySelectorAll(
            `.script-line[data-format="${format}"]`
        ));

        this._formatLinesCache.set(format, {
            lines,
            timestamp: Date.now()
        });

        return lines;
    }

    _getFormatLines(format) {
        const cached = this._formatLinesCache.get(format);

        // If no cache or cache is older than 5 seconds, refresh
        if (!cached || Date.now() - cached.timestamp > 5000) {
            return this._updateFormatLines(format);
        }

        return cached.lines;
    }

    setEditorArea(editorArea) {
        if (this.editorArea) {
            // Clean up old listeners
            this.editorArea.removeEventListener('keyup', this._handleKeyup);
            this.editorArea.removeEventListener('keydown', this._handleKeydown);
            this.editorArea.removeEventListener('focusout', this._handleFocusOut);
        }
        this.editorArea = editorArea;
        if (editorArea) {
            // Set up new listeners
            editorArea.addEventListener('keyup', this._handleKeyup);
            editorArea.addEventListener('keydown', this._handleKeydown);
            editorArea.addEventListener('focusout', this._handleFocusOut);
        }
    }

    destroy() {
        if (this.editorArea) {
            this.editorArea.removeEventListener('keyup', this._handleKeyup);
            this.editorArea.removeEventListener('keydown', this._handleKeydown);
            this.editorArea.removeEventListener('focusout', this._handleFocusOut);
        }

        clearTimeout(this._keyupTimeout);
        this._matchCache.clear();
        this._cacheTimestamps.clear();
        this._formatLinesCache.clear();
        this.editorArea = null;
        this.currentSuggestion = null;
        this.lastSuggestionLine = null;
    }

    handleFocusOut(event) {
        // Clear suggestions when focus moves to a different line
        const scriptLine = event.target.closest('.script-line');
        if (!scriptLine) return;

        if (this.lastSuggestionLine && this.lastSuggestionLine !== scriptLine) {
            this.clearSuggestion();
            this.clearSuggestionDisplay();
        }
    }

    handleKeydown(event) {
        const scriptLine = event.target.closest('.script-line');
        if (!scriptLine || !this.currentSuggestion) return null;

        const format = scriptLine.getAttribute('data-format');
        // Only process autocomplete for speaker and header formats
        if (!format || !['speaker', 'header'].includes(format)) {
            return null;
        }

        // Only handle Tab for accepting suggestions
        if (event.key === 'Tab') {
            event.preventDefault(); // Prevent default tab behavior

            const currentText = this.getCurrentText(scriptLine).trim().toUpperCase();

            const result = {
                text: this.currentSuggestion,
                accepted: true,
                format: format,
                currentText: currentText
            };

            this.applySuggestion(scriptLine, result);
            this.clearSuggestion();

            return result;
        }

        return null;
    }

    handleKeyup(event) {
        try {
            // Don't process modifier keys or navigation keys
            if (event.altKey || event.ctrlKey || event.metaKey) return null;
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return null;

            const scriptLine = event.target.closest('.script-line');
            if (!scriptLine) return null;

            const format = scriptLine.getAttribute('data-format');
            if (!this.isFormatSupported(format)) {
                this.clearSuggestion();
                this.clearSuggestionDisplay();
                return null;
            }

            // Update last suggestion line
            this.lastSuggestionLine = scriptLine;

            // Get current text without any existing suggestion
            const currentText = this.getCurrentText(scriptLine);

            // Handle backspace/delete
            if (event.key === 'Backspace' || event.key === 'Delete') {
                this.clearSuggestion();
                this.clearSuggestionDisplay();
                return currentText ? this.processSuggestion(currentText, format, scriptLine) : null;
            }

            return this.processSuggestion(currentText, format, scriptLine);
        } catch (error) {
            console.error('Error in handleKeyup:', error);
            this.clearSuggestion();
            this.clearSuggestionDisplay();
            return null;
        }
    }

    processSuggestion(currentText, format, scriptLine) {
        if (!currentText) {
            this.clearSuggestion();
            this.clearSuggestionDisplay();
            return null;
        }

        const upperText = currentText.toUpperCase();
        const suggestion = this.findMatch(upperText, format, scriptLine);

        if (suggestion) {
            this.currentSuggestion = suggestion;
            this.updateSuggestionDisplay(scriptLine, suggestion.slice(upperText.length));
            return { text: suggestion, partial: true, format };
        } else {
            this.clearSuggestion();
            this.clearSuggestionDisplay();
            return null;
        }
    }

    getCurrentText(line) {
        if (!line) return '';

        // Get text content without any existing suggestion
        const text = line.textContent || '';
        const suggestionSpan = line.querySelector('.suggestion');
        if (suggestionSpan) {
            // Make sure we don't include the suggestion text
            return text.slice(0, text.length - suggestionSpan.textContent.length).trim();
        }
        return text.trim();
    }

    applySuggestion(line, result) {
        if (!line || !result) return;

        // Store current selection
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const cursorOffset = range.startOffset;

        // Apply the suggestion
        const textNode = document.createTextNode(result.text);
        while (line.firstChild) {
            line.removeChild(line.firstChild);
        }
        line.appendChild(textNode);

        // Clear any suggestion display
        this.clearSuggestionDisplay();

        // Restore cursor to end of line
        const newRange = document.createRange();
        newRange.setStart(textNode, result.text.length);
        newRange.setEnd(textNode, result.text.length);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    clearSuggestionDisplay() {
        if (!this.editorArea) return;
        const suggestionSpan = this.editorArea.querySelector('.suggestion');
        if (suggestionSpan) {
            suggestionSpan.remove();
        }
    }

    updateSuggestionDisplay(line, suggestionText) {
        if (!line || !suggestionText) {
            this.clearSuggestionDisplay();
            return;
        }

        // Store current selection
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const cursorOffset = range.startOffset;

        // Remove any existing suggestion first
        this.clearSuggestionDisplay();

        // Get the current text without any suggestion
        const currentText = this.getCurrentText(line);

        // Create new suggestion span
        const suggestionSpan = document.createElement('span');
        suggestionSpan.className = 'suggestion';
        suggestionSpan.textContent = suggestionText;

        // Create text node for current text
        const textNode = document.createTextNode(currentText);

        // Clear and rebuild line content
        while (line.firstChild) {
            line.removeChild(line.firstChild);
        }
        line.appendChild(textNode);
        line.appendChild(suggestionSpan);

        // Restore cursor position
        const newRange = document.createRange();
        const newOffset = Math.min(cursorOffset, currentText.length);
        newRange.setStart(textNode, newOffset);
        newRange.setEnd(textNode, newOffset);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    findMatch(text, format, currentLine) {
        if (!text || !this.isFormatSupported(format) || text.length < 1) return null;

        // Check cache first
        const cacheKey = `${text}:${format}`;
        const cachedResult = this._getFromCache(cacheKey);
        if (cachedResult !== null) return cachedResult;

        // Check static suggestions first
        const formatSuggestions = this.getSuggestionsForFormat(format);
        const staticMatch = Object.entries(formatSuggestions)
            .find(([key, value]) =>
                (key.startsWith(text) || value.startsWith(text)) &&
                key !== text &&
                value !== text
            );

        if (staticMatch) {
            const match = staticMatch[1];
            this._addToCache(cacheKey, match);
            return match;
        }

        // Check existing lines in the editor
        const lines = this._getFormatLines(format);
        if (!lines) return null;

        const sortedLines = this._getSortedLines(lines, currentLine);

        // Check each line for a match
        for (const line of sortedLines) {
            if (line === currentLine) continue;

            const term = line.textContent.trim().toUpperCase();
            if (term.startsWith(text) && term !== text) {
                this._addToCache(cacheKey, term);
                return term;
            }
        }

        this._addToCache(cacheKey, null);
        return null;
    }

    _getSortedLines(lines, currentLine) {
        if (!currentLine) return lines;

        const currentIndex = lines.indexOf(currentLine);
        if (currentIndex === -1) return lines;

        const result = [...lines];
        result.splice(currentIndex, 1);

        const prevSibling = currentLine.previousElementSibling;
        const nextSibling = currentLine.nextElementSibling;

        if (nextSibling) {
            const nextIndex = result.indexOf(nextSibling);
            if (nextIndex > -1) {
                result.splice(nextIndex, 1);
                result.unshift(nextSibling);
            }
        }

        if (prevSibling) {
            const prevIndex = result.indexOf(prevSibling);
            if (prevIndex > -1) {
                result.splice(prevIndex, 1);
                result.unshift(prevSibling);
            }
        }

        return result;
    }

    clearSuggestion() {
        this.currentSuggestion = null;
    }
}