import { UI_ELEMENTS } from '../../constants.js';
import { StateManager } from '../../core/StateManager.js';
import { ListWidget } from '../list/ListWidget.js';

import { createLocationEditorAdapter, createLocationListAdapter } from './LocationAdapters.js';

export class LocationBrowserWidget extends ListWidget {
    constructor () {
        super({
            containerSelector: UI_ELEMENTS.USER_LOCATION_PANEL,
            itemsKey: StateManager.KEYS.LOCATIONS
        });
    }

    setLocationStore (store) {
        this.setAdapters({
            listAdapter: createLocationListAdapter(store),
            editorAdapter: createLocationEditorAdapter()
        });
    }

    setStore (store) {
        this.setLocationStore(store);
    }
}
