/**
 * Clean Architecture Entry Point
 * Simple, focused initialization
 */
import { App } from './App.js';
import { ScriptPalAPI } from './classes/api.js';
import { ScriptPalUser } from './classes/user.js';
import { UI_ELEMENTS } from './constants.js';
import { EventManager } from './core/EventManager.js';
import { StateManager } from './core/StateManager.js';
import { PersistenceManager } from './managers/PersistenceManager.js';
import { ScriptStore } from './stores/ScriptStore.js';
import { AuthWidget } from './widgets/auth/AuthWidget.js';
import { ChatIntegration } from './widgets/chat/ChatIntegration.js';
import { ScriptsUIBootstrap } from './widgets/script/ScriptsUIBootstrap.js';

// Global app instance
window.scriptPalApp = null;

/**
 * Initialize ScriptPal with clean architecture
 */
async function initScriptPal () {
    try {
        setAuthLockState(false);

        // Create app instance
        window.scriptPalApp = new App();

        // Initialize the app
        await window.scriptPalApp.init();

        const api = new ScriptPalAPI();
        const user = new ScriptPalUser(api);
        const stateManager = new StateManager();
        const eventManager = new EventManager();

        const authWidget = await initAuthWidget(api, user, stateManager, eventManager);

        const scriptStore = new ScriptStore(api, stateManager, eventManager);
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
            await initScriptsUI(api, stateManager, eventManager, scriptStore);
            await initChat(api, stateManager, eventManager);
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
 */
async function initAuthWidget (api, user, stateManager, eventManager) {
    const elements = {
        formsContainer: document.querySelector(UI_ELEMENTS.AUTH_FORMS),
        logoutButton: document.querySelector(UI_ELEMENTS.LOGOUT_BUTTON),
        userInfo: document.querySelector(UI_ELEMENTS.USER_INFO),
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
