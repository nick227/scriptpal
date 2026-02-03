/**
 * Structured error types for API operations
 */

/**
 * Base API error with correlation tracking
 */
export class APIError extends Error {
    /**
     * @param {string} message - Error message
     * @param {number} status - HTTP status code
     * @param {string} correlationId - Request correlation ID
     * @param {object} data - Additional error data
     */
    constructor(message, status = 500, correlationId = null, data = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.correlationId = correlationId;
        this.data = data;
        this.timestamp = new Date().toISOString();
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            status: this.status,
            correlationId: this.correlationId,
            data: this.data,
            timestamp: this.timestamp
        };
    }
}

/**
 * Validation error for invalid input
 */
export class ValidationError extends APIError {
    /**
     * @param {string} code - Error code (e.g., 'SCRIPT_ID_REQUIRED')
     * @param {object} context - Additional context (e.g., { field: 'scriptId' })
     */
    constructor(code, context = {}) {
        const message = ValidationError.MESSAGES[code] || code;
        super(message, 400, null, { code, ...context });
        this.name = 'ValidationError';
        this.code = code;
    }

    static MESSAGES = {
        SCRIPT_ID_REQUIRED: 'Script ID is required',
        ITEM_ID_REQUIRED: 'Item ID is required',
        BOARD_ID_REQUIRED: 'Board ID is required',
        CATEGORY_REQUIRED: 'Category is required',
        SLUG_REQUIRED: 'Slug is required',
        FILE_REQUIRED: 'File is required',
        TYPE_REQUIRED: 'Type is required',
        CONTENT_REQUIRED: 'Content is required',
        PROMPT_TYPE_REQUIRED: 'Prompt type is required',
        INVALID_DATA: 'Invalid data provided'
    };
}

/**
 * Network error for connection failures
 */
export class NetworkError extends APIError {
    constructor(message = 'Network request failed', correlationId = null) {
        super(message, 0, correlationId);
        this.name = 'NetworkError';
    }
}

/**
 * Timeout error for request timeout
 */
export class TimeoutError extends APIError {
    /**
     * @param {number} timeout - Timeout duration in ms
     * @param {string} correlationId - Request correlation ID
     */
    constructor(timeout, correlationId = null) {
        super(`Request timeout after ${timeout}ms`, 408, correlationId);
        this.name = 'TimeoutError';
        this.timeout = timeout;
    }
}

/**
 * Authentication error for 401 responses
 */
export class AuthenticationError extends APIError {
    constructor(message = 'Please log in to continue', correlationId = null) {
        super(message, 401, correlationId);
        this.name = 'AuthenticationError';
    }
}

/**
 * Authorization error for 403 responses
 */
export class AuthorizationError extends APIError {
    constructor(message = 'Not authorized to perform this action', correlationId = null) {
        super(message, 403, correlationId);
        this.name = 'AuthorizationError';
    }
}

/**
 * Not found error for 404 responses
 */
export class NotFoundError extends APIError {
    constructor(resource = 'Resource', correlationId = null) {
        super(`${resource} not found`, 404, correlationId);
        this.name = 'NotFoundError';
        this.resource = resource;
    }
}
