import { UI_ELEMENTS } from '../../constants.js';
import { CharacterStore } from '../../stores/CharacterStore.js';
import { ScriptItemUIBootstrap } from '../list/ScriptItemUIBootstrap.js';
import { CharacterBrowserWidget } from './CharacterBrowserWidget.js';

export class CharactersUIBootstrap extends ScriptItemUIBootstrap {
    constructor (options) {
        super({
            api: options.api,
            stateManager: options.stateManager,
            eventManager: options.eventManager,
            store: options.characterStore || null,
            storeClass: CharacterStore,
            widgetClass: CharacterBrowserWidget,
            panelSelector: UI_ELEMENTS.USER_CHARACTERS_PANEL
        });
    }
}
