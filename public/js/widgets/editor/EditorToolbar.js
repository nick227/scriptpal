import { VALID_FORMATS, FORMAT_DISPLAY_NAMES } from '../../constants/formats.js';
import { BaseWidget } from '../BaseWidget.js';
import { ScriptImportWidget } from '../uploader/ScriptImportWidget.js';
import { StateManager } from '../../core/StateManager.js';
import { debugLog } from '../../core/logger.js';

/**
 *
 */
export class EditorToolbar extends BaseWidget {
    /**
     *
     * @param options
     */
    constructor (options = {}) {
        super();

        if (!options.container) {
            throw new Error('Container element is required for EditorToolbar');
        }
        if (!options.stateManager) {
            throw new Error('StateManager is required for EditorToolbar');
        }
        if (!options.pageManager) {
            throw new Error('PageManager is required for EditorToolbar');
        }

        this.container = options.container;
        this.stateManager = options.stateManager;
        this.appStateManager = options.appStateManager || null;
        this.pageManager = options.pageManager;
        this.editorArea = null;

        // Initialize formats using centralized constants
        this.formats = VALID_FORMATS;
        this.formatDisplayNames = FORMAT_DISPLAY_NAMES;

        // Initialize toolbar elements
        this.toolbar = null;
        this.formatButtons = new Map();
        this.pageCounter = null;
        this.currentPage = null;
        this.totalPages = null;
        this.undoButton = null;
        this.redoButton = null;
        this.saveButton = null;
        this.importButton = null;
        this.fileInput = null;
        this.chapterBreakCreateButton = null;
        this.pageBreakCreateButton = null;

        this.api = options.api || null;
        this.scriptStore = options.scriptStore || null;
        this.versions = [];
        this.currentVersionNumber = null;
        this.latestVersionNumber = null;
        this.versionDropdownSelect = null;
        this.versionDropdownLabel = null;
        this.versionPreviewBar = null;
        this.versionRestoreButton = null;
        this.versionCancelButton = null;

        // Initialize handlers
        this._handlers = {
            formatSelected: null,
            undo: null,
            redo: null,
            chapterBreakCreate: null,
            pageBreakCreate: null,
            save: null,
            import: null,
            versionPreviewRequested: null,
            versionRestoreRequested: null,
            versionPreviewCancelRequested: null
        };

        // Bind event handlers
        this._handleFormatClick = this.handleFormatClick.bind(this);
        this._handleUndoClick = this.handleUndoClick.bind(this);
        this._handleRedoClick = this.handleRedoClick.bind(this);
        this._handleSaveClick = this.handleSaveClick.bind(this);
        this._handleImportClick = this.handleImportClick.bind(this);
        this._handleFileSelect = this.handleFileSelect.bind(this);
        this._handleScroll = this.handleScroll.bind(this);
        this._handleChapterBreakCreateClick = this.handleChapterBreakCreateClick.bind(this);
        this._handlePageBreakCreateClick = this.handlePageBreakCreateClick.bind(this);
    }

    /**
     *
     * @param editorArea
     */
    setEditorArea (editorArea) {
        this.editorArea = editorArea;
    }

    /**
     *
     */
    validateElements () {
        try {
            if (!this.container || !(this.container instanceof HTMLElement)) {
                console.error('[EditorToolbar] Invalid container:', this.container);
                throw new Error('Valid DOM container element is required for EditorToolbar');
            }
        } catch (error) {
            console.error('[EditorToolbar] Element validation failed:', error);
            throw error;
        }
    }

    /**
     *
     */
    async initialize () {
        try {
            this.validateElements();

            // Use the container itself as the toolbar
            this.toolbar = this.container;
            if (!this.toolbar) {
                throw new Error('Editor toolbar element not found in container');
            }

            // Initialize all toolbar components in correct order
            this.createFormatButtons();
            // disable possible remove
            // this.createUndoRedoButtons();
            this.createVersionDropdown();
            this.createVersionPreviewBar();
            this.setEditorMode('edit');

            this.createPageNumButtons();

            this.setupEventListeners();

            // Set initial page count from state manager
            const pageCount = this.stateManager.getPageCount();
            if (pageCount > 0) {
                this.updatePageCount(pageCount);
            }

            return true;
        } catch (error) {
            console.error('[EditorToolbar] Initialization failed:', error);
            throw error;
        }
    }

