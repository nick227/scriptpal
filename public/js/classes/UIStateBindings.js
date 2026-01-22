import { UI_ELEMENTS, UI_LOADING_STATE_KEYS, UI_LOADING_TYPES } from '../constants.js';
import { StateManager } from '../core/StateManager.js';

export class UIStateBindings {
    constructor ({ stateManager, elements, handleError, loadingStates }) {
        if (!stateManager) {
            throw new Error('StateManager dependency is required for UIStateBindings');
        }
        if (!elements) {
            throw new Error('Elements are required for UIStateBindings');
        }
        if (!handleError) {
            throw new Error('Error handler is required for UIStateBindings');
        }
        this.stateManager = stateManager;
        this.elements = elements;
        this.handleError = handleError;
        this.loadingStates = loadingStates || new Map();
        this.subscriptions = new Set();
    }

    bind () {
        [
            [StateManager.KEYS.LOADING, UI_LOADING_TYPES.GLOBAL],
            [StateManager.KEYS.EDITOR_LOADING, UI_LOADING_TYPES.EDITOR],
            [StateManager.KEYS.CHAT_LOADING, UI_LOADING_TYPES.CHAT],
            [StateManager.KEYS.AUTH_LOADING, UI_LOADING_TYPES.AUTH]
        ].forEach(([key, type]) => {
            this.subscribe(key, (loading) => {
                this.updateLoadingIndicator(type, loading);
            });
        });

        this.subscribe(StateManager.KEYS.AUTHENTICATED, (authenticated) => {
            this.updateUIForAuthState(authenticated);
        });

        this.subscribe(StateManager.KEYS.ERROR, (error) => {
            if (error) {
                this.handleError(error);
            }
        });
    }

    unbind () {
        this.subscriptions.forEach((unsubscribe) => {
            unsubscribe();
        });
        this.subscriptions.clear();
    }

    setLoading (type, isLoading) {
        const stateKey = UI_LOADING_STATE_KEYS[type];
        if (!stateKey) {
            throw new Error(`Unknown loading type: ${type}`);
        }
        this.stateManager.setState(stateKey, isLoading);
    }

    subscribe (key, handler) {
        this.stateManager.subscribe(key, handler);
        this.subscriptions.add(() => {
            this.stateManager.unsubscribe(key, handler);
        });
    }

    updateLoadingIndicator (type, isLoading) {
        this.loadingStates.set(type, isLoading);
        const indicators = document.querySelectorAll(UI_ELEMENTS.LOADING_INDICATOR);
        indicators.forEach(indicator => {
            indicator.style.display = isLoading ? 'block' : 'none';
        });
    }

    updateUIForAuthState (authenticated) {
        try {
            [
                this.elements.loginForm,
                this.elements.registerForm,
                this.elements.logoutButton,
                this.elements.chatPanel
            ].forEach(element => {
                if (!element) return;
                if (element === this.elements.loginForm || element === this.elements.registerForm) {
                    element.classList.toggle('hidden', authenticated);
                } else {
                    element.classList.toggle('hidden', !authenticated);
                }
            });
        } catch (error) {
            this.handleError(error);
        }
    }
}
