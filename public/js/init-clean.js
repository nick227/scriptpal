/**
 * Clean Architecture Entry Point
 * Simple, focused initialization
 */
import { App } from './app.js';
import { ScriptPalAPI } from './services/api/ScriptPalAPI.js';
import { ScriptPalUser } from './services/api/ScriptPalUser.js';
import { UI_ELEMENTS } from './constants.js';
import { EventManager } from './core/EventManager.js';
import { StateManager } from './core/StateManager.js';
import { PersistenceManager } from './services/persistence/PersistenceManager.js';
import { ScriptStore } from './stores/ScriptStore.js';
import { SceneStore } from './stores/SceneStore.js';
import { AuthWidget } from './widgets/auth/AuthWidget.js';
import { ChatIntegration } from './widgets/chat/integration/ChatIntegration.js';
import { ScriptsUIBootstrap } from './widgets/script/ScriptsUIBootstrap.js';
import { ScenesUIBootstrap } from './widgets/scene/ScenesUIBootstrap.js';
import { renderSharedTopBar, getTopBarElements } from './layout/sharedLayout.js';
import { TokenWatchWidget } from './widgets/ui/TokenWatchWidget.js';
import { SidePanelWidget } from './widgets/ui/SidePanelWidget.js';
import { ScriptSyncService } from './services/script/ScriptSyncService.js';
import { ScriptOrchestrator } from './services/script/ScriptOrchestrator.js';

// Global app instance
window.scriptPalApp = null;

/**
 * Initialize ScriptPal with clean architecture
 */
async function initScriptPal () {
    try {
        renderSharedTopBar();
        const sharedElements = getTopBarElements();
        setAuthLockState(false);

        // Create app instance
        window.scriptPalApp = new App();

        // Initialize the app
        await window.scriptPalApp.init();

        const api = new ScriptPalAPI();
        const user = new ScriptPalUser(api);
        const stateManager = new StateManager();
        const eventManager = new EventManager();

        await initTokenWatchWidget(sharedElements.tokenWatchContainer, api, stateManager, eventManager);

        const authWidget = await initAuthWidget(api, user, stateManager, eventManager, sharedElements);

        const scriptStore = new ScriptStore(api, stateManager, eventManager);
        const sceneStore = new SceneStore(api, stateManager, eventManager);
        const persistenceManager = new PersistenceManager({ api, stateManager, eventManager });

        await persistenceManager.ready;
        const isAuthenticated = await user.checkSession();

        if (authWidget) {
            if (isAuthenticated) {
                authWidget.updateUIForAuthenticatedUser(user.getCurrentUser());
            } else {
                authWidget.updateUIForUnauthenticatedUser();
            }
        }

        let authenticatedViewsInitialized = false;
        const initAuthenticatedViews = async () => {
            if (authenticatedViewsInitialized) return;
            authenticatedViewsInitialized = true;
            await initSidePanelWidget(stateManager, eventManager);
            await initScriptsUI(api, stateManager, eventManager, scriptStore);
            await initScenesUI(api, stateManager, eventManager, sceneStore);
            await initChat(api, stateManager, eventManager);
            wireScriptOrchestrator(scriptStore, eventManager);
            setAuthLockState(true);
        };

        const handleAuthChange = async (authenticated) => {
            if (!authenticated) {
                setAuthLockState(false);
                return;
            }
            await initAuthenticatedViews();
        };

        stateManager.subscribe(StateManager.KEYS.AUTHENTICATED, handleAuthChange);

        if (isAuthenticated) {
            await handleAuthChange(true);
        }

        window.scriptPalPersistence = persistenceManager;
        window.scriptPalScriptStore = scriptStore;
        window.scriptPalSceneStore = sceneStore;


    } catch (error) {
        console.error('❌ Failed to initialize ScriptPal:', error);

        // Show error to user
        showError('Failed to initialize ScriptPal. Please refresh the page.');
    }
}

let orchestratorWireSubscribed = false;
let orchestratorScriptSelectedSubscribed = false;
let sidePanelWidget = null;

