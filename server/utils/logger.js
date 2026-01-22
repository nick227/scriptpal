import pino from 'pino';
import config from '../config/index.js';

/**
 * Generate correlation ID for request tracking
 * @returns {string} - Correlation ID
 */
function generateCorrelationId() {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Logger configuration
 */
const loggerConfig = {
  level: config.get('LOG_LEVEL'),
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
        'x-correlation-id': req.headers['x-correlation-id']
      },
      remoteAddress: req.remoteAddress,
      remotePort: req.remotePort
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      headers: res.headers
    }),
    err: pino.stdSerializers.err
  }
};

// Add file transport if configured
if (config.get('LOG_FILE')) {
  loggerConfig.transport = {
    target: 'pino/file',
    options: {
      destination: config.get('LOG_FILE')
    }
  };
}

// Create base logger
const baseLogger = pino(loggerConfig);

/**
 * Enhanced Logger class with correlation ID support
 */
export class Logger {
  constructor(context = 'App', correlationId = null) {
    this.context = context;
    this.correlationId = correlationId || generateCorrelationId();
    this.logger = baseLogger.child({
      context,
      correlationId: this.correlationId
    });
  }

  /**
     * Create child logger with additional context
     * @param {Object} context - Additional context
     * @returns {Logger} - Child logger
     */
  child(context) {
    const childLogger = new Logger(this.context, this.correlationId);
    childLogger.logger = this.logger.child(context);
    return childLogger;
  }

  /**
     * Log fatal error
     * @param {string|Object} message - Log message or object
     * @param {Object} context - Additional context
     */
  fatal(message, context = {}) {
    this.logger.fatal(context, message);
  }

  /**
     * Log error
     * @param {string|Object} message - Log message or object
     * @param {Object} context - Additional context
     */
  error(message, context = {}) {
    this.logger.error(context, message);
  }

  /**
     * Log warning
     * @param {string|Object} message - Log message or object
     * @param {Object} context - Additional context
     */
  warn(message, context = {}) {
    this.logger.warn(context, message);
  }

  /**
     * Log info
     * @param {string|Object} message - Log message or object
     * @param {Object} context - Additional context
     */
  info(message, context = {}) {
    this.logger.info(context, message);
  }

  /**
     * Log debug
     * @param {string|Object} message - Log message or object
     * @param {Object} context - Additional context
     */
  debug(message, context = {}) {
    this.logger.debug(context, message);
  }

  /**
     * Log trace
     * @param {string|Object} message - Log message or object
     * @param {Object} context - Additional context
     */
  trace(message, context = {}) {
    this.logger.trace(context, message);
  }

  /**
     * Log HTTP request
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {number} responseTime - Response time in ms
     */
  logRequest(req, res, responseTime) {
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      userId: req.userId || null,
      scriptId: req.params?.scriptId || null
    };

    if (res.statusCode >= 400) {
      this.error('HTTP Request', logData);
    } else {
      this.info('HTTP Request', logData);
    }
  }

  /**
     * Log database query
     * @param {string} query - SQL query
     * @param {Array} params - Query parameters
     * @param {number} executionTime - Query execution time in ms
     * @param {Error} error - Query error (if any)
     */
  logQuery(query, params, executionTime, error = null) {
    const logData = {
      query: query.substring(0, 200), // Truncate long queries
      paramCount: params.length,
      executionTime,
      error: error ? error.message : null
    };

    if (error) {
      this.error('Database Query Failed', logData);
    } else {
      this.debug('Database Query', logData);
    }
  }

  /**
     * Log AI/LLM request
     * @param {string} model - AI model used
     * @param {number} tokens - Token count
     * @param {number} cost - Cost in USD
     * @param {number} responseTime - Response time in ms
     * @param {Error} error - Request error (if any)
     */
  logAIRequest(model, tokens, cost, responseTime, error = null) {
    const logData = {
      model,
      tokens,
      cost,
      responseTime,
      error: error ? error.message : null
    };

    if (error) {
      this.error('AI Request Failed', logData);
    } else {
      this.info('AI Request', logData);
    }
  }

  /**
     * Log authentication event
     * @param {string} event - Event type (login, logout, session_expired)
     * @param {string} userId - User ID
     * @param {string} email - User email
     * @param {Object} context - Additional context
     */
  logAuth(event, userId, email, context = {}) {
    const logData = {
      event,
      userId,
      email,
      ...context
    };

    this.info('Authentication Event', logData);
  }

  /**
     * Log business event
     * @param {string} event - Event type
     * @param {Object} data - Event data
     */
  logBusinessEvent(event, data = {}) {
    const logData = {
      event,
      ...data
    };

    this.info('Business Event', logData);
  }

  /**
     * Log performance metric
     * @param {string} metric - Metric name
     * @param {number} value - Metric value
     * @param {Object} context - Additional context
     */
  logMetric(metric, value, context = {}) {
    const logData = {
      metric,
      value,
      ...context
    };

    this.info('Performance Metric', logData);
  }

  /**
     * Get correlation ID
     * @returns {string} - Correlation ID
     */
  getCorrelationId() {
    return this.correlationId;
  }

  /**
     * Set correlation ID
     * @param {string} correlationId - New correlation ID
     */
  setCorrelationId(correlationId) {
    this.correlationId = correlationId;
    this.logger = baseLogger.child({
      context: this.context,
      correlationId: this.correlationId
    });
  }
}

/**
 * Logger Factory
 */
export class LoggerFactory {
  /**
     * Create logger instance
     * @param {string} context - Logger context
     * @param {string} correlationId - Correlation ID
     * @returns {Logger} - Logger instance
     */
  static create(context = 'App', correlationId = null) {
    return new Logger(context, correlationId);
  }

  /**
     * Create request logger
     * @param {Object} req - Express request object
     * @returns {Logger} - Request logger
     */
  static createRequestLogger(req) {
    const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
    return new Logger('Request', correlationId);
  }

  /**
     * Create database logger
     * @param {string} operation - Database operation
     * @returns {Logger} - Database logger
     */
  static createDatabaseLogger(operation = 'Database') {
    return new Logger(operation);
  }

  /**
     * Create AI logger
     * @param {string} model - AI model
     * @returns {Logger} - AI logger
     */
  static createAILogger(model = 'AI') {
    return new Logger(model);
  }
}

/**
 * Express middleware for request logging
 * @param {Logger} logger - Logger instance
 * @returns {Function} - Express middleware
 */
export function requestLoggingMiddleware(_logger) {
  return (req, res, next) => {
    const startTime = Date.now();
    const requestLogger = LoggerFactory.createRequestLogger(req);

    // Add logger to request object
    req.logger = requestLogger;
    req.correlationId = requestLogger.getCorrelationId();

    // Add correlation ID to response headers
    res.setHeader('X-Correlation-ID', req.correlationId);

    // Log request start
    requestLogger.info('Request started', {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const responseTime = Date.now() - startTime;
      requestLogger.logRequest(req, res, responseTime);
      originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}

// Export default logger instance
export const logger = new Logger('App');

export default logger;
