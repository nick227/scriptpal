import { API_ENDPOINTS, API_HEADERS, ERROR_MESSAGES } from './constants.js';
import { utils } from './utils.js';

export class ScriptPalAPI {
    constructor() {
        // Use Node.js server URL for API requests
        this.baseUrl = 'http://localhost:3000/api';
        this.endpoints = {
            scripts: '/scripts',
            script: '/script'
        };

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

            // Always try to get the response text first
            const responseText = await response.text();

            // Try to parse as JSON if it looks like JSON
            let data = null;
            if (responseText && responseText.trim()) {
                try {
                    data = JSON.parse(responseText);
                } catch (e) {
                    // If content type was application/json, this is a real error
                    if (contentType && contentType.includes('application/json')) {
                        console.error('Failed to parse JSON response:', responseText);
                        throw new Error('Invalid JSON response from server');
                    }
                    // For non-JSON responses, return the text
                    return { text: responseText };
                }
            }

            // Handle error responses
            if (!response.ok) {
                const errorMessage = data && data.error ? data.error : response.statusText || 'API Error';
                const error = new Error(errorMessage);
                error.status = response.status;
                error.data = data;
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Response handling error:', error);
            throw error;
        }
    }

    async _makeRequest(endpoint, options = {}) {
        const requestId = `${options.method || 'GET'}-${endpoint}`;
        const url = `${this.baseUrl}${endpoint}`;

        // Wait for any existing request to complete
        if (this.requestQueue.has(requestId)) {
            console.warn(`Request in progress: ${requestId}, waiting...`);
            await new Promise(resolve => {
                const checkQueue = () => {
                    if (!this.requestQueue.has(requestId)) {
                        resolve();
                    } else {
                        setTimeout(checkQueue, 100);
                    }
                };
                checkQueue();
            });
        }

        if (this.isLoading) {
            console.warn('API is busy, waiting...');
            await new Promise(resolve => {
                const checkLoading = () => {
                    if (!this.isLoading) {
                        resolve();
                    } else {
                        setTimeout(checkLoading, 100);
                    }
                };
                checkLoading();
            });
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
    async getChatResponse(content) {
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

    async getChatHistory() {
        return this._makeRequest('/chat/history', {
            method: 'GET'
        });
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

    async updateScript(scriptId, data) {
        try {
            // Validate required fields
            if (!scriptId) {
                throw new Error('Script ID is required');
            }
            if (!data.content) {
                throw new Error('Content is required');
            }
            if (typeof data.content !== 'string') {
                throw new Error('Content must be a string');
            }
            if (!data.title) {
                throw new Error('Title is required');
            }

            // Format version number as major.minor
            const version = data.version || '1';
            const formattedVersion = version.toString().includes('.') ?
                version.toString() :
                `${version.toString()}.0`;

            // Make API request
            const response = await this._makeRequest(`${this.endpoints.script}/${scriptId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    title: data.title,
                    content: data.content,
                    version_number: formattedVersion
                })
            });

            return response;
        } catch (error) {
            console.error('Failed to update script:', error);
            throw error;
        }
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