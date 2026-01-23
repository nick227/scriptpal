import { UI_ELEMENTS } from '../../constants.js';
import { EventManager } from '../../core/EventManager.js';

import { AICommandManager } from './ai/AICommandManager.js';
import { AILineInsertionManager } from './ai/AILineInsertionManager.js';
import { ChapterManager } from './chapters/ChapterManager.js';
import { EDITOR_EVENTS } from './constants.js';
// ContentManager functionality now consolidated into EditorContent.js
import { ScriptContextManager } from './context/ScriptContextManager.js';
import { EditorContent } from './EditorContent.js';
import { EditorToolbar } from './EditorToolbar.js';
import { EditorDOMHandler } from './handlers/EditorDOMHandler.js';
import { EditorHistory } from './history/EditorHistory.js';
import { LineFormatter } from './LineFormatter.js';
// Minimap functionality now consolidated into EditorToolbar.js
import { PageManager } from './page/PageManager.js';
import { EditorSaveService } from './save/EditorSaveService.js';
import { EditorStateManager } from './state/EditorStateManager.js';
import { TitlePageManager } from './title/TitlePageManager.js';


/**
 *
 */
export class EditorWidget {
    /**
     *
     * @param options
     */
    constructor (options = {}) {
        // Store container references
        this.container = options.container;
        this.toolbarContainer = options.toolbar || options.container.querySelector(UI_ELEMENTS.EDITOR_TOOLBAR);

        this.statusBar = options.statusBar;

        // Core dependencies
        this.api = null;
        this.user = null;
        this.scriptStore = null;
        this.eventManager = null;

        // Initialize components directly
        this.components = new Map();
        this.componentDefinitions = [];
        this.initializeComponentDefinitions();

        // Initialize callback storage
        this.callbacks = {
            onChange: null,
            onCursorMove: null,
            onFormat: null
        };

        this._eventHubCleanup = null;
        this.saveStateSubscriptions = new Map();
        this.localEvents = new EventManager();
    }

    on (eventType, handler) {
        return this.localEvents.subscribe(eventType, handler);
    }

    off (eventType, handler) {
        this.localEvents.unsubscribe(eventType, handler);
    }

    emit (eventType, data) {
        this.localEvents.publish(eventType, data);
    }

    removeAllListeners () {
        this.localEvents.clear();
    }

