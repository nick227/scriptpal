import { UI_ELEMENTS } from '../../constants.js';
import { StateManager } from '../../core/StateManager.js';
import { RendererFactory } from '../../renderers.js';
import { BaseWidget } from '../BaseWidget.js';

/**
 *
 */
export class ScriptWidget extends BaseWidget {
    constructor (elements, stateManager, eventManager) {
        super(elements);
        this.renderer = null;
        this.scriptStore = null;
        this.visibilityPicker = null;
        this.isMinimized  = false;
        this.listContainer = null;
        this.listClickHandler = null;
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
        createButton.innerHTML = '<i class="fas fa-plus"></i>';
        createButton.title = 'Create New Script';
        createButton.addEventListener('click', () => this.handleCreateScript());

        const listContainer = document.createElement('ul');
        listContainer.className = 'script-panel-list script-list';
        this.listClickHandler = this.handleListClick.bind(this);
        listContainer.addEventListener('click', this.listClickHandler);
        this.listContainer = listContainer;

        panelContainer.appendChild(header);
        panelContainer.appendChild(listContainer);

        panelContainer.addEventListener('click', () =>
            panelContainer.classList.contains('is-minimized') && this.toggleMinimize()
        );

        this.renderer = RendererFactory.createScriptRenderer(listContainer);

        this.visibilityPicker = this.createVisibilityPicker();
        this.minimizeBtn = this.createMinimizeBtn();
        const controls = document.createElement('div');
        controls.className = 'script-panel-header__controls';
        controls.appendChild(createButton);
        controls.appendChild(this.visibilityPicker);
        controls.appendChild(this.minimizeBtn);
        header.innerHTML = '';
        header.appendChild(controls);

        // Set up state subscriptions
        this.setupStateSubscriptions();

        // Prime with existing state
        this.handleScriptsUpdate(this.stateManager.getState(StateManager.KEYS.SCRIPTS));
        this.handleCurrentScriptUpdate(this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT));
    }


    toggleMinimize () {
        this.isMinimized = !this.isMinimized;

        // fire side-effect
        this.onMinimizeChange(this.isMinimized);
    }

    onMinimizeChange (isMinimized) {
        const panel = document.querySelector(UI_ELEMENTS.USER_SCRIPTS_PANEL);
        if (!panel) return;

        panel.classList.toggle('is-minimized', isMinimized);
    }

    createMinimizeBtn () {
        const btn = document.createElement('button');
        btn.className = 'chat-action-btn';
        btn.title = 'Minimize';
        btn.dataset.action = 'minimize';
        btn.setAttribute('aria-label', 'Minimize chat');
        btn.innerHTML = '<i class="fas fa-minus"></i>';

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMinimize();
            e.preventDefault();
        });

        return btn;
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
        if (!this.renderer) return;
        const scriptId = script ? script.id : null;
        this.renderer.updateActiveScript(scriptId);
    }

    /**
     *
     * @param scriptId
     */
    handleScriptSelect (scriptId) {
        if (!scriptId || !this.scriptStore) return;
        this.scriptStore.selectScript(scriptId, { source: 'panel' });
    }

    handleListClick (event) {
        if (!event) return;
        const actionButton = event.target.closest('[data-action]');
        const scriptItem = event.target.closest('[data-script-id]');
        if (!scriptItem) {
            return;
        }
        const scriptId = scriptItem.dataset.scriptId;
        if (actionButton) {
            const action = actionButton.dataset.action;
            if (action === 'delete') {
                event.preventDefault();
                event.stopPropagation();
                this.handleDeleteScript(scriptId);
            }
            return;
        }
        this.handleScriptSelect(scriptId);
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

    async handleDeleteScript (scriptId) {
        if (!this.scriptStore) {
            return;
        }
        try {
            await this.scriptStore.deleteScript(scriptId);
        } catch (error) {
            console.error('[SCRIPT_WIDGET] Failed to delete script:', error);
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
     * Build visibility filter picker for user scripts
     * @returns {HTMLElement}
     */
    createVisibilityPicker () {
        const picker = document.createElement('div');
        picker.className = 'visibility-picker';

        const select = document.createElement('select');
        select.className = 'visibility-picker__select';

        const options = [
            { value: 'all', label: 'All' },
            { value: 'private', label: 'Private' },
            { value: 'public', label: 'Public' }
        ];

        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            select.appendChild(option);
        });

        select.value = this.scriptStore ? this.scriptStore.visibilityFilter : 'all';

        select.addEventListener('change', (event) => {
            const filteredValue = event.target.value;
            if (this.scriptStore) {
                this.scriptStore.setVisibilityFilter(filteredValue);
            }
        });

        picker.appendChild(select);

        return picker;
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
        if (this.listContainer && this.listClickHandler) {
            this.listContainer.removeEventListener('click', this.listClickHandler);
        }
        this.listContainer = null;
        this.listClickHandler = null;
    }
}
