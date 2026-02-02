import { getApiBaseUrl, getApiOrigin } from '../../config.js';
import { API_ENDPOINTS, API_HEADERS, ERROR_MESSAGES, SERVER_PORT } from '../../constants.js';
import { debugLog } from '../../core/logger.js';
import { utils } from '../../utils.js';

/**
 *
 */
export class ScriptPalAPI {
    /**
     *
     */
    constructor () {
        this.baseUrl = getApiBaseUrl();
        this.isLoading = false;
        this.requestQueue = new Set();
        this.abortControllers = new Map();
        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 1000,
            retryMultiplier: 2
        };
        this.timeoutConfig = {
            default: 90000,
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

    /**
     *
     * @param scriptId
     */
    _requireScriptId (scriptId) {
        if (!scriptId) {
            throw new Error('Script ID is required');
        }
    }

    /**
     *
     * @param scriptId
     * @param itemId
     * @param label
     */
    _requireScriptAndItemId (scriptId, itemId, label) {
        if (!scriptId || !itemId) {
            throw new Error(`Script ID and ${label} ID are required`);
        }
    }

    /**
     *
     * @param scriptId
     * @param segment
     * @param itemId
     */
    _scriptItemPath (scriptId, segment, itemId) {
        const base = `${API_ENDPOINTS.SCRIPT}/${scriptId}/${segment}`;
        return itemId ? `${base}/${itemId}` : base;
    }

    // Auth message handling
    /**
     *
     * @param event
     */
    _handlePostMessage (event) {
        const apiOrigin = getApiOrigin();
        const allowedOrigins = [
            window.location.origin,
            apiOrigin,
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
                        error.message = ERROR_MESSAGES.NOT_FOUND || error.message;
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

                if (response.status === 204) {
                    this.abortControllers.delete(correlationId);
                    return null;
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

    /**
     *
     * @param endpoint
     * @param method
     * @param formData
     * @param options
     */
    async _makeFormRequest (endpoint, method = 'POST', formData = null, options = {}) {
        const correlationId = this._generateCorrelationId();
        const timeout = options.timeout || this._getTimeout(method, endpoint);
        const maxRetries = options.maxRetries || this.retryConfig.maxRetries;

        const abortController = new AbortController();
        this.abortControllers.set(correlationId, abortController);

        const timeoutId = setTimeout(() => {
            abortController.abort();
        }, timeout);

        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const requestOptions = {
                    method,
                    headers: {
                        'X-Correlation-ID': correlationId
                    },
                    credentials: 'include',
                    signal: abortController.signal,
                    ...(formData && { body: formData })
                };

                const response = await fetch(this.baseUrl + endpoint, requestOptions);
                clearTimeout(timeoutId);

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

                    if (this._shouldRetry(response.status, method) && attempt < maxRetries) {
                        const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.retryMultiplier, attempt);
                        await this._sleep(delay);
                        lastError = error;
                        continue;
                    }

                    throw error;
                }

                if (response.status === 204) {
                    return null;
                }

                return await response.json();
            } catch (error) {
                if (error.name === 'AbortError') {
                    throw new Error('Request timeout');
                }
                if (attempt < maxRetries && this._shouldRetry(error.status || 0, method)) {
                    const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.retryMultiplier, attempt);
                    await this._sleep(delay);
                    lastError = error;
                    continue;
                }
                throw error;
            }
        }

