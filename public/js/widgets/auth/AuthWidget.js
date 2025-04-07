import { BaseWidget } from '../BaseWidget.js';
import { EventBus } from '../../core/EventBus.js';
import { MESSAGE_TYPES } from '../../constants.js';
import { RendererFactory } from '../../renderers.js';

export class AuthWidget extends BaseWidget {
    constructor(elements, stateManager, user, eventBus) {
        super(elements);
        this.stateManager = stateManager;
        this.eventManager = eventBus;
        this.user = user;
        this.renderer = null;
        this.events = null;
    }

    setupEventSubscriptions() {
        // Subscribe to auth events
        this.subscribe(EventBus.EVENTS.AUTH.LOGIN, ({ user }) => {
            this.handleLogin(user);
        });

        this.subscribe(EventBus.EVENTS.AUTH.LOGOUT, () => {
            this.handleLogout();
        });
    }

    initialize(elements) {
        if (!elements) {
            throw new Error('Elements required for initialization');
        }
        this.elements = elements;
        super.initialize();

        if (!this.elements.messagesContainer) {
            throw new Error('Messages container element is required');
        }

        // Create renderer for auth messages
        this.renderer = RendererFactory.createMessageRenderer(
            this.elements.messagesContainer,
            null // No chat dependency needed for auth messages
        );

        // Set up event handlers
        this.setupEventHandlers();

        // Update UI based on current auth state
        const currentUser = this.user.getCurrentUser();
        if (currentUser) {
            this.handleLogin(currentUser);
        }
    }

    setupEventHandlers() {
        // Login form handler
        if (this.elements.loginForm) {
            this.elements.loginForm.addEventListener('submit', async(e) => {
                e.preventDefault();
                const email = this.elements.loginForm.querySelector('#email').value;
                if (email) {
                    try {
                        await this.user.handleLogin(email);
                        const user = this.user.getCurrentUser();
                        if (user) {
                            this.handleLogin(user);
                            this.eventManager.publish(EventBus.EVENTS.AUTH.LOGIN, { user });
                        }
                    } catch (error) {
                        this.handleError(error);
                    }
                }
            });
        }

        // Register form handler
        if (this.elements.registerForm) {
            this.elements.registerForm.addEventListener('submit', async(e) => {
                e.preventDefault();
                const email = this.elements.registerForm.querySelector('#register-email').value;
                if (email) {
                    try {
                        await this.user.handleRegister(email);
                        const user = this.user.getCurrentUser();
                        if (user) {
                            this.handleLogin(user);
                            this.eventManager.publish(EventBus.EVENTS.AUTH.LOGIN, { user });
                        }
                    } catch (error) {
                        this.handleError(error);
                    }
                }
            });
        }

        // Logout button handler
        if (this.elements.logoutButton) {
            this.elements.logoutButton.addEventListener('click', async() => {
                try {
                    await this.user.handleLogout();
                    this.handleLogout();
                    this.eventManager.publish(EventBus.EVENTS.AUTH.LOGOUT);
                } catch (error) {
                    this.handleError(error);
                }
            });
        }
    }

    handleLogin(user) {
        this.updateUIForAuthenticatedUser(user);
    }

    handleLogout() {
        if (this.renderer) {
            this.renderer.render('You have been logged out.', MESSAGE_TYPES.ASSISTANT);
        }
        this.updateUIForUnauthenticatedUser();
    }

    updateUIForAuthenticatedUser(user) {
        if (this.elements.loginForm) this.elements.loginForm.style.display = 'none';
        if (this.elements.registerForm) this.elements.registerForm.style.display = 'none';
        if (this.elements.logoutButton) this.elements.logoutButton.style.display = 'block';
        if (this.elements.userInfo) {
            this.elements.userInfo.textContent = `Logged in as: ${user.email}`;
        }
    }

    updateUIForUnauthenticatedUser() {
        if (this.elements.loginForm) this.elements.loginForm.style.display = 'block';
        if (this.elements.registerForm) this.elements.registerForm.style.display = 'block';
        if (this.elements.logoutButton) this.elements.logoutButton.style.display = 'none';
        if (this.elements.userInfo) {
            this.elements.userInfo.textContent = '';
        }
    }

    destroy() {
        super.destroy();
        if (this.renderer) {
            this.renderer = null;
        }
        if (this.events) {
            this.events = null;
        }
    }
}