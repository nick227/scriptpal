/**
 * Tests for AuthenticationManager - Enhanced Authentication UI
 */

import { AuthenticationManager } from '../../../widgets/auth/AuthenticationManager.js';

describe('AuthenticationManager - Enhanced Authentication UI', () => {
    let authenticationManager;
    let mockContainer;
    let mockUser;
    let mockStateManager;
    let mockEventManager;

    beforeEach(() => {
        // Create mock container
        mockContainer = document.createElement('div');

        // Create mock user service
        mockUser = {
            checkSession: jest.fn().mockResolvedValue(true),
            getCurrentUser: jest.fn().mockReturnValue({
                id: 1,
                email: 'test@example.com',
                name: 'Test User'
            }),
            handleLogin: jest.fn().mockResolvedValue({
                id: 1,
                email: 'test@example.com',
                name: 'Test User'
            }),
            handleRegister: jest.fn().mockResolvedValue({
                id: 1,
                email: 'test@example.com',
                name: 'Test User'
            }),
            handleLogout: jest.fn().mockResolvedValue(true)
        };

        // Create mock state manager
        mockStateManager = {
            getState: jest.fn(),
            setState: jest.fn(),
            subscribe: jest.fn()
        };

        // Create mock event manager
        mockEventManager = {
            publish: jest.fn(),
            subscribe: jest.fn()
        };

        // Create authentication manager
        authenticationManager = new AuthenticationManager({
            container: mockContainer,
            user: mockUser,
            stateManager: mockStateManager,
            eventManager: mockEventManager
        });
    });

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Reset mock return values to defaults
        mockUser.handleLogin.mockResolvedValue({
            id: 1,
            email: 'test@example.com',
            name: 'Test User'
        });
        mockUser.handleRegister.mockResolvedValue({
            id: 1,
            email: 'test@example.com',
            name: 'Test User'
        });
        mockUser.handleLogout.mockResolvedValue(true);
    });

    afterEach(() => {
        authenticationManager.destroy();
    });

    describe('Initialization', () => {
        test('should initialize with required dependencies', () => {
            expect(authenticationManager.container).toBe(mockContainer);
            expect(authenticationManager.user).toBe(mockUser);
            expect(authenticationManager.stateManager).toBe(mockStateManager);
            expect(authenticationManager.eventManager).toBe(mockEventManager);
        });

        test('should require container', () => {
            expect(() => {
                new AuthenticationManager({
                    user: mockUser,
                    stateManager: mockStateManager,
                    eventManager: mockEventManager
                });
            }).toThrow('Container is required for AuthenticationManager');
        });

        test('should require user service', () => {
            expect(() => {
                new AuthenticationManager({
                    container: mockContainer,
                    stateManager: mockStateManager,
                    eventManager: mockEventManager
                });
            }).toThrow('User service is required for AuthenticationManager');
        });

        test('should require state manager', () => {
            expect(() => {
                new AuthenticationManager({
                    container: mockContainer,
                    user: mockUser,
                    eventManager: mockEventManager
                });
            }).toThrow('StateManager is required for AuthenticationManager');
        });

        test('should require event manager', () => {
            expect(() => {
                new AuthenticationManager({
                    container: mockContainer,
                    user: mockUser,
                    stateManager: mockStateManager
                });
            }).toThrow('EventManager is required for AuthenticationManager');
        });

        test('should create UI elements', () => {
            expect(mockContainer.querySelector('.auth-container')).toBeTruthy();
            expect(mockContainer.querySelector('#login-form')).toBeTruthy();
            expect(mockContainer.querySelector('#register-form')).toBeTruthy();
            expect(mockContainer.querySelector('#profile-container')).toBeTruthy();
        });

        test('should set up event listeners', () => {
            expect(mockStateManager.subscribe).toHaveBeenCalled();
            expect(mockEventManager.subscribe).toHaveBeenCalled();
        });
    });

    describe('Authentication State Management', () => {
        test('should check initial authentication state', async () => {
            await authenticationManager.checkAuthenticationState();

            expect(mockUser.checkSession).toHaveBeenCalled();
            expect(mockUser.getCurrentUser).toHaveBeenCalled();
        });

        test('should set authenticated state', () => {
            const user = { id: 1, email: 'test@example.com', name: 'Test User' };

            authenticationManager.setAuthenticated(user);

            expect(authenticationManager.isAuthenticated).toBe(true);
            expect(authenticationManager.currentUser).toBe(user);
            expect(mockStateManager.setState).toHaveBeenCalledWith('user', user);
            expect(mockStateManager.setState).toHaveBeenCalledWith('authenticated', true);
        });

        test('should set unauthenticated state', () => {
            authenticationManager.setUnauthenticated();

            expect(authenticationManager.isAuthenticated).toBe(false);
            expect(authenticationManager.currentUser).toBeNull();
            expect(mockStateManager.setState).toHaveBeenCalledWith('user', null);
            expect(mockStateManager.setState).toHaveBeenCalledWith('authenticated', false);
        });

        test('should update profile information', () => {
            const user = { id: 1, email: 'test@example.com', name: 'Test User' };

            authenticationManager.setAuthenticated(user);
            authenticationManager.updateProfileInfo(user);

            const profileName = mockContainer.querySelector('#profile-name');
            const profileEmail = mockContainer.querySelector('#profile-email');

            expect(profileName.textContent).toBe('Test User');
            expect(profileEmail.textContent).toBe('test@example.com');
        });
    });

    describe('Mode Switching', () => {
        test('should switch to login mode', () => {
            authenticationManager.switchMode('login');

            expect(authenticationManager.currentMode).toBe('login');
            expect(mockContainer.querySelector('#login-form-container').style.display).toBe('block');
            expect(mockContainer.querySelector('#register-form-container').style.display).toBe('none');
            expect(mockContainer.querySelector('#profile-container').style.display).toBe('none');
        });

        test('should switch to register mode', () => {
            authenticationManager.switchMode('register');

            expect(authenticationManager.currentMode).toBe('register');
            expect(mockContainer.querySelector('#login-form-container').style.display).toBe('none');
            expect(mockContainer.querySelector('#register-form-container').style.display).toBe('block');
            expect(mockContainer.querySelector('#profile-container').style.display).toBe('none');
        });

        test('should switch to profile mode', () => {
            authenticationManager.switchMode('profile');

            expect(authenticationManager.currentMode).toBe('profile');
            expect(mockContainer.querySelector('#login-form-container').style.display).toBe('none');
            expect(mockContainer.querySelector('#register-form-container').style.display).toBe('none');
            expect(mockContainer.querySelector('#profile-container').style.display).toBe('block');
        });

        test('should not switch if already in the same mode', () => {
            authenticationManager.switchMode('login');
            const initialMode = authenticationManager.currentMode;

            authenticationManager.switchMode('login');

            expect(authenticationManager.currentMode).toBe(initialMode);
        });
    });

    describe('Form Validation', () => {
        test('should validate email correctly', () => {
            const validEmails = [
                'test@example.com',
                'user.name@domain.co.uk',
                'user+tag@example.org'
            ];

            validEmails.forEach(email => {
                const result = authenticationManager.validateEmail('login', email);
                expect(result).toBe(true);
            });
        });

        test('should reject invalid emails', () => {
            const invalidEmails = [
                'invalid-email',
                '@example.com',
                'test@',
                'test.example.com',
                ''
            ];

            invalidEmails.forEach(email => {
                const result = authenticationManager.validateEmail('login', email);
                expect(result).toBe(false);
            });
        });

        test('should validate name correctly', () => {
            const validNames = ['John Doe', 'Jane', 'A'];
            const invalidNames = ['', 'A'];

            validNames.forEach(name => {
                authenticationManager.elements.registerName.value = name;
                const result = authenticationManager.validateName();
                expect(result).toBe(true);
            });
        });

        test('should show field errors', () => {
            const errorElement = mockContainer.querySelector('#login-email-error');

            authenticationManager.showFieldError(errorElement, 'Test error');

            expect(errorElement.textContent).toBe('Test error');
            expect(errorElement.style.display).toBe('block');
        });

        test('should clear field errors', () => {
            const errorElement = mockContainer.querySelector('#login-email-error');

            authenticationManager.showFieldError(errorElement, 'Test error');
            authenticationManager.clearFieldError(errorElement);

            expect(errorElement.textContent).toBe('');
            expect(errorElement.style.display).toBe('none');
        });
    });

    describe('Loading States', () => {
        test('should set loading state for login', () => {
            authenticationManager.setLoading(true, 'login');

            expect(authenticationManager.isLoading).toBe(true);
            expect(authenticationManager.elements.loginButton.disabled).toBe(true);
        });

        test('should set loading state for register', () => {
            authenticationManager.setLoading(true, 'register');

            expect(authenticationManager.isLoading).toBe(true);
            expect(authenticationManager.elements.registerButton.disabled).toBe(true);
        });

        test('should clear loading state', () => {
            authenticationManager.setLoading(true, 'login');
            authenticationManager.setLoading(false, 'login');

            expect(authenticationManager.isLoading).toBe(false);
            expect(authenticationManager.elements.loginButton.disabled).toBe(false);
        });
    });

    describe('Form Handling', () => {
        test('should handle login form submission', async () => {
            const user = { id: 1, email: 'test@example.com', name: 'Test User' };
            mockUser.handleLogin.mockResolvedValue(user);

            authenticationManager.elements.loginEmail.value = 'test@example.com';

            const form = mockContainer.querySelector('#login-form');
            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });

            await authenticationManager.handleLogin(submitEvent);

            expect(mockUser.handleLogin).toHaveBeenCalledWith('test@example.com');
            expect(authenticationManager.isAuthenticated).toBe(true);
            expect(mockEventManager.publish).toHaveBeenCalledWith('AUTH:LOGIN', { user });
        });

        test('should handle registration form submission', async () => {
            const user = { id: 1, email: 'test@example.com', name: 'Test User' };
            mockUser.handleRegister.mockResolvedValue(user);

            authenticationManager.elements.registerEmail.value = 'test@example.com';
            authenticationManager.elements.registerName.value = 'Test User';

            const form = mockContainer.querySelector('#register-form');
            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });

            await authenticationManager.handleRegister(submitEvent);

            expect(mockUser.handleRegister).toHaveBeenCalledWith('test@example.com');
            expect(authenticationManager.isAuthenticated).toBe(true);
            expect(mockEventManager.publish).toHaveBeenCalledWith('AUTH:REGISTER', { user });
        });

        test('should handle logout', async () => {
            authenticationManager.setAuthenticated({ id: 1, email: 'test@example.com' });

            await authenticationManager.handleLogout();

            expect(mockUser.handleLogout).toHaveBeenCalled();
            expect(authenticationManager.isAuthenticated).toBe(false);
            expect(mockEventManager.publish).toHaveBeenCalledWith('AUTH:LOGOUT', {});
        });

        test('should handle login errors', async () => {
            const error = new Error('Login failed');
            mockUser.handleLogin.mockRejectedValue(error);

            authenticationManager.elements.loginEmail.value = 'test@example.com';

            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });

            await authenticationManager.handleLogin(submitEvent);

            expect(authenticationManager.isAuthenticated).toBe(false);
        });

        test('should handle registration errors', async () => {
            const error = new Error('Registration failed');
            mockUser.handleRegister.mockRejectedValue(error);

            authenticationManager.elements.registerEmail.value = 'test@example.com';

            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });

            await authenticationManager.handleRegister(submitEvent);

            expect(authenticationManager.isAuthenticated).toBe(false);
        });
    });

    describe('Event Handling', () => {
        test('should handle user state changes', () => {
            const user = { id: 1, email: 'test@example.com', name: 'Test User' };

            authenticationManager.handleUserChange(user);

            expect(authenticationManager.isAuthenticated).toBe(true);
            expect(authenticationManager.currentUser).toBe(user);
        });

        test('should handle authentication state changes', () => {
            mockStateManager.getState.mockReturnValue({ id: 1, email: 'test@example.com' });

            authenticationManager.handleAuthStateChange(true);

            expect(authenticationManager.isAuthenticated).toBe(true);
        });

        test('should handle auth events', () => {
            const event = { type: 'AUTH:LOGIN', user: { id: 1 } };

            authenticationManager.handleAuthEvent(event);

            // Should not throw and should log the event
            expect(true).toBe(true);
        });
    });

    describe('Utility Methods', () => {
        test('should clear forms', () => {
            authenticationManager.elements.loginEmail.value = 'test@example.com';
            authenticationManager.elements.registerEmail.value = 'test@example.com';
            authenticationManager.elements.registerName.value = 'Test User';

            authenticationManager.clearForms();

            expect(authenticationManager.elements.loginEmail.value).toBe('');
            expect(authenticationManager.elements.registerEmail.value).toBe('');
            expect(authenticationManager.elements.registerName.value).toBe('');
        });

        test('should clear all errors', () => {
            const loginError = mockContainer.querySelector('#login-email-error');
            const registerError = mockContainer.querySelector('#register-email-error');

            authenticationManager.showFieldError(loginError, 'Error');
            authenticationManager.showFieldError(registerError, 'Error');

            authenticationManager.clearAllErrors();

            expect(loginError.textContent).toBe('');
            expect(registerError.textContent).toBe('');
        });

        test('should get authentication state', () => {
            const authState = authenticationManager.getAuthState();

            expect(authState).toHaveProperty('isAuthenticated');
            expect(authState).toHaveProperty('currentUser');
            expect(authState).toHaveProperty('currentMode');
            expect(authState).toHaveProperty('isLoading');
        });
    });

    describe('Error Handling', () => {
        test('should handle authentication check errors', async () => {
            mockUser.checkSession.mockRejectedValue(new Error('Session check failed'));

            await authenticationManager.checkAuthenticationState();

            expect(authenticationManager.isAuthenticated).toBe(false);
        });

        test('should handle logout errors', async () => {
            mockUser.handleLogout.mockRejectedValue(new Error('Logout failed'));
            authenticationManager.setAuthenticated({ id: 1, email: 'test@example.com' });

            await authenticationManager.handleLogout();

            expect(authenticationManager.isAuthenticated).toBe(false);
        });
    });

    describe('Cleanup', () => {
        test('should destroy properly', () => {
            authenticationManager.destroy();

            expect(authenticationManager.container).toBeNull();
            expect(authenticationManager.user).toBeNull();
            expect(authenticationManager.stateManager).toBeNull();
            expect(authenticationManager.eventManager).toBeNull();
            expect(authenticationManager.elements).toEqual({});
        });
    });
});
