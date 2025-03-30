import { BaseWidget } from '../BaseWidget.js';
import { StateManager } from '../../core/StateManager.js';
import { EventManager } from '../../core/EventManager.js';
import { ButtonElementRenderer } from '../../renderers.js';

export class ScriptWidget extends BaseWidget {
    constructor(elements) {
        super(elements);
        this.scriptManager = null;
        this.buttonRenderer = null;
    }

    async initialize(scriptManager) {
        this.scriptManager = scriptManager;
        await super.initialize();
        this.buttonRenderer = new ButtonElementRenderer(this.renderer.container);
    }

    setupEventListeners() {
        this.subscribe(EventManager.EVENTS.SCRIPT.UPDATED, this.handleScriptUpdate.bind(this));
        this.subscribe(EventManager.EVENTS.SCRIPT.ACTIONS, this.handleScriptActions.bind(this));
        this.subscribe(EventManager.EVENTS.SCRIPT.BUTTONS, this.handleScriptButtons.bind(this));
    }

    setupStateSubscriptions() {
        this.subscribeToState(StateManager.KEYS.SCRIPTS, this.handleScriptsUpdate.bind(this));
        this.subscribeToState(StateManager.KEYS.CURRENT_SCRIPT, this.handleCurrentScriptUpdate.bind(this));
    }

    handleScriptUpdate(data) {
        this.renderer.createElement('div', `message ${data.type}`, data.message);
    }

    handleScriptActions(data) {
        const actionsContainer = this.renderer.createContainer('script-actions');
        data.actions.forEach(action => {
            const button = this.buttonRenderer.render(action, () => this.handleAction(action));
            if (button) {
                actionsContainer.appendChild(button);
            }
        });
        this.renderer.appendElement(actionsContainer);
    }

    handleScriptButtons(data) {
        const buttonsContainer = this.renderer.createContainer('script-buttons');
        data.buttons.forEach(button => {
            const btn = this.buttonRenderer.render(button, () => this.handleButtonClick(button));
            if (btn) {
                buttonsContainer.appendChild(btn);
            }
        });
        this.renderer.appendElement(buttonsContainer);
    }

    handleScriptsUpdate(scripts) {
        const scriptsList = this.renderer.createContainer('scripts-list');
        scripts.forEach(script => {
            const scriptElement = this.renderer.createElement('div', 'script-item', script.title);
            this.renderer.addEventListener(scriptElement, 'click', () => this.handleScriptSelect(script));
            scriptsList.appendChild(scriptElement);
        });

        this.renderer.clear();
        this.renderer.appendElement(scriptsList);
    }

    handleCurrentScriptUpdate(script) {
        if (script) {
            const currentScriptElement = this.renderer.createElement('div', 'current-script', `Current Script: ${script.title}`);
            this.renderer.clear();
            this.renderer.appendElement(currentScriptElement);
        }
    }

    handleAction(action) {
        switch (action.actionType) {
            case 'edit':
                this.publish(EventManager.EVENTS.SCRIPT.EDIT, { scriptId: action.scriptId });
                break;
            case 'delete':
                this.publish(EventManager.EVENTS.SCRIPT.DELETE, { scriptId: action.scriptId });
                break;
        }
    }

    handleButtonClick(button) {
        switch (button.actionType) {
            case 'select':
                this.handleScriptSelect({ id: button.scriptId });
                break;
        }
    }

    handleScriptSelect(script) {
        this.scriptManager.setCurrentScript(script.id);
    }

    update(scriptManager) {
        this.scriptManager = scriptManager;
    }

    destroy() {
        super.destroy();
        this.buttonRenderer = null;
    }
}