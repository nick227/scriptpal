import { getApiBaseUrl } from '../../config.js';
import { API_HEADERS } from '../../constants.js';
import { debugLog } from '../../core/logger.js';
import {
    APIError,
    NetworkError,
    TimeoutError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError
} from './APIError.js';
import {
    RETRY_CONFIG,
    shouldRetry,
    calculateRetryDelay,
    getTimeoutForRequest,
    generateCorrelationId
} from './APIConfig.js';

/**
 * Base HTTP client with retry logic, timeout handling, and request cancellation
 */
export class HttpClient {
    constructor() {
        this.baseUrl = getApiBaseUrl();
        this.abortControllers = new Map();
    }

    /**
     * Sleep utility for retry delays
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Create an appropriate error based on status code
     * @param {number} status - HTTP status code
     * @param {string} message - Error message
     * @param {string} correlationId - Request correlation ID
     * @param {object} data - Error data
     * @returns {APIError}
     */
    _createError(status, message, correlationId, data = null) {
        switch (status) {
            case 401:
                return new AuthenticationError(message, correlationId);
            case 403:
                return new AuthorizationError(message, correlationId);
            case 404:
                return new NotFoundError('Resource', correlationId);
            default:
                return new APIError(message, status, correlationId, data);
        }
    }

    /**
     * Make an HTTP request with retry logic and timeout
     * @param {string} endpoint - API endpoint
     * @param {object} options - Request options
     * @param {string} options.method - HTTP method
     * @param {object} options.data - Request body data
     * @param {number} options.timeout - Request timeout in ms
     * @param {number} options.maxRetries - Maximum retry attempts
     * @param {boolean} options.silent401 - Return null instead of throwing on 401
     * @returns {Promise<any>} Response data
     */
    async request(endpoint, options = {}) {
        const {
            method = 'GET',
            data = null,
            timeout = getTimeoutForRequest(method, endpoint),
            maxRetries = RETRY_CONFIG.MAX_RETRIES,
            silent401 = false
        } = options;

        const correlationId = generateCorrelationId();
        const abortController = new AbortController();
        this.abortControllers.set(correlationId, abortController);

        const timeoutId = setTimeout(() => abortController.abort(), timeout);
        let lastError = null;

        try {
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    const result = await this._executeRequest(
                        endpoint,
                        method,
                        data,
                        correlationId,
                        abortController.signal,
                        timeout,
                        silent401,
                        attempt
                    );
                    return result;
                } catch (error) {
                    lastError = error;

                    // Don't retry on abort/timeout
                    if (error.name === 'AbortError' || error instanceof TimeoutError) {
                        throw error;
                    }

                    // Check if we should retry
                    const status = error.status || 0;
                    if (shouldRetry(status, method) && attempt < maxRetries) {
                        const delay = calculateRetryDelay(attempt);
                        console.warn(`[API] Request ${correlationId} failed (${status}), retrying in ${delay}ms...`);
                        await this._sleep(delay);
                        continue;
                    }

                    throw error;
                }
            }
            throw lastError;
        } finally {
            clearTimeout(timeoutId);
            this.abortControllers.delete(correlationId);
        }
    }

    /**
     * Execute a single HTTP request
     * @private
     */
    async _executeRequest(endpoint, method, data, correlationId, signal, timeout, silent401, attempt) {
        debugLog(`[API] Request ${correlationId} (attempt ${attempt + 1}):`, {
            endpoint,
            method,
            hasData: !!data,
            timeout
        });

        const requestOptions = {
            method,
            headers: {
                ...API_HEADERS,
                'X-Correlation-ID': correlationId
            },
            credentials: 'include',
            signal,
            ...(data && { body: JSON.stringify(data) })
        };

        let response;
        try {
            response = await fetch(this.baseUrl + endpoint, requestOptions);
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new TimeoutError(timeout, correlationId);
            }
            throw new NetworkError(error.message, correlationId);
        }

        // Handle 401 silently if requested
        if (response.status === 401 && silent401) {
            debugLog(`[API] No active session for ${correlationId}`);
            return null;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                error: response.statusText || 'Unknown error'
            }));
            const message = errorData.error || errorData.message || 'Request failed';
            throw this._createError(response.status, message, correlationId, errorData);
        }

        if (response.status === 204) {
            return null;
        }

        return response.json();
    }

    /**
     * Make a form data request (for file uploads)
     * @param {string} endpoint - API endpoint
     * @param {FormData} formData - Form data to send
     * @param {object} options - Request options
     * @returns {Promise<any>} Response data
     */
    async formRequest(endpoint, formData, options = {}) {
        const {
            method = 'POST',
            timeout = getTimeoutForRequest(method, endpoint),
            maxRetries = RETRY_CONFIG.MAX_RETRIES
        } = options;

        const correlationId = generateCorrelationId();
        const abortController = new AbortController();
        this.abortControllers.set(correlationId, abortController);

        const timeoutId = setTimeout(() => abortController.abort(), timeout);
        let lastError = null;

        try {
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    const requestOptions = {
                        method,
                        headers: { 'X-Correlation-ID': correlationId },
                        credentials: 'include',
                        signal: abortController.signal,
                        body: formData
                    };

                    const response = await fetch(this.baseUrl + endpoint, requestOptions);

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({
                            error: response.statusText || 'Unknown error'
                        }));
                        const message = errorData.error || errorData.message || 'Request failed';
                        throw this._createError(response.status, message, correlationId, errorData);
                    }

                    if (response.status === 204) {
                        return null;
                    }

                    return response.json();
                } catch (error) {
                    lastError = error;

                    if (error.name === 'AbortError') {
                        throw new TimeoutError(timeout, correlationId);
                    }

                    const status = error.status || 0;
                    if (shouldRetry(status, method) && attempt < maxRetries) {
                        const delay = calculateRetryDelay(attempt);
                        await this._sleep(delay);
                        continue;
                    }

                    throw error;
                }
            }
            throw lastError || new NetworkError('Request failed', correlationId);
        } finally {
            clearTimeout(timeoutId);
            this.abortControllers.delete(correlationId);
        }
    }

    /**
     * Cancel a specific request by correlation ID
     * @param {string} correlationId - Correlation ID of request to cancel
     */
    cancelRequest(correlationId) {
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
    cancelAllRequests() {
        for (const [correlationId, controller] of this.abortControllers) {
            controller.abort();
            debugLog(`[API] Cancelled request ${correlationId}`);
        }
        this.abortControllers.clear();
    }

    /**
     * Get count of pending requests
     * @returns {number} Number of pending requests
     */
    getPendingCount() {
        return this.abortControllers.size;
    }
}