    /**
     *
     * @param event
     */
    handleScroll (event) {
        // Add detailed logging
        const editorArea = event.target;
        debugLog('handleScroll triggered', {
            scrollTop: editorArea.scrollTop,
            scrollHeight: editorArea.scrollHeight,
            clientHeight: editorArea.clientHeight,
            target: event.target,
            currentTarget: event.currentTarget,
            hasPages: !!editorArea.querySelector('.editor-page')
        });

        // Calculate current page based on scroll position and page height
        const page = editorArea.querySelector('.editor-page');
        const pageHeight = page ? page.offsetHeight : editorArea.clientHeight;
        const currentPage = Math.floor(editorArea.scrollTop / pageHeight) + 1;

        this.updateCurrentPage(currentPage);
    }

    /**
     *
     * @param tagName
     * @param className
     * @param textContent
     */
    createElement (tagName, className, textContent = '') {
        const element = document.createElement(tagName);
        if (className) {
            element.className = className;
        }
        if (textContent) {
            element.textContent = textContent;
        }
        return element;
    }

    /**
     *
     */
    createChapterBreakCreateButton () {
        const chapterBreakCreateButton = this.createElement('button', 'format-button chapter-break-create-button');
        chapterBreakCreateButton.innerHTML = '<i class="fas fa-plus"></i>';
        chapterBreakCreateButton.title = 'Insert Chapter Break';
        this.chapterBreakCreateButton = chapterBreakCreateButton;
        this.toolbar.appendChild(chapterBreakCreateButton);

        // Create page break button
        const pageBreakCreateButton = this.createElement('button', 'format-button page-break-create-button');
        pageBreakCreateButton.innerHTML = '<i class="fas fa-file-alt"></i>';
        pageBreakCreateButton.title = 'Insert Page Break';
        this.pageBreakCreateButton = pageBreakCreateButton;
        this.toolbar.appendChild(pageBreakCreateButton);
    }