        throw lastError || new Error(ERROR_MESSAGES.NETWORK_ERROR);
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
     */
    async getTokenWatch () {
        return this._makeRequest(API_ENDPOINTS.USER_TOKEN_WATCH, 'GET');
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
     *
     * @param scriptId
     * @param context
     */
    async requestNextLines (scriptId, context = {}) {
        if (!scriptId) {
            throw new Error('Script ID is required for next lines');
        }

        return this._makeRequest(`${API_ENDPOINTS.SCRIPT}/${scriptId}/next-lines`, 'POST', {
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

    // Brainstorm endpoints
    /**
     *
     */
    async listBrainstormBoards () {
        return this._makeRequest(API_ENDPOINTS.BRAINSTORM_BOARDS, 'GET');
    }

    /**
     *
     * @param boardId
     */
    async getBrainstormBoard (boardId) {
        if (!boardId) {
            throw new Error('Board ID is required');
        }
        return this._makeRequest(`${API_ENDPOINTS.BRAINSTORM_BOARDS}/${boardId}`, 'GET');
    }

    /**
     *
     * @param root0
     * @param root0.title
     * @param root0.seed
     * @param root0.notes
     */
    async createBrainstormBoard ({ title, seed, notes }) {
        return this._makeRequest(API_ENDPOINTS.BRAINSTORM_BOARDS, 'POST', {
            title,
            seed,
            notes
        });
    }

    /**
     *
     * @param boardId
     * @param root0
     * @param root0.title
     * @param root0.seed
     * @param root0.notes
     */
    async updateBrainstormBoard (boardId, { title, seed, notes }) {
        if (!boardId) {
            throw new Error('Board ID is required');
        }
        return this._makeRequest(`${API_ENDPOINTS.BRAINSTORM_BOARDS}/${boardId}`, 'PUT', {
            title,
            seed,
            notes
        });
    }

    /**
     *
     * @param boardId
     */
    async deleteBrainstormBoard (boardId) {
        if (!boardId) {
            throw new Error('Board ID is required');
        }
        return this._makeRequest(`${API_ENDPOINTS.BRAINSTORM_BOARDS}/${boardId}`, 'DELETE');
    }

    /**
     *
     * @param boardId
     * @param category
     */
    async requestBrainstormNotes (boardId, category) {
        if (!boardId) {
            throw new Error('Board ID is required');
        }
        if (!category) {
            throw new Error('Category is required');
        }
        return this._makeRequest(API_ENDPOINTS.BRAINSTORM_AI(boardId, category), 'POST', {});
    }

    /**
     *
     * @param boardId
     */
    async requestBrainstormTitle (boardId) {
        if (!boardId) {
            throw new Error('Board ID is required');
        }
        return this._makeRequest(API_ENDPOINTS.BRAINSTORM_AI(boardId, 'title'), 'POST', {});
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
     * @param scriptId
     */
    async getScenes (scriptId) {
        this._requireScriptId(scriptId);
        return this._makeRequest(this._scriptItemPath(scriptId, 'scenes'), 'GET');
    }

    /**
     *
     * @param scriptId
     */
    async getCharacters (scriptId) {
        this._requireScriptId(scriptId);
        return this._makeRequest(this._scriptItemPath(scriptId, 'characters'), 'GET');
    }

    /**
     *
     * @param scriptId
     */
    async getLocations (scriptId) {
        this._requireScriptId(scriptId);
        return this._makeRequest(this._scriptItemPath(scriptId, 'locations'), 'GET');
    }

    /**
     *
     * @param scriptId
     */
    async getThemes (scriptId) {
        this._requireScriptId(scriptId);
        return this._makeRequest(this._scriptItemPath(scriptId, 'themes'), 'GET');
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
        if (scriptData.description !== undefined) {
            updateData.description = scriptData.description;
        }
        if (scriptData.visibility !== undefined) {
            const normalizedVisibility = String(scriptData.visibility || '').toLowerCase();
            const allowedVisibilities = new Set(['private', 'public']);
            if (allowedVisibilities.has(normalizedVisibility)) {
                updateData.visibility = normalizedVisibility;
            }
        }

        debugLog('[API] Updating script:', {
            id,
            title: updateData.title,
            contentLength: updateData.content ? updateData.content.length : 0,
            hasCredentials: true,
            hasAuthor: scriptData.author !== undefined,
            hasDescription: scriptData.description !== undefined
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

    // Media endpoints
    /**
     *
     * @param file
     * @param type
     */
    async uploadMedia (file, type) {
        if (!file || !type) {
            throw new Error(ERROR_MESSAGES.VALIDATION_ERROR);
        }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);
        return this._makeFormRequest(API_ENDPOINTS.MEDIA_UPLOAD, 'POST', formData);
    }

    /**
     *
     * @param payload
     */
    async generateMedia (payload) {
        return this._makeRequest(API_ENDPOINTS.MEDIA_GENERATE, 'POST', payload);
    }

    /**
     *
     * @param params
     */
    async listMedia (params = {}) {
        const query = new URLSearchParams();
        if (params.type) {
            query.set('type', params.type);
        }
        if (params.page) {
            query.set('page', String(params.page));
        }
        if (params.pageSize) {
            query.set('pageSize', String(params.pageSize));
        }
        const suffix = query.toString();
        const endpoint = suffix ? `${API_ENDPOINTS.MEDIA}?${suffix}` : API_ENDPOINTS.MEDIA;
        return this._makeRequest(endpoint, 'GET');
    }

    /**
     *
     * @param assetId
     * @param payload
     */
    async attachMedia (assetId, payload) {
        if (!assetId || !payload) {
            throw new Error(ERROR_MESSAGES.VALIDATION_ERROR);
        }
        return this._makeRequest(`${API_ENDPOINTS.MEDIA}/${assetId}/attach`, 'POST', payload);
    }

    /**
     *
     * @param jobId
     */
    async getMediaJob (jobId) {
        if (!jobId) {
            throw new Error(ERROR_MESSAGES.VALIDATION_ERROR);
        }
        return this._makeRequest(`${API_ENDPOINTS.MEDIA_JOBS}/${jobId}`, 'GET');
    }

    /**
     *
     * @param ownerType
     * @param ownerId
     * @param role
     */
    async getOwnerMedia (ownerType, ownerId, role) {
        if (!ownerType || !ownerId) {
            throw new Error(ERROR_MESSAGES.VALIDATION_ERROR);
        }
        const query = role ? `?role=${encodeURIComponent(role)}` : '';
        return this._makeRequest(`${API_ENDPOINTS.OWNER_MEDIA(ownerType, ownerId)}${query}`, 'GET');
    }

    /**
     *
     * @param scriptId
     * @param sceneData
     */
    async createScene (scriptId, sceneData) {
        this._requireScriptId(scriptId);
        return this._makeRequest(this._scriptItemPath(scriptId, 'scenes'), 'POST', sceneData);
    }

    /**
     *
     * @param scriptId
     * @param sceneId
     * @param sceneData
     */
    async updateScene (scriptId, sceneId, sceneData) {
        this._requireScriptAndItemId(scriptId, sceneId, 'scene');
        return this._makeRequest(this._scriptItemPath(scriptId, 'scenes', sceneId), 'PUT', sceneData);
    }

    /**
     *
     * @param scriptId
     * @param sceneId
     */
    async deleteScene (scriptId, sceneId) {
        this._requireScriptAndItemId(scriptId, sceneId, 'scene');
        return this._makeRequest(this._scriptItemPath(scriptId, 'scenes', sceneId), 'DELETE');
    }

    /**
     *
     * @param scriptId
     * @param sceneId
     * @param payload
     */
    async generateSceneIdea (scriptId, sceneId, payload = {}) {
        this._requireScriptAndItemId(scriptId, sceneId, 'scene');
        return this._makeRequest(
            `${this._scriptItemPath(scriptId, 'scenes', sceneId)}/ai/scene-idea`,
            'POST',
            payload
        );
    }

    /**
     *
     * @param scriptId
     * @param payload
     */
    async generateSceneIdeaDraft (scriptId, payload = {}) {
        this._requireScriptId(scriptId);
        return this._makeRequest(
            `${this._scriptItemPath(scriptId, 'scenes')}/ai/scene-idea`,
            'POST',
            payload
        );
    }

    /**
     *
     * @param scriptId
     * @param order
     */
    async reorderScenes (scriptId, order) {
        this._requireScriptId(scriptId);
        return this._makeRequest(`${this._scriptItemPath(scriptId, 'scenes')}/reorder`, 'PUT', { order });
    }

    /**
     *
     * @param scriptId
     * @param characterData
     */
    async createCharacter (scriptId, characterData) {
        this._requireScriptId(scriptId);
        return this._makeRequest(this._scriptItemPath(scriptId, 'characters'), 'POST', characterData);
    }

    /**
     *
     * @param scriptId
     * @param characterId
     * @param characterData
     */
    async updateCharacter (scriptId, characterId, characterData) {
        this._requireScriptAndItemId(scriptId, characterId, 'character');
        return this._makeRequest(this._scriptItemPath(scriptId, 'characters', characterId), 'PUT', characterData);
    }

    /**
     *
     * @param scriptId
     * @param characterId
     */
    async deleteCharacter (scriptId, characterId) {
        this._requireScriptAndItemId(scriptId, characterId, 'character');
        return this._makeRequest(this._scriptItemPath(scriptId, 'characters', characterId), 'DELETE');
    }

    /**
     *
     * @param scriptId
     * @param order
     */
    async reorderCharacters (scriptId, order) {
        this._requireScriptId(scriptId);
        return this._makeRequest(`${this._scriptItemPath(scriptId, 'characters')}/reorder`, 'PUT', { order });
    }

    /**
     *
     * @param scriptId
     * @param characterId
     * @param payload
     */
    async generateCharacterIdea (scriptId, characterId, payload = {}) {
        this._requireScriptAndItemId(scriptId, characterId, 'character');
        return this._makeRequest(
            `${this._scriptItemPath(scriptId, 'characters', characterId)}/ai/character-idea`,
            'POST',
            payload
        );
    }

    /**
     *
     * @param scriptId
     * @param payload
     */
    async generateCharacterIdeaDraft (scriptId, payload = {}) {
        this._requireScriptId(scriptId);
        return this._makeRequest(
            `${this._scriptItemPath(scriptId, 'characters')}/ai/character-idea`,
            'POST',
            payload
        );
    }

    /**
     *
     * @param scriptId
     * @param locationData
     */
    async createLocation (scriptId, locationData) {
        this._requireScriptId(scriptId);
        return this._makeRequest(this._scriptItemPath(scriptId, 'locations'), 'POST', locationData);
    }

    /**
     *
     * @param scriptId
     * @param locationId
     * @param locationData
     */
    async updateLocation (scriptId, locationId, locationData) {
        this._requireScriptAndItemId(scriptId, locationId, 'location');
        return this._makeRequest(this._scriptItemPath(scriptId, 'locations', locationId), 'PUT', locationData);
    }

    /**
     *
     * @param scriptId
     * @param locationId
     */
    async deleteLocation (scriptId, locationId) {
        this._requireScriptAndItemId(scriptId, locationId, 'location');
        return this._makeRequest(this._scriptItemPath(scriptId, 'locations', locationId), 'DELETE');
    }

    /**
     *
     * @param scriptId
     * @param order
     */
    async reorderLocations (scriptId, order) {
        this._requireScriptId(scriptId);
        return this._makeRequest(`${this._scriptItemPath(scriptId, 'locations')}/reorder`, 'PUT', { order });
    }

    /**
     *
     * @param scriptId
     * @param locationId
     * @param payload
     */
    async generateLocationIdea (scriptId, locationId, payload = {}) {
        this._requireScriptAndItemId(scriptId, locationId, 'location');
        return this._makeRequest(
            `${this._scriptItemPath(scriptId, 'locations', locationId)}/ai/location-idea`,
            'POST',
            payload
        );
    }

    /**
     *
     * @param scriptId
     * @param payload
     */
    async generateLocationIdeaDraft (scriptId, payload = {}) {
        this._requireScriptId(scriptId);
        return this._makeRequest(
            `${this._scriptItemPath(scriptId, 'locations')}/ai/location-idea`,
            'POST',
            payload
        );
    }

    /**
     *
     * @param scriptId
     * @param themeData
     */
    async createTheme (scriptId, themeData) {
        this._requireScriptId(scriptId);
        return this._makeRequest(this._scriptItemPath(scriptId, 'themes'), 'POST', themeData);
    }

    /**
     *
     * @param scriptId
     * @param themeId
     * @param themeData
     */
    async updateTheme (scriptId, themeId, themeData) {
        this._requireScriptAndItemId(scriptId, themeId, 'theme');
        return this._makeRequest(this._scriptItemPath(scriptId, 'themes', themeId), 'PUT', themeData);
    }

    /**
     *
     * @param scriptId
     * @param themeId
     */
    async deleteTheme (scriptId, themeId) {
        this._requireScriptAndItemId(scriptId, themeId, 'theme');
        return this._makeRequest(this._scriptItemPath(scriptId, 'themes', themeId), 'DELETE');
    }

    /**
     *
     * @param scriptId
     * @param order
     */
    async reorderThemes (scriptId, order) {
        this._requireScriptId(scriptId);
        return this._makeRequest(`${this._scriptItemPath(scriptId, 'themes')}/reorder`, 'PUT', { order });
    }

    /**
     *
     * @param scriptId
     * @param themeId
     * @param payload
     */
    async generateThemeIdea (scriptId, themeId, payload = {}) {
        this._requireScriptAndItemId(scriptId, themeId, 'theme');
        return this._makeRequest(
            `${this._scriptItemPath(scriptId, 'themes', themeId)}/ai/theme-idea`,
            'POST',
            payload
        );
    }

    /**
     *
     * @param scriptId
     * @param payload
     */
    async generateThemeIdeaDraft (scriptId, payload = {}) {
        this._requireScriptId(scriptId);
        return this._makeRequest(
            `${this._scriptItemPath(scriptId, 'themes')}/ai/theme-idea`,
            'POST',
            payload
        );
    }

    /**
     *
     * @param userId
     */
    async getAllScriptsByUser (userId) {
        return this._makeRequest(`${API_ENDPOINTS.SCRIPT}?userId=${userId}`, 'GET');
    }

    /**
     *
     * @param options
     */
    async getPublicScripts (options = {}) {
        const params = new URLSearchParams();
        if (options.page) params.set('page', options.page);
        if (options.pageSize) params.set('pageSize', options.pageSize);
        if (options.sortBy) params.set('sortBy', options.sortBy);
        if (options.order) params.set('order', options.order);

        const query = params.toString();
        const endpoint = query
            ? `${API_ENDPOINTS.PUBLIC_SCRIPTS}?${query}`
            : API_ENDPOINTS.PUBLIC_SCRIPTS;

        return this._makeRequest(endpoint, 'GET');
    }

    /**
     *
     * @param id
     */
    async getPublicScript (id) {
        if (!id) {
            throw new Error('Public script ID is required');
        }
        return this._makeRequest(`${API_ENDPOINTS.PUBLIC_SCRIPTS}/${id}`, 'GET');
    }

    /**
     *
     * @param scriptId
     * @param root0
     * @param root0.page
     * @param root0.pageSize
     */
    async getPublicScriptComments (scriptId, { page = 1, pageSize = 20 } = {}) {
        if (!scriptId) {
            throw new Error('Public script ID is required');
        }

        const params = new URLSearchParams();
        params.set('page', page);
        params.set('pageSize', pageSize);

        const endpoint = `${API_ENDPOINTS.PUBLIC_SCRIPT_COMMENTS(scriptId)}?${params.toString()}`;
        return this._makeRequest(endpoint, 'GET');
    }

    /**
     *
     * @param scriptId
     * @param content
     */
    async addPublicScriptComment (scriptId, content) {
        if (!scriptId) {
            throw new Error('Public script ID is required');
        }
        if (!content || !content.trim()) {
            throw new Error('Comment content is required');
        }

        return this._makeRequest(API_ENDPOINTS.PUBLIC_SCRIPT_COMMENTS(scriptId), 'POST', { content: content.trim() });
    }

    /**
     *
     * @param slug
     */
    async getPublicScriptBySlug (slug) {
        if (!slug) {
            throw new Error('Public script slug is required');
        }
        return this._makeRequest(`${API_ENDPOINTS.PUBLIC_SCRIPTS_SLUG}/${encodeURIComponent(slug)}`, 'GET');
    }

    /**
     *
     * @param slug
     */
    async getScriptBySlug (slug) {
        if (!slug) {
            throw new Error('Script slug is required');
        }
        return this._makeRequest(`${API_ENDPOINTS.SCRIPT_SLUG}/${encodeURIComponent(slug)}`, 'GET');
    }

    /**
     *
     * @param slug
     */
    async getPublicScriptBySlug (slug) {
        if (!slug) {
            throw new Error('Public script slug is required');
        }
        return this._makeRequest(`${API_ENDPOINTS.PUBLIC_SCRIPTS_SLUG}/${encodeURIComponent(slug)}`, 'GET');
    }

    /**
     *
     * @param slug
     */
    async getScriptBySlug (slug) {
        if (!slug) {
            throw new Error('Script slug is required');
        }
        return this._makeRequest(`${API_ENDPOINTS.SCRIPT_SLUG}/${encodeURIComponent(slug)}`, 'GET');
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
