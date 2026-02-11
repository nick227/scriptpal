import { API_ENDPOINTS, ERROR_MESSAGES, SERVER_PORT } from '../../constants.js';
import { getApiOrigin } from '../../config.js';
import { debugLog } from '../../core/logger.js';
import { HttpClient } from './HttpClient.js';

/**
 * Authentication service for login, logout, and session management
 */
export class AuthService {
    /**
     * @param {HttpClient} httpClient - Shared HTTP client instance
     */
    constructor(httpClient) {
        this.http = httpClient;
        this._boundMessageHandler = this._handlePostMessage.bind(this);
        this._authCallbacks = new Set();
        
        // Only set up listener in browser environment
        if (typeof window !== 'undefined') {
            window.addEventListener('message', this._boundMessageHandler);
        }
    }

    /**
     * Handle postMessage events for cross-origin auth
     * @private
     */
    _handlePostMessage(event) {
        const apiOrigin = getApiOrigin();
        const allowedOrigins = this._getAllowedOrigins(apiOrigin);

        if (!allowedOrigins.includes(event.origin)) {
            console.warn('[AUTH] Ignoring message from unrecognized origin:', event.origin);
            return;
        }

        if (event.data?.type === 'auth') {
            this._handleAuthMessage(event.data);
        }
    }

    /**
     * Get allowed origins for postMessage
     * @private
     */
    _getAllowedOrigins(apiOrigin) {
        const origins = [apiOrigin];
        
        // Only allow localhost in development
        if (typeof window !== 'undefined') {
            origins.push(window.location.origin);
            
            const isDev = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1';
            if (isDev) {
                origins.push(`http://localhost:${SERVER_PORT}`);
                origins.push(`http://127.0.0.1:${SERVER_PORT}`);
            }
        }
        
        return origins;
    }

    /**
     * Handle auth message from postMessage
     * @private
     */
    _handleAuthMessage(data) {
        debugLog('[AUTH] Received message:', {
            type: data.type,
            action: data.action
        });

        // Notify registered callbacks
        for (const callback of this._authCallbacks) {
            try {
                callback(data.action, data);
            } catch (err) {
                console.error('[AUTH] Callback error:', err);
            }
        }
    }

    /**
     * Register a callback for auth events
     * @param {Function} callback - Callback function(action, data)
     * @returns {Function} Unsubscribe function
     */
    onAuthEvent(callback) {
        this._authCallbacks.add(callback);
        return () => this._authCallbacks.delete(callback);
    }

    /**
     * Login with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<object>} User object
     * @throws {Error} If login fails
     */
    async login(email, password) {
        const response = await this.http.request('/login', {
            method: 'POST',
            data: { email, password }
        });

        if (!response?.user) {
            throw new Error(ERROR_MESSAGES.LOGIN_FAILED);
        }

        return response.user;
    }

    /**
     * Logout current user
     * @returns {Promise<void>}
     */
    async logout() {
        return this.http.request('/logout', { method: 'POST' });
    }

    /**
     * Get current authenticated user
     * @returns {Promise<object|null>} User object or null if not authenticated
     */
    async getCurrentUser() {
        debugLog('[AUTH] Checking session');
        const result = await this.http.request(`${API_ENDPOINTS.USER}/current`, {
            method: 'GET',
            silent401: true,
            maxRetries: 0
        });
        debugLog('[AUTH] Session check:', { hasUser: !!result });
        return result;
    }

    /**
     * Get token watch endpoint
     * @returns {Promise<object>}
     */
    async getTokenWatch() {
        return this.http.request(API_ENDPOINTS.USER_TOKEN_WATCH, {
            method: 'GET',
            maxRetries: 0
        });
    }

    /**
     * Clean up event listeners
     */
    destroy() {
        if (typeof window !== 'undefined' && this._boundMessageHandler) {
            window.removeEventListener('message', this._boundMessageHandler);
            this._boundMessageHandler = null;
        }
        this._authCallbacks.clear();
    }
}