    /**
     * Initialize component definitions (consolidated from EditorComponentManager)
     */
    initializeComponentDefinitions () {
        this.componentDefinitions = [
            {
                name: 'globalStateManager',
                required: false,
                init: async () => {
                    return this.stateManager;
                },
                deps: []
            },
            {
                name: 'stateManager',
                required: true,
                init: async () => {
                    const editorStateManager = new EditorStateManager();
                    await editorStateManager.initialize();
                    return editorStateManager;
                },
                deps: []
            },
            {
                name: 'pageManager',
                required: true,
                init: async () => {
                    let editorArea = this.container.querySelector('.editor-area');
                    if (!editorArea) {
                        editorArea = document.createElement('div');
                        editorArea.className = 'editor-area';
                        this.container.appendChild(editorArea);
                    }
                    const pageManager = new PageManager(editorArea);
                    await pageManager.initialize();
                    return pageManager;
                },
                deps: ['stateManager']
            },
            {
                name: 'domHandler',
                required: true,
                init: async () => {
                    const stateManager = this.getComponent('stateManager');
                    const pageManager = this.getComponent('pageManager');

                    if (!stateManager || !pageManager) {
                        throw new Error('Required dependencies not available for domHandler');
                    }

                    const domHandler = new EditorDOMHandler({
                        container: this.container,
                        stateManager: stateManager,
                        pageManager: pageManager
                    });
                    await domHandler.initialize();
                    return domHandler;
                },
                deps: ['stateManager', 'pageManager']
            },
            {
                name: 'lineFormatter',
                required: true,
                init: async () => {
                    const stateManager = this.getComponent('stateManager');
                    if (!stateManager) {
                        throw new Error('Required dependencies not available for lineFormatter');
                    }
                    return new LineFormatter(stateManager);
                },
                deps: ['stateManager']
            },
            {
                name: 'content',
                required: true,
                init: async () => {
                    const stateManager = this.getComponent('stateManager');
                    const pageManager = this.getComponent('pageManager');
                    const lineFormatter = this.getComponent('lineFormatter');
                    const domHandler = this.getComponent('domHandler');

                    if (!stateManager || !pageManager || !lineFormatter || !domHandler) {
                        throw new Error('Required dependencies not available for content');
                    }

                    const content = new EditorContent({
                        container: this.container,
                        stateManager: stateManager,
                        pageManager: pageManager,
                        lineFormatter: lineFormatter,
                        domHandler: domHandler
                    });
                    await content.initialize();
                    return content;
                },
                deps: ['stateManager', 'pageManager', 'lineFormatter', 'domHandler']
            },
            {
                name: 'toolbar',
                required: true,
                init: async () => {
                    const stateManager = this.getComponent('stateManager');
                    const pageManager = this.getComponent('pageManager');

                    if (!stateManager || !pageManager) {
                        throw new Error('Required dependencies not available for toolbar');
                    }

                    const toolbar = new EditorToolbar({
                        container: this.toolbarContainer,
                        stateManager: stateManager,
                        pageManager: pageManager
                    });
                    await toolbar.initialize();
                    return toolbar;
                },
                deps: ['stateManager', 'pageManager']
            },
            {
                name: 'saveService',
                required: true,
                init: async () => {
                    const content = this.getComponent('content');
                    const toolbar = this.getComponent('toolbar');

                    if (!content || !toolbar) {
                        throw new Error('Required dependencies not available for saveService');
                    }

                    return new EditorSaveService({
                        content: content,
                        toolbar: toolbar,
                        api: this.api,
                        scriptStore: this.scriptStore
                    });
                },
                deps: ['content', 'toolbar']
            },
            {
                name: 'history',
                required: true,
                init: async () => {
                    const stateManager = this.getComponent('stateManager');
                    if (!stateManager) {
                        throw new Error('Required dependencies not available for history');
                    }
                    return new EditorHistory(stateManager);
                },
                deps: ['stateManager']
            },
            {
                name: 'titlePageManager',
                required: false,
                init: async () => {
                    const { stateManager, eventManager, api, scriptStore, container } = this;
                    const editorArea = container.querySelector(UI_ELEMENTS.EDITOR_AREA);

                    if (!stateManager || !eventManager || !api || !editorArea) {
                        throw new Error('Required dependencies not available for titlePageManager');
                    }
                    const titlePageManager = new TitlePageManager({
                        container: editorArea,
                        stateManager: stateManager,
                        eventManager: eventManager,
                        api: api,
                        scriptStore: scriptStore
                    });
                    await titlePageManager.initialize();
                    return titlePageManager;
                },
                deps: ['stateManager']
            },
            {
                name: 'chapterManager',
                required: false,
                init: async () => {
                    const content = this.getComponent('content');
                    if (!content) {
                        throw new Error('Required dependencies not available for chapterManager');
                    }
                    return new ChapterManager(content);
                },
                deps: ['content']
            },
            {
                name: 'aiCommandManager',
                required: false,
                init: async () => {
                    const content = this.getComponent('content');
                    if (!content) {
                        throw new Error('Required dependencies not available for aiCommandManager');
                    }
                    return new AICommandManager(content);
                },
                deps: ['content']
            },
            {
                name: 'aiLineInsertionManager',
                required: false,
                init: async () => {
                    const stateManager = this.getComponent('stateManager');
                    const { eventManager } = this;
                    const content = this.getComponent('content');
                    const aiCommandManager = this.getComponent('aiCommandManager');

                    if (!stateManager || !eventManager || !content || !aiCommandManager) {
                        throw new Error('Required dependencies not available for aiLineInsertionManager');
                    }

                    return new AILineInsertionManager({
                        stateManager: stateManager,
                        eventManager: eventManager,
                        contentManager: content,
                        aiCommandManager: aiCommandManager
                    });
                },
                deps: ['stateManager', 'content', 'aiCommandManager']
            },
            {
                name: 'stateController',
                required: true,
                init: async () => {
                    const stateManager = this.getComponent('stateManager');
                    const { eventManager } = this;
                    const content = this.getComponent('content');
                    const pageManager = this.getComponent('pageManager');
                    const chapterManager = this.getComponent('chapterManager');

                    if (!stateManager || !eventManager) {
                        throw new Error('Required dependencies not available for stateController');
                    }

                    return new ScriptContextManager({
                        stateManager: stateManager,
                        eventManager: eventManager,
                        contentManager: content,
                        pageManager: pageManager,
                        chapterManager: chapterManager
                    });
                },
                deps: ['stateManager', 'content', 'pageManager']
            }
        ];
    }

