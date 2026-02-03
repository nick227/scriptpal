import { BaseManager } from '../core/BaseManager.js';
import { StateManager } from '../core/StateManager.js';
import { resolveCacheState } from './storeLoadUtils.js';

/**
 * MediaStore - Manages script media (attachments from unified media library)
 * Supports images and will support other media types (video, audio) in the future
 */
export class MediaStore extends BaseManager {
    constructor (api, stateManager, eventManager) {
        super(stateManager);
        if (!api) throw new Error('API is required for MediaStore');
        if (!eventManager) throw new Error('EventManager is required for MediaStore');

        this.api = api;
        this.eventManager = eventManager;
        this.stateKey = StateManager.KEYS.MEDIA;
        this.currentIdKey = StateManager.KEYS.CURRENT_MEDIA_ID;
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
            console.warn('[MediaStore] Script ID required to load items');
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
            // Get all media attached to script with 'gallery' role (from unified library)
            const data = await this.api.getOwnerMedia('script', normalizedId, 'gallery');
            const attachments = data && data.attachments ? data.attachments : [];
            const items = attachments.map(attachment => this.mapAttachmentToItem(attachment));
            this.setItems(items);
            return this.items;
        } catch (error) {
            console.error('[MediaStore] Failed to load items:', error);
            this.handleError(error, 'Media');
            this.setItems([]);
            return [];
        } finally {
            this.setLoading(false);
        }
    }

    mapAttachmentToItem (attachment) {
        const asset = attachment.asset || {};
        const variants = asset.variants || [];
        const preview = variants.find(v => v.kind === 'preview') || variants[0];
        const storageKey = preview ? preview.storageKey : asset.storageKey;
        return {
            id: attachment.id,
            assetId: asset.id,
            title: asset.originalFilename || 'Media',
            type: asset.type || 'image',
            mimeType: asset.mimeType || '',
            url: storageKey ? `/uploads/${storageKey}` : '',
            createdAt: attachment.createdAt,
            sortIndex: attachment.sortIndex || 0
        };
    }

    async refreshItems () {
        if (!this.currentScriptId) return [];
        return this.loadItems(this.currentScriptId, { force: true });
    }

    async deleteItem (scriptId, itemId) {
        const normalizedId = Number(scriptId);
        const normalizedItemId = Number(itemId);
        if (!normalizedId || !normalizedItemId) {
            throw new Error('Script ID and item ID are required');
        }
        await this.api.http.request(`/owners/script/${normalizedId}/media/${normalizedItemId}`, {
            method: 'DELETE'
        });
        this.items = this.items.filter(item => String(item.id) !== String(normalizedItemId));
        this.setItems(this.items);
        return true;
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
        super.destroy();
    }
}