    /**
     *
     */
    createUndoRedoButtons () {
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

    createVersionDropdown () {
        const wrapper = this.createElement('div', 'toolbar-version-dropdown');
        this.versionDropdownLabel = this.createElement('span', 'version-dropdown-label', 'Version');
        const select = this.createElement('select', 'version-dropdown-select');
        select.title = 'Script version';
        select.disabled = true;
        wrapper.appendChild(this.versionDropdownLabel);
        wrapper.appendChild(select);
        this.toolbar.appendChild(wrapper);
        this.versionDropdownSelect = select;
        this._suppressVersionDropdownChange = false;
        select.addEventListener('change', () => {
            if (this._suppressVersionDropdownChange) return;
            const versionNumber = Number(select.value);
            if (Number.isNaN(versionNumber)) return;
            if (versionNumber === this.latestVersionNumber && this._handlers.versionPreviewCancelRequested) {
                this._handlers.versionPreviewCancelRequested();
                return;
            }
            if (versionNumber !== this.latestVersionNumber && this._handlers.versionPreviewRequested) {
                this._handlers.versionPreviewRequested({ versionNumber });
            }
        });
    }

    createVersionPreviewBar () {
        const bar = this.createElement('div', 'version-preview-bar');
        bar.hidden = true;
        const lockIcon = this.createElement('span', 'version-preview-bar__lock');
        lockIcon.setAttribute('aria-hidden', 'true');
        lockIcon.textContent = '\u{1F512}';
        lockIcon.title = 'View only';
        const line1 = this.createElement('p', 'version-preview-bar__line1');
        const line2 = this.createElement('p', 'version-preview-bar__line2');
        const actions = this.createElement('div', 'version-preview-bar__actions');
        const restoreBtn = this.createElement('button', 'format-button version-restore-button');
        restoreBtn.textContent = 'Make this the current version';
        restoreBtn.type = 'button';
        const cancelBtn = this.createElement('button', 'format-button version-cancel-button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.type = 'button';
        const hint = this.createElement('span', 'version-preview-bar__hint');
        hint.textContent = 'A new version will be created.';
        bar.appendChild(lockIcon);
        bar.appendChild(line1);
        bar.appendChild(line2);
        actions.appendChild(restoreBtn);
        actions.appendChild(cancelBtn);
        actions.appendChild(hint);
        bar.appendChild(actions);
        this.toolbar.appendChild(bar);
        this.versionPreviewBar = bar;
        this.versionPreviewBarLine1 = line1;
        this.versionPreviewBarLine2 = line2;
        this.versionRestoreButton = restoreBtn;
        this.versionCancelButton = cancelBtn;
        this.versionPreviewBar.hidden = true;
        // Bar buttons handled by handleToolbarClick (delegated); only active when in preview
    }

    /**
     * Create format buttons for the toolbar
     */
    createFormatButtons () {
        const container = this.createElement('div', 'format-buttons-container');

        // Create format buttons for each valid format
        if (this.formats && this.formatDisplayNames) {
            Object.entries(this.formats).forEach(([key, value]) => {
                const button = this.createElement('button', 'format-button format-option');
                button.dataset.format = value;
                button.textContent = this.formatDisplayNames[value] || key.toLowerCase();
                button.title = `Format as ${this.formatDisplayNames[value] || key.toLowerCase()}`;
                container.appendChild(button);

                // Store reference for easy access
                this.formatButtons.set(value, button);
            });
        } else {
            console.warn('[EditorToolbar] Format types not properly initialized');
        }

        this.toolbar.appendChild(container);
    }

    /**
     *
     */
    createPageNumButtons () {
        // Create a separator
        const separator = this.createElement('span', 'toolbar-separator');
        separator.textContent = '|';
        this.toolbar.appendChild(separator);

        // Create page counter container
        const pageCounter = this.createElement('div', 'page-counter');

        // Create current page display
        this.currentPage = this.createElement('span', 'current-page');
        this.currentPage.textContent = this.stateManager.getCurrentPage() || 1;

        // Create total pages display
        this.totalPages = this.createElement('span', 'total-pages');
        this.totalPages.textContent = this.stateManager.getPageCount() || 1;

        // Assemble the counter with format "Page X of Y"
        pageCounter.appendChild(document.createTextNode('Page '));
        pageCounter.appendChild(this.currentPage);
        pageCounter.appendChild(document.createTextNode(' of '));
        pageCounter.appendChild(this.totalPages);

        this.toolbar.appendChild(pageCounter);

        // Store references for updates
        this.pageCounter = {
            container: pageCounter,
            current: this.currentPage,
            total: this.totalPages
        };

        // Add some basic styling
        pageCounter.style.display = 'inline-block';
        pageCounter.style.margin = '0 10px';
        this.currentPage.style.fontWeight = 'bold';
        this.totalPages.style.fontWeight = 'bold';
    }

    /**
     *
     */
    setupEventListeners () {
        if (!this.toolbar) {
            console.error('[EditorToolbar] Toolbar not initialized');
            return;
        }

        // Add click handler for toolbar
        this.toolbar.addEventListener('click', this.handleToolbarClick.bind(this));

        // Add file input change handler
        if (this.fileInput) {
            this.fileInput.addEventListener('change', this._handleFileSelect);
        }
    }

    /**
     *
     * @param format
     */
    handleFormatClick (format) {
        if (typeof this._handlers.formatSelected === 'function') {
            this._handlers.formatSelected(format);
            // Update active format button
            this.updateActiveFormat(format);
        } else {
            console.warn('[EditorToolbar] Format handler not set');
        }
    }

    /**
     *
     */
    handleUndoClick () {
        if (this._handlers.undo) {
            this._handlers.undo();
            this.updateHistoryState(
                this.stateManager.getState('canUndo'),
                this.stateManager.getState('canRedo')
            );
        }
    }

    /**
     *
     */
    handleRedoClick () {
        if (this._handlers.redo) {
            this._handlers.redo();
            this.updateHistoryState(
                this.stateManager.getState('canUndo'),
                this.stateManager.getState('canRedo')
            );
        }
    }

    /**
     *
     */
    handleSaveClick () {
        if (this._handlers.save) {
            this.setSaveState('saving');
            this._handlers.save().finally(() => {
                this.setSaveState('saved');
                setTimeout(() => this.setSaveState('idle'), 200);
            });
        }
    }

    /**
     *
     */
    handleImportClick () {
        this.fileInput.click();
    }

    /**
     *
     * @param event
     */
    handleFileSelect (event) {
        const file = event.target.files[0];
        if (!file) return;

        // Create uploader widget with EditorContent reference
        const uploader = new ScriptImportWidget({
            container: this.container,
            pageManager: this.pageManager,
            editorContent: this.editorContent
        });

        uploader.handleFile(file);
    }

    /**
     *
     * @param e
     */
    handleToolbarClick (e) {
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
        } else if (button.classList.contains('chapter-break-create-button')) {
            this._handleChapterBreakCreateClick();
        } else if (button.classList.contains('page-break-create-button')) {
            this._handlePageBreakCreateClick();
        } else if (button.classList.contains('version-restore-button')) {
            e.preventDefault();
            e.stopPropagation();
            const modeSource = this.appStateManager || this.stateManager;
            if (modeSource?.getState(StateManager.KEYS.EDITOR_MODE) !== 'version-preview') return;
            if (this._handlers.versionRestoreRequested) this._handlers.versionRestoreRequested();
        } else if (button.classList.contains('version-cancel-button')) {
            e.preventDefault();
            e.stopPropagation();
            const modeSource = this.appStateManager || this.stateManager;
            if (modeSource?.getState(StateManager.KEYS.EDITOR_MODE) !== 'version-preview') return;
            if (this._handlers.versionPreviewCancelRequested) this._handlers.versionPreviewCancelRequested();
        } else if (button.dataset.format) {
            this._handleFormatClick(button.dataset.format);
        }
    }

    setVersions (versions = []) {
        this.versions = versions;
        this.latestVersionNumber = versions[0]?.versionNumber ?? null;
        if (!this.versionDropdownSelect) return;
        this.versionDropdownSelect.innerHTML = '';
        versions.forEach((v, i) => {
            const opt = document.createElement('option');
            opt.value = String(v.versionNumber);
            const dateStr = v.createdAt ? new Date(v.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
            const currentLabel = i === 0 ? ' (Current)' : '';
            opt.textContent = `v${v.versionNumber}${dateStr ? ` – ${dateStr}` : ''}${currentLabel}`;
            this.versionDropdownSelect.appendChild(opt);
        });
        if (this.currentVersionNumber != null) {
            this._suppressVersionDropdownChange = true;
            this.versionDropdownSelect.value = String(this.currentVersionNumber);
            this._suppressVersionDropdownChange = false;
        }
        this.versionDropdownLabel.textContent = this.currentVersionNumber != null ? `v${this.currentVersionNumber} ▾` : 'Version';
        const modeSource = this.appStateManager || this.stateManager;
        const inPreview = modeSource?.getState(StateManager.KEYS.EDITOR_MODE) === 'version-preview';
        this.versionDropdownSelect.disabled = versions.length === 0 || inPreview;
    }

    setCurrentVersion (versionNumber) {
        this.currentVersionNumber = versionNumber;
        if (this.versionDropdownLabel) {
            this.versionDropdownLabel.textContent = versionNumber != null ? `v${versionNumber} ▾` : 'Version';
        }
        if (this.versionDropdownSelect && this.versions.length > 0) {
            this._suppressVersionDropdownChange = true;
            this.versionDropdownSelect.value = String(versionNumber ?? this.latestVersionNumber ?? '');
            this._suppressVersionDropdownChange = false;
        }
    }

    setEditorMode (mode, previewVersionNumber = null) {
        const isPreview = mode === 'version-preview';
        if (this.versionPreviewBar) {
            this.versionPreviewBar.hidden = !isPreview;
            if (isPreview && previewVersionNumber != null && this.versionPreviewBarLine1) {
                this.versionPreviewBarLine1.textContent = `You are viewing version ${previewVersionNumber}.`;
                if (this.versionPreviewBarLine2) {
                    this.versionPreviewBarLine2.textContent = 'Make this the current version, or Cancel to return to the latest.';
                }
            }
        }
        if (this.versionDropdownSelect) {
            this.versionDropdownSelect.disabled = isPreview;
        }
        if (this.saveButton) {
            this.saveButton.disabled = isPreview;
            this.saveButton.title = isPreview ? 'Restore this version to edit and save.' : 'Save Script (Ctrl+S)';
        }
        if (this.formatButtons && this.formatButtons.size) {
            this.formatButtons.forEach((btn) => { btn.disabled = isPreview; });
        }
    }

    setRestoreLoading (loading) {
        if (this.versionRestoreButton) {
            this.versionRestoreButton.disabled = loading;
            this.versionRestoreButton.textContent = loading ? 'Restoring…' : 'Make this the current version';
        }
        if (this.versionCancelButton) {
            this.versionCancelButton.disabled = loading;
        }
    }

    onVersionPreviewRequested (callback) {
        this._handlers.versionPreviewRequested = typeof callback === 'function' ? callback : null;
    }

    onVersionRestoreRequested (callback) {
        this._handlers.versionRestoreRequested = typeof callback === 'function' ? callback : null;
    }

    onVersionPreviewCancelRequested (callback) {
        this._handlers.versionPreviewCancelRequested = typeof callback === 'function' ? callback : null;
    }

    /**
     *
     * @param callback
     */
    onFormatSelected (callback) {
        if (typeof callback !== 'function') {
            console.warn('[EditorToolbar] Invalid format callback provided');
            return;
        }
        this._handlers.formatSelected = callback;
    }

    /**
     *
     * @param callback
     */
    onUndo (callback) {
        this._handlers.undo = callback;
    }

    /**
     *
     * @param callback
     */
    onRedo (callback) {
        this._handlers.redo = callback;
    }

    /**
     *
     * @param callback
     */
    onSave (callback) {
        this._handlers.save = callback;
    }

    /**
     *
     * @param callback
     */
    onImport (callback) {
        this._handlers.import = callback;
    }

    /**
     * Update active format button
     * @param {string} format - The active format
     */
    updateActiveFormat (format) {
        // Update format option buttons
        const formatOptions = this.toolbar.querySelectorAll('.format-option');
        formatOptions.forEach(button => {
            if (button.dataset.format) {
                button.classList.toggle('active', button.dataset.format === format);
            }
        });
    }

    /**
     *
     * @param canUndo
     * @param canRedo
     */
    updateHistoryState (canUndo, canRedo) {
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

    /**
     *
     * @param pageCount
     */
    updatePageCount (pageCount) {
        if (!this.pageCounter) return;

        // Ensure we don't display 0 pages
        const totalPages = Math.max(1, pageCount);
        this.pageCounter.total.textContent = totalPages;

        // Get current page from state manager, ensure it's not greater than total
        const currentPage = Math.min(this.stateManager.getCurrentPage() || 1, totalPages);
        this.pageCounter.current.textContent = currentPage;

        // Ensure the container is visible
        this.pageCounter.container.style.display = 'inline-block';
    }

    // Update the current page without changing total
    /**
     *
     * @param currentPage
     */
    updateCurrentPage (currentPage) {
        if (!this.pageCounter) return;
        this.pageCounter.current.textContent = currentPage;
    }

    /**
     *
     * @param callback
     */
    onChapterBreakCreate (callback) {
        this._handlers.chapterBreakCreate = callback;
    }

    /**
     *
     * @param callback
     */
    onPageBreakCreate (callback) {
        this._handlers.pageBreakCreate = callback;
    }

    /**
     *
     */
    notifyChapterBreakCreate () {
        if (this._handlers.chapterBreakCreate) {
            this._handlers.chapterBreakCreate();
        }
    }

    /**
     *
     */
    notifyPageBreakCreate () {
        if (this._handlers.pageBreakCreate) {
            this._handlers.pageBreakCreate();
        }
    }

    /**
     *
     * @param state
     */
    setSaveState (state) {
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
            case 'dirty':
                this.saveButton.classList.add('dirty');
                break;
            case 'error':
                this.saveButton.classList.add('error');
                break;
            case 'idle':
            default:
                // no-op
                break;
        }
    }

    /**
     *
     */
    handleChapterBreakCreateClick () {
        if (this._handlers.chapterBreakCreate) {
            this._handlers.chapterBreakCreate();
        }
    }

    /**
     *
     */
    handlePageBreakCreateClick () {
        if (this._handlers.pageBreakCreate) {
            this._handlers.pageBreakCreate();
        }
    }

    /**
     *
     */
    destroy () {
        try {
            if (this.toolbarContainer && this.container && this.container.contains(this.toolbarContainer)) {
                this.container.removeChild(this.toolbarContainer);
            }

            if (this.toolbar) {
                this.toolbar.removeEventListener('click', this.handleToolbarClick);
            }

            if (this.fileInput) {
                this.fileInput.removeEventListener('change', this._handleFileSelect);
            }

            if (this.formatHandlers) {
                this.formatHandlers.clear();
            }

            if (this._handlers) {
                this._handlers.undo = null;
                this._handlers.redo = null;
                this._handlers.formatSelected = null;
                this._handlers.import = null;
            }

            this.toolbar = null;
            this.formatHandlers = null;
            this._handlers = null;

            super.destroy();
        } catch (error) {
            console.error('[EditorToolbar] Error during destroy:', error);
        }
    }

    // ==============================================
    // Minimap Functionality (consolidated from Minimap.js)
    // ==============================================

    /**
     * Initialize minimap functionality
     * @param minimapContainer
     * @param content
     */
    initializeMinimap (minimapContainer, content) {
        if (!minimapContainer) {
            throw new Error('Minimap container is required');
        }
        if (!content) {
            throw new Error('Content is required');
        }

        this.minimapContainer = minimapContainer;
        this.minimapContent = content;
        this.minimapViewport = null;
        this.minimapScale = 0.2;
        this.minimapEventHandlers = new Map();
    }

    /**
     * Create and initialize minimap
     */
    async createMinimap () {
        try {
            // Create viewport element
            this.minimapViewport = document.createElement('div');
            this.minimapViewport.className = 'minimap-viewport';
            this.minimapContainer.appendChild(this.minimapViewport);

            // Set up event listeners
            this.setupMinimapEventListeners();
            return true;
        } catch (error) {
            console.error('Minimap initialization failed:', error);
            throw error;
        }
    }

    /**
     * Setup minimap event listeners
     */
    setupMinimapEventListeners () {
        // Handle viewport drag
        let isDragging = false;
        let startY = 0;

        this.minimapViewport.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY - this.minimapViewport.offsetTop;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const newTop = e.clientY - startY;
            const maxTop = this.minimapContainer.offsetHeight - this.minimapViewport.offsetHeight;
            this.minimapViewport.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';

            this.updateMinimapPosition();
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Handle minimap click
        this.minimapContainer.addEventListener('click', (e) => {
            if (e.target === this.minimapViewport) return;

            const rect = this.minimapContainer.getBoundingClientRect();
            const clickY = e.clientY - rect.top;
            const percentage = clickY / rect.height;

            this.scrollToPercentage(percentage);
        });
    }

    /**
     * Update minimap position based on scroll
     */
    updateMinimapPosition () {
        if (!this.minimapViewport || !this.minimapContent) return;

        const { scrollHeight: contentHeight, clientHeight: viewportHeight, scrollTop } = this.minimapContent;
        const { offsetHeight: minimapHeight } = this.minimapContainer;

        const percentage = scrollTop / (contentHeight - viewportHeight);
        const viewportHeight_px = minimapHeight * (viewportHeight / contentHeight);

        this.minimapViewport.style.height = viewportHeight_px + 'px';
        this.minimapViewport.style.top = (percentage * (minimapHeight - viewportHeight_px)) + 'px';
    }

    /**
     * Scroll to percentage position
     * @param percentage
     */
    scrollToPercentage (percentage) {
        if (!this.minimapContent) return;

        const contentHeight = this.minimapContent.scrollHeight;
        const viewportHeight = this.minimapContent.clientHeight;
        const targetScroll = percentage * (contentHeight - viewportHeight);

        this.minimapContent.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
        });
    }

