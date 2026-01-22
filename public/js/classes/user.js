import { ERROR_MESSAGES } from '../constants.js';
import { loadRawFromStorage, removeFromStorage, saveJsonToStorage } from '../managers/PersistenceManager.js';
import { debugLog } from '../core/logger.js';

/**
 *
 */
export class ScriptPalUser {
    /**
     *
     * @param api
     */
    constructor (api) {
        this.api = api;
        this.currentUser = null;
        this.isCheckingSession = false;

        // Try to restore session from localStorage
        const savedUser = loadRawFromStorage('currentUser');
        if (savedUser) {
            try {
                this.currentUser = JSON.parse(savedUser);
            } catch (e) {
                removeFromStorage('currentUser');
            }
        }
    }

    /**
     *
     */
    async checkSession () {
        if (this.isCheckingSession) {
            return this.isAuthenticated();
        }

        try {
            this.isCheckingSession = true;
            debugLog('[USER] Checking session state:', {
                hasCurrentUser: !!this.currentUser,
                savedUser: !!loadRawFromStorage('currentUser')
            });

            const user = await this.api.getCurrentUser();

            if (user) {
                this.currentUser = user;
                saveJsonToStorage('currentUser', user);
                return true;
            } else {
                this.currentUser = null;
                removeFromStorage('currentUser');
                return false;
            }
        } catch (error) {
            console.error('[USER] Session check failed:', error);
            this.currentUser = null;
            localStorage.removeItem('currentUser');
            return false;
        } finally {
            this.isCheckingSession = false;
        }
    }

    /**
     *
     * @param email
     * @param password
     */
    async handleLogin (email, password) {
        try {
            if (!email || !password) {
                throw new Error(ERROR_MESSAGES.INVALID_EMAIL);
            }

            this.currentUser = await this.api.login(email, password);

            if (!this.currentUser) {
                console.error('[USER] Login returned no user data');
                throw new Error(ERROR_MESSAGES.LOGIN_FAILED);
            }

            debugLog('[USER] Login successful:', {
                userId: this.currentUser.id,
                email: this.currentUser.email
            });

            saveJsonToStorage('currentUser', this.currentUser);
            return this.currentUser;
        } catch (error) {
            console.error('[USER] Login failed:', error);
            this.currentUser = null;
            removeFromStorage('currentUser');

            if (error.message === ERROR_MESSAGES.INVALID_EMAIL) {
                throw error;
            }
            throw error;
        }
    }

    /**
     *
     * @param email
     * @param password
     */
    async handleRegister (email, password) {
        try {
            if (!email || !password) {
                throw new Error(ERROR_MESSAGES.INVALID_EMAIL);
            }

            this.currentUser = await this.api.createUser({ email, password });
            if (!this.currentUser) {
                throw new Error(ERROR_MESSAGES.USER_CREATION_FAILED);
            }
            return this.currentUser;
        } catch (error) {
            console.error('Registration failed:', error);
            if (error.message === ERROR_MESSAGES.INVALID_EMAIL) {
                throw error;
            }
            throw error;
        }
    }

    /**
     *
     */
    async handleLogout () {
        try {
            await this.api.logout();
            this.currentUser = null;
            removeFromStorage('currentUser');
        } catch (error) {
            console.error('[USER] Logout failed:', error);
            // Still clear local state even if server logout fails
            this.currentUser = null;
            localStorage.removeItem('currentUser');
            throw error;
        }
    }

    /**
     *
     * @param id
     */
    async getUser (id) {
        try {
            return await this.api.getUser(id);
        } catch (error) {
            console.error('[USER] Get user failed:', error);
            throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }
    }

    /**
     *
     */
    isAuthenticated () {
        const hasUser = !!this.currentUser;
        const hasSavedUser = !!loadRawFromStorage('currentUser');
        debugLog('[USER] Checking authentication state:', {
            hasUser,
            hasSavedUser
        });
        return hasUser;
    }

    /**
     *
     */
    getCurrentUser () {
        return this.currentUser;
    }
}
