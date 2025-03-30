import { StateManager } from './core/StateManager.js';
import { EventManager } from './core/EventManager.js';

export class ScriptPalScript {
    constructor(api, user, chat) {
        this.api = api;
        this.user = user;
        this.chat = chat;
        this.stateManager = null;
        this.eventManager = null;
    }

    async initialize() {
        if (!this.user.currentUser) {
            throw new Error('Cannot initialize script manager without authenticated user');
        }

        this.userId = this.user.currentUser.id;
        const scripts = await this.api.getAllScriptsByUser(this.userId);
        this.stateManager.setState(StateManager.KEYS.SCRIPTS, scripts);

        this.checkCurrentScriptId();
        this.loadCurrentScript();
    }

    clearCurrentScript() {
        localStorage.removeItem('currentScriptId');
        this.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT, null);
    }

    checkCurrentScriptId() {
        const currentScriptId = localStorage.getItem('currentScriptId');
        if (currentScriptId) {
            this.setCurrentScript(currentScriptId);
        }
    }

    setCurrentScript(currentScriptId) {
        const scripts = this.stateManager.getState(StateManager.KEYS.SCRIPTS);
        const currentScript = scripts.find(script => script.id === currentScriptId);

        localStorage.setItem('currentScriptId', currentScriptId);
        this.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT, currentScript);

        this.eventManager.publish(EventManager.EVENTS.SCRIPT.SELECTED, { scriptId: currentScriptId });
    }

    loadCurrentScript() {
        const scripts = this.stateManager.getState(StateManager.KEYS.SCRIPTS);
        if (!scripts || scripts.length === 0) {
            this.eventManager.publish(EventManager.EVENTS.SCRIPT.UPDATED, {
                message: "You don't have any scripts yet. Would you like to create one?",
                type: 'assistant'
            });
            return;
        }

        const currentScript = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
        if (currentScript) {
            this.eventManager.publish(EventManager.EVENTS.SCRIPT.UPDATED, {
                message: `The current script is ${currentScript.title}`,
                type: 'assistant'
            });
            this.eventManager.publish(EventManager.EVENTS.SCRIPT.ACTIONS, {
                actions: [
                    { text: "Edit Script", actionType: "edit", scriptId: currentScript.id },
                    { text: "Delete Script", actionType: "delete", scriptId: currentScript.id }
                ]
            });
        } else {
            this.eventManager.publish(EventManager.EVENTS.SCRIPT.UPDATED, {
                message: "What script should we work on?",
                type: 'assistant'
            });
            this.eventManager.publish(EventManager.EVENTS.SCRIPT.BUTTONS, {
                buttons: scripts.map(script => ({
                    text: script.title,
                    actionType: "select",
                    scriptId: script.id
                }))
            });
        }
    }

    setManagers(stateManager, eventManager) {
        this.stateManager = stateManager;
        this.eventManager = eventManager;
    }
}