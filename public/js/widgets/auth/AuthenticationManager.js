/**
 * AuthenticationManager - Enhanced user authentication UI management
 * Provides modern login, registration, and user management interface
 */

import { EventManager } from '../../core/EventManager.js';
import { StateManager } from '../../core/StateManager.js';

/**
 * AuthenticationManager class for managing user authentication UI
 */
export class AuthenticationManager {
    /**
     * Constructor
     * @param {object} options - Configuration options
     * @param {object} options.container - Container element for authentication UI
     * @param {object} options.user - User service for authentication operations
     * @param {object} options.stateManager - State manager for current state tracking
     * @param {object} options.eventManager - Event manager for notifications
     */
    constructor (options) {
        if (!options.container) {
            throw new Error('Container is required for AuthenticationManager');
        }
        if (!options.user) {
            throw new Error('User service is required for AuthenticationManager');
        }
        if (!options.stateManager) {
            throw new Error('StateManager is required for AuthenticationManager');
        }
        if (!options.eventManager) {
            throw new Error('EventManager is required for AuthenticationManager');
        }

        this.container = options.container;
        this.user = options.user;
        this.stateManager = options.stateManager;
        this.eventManager = options.eventManager;

        // Authentication state
        this.isAuthenticated = false;
        this.currentUser = null;
        this.isLoading = false;
        this.currentMode = 'login'; // 'login', 'register', 'profile'

        // UI elements
        this.elements = {};

        // Event handlers
        this.eventHandlers = new Map();

        // Initialize
        this.initialize();
    }

    /**
     * Initialize the authentication manager
     */
    async initialize () {

        // Create UI elements
        this.createUI();

        // Set up event listeners
        this.setupEventListeners();

        // Check initial authentication state
        await this.checkAuthenticationState();

    }

