import { BaseWidget } from '../BaseWidget.js';
import { EditorToolbar } from './EditorToolbar.js';
import { EditorContent } from './EditorContent.js';
import { EditorHistory } from './EditorHistory.js';
import { EditorAutosave } from './EditorAutosave.js';
import { Minimap } from './Minimap.js';
import { ChapterManager } from './ChapterManager.js';
import { AICommandManager } from './AICommandManager.js';
import { EditorStateManager } from './EditorStateManager.js';

export class EditorWidget extends BaseWidget {
    constructor(elements) {
        if (!elements || !elements.editorContainer) {
            throw new Error('Editor container element is required');
        }
        super(elements);
        this.requiredElements = ['editorContainer'];

        // Core dependencies
        this.api = null;
        this.user = null;
        this.script = null;

        // Initialize state manager
        this.state = new EditorStateManager();

        // Component instances
        this.toolbar = null;
        this.content = null;
        this.history = null;
        this.autosave = null;
        this.minimap = null;
        this.chapterManager = null;
        this.aiCommandManager = null;

        // Component dependencies
        this.dependencies = {
            toolbar: ['editorContainer'],
            content: ['editorContainer'],
            history: [],
            autosave: ['script'],
            minimap: ['minimapContainer'],
            chapterManager: [],
            aiCommandManager: []
        };
    }

    validateElements() {
        super.validateElements();
        if (!this.elements.editorContainer) {
            throw new Error('Editor container element is required');
        }
        // Make minimap optional
        this.hasMinimapSupport = Boolean(this.elements.minimapContainer);
    }

    async initialize(api, user, script) {
        try {
            // 1. Validate core dependencies
            if (!api) throw new Error('API instance is required');
            this.validateElements();

            // 2. Set core dependencies
            this.api = api;
            this.user = user;
            this.script = script;

            // 3. Initialize state
            this.state.setReady(false);
            await super.initialize();

            // 4. Initialize components in dependency order
            await this.initializeComponents();

            // 5. Set up relationships after all components are initialized
            await this.setupComponentRelationships();

            // 6. Load content last
            await this.loadInitialContent();

            // 7. Mark as ready
            this.state.setReady(true);
            return true;

        } catch (error) {
            console.error('Failed to initialize editor:', error);
            this.state.setState('error', error);
            throw new Error(`Editor initialization failed: ${error.message}`);
        }
    }

    async initializeComponents() {
        try {
            // Track initialization status
            const initStatus = new Map();

            // 1. Core state managers (no UI dependencies)
            await this.initializeStateManagers()
                .then(() => initStatus.set('stateManagers', true))
                .catch(error => {
                    initStatus.set('stateManagers', false);
                    throw error;
                });

            // 2. UI Components (require DOM)
            await this.initializeUIComponents()
                .then(() => initStatus.set('uiComponents', true))
                .catch(error => {
                    initStatus.set('uiComponents', false);
                    throw error;
                });

            // 3. Optional UI Components
            await this.initializeOptionalComponents()
                .then(() => initStatus.set('optionalComponents', true))
                .catch(error => {
                    console.warn('Optional components failed:', error);
                    initStatus.set('optionalComponents', false);
                });

            // 4. Data-dependent components
            await this.initializeDataComponents()
                .then(() => initStatus.set('dataComponents', true))
                .catch(error => {
                    console.warn('Data components failed:', error);
                    initStatus.set('dataComponents', false);
                });

            // Validate critical components
            if (!initStatus.get('stateManagers') || !initStatus.get('uiComponents')) {
                throw new Error('Critical components failed to initialize');
            }

            // 5. Set up component relationships
            await this.setupComponentDependencies();

            return true;
        } catch (error) {
            console.error('Failed to initialize editor components:', error);
            throw error;
        }
    }

    async initializeStateManagers() {
        const stateManagers = [
            { instance: new EditorHistory(this.state), key: 'history' },
            { instance: new ChapterManager(this.state), key: 'chapterManager' },
            { instance: new AICommandManager(this.state), key: 'aiCommandManager' }
        ];

        await Promise.all(stateManagers.map(async({ instance, key }) => {
            try {
                await instance.initialize();
                this[key] = instance;
            } catch (error) {
                throw new Error(`Failed to initialize ${key}: ${error.message}`);
            }
        }));
    }

    async initializeUIComponents() {
        try {
            // Initialize core UI components with state manager
            this.toolbar = new EditorToolbar({
                editorContainer: this.elements.editorContainer,
                stateManager: this.state
            });
            this.content = new EditorContent({
                editorContainer: this.elements.editorContainer,
                stateManager: this.state
            });

            // Initialize in parallel
            await Promise.all([
                this.toolbar.initialize().catch(error => {
                    throw new Error(`Failed to initialize toolbar: ${error.message}`);
                }),
                this.content.initialize().catch(error => {
                    throw new Error(`Failed to initialize content: ${error.message}`);
                })
            ]);
        } catch (error) {
            throw new Error(`Failed to initialize UI components: ${error.message}`);
        }
    }

