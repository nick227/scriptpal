import { API_ENDPOINTS, API_HEADERS, ERROR_MESSAGES } from './constants.js';
import { utils } from './utils.js';

export class ScriptPalAPI {
    constructor() {
        // Use Node.js server URL for API requests
        this.baseUrl = 'http://localhost:3000/api';

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


            // Handle empty responses
            if (response.status === 204) {
                return null;
            }

            // Try to parse as JSON even if content-type is not set
            try {
                const data = await response.json();


                if (!response.ok) {
                    if (response.status === 401) {
                        console.warn('Authentication required');
                        return null;
                    }
                    throw new Error(data.error || ERROR_MESSAGES.API_ERROR);
                }
                return data;
            } catch (jsonError) {
                console.warn('Failed to parse JSON response:', jsonError);

                // If content type was application/json, this is a real error
                if (contentType && contentType.includes('application/json')) {
                    throw new Error('Invalid JSON response');
                }

                // For non-JSON responses, try to get text
                const textContent = await response.text();
                return { text: textContent };
            }
        } catch (error) {
            console.error('Response handling error:', error);
            throw error;
        }
    }

    async _makeRequest(endpoint, options = {}) {
        const requestId = `${options.method || 'GET'}-${endpoint}`;
        const url = `${this.baseUrl}${endpoint}`;

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
            const response = await fetch(url, {
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
                console.error('No response received from server');
                throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
            }

            // Log response details before processing
            const responseDetails = {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                url: response.url
            };


            // Special handling for 404s
            if (response.status === 404) {
                console.warn('Resource not found:', url);
                return null;
            }

            return await this._handleResponse(response);
        } catch (error) {
            console.error('API request failed:', {
                url,
                method: options.method,
                error: error.message,
                stack: error.stack
            });
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

        const result = await this._makeRequest(`/script/${id}`, {
            method: 'GET'
        });

        return result;
    }

    async createScript(scriptData) {
        return this._makeRequest('/script', {
            method: 'POST',
            body: JSON.stringify(scriptData)
        });
    }

    async updateScript(id, scriptData) {

        const result = await this._makeRequest(`/script/${id}`, {
            method: 'PUT',
            body: JSON.stringify(scriptData)
        });

        return result;
    }

    async deleteScript(id) {
        return this._makeRequest(`/script/${id}`, {
            method: 'DELETE'
        });
    }

    async getAllScriptsByUser(userId) {

        const result = await this._makeRequest(`/script?user_id=${userId}`, {
            method: 'GET'
        });

        return result;
    }

    // Cleanup method
    destroy() {
        this.requestQueue.clear();
        this.isLoading = false;
        // Clean up postMessage listener
        window.removeEventListener('message', this._handlePostMessage.bind(this));
    }
}