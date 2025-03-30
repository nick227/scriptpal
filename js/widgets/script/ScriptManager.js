import { BaseManager } from '../../core/BaseManager.js';
import { ERROR_MESSAGES } from '../../constants.js';
import { EventBus } from '../../core/EventBus.js';

export class ScriptManager extends BaseManager {
    constructor(stateManager, api, eventBus) {
        super(stateManager);
        this.api = api;
        this.eventBus = eventBus;
        this.currentScriptId = null;
    }

    async loadScripts(userId) {
        try {
            this.setLoading(true);
            const scripts = await this.api.getAllScriptsByUser(userId);
            this.renderer.renderScriptList(scripts, this.currentScriptId);
            return scripts;
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
            this.currentScriptId = id;
            localStorage.setItem('currentScriptId', id);
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
            this.eventBus.publish(EventBus.EVENTS.SCRIPT.UPDATED, { script });
            return script;
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

    setCurrentScriptId(id) {
        this.currentScriptId = id;
    }
}