function wireScriptOrchestrator (scriptStore, eventManager) {
    const scriptsUI = window.scriptPalScriptsUI;
    const chat = window.scriptPalChat;
    if (!scriptsUI || !chat) {
        console.warn('[init] Cannot wire orchestrator: missing scripts UI or chat');
        return;
    }

    const editorWidget = scriptsUI.getEditorWidget && scriptsUI.getEditorWidget();
    if (!editorWidget || !scriptsUI.isEditorReady || !scriptsUI.isEditorReady()) {
        console.debug('[init] Editor not ready for orchestrator wiring');
        if (!orchestratorWireSubscribed && eventManager?.subscribe) {
            orchestratorWireSubscribed = true;
            eventManager.subscribe(EventManager.EVENTS.EDITOR.EDITOR_AREA_READY, () => {
                if (window.scriptPalApp?.stateManager) {
                    window.scriptPalApp.stateManager.setState(StateManager.KEYS.EDITOR_READY, true);
                }
                wireScriptOrchestrator(scriptStore, eventManager);
            });
        }
        if (!orchestratorScriptSelectedSubscribed && eventManager?.subscribe) {
            orchestratorScriptSelectedSubscribed = true;
            eventManager.subscribe(EventManager.EVENTS.SCRIPT.SELECTED, () => {
                wireScriptOrchestrator(scriptStore, eventManager);
            });
        }
        return;
    }

    if (!window.scriptPalOrchestrator) {
        const syncService = new ScriptSyncService(scriptStore, eventManager);
        window.scriptPalOrchestrator = new ScriptOrchestrator(
            scriptStore,
            syncService,
            editorWidget.container,
            editorWidget
        );
        console.log('[init] ScriptOrchestrator wired');
    }

    if (typeof chat.setScriptOrchestrator === 'function') {
        chat.setScriptOrchestrator(window.scriptPalOrchestrator);
    }
}

/**
 * Initialize authentication UI widget
 * @param api
 * @param user
 * @param stateManager
 * @param eventManager
 */
async function initAuthWidget (api, user, stateManager, eventManager, topBarElements = null) {
    const sharedElements = topBarElements || getTopBarElements();
    const elements = {
        ...sharedElements,
        messagesContainer: document.querySelector(UI_ELEMENTS.MESSAGES_CONTAINER)
    };

    const requiredKeys = ['formsContainer', 'logoutButton', 'userInfo'];
    const missing = requiredKeys.filter(key => !elements[key]);

    if (missing.length) {
        console.warn('[AuthWidget] Missing elements:', missing);
        return null;
    }

    const authWidget = new AuthWidget(elements, stateManager, user, eventManager);

    await authWidget.initialize(elements);

    window.scriptPalAuth = authWidget;
    return authWidget;
}

async function initTokenWatchWidget (container, api, stateManager, eventManager) {
    if (!container) {
        return null;
    }

    const widget = new TokenWatchWidget({ container }, api, stateManager, eventManager);
    widget.setManagers(stateManager, eventManager);
    await widget.initialize();
    window.scriptPalTokenWatch = widget;
    return widget;
}

async function initSidePanelWidget (stateManager, eventManager) {
    if (sidePanelWidget) {
        return sidePanelWidget;
    }
    sidePanelWidget = new SidePanelWidget({ stateManager, eventManager });
    await sidePanelWidget.initialize();
    window.scriptPalSidePanel = sidePanelWidget;
    return sidePanelWidget;
}

/**
 * Initialize script selection UI widgets
 * @param api
 * @param stateManager
 * @param eventManager
 */
async function initScriptsUI (api, stateManager, eventManager, scriptStore) {
    const scriptsUI = new ScriptsUIBootstrap({ api, stateManager, eventManager, scriptStore });
    await scriptsUI.initialize();
    window.scriptPalScriptsUI = scriptsUI;
}

async function initScenesUI (api, stateManager, eventManager, sceneStore) {
    const scenesUI = new ScenesUIBootstrap({ api, stateManager, eventManager, sceneStore });
    await scenesUI.initialize();
    window.scriptPalScenesUI = scenesUI;
}

/**
 * Initialize modern chat integration
 * @param api
 * @param stateManager
 * @param eventManager
 */
async function initChat (api, stateManager, eventManager) {
    const chat = new ChatIntegration(api, stateManager, eventManager);
    await chat.initialize();
    window.scriptPalChat = chat;
}

/**
 * Lock or unlock the UI based on auth state.
 * @param {boolean} isAuthenticated
 */
function setAuthLockState (isAuthenticated) {
    if (!document?.body) return;
    document.body.classList.toggle('auth-locked', !isAuthenticated);
}

/**
 * Show error message to user
 * @param message
 */
function showError (message) {
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = `
        <div style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            text-align: center;
            max-width: 400px;
        ">
            <h3>Error</h3>
            <p>${message}</p>
            <button onclick="location.reload()" style="
                background: #007bff;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 10px;
            ">Refresh Page</button>
        </div>
    `;
    document.body.appendChild(errorDiv);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScriptPal);
} else {
    initScriptPal();
}
