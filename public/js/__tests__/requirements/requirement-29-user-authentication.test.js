/**
 * Tests for Requirement #29: User login/logout/register
 */

import { ScriptPalUser } from '../../classes/user.js';
import { AuthenticationManager } from '../../widgets/auth/AuthenticationManager.js';

describe('Requirement #29: User Login/Logout/Register', () => {
    let authenticationManager;
    let scriptPalUser;
    let mockContainer;
    let mockStateManager;
    let mockEventManager;
    let mockApi;

    beforeEach(() => {
        // Create mock container
        mockContainer = document.createElement('div');
        mockContainer.innerHTML = `
            <div class="auth-container">
                <form class="login-form">
                    <input type="email" class="email-input" placeholder="Email">
                    <input type="password" class="password-input" placeholder="Password">
                    <button type="submit" class="login-button">Login</button>
                </form>
                <form class="register-form">
                    <input type="text" class="name-input" placeholder="Name">
                    <input type="email" class="email-input" placeholder="Email">
                    <input type="password" class="password-input" placeholder="Password">
                    <button type="submit" class="register-button">Register</button>
                </form>
                <div class="user-profile" style="display: none;">
                    <span class="user-name"></span>
                    <button class="logout-button">Logout</button>
                </div>
            </div>
        `;

        // Create mock state manager
        mockStateManager = {
            getState: jest.fn().mockReturnValue({
                currentUser: null
            }),
            setState: jest.fn(),
            subscribe: jest.fn()
        };

        // Create mock event manager
        mockEventManager = {
            publish: jest.fn(),
            subscribe: jest.fn()
        };

        // Create mock API
        mockApi = {
            login: jest.fn().mockResolvedValue({ success: true, user: { id: 1, name: 'Test User', email: 'test@example.com' } }),
            register: jest.fn().mockResolvedValue({ success: true, user: { id: 1, name: 'Test User', email: 'test@example.com' } }),
            logout: jest.fn().mockResolvedValue({ success: true }),
            checkSession: jest.fn().mockResolvedValue({ success: true, user: { id: 1, name: 'Test User', email: 'test@example.com' } })
        };

        // Create script pal user
        scriptPalUser = new ScriptPalUser(mockApi);

        // Create authentication manager
        authenticationManager = new AuthenticationManager({
            container: mockContainer,
            stateManager: mockStateManager,
            eventManager: mockEventManager,
            user: scriptPalUser
        });
    });

    afterEach(() => {
        authenticationManager.destroy();
    });

    describe('User Registration', () => {
        test('should register new user successfully', async () => {
            const registerForm = mockContainer.querySelector('.register-form');
            const nameInput = registerForm.querySelector('.name-input');
            const emailInput = registerForm.querySelector('.email-input');
            const passwordInput = registerForm.querySelector('.password-input');

            nameInput.value = 'Test User';
            emailInput.value = 'test@example.com';
            passwordInput.value = 'password123';

            const submitEvent = new Event('submit', { bubbles: true });
            registerForm.dispatchEvent(submitEvent);

            await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async operation

            expect(mockApi.register).toHaveBeenCalledWith({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123'
            });
        });

        test('should validate registration form fields', () => {
            const registerForm = mockContainer.querySelector('.register-form');
            const nameInput = registerForm.querySelector('.name-input');
            const emailInput = registerForm.querySelector('.email-input');
            const passwordInput = registerForm.querySelector('.password-input');

            // Test empty fields
            nameInput.value = '';
            emailInput.value = '';
            passwordInput.value = '';

            const isValid = authenticationManager.validateRegistrationForm();
            expect(isValid).toBe(false);

            // Test valid fields
            nameInput.value = 'Test User';
            emailInput.value = 'test@example.com';
            passwordInput.value = 'password123';

            const isValidValid = authenticationManager.validateRegistrationForm();
            expect(isValidValid).toBe(true);
        });

        test('should handle registration errors', async () => {
            mockApi.register.mockRejectedValue(new Error('Registration failed'));

            const registerForm = mockContainer.querySelector('.register-form');
            const nameInput = registerForm.querySelector('.name-input');
            const emailInput = registerForm.querySelector('.email-input');
            const passwordInput = registerForm.querySelector('.password-input');

            nameInput.value = 'Test User';
            emailInput.value = 'test@example.com';
            passwordInput.value = 'password123';

            const submitEvent = new Event('submit', { bubbles: true });
            registerForm.dispatchEvent(submitEvent);

            await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async operation

            // Should handle error gracefully
            expect(mockApi.register).toHaveBeenCalled();
        });

        test('should show registration success message', async () => {
            const registerForm = mockContainer.querySelector('.register-form');
            const nameInput = registerForm.querySelector('.name-input');
            const emailInput = registerForm.querySelector('.email-input');
            const passwordInput = registerForm.querySelector('.password-input');

            nameInput.value = 'Test User';
            emailInput.value = 'test@example.com';
            passwordInput.value = 'password123';

            const submitEvent = new Event('submit', { bubbles: true });
            registerForm.dispatchEvent(submitEvent);

            await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async operation

            // Should show success message
            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'AUTH:REGISTRATION_SUCCESS',
                expect.any(Object)
            );
        });
    });

    describe('User Login', () => {
        test('should login user successfully', async () => {
            const loginForm = mockContainer.querySelector('.login-form');
            const emailInput = loginForm.querySelector('.email-input');
            const passwordInput = loginForm.querySelector('.password-input');

            emailInput.value = 'test@example.com';
            passwordInput.value = 'password123';

            const submitEvent = new Event('submit', { bubbles: true });
            loginForm.dispatchEvent(submitEvent);

            await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async operation

            expect(mockApi.login).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password123'
            });
        });

        test('should validate login form fields', () => {
            const loginForm = mockContainer.querySelector('.login-form');
            const emailInput = loginForm.querySelector('.email-input');
            const passwordInput = loginForm.querySelector('.password-input');

            // Test empty fields
            emailInput.value = '';
            passwordInput.value = '';

            const isValid = authenticationManager.validateLoginForm();
            expect(isValid).toBe(false);

            // Test valid fields
            emailInput.value = 'test@example.com';
            passwordInput.value = 'password123';

            const isValidValid = authenticationManager.validateLoginForm();
            expect(isValidValid).toBe(true);
        });

        test('should handle login errors', async () => {
            mockApi.login.mockRejectedValue(new Error('Login failed'));

            const loginForm = mockContainer.querySelector('.login-form');
            const emailInput = loginForm.querySelector('.email-input');
            const passwordInput = loginForm.querySelector('.password-input');

            emailInput.value = 'test@example.com';
            passwordInput.value = 'password123';

            const submitEvent = new Event('submit', { bubbles: true });
            loginForm.dispatchEvent(submitEvent);

            await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async operation

            // Should handle error gracefully
            expect(mockApi.login).toHaveBeenCalled();
        });

        test('should show login success message', async () => {
            const loginForm = mockContainer.querySelector('.login-form');
            const emailInput = loginForm.querySelector('.email-input');
            const passwordInput = loginForm.querySelector('.password-input');

            emailInput.value = 'test@example.com';
            passwordInput.value = 'password123';

            const submitEvent = new Event('submit', { bubbles: true });
            loginForm.dispatchEvent(submitEvent);

            await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async operation

            // Should show success message
            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'AUTH:LOGIN_SUCCESS',
                expect.any(Object)
            );
        });
    });

    describe('User Logout', () => {
        test('should logout user successfully', async () => {
            const logoutButton = mockContainer.querySelector('.logout-button');

            logoutButton.click();

            await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async operation

            expect(mockApi.logout).toHaveBeenCalled();
        });

        test('should clear user session on logout', async () => {
            const logoutButton = mockContainer.querySelector('.logout-button');

            logoutButton.click();

            await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async operation

            expect(mockStateManager.setState).toHaveBeenCalledWith('CURRENT_USER', null);
        });

        test('should show logout success message', async () => {
            const logoutButton = mockContainer.querySelector('.logout-button');

            logoutButton.click();

            await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async operation

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'AUTH:LOGOUT_SUCCESS',
                expect.any(Object)
            );
        });

        test('should handle logout errors', async () => {
            mockApi.logout.mockRejectedValue(new Error('Logout failed'));

            const logoutButton = mockContainer.querySelector('.logout-button');

            logoutButton.click();

            await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async operation

            // Should handle error gracefully
            expect(mockApi.logout).toHaveBeenCalled();
        });
    });

    describe('User Session Management', () => {
        test('should check user session on initialization', async () => {
            await authenticationManager.checkSession();

            expect(mockApi.checkSession).toHaveBeenCalled();
        });

        test('should restore user session if valid', async () => {
            mockApi.checkSession.mockResolvedValue({
                success: true,
                user: { id: 1, name: 'Test User', email: 'test@example.com' }
            });

            await authenticationManager.checkSession();

            expect(mockStateManager.setState).toHaveBeenCalledWith(
                'CURRENT_USER',
                expect.objectContaining({
                    id: 1,
                    name: 'Test User',
                    email: 'test@example.com'
                })
            );
        });

        test('should clear user session if invalid', async () => {
            mockApi.checkSession.mockResolvedValue({
                success: false,
                user: null
            });

            await authenticationManager.checkSession();

            expect(mockStateManager.setState).toHaveBeenCalledWith('CURRENT_USER', null);
        });

        test('should handle session check errors', async () => {
            mockApi.checkSession.mockRejectedValue(new Error('Session check failed'));

            await authenticationManager.checkSession();

            // Should handle error gracefully
            expect(mockApi.checkSession).toHaveBeenCalled();
        });
    });

    describe('UI State Management', () => {
        test('should show login form when user is not authenticated', () => {
            authenticationManager.updateUIState(null);

            const loginForm = mockContainer.querySelector('.login-form');
            const registerForm = mockContainer.querySelector('.register-form');
            const userProfile = mockContainer.querySelector('.user-profile');

            expect(loginForm.style.display).toBe('');
            expect(registerForm.style.display).toBe('');
            expect(userProfile.style.display).toBe('none');
        });

        test('should show user profile when user is authenticated', () => {
            const user = { id: 1, name: 'Test User', email: 'test@example.com' };
            authenticationManager.updateUIState(user);

            const loginForm = mockContainer.querySelector('.login-form');
            const registerForm = mockContainer.querySelector('.register-form');
            const userProfile = mockContainer.querySelector('.user-profile');
            const userName = userProfile.querySelector('.user-name');

            expect(loginForm.style.display).toBe('none');
            expect(registerForm.style.display).toBe('none');
            expect(userProfile.style.display).toBe('');
            expect(userName.textContent).toBe('Test User');
        });

        test('should toggle between login and register forms', () => {
            const loginForm = mockContainer.querySelector('.login-form');
            const registerForm = mockContainer.querySelector('.register-form');

            // Show register form
            authenticationManager.showRegisterForm();

            expect(loginForm.style.display).toBe('none');
            expect(registerForm.style.display).toBe('');

            // Show login form
            authenticationManager.showLoginForm();

            expect(loginForm.style.display).toBe('');
            expect(registerForm.style.display).toBe('none');
        });

        test('should show loading state during authentication', () => {
            const loginButton = mockContainer.querySelector('.login-button');
            const registerButton = mockContainer.querySelector('.register-button');

            authenticationManager.showLoadingState(true);

            expect(loginButton.disabled).toBe(true);
            expect(registerButton.disabled).toBe(true);

            authenticationManager.showLoadingState(false);

            expect(loginButton.disabled).toBe(false);
            expect(registerButton.disabled).toBe(false);
        });
    });

    describe('Form Validation', () => {
        test('should validate email format', () => {
            const validEmails = [
                'test@example.com',
                'user.name@domain.co.uk',
                'user+tag@example.org'
            ];

            const invalidEmails = [
                'invalid-email',
                '@example.com',
                'user@',
                'user@.com'
            ];

            validEmails.forEach(email => {
                expect(authenticationManager.validateEmail(email)).toBe(true);
            });

            invalidEmails.forEach(email => {
                expect(authenticationManager.validateEmail(email)).toBe(false);
            });
        });

        test('should validate password strength', () => {
            const strongPasswords = [
                'Password123!',
                'MyStr0ng#Pass',
                'SecureP@ssw0rd'
            ];

            const weakPasswords = [
                'password',
                '123456',
                'abc',
                'Password'
            ];

            strongPasswords.forEach(password => {
                expect(authenticationManager.validatePassword(password)).toBe(true);
            });

            weakPasswords.forEach(password => {
                expect(authenticationManager.validatePassword(password)).toBe(false);
            });
        });

        test('should validate name format', () => {
            const validNames = [
                'John Doe',
                'Jane Smith',
                'Mary-Jane Watson',
                'O\'Connor'
            ];

            const invalidNames = [
                '',
                '123',
                'John123',
                'John@Doe'
            ];

            validNames.forEach(name => {
                expect(authenticationManager.validateName(name)).toBe(true);
            });

            invalidNames.forEach(name => {
                expect(authenticationManager.validateName(name)).toBe(false);
            });
        });
    });

    describe('Error Handling', () => {
        test('should handle missing container gracefully', () => {
            const authenticationManagerWithoutContainer = new AuthenticationManager({
                container: null,
                stateManager: mockStateManager,
                eventManager: mockEventManager,
                user: scriptPalUser
            });

            expect(() => {
                authenticationManagerWithoutContainer.updateUIState(null);
            }).not.toThrow();
        });

        test('should handle missing state manager gracefully', () => {
            const authenticationManagerWithoutState = new AuthenticationManager({
                container: mockContainer,
                stateManager: null,
                eventManager: mockEventManager,
                user: scriptPalUser
            });

            expect(() => {
                authenticationManagerWithoutState.updateUIState(null);
            }).not.toThrow();
        });

        test('should handle missing event manager gracefully', () => {
            const authenticationManagerWithoutEvents = new AuthenticationManager({
                container: mockContainer,
                stateManager: mockStateManager,
                eventManager: null,
                user: scriptPalUser
            });

            expect(() => {
                authenticationManagerWithoutEvents.updateUIState(null);
            }).not.toThrow();
        });

        test('should handle missing user service gracefully', () => {
            const authenticationManagerWithoutUser = new AuthenticationManager({
                container: mockContainer,
                stateManager: mockStateManager,
                eventManager: mockEventManager,
                user: null
            });

            expect(() => {
                authenticationManagerWithoutUser.updateUIState(null);
            }).not.toThrow();
        });
    });

    describe('Performance', () => {
        test('should handle rapid authentication requests efficiently', async () => {
            const startTime = Date.now();

            // Rapid authentication requests
            for (let i = 0; i < 10; i++) {
                await authenticationManager.checkSession();
            }

            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
        });

        test('should handle form validation efficiently', () => {
            const startTime = Date.now();

            // Rapid form validation
            for (let i = 0; i < 100; i++) {
                authenticationManager.validateEmail('test@example.com');
                authenticationManager.validatePassword('Password123!');
                authenticationManager.validateName('Test User');
            }

            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(200); // Should complete within 200ms
        });

        test('should handle UI updates efficiently', () => {
            const startTime = Date.now();

            // Rapid UI updates
            for (let i = 0; i < 50; i++) {
                authenticationManager.updateUIState(null);
                authenticationManager.updateUIState({ id: 1, name: 'Test User' });
            }

            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
        });
    });

    describe('Integration with Application', () => {
        test('should integrate with state manager for user state', async () => {
            const user = { id: 1, name: 'Test User', email: 'test@example.com' };

            await authenticationManager.handleLogin(user);

            expect(mockStateManager.setState).toHaveBeenCalledWith('CURRENT_USER', user);
        });

        test('should integrate with event system for notifications', async () => {
            const user = { id: 1, name: 'Test User', email: 'test@example.com' };

            await authenticationManager.handleLogin(user);

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'AUTH:LOGIN_SUCCESS',
                expect.any(Object)
            );
        });

        test('should integrate with user service for authentication', async () => {
            const loginData = {
                email: 'test@example.com',
                password: 'password123'
            };

            await authenticationManager.handleLogin(loginData);

            expect(mockApi.login).toHaveBeenCalledWith(loginData);
        });

        test('should integrate with localStorage for session persistence', () => {
            const user = { id: 1, name: 'Test User', email: 'test@example.com' };

            authenticationManager.saveUserSession(user);

            const savedUser = localStorage.getItem('scriptpal_user');
            expect(savedUser).toBeTruthy();
        });
    });
});
