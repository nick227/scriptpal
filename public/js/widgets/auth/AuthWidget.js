import { MESSAGE_TYPES } from '../../constants.js';
import { EventManager } from '../../core/EventManager.js';
import { StateManager } from '../../core/StateManager.js';
import { RendererFactory } from '../../renderers.js';
import { BaseWidget } from '../BaseWidget.js';

import { AuthFormsView } from './AuthFormsView.js';
import { AuthFormView } from './AuthFormView.js';
import { AuthUserBadgeView } from './AuthUserBadgeView.js';

/**
 *
 */
export class AuthWidget extends BaseWidget {
    /**
     *
     * @param elements
     * @param stateManager
     * @param user
     * @param eventManager
     */
    constructor (elements, stateManager, user, eventManager) {
        super(elements);
        if (!user) {
            throw new Error('User is required for AuthWidget');
        }
        this.user = user;
        this.stateManager = stateManager;
        this.eventManager = eventManager;
        this.renderer = null;
        this.formViews = {};
        this.formsView = null;
        this.userBadge = null;
        this.setupEventSubscriptions();
    }

    /**
     *
     * @param stateManager
     * @param eventManager
     */
    setManagers (stateManager, eventManager) {
        super.setManagers(stateManager, eventManager);
        this.setupEventSubscriptions();
    }

    /**
     *
     */
    setupEventSubscriptions () {
        if (this.eventManager) {
            this.eventManager.subscribe(
                EventManager.EVENTS.AUTH.LOGIN,
                this.updateUIForAuthenticatedUser.bind(this)
            );
            this.eventManager.subscribe(
                EventManager.EVENTS.AUTH.LOGOUT,
                this.updateUIForUnauthenticatedUser.bind(this)
            );
        }
    }

    /**
     *
     * @param elements
     */
    initialize (elements) {
        if (!elements) {
            throw new Error('Elements required for initialization');
        }
        this.elements = elements;
        super.initialize();

        if (this.elements.messagesContainer) {
            this.renderer = RendererFactory.createMessageRenderer(
                this.elements.messagesContainer,
                null // No chat dependency needed for auth messages
            );
        } else {
            console.warn('[AuthWidget] Messages container not available, auth messages disabled');
        }

        if (this.elements.formsContainer) {
            this.formsView = new AuthFormsView(this.elements.formsContainer);
            const rendered = this.formsView.render();
            this.elements.loginForm = rendered.loginForm;
            this.elements.registerForm = rendered.registerForm;
            this.toggleButtons = rendered.toggleButtons;
        }

        this.formViews = {
            login: new AuthFormView({
                form: this.elements.loginForm,
                fields: {
                    email: '#email',
                    password: '#password'
                },
                feedbackSelector: '[data-auth-feedback="login"]',
                submitSelector: 'button[type="submit"]'
            }),
            register: new AuthFormView({
                form: this.elements.registerForm,
                fields: {
                    email: '#register-email',
                    password: '#register-password'
                },
                feedbackSelector: '[data-auth-feedback="register"]',
                submitSelector: 'button[type="submit"]'
            })
        };

        this.userBadge = new AuthUserBadgeView(this.elements.userInfo);
        if (!this.toggleButtons) {
            this.toggleButtons = Array.from(document.querySelectorAll('.auth-toggle-button'));
        }
        this.setAuthMode('login');

        // Set up event handlers
        this.setupEventHandlers();

        // Check initial auth state
        const currentUser = this.user.getCurrentUser();
        if (currentUser) {
            this.updateUIForAuthenticatedUser(currentUser);
        } else {
            this.updateUIForUnauthenticatedUser();
        }
    }