    /**
     * Create authentication UI elements
     */
    createUI () {
        // Clear container
        this.container.innerHTML = '';

        // Create main authentication container
        const authContainer = document.createElement('div');
        authContainer.className = 'auth-container';
        authContainer.innerHTML = `
            <div class="auth-header">
                <h2 class="auth-title">Welcome to ScriptPal</h2>
                <p class="auth-subtitle">Your AI-powered script writing assistant</p>
            </div>

            <div class="auth-content">
                <!-- Login Form -->
                <div class="auth-form-container" id="login-form-container">
                    <form class="auth-form" id="login-form">
                        <div class="form-group">
                            <label for="login-email" class="form-label">Email Address</label>
                            <input type="email" id="login-email" class="form-input" placeholder="Enter your email" required>
                            <div class="form-error" id="login-email-error"></div>
                        </div>
                        <div class="form-group">
                            <label for="login-password" class="form-label">Password</label>
                            <input type="password" id="login-password" class="form-input" placeholder="Enter your password" required>
                            <div class="form-error" id="login-password-error"></div>
                        </div>
                        <button type="submit" class="auth-button auth-button-primary" id="login-button">
                            <span class="button-text">Sign In</span>
                            <span class="button-loading" style="display: none;">
                                <i class="fas fa-spinner fa-spin"></i> Signing In...
                            </span>
                        </button>
                    </form>
                    <div class="auth-switch">
                        <p>Don't have an account? <a href="#" id="switch-to-register">Create one</a></p>
                    </div>
                </div>

                <!-- Registration Form -->
                <div class="auth-form-container" id="register-form-container" style="display: none;">
                    <form class="auth-form" id="register-form">
                        <div class="form-group">
                            <label for="register-email" class="form-label">Email Address</label>
                            <input type="email" id="register-email" class="form-input" placeholder="Enter your email" required>
                            <div class="form-error" id="register-email-error"></div>
                        </div>
                        <div class="form-group">
                            <label for="register-password" class="form-label">Password</label>
                            <input type="password" id="register-password" class="form-input" placeholder="Create a password" required>
                            <div class="form-error" id="register-password-error"></div>
                        </div>
                        <div class="form-group">
                            <label for="register-name" class="form-label">Full Name (Optional)</label>
                            <input type="text" id="register-name" class="form-input" placeholder="Enter your name">
                            <div class="form-error" id="register-name-error"></div>
                        </div>
                        <button type="submit" class="auth-button auth-button-primary" id="register-button">
                            <span class="button-text">Create Account</span>
                            <span class="button-loading" style="display: none;">
                                <i class="fas fa-spinner fa-spin"></i> Creating Account...
                            </span>
                        </button>
                    </form>
                    <div class="auth-switch">
                        <p>Already have an account? <a href="#" id="switch-to-login">Sign in</a></p>
                    </div>
                </div>

                <!-- User Profile -->
                <div class="auth-form-container" id="profile-container" style="display: none;">
                    <div class="user-profile">
                        <div class="profile-header">
                            <div class="profile-avatar">
                                <i class="fas fa-user"></i>
                            </div>
                            <div class="profile-info">
                                <h3 class="profile-name" id="profile-name">User Name</h3>
                                <p class="profile-email" id="profile-email">user@example.com</p>
                            </div>
                        </div>
                        <div class="profile-actions">
                            <button class="auth-button auth-button-secondary" id="edit-profile-button">
                                <i class="fas fa-edit"></i> Edit Profile
                            </button>
                            <button class="auth-button auth-button-danger" id="logout-button">
                                <i class="fas fa-sign-out-alt"></i> Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="auth-footer">
                <p class="auth-help">
                    <i class="fas fa-info-circle"></i>
                    Need help? Contact support or check our documentation.
                </p>
            </div>
        `;

        this.container.appendChild(authContainer);

        // Store element references
        this.elements = {
            // Forms
            loginForm: authContainer.querySelector('#login-form'),
            registerForm: authContainer.querySelector('#register-form'),

            // Form containers
            loginContainer: authContainer.querySelector('#login-form-container'),
            registerContainer: authContainer.querySelector('#register-form-container'),
            profileContainer: authContainer.querySelector('#profile-container'),

            // Inputs
            loginEmail: authContainer.querySelector('#login-email'),
            loginPassword: authContainer.querySelector('#login-password'),
            registerEmail: authContainer.querySelector('#register-email'),
            registerPassword: authContainer.querySelector('#register-password'),
            registerName: authContainer.querySelector('#register-name'),

            // Buttons
            loginButton: authContainer.querySelector('#login-button'),
            registerButton: authContainer.querySelector('#register-button'),
            logoutButton: authContainer.querySelector('#logout-button'),
            editProfileButton: authContainer.querySelector('#edit-profile-button'),

            // Switch links
            switchToRegister: authContainer.querySelector('#switch-to-register'),
            switchToLogin: authContainer.querySelector('#switch-to-login'),

            // Profile elements
            profileName: authContainer.querySelector('#profile-name'),
            profileEmail: authContainer.querySelector('#profile-email'),

            // Error elements
            loginEmailError: authContainer.querySelector('#login-email-error'),
            loginPasswordError: authContainer.querySelector('#login-password-error'),
            registerEmailError: authContainer.querySelector('#register-email-error'),
            registerPasswordError: authContainer.querySelector('#register-password-error'),
            registerNameError: authContainer.querySelector('#register-name-error')
        };
    }

