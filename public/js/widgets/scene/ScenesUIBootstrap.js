import { UI_ELEMENTS } from '../../constants.js';
import { StateManager } from '../../core/StateManager.js';
import { SceneStore } from '../../stores/SceneStore.js';
import { ScenesController } from '../../services/script/ScenesController.js';
import { SceneBrowserWidget } from './SceneBrowserWidget.js';

export class ScenesUIBootstrap {
    constructor (options) {
        if (!options.api) {
            throw new Error('API is required for ScenesUIBootstrap');
        }
        if (!options.stateManager) {
            throw new Error('StateManager is required for ScenesUIBootstrap');
        }
        if (!options.eventManager) {
            throw new Error('EventManager is required for ScenesUIBootstrap');
        }

        this.api = options.api;
        this.stateManager = options.stateManager;
        this.eventManager = options.eventManager;
        this.sceneStore = options.sceneStore || null;
        this.scenesController = null;
        this.sceneBrowserWidget = null;
        this.panelContainer = null;
        this.currentUserId = null;
    }

    async initialize () {
        this.panelContainer = document.querySelector(UI_ELEMENTS.USER_SCENES_PANEL);

        if (!this.panelContainer) {
            throw new Error('User scenes panel not found');
        }
        if (!this.sceneStore) {
            this.sceneStore = new SceneStore(this.api, this.stateManager, this.eventManager);
        }
        this.scenesController = new ScenesController({
            sceneStore: this.sceneStore,
            stateManager: this.stateManager,
            eventManager: this.eventManager
        });

        this.sceneBrowserWidget = new SceneBrowserWidget();
        this.sceneBrowserWidget.setManagers(this.stateManager, this.eventManager);
        this.sceneBrowserWidget.setSceneStore(this.sceneStore);
        await this.sceneBrowserWidget.initialize();
        this.stateManager.subscribe(StateManager.KEYS.USER, this.handleUserChange.bind(this));
        await this.handleUserChange(this.stateManager.getState(StateManager.KEYS.USER));
    }

    async handleUserChange (user) {
        const userId = user && user.id ? user.id : null;
        if (userId && this.currentUserId && String(this.currentUserId) !== String(userId)) {
            this.sceneStore.clearState();
        }
        this.currentUserId = userId;

        if (userId) {
            // this.showScenesUI();
            return;
        }

        this.hideScenesUI();
        this.sceneStore.clearState();
    }

    showScenesUI () {
        this.panelContainer.classList.remove('hidden');
    }

    hideScenesUI () {
        this.panelContainer.classList.add('hidden');
    }

    destroy () {
        if (this.sceneBrowserWidget) {
            this.sceneBrowserWidget.destroy();
            this.sceneBrowserWidget = null;
        }
        this.sceneStore = null;
        this.scenesController = null;
    }
}