    /**
     *
     */
    setupEventHandlers () {
        // Login form handler
        if (this.elements.loginForm) {
            this.elements.loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                this.formViews.login.clearFeedback();
                const { email, password } = this.formViews.login.getValues();
                if (email && password) {
                    try {
                        const user = await this.user.handleLogin(email, password);
                        await this.finalizeAuthentication(user);
                        this.formViews.login.showSuccess('Signed in successfully.');
                    } catch (error) {
                        console.error('[AuthWidget] Login failed', error);
                        this.formViews.login.showError(error.message);
                        this.handleError(error);
                    }
                } else {
                    this.formViews.login.showError('Email and password are required.');
                }
            });
        }

        // Register form handler
        if (this.elements.registerForm) {
            this.elements.registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                this.formViews.register.clearFeedback();
                const { email, password } = this.formViews.register.getValues();
                if (email && password) {
                    try {
                        await this.user.handleRegister(email, password);
                        const loggedInUser = await this.user.handleLogin(email, password);
                        await this.finalizeAuthentication(loggedInUser);
                        this.formViews.register.showSuccess('Account created and signed in successfully.');
                    } catch (error) {
                        console.error('[AuthWidget] Register failed', error);
                        this.formViews.register.showError(error.message);
                        this.handleError(error);
                    }
                } else {
                    this.formViews.register.showError('Email and password are required.');
                }
            });
        }

        if (this.toggleButtons.length) {
            this.toggleButtons.forEach((button) => {
                button.addEventListener('click', () => {
                    const mode = button.dataset.authMode;
                    if (mode) {
                        this.setAuthMode(mode);
                    }
                });
            });
        }

        // Logout button handler
        if (this.elements.logoutButton) {
            this.elements.logoutButton.addEventListener('click', async () => {
                try {
                    await this.user.handleLogout();
                    this.updateUIForUnauthenticatedUser();
                } catch (error) {
                    this.handleError(error);
                }
            });
        }
    }

    /**
     *
     * @param user
     */
    updateUIForAuthenticatedUser (user) {
        if (!user) return;

        if (this.formsView) {
            this.formsView.setVisible(false);
        }
        if (this.elements.loginForm) this.elements.loginForm.style.display = 'none';
        if (this.elements.registerForm) this.elements.registerForm.style.display = 'none';
        if (this.elements.logoutButton) this.elements.logoutButton.style.display = 'block';
        if (this.elements.userInfo) {
            this.elements.userInfo.style.display = 'flex';
            this.userBadge.update(user);
        }
        this.setAuthLockState(true);
        this.setAuthMode('login', { silent: true });

        if (this.stateManager) {
            this.stateManager.setState(StateManager.KEYS.USER, user);
            this.stateManager.setState(StateManager.KEYS.AUTHENTICATED, true);
        }
        // Avoid emitting auth events here to prevent recursion
    }

    /**
     *
     */
    updateUIForUnauthenticatedUser () {
        if (this.formsView) {
            this.formsView.setVisible(true);
        }
        if (this.elements.loginForm) this.elements.loginForm.style.display = 'block';
        if (this.elements.registerForm) this.elements.registerForm.style.display = 'block';
        if (this.elements.logoutButton) this.elements.logoutButton.style.display = 'none';
        if (this.elements.userInfo) {
            this.elements.userInfo.style.display = 'none';
            this.userBadge.clear();
        }

        this.formViews.login.clearFeedback();
        this.formViews.register.clearFeedback();
        this.setAuthLockState(false);
        this.setAuthMode('login');

        if (this.stateManager) {
            this.stateManager.setState(StateManager.KEYS.USER, null);
            this.stateManager.setState(StateManager.KEYS.AUTHENTICATED, false);
        }
        // Avoid emitting auth events here to prevent recursion
    }

    /**
     * Ensure the API session stays healthy before celebrating authentication.
     */
    async ensureSession () {
        if (!this.user || typeof this.user.checkSession !== 'function') {
            return;
        }

        try {
            const authenticated = await this.user.checkSession();
            if (!authenticated) {
                console.warn('[AuthWidget] Session check could not confirm the authenticated user.');
            }
        } catch (error) {
            console.error('[AuthWidget] Session check failed after authentication:', error);
        }
    }

    /**
     * Finalize UI / state updates after login / registration succeeds.
     * @param user
     */
    async finalizeAuthentication (user) {
        if (!user) {
            return;
        }

        await this.ensureSession();
        const sessionUser = this.user?.getCurrentUser() || user;
        if (!sessionUser) {
            console.warn('[AuthWidget] No user available after session confirmation.');
            return;
        }

        this.updateUIForAuthenticatedUser(sessionUser);
    }

    /**
     *
     * @param mode
     * @param options
     */
    setAuthMode (mode, options = {}) {
        const { silent = false } = options;
        const isLogin = mode === 'login';

        if (this.elements.loginForm) {
            this.elements.loginForm.style.display = isLogin ? 'block' : 'none';
        }
        if (this.elements.registerForm) {
            this.elements.registerForm.style.display = isLogin ? 'none' : 'block';
        }

        if (this.toggleButtons.length) {
            this.toggleButtons.forEach((button) => {
                const buttonMode = button.dataset.authMode;
                button.classList.toggle('is-active', buttonMode === mode);
            });
        }

        if (!silent) {
            this.formViews.login.clearFeedback();
            this.formViews.register.clearFeedback();
        }
    }

    /**
     *
     * @param isAuthenticated
     */
    setAuthLockState (isAuthenticated) {
        if (document?.body) {
            document.body.classList.toggle('auth-locked', !isAuthenticated);
        }
    }

    /**
     *
     */
    destroy () {
        super.destroy();
        if (this.renderer) {
            this.renderer = null;
        }
    }
}
