/**
 * MediaListModel - Manages media list state
 * Handles items and delete operations
 */
export class MediaListModel {
    constructor (options = {}) {
        this.adapter = options.adapter || null;
        this.getContextId = options.getContextId || (() => null);
        this.items = [];
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
        return this.items.find(item => String(item.id) === String(itemId)) || null;
    }

    async deleteItem (itemId) {
        if (!this.adapter) {
            throw new Error('Adapter not set');
        }
        const contextId = this.getContextId();
        if (!contextId) {
            throw new Error('Context ID is required');
        }
        await this.adapter.deleteItem(contextId, itemId);
        this.items = this.items.filter(item => String(item.id) !== String(itemId));
        return true;
    }
}
