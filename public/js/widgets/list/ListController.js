export class ListController {
    constructor (options = {}) {
        this.model = options.model;
        this.view = options.view;
        this.onOpenEditor = options.onOpenEditor;
    }

    initialize () {
        this.view.initialize();
        this.view.setActionHandler(this.handleAction.bind(this));
    }

    setItems (items) {
        this.model.setItems(items);
        this.view.render(this.model.getItems());
    }

    async handleAction (action) {
        const { type, payload } = action;
        if (type === 'add') {
            if (this.onOpenEditor) {
                this.onOpenEditor(null);
            }
            return;
        }
        if (type === 'edit') {
            const item = this.model.getItemById(payload.itemId);
            if (item && this.onOpenEditor) {
                this.onOpenEditor(item);
            }
            return;
        }
        if (type === 'delete') {
            await this.model.deleteItem(payload.itemId);
            return;
        }
        if (type === 'rename') {
            this.model.startRename(payload.itemId);
            this.view.render(this.model.getItems());
            return;
        }
        if (type === 'commit-rename') {
            await this.model.commitRename(payload.itemId, payload.value);
            this.view.render(this.model.getItems());
            return;
        }
        if (type === 'cancel-rename') {
            this.model.cancelRename();
            this.view.render(this.model.getItems());
            return;
        }
        if (type === 'drag-start') {
            this.model.startDrag(payload.itemId);
            return;
        }
        if (type === 'drag-end') {
            this.model.endDrag();
            return;
        }
        if (type === 'drop') {
            const nextItems = this.model.getReorderedItems(payload.sourceId, payload.targetId);
            await this.model.submitReorder(nextItems);
        }
    }
}
