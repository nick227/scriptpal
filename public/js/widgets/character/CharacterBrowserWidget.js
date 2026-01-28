import { UI_ELEMENTS } from '../../constants.js';
import { StateManager } from '../../core/StateManager.js';
import { ListWidget } from '../list/ListWidget.js';

import { createCharacterEditorAdapter, createCharacterListAdapter } from './CharacterAdapters.js';

export class CharacterBrowserWidget extends ListWidget {
    constructor () {
        super({
            containerSelector: UI_ELEMENTS.USER_CHARACTERS_PANEL,
            itemsKey: StateManager.KEYS.CHARACTERS
        });
    }

    setCharacterStore (store) {
        this.setAdapters({
            listAdapter: createCharacterListAdapter(store),
            editorAdapter: createCharacterEditorAdapter()
        });
    }

    setStore (store) {
        this.setCharacterStore(store);
    }
}
