import { ERROR_MESSAGES } from './constants.js';

export class ScriptPalUser {
    constructor(api) {
        this.api = api;
        this.currentUser = null;
    }

    async checkSession() {
        try {
            this.currentUser = await this.api.getCurrentUser();
            return this.currentUser !== null;
        } catch (error) {
            console.error('Session check failed:', error);
            this.currentUser = null;
            return false;
        }
    }

    async handleLogin(email) {
        try {
            if (!email) {
                throw new Error(ERROR_MESSAGES.INVALID_EMAIL);
            }

            this.currentUser = await this.api.login(email);
            if (!this.currentUser) {
                throw new Error(ERROR_MESSAGES.LOGIN_FAILED);
            }
            return this.currentUser;
        } catch (error) {
            console.error('Login failed:', error);
            if (error.message === ERROR_MESSAGES.INVALID_EMAIL) {
                throw error;
            }
            if (error.message === 'Email already exists') {
                throw new Error(ERROR_MESSAGES.USER_CREATION_FAILED);
            }
            throw new Error(ERROR_MESSAGES.LOGIN_FAILED);
        }
    }

    async handleRegister(email) {
        try {
            if (!email) {
                throw new Error(ERROR_MESSAGES.INVALID_EMAIL);
            }

            this.currentUser = await this.api.createUser({ email });
            if (!this.currentUser) {
                throw new Error(ERROR_MESSAGES.USER_CREATION_FAILED);
            }
            return this.currentUser;
        } catch (error) {
            console.error('Registration failed:', error);
            if (error.message === ERROR_MESSAGES.INVALID_EMAIL) {
                throw error;
            }
            throw new Error(ERROR_MESSAGES.USER_CREATION_FAILED);
        }
    }

    async handleLogout() {
        try {
            await this.api.logout();
            this.currentUser = null;
        } catch (error) {
            console.error('Logout failed:', error);
            throw error;
        }
    }

    async getUser(id) {
        try {
            const userData = await this.api.getUser(id);
            return userData;
        } catch (error) {
            console.error('Get user failed:', error);
            throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    getCurrentUser() {
        return this.currentUser;
    }
}