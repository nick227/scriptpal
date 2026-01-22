import { UI_COMPONENTS, UI_ELEMENTS } from '../constants.js';
import { ErrorHandler } from '../core/ErrorHandler.js';
import { EventManager } from '../core/EventManager.js';
import { StateManager } from '../core/StateManager.js';
import { NavigationManager } from '../ui/NavigationManager.js';
import { ViewManager } from '../ui/ViewManager.js';

import { ElementManager } from './ElementManager.js';
import { UIStateBindings } from './UIStateBindings.js';
import { WidgetLifecycleManager } from './WidgetLifecycleManager.js';

/**
 * Main UI class that coordinates the app UI.
 */
export class ScriptPalUI {
    // Error strategy: report via error handler, then rethrow.
    /**
     * Create the UI controller.
     * @param {object} chat - Chat dependency.
     * @param {object} user - User dependency.
     * @param {object} script - Script dependency.
     * @param {object} options - Optional injected dependencies.
     */
    constructor (chat, user, script, options = {}) {
        if (!user) {
            throw new Error('User dependency is required for ScriptPalUI');
        }
        const resolved = this.resolveDependencies(options);
        this.dependencies = { chat, user, script };
        this.stateManager = resolved.stateManager;
        this.eventManager = resolved.eventManager;
        this.elements = {};
        this.widgets = {};
        this.currentUser = null;
        this._handleViewChange = this.handleViewChange.bind(this);
        this._handleToggleView = this.handleToggleView.bind(this);
        this.domSubscriptions = new Set();
        this.initializationState = { initialized: false, elementsReady: false, widgetsReady: false };
        this.errorHandler = resolved.errorHandler;
        this.elementManager = resolved.elementManager;
        this.widgetLifecycleManager = resolved.widgetLifecycleManager;
        this.stateBindings = null;
        this.navigationManager = resolved.navigationManager;
        this.viewManager = resolved.viewManager;
        this.loadingStates = new Map();
    }

    /**
     * Resolve injected dependencies or create defaults.
     * @param {object} options - Dependency overrides.
     * @returns {object} Resolved dependencies.
     */
    resolveDependencies (options) {
        const stateManager = options.stateManager || new StateManager();
        const eventManager = options.eventManager || new EventManager();
        const errorHandler = options.errorHandler || ErrorHandler.create(UI_COMPONENTS.SCRIPT_PAL_UI, {
            eventManager,
            maxErrors: 5,
            timeWindow: 30000
        });
        const elementManager = options.elementManager || new ElementManager();
        const widgetLifecycleManager = options.widgetLifecycleManager
            || new WidgetLifecycleManager({ stateManager, eventManager });

        return {
            stateManager,
            eventManager,
            errorHandler,
            elementManager,
            widgetLifecycleManager,
            navigationManager: options.navigationManager || null,
            viewManager: options.viewManager || null
        };
    }

    /**
     * Initialize UI and widgets.
     * @param {object|null} currentUser - Current user if authenticated.
     */
    async initialize (currentUser) {
        try {
            this.currentUser = currentUser;
            this.initializationState.initialized = false;
            this.elements = this.elementManager.initialize();
            this.initializationState.elementsReady = true;

            if (!this.navigationManager) this.navigationManager = new NavigationManager(this.elements);
            if (!this.viewManager) this.viewManager = new ViewManager(this.elements);
            this.viewManager.setupCurrentView();
            this.widgets = await this.widgetLifecycleManager.initialize(this.elements, this.dependencies);
            this.initializationState.widgetsReady = true;
            this.setupViewNavigation();
            this.stateBindings = new UIStateBindings({
                stateManager: this.stateManager,
                elements: this.elements,
                handleError: this.handleError.bind(this),
                loadingStates: this.loadingStates
            });
            this.stateBindings.bind();
            if (currentUser) {
                this.stateManager.setState(StateManager.KEYS.USER, currentUser);
                this.stateManager.setState(StateManager.KEYS.AUTHENTICATED, true);
            }
            this.initializationState.initialized = true;
        } catch (error) {
            this.handleError(error, {
                operation: 'initialize',
                currentUser: !!currentUser
            });
        }
    }

    /**
     * Wire view navigation events.
     */
    setupViewNavigation () {
        if (!this.elements.siteControls || !this.elements.toggleView) {
            throw new Error('Required navigation elements are missing');
        }
        this.elements.siteControls.addEventListener('click', this._handleViewChange);
        this.trackDomSubscription(() => {
            this.elements.siteControls.removeEventListener('click', this._handleViewChange);
        });
        this.elements.toggleView.addEventListener('click', this._handleToggleView);
        this.trackDomSubscription(() => {
            this.elements.toggleView.removeEventListener('click', this._handleToggleView);
        });
    }

