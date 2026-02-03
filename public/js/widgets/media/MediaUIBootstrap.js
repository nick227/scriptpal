import { UI_ELEMENTS } from '../../constants.js';
import { StateManager } from '../../core/StateManager.js';
import { MediaStore } from '../../stores/MediaStore.js';
import { MediaBrowserWidget } from './MediaBrowserWidget.js';
import { MediaPickerWidget } from './MediaPickerWidget.js';

/**
 * MediaUIBootstrap - Initializes the Media panel in the side panel
 * Handles store creation, widget setup, and state subscriptions
 * Uses the unified media library for all media types
 */
export class MediaUIBootstrap {
    constructor (options) {
        if (!options.api) {
            throw new Error('API is required for MediaUIBootstrap');
        }
        if (!options.stateManager) {
            throw new Error('StateManager is required for MediaUIBootstrap');
        }
        if (!options.eventManager) {
            throw new Error('EventManager is required for MediaUIBootstrap');
        }

        this.api = options.api;
        this.stateManager = options.stateManager;
        this.eventManager = options.eventManager;
        this.store = options.mediaStore || null;
        this.panelSelector = UI_ELEMENTS.USER_MEDIA_PANEL;
        this.widget = null;
        this.mediaPicker = null;
        this.panelContainer = null;
        this.currentUserId = null;
        this.currentScriptId = null;
    }

    async initialize () {
        this.panelContainer = document.querySelector(this.panelSelector);

        if (!this.panelContainer) {
            throw new Error('Media panel not found');
        }
        if (!this.store) {
            this.store = new MediaStore(this.api, this.stateManager, this.eventManager);
        }

        this.mediaPicker = new MediaPickerWidget({
            api: this.api,
            label: 'Add Media',
            type: 'image',
            onAttached: () => this.handleMediaAttached()
        });
        await this.mediaPicker.initialize();

        this.widget = new MediaBrowserWidget();
        this.widget.setManagers(this.stateManager, this.eventManager);
        this.widget.setStore(this.store);
        this.widget.setMediaPicker(this.mediaPicker);
        await this.widget.initialize();

        this.stateManager.subscribe(StateManager.KEYS.USER, this.handleUserChange.bind(this));
        this.stateManager.subscribe(StateManager.KEYS.CURRENT_SCRIPT, this.handleScriptChange.bind(this));

        await this.handleUserChange(this.stateManager.getState(StateManager.KEYS.USER));
        await this.handleScriptChange(this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT));
    }

    async handleUserChange (user) {
        const userId = user && user.id ? user.id : null;
        if (userId && this.currentUserId && String(this.currentUserId) !== String(userId)) {
            this.store.clearState();
        }
        this.currentUserId = userId;

        if (!userId) {
            this.hidePanel();
            this.store.clearState();
        }
    }

    async handleScriptChange (script) {
        const scriptId = script && script.id ? script.id : null;
        if (scriptId !== this.currentScriptId) {
            this.currentScriptId = scriptId;
            if (scriptId) {
                await this.store.loadItems(scriptId);
            } else {
                this.store.clearState();
            }
        }
    }

    async handleMediaAttached () {
        if (this.currentScriptId) {
            await this.store.refreshItems();
        }
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
        this.mediaPicker = null;
    }
}