    /**
     * Get a component by name
     * @param name
     */
    getComponent (name) {
        return this.components.get(name);
    }

    /**
     * Get the state controller component
     */
    get stateController () {
        return this.getComponent('stateController');
    }

    /**
     * Sort components by dependency order using topological sort
     */
    sortComponentsByDependencies () {
        const sorted = [];
        const visited = new Set();
        const visiting = new Set();

        const visit = (definition) => {
            if (visiting.has(definition.name)) {
                throw new Error(`Circular dependency detected: ${definition.name}`);
            }
            if (visited.has(definition.name)) {
                return;
            }

            visiting.add(definition.name);

            // Visit dependencies first
            for (const depName of definition.deps) {
                const dep = this.componentDefinitions.find(d => d.name === depName);
                if (dep) {
                    visit(dep);
                }
            }

            visiting.delete(definition.name);
            visited.add(definition.name);
            sorted.push(definition);
        };

        for (const definition of this.componentDefinitions) {
            if (!visited.has(definition.name)) {
                visit(definition);
            }
        }

        return sorted;
    }

    /**
     * Initialize all components with dependency resolution and phased loading
     */
    async initializeComponents () {
        const startTime = performance.now();

        // Sort components by dependency order to avoid retries
        const sortedDefinitions = this.sortComponentsByDependencies();

        // Phase 1: Critical components (required for basic functionality)
        const criticalComponents = sortedDefinitions.filter(def => def.required);
        await this.initializeComponentPhase(criticalComponents, 'Critical');

        // Phase 2: Optional components (deferred for performance)
        const optionalComponents = sortedDefinitions.filter(def => !def.required);

        // Defer optional components to next tick for better performance
        if (optionalComponents.length > 0) {
            setTimeout(async () => {
                await this.initializeComponentPhase(optionalComponents, 'Optional');
            }, 0);
        }

        const endTime = performance.now();

        // Verify all required components are initialized
        this.checkRequiredComponents();
    }

    /**
     * Initialize a phase of components with progress tracking
     * @param components
     * @param phaseName
     */
    async initializeComponentPhase (components, phaseName) {
        const phaseStartTime = performance.now();
        let initialized = 0;
        let skipped = 0;
        let failed = 0;

        for (const definition of components) {
            if (this.components.has(definition.name)) {
                skipped++;
                continue; // Already initialized
            }

            try {
                const componentStartTime = performance.now();

                const component = await definition.init();
                this.components.set(definition.name, component);

                const componentEndTime = performance.now();
                initialized++;
            } catch (error) {
                console.error(`[EditorWidget] ❌ ${phaseName}: Failed to initialize ${definition.name}:`, error);
                failed++;
                if (definition.required) {
                    throw error;
                }
            }
        }

        const phaseEndTime = performance.now();
    }

    /**
     * Check if all required components are initialized
     */
    checkRequiredComponents () {
        const requiredComponents = this.componentDefinitions.filter(def => def.required);
        const missingRequired = requiredComponents.filter(def => !this.components.has(def.name));

        if (missingRequired.length > 0) {
            throw new Error(`Missing required components: ${missingRequired.map(def => def.name).join(', ')}`);
        }

    }