    /**
     * Toggle the current view layout.
     */
    handleToggleView () {
        try {
            if (!this.viewManager) {
                throw new Error('ViewManager is not initialized');
            }
            this.viewManager.toggleView();
        } catch (error) {
            this.handleError(error, { operation: 'toggleView' }, { rethrow: false });
        }
    }

    /**
     * Cleanup UI resources.
     */
    destroy () {
        try {
            this.clearDomSubscriptions();
            if (this.stateBindings) {
                this.stateBindings.unbind();
                this.stateBindings = null;
            }
            this.widgetLifecycleManager.destroy();
            this.widgets = {};
            this.stateManager.reset();
            this.elements = {};
            this.dependencies = {};
            this.loadingStates.clear();
            this.initializationState = { initialized: false, elementsReady: false, widgetsReady: false };
            delete this._handleViewChange;
            delete this._handleToggleView;
            delete this.viewManager;
            delete this.navigationManager;
        } catch (error) {
            this.handleError(error, { operation: 'destroy' }, { rethrow: false });
        }
    }

    /**
     * Update chat/script dependencies.
     * @param {object} chat - Chat dependency.
     * @param {object} script - Script dependency.
     */
    async updateComponents (chat, script) {
        try {
            this.dependencies.chat = chat;
            this.dependencies.script = script;
            this.widgets = await this.widgetLifecycleManager.update(this.elements, this.dependencies);
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Set loading state for the UI.
     * @param {string} type - Loading type key.
     * @param {boolean} isLoading - Loading state.
     */
    setLoading (type, isLoading) {
        try {
            if (!this.stateBindings) {
                throw new Error('State bindings are not initialized');
            }
            this.stateBindings.setLoading(type, isLoading);
        } catch (error) {
            this.handleError(error, { operation: 'setLoading', type, isLoading });
        }
    }

    /**
     * Handle view change click.
     * @param {Event} event - Click event.
     */
    handleViewChange (event) {
        try {
            if (!event || !event.target) return;
            const button = event.target.closest(UI_ELEMENTS.CONTROL_BUTTON);
            if (!button) return;

            const viewId = button.id;
            if (!viewId) return;
            if (!this.navigationManager) {
                throw new Error('NavigationManager is not initialized');
            }
            this.navigationManager.setActiveButton(viewId);
            if (!this.stateManager || !this.eventManager) {
                throw new Error('State/event managers are not initialized');
            }
            this.stateManager.setState(StateManager.KEYS.CURRENT_VIEW, viewId);
            this.eventManager.publish(EventManager.EVENTS.VIEW.CHANGED, { viewId });
        } catch (error) {
            this.handleError(error, { operation: 'handleViewChange' }, { rethrow: false });
        }
    }

    /**
     * Handle errors for this UI.
     * @param {Error} error - Error instance.
     * @param {object} context - Error context metadata.
     * @param {object} options - Error handling options.
     */
    handleError (error, context = {}, options = {}) {
        const { rethrow = true } = options;
        const hasElements = this.elements && Object.keys(this.elements).length > 0;
        this.errorHandler.handleError(error, {
            component: UI_COMPONENTS.SCRIPT_PAL_UI,
            initState: this.initializationState,
            hasElements,
            ...context
        }, {
            eventManager: this.eventManager,
            showNotification: true
        });
        if (rethrow) {
            throw error;
        }
    }

    /**
     * Return error handler stats.
     * @returns {object} Error statistics.
     */
    getErrorStats () {
        return this.errorHandler.getErrorStats();
    }

    /**
     * Clear error history.
     */
    clearErrorHistory () {
        this.errorHandler.clearHistory();
    }

    /**
     * Check if UI initialized.
     * @returns {boolean} True when initialized.
     */
    isInitialized () {
        return this.initializationState.initialized;
    }

    /**
     * Return initialization details.
     * @returns {object} Initialization state details.
     */
    getInitializationState () {
        return {
            ...this.initializationState,
            widgets: Object.keys(this.widgets)
        };
    }

    /**
     * Track a DOM cleanup subscription.
     * @param {Function} unsubscribe - Unsubscribe handler.
     */
    trackDomSubscription (unsubscribe) {
        this.domSubscriptions.add(unsubscribe);
    }

    /**
     * Clear DOM event subscriptions.
     */
    clearDomSubscriptions () {
        this.domSubscriptions.forEach((unsubscribe) => unsubscribe());
        this.domSubscriptions.clear();
    }
}