    async initializeOptionalComponents() {
        if (this.hasMinimapSupport) {
            try {
                this.minimap = new Minimap({
                    minimapContainer: this.elements.minimapContainer
                });
                await this.minimap.initialize();
            } catch (error) {
                console.warn('Failed to initialize minimap:', error);
                this.minimap = null;
                this.hasMinimapSupport = false;
            }
        }
    }

    async initializeDataComponents() {
        if (this.script) {
            try {
                this.autosave = new EditorAutosave(this.script);
                await this.autosave.initialize();
            } catch (error) {
                console.warn('Failed to initialize autosave:', error);
                this.autosave = null;
            }
        }
    }

    setupComponentDependencies() {
        if (!this.content || !this.aiCommandManager) {
            throw new Error('Required components not initialized');
        }

        this.aiCommandManager.setContent(this.content);
        if (this.chapterManager) {
            this.aiCommandManager.setChapterManager(this.chapterManager);
        }
    }

    async setupComponentRelationships() {
        const relationships = [{
                name: 'content',
                required: true,
                setup: async() => {
                    if (!this.content) throw new Error('Content component not initialized');
                    await this.setupContentHandling();
                }
            },
            {
                name: 'toolbar',
                required: true,
                setup: async() => {
                    if (!this.toolbar) throw new Error('Toolbar component not initialized');
                    await this.setupToolbarHandling();
                }
            },
            {
                name: 'history',
                required: true,
                setup: async() => {
                    if (!this.history) throw new Error('History component not initialized');
                    await this.setupHistoryHandling();
                }
            },
            {
                name: 'minimap',
                required: false,
                setup: async() => {
                    if (this.hasMinimapSupport && this.minimap) {
                        await this.setupMinimapHandling();
                    }
                }
            },
            {
                name: 'chapters',
                required: false,
                setup: async() => {
                    if (this.chapterManager) {
                        await this.setupChapterHandling();
                    }
                }
            }
        ];

        try {
            // Setup required relationships first
            for (const rel of relationships.filter(r => r.required)) {
                try {
                    await rel.setup();
                } catch (error) {
                    throw new Error(`Failed to setup required ${rel.name} relationship: ${error.message}`);
                }
            }

            // Setup optional relationships
            for (const rel of relationships.filter(r => !r.required)) {
                try {
                    await rel.setup();
                } catch (error) {
                    console.warn(`Failed to setup optional ${rel.name} relationship:`, error);
                }
            }

        } catch (error) {
            console.error('Failed to setup component relationships:', error);
            throw error;
        }
    }

    setupContentHandling() {
        let saveTimeout = null;
        const SAVE_DELAY = 1000;

        // Handle content changes
        this.content.onChange((content) => {
            if (saveTimeout) clearTimeout(saveTimeout);

            // Update state
            this.state.setContent(content);
            this.state.setPageCount(this.content.pageManager.getPageCount());

            // Save state immediately
            const currentState = this.state.getCurrentState();
            this.history.saveState(currentState);

            // Debounce autosave
            if (this.autosave) {
                saveTimeout = setTimeout(() => {
                    this.autosave.triggerAutosave(content);
                }, SAVE_DELAY);
            }
        });

        // Handle format changes
        this.content.onFormatChange((format) => {
            this.state.setCurrentFormat(format);
            this.toolbar.updateActiveFormat(format);
        });

        // Handle page changes
        this.content.onPageChange((pageCount) => {
            this.state.setPageCount(pageCount);
            this.toolbar.updatePageCount(pageCount);
            if (this.minimap) {
                this.minimap.updateViewport(this.content.getCurrentPage(), pageCount);
            }
        });
    }

    setupToolbarHandling() {
        if (!this.toolbar || !this.content) {
            throw new Error('Toolbar and Content components must be initialized');
        }

        // Format selection with validation
        this.toolbar.onFormatSelected((format) => {
            if (!this.content) return;
            this.content.setLineFormat(format);
        });

        // History operations with state validation
        const historyOperations = {
            undo: () => {
                const state = this.history.undo();
                if (state && this.validateState(state)) {
                    this.applyState(state);
                }
            },
            redo: () => {
                const state = this.history.redo();
                if (state && this.validateState(state)) {
                    this.applyState(state);
                }
            }
        };

        // Set up history operations
        Object.entries(historyOperations).forEach(([operation, handler]) => {
            this.toolbar[`on${operation.charAt(0).toUpperCase() + operation.slice(1)}`](handler);
            this.content[`on${operation.charAt(0).toUpperCase() + operation.slice(1)}`](handler);
        });
    }

