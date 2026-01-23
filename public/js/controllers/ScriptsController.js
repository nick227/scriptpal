import { EventManager } from '../core/EventManager.js';
import { StateManager } from '../core/StateManager.js';

/**
 * ScriptsController - handles script UI intent and editor sync
 */
export class ScriptsController {
    /**
     * Create a scripts controller.
     * @param {object} options - Dependency container.
     * @param {object} options.scriptStore - Script store instance.
     * @param {StateManager} options.stateManager - Global state manager.
     * @param {EventManager} options.eventManager - Event manager instance.
     */
    constructor (options) {
        if (!options.scriptStore) {
            throw new Error('ScriptStore is required for ScriptsController');
        }
        if (!options.stateManager) {
            throw new Error('StateManager is required for ScriptsController');
        }
        if (!options.eventManager) {
            throw new Error('EventManager is required for ScriptsController');
        }

        this.scriptStore = options.scriptStore;
        this.stateManager = options.stateManager;
        this.eventManager = options.eventManager;
        this.editorWidget = null;
        this.editorReady = false;
        this.lastLoadedScriptId = null;
        this.lastLoadedVersion = null;

        this.setupEventSubscriptions();
        this.setupStateSubscriptions();
    }

    /**
     * Wire up event subscriptions.
     */
    setupEventSubscriptions () {
        this.eventManager.subscribe(
            EventManager.EVENTS.SCRIPT.SELECTED,
            this.handleScriptSelected.bind(this)
        );
    }

    /**
     * Wire up state subscriptions.
     */
    setupStateSubscriptions () {
        this.stateManager.subscribe(
            StateManager.KEYS.USER,
            this.handleUserChange.bind(this)
        );

        this.handleUserChange(this.stateManager.getState(StateManager.KEYS.USER));
    }

    /**
     * Attach the editor widget.
     * @param {object} editorWidget - Editor widget instance.
     * @param {boolean} isReady - Whether the editor is ready.
     */
    setEditorWidget (editorWidget, isReady = false) {
        this.editorWidget = editorWidget;
        this.editorReady = Boolean(isReady);

        if (this.editorWidget && this.editorReady) {
            this.handleCurrentScriptChange(this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT), {
                source: 'startup'
            });
        }
    }

    /**
     * React to user changes.
     * @param {object} user - Current user model.
     */
    async handleUserChange (user) {
        if (!user || !user.id) {
            this.scriptStore.clearState();
            return;
        }

        await this.scriptStore.ensureUserHasScripts(user.id);
        await this.scriptStore.selectInitialScript({ source: 'startup' });
    }

    /**
     * React to script selection events.
     * @param {object} event - Selection event payload.
     */
    async handleScriptSelected (event) {
        const script = event && typeof event === 'object' ? event.script : null;
        const source = event && typeof event === 'object' ? event.source : null;
        if (source === 'update' || source === 'patch' || source === 'edit') {
            return;
        }
        await this.handleCurrentScriptChange(script, { source: source || 'selection' });
    }

    /**
     * React to current script changes.
     * @param {object} script - Current script model.
     * @param {object} options - Load options.
     * @param {string} [options.source] - Event source.
     */
    async handleCurrentScriptChange (script, options = {}) {
        if (this.shouldSkipLoad(script)) {
            return;
        }

        await this.editorWidget.loadScript({
            script,
            source: options.source || 'selection',
            resetHistory: true
        });

        this.lastLoadedScriptId = script.id;
        this.lastLoadedVersion = script.versionNumber;
    }

    shouldSkipLoad (script) {
        if (!script || !this.editorWidget || !this.editorReady) {
            return true;
        }

        if (script.pending) {
            return true;
        }

        const isSameScript = this.lastLoadedScriptId !== null &&
            String(this.lastLoadedScriptId) === String(script.id);
        const isSameVersion = this.lastLoadedVersion !== null &&
            Number(this.lastLoadedVersion) === Number(script.versionNumber);

        return isSameScript && isSameVersion;
    }
}
