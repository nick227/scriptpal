import { UI_ELEMENTS } from '../../constants.js';
import { StateManager } from '../../core/StateManager.js';
import { ListWidget } from '../list/ListWidget.js';

import { createSceneEditorAdapter } from './SceneEditorAdapter.js';
import { createSceneListAdapter } from './SceneListAdapter.js';

export class SceneBrowserWidget extends ListWidget {
    constructor () {
        super({
            containerSelector: UI_ELEMENTS.USER_SCENES_PANEL,
            itemsKey: StateManager.KEYS.SCENES
        });
    }

    setSceneStore (sceneStore) {
        this.setAdapters({
            listAdapter: createSceneListAdapter(sceneStore),
            editorAdapter: createSceneEditorAdapter()
        });
    }

    setStore (sceneStore) {
        this.setSceneStore(sceneStore);
    }
}
