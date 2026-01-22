import { debugLog } from './logger.js';

/**
 * Centralized Error Handler
 * Provides consistent error handling with contextual tags and prevents error loops
 */
export class ErrorHandler {
    /**
     *
     * @param options
     */
    constructor (options = {}) {
        this.context = options.context || 'Unknown';
        this.correlationId = options.correlationId || this._generateCorrelationId();
        this.errorHistory = [];
        this.maxHistorySize = options.maxHistorySize || 50;
        this.isHandlingError = false;
        this.errorCounts = new Map();
        this.throttleConfig = {
            maxErrors: options.maxErrors || 10,
            timeWindow: options.timeWindow || 60000, // 1 minute
            throttleDelay: options.throttleDelay || 5000 // 5 seconds
        };
    }

    /**
     * Generate correlation ID for error tracking
     * @returns {string} - Correlation ID
     */
    _generateCorrelationId () {
        return `err_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * Check if error should be throttled
     * @param {Error} error - Error to check
     * @returns {boolean} - Whether error should be throttled
     */
    _shouldThrottle (error) {
        const errorKey = this._getErrorKey(error);
        const now = Date.now();
        const count = this.errorCounts.get(errorKey) || { count: 0, firstSeen: now };

        // Reset count if time window has passed
        if (now - count.firstSeen > this.throttleConfig.timeWindow) {
            count.count = 0;
            count.firstSeen = now;
        }

        count.count++;
        this.errorCounts.set(errorKey, count);

        return count.count > this.throttleConfig.maxErrors;
    }

    /**
     * Get error key for throttling
     * @param {Error} error - Error to get key for
     * @returns {string} - Error key
     */
    _getErrorKey (error) {
        return `${error.name}:${error.message}`;
    }

    /**
     * Add error to history
     * @param {Error} error - Error to add
     * @param {object} context - Error context
     */
    _addToHistory (error, context) {
        const errorEntry = {
            id: this._generateCorrelationId(),
            timestamp: new Date().toISOString(),
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            context: {
                ...context,
                correlationId: this.correlationId
            }
        };

        this.errorHistory.unshift(errorEntry);

        // Limit history size
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory.pop();
        }
    }

    /**
     * Handle error with context
     * @param {Error} error - Error to handle
     * @param {object} context - Error context
     * @param {object} options - Handling options
     */
    handleError (error, context = {}, options = {}) {
        // Prevent error loops
        if (this.isHandlingError) {
            console.error('Error while handling error:', error);
            return;
        }

        // Check throttling
        if (this._shouldThrottle(error)) {
            console.warn(`[ErrorHandler] Error throttled: ${error.message}`);
            return;
        }

        this.isHandlingError = true;

        try {
            // Add to history
            this._addToHistory(error, context);

            // Create enhanced error object
            const enhancedError = this._enhanceError(error, context, options);

            // Log error
            this._logError(enhancedError, context);

            // Emit error event if event manager available
            if (options.eventManager) {
                options.eventManager.emit('error:handled', enhancedError);
            }

            // Show user notification if requested
            if (options.showNotification !== false) {
                this._showNotification(enhancedError, options);
            }

            // Report to external service if configured
            if (options.reportToService) {
                this._reportToService(enhancedError, options);
            }

        } catch (handlingError) {
            console.error('Error in error handler:', handlingError);
        } finally {
            this.isHandlingError = false;
        }
    }

    /**
     * Enhance error with additional context
     * @param {Error} error - Original error
     * @param {object} context - Error context
     * @param {object} options - Handling options
     * @returns {object} - Enhanced error
     */
    _enhanceError (error, context, options) {
        return {
            ...error,
            correlationId: this.correlationId,
            context: {
                ...context,
                handler: this.context,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            },
            tags: this._generateTags(error, context, options),
            severity: this._determineSeverity(error, context),
            recoverable: this._isRecoverable(error, context)
        };
    }

    /**
     * Generate error tags
     * @param {Error} error - Error object
     * @param {object} context - Error context
     * @param {object} options - Handling options
     * @returns {string[]} - Error tags
     */
    _generateTags (error, context, options) {
        const tags = [];

        // Error type tags
        if (error.name) {
            tags.push(`error:${error.name.toLowerCase()}`);
        }

        // Context tags
        if (context.component) {
            tags.push(`component:${context.component}`);
        }
        if (context.action) {
            tags.push(`action:${context.action}`);
        }
        if (context.operation) {
            tags.push(`operation:${context.operation}`);
        }

        // Severity tags
        const severity = this._determineSeverity(error, context);
        tags.push(`severity:${severity}`);

        // Custom tags
        if (options.tags) {
            tags.push(...options.tags);
        }

        return tags;
    }

    /**
     * Determine error severity
     * @param {Error} error - Error object
     * @param {object} context - Error context
     * @returns {string} - Severity level
     */
    _determineSeverity (error, context) {
        // Critical errors
        if (error.name === 'TypeError' && error.message.includes('Cannot read property')) {
            return 'critical';
        }
        if (error.name === 'ReferenceError') {
            return 'critical';
        }
        if (context.operation === 'save' || context.operation === 'load') {
            return 'high';
        }

        // Network errors
        if (error.message.includes('fetch') || error.message.includes('network')) {
            return 'medium';
        }

        // Default
        return 'low';
    }

    /**
     * Check if error is recoverable
     * @param {Error} error - Error object
     * @param {object} context - Error context
     * @param _context
     * @returns {boolean} - Whether error is recoverable
     */
    _isRecoverable (error, _context) {
        // Network errors are usually recoverable
        if (error.message.includes('fetch') || error.message.includes('network')) {
            return true;
        }

        // Validation errors are recoverable
        if (error.name === 'ValidationError') {
            return true;
        }

        // Critical errors are usually not recoverable
        if (error.name === 'TypeError' || error.name === 'ReferenceError') {
            return false;
        }

        return true;
    }

    /**
     * Log error with appropriate level
     * @param {object} enhancedError - Enhanced error object
     * @param {object} context - Error context
     * @param _context
     */
    _logError (enhancedError, _context) {
        const logData = {
            correlationId: enhancedError.correlationId,
            tags: enhancedError.tags,
            severity: enhancedError.severity,
            context: enhancedError.context,
            stack: enhancedError.stack
        };

        switch (enhancedError.severity) {
            case 'critical':
                console.error(`[${this.context}] CRITICAL ERROR:`, enhancedError.message, logData);
                break;
            case 'high':
                console.error(`[${this.context}] HIGH SEVERITY ERROR:`, enhancedError.message, logData);
                break;
            case 'medium':
                console.warn(`[${this.context}] MEDIUM SEVERITY ERROR:`, enhancedError.message, logData);
                break;
            default:
                debugLog(`[${this.context}] LOW SEVERITY ERROR:`, enhancedError.message, logData);
        }
    }

    /**
     * Show user notification
     * @param {object} enhancedError - Enhanced error object
     * @param {object} options - Handling options
     */
    _showNotification (enhancedError, options) {
        // Only show notifications for high/critical severity
        if (enhancedError.severity === 'low') {
            return;
        }

        const message = this._getUserFriendlyMessage(enhancedError);

        // Emit notification event
        if (options.eventManager) {
            options.eventManager.emit('notification:error', {
                message,
                severity: enhancedError.severity,
                correlationId: enhancedError.correlationId,
                recoverable: enhancedError.recoverable
            });
        }
    }

    /**
     * Get user-friendly error message
     * @param {object} enhancedError - Enhanced error object
     * @returns {string} - User-friendly message
     */
    _getUserFriendlyMessage (enhancedError) {
        const { error, context } = enhancedError;

        // Network errors
        if (error.message.includes('fetch') || error.message.includes('network')) {
            return 'Network connection issue. Please check your internet connection and try again.';
        }

        // Validation errors
        if (error.name === 'ValidationError') {
            return 'Please check your input and try again.';
        }

        // Save/load errors
        if (context.operation === 'save') {
            return 'Failed to save your changes. Please try again.';
        }
        if (context.operation === 'load') {
            return 'Failed to load content. Please refresh the page.';
        }

        // Generic message
        return 'An unexpected error occurred. Please try again.';
    }

    /**
     * Report error to external service
     * @param {object} enhancedError - Enhanced error object
     * @param {object} options - Handling options
     */
    async _reportToService (enhancedError, options) {
        try {
            // This would integrate with external error reporting services
            // like Sentry, LogRocket, etc.
            debugLog('[ErrorHandler] Would report to external service:', enhancedError);
        } catch (error) {
            console.error('[ErrorHandler] Failed to report to external service:', error);
        }
    }

    /**
     * Get error history
     * @returns {Array} - Error history
     */
    getErrorHistory () {
        return [...this.errorHistory];
    }

    /**
     * Get error statistics
     * @returns {object} - Error statistics
     */
    getErrorStats () {
        const stats = {
            totalErrors: this.errorHistory.length,
            errorCounts: {},
            severityCounts: {},
            recentErrors: this.errorHistory.slice(0, 10)
        };

        // Count errors by type
        for (const entry of this.errorHistory) {
            const errorKey = `${entry.error.name}:${entry.error.message}`;
            stats.errorCounts[errorKey] = (stats.errorCounts[errorKey] || 0) + 1;
        }

        return stats;
    }

    /**
     * Clear error history
     */
    clearHistory () {
        this.errorHistory = [];
        this.errorCounts.clear();
    }

    /**
     * Create error handler for specific context
     * @param {string} context - Context name
     * @param {object} options - Handler options
     * @returns {ErrorHandler} - New error handler
     */
    static create (context, options = {}) {
        return new ErrorHandler({ context, ...options });
    }
}