    validateState(state) {
        if (!state) return false;

        // Validate required state properties
        const requiredProps = ['content', 'pageCount', 'currentFormat', 'currentPage'];
        const hasAllProps = requiredProps.every(prop => state.hasOwnProperty(prop));
        if (!hasAllProps) return false;

        // Validate content
        if (typeof state.content !== 'string') return false;

        // Validate numeric properties
        if (!Number.isInteger(state.pageCount) || state.pageCount < 0) return false;
        if (!Number.isInteger(state.currentPage) || state.currentPage < 0) return false;

        // Validate format
        if (!this.content || !this.content.lineFormatter.isValidFormat(state.currentFormat)) {
            return false;
        }

        return true;
    }

    applyState(state) {
        try {
            // Batch DOM updates
            requestAnimationFrame(() => {
                this.content.setContent(state.content);
                this.toolbar.updatePageCount(state.pageCount);
                this.state.setHistoryState(
                    this.history.canUndo(),
                    this.history.canRedo()
                );

                if (this.hasMinimapSupport && this.minimap) {
                    this.minimap.updateViewport(this.content.getCurrentPage(), state.pageCount);
                }
            });
        } catch (error) {
            console.error('Failed to apply editor state:', error);
            this.state.setState('error', error);
        }
    }

    getCurrentState() {
        return {
            content: this.state.getContent(),
            pageCount: this.state.getPageCount(),
            currentFormat: this.state.getCurrentFormat(),
            currentPage: this.state.getCurrentPage(),
            timestamp: Date.now()
        };
    }

    setupHistoryHandling() {
        this.history.onStateChange(() => {
            this.toolbar.updateHistoryState(
                this.history.canUndo(),
                this.history.canRedo()
            );
        });
    }

    setupMinimapHandling() {
        // Skip minimap setup if not available
        if (!this.hasMinimapSupport || !this.minimap) return;

        // Handle page selection from minimap
        this.minimap.onPageSelect((pageNumber) => {
            this.content.scrollToPage(pageNumber);
        });

        // Handle chapter selection from minimap
        this.minimap.onChapterSelect((chapter) => {
            this.content.scrollToPage(chapter.pageNumber);
        });
    }

    setupChapterHandling() {
        // Update minimap when chapters change
        this.chapterManager.onChapterChange((chapters) => {
            if (this.hasMinimapSupport) {
                this.minimap.updateChapters(chapters);
            }
        });

        // Handle chapter creation from toolbar
        this.toolbar.onChapterCreate((title) => {
            const currentPage = this.content.getCurrentPage();
            this.chapterManager.createChapter(title, currentPage);
        });

        // Handle sub-chapter creation from toolbar
        this.toolbar.onSubChapterCreate((title) => {
            const currentPage = this.content.getCurrentPage();
            const currentChapter = this.chapterManager.getChapterAtPage(currentPage);
            if (currentChapter) {
                this.chapterManager.createSubChapter(currentChapter.id, title, currentPage);
            }
        });
    }

    loadInitialContent() {
        if (!this.script || typeof this.script.getContent !== 'function') {
            console.warn('Script or getContent method not available');
            return;
        }

        const content = this.script.getContent();
        if (!content) {
            console.debug('No initial content to load');
            return;
        }

        // Use requestAnimationFrame for DOM updates
        requestAnimationFrame(() => {
            try {
                if (!this.content) {
                    throw new Error('Editor content component not initialized');
                }

                this.content.setContent(content);

                if (this.autosave) {
                    this.autosave.setLastSavedContent(content);
                }

                this.state.setContent(content);
                this.state.markDirty(false);
            } catch (error) {
                console.error('Failed to load initial content:', error);
                this.state.setState('error', error);
            }
        });
    }

    // Add AI command execution method
    async executeAICommand(command) {
        if (!this.aiCommandManager) {
            throw new Error('AI Command Manager not initialized');
        }
        return this.aiCommandManager.executeCommand(command);
    }

    destroy() {
        // Destroy components in reverse initialization order
        const components = [
            this.autosave,
            this.minimap,
            this.content,
            this.toolbar,
            this.history,
            this.chapterManager,
            this.aiCommandManager
        ];
        components.filter(Boolean).forEach(component => component.destroy());

        // Clear state
        this.state.reset();

        // Clear references
        this.toolbar = null;
        this.content = null;
        this.history = null;
        this.autosave = null;
        this.minimap = null;
        this.chapterManager = null;
        this.aiCommandManager = null;
        this.api = null;
        this.user = null;
        this.script = null;

        super.destroy();
    }
}