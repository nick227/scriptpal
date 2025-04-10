import { MESSAGE_TYPES, ERROR_MESSAGES, SUCCESS_MESSAGES, UI_ELEMENTS } from './constants.js';
import { NotificationManager } from './ui/NotificationManager.js';
import { StateManager } from './core/StateManager.js';
import { ErrorManager } from './ui/ErrorManager.js';
import { EventBus } from './core/EventBus.js';
import { ChatWidget } from './widgets/chat/ChatWidget.js';
import { AuthWidget } from './widgets/auth/AuthWidget.js';
import { ScriptWidget } from './widgets/script/ScriptWidget.js';
import { ViewManager } from './ui/ViewManager.js';
import { NavigationManager } from './ui/NavigationManager.js';

/**
 * Main UI class that coordinates all UI components
 */
export class ScriptPalUI {
    constructor(chat, user, script) {
        if (!user) {
            throw new Error('User dependency is required for ScriptPalUI');
        }
        this.dependencies = { chat, user, script };
        this.stateManager = new StateManager();
        this.eventBus = new EventBus();
        this.elements = {};
        this.widgets = {};
        this.currentUser = null;
        this._handleViewChange = this.handleViewChange.bind(this);
        this._handleToggleView = this.handleToggleView.bind(this);

        // Initialize loading states
        this.loadingStates = new Map();
    }

