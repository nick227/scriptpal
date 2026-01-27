import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { z } from 'zod';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Security middleware configuration
 */
export class SecurityMiddleware {
  constructor() {
    this.securityConfig = config.getSecurityConfig();
    this.corsConfig = config.getCorsConfig();
  }

  _getSessionToken(req) {
    const cookieToken = req.cookies && req.cookies.sessionToken;
    if (cookieToken) {
      return cookieToken;
    }
    const cookieHeader = req.headers && req.headers.cookie;
    if (!cookieHeader) {
      return null;
    }
    const match = cookieHeader.match(/(?:^|;\s*)sessionToken=([^;]+)/);
    if (!match) {
      return null;
    }
    return decodeURIComponent(match[1]);
  }

  _getRateLimitKey(req) {
    if (req.userId) {
      return `user:${req.userId}`;
    }
    const token = this._getSessionToken(req);
    if (token) {
      return `session:${token}`;
    }
    return req.ip;
  }

  _getRateLimitMax(req) {
    if (req.userId || this._getSessionToken(req)) {
      return this.securityConfig.rateLimitMaxAuth;
    }
    return this.securityConfig.rateLimitMaxAnon;
  }

  /**
     * Get helmet configuration
     * @returns {Object} - Helmet configuration
     */
  getHelmetConfig() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ['\'self\''],
          styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https://cdnjs.cloudflare.com'],
          scriptSrc: [
            '\'self\'',
            'https://cdnjs.cloudflare.com',
            '\'sha256-YX4iJw93x5SU0ple+RI+95HNdNBZSA60gR8a5v7HfOA=\'',
            '\'unsafe-eval\''
          ],
          imgSrc: ['\'self\'', 'data:', 'https:'],
          connectSrc: ['\'self\''],
          fontSrc: ['\'self\'', 'https://cdnjs.cloudflare.com'],
          objectSrc: ['\'none\''],
          mediaSrc: ['\'self\''],
          frameSrc: ['\'none\'']
        }
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    });
  }

  /**
     * Get rate limiting configuration
     * @returns {Object} - Rate limit configuration
     */
  getRateLimitConfig() {
    return rateLimit({
      windowMs: this.securityConfig.rateLimitWindow,
      max: (req) => this._getRateLimitMax(req),
      skip: (req) => !req.path.startsWith('/api'),
      keyGenerator: (req) => this._getRateLimitKey(req),
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(this.securityConfig.rateLimitWindow / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn('Rate limit exceeded', {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          path: req.path,
          method: req.method
        });

        res.status(429).json({
          error: 'Too many requests from this IP, please try again later.',
          retryAfter: Math.ceil(this.securityConfig.rateLimitWindow / 1000)
        });
      }
    });
  }

  /**
     * Get slow down configuration
     * @returns {Object} - Slow down configuration
     */
  getSlowDownConfig() {
    return slowDown({
      windowMs: 15 * 60 * 1000, // 15 minutes
      delayAfter: 50, // Allow 50 requests per 15 minutes, then...
      delayMs: () => 500, // Add 500ms delay per request above 50
      maxDelayMs: 20000, // Maximum delay of 20 seconds
      skipSuccessfulRequests: true,
      skipFailedRequests: false
    });
  }

  /**
     * Input validation middleware
     * @param {Object} schema - Zod schema for validation
     * @param {string} source - Source of data to validate (body, query, params)
     * @returns {Function} - Express middleware
     */
  createValidationMiddleware(schema, source = 'body') {
    return (req, res, next) => {
      try {
        const data = req[source];
        const validatedData = schema.parse(data);
        req[`validated${source.charAt(0).toUpperCase() + source.slice(1)}`] = validatedData;
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          const validationErrors = error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }));

          logger.warn('Input validation failed', {
            source,
            errors: validationErrors,
            path: req.path,
            method: req.method,
            correlationId: req.correlationId
          });

          return res.status(422).json({
            error: 'Validation failed',
            details: validationErrors,
            correlationId: req.correlationId
          });
        }

        logger.error('Validation middleware error', {
          error: error.message,
          source,
          path: req.path,
          method: req.method,
          correlationId: req.correlationId
        });

        return res.status(500).json({
          error: 'Internal server error',
          correlationId: req.correlationId
        });
      }
    };
  }

  /**
     * Sanitize input data
     * @param {Object} data - Data to sanitize
     * @returns {Object} - Sanitized data
     */
  sanitizeInput(data) {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        // Remove potentially dangerous characters
        sanitized[key] = value
          .replace(/<script[^>]*>.*?<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim();
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeInput(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
     * Sanitization middleware
     * @returns {Function} - Express middleware
     */
  sanitizationMiddleware() {
    return (req, res, next) => {
      if (req.body) {
        req.body = this.sanitizeInput(req.body);
      }
      if (req.query) {
        req.query = this.sanitizeInput(req.query);
      }
      if (req.params) {
        req.params = this.sanitizeInput(req.params);
      }
      next();
    };
  }

  /**
     * CORS configuration
     * @returns {Function} - Express middleware
     */
  corsMiddleware() {
    return (req, res, next) => {
      const origin = req.headers.origin;
      console.log(`[CORS] Request from origin: ${origin}`);
      console.log(`[CORS] Config CORS_ORIGINS: ${JSON.stringify(this.corsConfig.origin)}`);
      
      const allowedOrigins = this.corsConfig.origin;
      console.log(`[CORS] Allowed origins: ${JSON.stringify(allowedOrigins)}`);

      // Check if origin is allowed
      if (allowedOrigins === '*' || (Array.isArray(allowedOrigins) && allowedOrigins.includes(origin))) {
        console.log(`[CORS] Origin allowed, setting header to: ${origin || '*'}`);
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
      } else {
        console.log(`[CORS] Origin not allowed: ${origin}`);
        return res.status(403).json({
          error: 'Origin not allowed by CORS policy'
        });
      }

      res.setHeader('Access-Control-Allow-Credentials', this.corsConfig.credentials.toString());
      res.setHeader('Access-Control-Allow-Methods', this.corsConfig.methods.join(', '));
      res.setHeader('Access-Control-Allow-Headers', this.corsConfig.allowedHeaders.join(', '));
      res.setHeader('Access-Control-Expose-Headers', this.corsConfig.exposedHeaders.join(', '));

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }

      next();
    };
  }

  /**
     * Security headers middleware
     * @returns {Function} - Express middleware
     */
  securityHeadersMiddleware() {
    return (req, res, next) => {
      // Remove X-Powered-By header
      res.removeHeader('X-Powered-By');

      // Add security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

      next();
    };
  }

  /**
     * Request size limiting middleware
     * @param {number} limit - Size limit in bytes
     * @returns {Function} - Express middleware
     */
  requestSizeLimitMiddleware(limit = 1024 * 1024) { // 1MB default
    return (req, res, next) => {
      const contentLength = parseInt(req.headers['content-length'] || '0');

      if (contentLength > limit) {
        logger.warn('Request size limit exceeded', {
          contentLength,
          limit,
          path: req.path,
          method: req.method,
          correlationId: req.correlationId
        });

        return res.status(413).json({
          error: 'Request entity too large',
          correlationId: req.correlationId
        });
      }

      next();
    };
  }

  /**
     * IP whitelist middleware
     * @param {Array} allowedIPs - Array of allowed IP addresses
     * @returns {Function} - Express middleware
     */
  ipWhitelistMiddleware(allowedIPs = []) {
    return (req, res, next) => {
      if (allowedIPs.length === 0) {
        return next();
      }

      const clientIP = req.ip || req.connection.remoteAddress;

      if (!allowedIPs.includes(clientIP)) {
        logger.warn('IP not in whitelist', {
          ip: clientIP,
          path: req.path,
          method: req.method,
          correlationId: req.correlationId
        });

        return res.status(403).json({
          error: 'Access denied',
          correlationId: req.correlationId
        });
      }

      next();
    };
  }

  /**
     * Get all security middleware
     * @returns {Array} - Array of security middleware functions
     */
  getAllSecurityMiddleware() {
    return [
      this.getHelmetConfig(),
      // CORS is handled directly in server.js using the cors package
      this.securityHeadersMiddleware(),
      this.sanitizationMiddleware(),
      this.getRateLimitConfig(),
      this.getSlowDownConfig(),
      this.requestSizeLimitMiddleware()
    ];
  }
}

/**
 * Common validation schemas
 */
export const ValidationSchemas = {
  // User validation
  user: {
    create: z.object({
      email: z.string().email().max(254),
      name: z.string().min(1).max(100).optional()
    }),
    update: z.object({
      name: z.string().min(1).max(100).optional(),
      email: z.string().email().max(254).optional()
    })
  },

  // Script validation
  script: {
    create: z.object({
      title: z.string().min(1).max(200),
      content: z.string().max(100000),
      description: z.string().max(1000).optional()
    }),
    update: z.object({
      title: z.string().min(1).max(200).optional(),
      content: z.string().max(100000).optional(),
      description: z.string().max(1000).optional()
    })
  },

  // Chat validation
  chat: {
    message: z.object({
      prompt: z.string().min(1).max(5000),
      scriptId: z.number().int().positive().optional(),
      context: z.object({
        includeScript: z.boolean().optional(),
        includeHistory: z.boolean().optional()
      }).optional()
    })
  },

  // ID validation
  id: z.object({
    id: z.string().regex(/^\d+$/).transform(Number)
  }),

  // Pagination validation
  pagination: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1)).default(1),
    limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(100)).default(20)
  })
};

/**
 * Security middleware factory
 */
export class SecurityMiddlewareFactory {
  /**
     * Create security middleware instance
     * @returns {SecurityMiddleware} - Security middleware instance
     */
  static create() {
    return new SecurityMiddleware();
  }
}

export default SecurityMiddleware;