    /**
     * Setup component relationships (consolidated from EditorComponentManager)
     */
    async setupComponentRelationships () {

        // Set up content-toolbar relationship
        const content = this.getComponent('content');
        const toolbar = this.getComponent('toolbar');
        const history = this.getComponent('history');
        const pageManager = this.getComponent('pageManager');

        if (content && toolbar) {
            if (typeof toolbar.setEditorArea === 'function') {
                toolbar.setEditorArea(content.editorArea);
            }
            this.setupEditorEventHub(content, toolbar);
        }

        if (content && history) {
            content.setHistory(history);
            if (typeof history.setContent === 'function') {
                history.setContent(content);
            }
            if (pageManager && typeof history.setPageManager === 'function') {
                history.setPageManager(pageManager);
            }
        }

        if (toolbar && history) {
            if (typeof toolbar.onUndo === 'function') {
                toolbar.onUndo(() => history.undo());
            }
            if (typeof toolbar.onRedo === 'function') {
                toolbar.onRedo(() => history.redo());
            }
        }

        // Set up other component relationships as needed
    }

    /**
     * Centralized wiring between editor components
     * @param content
     * @param toolbar
     */
    setupEditorEventHub (content, toolbar) {
        if (this._eventHubCleanup) {
            this._eventHubCleanup();
        }

        const editorArea = content?.editorArea;
        if (!editorArea || !toolbar) {
            this._eventHubCleanup = null;
            return;
        }

        const handleScroll = (event) => {
            if (typeof toolbar.handleScroll === 'function') {
                toolbar.handleScroll(event);
            }
            if (typeof toolbar.updateMinimapPosition === 'function') {
                toolbar.updateMinimapPosition();
            }
        };

        const handleSelection = () => {
            if (typeof toolbar.updateMinimapPosition === 'function') {
                toolbar.updateMinimapPosition();
            }
        };

        editorArea.addEventListener('scroll', handleScroll);
        document.addEventListener('selectionchange', handleSelection);

        const minimapContainer = this.container.querySelector('.minimap-container');
        if (minimapContainer && typeof toolbar.initializeMinimap === 'function') {
            toolbar.initializeMinimap(minimapContainer, editorArea);
            toolbar.createMinimap();
        }

        this._eventHubCleanup = () => {
            editorArea.removeEventListener('scroll', handleScroll);
            document.removeEventListener('selectionchange', handleSelection);
        };
    }

    /**
     * Setup event handling (consolidated from EditorEventCoordinator)
     */
    setupEventHandling () {

        // Setup basic event listeners
        const content = this.getComponent('content');
        const toolbar = this.getComponent('toolbar');

        if (content) {
            // Content change events
            content.on('contentChanged', (data) => {
                this.emit('contentChanged', data);
                if (this.callbacks.onChange) {
                    this.callbacks.onChange(data);
                }
            });

            // Cursor move events
            content.on('cursorMoved', (data) => {
                this.emit('cursorMoved', data);
                if (this.callbacks.onCursorMove) {
                    this.callbacks.onCursorMove(data);
                }
            });
        }

        if (toolbar && typeof toolbar.on === 'function') {
            // Format change events
            toolbar.on('formatChanged', (data) => {
                this.emit('formatChanged', data);
                if (this.callbacks.onFormat) {
                    this.callbacks.onFormat(data);
                }
            });
        }

        if (toolbar && typeof toolbar.onFormatSelected === 'function' && content) {
            toolbar.onFormatSelected((format) => {
                content.setCurrentLineFormat(format);
            });
        }

    }

    /**
     * Subscribe to script save state events from ScriptStore
     */
    setupSaveStateSubscriptions () {
        if (!this.eventManager) {
            return;
        }
        const stateMap = {
            SAVE_DIRTY: 'dirty',
            SAVE_SAVING: 'saving',
            SAVE_SAVED: 'saved',
            SAVE_ERROR: 'error'
        };

        Object.entries(stateMap).forEach(([eventKey, state]) => {
            const eventName = EventManager.EVENTS.SCRIPT[eventKey];
            if (!eventName) return;
            const unsubscribe = this.eventManager.subscribe(eventName, () => {
                this.updateToolbarSaveState(state);
            });
            this.saveStateSubscriptions.set(eventName, unsubscribe);
        });
    }

