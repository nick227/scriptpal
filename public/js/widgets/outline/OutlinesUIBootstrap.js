import { OutlineStore } from '../../stores/OutlineStore.js';
import { OutlineBrowserWidget } from './OutlineBrowserWidget.js';
import { UI_ELEMENTS } from '../../constants.js';
import { ScriptItemUIBootstrap } from '../list/ScriptItemUIBootstrap.js';

export class OutlinesUIBootstrap extends ScriptItemUIBootstrap {
    constructor (options) {
        super({
            api: options.api,
            stateManager: options.stateManager,
            eventManager: options.eventManager,
            store: options.outlineStore ?? null,
            storeClass: OutlineStore,
            widgetClass: OutlineBrowserWidget,
            panelSelector: UI_ELEMENTS.USER_OUTLINES_PANEL
        });
    }
}