    async initialize(currentUser) {
        try {
            this.currentUser = currentUser;
            // Initialize UI elements
            this.initializeElements();

            // Initialize managers
            this.navigationManager = new NavigationManager(this.elements);
            this.viewManager = new ViewManager(this.elements);
            this.viewManager.setupCurrentView();

            // Create widgets with complete dependencies
            this.widgets.auth = new AuthWidget(this.elements, this.stateManager, this.dependencies.user, this.eventBus);
            this.widgets.chat = new ChatWidget(this.elements);
            this.widgets.script = new ScriptWidget(this.elements);

            // Set managers for widgets
            this.widgets.chat.setManagers(this.stateManager, this.eventBus);
            this.widgets.script.setManagers(this.stateManager, this.eventBus);

            // Initialize widgets with their dependencies
            await this.widgets.auth.initialize(this.elements);
            if (this.dependencies.chat) {
                await this.widgets.chat.initialize(this.dependencies.chat);
            }
            if (this.dependencies.script) {
                await this.widgets.script.initialize(this.dependencies.script);
            }

            // Set up view navigation and state subscriptions
            this.setupViewNavigation();
            this.setupStateSubscriptions();

            // Update UI based on auth state
            if (currentUser) {
                this.stateManager.setState(StateManager.KEYS.USER, currentUser);
                this.stateManager.setState(StateManager.KEYS.AUTHENTICATED, true);
            }
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    setupViewNavigation() {
        if (this.elements.siteControls) {
            this.elements.siteControls.addEventListener('click', this._handleViewChange);
        }
        if (this.elements.toggleView) {
            this.elements.toggleView.addEventListener('click', this._handleToggleView);
        }
    }

    handleToggleView() {
        try {
            if (this.viewManager) {
                this.viewManager.toggleView();
            }
        } catch (error) {
            this.handleError(error);
        }
    }

    destroy() {
        try {
            // Clean up widgets
            Object.values(this.widgets).forEach(widget => {
                if (widget) {
                    widget.destroy();
                }
            });
            this.widgets = {};

            // Clean up event listeners
            if (this.elements.siteControls) {
                this.elements.siteControls.removeEventListener('click', this._handleViewChange);
            }
            if (this.elements.toggleView) {
                this.elements.toggleView.removeEventListener('click', this._handleToggleView);
            }

            // Reset state
            this.stateManager.reset();

            // Clear elements
            this.elements = {};

            // Clear dependencies
            this.dependencies = {};

            // Clear bound methods
            this._handleViewChange = null;
            this._handleToggleView = null;

            // Clear view manager
            this.viewManager = null;
        } catch (error) {
            console.error('Error during UI cleanup:', error);
        }
    }

    async updateComponents(chat, script) {
        try {
            // Update dependencies
            this.dependencies.chat = chat;
            this.dependencies.script = script;

            // Initialize or update chat widget
            if (!this.widgets.chat) {
                this.widgets.chat = new ChatWidget(this.elements);
                this.widgets.chat.setManagers(this.stateManager, this.eventBus);
                await this.widgets.chat.initialize(chat);
            } else {
                await this.widgets.chat.update(chat);
            }

            // Initialize or update script widget
            if (!this.widgets.script) {
                this.widgets.script = new ScriptWidget(this.elements);
                this.widgets.script.setManagers(this.stateManager, this.eventBus);
                await this.widgets.script.initialize(script);
            } else {
                await this.widgets.script.update(script);
            }
        } catch (error) {
            this.handleError(error);
        }
    }

    initializeElements() {
        // Initialize required elements
        this.elements.messagesContainer = document.querySelector(UI_ELEMENTS.MESSAGES_CONTAINER);
        console.log('Messages container found?', !!this.elements.messagesContainer);
        console.log('Messages container:', this.elements.messagesContainer);

        this.elements.input = document.querySelector(UI_ELEMENTS.INPUT);
        this.elements.sendButton = document.querySelector(UI_ELEMENTS.SEND_BUTTON);
        this.elements.userInfo = document.querySelector(UI_ELEMENTS.USER_INFO);
        this.elements.loginForm = document.querySelector(UI_ELEMENTS.LOGIN_FORM);
        this.elements.registerForm = document.querySelector(UI_ELEMENTS.REGISTER_FORM);
        this.elements.logoutButton = document.querySelector(UI_ELEMENTS.LOGOUT_BUTTON);
        this.elements.toggleView = document.querySelector(UI_ELEMENTS.TOGGLE_VIEW);
        this.elements.siteControls = document.querySelector(UI_ELEMENTS.SITE_CONTROLS);

        // Initialize output panels
        this.elements.settingsPanel = document.querySelector(UI_ELEMENTS.SETTINGS_PANEL);
        this.elements.chatPanel = document.querySelector(UI_ELEMENTS.CHAT_PANEL);
    }

    initializeWidgets() {
        try {
            alert('initializeWidgets');
            // Create widgets with complete dependencies
            this.widgets.auth = new AuthWidget(this.stateManager, this.dependencies.user, this.eventBus);
            this.widgets.chat = new ChatWidget(this.stateManager, this.dependencies.chat, this.eventBus);
            this.widgets.script = new ScriptWidget(this.stateManager, this.dependencies.script, this.eventBus);

            // Initialize widgets
            this.widgets.auth.initialize(this.elements);
            this.widgets.chat.initialize(this.elements);
            this.widgets.script.initialize(this.elements);
        } catch (error) {
            this.handleError(error);
        }
    }

    setupStateSubscriptions() {
        // Subscribe to individual loading states
        this.stateManager.subscribe('loading', (loading) => {
            this.updateLoadingIndicator('global', loading);
        });

        this.stateManager.subscribe('editorLoading', (loading) => {
            this.updateLoadingIndicator('editor', loading);
        });

        this.stateManager.subscribe('chatLoading', (loading) => {
            this.updateLoadingIndicator('chat', loading);
        });

        this.stateManager.subscribe('authLoading', (loading) => {
            this.updateLoadingIndicator('auth', loading);
        });

        this.stateManager.subscribe('authenticated', (authenticated) => {
            this.updateUIForAuthState(authenticated);
        });

        this.stateManager.subscribe('error', (error) => {
            if (error) {
                this.handleError(error);
            }
        });
    }

    updateLoadingIndicator(type, isLoading) {
        // Update internal state
        this.loadingStates.set(type, isLoading);

        // Select all loading indicators and toggle them
        const indicators = document.querySelectorAll(UI_ELEMENTS.LOADING_INDICATOR);
        indicators.forEach(indicator => {
            indicator.style.display = isLoading ? 'block' : 'none';
        });
    }

    setLoading(type, isLoading) {
        this.stateManager.setState(`${type}Loading`, isLoading);
    }

    updateUIForAuthState(authenticated) {
        try {
            // Update UI elements based on auth state
            const elementsToToggle = [
                this.elements.loginForm,
                this.elements.registerForm,
                this.elements.logoutButton,
                this.elements.chatPanel
            ];

            elementsToToggle.forEach(element => {
                if (element) {
                    // Hide login/register forms when authenticated, show logout button
                    if (element === this.elements.loginForm || element === this.elements.registerForm) {
                        element.classList.toggle('hidden', authenticated);
                    }
                    // Show logout button and other elements when authenticated
                    else {
                        element.classList.toggle('hidden', !authenticated);
                    }
                }
            });
        } catch (error) {
            this.handleError(error);
        }
    }

    handleViewChange(event) {
        try {
            // Get the view ID from the clicked button
            const button = event.target.closest('.view-button');
            if (!button) return;

            const viewId = button.id;
            if (!viewId) return;

            // Use NavigationManager to handle panel visibility
            this.navigationManager.setActiveButton(viewId);

            // Update state and notify
            this.stateManager.setState(StateManager.KEYS.CURRENT_VIEW, viewId);
            this.eventBus.publish(EventBus.EVENTS.VIEW.CHANGED, { viewId });
        } catch (error) {
            ErrorManager.handleError(error, 'ui');
            this.handleError(error);
        }
    }

    handleError(error) {
        // Prevent infinite loops by checking if we're already handling an error
        if (this._handlingError) {
            console.error('Error while handling error:', error);
            return;
        }

        try {
            this._handlingError = true;
            console.error('UI Error:', error);
            this.stateManager.setState('error', error);

            // Show error notification
            NotificationManager.showError(error.message);
        } finally {
            this._handlingError = false;
        }
    }
}