    /**
     * Update the toolbar's save state (if available)
     * @param {string} state
     */
    updateToolbarSaveState (state) {
        const toolbar = this.getComponent('toolbar');
        if (toolbar && typeof toolbar.setSaveState === 'function') {
            toolbar.setSaveState(state);
        }
    }

    /**
     * Load initial content (consolidated from EditorStateController)
     * @param scriptStore
     */
    async loadInitialContent (scriptStore) {

        const content = this.getComponent('content');
        const stateManager = this.getComponent('stateManager');

        if (content && stateManager) {
            const currentScript = scriptStore.getCurrentScript();
            if (currentScript && currentScript.content !== undefined && currentScript.content !== null) {
                await content.updateContent(currentScript.content, {
                    isEdit: false,
                    preserveState: false,
                    source: 'initial_load',
                    focus: true
                });
                if (typeof stateManager.setCurrentScript === 'function') {
                    stateManager.setCurrentScript(currentScript);
                }
            }
        }
    }

    /**
     *
     */
    validateElements () {
        if (!this.container || !(this.container instanceof HTMLElement)) {
            throw new Error('Editor container element is required and must be an HTMLElement');
        }

        // Validate toolbar container exists
        if (!this.toolbarContainer || !(this.toolbarContainer instanceof HTMLElement)) {
            throw new Error('Editor toolbar element is required and must be an HTMLElement');
        }

        // Make minimap optional
        this.hasMinimapSupport = Boolean(this.container.querySelector('.minimap-container'));
        return true;
    }

    /**
     *
     * @param api
     * @param user
     * @param scriptStore
     * @param stateManager
     */
    async initialize (api, user, scriptStore, stateManager = null) {
        try {
            // Validate core dependencies
            if (!api) {
                throw new Error('API is required for editor initialization');
            }
            if (!user) {
                throw new Error('User is required for editor initialization');
            }
            if (!scriptStore) {
                throw new Error('ScriptStore is required for editor initialization');
            }

            // Store core dependencies
            this.api = api;
            this.user = user;
            this.scriptStore = scriptStore;
            this.stateManager = stateManager;

            // Validate required elements
            if (!this.validateElements()) {
                throw new Error('Required elements not found');
            }

            // Initialize event manager first
            this.eventManager = new EventManager();

            // Initialize components directly
            await this.initializeComponents();

            // Setup component relationships
            await this.setupComponentRelationships();

            // Setup event handling
            this.setupEventHandling();
            this.setupSaveStateSubscriptions();

            // Load initial content if script is already selected
            const currentScript = this.scriptStore.getCurrentScript();
            if (currentScript && currentScript.content) {
                await this.loadInitialContent(this.scriptStore);
            }

            // Set editor as ready
            const editorStateManager = this.getComponent('stateManager');
            if (editorStateManager && typeof editorStateManager.setReady === 'function') {
                editorStateManager.setReady(true);
            }
            this.emit(EDITOR_EVENTS.EDITOR_AREA_READY);

            return true;
        } catch (error) {
            console.error('Failed to initialize editor:', error);
            const editorStateManager = this.getComponent('stateManager');
            if (editorStateManager) {
                editorStateManager.setError(error);
            }
            return false;
        }
    }

    /**
     *
     */
    async reloadCurrentScript () {
        const currentScript = this.scriptStore.getCurrentScript();
        if (currentScript && currentScript.content) {
            await this.loadInitialContent(this.scriptStore);
            this.emit(EDITOR_EVENTS.EDITOR_AREA_READY);
            return true;
        }
        return false;
    }

    // Public API methods
    /**
     *
     */
    getCurrentState () {
        return this.stateController.getCurrentState();
    }

    /**
     *
     * @param state
     */
    validateState (state) {
        return this.stateController.validateState(state);
    }

    /**
     *
     * @param state
     */
    applyState (state) {
        return this.stateController.applyState(state);
    }

    // Event callback setters
    /**
     *
     * @param callback
     */
    onContentChange (callback) {
        this.callbacks.onChange = callback;
    }

