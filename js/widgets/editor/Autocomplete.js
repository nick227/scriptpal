export class Autocomplete {
    /*
    ultra simple proof of concept 
    using minimal static terms here in the class
    proves ability to match different terms in different contexts i.e. headings, dialog, directions, etc.
    */
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.editorArea = null;
        this.currentSuggestion = null;
        this.lastSuggestionLine = null;

        // Static data for proof of concept
        this.locationTerms = {
            'INTERIOR': 'INTERIOR',
            'EXTERIOR': 'EXTERIOR'
        };

        this.characterTerms = {
            'TOM': 'TOM'
        };

        // Cache for term matches
        this._matchCache = new Map();
        this._lastCacheClean = Date.now();

        // Bind methods
        this._handleKeyup = this.handleKeyup.bind(this);
        this._handleKeydown = this.handleKeydown.bind(this);
        this._handleFocusOut = this.handleFocusOut.bind(this);
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
        this.editorArea = null;
        this._matchCache.clear();
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

        // Only handle Tab for accepting suggestions
        if (event.key === 'Tab') {
            event.preventDefault(); // Prevent default tab behavior

            const lineFormat = scriptLine.getAttribute('data-format');
            const currentText = this.getCurrentText(scriptLine).trim().toUpperCase();

            const result = {
                text: this.currentSuggestion,
                accepted: true,
                format: lineFormat,
                currentText: currentText
            };

            this.applySuggestion(scriptLine, result);
            this.clearSuggestion();

            return result;
        }

        return null;
    }

    handleKeyup(event) {
        // Don't process modifier keys or navigation keys
        if (event.altKey || event.ctrlKey || event.metaKey) return null;
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return null;

        const scriptLine = event.target.closest('.script-line');
        if (!scriptLine) return null;

        const format = scriptLine.getAttribute('data-format');
        if (!format) return null;

        // Update last suggestion line
        this.lastSuggestionLine = scriptLine;

        // Get current text without any existing suggestion
        const currentText = this.getCurrentText(scriptLine);

        // Always clear current suggestion if backspacing or deleting
        if (event.key === 'Backspace' || event.key === 'Delete') {
            this.clearSuggestion();
            this.clearSuggestionDisplay();

            // If no text left, just return
            if (!currentText) return null;
        }

        // Don't process if empty
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
        if (!text || !format || text.length < 1) return null;

        // Clean old cache entries every minute
        const now = Date.now();
        if (now - this._lastCacheClean > 60000) {
            this._matchCache.clear();
            this._lastCacheClean = now;
        }

        // Check cache first
        const cacheKey = `${text}:${format}`;
        if (this._matchCache.has(cacheKey)) {
            return this._matchCache.get(cacheKey);
        }

        // First check static format (already in memory)
        const staticTerms = format === 'header' ? this.locationTerms :
            format === 'speaker' ? this.characterTerms :
            null;

        let match = null;
        if (staticTerms) {
            match = Object.keys(staticTerms).find(term =>
                term.startsWith(text) && term !== text
            );
            if (match) {
                this._matchCache.set(cacheKey, match);
                return match;
            }
        }

        // Get all lines with this format
        const lines = Array.from(this.editorArea.querySelectorAll(
            `.script-line[data-format="${format}"]`
        ));

        // Sort lines so current line's siblings are checked first
        if (currentLine) {
            const currentIndex = lines.indexOf(currentLine);
            if (currentIndex > -1) {
                // Move siblings to the front
                const prevSibling = currentLine.previousElementSibling;
                const nextSibling = currentLine.nextElementSibling;

                // Reorder array to check siblings first
                lines.splice(currentIndex, 1);
                if (nextSibling) {
                    const nextIndex = lines.indexOf(nextSibling);
                    if (nextIndex > -1) lines.splice(nextIndex, 1);
                    lines.unshift(nextSibling);
                }
                if (prevSibling) {
                    const prevIndex = lines.indexOf(prevSibling);
                    if (prevIndex > -1) lines.splice(prevIndex, 1);
                    lines.unshift(prevSibling);
                }
            }
        }

        // Check each line for a match
        for (const line of lines) {
            // Skip the current line itself
            if (line === currentLine) continue;

            const term = line.textContent.trim().toUpperCase();
            // Only match if the term starts with our text and isn't exactly the same
            if (term.startsWith(text) && term !== text) {
                this._matchCache.set(cacheKey, term);
                return term;
            }
        }

        // Cache null result too
        this._matchCache.set(cacheKey, null);
        return null;
    }

    clearSuggestion() {
        this.currentSuggestion = null;
    }
}