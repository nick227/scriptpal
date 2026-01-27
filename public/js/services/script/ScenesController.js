import { EventManager } from '../../core/EventManager.js';
import { StateManager } from '../../core/StateManager.js';

export class ScenesController {
    constructor (options) {
        if (!options.sceneStore) {
            throw new Error('SceneStore is required for ScenesController');
        }
        if (!options.stateManager) {
            throw new Error('StateManager is required for ScenesController');
        }
        if (!options.eventManager) {
            throw new Error('EventManager is required for ScenesController');
        }

        this.sceneStore = options.sceneStore;
        this.stateManager = options.stateManager;
        this.eventManager = options.eventManager;

        this.setupStateSubscriptions();
        this.setupEventSubscriptions();
    }

    setupStateSubscriptions () {
        this.stateManager.subscribe(
            StateManager.KEYS.CURRENT_SCRIPT,
            this.handleCurrentScriptChange.bind(this)
        );
        this.handleCurrentScriptChange(this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT));
    }

    setupEventSubscriptions () {
        this.eventManager.subscribe(
            EventManager.EVENTS.SCRIPT.DELETED,
            this.handleScriptDeleted.bind(this)
        );
    }

    async handleCurrentScriptChange (script) {
        if (!script || !script.id) {
            this.sceneStore.clearState();
            return;
        }
        await this.sceneStore.loadScenes(script.id);
    }

    handleScriptDeleted (event) {
        const currentScript = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
        if (currentScript && String(currentScript.id) === String(event.scriptId)) {
            this.sceneStore.clearState();
        }
    }
}
