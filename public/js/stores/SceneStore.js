import { StateManager } from '../core/StateManager.js';
import { ScriptItemStore } from './ScriptItemStore.js';
import { ITEM_LABELS } from '../shared/itemLabels.js';

export class SceneStore extends ScriptItemStore {
    constructor (api, stateManager, eventManager) {
        super(api, stateManager, eventManager, {
            stateKey: StateManager.KEYS.SCENES,
            currentIdKey: StateManager.KEYS.CURRENT_SCENE_ID,
            itemLabel: ITEM_LABELS.SCENE,
            orderKey: 'sceneId',
            apiHandlers: {
                list: (scriptId) => api.entities.getScenes(scriptId),
                create: (scriptId, payload) => api.entities.createScene(scriptId, payload),
                update: (scriptId, sceneId, payload) => api.entities.updateScene(scriptId, sceneId, payload),
                delete: (scriptId, sceneId) => api.entities.deleteScene(scriptId, sceneId),
                reorder: (scriptId, order) => api.entities.reorderScenes(scriptId, order),
                generateIdea: (scriptId, sceneId, payload) => api.entities.generateSceneIdea(scriptId, sceneId, payload),
                generateIdeaDraft: (scriptId, payload) => api.entities.generateSceneIdeaDraft(scriptId, payload)
            }
        });
    }

    async loadScenes (scriptId, options = {}) {
        return this.loadItems(scriptId, options);
    }

    async createScene (scriptId, sceneData) {
        return this.createItem(scriptId, sceneData);
    }

    async updateScene (scriptId, sceneId, sceneData) {
        return this.updateItem(scriptId, sceneId, sceneData);
    }

    async deleteScene (scriptId, sceneId) {
        return this.deleteItem(scriptId, sceneId);
    }

    async generateSceneIdea (scriptId, sceneId, draft = {}) {
        return this.generateIdea(scriptId, sceneId, draft);
    }

    async reorderScenes (scriptId, order) {
        return this.reorderItems(scriptId, order);
    }

    setScenes (scenes) {
        this.setItems(scenes);
    }

    setCurrentSceneId (sceneId) {
        this.setCurrentItemId(sceneId);
    }

    getScenes () {
        return this.getItems();
    }

    getCurrentSceneId () {
        return this.getCurrentItemId();
    }
}
