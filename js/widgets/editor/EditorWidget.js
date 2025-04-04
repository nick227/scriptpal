import { BaseWidget } from '../BaseWidget.js';
import { EditorToolbar } from './EditorToolbar.js';
import { EditorContent } from './EditorContent.js';
import { EditorHistory } from './EditorHistory.js';
import { EditorAutosave } from './EditorAutosave.js';
import { Minimap } from './Minimap.js';
import { ChapterManager } from './ChapterManager.js';
import { AICommandManager } from './AICommandManager.js';
import { EditorStateManager } from './EditorStateManager.js';
import { StateManager } from '../../core/StateManager.js';

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

            // 6. Subscribe to script changes
            // TODO: Uncomment this when we have a script manager
            //this.subscribeToScriptChanges();

            // 7. Load content last
            await this.loadInitialContent();

            // 8. Mark as ready
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
            // Creates EditorContent first
            this.content = new EditorContent({
                editorContainer: this.elements.editorContainer,
                stateManager: this.state
            });

            // Creates EditorToolbar and passes EditorContent
            this.toolbar = new EditorToolbar({
                editorContainer: this.elements.editorContainer,
                stateManager: this.state,
                editorContent: this.content // Passes the EditorContent instance
            });

            // Initializes both in parallel
            await Promise.all([
                this.toolbar.initialize(),
                this.content.initialize()
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
                // Get the actual script data from the script manager's state
                const currentScript = this.script.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);

                if (!currentScript) {
                    console.warn('No current script data available for autosave');
                    return;
                }

                // Validate script manager has required methods
                if (typeof this.script.saveContent !== 'function') {
                    console.error('Script manager missing saveContent method');
                    return;
                }

                // Create autosave with content manager and toolbar
                this.autosave = new EditorAutosave(this.content.contentManager, this.toolbar);
                await this.autosave.initialize(this.script);

            } catch (error) {
                console.error('Failed to initialize autosave:', error);
                this.autosave = null;
            }
        } else {
            console.warn('No script provided for autosave initialization');
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
        if (!this.content) {
            throw new Error('Content component not initialized');
        }

        // Handle content changes
        this.content.onChange((content) => {
            // Update state
            this.state.setContent(content);
            this.state.setPageCount(this.content.pageManager.getPageCount());

            // Save state immediately for history
            const currentState = this.state.getCurrentState();
            this.history.saveState(currentState);
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

        // Handle undo/redo using EditorContent event types
        this.content.on(EditorContent.EVENTS.UNDO, () => {
            const state = this.history.undo();
            if (state && this.validateState(state)) {
                this.applyState(state);
            }
        });

        this.content.on(EditorContent.EVENTS.REDO, () => {
            const state = this.history.redo();
            if (state && this.validateState(state)) {
                this.applyState(state);
            }
        });
    }

    setupToolbarHandling() {
        if (!this.toolbar || !this.content) {
            console.warn('Cannot setup toolbar handling - missing toolbar or content');
            return;
        }

        // Handle format selection
        this.toolbar.onFormatSelected((format) => {
            this.content.setLineFormat(format);
        });

        // Handle undo/redo
        this.toolbar.onUndo(() => {
            this.content.emit(EditorContent.EVENTS.UNDO);
        });

        this.toolbar.onRedo(() => {
            this.content.emit(EditorContent.EVENTS.REDO);
        });

        // Handle save
        this.toolbar.onSave(async() => {
            if (!this.autosave) {
                console.warn('Autosave not initialized');
                return;
            }
            try {
                await this.autosave.saveContent();
            } catch (error) {
                console.error('Manual save failed:', error);
            }
        });

        // Subscribe to format changes from content
        this.content.on(EditorContent.EVENTS.FORMAT_CHANGE, (format) => {
            this.toolbar.updateActiveFormat(format);
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
                // Update content first
                this.content.setContent(state.content, true);

                // Update format
                this.state.setCurrentFormat(state.currentFormat);
                this.toolbar.updateActiveFormat(state.currentFormat);

                // Update page state
                this.toolbar.updatePageCount(state.pageCount);
                this.state.setHistoryState(
                    this.history.canUndo(),
                    this.history.canRedo()
                );

                // Update minimap if available
                if (this.hasMinimapSupport && this.minimap) {
                    this.minimap.updateViewport(state.currentPage, state.pageCount);
                }

                // Mark content as clean after state application
                this.state.markDirty(false);
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
    }

    async loadInitialContent() {
        try {
            // Get the current script from state
            const currentScript = this.script && this.script.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);

            if (!currentScript) {
                console.warn('EditorWidget: No current script found');
                return false;
            }

            // Parse the content if it exists
            if (currentScript.content) {
                await this.content.setContent(currentScript.content);
                return true;
            }

            console.warn('EditorWidget: No content in current script');
            return false;
        } catch (error) {
            console.error('Error loading initial content:', error);
            return false;
        }
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

    subscribeToScriptChanges() {
        if (this.script && this.script.stateManager) {
            this.script.stateManager.subscribe(StateManager.KEYS.CURRENT_SCRIPT, async(script) => {
                if (script && script.content !== undefined) {
                    console.info('EditorWidget: Current script changed, loading new content:', script);
                    await this.loadInitialContent();
                }
            });
        }
    }
}