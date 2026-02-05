
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

// Import config-dependent modules after dotenv has loaded
const configModule = await import('./config/index.js');
const config = configModule.default;

const loggerModule = await import('./utils/logger.js');
const prismaModule = await import('./db/prismaClient.js');
const healthControllerModule = await import('./controllers/common/health.controller.js');
const aiClientModule = await import('./services/AIClient.js');
const routesModule = await import('./routes.js');
const securityMiddlewareModule = await import('./middleware/security.js');
const authModule = await import('./middleware/auth.js');
const scriptRepositoryModule = await import('./repositories/scriptRepository.js');
const scriptSlugRepositoryModule = await import('./repositories/scriptSlugRepository.js');

import helmet from 'helmet';

const { logger, requestLoggingMiddleware } = loggerModule;
const prisma = prismaModule.default;
const { HealthController } = healthControllerModule;
const { AIClient } = aiClientModule;
const routes = routesModule.default;
const { SecurityMiddleware } = securityMiddlewareModule;
const { validateSession } = authModule;
const scriptRepository = scriptRepositoryModule.default;
const scriptSlugRepository = scriptSlugRepositoryModule.default;

// Constants
const HTTP_LIMITS = {
  BODY_SIZE: '10mb',
  URL_ENCODED_SIZE: '10mb'
};

const SHUTDOWN_CONFIG = {
  TIMEOUT_MS: 3000
};

const REQUEST_TIMEOUT_MS = 30000;

/**
 * Helper to get path from config with fallback
 * @param {string} key - Config key
 * @param {string} fallback - Fallback path
 * @returns {string} - Final path
 */
const getConfigPath = (key, fallback) => {
  const value = config.get(key);
  return value && typeof value === 'string' && value.trim() !== '' ? value : fallback;
};

// Use config values for paths
const clientBuildPath = getConfigPath('CLIENT_BUILD_PATH', path.join(__dirname, '..', 'public', 'dist'));
const publicImagesPath = getConfigPath('PUBLIC_IMAGES_PATH', path.join(__dirname, '..', 'public', 'images'));

/**
 * Validate that critical paths exist
 */
const validatePaths = () => {
  const paths = { clientBuildPath, publicImagesPath };
  for (const [name, p] of Object.entries(paths)) {
    if (!fs.existsSync(p)) {
      logger.warn(`Path not found on startup: ${name} = ${p}`);
    }
  }
};

validatePaths();

/**
 * Generates the HTML for a 404 error page
 * @param {string} fileName - The name of the file that wasn't found
 * @returns {string} - HTML string
 */
