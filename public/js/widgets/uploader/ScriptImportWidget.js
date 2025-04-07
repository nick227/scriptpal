import { BaseWidget } from '../BaseWidget.js';
import { ScriptImportManager } from '../editor/ScriptImportManager.js';

export class ScriptImportWidget extends BaseWidget {
    constructor(options) {
        super();
        if (!options.container) {
            throw new Error('Container is required for ScriptImportWidget');
        }
        if (!options.pageManager) {
            throw new Error('PageManager instance is required for ScriptImportWidget');
        }
        if (!options.editorContent) {
            throw new Error('EditorContent instance is required for ScriptImportWidget');
        }

        this.container = options.container;
        this.pageManager = options.pageManager;
        this.editorContent = options.editorContent;

        // Initialize the import manager
        this.importManager = new ScriptImportManager(
            this.container,
            this.pageManager,
            this.editorContent
        );

        this.elements = {};
        this._handleClose = this._handleClose.bind(this);
    }

    async handleFile(file) {
        if (!file) return;

        try {
            // Create and show widget
            this.render();

            // Read file
            const text = await this.readFile(file);

            // Process the script
            await this.importManager.handleImport(text, this.elements.output);

            // Show success and auto-close
            this.elements.output.textContent = 'Import successful!';
            setTimeout(() => this._handleClose(), 2000);

        } catch (error) {
            console.error('Error importing script:', error);
            if (this.elements.output) {
                this.elements.output.textContent = `Error: ${error.message}`;
            }
        }
    }

    render() {
        if (!this.container) {
            console.error('Container element is not initialized');
            return;
        }

        // Create and append overlay first
        this.elements.overlay = this.createElement('div', 'uploader-overlay');
        document.body.appendChild(this.elements.overlay);

        // Create and append widget
        this.elements.widget = this.createWidgetContainer();
        document.body.appendChild(this.elements.widget);

        // Initialize output element for messages
        this.elements.output = this.elements.messageArea;
    }

    createWidgetContainer() {
        const widget = this.createElement('div', 'uploader-widget');

        // Position the widget in the center of the editor
        widget.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 1000;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            min-width: 300px;
        `;

        // Create overlay
        const overlay = this.createElement('div', 'uploader-overlay');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 999;
        `;
        this.elements.overlay = overlay;

        widget.appendChild(this.createHeader());
        widget.appendChild(this.createProgressSection());
        widget.appendChild(this.createMessageArea());

        return widget;
    }

    async handleImport() {
        try {
            const file = this.fileInput.files[0];
            if (!file) {
                this.updateMessage('No file selected');
                return;
            }

            this.updateMessage('Reading file...');
            const content = await this.readFile(file);

            this.updateMessage('Processing script...');
            await this.importManager.handleImport(content, this.elements.messageArea);

            this.updateMessage('Script imported successfully');
            this.updateProgress(100);

            // Auto-close after success
            setTimeout(() => this._handleClose(), 2000);
        } catch (error) {
            console.error('Import failed:', error);
            this.updateMessage('Import failed: ' + error.message);
            this.updateProgress(0);
        }
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (event) => {
                resolve(event.target.result);
            };

            reader.onerror = (error) => {
                reject(new Error('Error reading file: ' + error.message));
            };

            reader.readAsText(file);
        });
    }

    createHeader() {
        const header = this.createElement('div', 'uploader-header');

        this.elements.fileName = this.createElement('span', 'uploader-filename');
        this.updateFileName();

        const closeButton = this.createElement('button', 'uploader-close', '×');
        closeButton.addEventListener('click', this._handleClose);

        header.appendChild(this.elements.fileName);
        header.appendChild(closeButton);

        return header;
    }

    _handleClose(event = null) {
        if (event) {
            event.preventDefault();
        }

        // Remove overlay
        if (this.elements.overlay && this.elements.overlay.parentNode) {
            this.elements.overlay.parentNode.removeChild(this.elements.overlay);
        }

        // Remove widget
        if (this.elements.widget && this.elements.widget.parentNode) {
            this.elements.widget.parentNode.removeChild(this.elements.widget);
        }

        this.elements = {};
    }

    createProgressSection() {
        const section = this.createElement('div', 'uploader-progress-section');
        this.elements.progressBar = this.createElement('div', 'uploader-progress-bar');
        this.elements.progressInner = this.createElement('div', 'uploader-progress-inner');

        this.elements.progressBar.appendChild(this.elements.progressInner);
        section.appendChild(this.elements.progressBar);

        return section;
    }

    createMessageArea() {
        this.elements.messageArea = this.createElement('div', 'uploader-message');
        this.updateMessage('Processing script...');
        return this.elements.messageArea;
    }

    createElement(tag, className, text = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text) element.textContent = text;
        return element;
    }

    updateFileName() {
        const fileName = this.fileInput && this.fileInput.files && this.fileInput.files[0] ?
            this.fileInput.files[0].name : 'No file selected';
        if (this.elements.fileName) {
            this.elements.fileName.textContent = fileName;
        }
    }

    updateProgress(percent) {
        if (this.elements.progressInner) {
            this.elements.progressInner.style.width = `${percent}%`;
        }
    }

    updateMessage(message) {
        if (this.elements.messageArea) {
            this.elements.messageArea.textContent = message;
        }
    }

    destroy() {
        this._handleClose();
        super.destroy();
    }
}