    /**
     *
     * @param callback
     */
    onCursorMove (callback) {
        this.callbacks.onCursorMove = callback;
    }

    /**
     *
     * @param callback
     */
    onFormatChange (callback) {
        this.callbacks.onFormat = callback;
    }

    /**
     *
     */
    destroy () {
        if (this._eventHubCleanup) {
            this._eventHubCleanup();
            this._eventHubCleanup = null;
        }

        // Clean up components in reverse order
        const componentNames = Array.from(this.components.keys()).reverse();

        for (const name of componentNames) {
            const component = this.components.get(name);
            if (component && typeof component.destroy === 'function') {
                try {
                    component.destroy();
                } catch (error) {
                    console.error(`[EditorWidget] Error destroying component ${name}:`, error);
                }
            }
        }

        // Clear component references
        this.components.clear();
        this.componentDefinitions = [];

        // Clear event handlers
        if (this._eventHandlers) {
            this._eventHandlers = null;
        }

        // Clear other references
        this.api = null;
        this.user = null;
        this.scriptStore = null;
        this.eventManager = null;

        // Clean up event listeners
        this.removeAllListeners();
        // Remove save state subscriptions
        this.saveStateSubscriptions.forEach(unsub => {
            if (typeof unsub === 'function') {
                unsub();
            }
        });
        this.saveStateSubscriptions.clear();
        this.localEvents = null;
    }

    /**
     *
     * @param scriptData
     */
    async updateScriptContent (scriptData) {
        try {
            if (!scriptData || scriptData.content === null || scriptData.content === undefined) {
                throw new Error('Invalid script data');
            }

            // Get content component
            const contentComponent = this.getComponent('content');
            if (!contentComponent) {
                throw new Error('Content component not found');
            }

            // Update with new content string
            await contentComponent.updateContent(scriptData.content, {
                source: 'edit',
                isEdit: true,
                preserveState: true
            });

            // Update save service with content string

            return true;
        } catch (error) {
            console.error('[EDITOR] Content update failed:', error);
            this.eventManager.publish(EventManager.EVENTS.SCRIPT.ERROR, {
                error: error.message,
                type: 'edit',
                recoverable: true
            });
            return false;
        }
    }

    /**
     * Load script content into the editor.
     * @param {object} options
     * @param {object} options.script
     * @param {string} [options.source]
     * @param {boolean} [options.resetHistory]
     */
    async loadScript ({ script, source = 'selection', resetHistory = false } = {}) {
        const contentComponent = this.getComponent('content');
        if (!contentComponent) {
            throw new Error('Content component not found');
        }

        const history = resetHistory ? this.getComponent('history') : null;
        if (history && typeof history.clear === 'function') {
            history.clear();
        }

        const contentValue = script && script.content !== undefined && script.content !== null
            ? script.content
            : '';

        await contentComponent.updateContent(contentValue, {
            isEdit: false,
            preserveState: false,
            source,
            focus: true
        });

        if (history && history.stateManager && typeof history.stateManager.getCurrentState === 'function') {
            history.saveState(history.stateManager.getCurrentState(), true);
        }

        return true;
    }

    /**
     * Apply command-based edits to the editor content.
     * @param {Array} commands
     * @returns {Promise<boolean>}
     */
    async applyCommands (commands = []) {
        try {
            const contentComponent = this.getComponent('content');
            if (!contentComponent) {
                throw new Error('Content component not found');
            }

            const result = await contentComponent.applyCommands(commands, {
                source: 'ai_commands'
            });
            if (!result || !result.success) {
                throw new Error('Command apply failed');
            }


            const history = this.getComponent('history');
            if (history && typeof history.pushCommandBatch === 'function') {
                history.pushCommandBatch(commands, result.inverseCommands || [], {
                    source: 'ai_commands'
                });
            }

            return true;
        } catch (error) {
            console.error('[EDITOR] Command apply failed:', error);
            this.eventManager.publish(EventManager.EVENTS.SCRIPT.ERROR, {
                error: error.message,
                type: 'edit',
                recoverable: true
            });
            return false;
        }
    }
}
