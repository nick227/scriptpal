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
            directions: 'directions'
        };

        // Define format cycle for shift+arrow navigation
        this.FORMAT_CYCLE = [
            this.VALID_FORMATS.header,
            this.VALID_FORMATS.action,
            this.VALID_FORMATS.directions,
            this.VALID_FORMATS.speaker,
            this.VALID_FORMATS.dialog
        ];

        // Define format flow for Enter key
        this.formatFlow = {
            [this.VALID_FORMATS.header]: this.VALID_FORMATS.action,
            [this.VALID_FORMATS.action]: this.VALID_FORMATS.speaker,
            [this.VALID_FORMATS.speaker]: this.VALID_FORMATS.dialog,
            [this.VALID_FORMATS.dialog]: this.VALID_FORMATS.speaker,
            [this.VALID_FORMATS.directions]: this.VALID_FORMATS.action
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

        // Prevent focus loss on click
        line.addEventListener('mousedown', (e) => {
            if (document.activeElement === line) {
                e.preventDefault();
            }
        });

        // Highlight contents on double click
        line.addEventListener('dblclick', (e) => this.highlightContents(line));

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
        const selection = window.getSelection();
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