import { UI_ELEMENTS } from '../../constants.js';
import { EventManager } from '../../core/EventManager.js';
import { StateManager } from '../../core/StateManager.js';
import { debugLog } from '../../core/logger.js';

import { AICommandManager } from './ai/AICommandManager.js';
import { AILineInsertionManager } from './ai/AILineInsertionManager.js';
import { ChapterManager } from './chapters/ChapterManager.js';
import { EDITOR_EVENTS } from './constants.js';
// ContentManager functionality now consolidated into EditorContent.js
import { ScriptContextManager } from './context/ScriptContextManager.js';
import { EditorCoordinator } from './EditorCoordinator.js';
import { EditorToolbar } from './EditorToolbar.js';
import { EditorDOMHandler } from './handlers/EditorDOMHandler.js';
import { EditorHistory } from './history/EditorHistory.js';
import { LineFormatter } from './LineFormatter.js';
// Minimap functionality now consolidated into EditorToolbar.js
import { PageManager } from './page/PageManager.js';
import { ScriptExportService } from './export/ScriptExportService.js';
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
                    const appStateManager = this.getComponent('globalStateManager') || this.stateManager;

                    if (!stateManager || !pageManager || !lineFormatter || !domHandler) {
                        throw new Error('Required dependencies not available for content');
                    }

                    const content = new EditorCoordinator({
                        container: this.container,
                        stateManager: stateManager,
                        pageManager: pageManager,
                        lineFormatter: lineFormatter,
                        domHandler: domHandler,
                        appStateManager: appStateManager
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
                    const appStateManager = this.getComponent('globalStateManager') || this.stateManager;

                    if (!stateManager || !pageManager) {
                        throw new Error('Required dependencies not available for toolbar');
                    }

                    const toolbar = new EditorToolbar({
                        container: this.toolbarContainer,
                        stateManager: stateManager,
                        pageManager: pageManager,
                        api: this.api,
                        scriptStore: this.scriptStore,
                        appStateManager: appStateManager
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
                    const appStateManager = this.getComponent('globalStateManager') || this.stateManager;

                    if (!content || !toolbar) {
                        throw new Error('Required dependencies not available for saveService');
                    }
                    if (!appStateManager) {
                        throw new Error('Required dependencies not available for saveService');
                    }
                    return new EditorSaveService({
                        content: content,
                        toolbar: toolbar,
                        api: this.api,
                        scriptStore: this.scriptStore,
                        stateManager: appStateManager
                    });
                },
                deps: ['content', 'toolbar']
            },
            {
                name: 'exportService',
                required: true,
                init: async () => {
                    const content = this.getComponent('content');
                    const appStateManager = this.getComponent('globalStateManager') || this.stateManager;

                    if (!content || !appStateManager) {
                        throw new Error('Required dependencies not available for exportService');
                    }
                    const onNotify = (message) => {
                        if (this.eventManager) {
                            this.eventManager.publish(EventManager.EVENTS.SCRIPT.ERROR, { message, type: 'export' });
                        }
                    };
                    return new ScriptExportService({
                        content,
                        scriptStore: this.scriptStore,
                        stateManager: appStateManager,
                        onNotify
                    });
                },
                deps: ['content']
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

        const exportService = this.getComponent('exportService');
        if (toolbar && exportService && typeof toolbar.onExportRequested === 'function') {
            toolbar.onExportRequested(({ format }) => {
                if (format === 'txt') exportService.exportAsTxt();
                else if (format === 'json') exportService.exportAsJson();
            });
        }

        this.setupVersionHandlers();
        // Re-assert edit mode and hide version-preview bar after all wiring (never show bar on load).
        const appState = this.stateManager;
        if (appState && typeof appState.setState === 'function') {
            appState.setState(StateManager.KEYS.EDITOR_MODE, 'edit');
            appState.setState(StateManager.KEYS.EDITOR_PREVIEW_VERSION, null);
        }
        if (toolbar && typeof toolbar.setEditorMode === 'function') {
            toolbar.setEditorMode('edit');
        }
    }

    setupVersionHandlers () {
        const toolbar = this.getComponent('toolbar');
        const content = this.getComponent('content');
        const appState = this.stateManager;
        if (!toolbar || !content || !appState || !this.scriptStore || !this.api?.scripts) return;

        toolbar.onVersionPreviewRequested(async ({ versionNumber }) => {
            const scriptId = this.scriptStore.getCurrentScriptId();
            if (!scriptId) return;
            if (appState.getState(StateManager.KEYS.EDITOR_MODE) === 'version-preview') return;
            try {
                appState.setState(StateManager.KEYS.EDITOR_MODE, 'version-preview');
                appState.setState(StateManager.KEYS.EDITOR_PREVIEW_VERSION, versionNumber);
                toolbar.setEditorMode('version-preview', versionNumber);
                const script = await this.api.scripts.getScript(String(scriptId), versionNumber);
                if (script?.content == null) {
                    appState.setState(StateManager.KEYS.EDITOR_MODE, 'edit');
                    appState.setState(StateManager.KEYS.EDITOR_PREVIEW_VERSION, null);
                    toolbar.setEditorMode('edit');
                    toolbar.setCurrentVersion(this.scriptStore.getCurrentScript()?.versionNumber);
                    return;
                }
                await content.updateContent(script.content, { source: 'version_preview', focus: false });
                if (this.scriptStore.getCurrentScript()?.versionNumber === versionNumber) {
                    console.warn('[VersionPreview] Previewing same version as latest — unexpected state', { scriptId, versionNumber });
                }
                debugLog('[VersionPreview] Enter', { scriptId, versionNumber });
            } catch (err) {
                console.error('[EditorWidget] Version preview failed', err);
                appState.setState(StateManager.KEYS.EDITOR_MODE, 'edit');
                appState.setState(StateManager.KEYS.EDITOR_PREVIEW_VERSION, null);
                toolbar.setEditorMode('edit');
                toolbar.setCurrentVersion(this.scriptStore.getCurrentScript()?.versionNumber);
                if (this.eventManager) {
                    this.eventManager.publish(EventManager.EVENTS.SCRIPT.ERROR, {
                        error: err?.message || 'Could not load version',
                        type: 'version_preview',
                        recoverable: true
                    });
                }
            }
        });

        toolbar.onVersionRestoreRequested(async () => {
            const scriptId = this.scriptStore.getCurrentScriptId();
            const previewVersion = appState.getState(StateManager.KEYS.EDITOR_PREVIEW_VERSION);
            if (!scriptId || previewVersion == null) return;
            if (appState.getState(StateManager.KEYS.EDITOR_MODE) !== 'version-preview') return;
            toolbar.setRestoreLoading(true);
            try {
                const response = await this.api.scripts.restoreVersion(String(scriptId), previewVersion);
                appState.setState(StateManager.KEYS.EDITOR_MODE, 'edit');
                appState.setState(StateManager.KEYS.EDITOR_PREVIEW_VERSION, null);
                this.scriptStore.updateScriptInCache(response);
                this.scriptStore.setCurrentScript(response, { source: 'update' });
                await content.updateContent(response.content, { source: 'version_restore', focus: false });
                toolbar.setEditorMode('edit');
                const versions = await this.api.scripts.getScriptVersions(String(scriptId));
                if (Array.isArray(versions)) {
                    toolbar.setVersions(versions);
                    toolbar.setCurrentVersion(response.versionNumber);
                }
                debugLog('[VersionPreview] Restore', { from: previewVersion, to: response.versionNumber });
            } catch (err) {
                console.error('[EditorWidget] Restore version failed', err);
                if (this.eventManager) {
                    this.eventManager.publish(EventManager.EVENTS.SCRIPT.ERROR, {
                        error: err?.message || 'Restore failed',
                        type: 'version_restore',
                        recoverable: true
                    });
                }
            } finally {
                toolbar.setRestoreLoading(false);
            }
        });

        toolbar.onVersionPreviewCancelRequested(async () => {
            const scriptId = this.scriptStore.getCurrentScriptId();
            if (!scriptId) return;
            try {
                await this.scriptStore.loadScript(scriptId, { forceFresh: true });
                const latest = this.scriptStore.getCurrentScript();
                if (latest?.content != null) {
                    await content.updateContent(latest.content, { source: 'version_cancel', focus: false });
                }
                appState.setState(StateManager.KEYS.EDITOR_MODE, 'edit');
                appState.setState(StateManager.KEYS.EDITOR_PREVIEW_VERSION, null);
                toolbar.setEditorMode('edit');
                toolbar.setCurrentVersion(latest?.versionNumber);
                debugLog('[VersionPreview] Cancel');
            } catch (err) {
                console.error('[EditorWidget] Cancel preview failed', err);
                appState.setState(StateManager.KEYS.EDITOR_MODE, 'edit');
                appState.setState(StateManager.KEYS.EDITOR_PREVIEW_VERSION, null);
                toolbar.setEditorMode('edit');
                const knownLatest = this.scriptStore.getCurrentScript()?.versionNumber;
                if (knownLatest != null) {
                    toolbar.setCurrentVersion(knownLatest);
                }
                if (this.eventManager) {
                    this.eventManager.publish(EventManager.EVENTS.SCRIPT.ERROR, {
                        error: 'Could not refresh latest version. Try again.',
                        type: 'version_preview_cancel',
                        recoverable: true
                    });
                }
            }
        });
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
        // Never show version-preview bar on load: default to latest, hide bar.
        const appState = this.stateManager;
        const toolbar = this.getComponent('toolbar');
        if (appState && typeof appState.setState === 'function') {
            appState.setState(StateManager.KEYS.EDITOR_MODE, 'edit');
            appState.setState(StateManager.KEYS.EDITOR_PREVIEW_VERSION, null);
        }
        if (toolbar && typeof toolbar.setEditorMode === 'function') {
            toolbar.setEditorMode('edit');
        }

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

            // Version preview state lives on app StateManager; ensure we never load in preview mode.
            if (stateManager && typeof stateManager.setState === 'function') {
                stateManager.setState(StateManager.KEYS.EDITOR_MODE, 'edit');
                stateManager.setState(StateManager.KEYS.EDITOR_PREVIEW_VERSION, null);
            }

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

        // Never load into version-preview: use app state and hide preview bar before any async work.
        const toolbar = this.getComponent('toolbar');
        const appState = this.stateManager;
        if (appState && typeof appState.setState === 'function') {
            appState.setState(StateManager.KEYS.EDITOR_MODE, 'edit');
            appState.setState(StateManager.KEYS.EDITOR_PREVIEW_VERSION, null);
        }
        if (toolbar && typeof toolbar.setEditorMode === 'function') {
            toolbar.setEditorMode('edit');
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

        await this.refreshVersionDropdown(script);
        return true;
    }

    async refreshVersionDropdown (script) {
        const toolbar = this.getComponent('toolbar');
        const appState = this.stateManager;
        if (appState && typeof appState.setState === 'function') {
            appState.setState(StateManager.KEYS.EDITOR_MODE, 'edit');
            appState.setState(StateManager.KEYS.EDITOR_PREVIEW_VERSION, null);
        }
        if (toolbar && typeof toolbar.setEditorMode === 'function') {
            toolbar.setEditorMode('edit');
        }
        if (!script?.id || !this.api?.scripts?.getScriptVersions) {
            if (toolbar && !script?.id) {
                toolbar.setVersions([]);
                toolbar.setCurrentVersion(null);
            }
            return;
        }
        try {
            const versions = await this.api.scripts.getScriptVersions(String(script.id));
            if (toolbar && Array.isArray(versions)) {
                toolbar.setVersions(versions);
                toolbar.setCurrentVersion(script.versionNumber);
            }
        } catch (err) {
            console.warn('[EditorWidget] Failed to fetch script versions', err);
        }
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
