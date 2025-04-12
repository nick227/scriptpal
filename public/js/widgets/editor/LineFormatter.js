export class LineFormatter {
    constructor(stateManager) {
        if (!stateManager) {
            throw new Error('StateManager is required for LineFormatter');
        }

        this.stateManager = stateManager;
        this.keydownHandler = null;

        // Define valid formats - must match server's allowed tags
        this.VALID_FORMATS = {
            header: 'header',
            action: 'action',
            speaker: 'speaker',
            dialog: 'dialog',
            directions: 'directions',
            'chapter-break': 'chapter-break'
        };

        // Define format cycle for shift+arrow navigation
        this.FORMAT_CYCLE = [
            this.VALID_FORMATS.header,
            this.VALID_FORMATS.action,
            this.VALID_FORMATS.directions,
            this.VALID_FORMATS.speaker,
            this.VALID_FORMATS.dialog,
            this.VALID_FORMATS['chapter-break']
        ];

        // Define format flow for Enter key
        this.formatFlow = {
            [this.VALID_FORMATS.header]: this.VALID_FORMATS.action,
            [this.VALID_FORMATS.action]: this.VALID_FORMATS.speaker,
            [this.VALID_FORMATS.speaker]: this.VALID_FORMATS.dialog,
            [this.VALID_FORMATS.dialog]: this.VALID_FORMATS.speaker,
            [this.VALID_FORMATS.directions]: this.VALID_FORMATS.action,
            [this.VALID_FORMATS['chapter-break']]: this.VALID_FORMATS.action
        };

        // Default format
        this.DEFAULT_FORMAT = this.VALID_FORMATS.action;
    }

    setKeydownHandler(handler) {
        this.keydownHandler = handler;
    }

    getNextFlowFormat(currentFormat) {
        if (!currentFormat) {
            return this.VALID_FORMATS.header;
        }

        // Get the next format from the flow map
        const nextFormat = this.formatFlow[currentFormat];

        // If no next format defined, default to action
        return nextFormat || this.VALID_FORMATS.action;
    }

    createFormattedLine(format = this.DEFAULT_FORMAT) {
        // Ensure format is valid
        if (!this.isValidFormat(format)) {
            console.warn(`Invalid format "${format}", using default format "${this.DEFAULT_FORMAT}"`);
            format = this.DEFAULT_FORMAT;
        }

        const line = document.createElement('div');
        line.className = 'script-line';
        line.dataset.format = format;
        line.setAttribute('role', 'textbox');
        line.setAttribute('aria-label', `${format} line`);
        line.setAttribute('data-enable-grammarly', 'false');
        line.contentEditable = 'true';
        line.classList.add('format-' + format);

        // Only prevent focus loss when clicking non-text areas
        line.addEventListener('mousedown', (e) => {
            // Allow natural selection if clicking text content
            if (e.target.nodeType === Node.TEXT_NODE ||
                (e.target === line && line.textContent.length > 0)) {
                return;
            }

            // Prevent focus loss only when clicking empty areas
            if (document.activeElement === line && !line.textContent.trim()) {
                e.preventDefault();
            }
        });

        // Improve double-click behavior
        line.addEventListener('dblclick', (e) => {
            // If user double-clicked text, let browser handle word selection
            if (e.target.nodeType === Node.TEXT_NODE ||
                window.getSelection().toString()) {
                return;
            }

            // Only select all if double-clicking empty space
            this.highlightContents(line);
        });

        // Handle cursor positioning
        line.addEventListener('click', (e) => {
            // Don't interfere with existing selection
            const selection = window.getSelection();
            if (selection.toString()) {
                return;
            }

            // Only handle clicks directly on the line element
            if (e.target !== line) {
                return;
            }

            const rect = line.getBoundingClientRect();
            const clickX = e.clientX - rect.left;

            // Find nearest text position
            const range = document.createRange();
            const textNode = line.firstChild;
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                let position = Math.round((clickX / rect.width) * textNode.length);
                position = Math.max(0, Math.min(position, textNode.length));

                range.setStart(textNode, position);
                range.setEnd(textNode, position);

                selection.removeAllRanges();
                selection.addRange(range);
            }
        });

        // Attach keydown handler if available
        if (this.keydownHandler) {
            line.addEventListener('keydown', this.keydownHandler);
        }

        // Ensure line has initial text node for cursor positioning
        const textNode = document.createTextNode('');
        line.appendChild(textNode);

        return line;
    }

    highlightContents(line) {
        // Don't override existing selection
        const selection = window.getSelection();
        if (selection.toString()) {
            return;
        }

        const range = document.createRange();
        range.selectNodeContents(line);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    getFormatForLine(line) {
        return line.dataset.format || this.DEFAULT_FORMAT;
    }

    setLineFormat(line, newFormat) {
        if (!line || !this.isValidFormat(newFormat)) {
            console.warn('Invalid line or format');
            return;
        }

        // Check if this is the first line
        const isFirstLine = !line.previousElementSibling;
        const isFirstPage = line.closest('.editor-page') && !line.closest('.editor-page').previousElementSibling;

        // Prevent changing format of first line on first page
        if (isFirstLine && isFirstPage) {
            console.warn('Cannot change format of first line on first page');
            return;
        }

        // Remove all existing format classes
        Object.values(this.VALID_FORMATS).forEach(format => {
            line.classList.remove('format-' + format);
        });

        // Add new format class
        line.classList.add('format-' + newFormat);

        // Update format data attribute
        line.dataset.format = newFormat;
        line.setAttribute('aria-label', `${newFormat} line`);

        // Update state manager if this is the current line
        const currentLine = this.stateManager.getCurrentLine();
        if (currentLine && currentLine === line) {
            this.stateManager.setCurrentFormat(newFormat);
        }
    }

    // Utility Methods
    isValidFormat(format) {
        return Object.values(this.VALID_FORMATS).includes(format);
    }

    getAllFormats() {
        return Object.values(this.VALID_FORMATS);
    }

    getFormatName(format) {
        if (!this.isValidFormat(format)) return '';
        const entry = Object.entries(this.VALID_FORMATS)
            .find(([_, value]) => value === format);
        return entry && entry[0] ? entry[0].toLowerCase() : '';
    }

    destroy() {
        this.keydownHandler = null;
    }
}