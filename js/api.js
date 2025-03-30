import { API_ENDPOINTS, API_HEADERS, ERROR_MESSAGES } from './constants.js';
import { utils } from './utils.js';

export class ScriptPalAPI {
    constructor() {
        // Only add port 3000 for localhost
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        this.baseUrl = window.location.protocol + '//' + window.location.hostname + (isLocalhost ? ':3000' : '');
        this.isLoading = false;
        this.requestQueue = new Set();

        // Set up postMessage listener
        window.addEventListener('message', this._handlePostMessage.bind(this));
    }

    _handlePostMessage(event) {
        // Verify origin
        const allowedOrigins = [
            window.location.origin,
            'http://localhost:3000',
            'http://127.0.0.1:3000'
        ];

        if (!allowedOrigins.includes(event.origin)) {
            console.warn('Ignoring postMessage from unrecognized origin:', event.origin);
            return;
        }

        // Handle the message
        if (event.data && event.data.type === 'auth') {
            // Handle auth-related messages
            this._handleAuthMessage(event.data);
        }
    }

    _handleAuthMessage(data) {
        // Handle different auth message types
        switch (data.action) {
            case 'login':
                // Handle login
                break;
            case 'logout':
                // Handle logout
                break;
            default:
                console.warn('Unknown auth message type:', data.action);
        }
    }

    getRandomButtons() {
        return this._makeRequest('/welcome/buttons', {
            method: 'GET'
        });
    }

    setLoading(loading) {
        this.isLoading = loading;
    }

    async _handleResponse(response) {
        try {
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Invalid response format');
            }

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    return null;
                }
                throw new Error(data.error || ERROR_MESSAGES.API_ERROR);
            }
            return data;
        } catch (error) {
            console.error('Response handling error:', error);
            throw error;
        }
    }

    async _makeRequest(endpoint, options = {}) {
        const requestId = `${options.method || 'GET'}-${endpoint}`;

        if (this.requestQueue.has(requestId)) {
            console.warn(`Ignoring duplicate request: ${requestId}`);
            return null;
        }

        if (this.isLoading) {
            console.warn('Ignoring API request while loading');
            return null;
        }

        try {
            this.isLoading = true;
            this.requestQueue.add(requestId);
            console.log('Making API request to:', `${this.baseUrl}${endpoint}`);

            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: {
                    ...API_HEADERS,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                mode: 'cors',
                cache: 'no-cache',
                referrerPolicy: 'no-referrer',
                redirect: 'follow'
            });

            if (!response) {
                throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
            }

            return await this._handleResponse(response);
        } catch (error) {
            console.error(`API request error for ${endpoint}:`, error);
            if (error.message === 'Failed to fetch') {
                throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
            }
            throw error;
        } finally {
            this.isLoading = false;
            this.requestQueue.delete(requestId);
        }
    }

    // Auth methods
    async login(email) {
        return this._makeRequest('/login', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    }

    async logout() {
        return this._makeRequest('/logout', {
            method: 'POST'
        });
    }

    async getUser(id) {
        return this._makeRequest(`/user/${id}`, {
            method: 'GET'
        });
    }

    async createUser(userData) {
        return this._makeRequest('/user', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async getCurrentUser() {
        try {
            const result = await this._makeRequest('/user/current', {
                method: 'GET'
            });
            return result;
        } catch (error) {
            if (error.message !== ERROR_MESSAGES.NOT_AUTHENTICATED) {
                throw error;
            }
            return null;
        }
    }

    // Chat methods
    async getResponse(content) {
        const scriptId = localStorage.getItem('currentScriptId');
        const requestBody = {
            prompt: content,
            scriptId: scriptId
        };

        const result = await this._makeRequest('/chat', {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });

        // Handle both array and single object responses
        const processedResult = Array.isArray(result) ? result[0] : result;

        // Handle both string and object responses
        return typeof processedResult === 'string' ? { html: processedResult } : processedResult;
    }

    // Script methods
    async getScript(id) {
        return this._makeRequest(`/script/${id}`, {
            method: 'GET'
        });
    }

    async createScript(scriptData) {
        return this._makeRequest('/script', {
            method: 'POST',
            body: JSON.stringify(scriptData)
        });
    }

    async updateScript(id, scriptData) {
        return this._makeRequest(`/script/${id}`, {
            method: 'PUT',
            body: JSON.stringify(scriptData)
        });
    }

    async deleteScript(id) {
        return this._makeRequest(`/script/${id}`, {
            method: 'DELETE'
        });
    }

    async getAllScriptsByUser(userId) {
        return this._makeRequest(`/script?user_id=${userId}`, {
            method: 'GET'
        });
    }

    // Cleanup method
    destroy() {
        this.requestQueue.clear();
        this.isLoading = false;
        // Clean up postMessage listener
        window.removeEventListener('message', this._handlePostMessage.bind(this));
    }
}