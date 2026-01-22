import { API_ENDPOINTS, API_HEADERS, ERROR_MESSAGES, SERVER_PORT } from '../constants.js';
import { utils } from '../utils.js';
import { debugLog } from '../core/logger.js';

/**
 *
 */
export class ScriptPalAPI {
    /**
     *
     */
    constructor () {
        this.baseUrl = `http://localhost:${SERVER_PORT}/api`;
        this.isLoading = false;
        this.requestQueue = new Set();
        this.abortControllers = new Map();
        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 1000,
            retryMultiplier: 2
        };
        this.timeoutConfig = {
            default: 30000,
            upload: 60000,
            download: 45000
        };

        debugLog('[API] Initialized with cookie-based auth');

        // Set up auth message handler (store bound function for cleanup)
        this._boundMessageHandler = this._handlePostMessage.bind(this);
        window.addEventListener('message', this._boundMessageHandler);
    }

    // Token management
    /**
     *
     * @param token
     */
    setToken () {
        // Token handling removed - using cookies instead
        debugLog('[API] Token method called but using cookies');
    }

    /**
     *
     */
    getToken () {
        // Token handling removed - using cookies instead
        return null;
    }

    // Auth message handling
    /**
     *
     * @param event
     */
    _handlePostMessage (event) {
        const allowedOrigins = [
            window.location.origin,
            `http://localhost:${SERVER_PORT}`,
            `http://127.0.0.1:${SERVER_PORT}`
        ];

        if (!allowedOrigins.includes(event.origin)) {
            console.warn('[AUTH] Ignoring message from unrecognized origin:', event.origin);
            return;
        }

        if (event.data && event.data.type === 'auth') {
            this._handleAuthMessage(event.data);
        }
    }

    /**
     *
     * @param data
     */
    _handleAuthMessage (data) {
        debugLog('[AUTH] Received message:', {
            type: data.type,
            action: data.action,
            hasToken: !!data.token
        });

        switch (data.action) {
            case 'login':
                if (data.token) {
                    this.setToken(data.token);
                    debugLog('[AUTH] Token updated from login');
                }
                break;
            case 'logout':
                this.setToken(null);
                debugLog('[AUTH] Token cleared from logout');
                break;
            default:
                console.warn('[AUTH] Unknown message type:', data.action);
        }
    }

    /**
     * Generate a unique correlation ID for request tracking
     * @returns {string} - Unique correlation ID
     */
    _generateCorrelationId () {
        return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * Get timeout for request type
     * @param {string} method - HTTP method
     * @param {string} endpoint - Request endpoint
     * @returns {number} - Timeout in milliseconds
     */
    _getTimeout (method, endpoint) {
        if (endpoint.includes('/upload') || method === 'POST' && endpoint.includes('/script')) {
            return this.timeoutConfig.upload;
        }
        if (method === 'GET' && endpoint.includes('/download')) {
            return this.timeoutConfig.download;
        }
        return this.timeoutConfig.default;
    }

    /**
     * Check if request should be retried
     * @param {number} status - HTTP status code
     * @param {string} method - HTTP method
     * @returns {boolean} - Whether to retry
     */
    _shouldRetry (status, method) {
        // Only retry idempotent methods
        const idempotentMethods = ['GET', 'HEAD', 'PUT', 'DELETE'];
        if (!idempotentMethods.includes(method)) {
            return false;
        }

        // Retry on network errors and 5xx status codes
        return status >= 500 || status === 0;
    }

    /**
     * Sleep for specified milliseconds
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} - Promise that resolves after delay
     */
    _sleep (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Request handling
    /**
     *
     * @param endpoint
     * @param method
     * @param data
     * @param options
     */
    async _makeRequest (endpoint, method = 'GET', data = null, options = {}) {
        const correlationId = this._generateCorrelationId();
        const isSessionCheck = endpoint.includes('/user/current');
        const isLoginEndpoint = endpoint.includes('/login');
        const timeout = options.timeout || this._getTimeout(method, endpoint);
        const maxRetries = options.maxRetries || this.retryConfig.maxRetries;

        // Create abort controller for timeout
        const abortController = new AbortController();
        this.abortControllers.set(correlationId, abortController);

        // Set timeout
        const timeoutId = setTimeout(() => {
            abortController.abort();
        }, timeout);

        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                debugLog(`[API] ${isSessionCheck ? 'Auth ' : ''}Request ${correlationId} (attempt ${attempt + 1}):`, {
                    endpoint,
                    method,
                    hasData: !!data,
                    hasCredentials: true,
                    timeout
                });

                const requestOptions = {
                    method,
                    headers: {
                        ...API_HEADERS,
                        'X-Correlation-ID': correlationId
                    },
                    credentials: 'include',
                    signal: abortController.signal,
                    ...(data && { body: JSON.stringify(data) })
                };

                const response = await fetch(this.baseUrl + endpoint, requestOptions);

                // Clear timeout on successful response
                clearTimeout(timeoutId);

                // Handle 401 for auth endpoints differently
                if (isSessionCheck && response.status === 401) {
                    debugLog(`[API] No active session for ${correlationId}`);
                    return null;
                }

                // Handle other errors
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({
                        error: response.statusText || 'Unknown error'
                    }));

                    const errorMessage = errorData.error || errorData.message || ERROR_MESSAGES.REQUEST_FAILED;
                    const error = new Error(errorMessage);
                    error.status = response.status;
                    error.data = errorData;
                    error.correlationId = correlationId;
                    error.attempt = attempt + 1;

                    // Handle specific status codes
                    if (response.status === 401) {
                        if (!isLoginEndpoint) {
                            error.message = ERROR_MESSAGES.NOT_AUTHENTICATED;
                        }
                        // Don't throw for session check endpoint
                        if (isSessionCheck) {
                            debugLog('[AUTH] Session expired');
                            return null;
                        }
                    } else if (response.status === 403) {
                        error.message = ERROR_MESSAGES.NOT_AUTHORIZED;
                    } else if (response.status === 404) {
                        error.message = ERROR_MESSAGES.NOT_FOUND;
                    }

                    // Check if we should retry
                    if (this._shouldRetry(response.status, method) && attempt < maxRetries) {
                        const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.retryMultiplier, attempt);
                        console.warn(`[API] Request ${correlationId} failed (${response.status}), retrying in ${delay}ms...`);
                        await this._sleep(delay);
                        lastError = error;
                        continue;
                    }

                    throw error;
                }

                const responseData = await response.json();

                // Handle auth responses
                if (isSessionCheck && responseData) {
                    debugLog(`[API] Auth response received ${correlationId}`);
                }

                // Clean up
                this.abortControllers.delete(correlationId);
                return responseData;

            } catch (error) {
                lastError = error;

                // Handle abort/timeout
                if (error.name === 'AbortError') {
                    const timeoutError = new Error(`Request timeout after ${timeout}ms`);
                    timeoutError.correlationId = correlationId;
                    timeoutError.status = 408;
                    throw timeoutError;
                }

                // Handle network errors
                if (!error.status && attempt < maxRetries) {
                    const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.retryMultiplier, attempt);
                    console.warn(`[API] Network error for ${correlationId}, retrying in ${delay}ms...`);
                    await this._sleep(delay);
                    continue;
                }

                // Don't retry for client errors (4xx) or if we've exhausted retries
                const isExpectedAuthError = isSessionCheck && error.status === 401;
                if (!isExpectedAuthError) {
                    console.error(`[API] Request ${correlationId} failed:`, {
                        status: error.status || 500,
                        message: error.message,
                        attempt: attempt + 1,
                        stack: error.stack
                    });
                }

                // Clean up
                this.abortControllers.delete(correlationId);
                throw error;
            }
        }

        // Clean up timeout
        clearTimeout(timeoutId);
        this.abortControllers.delete(correlationId);

        // If we get here, all retries failed
        throw lastError;
    }

    // Auth endpoints
    /**
     *
     * @param email
     * @param password
     */
    async login (email, password) {
        const response = await this._makeRequest('/login', 'POST', { email, password });
        if (!response || !response.user) {
            throw new Error(ERROR_MESSAGES.LOGIN_FAILED);
        }
        return response.user;
    }

    /**
     *
     */
    async logout () {
        return this._makeRequest('/logout', 'POST');
    }

    /**
     *
     */
    async getCurrentUser () {
        try {
            debugLog('[AUTH] Checking session');
            const result = await this._makeRequest(API_ENDPOINTS.USER + '/current', 'GET');
            debugLog('[AUTH] Session check:', { hasUser: !!result });
            return result;
        } catch (error) {
            if (error.status === 401) {
                debugLog('[AUTH] No active session');
                return null;
            }
            throw error;
        }
    }

    /**
     *
     * @param id
     */
    async getUser (id) {
        return this._makeRequest(`${API_ENDPOINTS.USER}/${id}`, 'GET');
    }

    /**
     *
     * @param userData
     */
    async createUser (userData) {
        return this._makeRequest(API_ENDPOINTS.USER, 'POST', userData);
    }

    // Chat endpoints
    /**
     * Get chat response with enhanced script context
     * @param {string} content - The chat message content
     * @param {object} context - Additional context information
     * @returns {Promise<object>} - The chat response
     */
    async getChatResponse (content, context = {}) {
        const scriptId = localStorage.getItem('currentScriptId');
        const scriptTitle = localStorage.getItem('currentScriptTitle');
        const scriptVersion = localStorage.getItem('currentScriptVersion');

        // Prepare enhanced context
        const enhancedContext = {
            scriptId: scriptId || null,
            scriptTitle: scriptTitle || null,
            scriptVersion: scriptVersion || null,
            timestamp: new Date().toISOString(),
            ...context
        };

        // Log the request for debugging
        debugLog('[API] Chat request with context:', {
            prompt: content,
            scriptId: enhancedContext.scriptId,
            scriptTitle: enhancedContext.scriptTitle,
            scriptVersion: enhancedContext.scriptVersion,
            hasContext: Object.keys(context).length > 0
        });

    const result = await this._makeRequest(API_ENDPOINTS.CHAT, 'POST', {
        prompt: content,
        context: enhancedContext
    });

    // Handle response formats
    const processedResult = Array.isArray(result) ? result[0] : result;
    return typeof processedResult === 'string' ? { html: processedResult } : processedResult;
}

    /**
     * Trigger a system prompt from the server
     * @param {string} promptType
     * @param {string|null} scriptId
     * @param {object} context
     */
    async triggerSystemPrompt (promptType, scriptId = null, context = {}) {
        if (!promptType) {
            throw new Error('System prompt type is required');
        }

        return this._makeRequest(API_ENDPOINTS.SYSTEM_PROMPTS, 'POST', {
            promptType,
            scriptId,
            context: {
                timestamp: new Date().toISOString(),
                ...context
            }
        });
    }

    /**
     * Get chat history for a specific script
     * @param {string} scriptId - The script ID
     * @param limit
     * @param offset
     * @returns {Promise<Array>} - Chat history
     */
    async getChatMessages (scriptId = null, limit = 30, offset = 0) {
        const params = new URLSearchParams();
        if (scriptId) params.set('scriptId', scriptId);
        if (limit) params.set('limit', limit);
        if (offset) params.set('offset', offset);
        const queryString = params.toString();
        const endpoint = queryString ?
            `${API_ENDPOINTS.CHAT}/messages?${queryString}` :
            `${API_ENDPOINTS.CHAT}/messages`;
        return this._makeRequest(endpoint, 'GET');
    }

    /**
     * Add a chat message
     * @param {string} scriptId - The script ID
     * @param {object} message - The message object
     * @returns {Promise<object>} - The saved message
     */
    async addChatMessage (scriptId, message) {
        return this._makeRequest(`${API_ENDPOINTS.CHAT}/messages`, 'POST', {
            scriptId,
            message
        });
    }

    /**
     * Clear chat messages for a specific script
     * @param {string} scriptId - The script ID
     * @returns {Promise<boolean>} - Success status
     */
    async clearChatMessages (scriptId) {
        return this._makeRequest(`${API_ENDPOINTS.CHAT}/messages/${scriptId}`, 'DELETE');
    }

    // Script endpoints
    /**
     *
     * @param id
     */
    async getScript (id) {
        return this._makeRequest(`${API_ENDPOINTS.SCRIPT}/${id}`, 'GET');
    }

    /**
     *
     * @param scriptData
     */
    async createScript (scriptData) {
        return this._makeRequest(API_ENDPOINTS.SCRIPT, 'POST', scriptData);
    }

    /**
     *
     * @param id
     * @param scriptData
     */
    async updateScript (id, scriptData) {
        if (!id || !scriptData) {
            throw new Error(ERROR_MESSAGES.VALIDATION_ERROR);
        }

        const title = scriptData.title || localStorage.getItem('currentScriptTitle') || 'Not Set';
        // Prepare update data - let server handle versioning
        const updateData = {
            title: title,
            content: scriptData.content
        };
        if (scriptData.author !== undefined) {
            updateData.author = scriptData.author;
        }

        debugLog('[API] Updating script:', {
            id,
            title: updateData.title,
            contentLength: updateData.content ? updateData.content.length : 0,
            hasCredentials: true,
            hasAuthor: scriptData.author !== undefined
        });

        const result = await this._makeRequest(`${API_ENDPOINTS.SCRIPT}/${id}`, 'PUT', updateData);

        debugLog('[API] Script update result:', {
            success: !!result,
            id,
            versionNumber: result && result.versionNumber,
            timestamp: new Date().toISOString()
        });

        return result;
    }

    /**
     *
     * @param id
     */
    async deleteScript (id) {
        return this._makeRequest(`${API_ENDPOINTS.SCRIPT}/${id}`, 'DELETE');
    }

    /**
     *
     * @param userId
     */
    async getAllScriptsByUser (userId) {
        return this._makeRequest(`${API_ENDPOINTS.SCRIPT}?userId=${userId}`, 'GET');
    }

    /**
     * Cancel a specific request by correlation ID
     * @param {string} correlationId - Correlation ID of request to cancel
     */
    cancelRequest (correlationId) {
        const controller = this.abortControllers.get(correlationId);
        if (controller) {
            controller.abort();
            this.abortControllers.delete(correlationId);
            debugLog(`[API] Cancelled request ${correlationId}`);
        }
    }

    /**
     * Cancel all pending requests
     */
    cancelAllRequests () {
        for (const [correlationId, controller] of this.abortControllers) {
            controller.abort();
            debugLog(`[API] Cancelled request ${correlationId}`);
        }
        this.abortControllers.clear();
    }

    /**
     * Get request statistics
     * @returns {object} - Request statistics
     */
    getStats () {
        return {
            pendingRequests: this.abortControllers.size,
            isLoading: this.isLoading,
            queuedRequests: this.requestQueue.size
        };
    }

    // Cleanup
    /**
     *
     */
    destroy () {
        this.cancelAllRequests();
        this.requestQueue.clear();
        this.isLoading = false;
        if (this._boundMessageHandler) {
            window.removeEventListener('message', this._boundMessageHandler);
            this._boundMessageHandler = null;
        }
    }
}
