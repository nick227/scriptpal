import { StateManager } from '../../../core/StateManager.js';
import { EventManager } from '../../../core/EventManager.js';
import { buildCollectionApplyKey } from './collectionIdempotency.js';

const COLLECTION_STORE_KEYS = {
    scenes: 'scene',
    characters: 'character',
    locations: 'location',
    outlines: 'outline',
    themes: 'theme'
};

export class AiCollectionsHandler {
    constructor ({ stores = {}, stateManager, eventManager } = {}) {
        this.stores = stores;
        this.stateManager = stateManager;
        this.eventManager = eventManager;
        this.appliedKeysByScript = new Map();
    }

    clearAppliedKeys (scriptId = null) {
        if (scriptId == null) {
            this.appliedKeysByScript.clear();
            return;
        }
        this.appliedKeysByScript.delete(String(scriptId));
    }

    getAppliedKeys (scriptId) {
        const key = String(scriptId);
        if (!this.appliedKeysByScript.has(key)) {
            this.appliedKeysByScript.set(key, new Set());
        }
        return this.appliedKeysByScript.get(key);
    }

    /**
     * Apply server-normalized collections: merge by id, reload stores, no duplicate creates.
     */
    async handleCollections (collections = [], options = {}) {
        if (!Array.isArray(collections) || collections.length === 0) {
            return [];
        }

        const scriptId = this.getCurrentScriptId();
        if (!scriptId) {
            console.warn('[AiCollectionsHandler] Cannot apply collections without a current script');
            return [];
        }

        const chatRequestId = options.chatRequestId || null;
        const appliedKeys = this.getAppliedKeys(scriptId);
        const applied = [];
        const typesToReload = new Set();

        for (const collection of collections) {
            const type = this.normalizeCollectionType(collection?.type);
            const store = this.getStoreForType(type);
            const items = Array.isArray(collection?.items) ? collection.items : [];
            if (!store || items.length === 0) {
                continue;
            }

            for (const item of items) {
                const applyKey = buildCollectionApplyKey(chatRequestId, type, item);
                if (!applyKey || appliedKeys.has(applyKey)) {
                    continue;
                }

                if (item?.id != null) {
                    this.mergeItemIntoStore(store, item);
                    appliedKeys.add(applyKey);
                    typesToReload.add(type);
                    applied.push({ type, item, action: 'merged' });
                    continue;
                }

                const payload = this.normalizeCreatePayload(item);
                if (!payload) {
                    continue;
                }

                const createdItem = await store.createItem(scriptId, payload);
                if (createdItem) {
                    appliedKeys.add(buildCollectionApplyKey(chatRequestId, type, createdItem));
                    typesToReload.add(type);
                    applied.push({ type, item: createdItem, action: 'created' });
                }
            }
        }

        await this.reloadStores(scriptId, typesToReload);

        if (applied.length && this.eventManager) {
            this.eventManager.publish(EventManager.EVENTS.AI.RESPONSE_RECEIVED, {
                scriptId,
                collectionsApplied: applied.length,
                types: [...typesToReload]
            });
        }

        return applied;
    }

    mergeItemIntoStore (store, item) {
        const normalized = this.normalizePersistedItem(item);
        if (!normalized?.id) {
            return;
        }

        const items = Array.isArray(store.items) ? store.items : [];
        const index = items.findIndex((row) => String(row.id) === String(normalized.id));

        if (index >= 0) {
            store.items = items.map((row, idx) => (idx === index ? { ...row, ...normalized } : row));
        } else {
            store.items = [...items, normalized];
        }

        if (typeof store.sortItems === 'function') {
            store.sortItems();
        }
        if (typeof store.setItems === 'function') {
            store.setItems(store.items);
        }
    }

    async reloadStores (scriptId, types) {
        const reloads = [...types].map(async (type) => {
            const store = this.getStoreForType(type);
            if (store && typeof store.loadItems === 'function') {
                await store.loadItems(scriptId, { force: true });
            }
        });
        await Promise.all(reloads);
    }

    getCurrentScriptId () {
        const currentScript = this.stateManager?.getState(StateManager.KEYS.CURRENT_SCRIPT);
        return currentScript?.id || this.stateManager?.getState(StateManager.KEYS.CURRENT_SCRIPT_ID) || null;
    }

    normalizeCollectionType (type) {
        return typeof type === 'string' ? type.trim().toLowerCase() : '';
    }

    getStoreForType (type) {
        const storeKey = COLLECTION_STORE_KEYS[type];
        return storeKey ? this.stores?.[storeKey] || null : null;
    }

    normalizePersistedItem (item) {
        if (!item || typeof item !== 'object') {
            return null;
        }

        const title = this.cleanText(item.title || item.name);
        if (!title && item.id == null) {
            return null;
        }

        return {
            id: item.id,
            scriptId: item.scriptId,
            title,
            description: this.cleanText(item.description),
            notes: this.cleanText(item.notes),
            tags: Array.isArray(item.tags)
                ? item.tags.map((tag) => this.cleanText(tag)).filter(Boolean)
                : [],
            sortIndex: item.sortIndex,
            source: item.source || 'ai',
            collectionType: item.collectionType
        };
    }

    normalizeCreatePayload (item) {
        const title = this.cleanText(item?.title || item?.name);
        const description = this.cleanText(item?.description);
        if (!title && !description) {
            return null;
        }

        return {
            title,
            description,
            notes: this.cleanText(item?.notes),
            tags: Array.isArray(item?.tags)
                ? item.tags.map((tag) => this.cleanText(tag)).filter(Boolean)
                : []
        };
    }

    cleanText (value) {
        return typeof value === 'string' ? value.trim() : '';
    }
}
