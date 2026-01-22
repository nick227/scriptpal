import { UI_ELEMENTS } from '../../constants.js';
import { StateManager } from '../../core/StateManager.js';
import { ScriptsController } from '../../controllers/ScriptsController.js';
import { ScriptStore } from '../../stores/ScriptStore.js';

import { EditorWidget } from '../editor/EditorWidget.js';
import { ScriptListWidget } from './ScriptListWidget.js';
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
        this.scriptListWidget = null;
        this.panelContainer = null;
        this.dropdownContainer = null;
        this.editorContainer = null;
        this.editorToolbar = null;
        this.editorWidget = null;
        this.editorReady = false;
    }

    /**
     *
     */
    async initialize () {
        this.panelContainer = document.querySelector(UI_ELEMENTS.USER_SCRIPTS_PANEL);
        this.dropdownContainer = document.querySelector('.script-selector');
        this.editorContainer = document.querySelector(UI_ELEMENTS.EDITOR_CONTAINER);
        this.editorToolbar = this.editorContainer
            ? this.editorContainer.querySelector(UI_ELEMENTS.EDITOR_TOOLBAR)
            : null;

        if (!this.panelContainer) {
            throw new Error('User scripts panel not found');
        }
        if (!this.dropdownContainer) {
            throw new Error('Script selector container not found');
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
        await this.scriptWidget.initialize();

        this.scriptListWidget = new ScriptListWidget({
            container: this.dropdownContainer,
            stateManager: this.stateManager,
            eventManager: this.eventManager
        });

        this.stateManager.subscribe(StateManager.KEYS.USER, this.handleUserChange.bind(this));
        this.handleUserChange(this.stateManager.getState(StateManager.KEYS.USER));
    }

    /**
     *
     * @param user
     */
    async handleUserChange (user) {
        if (user && user.id) {
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
            }
            return;
        }

        this.hideScriptsUI();
        this.scriptStore.clearState();
    }

    /**
     *
     */
    showScriptsUI () {
        this.panelContainer.classList.remove('hidden');
        this.dropdownContainer.classList.remove('hidden');
    }

    /**
     *
     */
    hideScriptsUI () {
        this.panelContainer.classList.add('hidden');
        this.dropdownContainer.classList.add('hidden');
    }

    /**
     *
     */
    destroy () {
        if (this.scriptListWidget) {
            this.scriptListWidget.destroy();
            this.scriptListWidget = null;
        }
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
