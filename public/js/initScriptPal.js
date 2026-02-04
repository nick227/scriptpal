/**
 * Clean Architecture Entry Point
 * Simple, focused initialization
 */
import { AuthenticatedAppBootstrap } from './app/bootstrap/AuthenticatedAppBootstrap.js';
import { ServiceRegistry } from './app/core/ServiceRegistry.js';
import { App } from './App.js';
import { EventManager } from './core/EventManager.js';
import { StateManager } from './core/StateManager.js';
import { renderSharedTopBar, getTopBarElements } from './layout/sharedLayout.js';
import { initSharedTopBarWidgets } from './layout/sharedTopBarWidgets.js';
import { ScriptPalAPI } from './services/api/ScriptPalAPI.js';
import { ScriptPalUser } from './services/api/ScriptPalUser.js';
import { PersistenceManager } from './services/persistence/PersistenceManager.js';
import { CharacterStore } from './stores/CharacterStore.js';
import { LocationStore } from './stores/LocationStore.js';
import { MediaStore } from './stores/MediaStore.js';
import { SceneStore } from './stores/SceneStore.js';
import { ScriptStore } from './stores/ScriptStore.js';
import { ThemeStore } from './stores/ThemeStore.js';

// Global app instance
window.scriptPalApp = null;

/**
 * Initialize ScriptPal with clean architecture
 */
async function initScriptPal () {
    try {
        renderSharedTopBar();
        const sharedElements = getTopBarElements();

        // Create app instance
        window.scriptPalApp = new App();

        // Initialize the app
        await window.scriptPalApp.init();

        const api = new ScriptPalAPI();
        const user = new ScriptPalUser(api);
        const stateManager = new StateManager();
        const eventManager = new EventManager();
        const registry = new ServiceRegistry();

        const { authWidget } = await initSharedTopBarWidgets(
            api,
            user,
            stateManager,
            eventManager,
            sharedElements
        );

        const scriptStore = new ScriptStore(api, stateManager, eventManager);
        const characterStore = new CharacterStore(api, stateManager, eventManager);
        const locationStore = new LocationStore(api, stateManager, eventManager);
        const mediaStore = new MediaStore(api, stateManager, eventManager);
        const sceneStore = new SceneStore(api, stateManager, eventManager);
        const themeStore = new ThemeStore(api, stateManager, eventManager);
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

        const authenticatedBootstrap = new AuthenticatedAppBootstrap({
            api,
            stateManager,
            eventManager,
            registry,
            stores: {
                script: scriptStore,
                scene: sceneStore,
                character: characterStore,
                location: locationStore,
                media: mediaStore,
                theme: themeStore
            }
        });

        const redirectToAuth = () => {
            const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
            const redirectUrl = `/auth.html?redirect=${encodeURIComponent(returnTo)}`;
            window.location.replace(redirectUrl);
        };

        const handleAuthChange = async (authenticated) => {
            if (!authenticated) {
                redirectToAuth();
                return;
            }
            await authenticatedBootstrap.init();
        };

        stateManager.subscribe(StateManager.KEYS.AUTHENTICATED, handleAuthChange);

        if (isAuthenticated) {
            await handleAuthChange(true);
        }

        window.scriptPalPersistence = persistenceManager;
        window.scriptPalScriptStore = scriptStore;
        window.scriptPalCharacterStore = characterStore;
        window.scriptPalLocationStore = locationStore;
        window.scriptPalSceneStore = sceneStore;
        window.scriptPalThemeStore = themeStore;
        window.scriptPalMediaStore = mediaStore;


    } catch (error) {
        console.error('❌ Failed to initialize ScriptPal:', error);

        // Show error to user
        showError('Failed to initialize ScriptPal. Please refresh the page.');
    }
}

/**
 * Initialize authentication UI widget
 * @param api
 * @param user
 * @param stateManager
 * @param eventManager
 * @param topBarElements
 */

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
