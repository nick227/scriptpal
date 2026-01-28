export class ListModel {
    constructor (options = {}) {
        this.adapter = options.adapter;
        this.getContextId = options.getContextId;
        this.items = [];
        this.editingItemId = null;
        this.dragItemId = null;
    }

    setAdapter (adapter) {
        this.adapter = adapter;
    }

    setItems (items) {
        this.items = Array.isArray(items) ? items : [];
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
        try {
            await this.adapter.updateItem(contextId, itemId, this.adapter.buildRenamePayload(trimmed));
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

    async submitReorder (orderedItems) {
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
}
