import { StateManager } from '../../core/StateManager.js';
import { ScriptItemController } from '../../services/script/ScriptItemController.js';

export class ScriptItemUIBootstrap {
    constructor (options) {
        if (!options.api) {
            throw new Error('API is required for ScriptItemUIBootstrap');
        }
        if (!options.stateManager) {
            throw new Error('StateManager is required for ScriptItemUIBootstrap');
        }
        if (!options.eventManager) {
            throw new Error('EventManager is required for ScriptItemUIBootstrap');
        }
        if (!options.storeClass) {
            throw new Error('Store class is required for ScriptItemUIBootstrap');
        }
        if (!options.widgetClass) {
            throw new Error('Widget class is required for ScriptItemUIBootstrap');
        }
        if (!options.panelSelector) {
            throw new Error('Panel selector is required for ScriptItemUIBootstrap');
        }

        this.api = options.api;
        this.stateManager = options.stateManager;
        this.eventManager = options.eventManager;
        this.store = options.store || null;
        this.storeClass = options.storeClass;
        this.widgetClass = options.widgetClass;
        this.panelSelector = options.panelSelector;
        this.controller = null;
        this.widget = null;
        this.panelContainer = null;
        this.currentUserId = null;
    }

    async initialize () {
        this.panelContainer = document.querySelector(this.panelSelector);

        if (!this.panelContainer) {
            throw new Error('Panel not found');
        }
        if (!this.store) {
            this.store = new this.storeClass(this.api, this.stateManager, this.eventManager);
        }
        this.controller = new ScriptItemController({
            store: this.store,
            stateManager: this.stateManager,
            eventManager: this.eventManager
        });

        this.widget = new this.widgetClass();
        this.widget.setManagers(this.stateManager, this.eventManager);
        if (typeof this.widget.setStore === 'function') {
            this.widget.setStore(this.store);
        }
        await this.widget.initialize();

        this.stateManager.subscribe(StateManager.KEYS.USER, this.handleUserChange.bind(this));
        await this.handleUserChange(this.stateManager.getState(StateManager.KEYS.USER));
    }

    async handleUserChange (user) {
        const userId = user && user.id ? user.id : null;
        if (userId && this.currentUserId && String(this.currentUserId) !== String(userId)) {
            this.store.clearState();
        }
        this.currentUserId = userId;

        if (userId) {
            return;
        }

        this.hidePanel();
        this.store.clearState();
    }

    showPanel () {
        this.panelContainer.classList.remove('hidden');
    }

    hidePanel () {
        this.panelContainer.classList.add('hidden');
    }

    destroy () {
        if (this.widget) {
            this.widget.destroy();
            this.widget = null;
        }
        this.store = null;
        this.controller = null;
    }
}
