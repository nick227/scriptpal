import { EventManager } from '../../core/EventManager.js';
import { StateManager } from '../../core/StateManager.js';

export class ScriptItemController {
    constructor (options) {
        if (!options.store) {
            throw new Error('Store is required for ScriptItemController');
        }
        if (!options.stateManager) {
            throw new Error('StateManager is required for ScriptItemController');
        }
        if (!options.eventManager) {
            throw new Error('EventManager is required for ScriptItemController');
        }

        this.store = options.store;
        this.stateManager = options.stateManager;
        this.eventManager = options.eventManager;
        this.currentScriptId = null;

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
            this.currentScriptId = null;
            this.store.clearState();
            return;
        }
        const normalizedId = Number(script.id);
        if (this.currentScriptId === normalizedId) {
            return;
        }
        this.currentScriptId = normalizedId;
        await this.store.loadItems(normalizedId);
    }

    handleScriptDeleted (event) {
        const currentScript = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
        if (currentScript && String(currentScript.id) === String(event.scriptId)) {
            this.store.clearState();
        }
    }
}
