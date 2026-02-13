export class ListModel {
    constructor (options = {}) {
        this.adapter = options.adapter;
        this.getContextId = options.getContextId;
        this.storageNamespace = options.storageNamespace || 'list-order';
        this.storageKey = options.storageKey || 'default';
        this.items = [];
        this.editingItemId = null;
        this.dragItemId = null;
    }

    setAdapter (adapter) {
        this.adapter = adapter;
    }

    setItems (items, options = {}) {
        const { applyPersistedOrder = true } = options;
        const list = Array.isArray(items) ? items : [];
        this.items = applyPersistedOrder ? this.applyPersistedOrder(list) : list;
        this.persistOrder(this.items);
    }

    getItems () {
        return this.items;
    }

    getItemById (itemId) {
        return this.items.find(item => String(this.adapter.getId(item)) === String(itemId));
    }

    getEmptyItem () {
        return this.adapter.getEmptyItem();
    }

    getEditingItemId () {
        return this.editingItemId;
    }

    startRename (itemId) {
        this.editingItemId = itemId;
    }

    async commitRename (itemId, value) {
        const contextId = this.getContextId();
        if (!contextId) {
            this.cancelRename();
            return;
        }
        const trimmed = String(value).trim();
        const item = this.getItemById(itemId);
        if (!item) {
            this.cancelRename();
            return;
        }
        if (!trimmed || trimmed === this.adapter.getTitle(item)) {
            this.cancelRename();
            return;
        }
        const renamePayload = this.adapter.buildRenamePayload(trimmed);
        Object.assign(item, renamePayload);
        try {
            await this.adapter.updateItem(contextId, itemId, renamePayload);
        } catch (error) {
            console.error('[ListModel] Failed to rename item:', error);
        } finally {
            this.cancelRename();
        }
    }

    cancelRename () {
        this.editingItemId = null;
    }

    startDrag (itemId) {
        this.dragItemId = itemId;
    }

    endDrag () {
        this.dragItemId = null;
    }

    getDragItemId () {
        return this.dragItemId;
    }

    getReorderedItems (sourceId, targetId) {
        const list = [...this.items];
        const sourceIndex = list.findIndex(item => String(this.adapter.getId(item)) === String(sourceId));
        const targetIndex = list.findIndex(item => String(this.adapter.getId(item)) === String(targetId));
        if (sourceIndex === -1 || targetIndex === -1) {
            return list;
        }
        const [moved] = list.splice(sourceIndex, 1);
        list.splice(targetIndex, 0, moved);
        return list;
    }

    removeItem (itemId) {
        this.items = this.items.filter(item => String(this.adapter.getId(item)) !== String(itemId));
        this.persistOrder(this.items);
    }

    async submitReorder (orderedItems) {
        this.persistOrder(orderedItems);
        const contextId = this.getContextId();
        if (!contextId) {
            return;
        }
        try {
            await this.adapter.reorderItems(contextId, this.adapter.buildOrderPayload(orderedItems));
        } catch (error) {
            console.error('[ListModel] Failed to reorder items:', error);
        }
    }

    async saveItem (itemId, payload) {
        const contextId = this.getContextId();
        if (!contextId) {
            return;
        }
        if (itemId) {
            await this.adapter.updateItem(contextId, itemId, payload);
            return;
        }
        await this.adapter.createItem(contextId, payload);
    }

    async deleteItem (itemId) {
        const contextId = this.getContextId();
        if (!contextId) {
            return;
        }
        await this.adapter.deleteItem(contextId, itemId);
    }

    async generateIdea (itemId, draft) {
        const contextId = this.getContextId();
        if (!contextId) {
            return null;
        }
        return this.adapter.generateIdea(contextId, itemId, draft);
    }

    async removeMediaAttachment (ownerType, itemId, attachmentId, assetId = null) {
        if (!ownerType || !itemId || (!attachmentId && !assetId) || !this.adapter || typeof this.adapter.removeMediaAttachment !== 'function') {
            return false;
        }
        const item = this.getItemById(itemId);
        if (!item) {
            return false;
        }
        const previousAttachments = Array.isArray(item.attachments) ? [...item.attachments] : null;
        if (previousAttachments) {
            item.attachments = previousAttachments.filter((attachment) => {
                const matchesAttachment = attachmentId && String(attachment.id) === String(attachmentId);
                const matchesAsset = assetId && String(attachment?.asset?.id) === String(assetId);
                return !(matchesAttachment || matchesAsset);
            });
            item.coverUrl = this.resolveCoverUrlFromAttachments(item.attachments);
        }
        try {
            await this.adapter.removeMediaAttachment(ownerType, itemId, attachmentId, assetId);
            return true;
        } catch (error) {
            if (previousAttachments) {
                item.attachments = previousAttachments;
                item.coverUrl = this.resolveCoverUrlFromAttachments(previousAttachments);
            }
            console.error('[ListModel] Failed to remove media attachment:', error);
            return false;
        }
    }

    async hydrateAllItemMedia (ownerType, role) {
        if (!ownerType || !this.adapter || typeof this.adapter.fetchMediaAttachments !== 'function' || !this.items.length) {
            return false;
        }
        let changed = false;
        await Promise.all(this.items.map(async(item) => {
            const itemId = this.adapter.getId(item);
            if (!itemId) {
                return;
            }
            try {
                const attachments = await this.adapter.fetchMediaAttachments(ownerType, itemId, role);
                const nextSerialized = JSON.stringify(attachments || []);
                const prevSerialized = JSON.stringify(Array.isArray(item.attachments) ? item.attachments : []);
                if (nextSerialized !== prevSerialized) {
                    changed = true;
                    item.attachments = Array.isArray(attachments) ? attachments : [];
                }
                const nextCoverUrl = this.resolveCoverUrlFromAttachments(item.attachments);
                if (item.coverUrl !== nextCoverUrl) {
                    changed = true;
                    item.coverUrl = nextCoverUrl;
                }
            } catch (error) {
                console.warn('[ListModel] Failed to hydrate media for item:', itemId, error);
            }
        }));
        return changed;
    }

    resolveCoverUrlFromAttachments (attachments) {
        const list = Array.isArray(attachments) ? attachments : [];
        if (!list.length) {
            return '';
        }
        const first = list[0];
        const asset = first?.asset || {};
        const variants = Array.isArray(asset.variants) ? asset.variants : [];
        const preview = variants.find(variant => variant.kind === 'preview') || variants[0];
        const directUrl = preview?.url || asset?.url || first?.previewUrl || first?.url || '';
        if (directUrl) {
            return directUrl;
        }
        const storageKey = preview?.storageKey || asset?.storageKey || '';
        if (!storageKey) {
            return '';
        }
        if (String(storageKey).startsWith('/')) {
            return String(storageKey);
        }
        return `/uploads/${storageKey}`;
    }

    applyPersistedOrder (items) {
        const savedOrder = this.readPersistedOrder();
        if (!savedOrder.length || !this.adapter || typeof this.adapter.getId !== 'function') {
            return items;
        }
        const byId = new Map(items.map(item => [String(this.adapter.getId(item)), item]));
        const ordered = [];

        savedOrder.forEach(itemId => {
            const item = byId.get(String(itemId));
            if (item) {
                ordered.push(item);
                byId.delete(String(itemId));
            }
        });

        items.forEach(item => {
            const itemId = String(this.adapter.getId(item));
            if (byId.has(itemId)) {
                ordered.push(item);
                byId.delete(itemId);
            }
        });

        return ordered;
    }

    persistOrder (items = this.items) {
        if (typeof window === 'undefined' || !window.localStorage || !this.adapter || typeof this.adapter.getId !== 'function') {
            return;
        }
        try {
            const orderedIds = (Array.isArray(items) ? items : []).map(item => String(this.adapter.getId(item)));
            window.localStorage.setItem(this.getOrderStorageKey(), JSON.stringify(orderedIds));
        } catch (error) {
            console.warn('[ListModel] Failed to persist list order:', error);
        }
    }

    readPersistedOrder () {
        if (typeof window === 'undefined' || !window.localStorage) {
            return [];
        }
        try {
            const raw = window.localStorage.getItem(this.getOrderStorageKey());
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn('[ListModel] Failed to read list order:', error);
            return [];
        }
    }

    getOrderStorageKey () {
        const contextId = this.getContextId ? this.getContextId() : null;
        const contextPart = contextId ? String(contextId) : 'global';
        return `${this.storageNamespace}:${this.storageKey}:${contextPart}`;
    }
}
