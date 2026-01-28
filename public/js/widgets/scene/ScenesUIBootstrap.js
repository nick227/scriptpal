import { SceneStore } from '../../stores/SceneStore.js';
import { SceneBrowserWidget } from './SceneBrowserWidget.js';
import { UI_ELEMENTS } from '../../constants.js';
import { ScriptItemUIBootstrap } from '../list/ScriptItemUIBootstrap.js';

export class ScenesUIBootstrap extends ScriptItemUIBootstrap {
    constructor (options) {
        super({
            api: options.api,
            stateManager: options.stateManager,
            eventManager: options.eventManager,
            store: options.sceneStore || null,
            storeClass: SceneStore,
            widgetClass: SceneBrowserWidget,
            panelSelector: UI_ELEMENTS.USER_SCENES_PANEL
        });
    }
}
