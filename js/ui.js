import { CONFIG } from './config.js';
import { MessageRenderer, UserRenderer, AssistantResponseRenderer } from './renderers.js';
import { MESSAGE_TYPES, LAYOUTS, ERROR_MESSAGES, SUCCESS_MESSAGES, UI_ELEMENTS } from './constants.js';

export class ScriptPalUI {
    constructor(chat, user, script) {
        this.chat = chat;
        this.user = user;
        this.script = script;
        this.messageRenderer = null;
        this.assistantRenderer = null;
        this.elements = {};
        this.initializeElements();
    }

    updateComponents(chat, script) {
        this.chat = chat;
        this.script = script;
        if (this.chat && !this.messageRenderer) {
            this.messageRenderer = new MessageRenderer(this.elements.messagesContainer);
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

        // Initialize optional elements
        this.elements.toggleView = document.querySelector(UI_ELEMENTS.TOGGLE_VIEW);
        this.elements.chatButtons = document.querySelector(UI_ELEMENTS.CHAT_BUTTONS);

        // Validate required elements
        if (!this.elements.messagesContainer || !this.elements.input || !this.elements.sendButton) {
            throw new Error(ERROR_MESSAGES.REQUIRED_ELEMENTS_MISSING);
        }

        // Initialize renderer only if chat is available
        if (this.chat) {
            this.messageRenderer = new MessageRenderer(this.elements.messagesContainer);
        }
        this.userRenderer = new UserRenderer(this.elements.userInfo, this.user);

        // Setup initial view
        this.setupCurrentView();
    }

    async initialize(user = null) {
        if (this.messageRenderer) {
            this.messageRenderer.clear();
        }
        if (this.chat) {
            this.chat.clearMessages();
        }

        // Update UI based on provided user status
        if (user) {
            this.updateUIForAuthenticatedUser(user);
        } else {
            this.updateUIForUnauthenticatedUser();
        }

        // Display all scripts
        this.script.loadCurrentScript();

        this.setupEventListeners();
    }

    updateUIForAuthenticatedUser(user) {
        // Hide auth forms
        if (this.elements.loginForm) {
            this.elements.loginForm.style.display = 'none';
        }
        if (this.elements.registerForm) {
            this.elements.registerForm.style.display = 'none';
        }

        // Show user info and logout
        if (this.elements.userInfo) {
            this.elements.userInfo.innerHTML = `Logged in as: ${user.email} <a class="logout-button" href="#">logout</a>`;
        }
        if (this.elements.logoutButton) {
            this.elements.logoutButton.style.display = 'block';
        }

        // Enable chat functionality
        this.elements.input.disabled = false;
        this.elements.sendButton.disabled = false;
    }

    updateUIForUnauthenticatedUser() {
        // Show auth forms
        if (this.elements.loginForm) {
            this.elements.loginForm.style.display = 'block';
        }
        if (this.elements.registerForm) {
            this.elements.registerForm.style.display = 'block';
        }

        // Hide user info and logout
        if (this.elements.userInfo) {
            this.elements.userInfo.textContent = 'Please log in or register';
        }
        if (this.elements.logoutButton) {
            this.elements.logoutButton.style.display = 'none';
        }

        // Disable chat functionality
        this.elements.input.disabled = true;
        this.elements.sendButton.disabled = true;
    }

    setupEventListeners() {
        // Setup logout click handler
        this.elements.logoutButton = document.querySelector(UI_ELEMENTS.LOGOUT_BUTTON);

        // Setup send button click handler
        if (this.elements.sendButton) {
            this.elements.sendButton.addEventListener('click', () => this.handleSend());
        }

        // Setup input enter key handler
        if (this.elements.input) {
            this.elements.input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSend();
                }
            });
        }

        // Setup view toggle handler
        if (this.elements.toggleView) {
            this.elements.toggleView.addEventListener('click', () => {
                document.body.classList.toggle(LAYOUTS.HORIZONTAL);
                document.body.classList.toggle(LAYOUTS.VERTICAL);
                this.saveCurrentView();
            });
        }

        // Auth events
        if (this.elements.loginForm) {
            this.elements.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        if (this.elements.logoutButton) {
            this.elements.logoutButton.addEventListener('click', (e) => this.handleLogout(e));
        }
        if (this.elements.registerForm) {
            this.elements.registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }
    }

    saveCurrentView() {
        const currentView = document.body.classList.contains(LAYOUTS.HORIZONTAL) ? LAYOUTS.HORIZONTAL : LAYOUTS.VERTICAL;
        localStorage.setItem('scriptpal-view', currentView);
    }

    setupCurrentView() {
        const currentView = localStorage.getItem('scriptpal-view');
        if (currentView) {
            document.body.classList.add(currentView);
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const emailInput = this.elements.registerForm.querySelector('input[type="email"]');
        const email = emailInput.value.trim();

        if (!email) {
            this.showError(ERROR_MESSAGES.INVALID_EMAIL);
            return;
        }

        try {
            this.setLoading(true);
            // Create user with just email
            await this.user.createUser({ email });
            this.showSuccess(SUCCESS_MESSAGES.REGISTER_SUCCESS);
            // After successful registration, log the user in
            await this.user.login(email);
            const user = this.user.getCurrentUser();
            this.updateUIForAuthenticatedUser(user);
        } catch (error) {
            console.error('Registration error:', error);
            this.showError(ERROR_MESSAGES.USER_CREATION_FAILED);
        } finally {
            this.setLoading(false);
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const emailInput = this.elements.loginForm.querySelector('input[type="email"]');
        const email = emailInput.value.trim();

        if (!email) {
            this.showError(ERROR_MESSAGES.INVALID_EMAIL);
            return;
        }

        try {
            this.setLoading(true);
            await this.user.login(email);
            const user = this.user.getCurrentUser();
            this.updateUIForAuthenticatedUser(user);
            this.showSuccess(SUCCESS_MESSAGES.LOGIN_SUCCESS);
        } catch (error) {
            this.showError(ERROR_MESSAGES.LOGIN_FAILED);
        } finally {
            this.setLoading(false);
        }
    }

    async handleLogout(e) {
        e.preventDefault();
        try {
            this.setLoading(true);
            await this.user.logout();
            this.updateUIForUnauthenticatedUser();
            this.showSuccess(SUCCESS_MESSAGES.LOGOUT_SUCCESS);
        } catch (error) {
            this.showError(ERROR_MESSAGES.LOGOUT_FAILED);
        } finally {
            this.setLoading(false);
        }
    }

    async handleSend() {
        if (!this.user.isAuthenticated()) {
            this.showError(ERROR_MESSAGES.NOT_AUTHENTICATED);
            return;
        }

        const message = this.elements.input.value.trim();
        if (!message) return;

        try {
            this.setLoading(true);
            this.elements.input.value = '';
            this.elements.sendButton.disabled = true;

            // Render user message
            this.messageRenderer.render(message, MESSAGE_TYPES.USER);

            // Get and render assistant response
            const response = await this.chat.processMessage(message);
            console.log('response:', response);

            // Render assistant message
            if (response.html) {
                this.messageRenderer.render(response.html, MESSAGE_TYPES.ASSISTANT);
            }

            // Render buttons if present
            if (response.buttons) {
                this.messageRenderer.renderButtons(response.buttons);
            }
        } catch (error) {
            console.error('Error processing message:', error);
            this.messageRenderer.render(ERROR_MESSAGES.API_ERROR, MESSAGE_TYPES.ERROR);
            this.showError(ERROR_MESSAGES.MESSAGE_SEND_FAILED);
        } finally {
            this.setLoading(false);
            this.elements.sendButton.disabled = false;
        }
    }

    setLoading(isLoading) {
        if (this.elements.sendButton) {
            this.elements.sendButton.disabled = isLoading;
            this.elements.sendButton.textContent = isLoading ? 'Sending...' : 'Send';
        }
        if (this.elements.input) {
            this.elements.input.disabled = isLoading;
        }
    }

    showError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        document.body.appendChild(errorElement);

        setTimeout(() => {
            errorElement.remove();
        }, 5000);
    }

    showSuccess(message) {
        const successElement = document.createElement('div');
        successElement.className = 'success-message';
        successElement.textContent = message;
        document.body.appendChild(successElement);

        setTimeout(() => {
            successElement.remove();
        }, 3000);
    }
}