
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });
const clientBuildPath = path.join(__dirname, '..', 'public', 'dist');

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

// Import config-dependent modules after dotenv has loaded
const configModule = await import('./config/index.js');
const loggerModule = await import('./utils/logger.js');
const prismaModule = await import('./db/prismaClient.js');
const healthControllerModule = await import('./controllers/healthController.js');
const aiClientModule = await import('./services/AIClient.js');
const routesModule = await import('./routes.js');
const securityMiddlewareModule = await import('./middleware/security.js');
const authModule = await import('./middleware/auth.js');
const scriptRepositoryModule = await import('./repositories/scriptRepository.js');

const config = configModule.default;
const { logger, requestLoggingMiddleware } = loggerModule;
const prisma = prismaModule.default;
const { HealthController } = healthControllerModule;
const { AIClient } = aiClientModule;
const routes = routesModule.default;
const { SecurityMiddleware } = securityMiddlewareModule;
const { validateSession } = authModule;
const scriptRepository = scriptRepositoryModule.default;

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
     * Initialize the server
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
     */
  async _initializeAIClient() {
    try {
      if (config.get('ENABLE_AI_FEATURES') && config.get('OPENAI_API_KEY')) {
        this.aiClient = new AIClient();

        // Test AI client health
        const isHealthy = await this.aiClient.healthCheck();
        if (!isHealthy) {
          logger.warn('AI client health check failed, but continuing');
        }

        logger.info('AI client initialized', {
          model: config.get('OPENAI_MODEL'),
          healthy: isHealthy
        });
      } else {
        logger.info('AI features disabled or API key not provided');
      }
    } catch (error) {
      logger.error('AI client initialization failed', { error: error.message });
      // Don't throw error - server can run without AI features
    }
  }

  /**
     * Initialize health controller
     */
  _initializeHealthController() {
    this.healthController = new HealthController({
      prisma,
      aiClient: this.aiClient
    });
  }

  /**
     * Setup middleware
     */
  _setupMiddleware() {
    this.app.set('trust proxy', config.get('TRUST_PROXY') ? 1 : 0);

    // Request logging middleware (must be first)
    this.app.use(requestLoggingMiddleware(logger));

    // CORS middleware (must be before other middleware)
    const corsConfig = config.getCorsConfig();
    const normalizedOrigins = (() => {
      if (!corsConfig.origin || corsConfig.origin === '*') {
        return null;
      }
      return Array.isArray(corsConfig.origin) ? corsConfig.origin : [corsConfig.origin];
    })();

    const isLocalhostOrigin = (value) => {
      if (!value) return false;
      const normalized = value.toLowerCase();
      return (/^https?:\/\/localhost(:\d+)?$/).test(normalized) ||
        (/^https?:\/\/127\.0\.0\.1(:\d+)?$/).test(normalized);
    };

    const isOriginAllowed = (originValue) => {
      if (!originValue) {
        return true;
      }
      if (originValue === 'null') {
        return true;
      }

      if (normalizedOrigins === null) {
        return true;
      }

      return normalizedOrigins.includes(originValue) || isLocalhostOrigin(originValue);
    };

    this.app.use(cors({
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, false);
        }
        if (isOriginAllowed(origin)) {
          return callback(null, origin);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: corsConfig.credentials,
      methods: corsConfig.methods,
      allowedHeaders: corsConfig.allowedHeaders,
      exposedHeaders: corsConfig.exposedHeaders,
      optionsSuccessStatus: 204
    }));

    // Security middleware
    const securityMiddleware = this.securityMiddleware.getAllSecurityMiddleware();
    securityMiddleware.forEach(middleware => {
      this.app.use(middleware);
    });

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Cookie parsing middleware
    this.app.use(cookieParser());

    // Serve built frontend assets
    this.app.use(express.static(clientBuildPath));

    this.app.use((req, res, next) => {
      req.aiClient = this.aiClient;
      req.logger = logger.child({
        context: 'Request',
        correlationId: req.correlationId
      });
      next();
    });
  }

  /**
     * Setup routes
     */
  _setupRoutes() {
    const sendClientFile = (res, fileName) => {
      return res.sendFile(path.join(clientBuildPath, fileName));
    };

    // Health and monitoring routes (no auth required)
    this.app.get('/health', (req, res) => this.healthController.health(req, res));
    this.app.get('/healthz', (req, res) => this.healthController.health(req, res));
    this.app.get('/ready', (req, res) => this.healthController.readiness(req, res));
    this.app.get('/readyz', (req, res) => this.healthController.readiness(req, res));
    this.app.get('/live', (req, res) => this.healthController.liveness(req, res));
    this.app.get('/metrics', (req, res) => this.healthController.metrics(req, res));
    this.app.get('/status', (req, res) => this.healthController.status(req, res));

    // Frontend routes (static HTML entry points)
    this.app.get('/public', (req, res) => sendClientFile(res, 'public-scripts.html'));
    this.app.get('/public/:slug', (req, res) => sendClientFile(res, 'public-script.html'));
    this.app.get('/mine', validateSession, (req, res) => sendClientFile(res, 'index.html'));
    this.app.get('/mine/:slug', validateSession, (req, res) => sendClientFile(res, 'index.html'));

    // Legacy redirects (querystring -> slug routes)
    this.app.get('/public-script.html', async(req, res) => {
      try {
        const rawId = Number(req.query.id);
        if (!rawId) {
          return sendClientFile(res, 'public-script.html');
        }
        const record = await scriptRepository.getPublicSlugById(rawId);
        if (record && record.slug) {
          return res.redirect(301, `/public/${record.slug}`);
        }
        return sendClientFile(res, 'public-script.html');
      } catch (error) {
        req.logger?.warn('Legacy public redirect failed', { error: error.message });
        return sendClientFile(res, 'public-script.html');
      }
    });

    this.app.get('/index.html', (req, res, next) => {
      if (!req.query.id) {
        return sendClientFile(res, 'index.html');
      }
      return next();
    }, validateSession, async(req, res) => {
      try {
        const rawId = Number(req.query.id);
        if (!rawId) {
          return sendClientFile(res, 'index.html');
        }
        const record = await scriptRepository.getSlugByIdForUser(rawId, req.userId);
        if (record && record.slug) {
          return res.redirect(301, `/mine/${record.slug}`);
        }
        return sendClientFile(res, 'index.html');
      } catch (error) {
        req.logger?.warn('Legacy editor redirect failed', { error: error.message });
        return sendClientFile(res, 'index.html');
      }
    });

    // API routes
    this.app.use('/api', (req, res, _next) => {
      // Remove /api prefix from path for matching
      const pathWithoutPrefix = req.path.replace(/^\/api/, '');

      // Convert route path pattern to regex
      const route = routes.find(r => {
        const routePattern = new RegExp(`^${r.path.replace(/:(\w+)/g, '([^/]+)')}$`);
        return routePattern.test(pathWithoutPrefix) && r.method === req.method.toLowerCase();
      });

      if (!route) {
        return res.status(404).json({
          error: 'Route not found',
          path: req.path,
          method: req.method,
          correlationId: req.correlationId
        });
      }

      // Extract parameters from URL
      const routePattern = new RegExp(`^${route.path.replace(/:(\w+)/g, '([^/]+)')}$`);
      const matches = pathWithoutPrefix.match(routePattern);
      if (matches) {
        const paramNames = (route.path.match(/:(\w+)/g) || []).map(name => name.slice(1));
        paramNames.forEach((name, index) => {
          req.params[name] = matches[index + 1];
        });
      }

      // Log route match
      req.logger.debug('Route matched', {
        originalPath: req.path,
        matchedPath: pathWithoutPrefix,
        method: req.method,
        route: route.path,
        params: req.params
      });

      // Execute middleware chain
      if (route.middleware && route.middleware.length > 0) {
        let current = 0;
        const nextMiddleware = () => {
          if (current < route.middleware.length) {
            route.middleware[current++](req, res, nextMiddleware);
          } else {
            route.handler(req, res);
          }
        };
        nextMiddleware();
      } else {
        route.handler(req, res);
      }
    });

    // Frontend fallback (non-API GET routes)
    this.app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      return res.sendFile(path.join(clientBuildPath, 'index.html'));
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
     */
  _setupErrorHandling() {
    // Global error handler
    this.app.use((error, req, res, _next) => {
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

      res.status(500).json(errorResponse);
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
        promise: promise.toString()
      });
      this._gracefulShutdown(1);
    });
  }

  /**
     * Setup graceful shutdown
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
     */
  async _gracefulShutdown(exitCode = 0) {
    if (this.isShuttingDown) {
      return;
    }
    this.isShuttingDown = true;

    try {
      logger.info('Starting graceful shutdown');

      // Stop accepting new connections
      if (this.server) {
        await new Promise((resolve, reject) => {
          this.server.close((error) => {
            if (error) {
              return reject(error);
            }
            logger.info('HTTP server closed');
            resolve();
          });
        });
      }

      await prisma.$disconnect();
      logger.info('Database connections closed');

      logger.info('Graceful shutdown completed');
      process.exit(exitCode);

    } catch (error) {
      logger.error('Error during graceful shutdown', { error: error.message });
      process.exit(1);
    }
  }

  /**
     * Start the server
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
     * Stop the server
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
