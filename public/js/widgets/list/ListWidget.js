import { StateManager } from '../../core/StateManager.js';
import { BaseWidget } from '../BaseWidget.js';
import { ModalEditorController } from '../editor/ModalEditorController.js';
import { ModalEditorView } from '../editor/ModalEditorView.js';
import { ListController } from './ListController.js';
import { ListModel } from './ListModel.js';
import { ListView } from './ListView.js';

export class ListWidget extends BaseWidget {
    constructor (options = {}) {
        super();
        this.containerSelector = options.containerSelector;
        this.itemsKey = options.itemsKey;
        this.getContextId = options.getContextId || this.getCurrentScriptId.bind(this);
        this.container = null;
        this.listAdapter = null;
        this.editorAdapter = null;
        this.editorView = null;
        this.editorController = null;
        this.mediaPicker = null;
        this.listModel = new ListModel({
            adapter: null,
            getContextId: this.getContextId
        });
        this.listView = null;
        this.listController = null;
    }

    setAdapters ({ listAdapter, editorAdapter }) {
        this.listAdapter = listAdapter;
        this.editorAdapter = editorAdapter;
        if (listAdapter) {
            this.listModel.setAdapter(listAdapter);
        }
    }

    setMediaPicker (mediaPicker) {
        this.mediaPicker = mediaPicker;
    }

    async initialize () {
        await super.initialize();
        this.container = document.querySelector(this.containerSelector);
        if (!this.container) {
            throw new Error('List container element not found');
        }
        if (!this.listAdapter || !this.editorAdapter) {
            throw new Error('List adapters must be set before initialize');
        }

        this.editorView = new ModalEditorView({
            adapter: this.editorAdapter
        });
        this.editorController = new ModalEditorController({
            view: this.editorView,
            adapter: this.editorAdapter
        });
        this.listView = new ListView({
            container: this.container,
            adapter: this.listAdapter,
            getDragItemId: this.listModel.getDragItemId.bind(this.listModel),
            getEditingItemId: this.listModel.getEditingItemId.bind(this.listModel)
        });
        this.listController = new ListController({
            model: this.listModel,
            view: this.listView,
            onOpenEditor: this.openEditor.bind(this),
            onOpenMedia: this.openMedia.bind(this)
        });
        this.listController.initialize();
        this.setupStateSubscriptions();
    }

    setupStateSubscriptions () {
        this.subscribeToState(this.itemsKey, this.handleItemsUpdate.bind(this));
        this.handleItemsUpdate(this.stateManager.getState(this.itemsKey));
    }

    handleItemsUpdate (items) {
        if (!this.listController) {
            return;
        }
        this.listController.setItems(Array.isArray(items) ? items : []);
    }

    openEditor (item) {
        const contextId = this.getContextId();
        if (!contextId) {
            return;
        }
        const emptyItem = this.listModel.getEmptyItem();
        const supportsAi = Boolean(this.listAdapter && this.listAdapter.supportsAi);
        this.editorController.open(item || emptyItem, {
            onSave: async(itemId, payload) => {
                try {
                    await this.listModel.saveItem(itemId, payload);
                    this.editorView.close();
                } catch (error) {
                    console.error('[ListWidget] Failed to save item:', error);
                }
            },
            onAiGenerate: supportsAi
                ? async(itemId, draft) => {
                    try {
                        return await this.listModel.generateIdea(itemId, draft);
                    } catch (error) {
                        console.error('[ListWidget] Failed to generate idea:', error);
                        return null;
                    }
                }
                : null
        });
    }

    openMedia (payload) {
        if (!this.mediaPicker || !payload) {
            return;
        }
        const item = this.listModel.getItemById(payload.itemId);
        if (!item || !item.id) {
            return;
        }
        this.mediaPicker.open({
            ownerType: payload.ownerType,
            ownerId: item.id,
            role: payload.role
        });
    }

    getCurrentScriptId () {
        const script = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
        return script ? script.id : null;
    }
}
