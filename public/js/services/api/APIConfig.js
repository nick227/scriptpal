/**
 * API Configuration constants
 * Centralizes magic numbers and configuration values
 */

/** Retry configuration for failed requests */
export const RETRY_CONFIG = {
    /** Maximum number of retry attempts */
    MAX_RETRIES: 3,
    /** Base delay between retries in milliseconds */
    BASE_DELAY_MS: 1000,
    /** Multiplier for exponential backoff */
    BACKOFF_MULTIPLIER: 2
};

/** Timeout configuration for different request types */
export const TIMEOUT_CONFIG = {
    /** Default timeout for standard requests (90 seconds) */
    DEFAULT_MS: 90000,
    /** Timeout for upload operations (60 seconds) */
    UPLOAD_MS: 60000,
    /** Timeout for download operations (45 seconds) */
    DOWNLOAD_MS: 45000
};

/** HTTP methods considered safe for retry on failure */
export const IDEMPOTENT_METHODS = Object.freeze(['GET', 'HEAD', 'PUT', 'DELETE']);

/** HTTP status codes that indicate a retryable error */
export const RETRYABLE_STATUS_CODES = Object.freeze([500, 502, 503, 504]);

/**
 * Check if a request should be retried based on status and method
 * @param {number} status - HTTP status code
 * @param {string} method - HTTP method
 * @returns {boolean} Whether the request should be retried
 */
export function shouldRetry(status, method) {
    if (!IDEMPOTENT_METHODS.includes(method)) {
        return false;
    }
    return status >= 500 || status === 0;
}

/**
 * Calculate delay for retry attempt with exponential backoff
 * @param {number} attempt - Current attempt number (0-indexed)
 * @returns {number} Delay in milliseconds
 */
export function calculateRetryDelay(attempt) {
    return RETRY_CONFIG.BASE_DELAY_MS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt);
}

/**
 * Determine timeout based on request type
 * @param {string} method - HTTP method
 * @param {string} endpoint - Request endpoint
 * @returns {number} Timeout in milliseconds
 */
export function getTimeoutForRequest(method, endpoint) {
    // Upload endpoints or POST to /script need longer timeout
    if (endpoint.includes('/upload') || (method === 'POST' && endpoint.includes('/script'))) {
        return TIMEOUT_CONFIG.UPLOAD_MS;
    }
    // Download endpoints
    if (method === 'GET' && endpoint.includes('/download')) {
        return TIMEOUT_CONFIG.DOWNLOAD_MS;
    }
    return TIMEOUT_CONFIG.DEFAULT_MS;
}

/**
 * Generate a unique correlation ID for request tracking
 * @returns {string} Unique correlation ID
 */
export function generateCorrelationId() {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
