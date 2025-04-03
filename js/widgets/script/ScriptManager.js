import { BaseManager } from '../../core/BaseManager.js';
import { ERROR_MESSAGES } from '../../constants.js';
import { EventBus } from '../../core/EventBus.js';
import { StateManager } from '../../core/StateManager.js';

export class ScriptManager extends BaseManager {
    constructor(stateManager, api, eventBus) {
        super(stateManager);
        this.api = api;
        this.eventBus = eventBus;
        this.currentScriptId = null;
        this.scripts = [];
    }

    async loadScripts(userId) {
        try {
            this.setLoading(true);
            this.scripts = await this.api.getAllScriptsByUser(userId);
            console.log('scripts', this.scripts);
            // Update state with all scripts
            this.stateManager.setState(StateManager.KEYS.SCRIPTS, this.scripts);

            // Load last active script if available
            const lastScriptId = localStorage.getItem('currentScriptId');
            if (lastScriptId) {
                await this.loadScript(lastScriptId);
            }

            return this.scripts;
        } catch (error) {
            this.handleError(error, 'script');
            throw error;
        } finally {
            this.setLoading(false);
        }
    }

    async loadScript(id) {
        try {
            this.setLoading(true);
            const script = await this.api.getScript(id);

            // Update current script ID
            this.currentScriptId = id;
            localStorage.setItem('currentScriptId', id);

            // Update state with current script
            this.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT, script);

            // Publish script selected event
            this.eventBus.publish(EventBus.EVENTS.SCRIPT.SELECTED, { script });

            return script;
        } catch (error) {
            this.handleError(error, 'script');
            throw error;
        } finally {
            this.setLoading(false);
        }
    }

    async saveScript(scriptData) {
        try {
            this.setLoading(true);
            const script = await this.api.createScript(scriptData);

            // Add to scripts array and update state
            this.scripts.push(script);
            this.stateManager.setState(StateManager.KEYS.SCRIPTS, [...this.scripts]);

            // Publish script created event
            this.eventBus.publish(EventBus.EVENTS.SCRIPT.CREATED, { script });

            return script;
        } catch (error) {
            this.handleError(error, 'script');
            throw error;
        } finally {
            this.setLoading(false);
        }
    }

    async updateScript(id, scriptData) {
        try {
            this.setLoading(true);
            const script = await this.api.updateScript(id, scriptData);

            // Update scripts array and state
            const index = this.scripts.findIndex(s => s.id === id);
            if (index !== -1) {
                this.scripts[index] = script;
                this.stateManager.setState(StateManager.KEYS.SCRIPTS, [...this.scripts]);
            }

            // Update current script if this is the active one
            if (this.currentScriptId === id) {
                this.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT, script);
            }

            // Publish script updated event
            this.eventBus.publish(EventBus.EVENTS.SCRIPT.UPDATED, { script });

            return script;
        } catch (error) {
            this.handleError(error, 'script');
            throw error;
        } finally {
            this.setLoading(false);
        }
    }

    async deleteScript(id) {
        try {
            this.setLoading(true);
            await this.api.deleteScript(id);

            // Remove from scripts array and update state
            this.scripts = this.scripts.filter(s => s.id !== id);
            this.stateManager.setState(StateManager.KEYS.SCRIPTS, this.scripts);

            // Clear current script if this was the active one
            if (this.currentScriptId === id) {
                this.currentScriptId = null;
                localStorage.removeItem('currentScriptId');
                this.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT, null);
            }

            // Publish script deleted event
            this.eventBus.publish(EventBus.EVENTS.SCRIPT.DELETED, { scriptId: id });

        } catch (error) {
            this.handleError(error, 'script');
            throw error;
        } finally {
            this.setLoading(false);
        }
    }

    getCurrentScriptId() {
        return this.currentScriptId;
    }

    getScripts() {
        return this.scripts;
    }
}