import { API_ENDPOINTS, API_HEADERS, ERROR_MESSAGES } from './constants.js';
import { utils } from './utils.js';

export class ScriptPalAPI {
    constructor() {
        this.baseUrl = API_ENDPOINTS.BASE;
    }

    async _handleResponse(response) {
        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                return null;
            }
            throw new Error(data.error || ERROR_MESSAGES.API_ERROR);
        }
        return data;
    }

    async login(email) {
        try {
            const response = await fetch(`${this.baseUrl}/login`, {
                method: 'POST',
                headers: API_HEADERS,
                credentials: 'include',
                body: JSON.stringify({ email })
            });

            return await this._handleResponse(response);
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    async logout() {
        try {
            const response = await fetch(`${this.baseUrl}/logout`, {
                method: 'POST',
                headers: API_HEADERS,
                credentials: 'include'
            });

            return await this._handleResponse(response);
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    }

    async getUser(id) {
        try {
            const response = await fetch(`${this.baseUrl}/user/${id}`, {
                method: 'GET',
                headers: API_HEADERS,
                credentials: 'include'
            });

            return await this._handleResponse(response);
        } catch (error) {
            console.error('Get user error:', error);
            throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }
    }

    async createUser(userData) {
        try {
            const response = await fetch(`${this.baseUrl}/user`, {
                method: 'POST',
                headers: API_HEADERS,
                credentials: 'include',
                body: JSON.stringify(userData)
            });

            return await this._handleResponse(response);
        } catch (error) {
            console.error('Create user error:', error);
            throw new Error(ERROR_MESSAGES.USER_CREATION_FAILED);
        }
    }

    async getResponse(content) {
        try {
            const scriptId = localStorage.getItem('currentScriptId');
            const requestBody = {
                prompt: content,
                scriptId: scriptId
            };

            console.log('Sending request to:', `${this.baseUrl}/chat`);
            console.log('Request body:', requestBody);

            const response = await fetch(`${this.baseUrl}/chat`, {
                method: 'POST',
                headers: API_HEADERS,
                credentials: 'include',
                body: JSON.stringify(requestBody)
            });

            console.log('Response status:', response.status);
            const result = await this._handleResponse(response);
            console.log('API response:', result);

            // Handle both array and single object responses
            const processedResult = Array.isArray(result) ? result[0] : result;

            // Handle both string and object responses
            return typeof processedResult === 'string' ? { html: processedResult } : processedResult;
        } catch (error) {
            console.error('Chat API Error:', error);
            throw new Error(ERROR_MESSAGES.NO_RESPONSE);
        }
    }

    // Add methods for script operations
    async getScript(id) {
        try {
            const response = await fetch(`${this.baseUrl}/script/${id}`, {
                method: 'GET',
                headers: API_HEADERS,
                credentials: 'include'
            });

            return await this._handleResponse(response);
        } catch (error) {
            console.error('Get script error:', error);
            throw new Error(ERROR_MESSAGES.SCRIPT_NOT_FOUND);
        }
    }

    async createScript(scriptData) {
        try {
            const response = await fetch(`${this.baseUrl}/script`, {
                method: 'POST',
                headers: API_HEADERS,
                credentials: 'include',
                body: JSON.stringify(scriptData)
            });

            return await this._handleResponse(response);
        } catch (error) {
            console.error('Create script error:', error);
            throw new Error(ERROR_MESSAGES.SCRIPT_CREATION_FAILED);
        }
    }

    async getCurrentUser() {
        try {
            const response = await fetch(`${this.baseUrl}/user/current`, {
                method: 'GET',
                headers: API_HEADERS,
                credentials: 'include'
            });

            const result = await this._handleResponse(response);
            return result;
        } catch (error) {
            console.error('Get current user error:', error);
            if (error.message !== ERROR_MESSAGES.NOT_AUTHENTICATED) {
                throw error;
            }
            return null;
        }
    }

    async getAllScriptsByUser(userId) {
        try {
            const url = `${this.baseUrl}/script?user_id=${userId}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: API_HEADERS,
                credentials: 'include'
            });
            const result = await this._handleResponse(response);
            return result;
        } catch (error) {
            console.error('Get all scripts error:', error);
            throw new Error(ERROR_MESSAGES.SCRIPT_NOT_FOUND);
        }
    }

    // Add other API methods as needed...
}