import { UI_ELEMENTS } from '../../constants.js';
import { StateManager } from '../../core/StateManager.js';
import { RendererFactory } from '../../renderers.js';
import { BaseWidget } from '../BaseWidget.js';

/**
 *
 */
export class ScriptWidget extends BaseWidget {
    /**
     *
     * @param elements
     */
    /**
     *
     * @param elements
     * @param stateManager
     * @param eventManager
     */
    constructor (elements, stateManager, eventManager) {
        super(elements);
        this.renderer = null;
        this.scriptStore = null;
        this.setManagers(stateManager, eventManager);
    }

    /**
     *
     * @param scriptStore
     */
    async initialize (options = {}) {
        if (options.scriptStore) {
            this.scriptStore = options.scriptStore;
        }
        await super.initialize();

        // Initialize renderer
        const panelContainer = document.querySelector(UI_ELEMENTS.USER_SCRIPTS_PANEL);
        if (!panelContainer) {
            throw new Error('Scripts container element not found');
        }

        panelContainer.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'script-panel-header';

        const createButton = document.createElement('button');
        createButton.className = 'create-script-button';
        createButton.type = 'button';
        createButton.innerHTML = '<i class="fas fa-plus"></i> New Script';
        createButton.title = 'Create New Script';
        createButton.addEventListener('click', () => this.handleCreateScript());

        header.appendChild(createButton);
        panelContainer.appendChild(header);

        const listContainer = document.createElement('ul');
        listContainer.className = 'script-panel-list';
        panelContainer.appendChild(listContainer);

        this.renderer = RendererFactory.createScriptRenderer(
            listContainer,
            this.handleScriptSelect.bind(this)
        );

        // Set up state subscriptions
        this.setupStateSubscriptions();

        // Prime with existing state
        this.handleScriptsUpdate(this.stateManager.getState(StateManager.KEYS.SCRIPTS));
        this.handleCurrentScriptUpdate(this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT));
    }

    /**
     *
     * @param scriptStore
     */
    /**
     *
     */
    setupStateSubscriptions () {
        this.subscribeToState(StateManager.KEYS.SCRIPTS, this.handleScriptsUpdate.bind(this));
        this.subscribeToState(StateManager.KEYS.CURRENT_SCRIPT, this.handleCurrentScriptUpdate.bind(this));
    }

    /**
     *
     * @param scripts
     */
    handleScriptsUpdate (scripts) {
        if (!scripts || !this.renderer) return;

        const currentScriptId = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT_ID);
        this.renderer.render(scripts, currentScriptId);
    }

    /**
     *
     * @param script
     */
    handleCurrentScriptUpdate (script) {
        if (!script || !this.renderer) return;
        this.renderer.updateActiveScript(script.id);
    }

    /**
     *
     * @param scriptId
     */
    handleScriptSelect (scriptId) {
        if (!scriptId || !this.scriptStore) return;
        this.scriptStore.selectScript(scriptId, { source: 'panel' });
    }

    /**
     *
     */
    async handleCreateScript () {
        try {
            if (!this.scriptStore) {
                throw new Error('No ScriptStore available');
            }
            const user = this.stateManager.getState(StateManager.KEYS.USER);
            await this.scriptStore.createScript(user.id, {
                title: 'Untitled Script',
                content: ''
            });
        } catch (error) {
            console.error('[SCRIPT_WIDGET] Failed to create script:', error);
        }
    }

    /**
     *
     * @param {object} orchestrator
     */
    setScriptStore (scriptStore) {
        this.scriptStore = scriptStore;
    }

    /**
     *
     */
    destroy () {
        if (this.renderer) {
            this.renderer.clear();
        }
        super.destroy();
        this.renderer = null;
    }
}
