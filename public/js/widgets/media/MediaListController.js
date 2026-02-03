/**
 * MediaListController - Handles user actions for media list
 * Routes actions to appropriate handlers
 */
export class MediaListController {
    constructor (options = {}) {
        this.model = options.model;
        this.view = options.view;
        this.onOpenMedia = options.onOpenMedia || null;
        this.onViewMedia = options.onViewMedia || null;
    }

    initialize () {
        this.view.setActionHandler(this.handleAction.bind(this));
        this.view.initialize();
    }

    setItems (items) {
        this.model.setItems(items);
        this.view.render(items);
    }

    handleAction (action) {
        const { type, payload } = action;
        switch (type) {
            case 'add':
                this.handleAdd();
                break;
            case 'view':
                this.handleView(payload);
                break;
            case 'delete':
                this.handleDelete(payload);
                break;
        }
    }

    handleAdd () {
        if (typeof this.onOpenMedia === 'function') {
            this.onOpenMedia();
        }
    }

    handleView (payload) {
        if (typeof this.onViewMedia === 'function') {
            this.onViewMedia(payload.itemId);
        }
    }

    async handleDelete (payload) {
        if (!payload || !payload.itemId) return;
        const confirmed = window.confirm('Delete this media?');
        if (!confirmed) return;
        try {
            await this.model.deleteItem(payload.itemId);
        } catch (error) {
            console.error('[MediaListController] Failed to delete media:', error);
        }
    }
}
