import { UI_ELEMENTS } from '../../constants.js';
import { OrchestratorLifecycleController } from '../orchestrator/OrchestratorLifecycleController.js';
import { CharactersUIBootstrap } from '../../widgets/character/CharactersUIBootstrap.js';
import { ChatIntegration } from '../../widgets/chat/integration/ChatIntegration.js';
import { LocationUIBootstrap } from '../../widgets/location/LocationUIBootstrap.js';
import { ScenesUIBootstrap } from '../../widgets/scene/ScenesUIBootstrap.js';
import { ScriptsUIBootstrap } from '../../widgets/script/ScriptsUIBootstrap.js';
import { ThemesUIBootstrap } from '../../widgets/theme/ThemesUIBootstrap.js';
import { SidePanelWidget } from '../../widgets/ui/SidePanelWidget.js';

export class AuthenticatedAppBootstrap {
    #initialized = false;
    #sidePanelWidget = null;
    #orchestratorLifecycle = null;

    constructor ({ api, stateManager, eventManager, stores, registry }) {
        this.api = api;
        this.stateManager = stateManager;
        this.eventManager = eventManager;
        this.stores = stores;
        this.registry = registry;
    }

    async init () {
        if (this.#initialized) return;
        this.#initialized = true;

        await this.initUI();
        await this.initChat();
        this.wireOrchestrator();
    }

    async initUI () {
        await this.initSidePanelWidget();
        await this.initScriptsUI();
        await this.initScenesUI();
        await this.initCharactersUI();
        await this.initLocationUI();
        await this.initThemesUI();
    }

    async initChat () {
        const chat = new ChatIntegration(this.api, this.stateManager, this.eventManager);
        await chat.initialize();
        this.registry.register('chat', chat);
    }

    wireOrchestrator () {
        if (!this.#orchestratorLifecycle) {
            this.#orchestratorLifecycle = new OrchestratorLifecycleController({
                scriptStore: this.stores.script,
                eventManager: this.eventManager,
                stateManager: this.stateManager,
                registry: this.registry
            });
        }
        this.#orchestratorLifecycle.start();
    }

    async initSidePanelWidget () {
        if (this.#sidePanelWidget) {
            return this.#sidePanelWidget;
        }

        this.#sidePanelWidget = new SidePanelWidget({
            stateManager: this.stateManager,
            eventManager: this.eventManager,
            targetsMap: {
                'user-scripts': UI_ELEMENTS.USER_SCRIPTS_PANEL,
                'user-scenes': UI_ELEMENTS.USER_SCENES_PANEL,
                'user-characters': UI_ELEMENTS.USER_CHARACTERS_PANEL,
                'user-location': UI_ELEMENTS.USER_LOCATION_PANEL,
                'user-themes': UI_ELEMENTS.USER_THEMES_PANEL
            },
            defaultTarget: 'user-scripts'
        });
        await this.#sidePanelWidget.initialize();
        return this.#sidePanelWidget;
    }

    async initScriptsUI () {
        const scriptsUI = new ScriptsUIBootstrap({
            api: this.api,
            stateManager: this.stateManager,
            eventManager: this.eventManager,
            scriptStore: this.stores.script
        });
        await scriptsUI.initialize();
        this.registry.register('scriptsUI', scriptsUI);
    }

    async initScenesUI () {
        const scenesUI = new ScenesUIBootstrap({
            api: this.api,
            stateManager: this.stateManager,
            eventManager: this.eventManager,
            sceneStore: this.stores.scene
        });
        await scenesUI.initialize();
    }

    async initCharactersUI () {
        const charactersUI = new CharactersUIBootstrap({
            api: this.api,
            stateManager: this.stateManager,
            eventManager: this.eventManager,
            characterStore: this.stores.character
        });
        await charactersUI.initialize();
    }

    async initLocationUI () {
        const locationUI = new LocationUIBootstrap({
            api: this.api,
            stateManager: this.stateManager,
            eventManager: this.eventManager,
            locationStore: this.stores.location
        });
        await locationUI.initialize();
    }

    async initThemesUI () {
        const themesUI = new ThemesUIBootstrap({
            api: this.api,
            stateManager: this.stateManager,
            eventManager: this.eventManager,
            themeStore: this.stores.theme
        });
        await themesUI.initialize();
    }
}
