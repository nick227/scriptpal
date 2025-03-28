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

    async login(email) {
        try {
            this.currentUser = await this.api.login(email);
            return this.currentUser;
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    }

    async logout() {
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

    async createUser(userData) {
        try {
            const newUser = await this.api.createUser(userData);
            return newUser;
        } catch (error) {
            console.error('Create user failed:', error);
            throw new Error(ERROR_MESSAGES.USER_CREATION_FAILED);
        }
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    getCurrentUser() {
        return this.currentUser;
    }
}