    // ==============================================
    // Autocomplete Functionality (consolidated from Autocomplete.js)
    // ==============================================

    /**
     * Initialize autocomplete functionality
     */
    initializeAutocomplete () {
        this.autocompleteSupportedFormats = ['speaker', 'header'];
        this.autocompleteCurrentSuggestion = null;
        this.autocompleteLastSuggestionLine = null;
        this.autocompleteDebounceTimeout = null;
        this.autocompleteDebounceDelay = 150;

        // Static suggestions data
        this.autocompleteSuggestions = {
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

        // Cache settings
        this.autocompleteMaxCacheSize = 1000;
        this.autocompleteCacheTTL = 60000;
        this.autocompleteMatchCache = new Map();
        this.autocompleteCacheTimestamps = new Map();
        this.autocompleteFormatLinesCache = new Map();
    }

    /**
     * Handle autocomplete for keyup events
     * @param event
     */
    handleAutocompleteKeyup (event) {
        if (this.autocompleteDebounceTimeout) {
            clearTimeout(this.autocompleteDebounceTimeout);
        }

        this.autocompleteDebounceTimeout = setTimeout(() => {
            this.processAutocomplete(event);
        }, this.autocompleteDebounceDelay);
    }

    /**
     * Process autocomplete suggestions
     * @param event
     */
    processAutocomplete (event) {
        const { target } = event;
        const line = target.closest('.script-line');
        if (!line) return;

        const { format } = line.dataset;
        if (!Array.isArray(this.autocompleteSupportedFormats)) {
            return;
        }
        if (!this.autocompleteSupportedFormats.includes(format)) return;

        const text = line.textContent.trim();
        if (text.length < 2) return;

        const suggestions = this.getAutocompleteSuggestions(format, text);
        if (suggestions.length > 0) {
            this.showAutocompleteSuggestion(line, suggestions[0]);
        }
    }

    /**
     * Get autocomplete suggestions
     * @param format
     * @param text
     */
    getAutocompleteSuggestions (format, text) {
        const cacheKey = `${format}:${text}`;
        const now = Date.now();

        // Check cache
        if (this.autocompleteMatchCache.has(cacheKey)) {
            const timestamp = this.autocompleteCacheTimestamps.get(cacheKey);
            if (now - timestamp < this.autocompleteCacheTTL) {
                return this.autocompleteMatchCache.get(cacheKey);
            }
        }

        const suggestions = this.autocompleteSuggestions[format] || {};
        const matches = Object.keys(suggestions).filter(key =>
            key.toLowerCase().startsWith(text.toLowerCase())
        );

        // Cache result
        if (this.autocompleteMatchCache.size >= this.autocompleteMaxCacheSize) {
            this.clearAutocompleteCache();
        }
        this.autocompleteMatchCache.set(cacheKey, matches);
        this.autocompleteCacheTimestamps.set(cacheKey, now);

        return matches;
    }

    /**
     * Show autocomplete suggestion
     * @param line
     * @param suggestion
     */
    showAutocompleteSuggestion (line, suggestion) {
        if (this.autocompleteCurrentSuggestion) {
            this.hideAutocompleteSuggestion();
        }

        this.autocompleteCurrentSuggestion = {
            line,
            suggestion,
            element: this.createSuggestionElement(suggestion)
        };

        line.appendChild(this.autocompleteCurrentSuggestion.element);
    }

    /**
     * Create suggestion element
     * @param suggestion
     */
    createSuggestionElement (suggestion) {
        const element = document.createElement('div');
        element.className = 'autocomplete-suggestion';
        element.textContent = suggestion;
        element.style.cssText = `
            position: absolute;
            background: #f0f0f0;
            border: 1px solid #ccc;
            padding: 2px 6px;
            font-size: 12px;
            color: #666;
            z-index: 1000;
        `;
        return element;
    }

    /**
     * Hide autocomplete suggestion
     */
    hideAutocompleteSuggestion () {
        if (this.autocompleteCurrentSuggestion) {
            if (this.autocompleteCurrentSuggestion.element.parentNode) {
                this.autocompleteCurrentSuggestion.element.parentNode.removeChild(
                    this.autocompleteCurrentSuggestion.element
                );
            }
            this.autocompleteCurrentSuggestion = null;
        }
    }

    /**
     * Clear autocomplete cache
     */
    clearAutocompleteCache () {
        this.autocompleteMatchCache.clear();
        this.autocompleteCacheTimestamps.clear();
        this.autocompleteFormatLinesCache.clear();
    }

    // ==============================================
    // Format FSM Functionality (consolidated from formatFSM.js)
    // ==============================================

    /**
     * Initialize format state machine
     */
    initializeFormatFSM () {
        this.formatCurrentState = this.formats.ACTION;
        this.formatPreviousState = null;
        this.formatStateHistory = [];
        this.formatMaxHistorySize = 10;

        // State transition rules
        this.formatTransitions = new Map([
            [this.formats.HEADER, {
                enter: this.formats.ACTION,
                left: this.formats.ACTION,
                right: this.formats.ACTION,
                manual: [this.formats.ACTION, this.formats.SPEAKER, this.formats.DIALOG]
            }],
            [this.formats.ACTION, {
                enter: this.formats.SPEAKER,
                left: this.formats.HEADER,
                right: this.formats.SPEAKER,
                manual: [this.formats.HEADER, this.formats.SPEAKER, this.formats.DIALOG, this.formats.DIRECTIONS]
            }],
            [this.formats.SPEAKER, {
                enter: this.formats.DIALOG,
                left: this.formats.ACTION,
                right: this.formats.DIALOG,
                manual: [this.formats.ACTION, this.formats.DIALOG, this.formats.DIRECTIONS]
            }],
            [this.formats.DIALOG, {
                enter: this.formats.SPEAKER,
                left: this.formats.SPEAKER,
                right: this.formats.SPEAKER,
                manual: [this.formats.SPEAKER, this.formats.ACTION, this.formats.DIRECTIONS]
            }],
            [this.formats.DIRECTIONS, {
                enter: this.formats.DIALOG,
                left: this.formats.SPEAKER,
                right: this.formats.DIALOG,
                manual: [this.formats.SPEAKER, this.formats.DIALOG, this.formats.ACTION]
            }]
        ]);
    }

    /**
     * Get next format based on current state and action
     * @param action
     */
    getNextFormatState (action) {
        const currentTransitions = this.formatTransitions.get(this.formatCurrentState);
        if (!currentTransitions) {
            return this.formatCurrentState;
        }

        const nextState = currentTransitions[action];
        if (nextState) {
            this.formatPreviousState = this.formatCurrentState;
            this.formatCurrentState = nextState;
            this.addToStateHistory(this.formatCurrentState);
            return this.formatCurrentState;
        }

        return this.formatCurrentState;
    }

    /**
     * Add state to history
     * @param state
     */
    addToStateHistory (state) {
        this.formatStateHistory.push(state);
        if (this.formatStateHistory.length > this.formatMaxHistorySize) {
            this.formatStateHistory.shift();
        }
    }

    /**
     * Get format state history
     */
    getFormatStateHistory () {
        return [...this.formatStateHistory];
    }

}
