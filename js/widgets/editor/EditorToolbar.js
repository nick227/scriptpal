import { BaseWidget } from '../BaseWidget.js';
import { formatTypes } from './constants.js';

export class EditorToolbar extends BaseWidget {
    constructor(options) {
        if (!options || !options.editorContainer) {
            throw new Error('Editor container element is required');
        }
        if (!options.stateManager) {
            throw new Error('StateManager is required for EditorToolbar');
        }

        // Call super with required elements
        super({
            editorContainer: options.editorContainer
        });

        // Store state manager reference
        this.stateManager = options.stateManager;

        // Initialize toolbar elements
        this.toolbar = null;
        this.formatButtons = new Map();
        this.pageCounter = null;
        this.undoButton = null;
        this.redoButton = null;

        // Initialize handlers
        this._handlers = {
            formatSelected: null,
            undo: null,
            redo: null,
            chapterCreate: null,
            subChapterCreate: null
        };

        // Bind event handlers
        this._handleFormatClick = this.handleFormatClick.bind(this);
        this._handleUndoClick = this.handleUndoClick.bind(this);
        this._handleRedoClick = this.handleRedoClick.bind(this);

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

        this.toolbar.appendChild(undoButton);
        this.toolbar.appendChild(redoButton);
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

        const subChapterButton = this.createElement('button', 'format-button');
        subChapterButton.innerHTML = 'Add Sub-Chapter';
        subChapterButton.title = 'Add a new sub-chapter at current position';
        subChapterButton.onclick = () => {
            const title = prompt('Enter sub-chapter title:');
            if (title) {
                this.notifySubChapterCreate(title);
            }
        };
        this.toolbar.appendChild(subChapterButton);

        // Add page count display
        const pageCountElement = this.createElement('span', 'page-count');
        pageCountElement.textContent = 'Page 1'; // Default to page 1
        this.toolbar.appendChild(pageCountElement);
    }

    setupEventListeners() {
        this.toolbar.addEventListener('click', this.handleToolbarClick.bind(this));
    }

    handleFormatClick(format) {
        if (this._handlers.formatSelected) {
            this._handlers.formatSelected(format);
        }
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

    handleToolbarClick(e) {
        const button = e.target.closest('button');
        if (!button) return;

        if (button.classList.contains('undo-button')) {
            this._handleUndoClick();
        } else if (button.classList.contains('redo-button')) {
            this._handleRedoClick();
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

    onSubChapterCreate(callback) {
        this._handlers.subChapterCreate = callback;
    }

    notifyChapterCreate(title) {
        if (this._handlers.chapterCreate) {
            this._handlers.chapterCreate(title);
        }
    }

    notifySubChapterCreate(title) {
        if (this._handlers.subChapterCreate) {
            this._handlers.subChapterCreate(title);
        }
    }

    destroy() {
        this.toolbar.removeEventListener('click', this.handleToolbarClick);
        this.formatHandlers.clear();
        this._handlers.undo = null;
        this._handlers.redo = null;
        this._handlers.formatSelected = null;
        this.toolbar.remove();
        this.toolbar = null;
        super.destroy();
    }
}