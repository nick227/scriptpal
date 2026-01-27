import { UI_ELEMENTS } from '../../constants.js';
import { ScriptsController } from '../../services/script/ScriptsController.js';
import { StateManager } from '../../core/StateManager.js';
import { ScriptStore } from '../../stores/ScriptStore.js';
import { EditorWidget } from '../editor/EditorWidget.js';

import { ScriptWidget } from './ScriptWidget.js';

/**
 * ScriptsUIBootstrap - wires script list UIs to state and API
 */
export class ScriptsUIBootstrap {
    /**
     * @param {object} options
     * @param {object} options.api
     * @param {StateManager} options.stateManager
     * @param {object} options.eventManager
     */
    constructor (options) {
        if (!options.api) {
            throw new Error('API is required for ScriptsUIBootstrap');
        }
        if (!options.stateManager) {
            throw new Error('StateManager is required for ScriptsUIBootstrap');
        }
        if (!options.eventManager) {
            throw new Error('EventManager is required for ScriptsUIBootstrap');
        }

        this.api = options.api;
        this.stateManager = options.stateManager;
        this.eventManager = options.eventManager;
        this.scriptStore = options.scriptStore || null;
        this.scriptsController = null;
        this.scriptWidget = null;
        this.panelContainer = null;
        this.editorContainer = null;
        this.editorToolbar = null;
        this.editorWidget = null;
        this.editorReady = false;
        this.currentUserId = null;
    }

    /**
     *
     */
    async initialize () {
        this.panelContainer = document.querySelector(UI_ELEMENTS.USER_SCRIPTS_PANEL);
        this.editorContainer = document.querySelector(UI_ELEMENTS.EDITOR_CONTAINER);
        this.editorToolbar = this.editorContainer
            ? this.editorContainer.querySelector(UI_ELEMENTS.EDITOR_TOOLBAR)
            : null;

        if (!this.panelContainer) {
            throw new Error('User scripts panel not found');
        }
        if (!this.editorContainer) {
            throw new Error('Editor container not found');
        }
        if (!this.editorToolbar) {
            throw new Error('Editor toolbar not found');
        }

        if (!this.scriptStore) {
            this.scriptStore = new ScriptStore(this.api, this.stateManager, this.eventManager);
        }
        this.scriptsController = new ScriptsController({
            scriptStore: this.scriptStore,
            stateManager: this.stateManager,
            eventManager: this.eventManager
        });

        this.scriptWidget = new ScriptWidget();
        this.scriptWidget.setManagers(this.stateManager, this.eventManager);
        this.scriptWidget.setScriptStore(this.scriptStore);
        await this.scriptWidget.initialize();

        this.stateManager.subscribe(StateManager.KEYS.USER, this.handleUserChange.bind(this));
        await this.handleUserChange(this.stateManager.getState(StateManager.KEYS.USER));
    }

    /**
     *
     * @param user
     */
    async handleUserChange (user) {
        const userId = user && user.id ? user.id : null;
        if (userId && this.currentUserId && String(this.currentUserId) !== String(userId)) {
            this.scriptStore.clearState();
        }
        this.currentUserId = userId;

        if (userId) {
            this.showScriptsUI();

            if (!this.editorWidget) {
                this.editorWidget = new EditorWidget({
                    container: this.editorContainer,
                    toolbar: this.editorToolbar
                });
                this.editorReady = await this.editorWidget.initialize(
                    this.api,
                    user,
                    this.scriptStore,
                    this.stateManager
                );
                this.scriptsController.setEditorWidget(this.editorWidget, this.editorReady);
                if (this.editorReady) {
                    this.stateManager.setState(StateManager.KEYS.EDITOR_READY, true);
                }
            }
            return;
        }

        this.hideScriptsUI();
        this.scriptStore.clearState();
    }

    getEditorWidget () {
        return this.editorWidget;
    }

    isEditorReady () {
        return Boolean(this.editorReady);
    }

    /**
     *
     */
    showScriptsUI () {
        this.panelContainer.classList.remove('hidden');
    }

    /**
     *
     */
    hideScriptsUI () {
        this.panelContainer.classList.add('hidden');
    }

    /**
     *
     */
    destroy () {
        if (this.scriptWidget) {
            this.scriptWidget.destroy();
            this.scriptWidget = null;
        }
        if (this.editorWidget) {
            this.editorWidget.destroy();
            this.editorWidget = null;
        }
        this.scriptStore = null;
        this.scriptsController = null;
    }
}
