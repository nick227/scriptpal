import { UI_ELEMENTS } from '../../constants.js';
import { StateManager } from '../../core/StateManager.js';
import { ListWidget } from '../list/ListWidget.js';

import { createThemeEditorAdapter, createThemeListAdapter } from './ThemeAdapters.js';

export class ThemeBrowserWidget extends ListWidget {
    constructor () {
        super({
            containerSelector: UI_ELEMENTS.USER_THEMES_PANEL,
            itemsKey: StateManager.KEYS.THEMES
        });
    }

    setThemeStore (store) {
        this.setAdapters({
            listAdapter: createThemeListAdapter(store),
            editorAdapter: createThemeEditorAdapter()
        });
    }

    setStore (store) {
        this.setThemeStore(store);
    }
}
