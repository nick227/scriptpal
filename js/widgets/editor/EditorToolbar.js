import { BaseWidget } from '../BaseWidget.js';
import { formatTypes } from './constants.js';
import { ScriptImportWidget } from '../uploader/ScriptImportWidget.js';

export class EditorToolbar extends BaseWidget {
    constructor(options) {
        if (!options || !options.editorContainer) {
            throw new Error('Editor container element is required');
        }
        if (!options.stateManager) {
            throw new Error('StateManager is required for EditorToolbar');
        }
        if (!options.editorContent) {
            throw new Error('EditorContent instance is required for EditorToolbar');
        }

        // Call super with required elements
        super({
            editorContainer: options.editorContainer
        });

        // Store references
        this.stateManager = options.stateManager;
        this.editorContent = options.editorContent;
        this.eventManager = options.eventManager;
        this.editorContainer = options.editorContainer;

        // Initialize toolbar elements
        this.toolbar = null;
        this.formatButtons = new Map();
        this.pageCounter = null;
        this.undoButton = null;
        this.redoButton = null;
        this.saveButton = null;
        this.importButton = null;
        this.fileInput = null;

        // Initialize handlers
        this._handlers = {
            formatSelected: null,
            undo: null,
            redo: null,
            chapterCreate: null,
            save: null,
            import: null
        };

        // Bind event handlers
        this._handleFormatClick = this.handleFormatClick.bind(this);
        this._handleUndoClick = this.handleUndoClick.bind(this);
        this._handleRedoClick = this.handleRedoClick.bind(this);
        this._handleSaveClick = this.handleSaveClick.bind(this);
        this._handleImportClick = this.handleImportClick.bind(this);
        this._handleFileSelect = this.handleFileSelect.bind(this);

        this.formats = formatTypes;
    }

    validateElements() {
        if (!this.elements.editorContainer) {
            throw new Error('Editor container element is required');
        }
    }

    async initialize() {
        if (!this.elements.editorContainer) {
            throw new Error('Editor container element is required');
        }

        this.toolbar = this.createElement('div', 'editor-toolbar');
        this.elements.editorContainer.appendChild(this.toolbar);

        this.createUndoRedoButtons();
        this.createFormatButtons();
        this.createToolbar();
        this.setupEventListeners();
    }

    createUndoRedoButtons() {
        const undoButton = this.createElement('button', 'format-button undo-button', '↶');
        undoButton.title = 'Undo (Ctrl+Z)';

        const redoButton = this.createElement('button', 'format-button redo-button', '↷');
        redoButton.title = 'Redo (Ctrl+Y)';

        const saveButton = this.createElement('button', 'format-button save-button');
        saveButton.innerHTML = '<i class="fas fa-save"></i>';
        saveButton.title = 'Save Script (Ctrl+S)';
        this.saveButton = saveButton;

        // Create import button
        const importButton = this.createElement('button', 'format-button import-button');
        importButton.innerHTML = '<i class="fas fa-file-import"></i>';
        importButton.title = 'Import Script';
        this.importButton = importButton;

        // Create hidden file input
        const fileInput = this.createElement('input', 'hidden-file-input');
        fileInput.type = 'file';
        fileInput.accept = '.txt,.pdf,.fdx';
        fileInput.style.display = 'none';
        this.fileInput = fileInput;

        this.toolbar.appendChild(undoButton);
        this.toolbar.appendChild(redoButton);
        this.toolbar.appendChild(saveButton);
        this.toolbar.appendChild(importButton);
        this.toolbar.appendChild(fileInput);
    }

    createFormatButtons() {
        Object.entries(this.formats).forEach(([key, value]) => {
            const button = this.createElement('button', 'format-button', key.toLowerCase());
            button.dataset.format = value;
            button.title = `Format as ${key.toLowerCase()}`;
            this.toolbar.appendChild(button);
        });
    }

    createToolbar() {
        //this.addPageCount();
        //this.addChapterButton();
    }

    addPageCount() {
        // Add page count display
        const pageCountElement = this.createElement('span', 'page-count');
        pageCountElement.textContent = 'Page 1'; // Default to page 1
        this.toolbar.appendChild(pageCountElement);
    }

    addChapterButton() {
        // Add chapter management buttons
        const chapterButton = this.createElement('button', 'format-button');
        chapterButton.innerHTML = 'Add Chapter';
        chapterButton.title = 'Add a new chapter at current position';
        chapterButton.onclick = () => {
            const title = prompt('Enter chapter title:');
            if (title) {
                this.notifyChapterCreate(title);
            }
        };
        this.toolbar.appendChild(chapterButton);
    }

