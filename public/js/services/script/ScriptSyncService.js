import { EventManager } from '../../core/EventManager.js';
import { StateManager } from '../../core/StateManager.js';
import { debugLog } from '../../core/logger.js';

/**
 *
 */
export class ScriptSyncService {
    /**
     *
     * @param scriptStore
     * @param eventManager
     */
    constructor (scriptStore, eventManager) {
        if (!scriptStore) throw new Error('ScriptStore is required for ScriptSyncService');
        if (!eventManager) throw new Error('EventManager is required for ScriptSyncService');

        this.scriptStore = scriptStore;
        this.eventManager = eventManager;
        this.updateTimeout = null;
        this.MIN_UPDATE_INTERVAL = 5000;
        this.DEBOUNCE_DELAY = 8000;
        this.lastUpdateTime = Date.now();

        // Subscribe to content changed events for non-edit updates
        this.eventManager.subscribe(
            EventManager.EVENTS.SCRIPT.CONTENT_CHANGED,
            this.handleContentChange.bind(this)
        );

        debugLog('[SYNC] Service initialized with:', {
            hasScriptStore: !!scriptStore,
            hasEventManager: !!eventManager,
            currentScript: scriptStore.getCurrentScript() && scriptStore.getCurrentScript().id
        });
    }

    /**
     *
     * @param data
     */
    async handleContentChange (data) {
        // Ignore edit updates - those are handled by ScriptOrchestrator
        if (data.source === 'edit') {
            return;
        }

        if (!data || !data.content || !data.scriptId) {
            console.warn('[SYNC] Invalid content change data');
            return;
        }

        const currentScript = this.scriptStore.getCurrentScript();
        if (!currentScript || currentScript.id !== data.scriptId) {
            console.warn('[SYNC] No matching script available for sync');
            return;
        }
        const currentContent = this.scriptStore.normalizeContent(currentScript.content);
        const incomingContent = this.scriptStore.normalizeContent(data.content);
        if (currentContent === incomingContent) {
            return;
        }

        try {
            // Apply debounce for regular updates
            if (this.updateTimeout) {
                clearTimeout(this.updateTimeout);
            }

            const timeSinceLastUpdate = Date.now() - this.lastUpdateTime;
            if (timeSinceLastUpdate < this.MIN_UPDATE_INTERVAL) {
                this.updateTimeout = setTimeout(() => this.processUpdate(data), this.DEBOUNCE_DELAY);
                return;
            }

            await this.processUpdate(data);

        } catch (error) {
            console.error('[SYNC] Update failed:', error);
            this.eventManager.publish(EventManager.EVENTS.SCRIPT.ERROR, {
                error: error.message,
                type: 'update',
                scriptId: data.scriptId,
                recoverable: true,
                source: data.source
            });
        }
    }

    /**
     *
     * @param data
     */
    async processUpdate (data) {
        const script = this.scriptStore.getCurrentScript();
        if (!script) return;

        debugLog('[SYNC] Processing update for script:', script.id, script.title);

        try {
            const result = await this.scriptStore.updateScript(script.id, {
                content: data.content,
                versionNumber: script.versionNumber,
                title: script.title
            });

            if (!result) {
                throw new Error('Update failed - no result returned');
            }

            this.lastUpdateTime = Date.now();

            // Update state and notify UI
            await this.scriptStore.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT, result);
            this.eventManager.publish(EventManager.EVENTS.SCRIPT.CONTENT_UPDATED, {
                script: result,
                source: data.source,
                preserveState: data.preserveState,
                timestamp: Date.now()
            });

        } catch (error) {
            throw error;
        }
    }

    /**
     *
     */
    destroy () {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
    }
}
