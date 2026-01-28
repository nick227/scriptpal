import { UI_ELEMENTS } from '../../constants.js';
import { LocationStore } from '../../stores/LocationStore.js';
import { ScriptItemUIBootstrap } from '../list/ScriptItemUIBootstrap.js';
import { LocationBrowserWidget } from './LocationBrowserWidget.js';

export class LocationUIBootstrap extends ScriptItemUIBootstrap {
    constructor (options) {
        super({
            api: options.api,
            stateManager: options.stateManager,
            eventManager: options.eventManager,
            store: options.locationStore || null,
            storeClass: LocationStore,
            widgetClass: LocationBrowserWidget,
            panelSelector: UI_ELEMENTS.USER_LOCATION_PANEL
        });
    }
}
