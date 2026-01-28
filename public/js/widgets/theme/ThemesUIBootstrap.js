import { UI_ELEMENTS } from '../../constants.js';
import { ThemeStore } from '../../stores/ThemeStore.js';
import { ScriptItemUIBootstrap } from '../list/ScriptItemUIBootstrap.js';
import { ThemeBrowserWidget } from './ThemeBrowserWidget.js';

export class ThemesUIBootstrap extends ScriptItemUIBootstrap {
    constructor (options) {
        super({
            api: options.api,
            stateManager: options.stateManager,
            eventManager: options.eventManager,
            store: options.themeStore || null,
            storeClass: ThemeStore,
            widgetClass: ThemeBrowserWidget,
            panelSelector: UI_ELEMENTS.USER_THEMES_PANEL
        });
    }
}
