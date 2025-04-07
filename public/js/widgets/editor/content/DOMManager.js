import { BaseWidget } from '../../BaseWidget.js';

export class DOMManager extends BaseWidget {
    constructor(options) {
        super();
        this.container = options.container;
        this.stateManager = options.stateManager;
        this.editorArea = null;
    }

    initialize() {
        try {
            this.validateElements();
            // Create editor area if it doesn't exist
            if (!this.editorArea) {
                this.editorArea = document.createElement('div');
                this.editorArea.className = 'editor-area';
                this.editorArea.contentEditable = 'true';
                this.editorArea.setAttribute('data-enable-grammarly', 'false');
                this.editorArea.setAttribute('data-enable-content-editables', 'true');
                this.editorArea.spellcheck = false;
                this.container.appendChild(this.editorArea);
            }

            return this.editorArea;
        } catch (error) {
            console.error('DOMManager: Initialization failed:', error);
            throw error;
        }
    }

    validateElements() {
        if (!this.container || !(this.container instanceof HTMLElement)) {
            throw new Error('Editor container element is required and must be a valid HTMLElement');
        }
    }

    getLineAtIndex(index) {
        const lines = this.editorArea.querySelectorAll('.script-line');
        return lines[index] || null;
    }

    focusLine(line) {
        if (!line) return;

        line.focus();
        const range = document.createRange();
        range.setStart(line, 0);
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    destroy() {
        if (this.editorArea) {
            this.editorArea.remove();
            this.editorArea = null;
        }
        super.destroy();
    }
}