    /**
     * Set up event listeners
     */
    setupEventListeners () {
        // Form submissions
        this.elements.loginForm.addEventListener('submit', this.handleLogin.bind(this));
        this.elements.registerForm.addEventListener('submit', this.handleRegister.bind(this));

        // Button clicks
        this.elements.logoutButton.addEventListener('click', this.handleLogout.bind(this));
        this.elements.editProfileButton.addEventListener('click', this.handleEditProfile.bind(this));

        // Mode switching
        this.elements.switchToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchMode('register');
        });
        this.elements.switchToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchMode('login');
        });

        // Input validation
        this.elements.loginEmail.addEventListener('blur', () => this.validateEmail('login'));
        this.elements.loginPassword.addEventListener('blur', () => this.validatePassword('login'));
        this.elements.registerEmail.addEventListener('blur', () => this.validateEmail('register'));
        this.elements.registerPassword.addEventListener('blur', () => this.validatePassword('register'));
        this.elements.registerName.addEventListener('blur', () => this.validateName());

        // State manager subscriptions
        this.stateManager.subscribe(StateManager.KEYS.USER, this.handleUserChange.bind(this));
        this.stateManager.subscribe(StateManager.KEYS.AUTHENTICATED, this.handleAuthStateChange.bind(this));

        // Event manager subscriptions
        this.eventManager.subscribe(EventManager.EVENTS.AUTH.LOGIN, this.handleAuthEvent.bind(this));
        this.eventManager.subscribe(EventManager.EVENTS.AUTH.LOGOUT, this.handleAuthEvent.bind(this));
        this.eventManager.subscribe(EventManager.EVENTS.AUTH.REGISTER, this.handleAuthEvent.bind(this));
    }

    /**
     * Check initial authentication state
     */
    async checkAuthenticationState () {
        try {
            this.setLoading(true);

            const isAuthenticated = await this.user.checkSession();
            const currentUser = this.user.getCurrentUser();

            if (isAuthenticated && currentUser) {
                this.setAuthenticated(currentUser);
            } else {
                this.setUnauthenticated();
            }

        } catch (error) {
            console.error('[AuthenticationManager] Failed to check authentication state:', error);
            this.setUnauthenticated();
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Handle login form submission
     * @param {Event} event - Form submit event
     */
    async handleLogin (event) {
        event.preventDefault();

        const email = this.elements.loginEmail.value.trim();
        const password = this.elements.loginPassword.value;

        if (!this.validateEmail('login', email)) {
            return;
        }
        if (!this.validatePassword('login', password)) {
            return;
        }

        try {
            this.setLoading(true, 'login');
            this.clearErrors('login');

            const user = await this.user.handleLogin(email, password);

            this.setAuthenticated(user);
            this.showSuccess('Login successful! Welcome back.');

            // Emit login event
            this.eventManager.publish(EventManager.EVENTS.AUTH.LOGIN, { user });

        } catch (error) {
            console.error('[AuthenticationManager] Login failed:', error);
            this.showError('login', error.message);
        } finally {
            this.setLoading(false, 'login');
        }
    }

    /**
     * Handle registration form submission
     * @param {Event} event - Form submit event
     */
    async handleRegister (event) {
        event.preventDefault();

        const email = this.elements.registerEmail.value.trim();
        const password = this.elements.registerPassword.value;
        const name = this.elements.registerName.value.trim();

        if (!this.validateEmail('register', email)) {
            return;
        }
        if (!this.validatePassword('register', password)) {
            return;
        }

        try {
            this.setLoading(true, 'register');
            this.clearErrors('register');

            const user = await this.user.handleRegister(email, password);

            this.setAuthenticated(user);
            this.showSuccess('Account created successfully! Welcome to ScriptPal.');

            // Emit register event
            this.eventManager.publish(EventManager.EVENTS.AUTH.REGISTER, { user });

        } catch (error) {
            console.error('[AuthenticationManager] Registration failed:', error);
            this.showError('register', error.message);
        } finally {
            this.setLoading(false, 'register');
        }
    }

    /**
     * Handle logout
     */
    async handleLogout () {
        try {
            this.setLoading(true);

            await this.user.handleLogout();

            this.setUnauthenticated();
            this.showSuccess('You have been signed out successfully.');

            // Emit logout event
            this.eventManager.publish(EventManager.EVENTS.AUTH.LOGOUT, {});

        } catch (error) {
            console.error('[AuthenticationManager] Logout failed:', error);
            this.showError('profile', 'Failed to sign out. Please try again.');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Handle edit profile
     */
    handleEditProfile () {
        // Profile editing functionality
        this._showProfileEditDialog();
    }

    /**
     * Show profile edit dialog
     */
    _showProfileEditDialog () {
        const currentUser = this.user;
        if (!currentUser) {
            this.showError('No user logged in');
            return;
        }

        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'profile-edit-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <h3>Edit Profile</h3>
                <div class="dialog-body">
                    <form id="profile-edit-form">
                        <div class="form-group">
                            <label for="username">Username:</label>
                            <input type="text" id="username" name="username" value="${currentUser.username || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="email">Email:</label>
                            <input type="email" id="email" name="email" value="${currentUser.email || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="displayName">Display Name:</label>
                            <input type="text" id="displayName" name="displayName" value="${currentUser.displayName || ''}">
                        </div>
                        <div class="dialog-actions">
                            <button type="submit" class="btn btn-primary">Save</button>
                            <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Add to page
        document.body.appendChild(dialog);

        // Handle form submission
        const form = dialog.querySelector('#profile-edit-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const profileData = {
                username: formData.get('username'),
                email: formData.get('email'),
                displayName: formData.get('displayName')
            };

            try {
                await this._updateProfile(profileData);
                dialog.remove();
                this.showSuccess('Profile updated successfully');
            } catch (error) {
                this.showError('Failed to update profile: ' + error.message);
            }
        });

        // Handle cancel
        dialog.addEventListener('click', (e) => {
            if (e.target.dataset.action === 'cancel' || e.target === dialog) {
                dialog.remove();
            }
        });
    }

    /**
     * Update user profile
     * @param {object} profileData - Profile data to update
     */
    async _updateProfile (profileData) {
        // TODO: Implement actual profile update API call

        // For now, just update local user object
        Object.assign(this.user, profileData);

        // Emit profile update event
        this.eventManager.publish(EventManager.EVENTS.AUTH.PROFILE_UPDATED, {
            user: this.user
        });
    }

    /**
     * Switch between authentication modes
     * @param {string} mode - Mode to switch to ('login', 'register', 'profile')
     */
    switchMode (mode) {
        if (mode === this.currentMode) {
            return;
        }

        // Hide all containers
        this.elements.loginContainer.style.display = 'none';
        this.elements.registerContainer.style.display = 'none';
        this.elements.profileContainer.style.display = 'none';

        // Show selected container
        switch (mode) {
            case 'login':
                this.elements.loginContainer.style.display = 'block';
                this.elements.loginEmail.focus();
                break;
            case 'register':
                this.elements.registerContainer.style.display = 'block';
                this.elements.registerEmail.focus();
                break;
            case 'profile':
                this.elements.profileContainer.style.display = 'block';
                break;
        }

        this.currentMode = mode;
        this.clearAllErrors();

    }

    /**
     * Set authenticated state
     * @param {object} user - User object
     */
    setAuthenticated (user) {
        this.isAuthenticated = true;
        this.currentUser = user;

        // Update state manager
        this.stateManager.setState(StateManager.KEYS.USER, user);
        this.stateManager.setState(StateManager.KEYS.AUTHENTICATED, true);

        // Update UI
        this.updateProfileInfo(user);
        this.switchMode('profile');

    }

    /**
     * Set unauthenticated state
     */
    setUnauthenticated () {
        this.isAuthenticated = false;
        this.currentUser = null;

        // Update state manager
        this.stateManager.setState(StateManager.KEYS.USER, null);
        this.stateManager.setState(StateManager.KEYS.AUTHENTICATED, false);

        // Update UI
        this.switchMode('login');
        this.clearForms();

    }

    /**
     * Update profile information display
     * @param {object} user - User object
     */
    updateProfileInfo (user) {
        this.elements.profileName.textContent = user.name || 'User';
        this.elements.profileEmail.textContent = user.email;
    }

    /**
     * Set loading state
     * @param {boolean} loading - Loading state
     * @param {string} form - Form type ('login', 'register', 'profile')
     */
    setLoading (loading, form = null) {
        this.isLoading = loading;

        if (form === 'login') {
            this.elements.loginButton.disabled = loading;
            const buttonText = this.elements.loginButton.querySelector('.button-text');
            const buttonLoading = this.elements.loginButton.querySelector('.button-loading');

            if (loading) {
                buttonText.style.display = 'none';
                buttonLoading.style.display = 'inline';
            } else {
                buttonText.style.display = 'inline';
                buttonLoading.style.display = 'none';
            }
        } else if (form === 'register') {
            this.elements.registerButton.disabled = loading;
            const buttonText = this.elements.registerButton.querySelector('.button-text');
            const buttonLoading = this.elements.registerButton.querySelector('.button-loading');

            if (loading) {
                buttonText.style.display = 'none';
                buttonLoading.style.display = 'inline';
            } else {
                buttonText.style.display = 'inline';
                buttonLoading.style.display = 'none';
            }
        } else {
            // General loading state
            this.elements.logoutButton.disabled = loading;
        }
    }

    /**
     * Validate email input
     * @param {string} form - Form type ('login', 'register')
     * @param {string} email - Email to validate
     * @returns {boolean} - Whether email is valid
     */
    validateEmail (form, email = null) {
        const emailValue = email || (form === 'login' ? this.elements.loginEmail.value : this.elements.registerEmail.value);
        const errorElement = form === 'login' ? this.elements.loginEmailError : this.elements.registerEmailError;

        if (!emailValue) {
            this.showFieldError(errorElement, 'Email is required');
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailValue)) {
            this.showFieldError(errorElement, 'Please enter a valid email address');
            return false;
        }

        this.clearFieldError(errorElement);
        return true;
    }

    /**
     * Validate name input
     * @returns {boolean} - Whether name is valid
     */
    validateName () {
        const name = this.elements.registerName.value.trim();

        if (name && name.length < 2) {
            this.showFieldError(this.elements.registerNameError, 'Name must be at least 2 characters');
            return false;
        }

        this.clearFieldError(this.elements.registerNameError);
        return true;
    }

    /**
     * Validate password input
     * @param {string} form - Form type ('login', 'register')
     * @param {string} password - Password to validate
     * @returns {boolean} - Whether password is valid
     */
    validatePassword (form, password = null) {
        const passwordValue = password ?? (form === 'login' ? this.elements.loginPassword.value : this.elements.registerPassword.value);
        const errorElement = form === 'login' ? this.elements.loginPasswordError : this.elements.registerPasswordError;

        if (!passwordValue) {
            this.showFieldError(errorElement, 'Password is required');
            return false;
        }

        this.clearFieldError(errorElement);
        return true;
    }

    /**
     * Show field error
     * @param {HTMLElement} errorElement - Error element
     * @param {string} message - Error message
     */
    showFieldError (errorElement, message) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    /**
     * Clear field error
     * @param {HTMLElement} errorElement - Error element
     */
    clearFieldError (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }

    /**
     * Show error message
     * @param {string} form - Form type
     * @param {string} message - Error message
     */
    showError (form, message) {
        // For now, show as alert. In a real app, you'd want a proper notification system
        alert(`Error: ${message}`);
    }

    /**
     * Show success message
     * @param {string} message - Success message
     */
    showSuccess (message) {
        // For now, show as alert. In a real app, you'd want a proper notification system
        alert(`Success: ${message}`);
    }

    /**
     * Show info message
     * @param {string} message - Info message
     */
    showInfo (message) {
        // For now, show as alert. In a real app, you'd want a proper notification system
        alert(`Info: ${message}`);
    }

    /**
     * Clear all errors
     */
    clearAllErrors () {
        this.clearErrors('login');
        this.clearErrors('register');
    }

    /**
     * Clear form errors
     * @param {string} form - Form type
     */
    clearErrors (form) {
        if (form === 'login') {
            this.clearFieldError(this.elements.loginEmailError);
            this.clearFieldError(this.elements.loginPasswordError);
        } else if (form === 'register') {
            this.clearFieldError(this.elements.registerEmailError);
            this.clearFieldError(this.elements.registerPasswordError);
            this.clearFieldError(this.elements.registerNameError);
        }
    }

    /**
     * Clear form inputs
     */
    clearForms () {
        this.elements.loginEmail.value = '';
        this.elements.loginPassword.value = '';
        this.elements.registerEmail.value = '';
        this.elements.registerPassword.value = '';
        this.elements.registerName.value = '';
        this.clearAllErrors();
    }

    /**
     * Handle user state changes
     * @param {object} user - User object
     */
    handleUserChange (user) {
        if (user && user !== this.currentUser) {
            this.setAuthenticated(user);
        } else if (!user && this.isAuthenticated) {
            this.setUnauthenticated();
        }
    }

    /**
     * Handle authentication state changes
     * @param {boolean} authenticated - Authentication state
     */
    handleAuthStateChange (authenticated) {
        if (authenticated && !this.isAuthenticated) {
            const user = this.stateManager.getState(StateManager.KEYS.CURRENT_USER);
            if (user) {
                this.setAuthenticated(user);
            }
        } else if (!authenticated && this.isAuthenticated) {
            this.setUnauthenticated();
        }
    }

    /**
     * Handle authentication events
     * @param {object} event - Authentication event
     */
    handleAuthEvent (event) {
        // Handle external auth events if needed
    }

    /**
     * Get current authentication state
     * @returns {object} - Authentication state
     */
    getAuthState () {
        return {
            isAuthenticated: this.isAuthenticated,
            currentUser: this.currentUser,
            currentMode: this.currentMode,
            isLoading: this.isLoading
        };
    }

    /**
     * Destroy the authentication manager
     */
    destroy () {
        // Clear event handlers
        this.eventHandlers.clear();

        // Clear references
        this.container = null;
        this.user = null;
        this.stateManager = null;
        this.eventManager = null;
        this.elements = {};

    }
}
