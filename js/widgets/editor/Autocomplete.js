export class Autocomplete {
    /*
    ultra simple proof of concept 
    using minimal static terms here in the class
    proves ability to match different terms in different contexts i.e. headings, dialog, directions, etc.
    */
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.editorArea = null;

        // Static data for proof of concept
        this.locationTerms = {
            'INTERIOR': 'INTERIOR',
            'EXTERIOR': 'EXTERIOR'
        };

        this.characterTerms = {
            'TOM': 'TOM'
        };

        // State
        this.currentSuggestion = null;
        this.lastText = '';
        this.handlers = new Map();

        // Bind methods
        this._handleKeydown = this.handleKeydown.bind(this);
    }

    setEditorArea(editorArea) {
        this.editorArea = editorArea;
    }

    on(event, handler) {
        this.handlers.set(event, handler);
    }

    off(event) {
        this.handlers.delete(event);
    }

    destroy() {
        this.handlers.clear();
        this.currentSuggestion = null;
        this.lastText = '';
        this.editorArea = null;
    }

    handleEvent(event) {
        if (event.type === 'keydown') {
            return this.handleKeydown(event);
        }
        return null;
    }

    handleKeydown(event) {
        alert('Autocomplete.handleKeydown');
        const currentLine = this.stateManager.getCurrentLine();
        if (!currentLine) return null;

        const lineFormat = currentLine.getAttribute('data-format');
        if (!lineFormat) return null;

        // Get current text without any existing suggestion
        const currentText = this.getCurrentText(currentLine).trim().toUpperCase();

        // Handle special keys first
        switch (event.key) {
            case 'Tab':
            case 'Enter':
                if (this.currentSuggestion) {
                    event.preventDefault();
                    const result = {
                        text: this.currentSuggestion,
                        accepted: true,
                        format: lineFormat,
                        currentText: currentText
                    };
                    this.applySuggestion(currentLine, result);
                    this.clearSuggestion();
                    return result;
                }
                return null;

            case 'Escape':
                if (this.currentSuggestion) {
                    event.preventDefault();
                    this.clearSuggestion();
                    this.clearSuggestionDisplay();
                    return { cleared: true };
                }
                return null;

            case 'Backspace':
            case 'Delete':
                this.clearSuggestion();
                this.clearSuggestionDisplay();
                return null;

            case 'ArrowLeft':
            case 'ArrowRight':
            case 'ArrowUp':
            case 'ArrowDown':
                return null;
        }

        // Don't process modifier keys
        if (event.ctrlKey || event.altKey || event.metaKey) {
            return null;
        }

        // Only process printable characters
        if (event.key.length !== 1) {
            return null;
        }

        // Get all available terms (static + dynamic)
        const terms = this.getAllTerms(lineFormat);
        if (!terms) return null;

        // Predict what the text will be after this keypress
        const predictedText = currentText + event.key.toUpperCase();

        // Don't show suggestions for empty text
        if (!predictedText.trim()) {
            this.clearSuggestionDisplay();
            return null;
        }

        const suggestion = this.findMatch(predictedText, terms);

        // Update current suggestion
        this.currentSuggestion = suggestion;
        if (suggestion) {
            this.lastText = predictedText;
            this.updateSuggestionDisplay(currentLine, suggestion.slice(predictedText.length));
        } else {
            this.clearSuggestionDisplay();
        }

        // Return result if we have a suggestion
        if (suggestion) {
            return {
                text: suggestion,
                partial: true,
                format: lineFormat,
                currentText: predictedText
            };
        }

        return null;
    }

    getCurrentText(line) {
        if (!line) return '';

        // Get text content without any existing suggestion
        const text = line.textContent || '';
        const suggestionSpan = line.querySelector('.suggestion');
        if (suggestionSpan) {
            return text.slice(0, text.length - suggestionSpan.textContent.length);
        }
        return text;
    }

    applySuggestion(line, result) {
        if (!line || !result) return;

        // Apply the suggestion
        line.textContent = result.text;
        this.clearSuggestionDisplay();

        // Save new term if applicable
        if (result.format === 'header' || result.format === 'speaker') {
            const term = result.text.trim().toUpperCase();
            if (term && !this.hasStaticTerm(result.format, term) &&
                !this.stateManager.hasAutocompleteTerm(result.format, term)) {
                this.stateManager.addAutocompleteTerm(result.format, term);
            }
        }

        // Move cursor to end of line
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(line);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    clearSuggestionDisplay() {
        if (!this.editorArea) return;
        const suggestionSpan = this.editorArea.querySelector('.suggestion');
        if (suggestionSpan) {
            suggestionSpan.remove();
        }
    }

    updateSuggestionDisplay(line, suggestionText) {
        if (!this.editorArea || !line || !suggestionText) return;

        // Remove any existing suggestion spans
        this.clearSuggestionDisplay();

        // Get the current text content without any existing suggestion
        const currentText = this.getCurrentText(line);

        // Create new suggestion span
        const suggestionSpan = document.createElement('span');
        suggestionSpan.className = 'suggestion';
        suggestionSpan.textContent = suggestionText;

        // Clear the line content
        line.textContent = '';

        // Add the current text back
        line.textContent = currentText;

        // Append the suggestion span
        line.appendChild(suggestionSpan);
    }

    getAllTerms(format) {
        if (!format) return null;

        // Get static terms
        const staticTerms = format === 'header' ? this.locationTerms :
            format === 'speaker' ? this.characterTerms :
            null;

        if (!staticTerms) return null;

        // Get dynamic terms from state manager
        const dynamicTerms = this.stateManager.getAutocompleteTerms();
        if (!dynamicTerms) return staticTerms;

        // Create a new object with static terms
        const allTerms = {...staticTerms };

        // Get the appropriate dynamic set
        const dynamicSet = format === 'header' ? dynamicTerms.locations :
            format === 'speaker' ? dynamicTerms.characters :
            null;

        // Add dynamic terms to the object
        if (dynamicSet) {
            dynamicSet.forEach(term => {
                if (term && typeof term === 'string') {
                    allTerms[term] = term;
                }
            });
        }

        return allTerms;
    }

    findMatch(text, terms) {
        if (!text || !terms || text.length < 1) return null;

        // Find all terms that start with the current text
        const matches = Object.keys(terms).filter(term =>
            term.startsWith(text) && term !== text
        );

        // Return the first match, or null if no matches
        return matches.length > 0 ? matches[0] : null;
    }

    hasStaticTerm(format, term) {
        const terms = format === 'header' ? this.locationTerms :
            format === 'speaker' ? this.characterTerms :
            null;

        if (!terms) return false;

        return Object.keys(terms).includes(term.toUpperCase());
    }

    getCurrentSuggestion() {
        return this.currentSuggestion;
    }

    clearSuggestion() {
        this.currentSuggestion = null;
        this.lastText = '';
    }
}