const generate404Page = (fileName) => {
  const friendlyName = fileName.replace('.html', '');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>ScriptPal - Page Not Found</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { font-family: Arial, sans-serif; background: #0f1115; color: #f6f7fb; margin: 0; }
      .wrap { max-width: 720px; margin: 10vh auto; padding: 24px; text-align: center; }
      h1 { font-size: 32px; margin: 0 0 12px; }
      p { color: #c6c9d3; margin: 0 0 18px; }
      a { color: #8ab4ff; text-decoration: none; }
      .badge { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #1f2430; margin-top: 8px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="badge">404</div>
      <h1>That page wandered off</h1>
      <p>We couldn't find the ScriptPal page for "${friendlyName}".</p>
      <p><a href="/public">Back to public scripts</a> or <a href="/mine">go home</a>.</p>
    </div>
  </body>
</html>`;
};

/**
 * Async error handler wrapper for Express routes
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Express middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};


/**
 * Enhanced ScriptPal Server
 * Integrates all new backend improvements
 */
class ScriptPalServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.aiClient = null;
    this.healthController = null;
    this.securityMiddleware = new SecurityMiddleware();
    this.isShuttingDown = false;

    this._setupGracefulShutdown();
  }

  /**
   * Initialize and configure the server with all middleware and routes
   * @returns {Promise<void>}
   * @throws {Error} If configuration validation fails
   */
  async initialize() {
    try {
      // Validate configuration
      if (!config.validate()) {
        throw new Error('Configuration validation failed');
      }

      logger.info('Starting ScriptPal server', {
        environment: config.get('NODE_ENV'),
        port: config.get('PORT'),
        host: config.get('HOST')
      });

      // Initialize AI client
      await this._initializeAIClient();

      // Initialize health controller
      this._initializeHealthController();

      // Setup middleware
      this._setupMiddleware();

      // Setup routes
      this._setupRoutes();

      // Setup error handling
      this._setupErrorHandling();

      logger.info('Server initialization completed successfully');

    } catch (error) {
      logger.error('Server initialization failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Initialize AI client
   * @private
   */
  async _initializeAIClient() {
    if (!config.get('ENABLE_AI_FEATURES') || !config.get('OPENAI_API_KEY')) {
      logger.info('AI features disabled or API key not provided');
      return;
    }

    try {
      const client = new AIClient();

      // Test AI client health
      const isHealthy = await client.healthCheck();
      if (!isHealthy) {
        logger.warn('AI health check failed, disabling AI features');
        return;
      }

      this.aiClient = client;
      logger.info('AI client initialized successfully', {
        model: config.get('OPENAI_MODEL')
      });
    } catch (error) {
      logger.error('AI client initialization failed', { error: error.message });
      this.aiClient = null; // Explicitly set to null
    }
  }

  /**
   * Initialize health controller
   * @private
   */
  _initializeHealthController() {
    this.healthController = new HealthController({
      prisma: prisma, // Using the prisma instance
      aiClient: this.aiClient,
      logger: logger
    });
  }


  /**
   * Setup middleware
   * @private
   */
  _setupMiddleware() {
    this.app.set('trust proxy', config.get('TRUST_PROXY') ? 1 : 0);

    // 1. Request logging (first to log everything)
    this.app.use(requestLoggingMiddleware(logger));

    // 2. CSP Nonce generation
    this.app.use((req, res, next) => {
      res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
      next();
    });

    // 3. Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            (req, res) => `'nonce-${res.locals.cspNonce}'`,
            "'strict-dynamic'"
          ],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:", "*"], // Allow images from any source for AI generation
          connectSrc: ["'self'"]
        }
      }
    }));

    // 4. Request timeout
    this.app.use((req, res, next) => {
      req.setTimeout(REQUEST_TIMEOUT_MS);
      res.setTimeout(REQUEST_TIMEOUT_MS);
      next();
    });

    // 5. CORS (before other middleware)
    const corsConfig = config.getCorsConfig();
    const isLocalhostOrigin = (value) => {
      if (!value) return false;
      const normalized = value.toLowerCase();
      return (/^https?:\/\/localhost(:\d+)?$/).test(normalized) ||
        (/^https?:\/\/127\.0\.0\.1(:\d+)?$/).test(normalized);
    };

    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (same-origin, server-to-server)
        if (!origin) {
          return callback(null, true);
        }

        const allowed = corsConfig.origin === '*' ||
                       (Array.isArray(corsConfig.origin) && corsConfig.origin.includes(origin)) ||
                       (typeof corsConfig.origin === 'string' && corsConfig.origin === origin) ||
                       isLocalhostOrigin(origin);

        callback(null, allowed);
      },
      credentials: true,
      methods: corsConfig.methods,
      allowedHeaders: corsConfig.allowedHeaders,
      exposedHeaders: corsConfig.exposedHeaders,
      optionsSuccessStatus: 204
    }));

    // 6. Cookie parsing (before auth)
    this.app.use(cookieParser());


    // 7. Body parsing
    // Manual JSON parsing for brainstorm endpoints to avoid empty array corruption
    this.app.use((req, res, next) => {
      const isBrainstormBoard = req.path.startsWith('/api/brainstorm/boards');
      const isScriptItem = req.path.match(/^\/api\/script\/\d+\/(locations|characters|scenes|themes)/);
      
      if ((isBrainstormBoard || isScriptItem) && (req.method === 'POST' || req.method === 'PUT')) {
        let rawBody = '';
        req.setEncoding('utf8');
        req.on('data', chunk => {
          rawBody += chunk;
        });
        req.on('end', () => {
          try {
            // Store in a separate property to avoid overwriting/corruption by downstream middleware
            req.manualBody = JSON.parse(rawBody);
            // Also set req.body for compatibility, but prefer manualBody in controller
            req.body = req.manualBody;
            next();
          } catch (error) {
            console.error('[Manual JSON Parser] Parse error:', error);
            return res.status(400).json({ error: 'Invalid JSON' });
          }
        });
      } else {
        next();
      }
    });
    
    // Only run express.json() if we haven't already parsed the body manually
    this.app.use((req, res, next) => {
      if (req.body) {
        return next();
      }
      express.json({ limit: HTTP_LIMITS.BODY_SIZE })(req, res, next);
    });
    
    this.app.use(express.urlencoded({ extended: true, limit: HTTP_LIMITS.URL_ENCODED_SIZE }));

    // 8. Custom security/auth middleware
    const securityMiddleware = this.securityMiddleware.getAllSecurityMiddleware();
    securityMiddleware.forEach(middleware => {
      this.app.use(middleware);
    });

    // 9. Static files
    this.app.use('/images', express.static(publicImagesPath, {
      maxAge: '7d',
      immutable: true
    }));

    const mediaUploadDir = config.get('MEDIA_UPLOAD_DIR');
    const publicUploadsPath = path.isAbsolute(mediaUploadDir)
      ? mediaUploadDir
      : path.join(__dirname, '..', mediaUploadDir);
    const mediaBasePath = config.get('MEDIA_BASE_URL');
    this.app.use(mediaBasePath, express.static(publicUploadsPath, {
      maxAge: '1d'
    }));

    this.app.use(express.static(clientBuildPath, {
      maxAge: '1d',
      etag: true,
      lastModified: true
    }));

    // 10. Context injection
    this.app.use((req, res, next) => {
      req.aiClient = this.aiClient;
      // req.logger is already set by requestLoggingMiddleware
      next();
    });
  }


  /**
   * Setup routes
   * @private
   */
  _setupRoutes() {
    /**
     * Helper to send static HTML files with basic error handling
     * @param {Object} res - Express response
     * @param {string} fileName - File name to send
     */
    const sendClientFile = (res, fileName) => {
      const safeName = path.basename(fileName);
      const filePath = path.join(clientBuildPath, safeName);
      const resolvedPath = path.resolve(filePath);
      const basePath = path.resolve(clientBuildPath);

      if (!resolvedPath.startsWith(basePath)) {
        return res.status(403).send('Forbidden');
      }

      res.sendFile(filePath, (err) => {
        if (err) {
          res.status(404).send(generate404Page(fileName));
        }
      });
    };

    /**
     * Helper for legacy ID-based redirects
     */
    const handleLegacyIdRedirect = async (req, res, targetPath, fallbackFile, repositoryMethod) => {
      const id = parseInt(req.query.id, 10);
      if (!id || id < 1 || id > Number.MAX_SAFE_INTEGER) {
        return sendClientFile(res, fallbackFile);
      }

      try {
        const record = await repositoryMethod(id, req.userId);
        if (record && record.slug) {
          return res.redirect(301, `${targetPath}/${record.slug}`);
        }
      } catch (error) {
        req.logger?.warn('Legacy redirect failed', { error: error.message, id, targetPath });
      }

      return sendClientFile(res, fallbackFile);
    };

    // Health and monitoring routes
    this.app.get('/health', (req, res) => this.healthController.health(req, res));
    this.app.get('/healthz', (req, res) => this.healthController.health(req, res));
    this.app.get('/ready', (req, res) => this.healthController.readiness(req, res));
    this.app.get('/readyz', (req, res) => this.healthController.readiness(req, res));
    this.app.get('/live', (req, res) => this.healthController.liveness(req, res));
    this.app.get('/metrics', (req, res) => this.healthController.metrics(req, res));
    this.app.get('/status', (req, res) => this.healthController.status(req, res));

    // Frontend routes
    this.app.get('/public', (req, res) => sendClientFile(res, 'public-scripts.html'));
    this.app.get('/public/:slug', asyncHandler(async (req, res) => {
      const slug = req.params.slug;
      if (!slug) {
        return sendClientFile(res, 'public-script.html');
      }

      const normalizedSlug = decodeURIComponent(slug);
      const matchCount = await scriptSlugRepository.countPublicBySlug(normalizedSlug);

      if (matchCount === 1) {
        const script = await scriptRepository.getPublicScriptBySlug(normalizedSlug);
        if (script?.publicId) {
          const canonicalSlug = script.slug || normalizedSlug;
          const slugSegment = canonicalSlug ? `/${encodeURIComponent(canonicalSlug)}` : '';
          const encodedId = encodeURIComponent(script.publicId);
          return res.redirect(301, `/public/${encodedId}${slugSegment}`);
        }
      }

      return sendClientFile(res, 'public-script.html');
    }));
    this.app.get('/public/:publicId([A-Za-z0-9]+)/:slug?', (req, res) => sendClientFile(res, 'public-script.html'));
    this.app.get('/mine', validateSession, (req, res) => sendClientFile(res, 'index.html'));
    this.app.get('/mine/:slug', validateSession, (req, res) => sendClientFile(res, 'index.html'));
    this.app.get('/brainstorm', validateSession, (req, res) => sendClientFile(res, 'brainstorm.html'));

    // Legacy redirects
    this.app.get('/public-script.html', asyncHandler(async (req, res) => {
      return handleLegacyIdRedirect(
        req, res, '/public', 'public-script.html',
        (id) => scriptRepository.getPublicSlugById(id)
      );
    }));

    this.app.get('/index.html', validateSession, asyncHandler(async (req, res) => {
      if (!req.query.id) return sendClientFile(res, 'index.html');
      return handleLegacyIdRedirect(
        req, res, '/mine', 'index.html',
        (id, userId) => scriptRepository.getSlugByIdForUser(id, userId)
      );
    }));

    // API routes using Express Router
    const apiRouter = express.Router();
    routes.forEach(route => {
      const middleware = route.middleware || [];
      const handler = asyncHandler(route.handler);
      apiRouter[route.method](route.path, ...middleware, handler);
    });

    this.app.use('/api', apiRouter);

    // Frontend fallback (non-API GET routes)
    this.app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      return sendClientFile(res, 'index.html');
    });

    // 404 handler for unmatched routes
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        correlationId: req.correlationId
      });
    });
  }


  /**
   * Setup error handling
   * @private
   */
  _setupErrorHandling() {
    // Global error handler
    // Note: 'next' required for Express to recognize this as error handler
    this.app.use((error, req, res, next) => {
      req.logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method
      });

      // Don't leak error details in production
      const isDevelopment = config.isDevelopment();
      const errorResponse = {
        error: 'Internal server error',
        correlationId: req.correlationId,
        ...(isDevelopment && { details: error.message })
      };

      // Ensure status code is valid
      const status = (error.status >= 400 && error.status < 600) ? error.status : 500;
      res.status(status).json(errorResponse);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.fatal('Uncaught exception', { error: error.message, stack: error.stack });
      this._gracefulShutdown(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.fatal('Unhandled promise rejection', {
        reason: reason?.message || reason,
        promise: String(promise)
      });
      this._gracefulShutdown(1);
    });
  }


  /**
   * Setup graceful shutdown
   * @private
   */
  _setupGracefulShutdown() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    signals.forEach(signal => {
      process.on(signal, () => {
        logger.info(`Received ${signal}, starting graceful shutdown`);
        this._gracefulShutdown(0);
      });
    });
  }

  /**
   * Graceful shutdown
   * @param {number} exitCode - Exit code
   * @private
   */
  async _gracefulShutdown(exitCode = 0) {
    if (this.isShuttingDown) {
      logger.debug('Shutdown already in progress');
      return;
    }
    this.isShuttingDown = true;

    // Remove all signal handlers to prevent re-entry
    ['SIGTERM', 'SIGINT', 'SIGUSR2'].forEach(signal => {
      process.removeAllListeners(signal);
    });

    try {
      logger.info('Starting graceful shutdown');

      // Force exit after timeout to prevent hanging
      const forceExitTimer = setTimeout(() => {
        logger.warn('Shutdown timeout reached, forcing exit');
        process.exit(exitCode);
      }, SHUTDOWN_CONFIG.TIMEOUT_MS);

      // Stop accepting new connections
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close((error) => {
            if (error) {
              logger.warn('Error closing HTTP server', { error: error.message });
            } else {
              logger.info('HTTP server closed');
            }
            resolve();
          });
        });
      }

      await prisma.$disconnect();
      logger.info('Database connections closed');

      clearTimeout(forceExitTimer);
      logger.info('Graceful shutdown completed');
      process.exit(exitCode);

    } catch (error) {
      logger.error('Error during graceful shutdown', { error: error.message });
      process.exit(1);
    }
  }


  /**
   * Start the HTTP server and begin accepting connections
   * @returns {Promise<void>}
   * @throws {Error} If server fails to start (e.g., port in use)
   */
  async start() {
    try {
      await this.initialize();

      const serverConfig = config.getServerConfig();

      this.server = this.app.listen(serverConfig.port, serverConfig.host, () => {
        logger.info('ScriptPal server started', {
          host: serverConfig.host,
          port: serverConfig.port,
          environment: serverConfig.env,
          pid: process.pid
        });
      });

      // Handle server errors
      this.server.on('error', (error) => {
        logger.error('Server error', { error: error.message });
        throw error;
      });

    } catch (error) {
      logger.error('Failed to start server', { error: error.message });
      process.exit(1);
    }
  }

  /**
   * Gracefully stop the server, close connections, and clean up resources
   * @returns {Promise<void>}
   */
  async stop() {
    await this._gracefulShutdown(0);
  }
}


// Create and start server
async function startServer() {
  const server = new ScriptPalServer();

  // Start server
  try {
    await server.start();
  } catch (error) {
    logger.fatal('Server startup failed', { error: error.message });
    process.exit(1);
  }

  return server;
}

// Start the server
const server = await startServer();

export default server;