    setupEventListeners() {
        this.toolbar.addEventListener('click', this.handleToolbarClick.bind(this));
        this.fileInput.addEventListener('change', this._handleFileSelect);
    }

    handleFormatClick(format) {
        this._handlers.formatSelected(format);
    }

    handleUndoClick() {
        if (this._handlers.undo) {
            this._handlers.undo();
            this.updateHistoryState(
                this.stateManager.getState('canUndo'),
                this.stateManager.getState('canRedo')
            );
        }
    }

    handleRedoClick() {
        if (this._handlers.redo) {
            this._handlers.redo();
            this.updateHistoryState(
                this.stateManager.getState('canUndo'),
                this.stateManager.getState('canRedo')
            );
        }
    }

    handleSaveClick() {
        if (this._handlers.save) {
            this.setSaveState('saving');
            this._handlers.save().finally(() => {
                this.setSaveState('saved');
                setTimeout(() => this.setSaveState('idle'), 200);
            });
        }
    }

    handleImportClick() {
        this.fileInput.click();
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Create uploader widget with EditorContent reference
        const uploader = new ScriptImportWidget({
            container: this.editorContainer,
            pageManager: this.editorContent.pageManager,
            editorContent: this.editorContent
        });

        uploader.handleFile(file);
    }

    handleToolbarClick(e) {
        const button = e.target.closest('button');
        if (!button) return;

        if (button.classList.contains('undo-button')) {
            this._handleUndoClick();
        } else if (button.classList.contains('redo-button')) {
            this._handleRedoClick();
        } else if (button.classList.contains('save-button')) {
            this._handleSaveClick();
        } else if (button.classList.contains('import-button')) {
            this._handleImportClick();
        } else if (button.dataset.format) {
            this._handleFormatClick(button.dataset.format);
        }
    }

    onFormatSelected(callback) {
        this._handlers.formatSelected = callback;
    }

    onUndo(callback) {
        this._handlers.undo = callback;
    }

    onRedo(callback) {
        this._handlers.redo = callback;
    }

    onSave(callback) {
        this._handlers.save = callback;
    }

    onImport(callback) {
        this._handlers.import = callback;
    }

    updateActiveFormat(format) {
        const buttons = this.toolbar.querySelectorAll('.format-button');
        buttons.forEach(button => {
            if (button.dataset.format) {
                button.classList.toggle('active', button.dataset.format === format);
            }
        });
    }

    updateHistoryState(canUndo, canRedo) {
        const undoButton = this.toolbar.querySelector('.undo-button');
        const redoButton = this.toolbar.querySelector('.redo-button');

        if (undoButton) {
            undoButton.disabled = !canUndo;
            undoButton.classList.toggle('active', canUndo);
        }
        if (redoButton) {
            redoButton.disabled = !canRedo;
            redoButton.classList.toggle('active', canRedo);
        }
    }

    updatePageCount(pageCount) {
        // Update page count display if it exists
        const pageCountElement = this.toolbar.querySelector('.page-count');
        if (!pageCountElement) {
            // Create page count element if it doesn't exist
            const pageCountElement = this.createElement('span', 'page-count');
            this.toolbar.appendChild(pageCountElement);
        }
        pageCountElement.textContent = `Page ${pageCount}`;
    }

    onChapterCreate(callback) {
        this._handlers.chapterCreate = callback;
    }

    notifyChapterCreate(title) {
        if (this._handlers.chapterCreate) {
            this._handlers.chapterCreate(title);
        }
    }

    setSaveState(state) {
        if (!this.saveButton) return;

        // Remove all state classes first
        this.saveButton.classList.remove('saving', 'saved', 'autosaving');

        switch (state) {
            case 'saving':
                this.saveButton.classList.add('saving');
                break;
            case 'saved':
                this.saveButton.classList.add('saved');
                break;
            case 'autosaving':
                this.saveButton.classList.add('autosaving');
                break;
        }
    }

    destroy() {
        this.toolbar.removeEventListener('click', this.handleToolbarClick);
        this.fileInput.removeEventListener('change', this._handleFileSelect);
        this.formatHandlers.clear();
        this._handlers.undo = null;
        this._handlers.redo = null;
        this._handlers.formatSelected = null;
        this._handlers.import = null;
        this.toolbar.remove();
        this.toolbar = null;
        super.destroy();
    }
}