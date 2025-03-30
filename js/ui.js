import { MESSAGE_TYPES, ERROR_MESSAGES, SUCCESS_MESSAGES, UI_ELEMENTS } from './constants.js';
import { NotificationManager } from './ui/NotificationManager.js';
import { StateManager } from './core/StateManager.js';
import { ErrorManager } from './ui/ErrorManager.js';
import { EventBus } from './core/EventBus.js';
import { ChatWidget } from './widgets/chat/ChatWidget.js';
import { AuthWidget } from './widgets/auth/AuthWidget.js';
import { ScriptWidget } from './widgets/script/ScriptWidget.js';
import { ViewManager } from './ui/ViewManager.js';

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
        this.boundHandleViewChange = this.handleViewChange.bind(this);
        this.boundHandleToggleView = this.handleToggleView.bind(this);
    }

    async initialize(currentUser) {
        try {
            // Initialize UI elements
            this.initializeElements();

            // Initialize view manager
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
            this.elements.siteControls.addEventListener('click', this.boundHandleViewChange);
        }
        if (this.elements.toggleView) {
            this.elements.toggleView.addEventListener('click', this.boundHandleToggleView);
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
                this.elements.siteControls.removeEventListener('click', this.boundHandleViewChange);
            }
            if (this.elements.toggleView) {
                this.elements.toggleView.removeEventListener('click', this.boundHandleToggleView);
            }

            // Reset state
            this.stateManager.reset();

            // Clear elements
            this.elements = {};

            // Clear dependencies
            this.dependencies = {};

            // Clear bound methods
            this.boundHandleViewChange = null;
            this.boundHandleToggleView = null;

            // Clear view manager
            this.viewManager = null;
        } catch (error) {
            console.error('Error during UI cleanup:', error);
        }
    }

    updateComponents(chat, script) {
        try {
            // Update dependencies
            this.dependencies.chat = chat;
            this.dependencies.script = script;

            // Initialize widgets if not already done
            if (!this.widgets.chat || !this.widgets.script) {
                this.initializeWidgets();
            } else {
                // Update existing widgets
                if (this.widgets.chat) {
                    this.widgets.chat.update(chat);
                }
                if (this.widgets.script) {
                    this.widgets.script.update(script);
                }
            }
        } catch (error) {
            this.handleError(error);
        }
    }

    initializeElements() {
        // Initialize required elements
        this.elements.messagesContainer = document.querySelector(UI_ELEMENTS.MESSAGES_CONTAINER);
        this.elements.input = document.querySelector(UI_ELEMENTS.INPUT);
        this.elements.sendButton = document.querySelector(UI_ELEMENTS.SEND_BUTTON);
        this.elements.userInfo = document.querySelector(UI_ELEMENTS.USER_INFO);
        this.elements.loginForm = document.querySelector(UI_ELEMENTS.LOGIN_FORM);
        this.elements.registerForm = document.querySelector(UI_ELEMENTS.REGISTER_FORM);
        this.elements.logoutButton = document.querySelector(UI_ELEMENTS.LOGOUT_BUTTON);
        this.elements.toggleView = document.querySelector(UI_ELEMENTS.TOGGLE_VIEW);
        this.elements.chatButtons = document.querySelector(UI_ELEMENTS.CHAT_BUTTONS);
        this.elements.loadingIndicator = document.querySelector(UI_ELEMENTS.LOADING_INDICATOR);
        this.elements.siteControls = document.querySelector(UI_ELEMENTS.SITE_CONTROLS);
        this.elements.scriptContainer = document.querySelector(UI_ELEMENTS.SCRIPT_CONTAINER);
        this.elements.settingsContainer = document.querySelector(UI_ELEMENTS.SETTINGS_CONTAINER);
        this.elements.scriptsContainer = document.querySelector(UI_ELEMENTS.SCRIPTS_CONTAINER);

        this.validateRequiredElements();
    }

    initializeWidgets() {
        try {
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
        this.stateManager.subscribe('loading', (loading) => {
            if (this.elements.loadingIndicator) {
                this.elements.loadingIndicator.style.display = loading ? 'block' : 'none';
            }
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

    updateUIForAuthState(authenticated) {
        try {
            // Update UI elements based on auth state
            const elementsToToggle = [
                this.elements.loginForm,
                this.elements.registerForm,
                this.elements.logoutButton,
                this.elements.chatButtons,
                this.elements.scriptContainer
            ];

            elementsToToggle.forEach(element => {
                if (element) {
                    // Hide login/register forms when authenticated, show logout button
                    if (element === this.elements.loginForm || element === this.elements.registerForm) {
                        element.style.display = authenticated ? 'none' : 'block';
                    }
                    // Show logout button and other elements when authenticated
                    else {
                        element.style.display = authenticated ? 'block' : 'none';
                    }
                }
            });
        } catch (error) {
            this.handleError(error);
        }
    }

    validateRequiredElements() {
        const requiredElements = [
            { element: this.elements.messagesContainer, name: 'messages container' },
            { element: this.elements.input, name: 'input field' },
            { element: this.elements.sendButton, name: 'send button' }
        ];

        const missingElements = requiredElements.filter(({ element }) => !element);
        if (missingElements.length > 0) {
            const missingNames = missingElements.map(({ name }) => name).join(', ');
            throw new Error(`Required UI elements are missing: ${missingNames}`);
        }

        // Log warning for optional elements
        const optionalElements = [
            { element: this.elements.scriptsContainer, name: 'scripts container' },
            { element: this.elements.scriptContainer, name: 'script container' },
            { element: this.elements.settingsContainer, name: 'settings container' }
        ];

        const missingOptional = optionalElements.filter(({ element }) => !element);
        if (missingOptional.length > 0) {
            console.warn('Optional UI elements are missing:',
                missingOptional.map(({ name }) => name).join(', '));
        }
    }

    handleViewChange(event) {
        try {
            // Get the view ID from the clicked button
            const button = event.target.closest('.view-button');
            if (!button) return;

            const viewId = button.id;
            if (!viewId) return;

            // Update active button
            const buttons = this.elements.siteControls.querySelectorAll('.view-button');
            buttons.forEach(btn => btn.classList.toggle('active', btn.id === viewId));

            // Map views to containers
            const viewMap = {
                'chat-view': this.elements.messagesContainer,
                'scripts-view': this.elements.scriptContainer,
                'editor-view': this.elements.scriptContainer,
                'settings-view': this.elements.settingsContainer
            };

            // Update view visibility
            Object.entries(viewMap).forEach(([id, element]) => {
                if (element) {
                    element.style.display = id === viewId ? 'block' : 'none';
                }
            });

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