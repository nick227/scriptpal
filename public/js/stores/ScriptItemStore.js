import { BaseManager } from '../core/BaseManager.js';
import { validateScriptItemHandlers } from './ScriptItemContract.js';
import { resolveCacheState } from './storeLoadUtils.js';

export class ScriptItemStore extends BaseManager {
    constructor (api, stateManager, eventManager, options = {}) {
        super(stateManager);
        if (!api) throw new Error('API is required for ScriptItemStore');
        if (!eventManager) throw new Error('EventManager is required for ScriptItemStore');
        if (!options.stateKey || !options.currentIdKey) {
            throw new Error('State keys are required for ScriptItemStore');
        }
        if (!options.apiHandlers) {
            throw new Error('API handlers are required for ScriptItemStore');
        }
        const handlerValidation = validateScriptItemHandlers(options.apiHandlers);
        if (!handlerValidation.valid) {
            throw new Error(`API handlers missing: ${handlerValidation.missing.join(', ')}`);
        }

        this.api = api;
        this.eventManager = eventManager;
        this.stateKey = options.stateKey;
        this.currentIdKey = options.currentIdKey;
        this.itemLabel = options.itemLabel || 'item';
        this.orderKey = options.orderKey || 'itemId';
        this.apiHandlers = options.apiHandlers;
        this.items = [];
        this.currentScriptId = null;
        this.currentItemId = null;
        this.isLoading = false;
    }

    setItems (items) {
        this.items = Array.isArray(items) ? items : [];
        this.stateManager.setState(this.stateKey, this.items);
    }

    setCurrentItemId (itemId) {
        this.currentItemId = itemId ? Number(itemId) : null;
        this.stateManager.setState(this.currentIdKey, this.currentItemId);
    }

    getItems () {
        return this.items;
    }

    getCurrentItemId () {
        return this.currentItemId;
    }

    async loadItems (scriptId, options = {}) {
        const normalizedId = Number(scriptId);
        if (!normalizedId) {
            console.warn(`[${this.itemLabel}Store] Script ID required to load items`);
            return [];
        }
        const cacheState = resolveCacheState({
            currentId: this.currentScriptId,
            nextId: normalizedId,
            items: this.items,
            force: options.force
        });
        if (cacheState.hasChanged) {
            this.clearState();
        }
        if (cacheState.shouldReturnCache) {
            return this.items;
        }

        try {
            this.setLoading(true);
            this.currentScriptId = normalizedId;
            const items = await this.apiHandlers.list(normalizedId);
            this.setItems(items);
            return this.items;
        } catch (error) {
            console.error(`[${this.itemLabel}Store] Failed to load items:`, error);
            this.handleError(error, this.itemLabel);
            this.setItems([]);
            return [];
        } finally {
            this.setLoading(false);
        }
    }

    async createItem (scriptId, itemData) {
        const normalizedId = Number(scriptId);
        if (!normalizedId) {
            throw new Error('Script ID is required');
        }
        const item = await this.apiHandlers.create(normalizedId, itemData);
        if (item && item.id) {
            this.items = [...this.items, item];
            this.sortItems();
            this.setItems(this.items);
        }
        return item;
    }

    async updateItem (scriptId, itemId, itemData) {
        const normalizedId = Number(scriptId);
        const normalizedItemId = Number(itemId);
        if (!normalizedId || !normalizedItemId) {
            throw new Error('Script ID and item ID are required');
        }
        const updated = await this.apiHandlers.update(normalizedId, normalizedItemId, itemData);
        if (updated && updated.id) {
            this.items = this.items.map(item => (
                String(item.id) === String(updated.id) ? updated : item
            ));
            this.sortItems();
            this.setItems(this.items);
        }
        return updated;
    }

    async deleteItem (scriptId, itemId) {
        const normalizedId = Number(scriptId);
        const normalizedItemId = Number(itemId);
        if (!normalizedId || !normalizedItemId) {
            throw new Error('Script ID and item ID are required');
        }
        await this.apiHandlers.delete(normalizedId, normalizedItemId);
        this.items = this.items.filter(item => String(item.id) !== String(normalizedItemId));
        this.setItems(this.items);
        if (String(this.currentItemId) === String(normalizedItemId)) {
            this.setCurrentItemId(null);
        }
        return true;
    }

    async generateIdea (scriptId, itemId, draft = {}) {
        if (typeof this.apiHandlers.generateIdea !== 'function') {
            return null;
        }
        const normalizedId = Number(scriptId);
        const normalizedItemId = Number(itemId);
        if (!normalizedId) {
            throw new Error('Script ID is required');
        }
        if (!normalizedItemId) {
            if (typeof this.apiHandlers.generateIdeaDraft === 'function') {
                return this.apiHandlers.generateIdeaDraft(normalizedId, { draft });
            }
            return null;
        }
        return this.apiHandlers.generateIdea(normalizedId, normalizedItemId, { draft });
    }

    async reorderItems (scriptId, order) {
        const normalizedId = Number(scriptId);
        if (!normalizedId) {
            throw new Error('Script ID is required');
        }
        if (!Array.isArray(order)) {
            throw new Error('Item order is required');
        }
        const previousItems = [...this.items];
        this.applyLocalOrder(order);
        try {
            await this.apiHandlers.reorder(normalizedId, order);
        } catch (error) {
            this.items = previousItems;
            this.setItems(this.items);
            throw error;
        }
    }

    applyLocalOrder (order) {
        const indexMap = new Map(order.map(entry => [String(entry[this.orderKey]), entry.sortIndex]));
        this.items = this.items.map(item => ({
            ...item,
            sortIndex: indexMap.get(String(item.id))
        }));
        this.sortItems();
        this.setItems(this.items);
    }

    sortItems () {
        this.items.sort((a, b) => {
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
        this.items = [];
        this.currentItemId = null;
        this.currentScriptId = null;
        this.setItems([]);
        this.setCurrentItemId(null);
    }

    destroy () {
        this.clearState();
        this.api = null;
        this.eventManager = null;
        this.apiHandlers = null;
        super.destroy();
    }
}
