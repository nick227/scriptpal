import { UI_ELEMENTS } from '../../constants.js';
import { StateManager } from '../../core/StateManager.js';
import { ListWidget } from '../list/ListWidget.js';
import { createOutlineEditorAdapter } from './OutlineEditorAdapter.js';
import { createOutlineListAdapter } from './OutlineListAdapter.js';

export class OutlineBrowserWidget extends ListWidget {
    constructor () {
        super({
            containerSelector: UI_ELEMENTS.USER_OUTLINES_PANEL,
            itemsKey: StateManager.KEYS.OUTLINES
        });
    }

    setOutlineStore (outlineStore) {
        this.setAdapters({
            listAdapter: createOutlineListAdapter(outlineStore),
            editorAdapter: createOutlineEditorAdapter()
        });
    }

    setStore (outlineStore) {
        this.setOutlineStore(outlineStore);
    }
}
