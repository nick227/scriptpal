import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import prisma from '../db/prismaClient.js';

/**
 * Health Controller
 * Provides health and readiness endpoints for monitoring and orchestration
 */
export class HealthController {
  constructor(dependencies = {}) {
    this.prisma = dependencies.prisma || prisma;
    this.aiClient = dependencies.aiClient;
    this.startTime = Date.now();
    this.healthChecks = new Map();
    this.readinessChecks = new Map();

    // Register default health checks
    this._registerDefaultChecks();
  }

  /**
     * Register default health checks
     */
  _registerDefaultChecks() {
    // Database health check
    this.registerHealthCheck('database', async() => {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy'
      };
    });

    // AI service health check
    this.registerHealthCheck('ai', async() => {
      if (!this.aiClient) {
        return { status: 'disabled', message: 'AI client not configured' };
      }

      try {
        const isHealthy = await this.aiClient.healthCheck();
        return {
          status: isHealthy ? 'healthy' : 'unhealthy',
          model: config.get('OPENAI_MODEL')
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message
        };
      }
    });

    // Memory health check
    this.registerHealthCheck('memory', () => {
      const memUsage = process.memoryUsage();
      const memUsageMB = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      };

      // Consider unhealthy if heap usage is over 1GB
      const isHealthy = memUsageMB.heapUsed < 1024;

      return {
        status: isHealthy ? 'healthy' : 'warning',
        usage: memUsageMB,
        threshold: '1GB'
      };
    });
  }

  /**
     * Register a health check
     * @param {string} name - Health check name
     * @param {Function} checkFn - Health check function
     */
  registerHealthCheck(name, checkFn) {
    this.healthChecks.set(name, checkFn);
  }

  /**
     * Register a readiness check
     * @param {string} name - Readiness check name
     * @param {Function} checkFn - Readiness check function
     */
  registerReadinessCheck(name, checkFn) {
    this.readinessChecks.set(name, checkFn);
  }

  /**
     * Perform health checks
     * @returns {Promise<Object>} - Health check results
     */
  async performHealthChecks() {
    const results = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks: {}
    };

    for (const [name, checkFn] of this.healthChecks) {
      try {
        const result = await checkFn();
        results.checks[name] = {
          status: 'healthy',
          ...result
        };

        // If any check is unhealthy, overall status is unhealthy
        if (result.status === 'unhealthy') {
          results.status = 'unhealthy';
        } else if (result.status === 'warning' && results.status === 'healthy') {
          results.status = 'warning';
        }

      } catch (error) {
        results.checks[name] = {
          status: 'unhealthy',
          error: error.message
        };
        results.status = 'unhealthy';
      }
    }

    return results;
  }

  /**
     * Perform readiness checks
     * @returns {Promise<Object>} - Readiness check results
     */
  async performReadinessChecks() {
    const results = {
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {}
    };

    for (const [name, checkFn] of this.readinessChecks) {
      try {
        const result = await checkFn();
        results.checks[name] = {
          status: 'ready',
          ...result
        };

        // If any check is not ready, overall status is not ready
        if (result.status !== 'ready') {
          results.status = 'not_ready';
        }

      } catch (error) {
        results.checks[name] = {
          status: 'not_ready',
          error: error.message
        };
        results.status = 'not_ready';
      }
    }

    return results;
  }

  /**
     * Health endpoint handler
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
  async health(req, res) {
    try {
      const healthResults = await this.performHealthChecks();

      const statusCode = healthResults.status === 'healthy' ? 200 :
        healthResults.status === 'warning' ? 200 : 503;

      logger.info('Health check performed', {
        status: healthResults.status,
        checks: Object.keys(healthResults.checks).length,
        correlationId: req.correlationId
      });

      res.status(statusCode).json(healthResults);

    } catch (error) {
      logger.error('Health check failed', {
        error: error.message,
        correlationId: req.correlationId
      });

      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId
      });
    }
  }

  /**
     * Readiness endpoint handler
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
  async readiness(req, res) {
    try {
      const readinessResults = await this.performReadinessChecks();

      const statusCode = readinessResults.status === 'ready' ? 200 : 503;

      logger.info('Readiness check performed', {
        status: readinessResults.status,
        checks: Object.keys(readinessResults.checks).length,
        correlationId: req.correlationId
      });

      res.status(statusCode).json(readinessResults);

    } catch (error) {
      logger.error('Readiness check failed', {
        error: error.message,
        correlationId: req.correlationId
      });

      res.status(503).json({
        status: 'not_ready',
        error: 'Readiness check failed',
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId
      });
    }
  }

  /**
     * Liveness endpoint handler
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
  liveness(req, res) {
    const livenessData = {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      pid: process.pid,
      version: process.version,
      environment: config.get('NODE_ENV')
    };

    res.status(200).json(livenessData);
  }

  /**
     * Metrics endpoint handler
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
  metrics(req, res) {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        environment: config.get('NODE_ENV'),
        version: process.version
      };

      // Add AI client metrics if available
      if (this.aiClient && typeof this.aiClient.getMetrics === 'function') {
        metrics.ai = this.aiClient.getMetrics();
      }

      res.status(200).json(metrics);

    } catch (error) {
      logger.error('Metrics collection failed', {
        error: error.message,
        correlationId: req.correlationId
      });

      res.status(500).json({
        error: 'Metrics collection failed',
        correlationId: req.correlationId
      });
    }
  }

  /**
     * Status endpoint handler (combined health and readiness)
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
  async status(req, res) {
    try {
      const [healthResults, readinessResults] = await Promise.all([
        this.performHealthChecks(),
        this.performReadinessChecks()
      ]);

      const status = {
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        health: healthResults,
        readiness: readinessResults,
        overall: {
          status: healthResults.status === 'healthy' && readinessResults.status === 'ready' ? 'ok' : 'degraded'
        }
      };

      const statusCode = status.overall.status === 'ok' ? 200 : 503;

      res.status(statusCode).json(status);

    } catch (error) {
      logger.error('Status check failed', {
        error: error.message,
        correlationId: req.correlationId
      });

      res.status(503).json({
        error: 'Status check failed',
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId
      });
    }
  }
}

/**
 * Health Controller Factory
 */
export class HealthControllerFactory {
  /**
     * Create health controller
     * @param {Object} dependencies - Dependencies
     * @returns {HealthController} - Health controller instance
     */
  static create(dependencies = {}) {
    return new HealthController(dependencies);
  }
}

// Export default instance
export default HealthController;
