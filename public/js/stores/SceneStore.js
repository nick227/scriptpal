import { BaseManager } from '../core/BaseManager.js';
import { StateManager } from '../core/StateManager.js';

export class SceneStore extends BaseManager {
    constructor (api, stateManager, eventManager) {
        super(stateManager);
        if (!api) throw new Error('API is required for SceneStore');
        if (!eventManager) throw new Error('EventManager is required for SceneStore');

        this.api = api;
        this.eventManager = eventManager;
        this.scenes = [];
        this.currentScriptId = null;
        this.currentSceneId = null;
        this.isLoading = false;
    }

    setScenes (scenes) {
        this.scenes = Array.isArray(scenes) ? scenes : [];
        this.stateManager.setState(StateManager.KEYS.SCENES, this.scenes);
    }

    setCurrentSceneId (sceneId) {
        this.currentSceneId = sceneId ? Number(sceneId) : null;
        this.stateManager.setState(StateManager.KEYS.CURRENT_SCENE_ID, this.currentSceneId);
    }

    getScenes () {
        return this.scenes;
    }

    getCurrentSceneId () {
        return this.currentSceneId;
    }

    async loadScenes (scriptId, options = {}) {
        const normalizedId = Number(scriptId);
        if (!normalizedId) {
            console.warn('[SceneStore] Script ID required to load scenes');
            return [];
        }
        if (this.currentScriptId && this.currentScriptId !== normalizedId) {
            this.clearState();
        }
        if (this.scenes.length > 0 && !options.force && this.currentScriptId === normalizedId) {
            return this.scenes;
        }

        try {
            this.setLoading(true);
            this.currentScriptId = normalizedId;
            const scenes = await this.api.getScenes(normalizedId);
            this.setScenes(scenes);
            return this.scenes;
        } catch (error) {
            console.error('[SceneStore] Failed to load scenes:', error);
            this.handleError(error, 'scene');
            this.setScenes([]);
            return [];
        } finally {
            this.setLoading(false);
        }
    }

    async createScene (scriptId, sceneData) {
        const normalizedId = Number(scriptId);
        if (!normalizedId) {
            throw new Error('Script ID is required');
        }
        const scene = await this.api.createScene(normalizedId, sceneData);
        if (scene && scene.id) {
            this.scenes = [...this.scenes, scene];
            this.sortScenes();
            this.setScenes(this.scenes);
        }
        return scene;
    }

    async updateScene (scriptId, sceneId, sceneData) {
        const normalizedId = Number(scriptId);
        const normalizedSceneId = Number(sceneId);
        if (!normalizedId || !normalizedSceneId) {
            throw new Error('Script ID and scene ID are required');
        }
        const updated = await this.api.updateScene(normalizedId, normalizedSceneId, sceneData);
        if (updated && updated.id) {
            this.scenes = this.scenes.map(scene => (
                String(scene.id) === String(updated.id) ? updated : scene
            ));
            this.sortScenes();
            this.setScenes(this.scenes);
        }
        return updated;
    }

    async deleteScene (scriptId, sceneId) {
        const normalizedId = Number(scriptId);
        const normalizedSceneId = Number(sceneId);
        if (!normalizedId || !normalizedSceneId) {
            throw new Error('Script ID and scene ID are required');
        }
        await this.api.deleteScene(normalizedId, normalizedSceneId);
        this.scenes = this.scenes.filter(scene => String(scene.id) !== String(normalizedSceneId));
        this.setScenes(this.scenes);
        if (String(this.currentSceneId) === String(normalizedSceneId)) {
            this.setCurrentSceneId(null);
        }
        return true;
    }

    async generateSceneIdea (scriptId, sceneId, draft = {}) {
        const normalizedId = Number(scriptId);
        const normalizedSceneId = Number(sceneId);
        if (!normalizedId) {
            throw new Error('Script ID is required');
        }
        if (!normalizedSceneId) {
            return this.api.generateSceneIdeaDraft(normalizedId, { draft });
        }
        return this.api.generateSceneIdea(normalizedId, normalizedSceneId, { draft });
    }

    async reorderScenes (scriptId, order) {
        const normalizedId = Number(scriptId);
        if (!normalizedId) {
            throw new Error('Script ID is required');
        }
        if (!Array.isArray(order)) {
            throw new Error('Scene order is required');
        }
        const previousScenes = [...this.scenes];
        this.applyLocalOrder(order);
        try {
            await this.api.reorderScenes(normalizedId, order);
        } catch (error) {
            this.scenes = previousScenes;
            this.setScenes(this.scenes);
            throw error;
        }
    }

    applyLocalOrder (order) {
        const indexMap = new Map(order.map(entry => [String(entry.sceneId), entry.sortIndex]));
        this.scenes = this.scenes.map(scene => ({
            ...scene,
            sortIndex: indexMap.get(String(scene.id))
        }));
        this.sortScenes();
        this.setScenes(this.scenes);
    }

    sortScenes () {
        this.scenes.sort((a, b) => {
            const aIndex = Number(a.sortIndex);
            const bIndex = Number(b.sortIndex);
            if (aIndex < bIndex) return -1;
            if (aIndex > bIndex) return 1;
            return Number(a.id) - Number(b.id);
        });
    }

    setLoading (loading) {
        this.isLoading = loading;
        super.setLoading(loading);
    }

    clearState () {
        this.scenes = [];
        this.currentSceneId = null;
        this.currentScriptId = null;
        this.setScenes([]);
        this.setCurrentSceneId(null);
    }

    destroy () {
        this.clearState();
        this.api = null;
        this.eventManager = null;
        super.destroy();
    }
}
