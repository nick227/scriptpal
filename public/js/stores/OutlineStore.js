import { StateManager } from '../core/StateManager.js';
import { ScriptItemStore } from './ScriptItemStore.js';
import { ITEM_LABELS } from '../shared/itemLabels.js';

export class OutlineStore extends ScriptItemStore {
    constructor (api, stateManager, eventManager) {
        super(api, stateManager, eventManager, {
            stateKey: StateManager.KEYS.OUTLINES,
            currentIdKey: StateManager.KEYS.CURRENT_OUTLINE_ID,
            itemLabel: ITEM_LABELS.OUTLINE,
            orderKey: 'outlineId',
            apiHandlers: {
                list: (scriptId) => api.entities.getOutlines(scriptId),
                create: (scriptId, payload) => api.entities.createOutline(scriptId, payload),
                update: (scriptId, outlineId, payload) => api.entities.updateOutline(scriptId, outlineId, payload),
                delete: (scriptId, outlineId) => api.entities.deleteOutline(scriptId, outlineId),
                reorder: (scriptId, order) => api.entities.reorderOutlines(scriptId, order),
                generateIdea: (scriptId, outlineId, payload) => api.entities.generateOutlineIdea(scriptId, outlineId, payload),
                generateIdeaDraft: (scriptId, payload) => api.entities.generateOutlineIdeaDraft(scriptId, payload)
            }
        });
    }

    async loadOutlines (scriptId, options = {}) {
        return this.loadItems(scriptId, options);
    }

    async createOutline (scriptId, outlineData) {
        return this.createItem(scriptId, outlineData);
    }

    async updateOutline (scriptId, outlineId, outlineData) {
        return this.updateItem(scriptId, outlineId, outlineData);
    }

    async deleteOutline (scriptId, outlineId) {
        return this.deleteItem(scriptId, outlineId);
    }

    async generateOutlineIdea (scriptId, outlineId, draft = {}) {
        return this.generateIdea(scriptId, outlineId, draft);
    }

    async reorderOutlines (scriptId, order) {
        return this.reorderItems(scriptId, order);
    }
}
