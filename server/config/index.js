import Joi from 'joi';
import { URL } from 'url';

/**
 * Configuration schema for validation
 */
const configSchema = Joi.object({
  // Server configuration
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),
  HOST: Joi.string().default('0.0.0.0'),

  // Database configuration
  DATABASE_URL: Joi.string().optional(),
  DB_HOST: Joi.string().optional().default('localhost'),
  DB_PORT: Joi.number().port().default(3306),
  DB_USER: Joi.string().optional(),
  DB_PASSWORD: Joi.string().allow('').default(''),
  DB_NAME: Joi.string().optional(),
  DB_CONNECTION_LIMIT: Joi.number().min(1).max(100).default(10),
  DB_QUEUE_LIMIT: Joi.number().min(0).default(0),
  DB_ACQUIRE_TIMEOUT: Joi.number().min(1000).default(60000),
  DB_TIMEOUT: Joi.number().min(1000).default(60000),
  DB_RECONNECT: Joi.boolean().default(true),
  DB_CHARSET: Joi.string().default('utf8mb4'),

  // CORS configuration
  CORS_ORIGINS: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).default('*'),
  CORS_CREDENTIALS: Joi.boolean().default(true),

  // Security configuration
  SESSION_SECRET: Joi.string().min(32).when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional().default('development-session-secret-key-minimum-32-characters')
  }),
  SESSION_MAX_AGE: Joi.number().min(3600).default(86400), // 24 hours
  RATE_LIMIT_WINDOW: Joi.number().min(1000).default(900000), // 15 minutes
  RATE_LIMIT_MAX: Joi.number().min(1).default(100),
  RATE_LIMIT_MAX_AUTH: Joi.number().min(1).optional(),
  RATE_LIMIT_MAX_ANON: Joi.number().min(1).optional(),
  TRUST_PROXY: Joi.boolean().default(true),

  // AI/LLM configuration
  OPENAI_API_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  OPENAI_MODEL: Joi.string().default('gpt-3.5-turbo'),
  OPENAI_MAX_TOKENS: Joi.number().min(1).max(4000).default(1000),
  OPENAI_TEMPERATURE: Joi.number().min(0).max(2).default(0.7),
  OPENAI_TIMEOUT: Joi.number().min(1000).default(90000),
  OPENAI_MAX_RETRIES: Joi.number().min(0).max(5).default(3),

  // Logging configuration
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'pretty').default('json'),
  LOG_FILE: Joi.string().optional(),

  // Monitoring configuration
  ENABLE_METRICS: Joi.boolean().default(true),
  METRICS_PORT: Joi.number().port().default(9090),
  HEALTH_CHECK_INTERVAL: Joi.number().min(1000).default(30000),

  // Feature flags
  ENABLE_AI_FEATURES: Joi.boolean().default(true),
  ENABLE_CHAT_HISTORY: Joi.boolean().default(true),
  ENABLE_SCRIPT_VERSIONING: Joi.boolean().default(true),
  ENABLE_AUDIT_LOGS: Joi.boolean().default(false)
});

/**
 * Parse CORS origins from environment variable
 * @param {string} origins - Comma-separated list of origins
 * @returns {string[]|string} - Array of origins or '*' for all
 */
function parseCorsOrigins(origins) {
  if (!origins || origins === '*') {
    return '*';
  }
  return origins.split(',').map(origin => origin.trim());
}

/**
 * Configuration class
 */
class Config {
  constructor() {
    this._config = null;
    this._loadConfig();
  }

  /**
     * Load and validate configuration
     */
  _loadConfig() {
    try {
      // Prepare environment variables for validation
      const envVars = {
        ...process.env,
        // Parse CORS origins
        CORS_ORIGINS: parseCorsOrigins(process.env.CORS_ORIGINS)
      };

      // Validate configuration
      const { error, value } = configSchema.validate(envVars, {
        allowUnknown: false,
        stripUnknown: true,
        abortEarly: false
      });

      if (error) {
        const errorMessages = error.details.map(detail => detail.message).join(', ');
        throw new Error(`Configuration validation failed: ${errorMessages}`);
      }

      this._config = value;
      console.log('Configuration loaded successfully');
    } catch (error) {
      console.error('Failed to load configuration:', error.message);
      process.exit(1);
    }
  }

  /**
     * Get configuration value
     * @param {string} key - Configuration key
     * @returns {*} - Configuration value
     */
  get(key) {
    return this._config[key];
  }

  /**
     * Get all configuration
     * @returns {Object} - All configuration values
     */
  getAll() {
    return { ...this._config };
  }

  /**
     * Get database configuration
     * @returns {Object} - Database configuration
     */
  getDatabaseConfig() {
    const databaseUrl = this.get('DATABASE_URL');

    if (databaseUrl) {
      // Parse DATABASE_URL format: mysql://user:password@host:port/database
      const url = new URL(databaseUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port) || 3306,
        user: url.username,
        password: url.password,
        database: url.pathname.slice(1), // Remove leading slash
        connectionLimit: this.get('DB_CONNECTION_LIMIT'),
        queueLimit: this.get('DB_QUEUE_LIMIT'),
        acquireTimeout: this.get('DB_ACQUIRE_TIMEOUT'),
        timeout: this.get('DB_TIMEOUT'),
        reconnect: this.get('DB_RECONNECT'),
        charset: this.get('DB_CHARSET')
      };
    } else {
      // Fallback to individual environment variables
      return {
        host: this.get('DB_HOST'),
        port: this.get('DB_PORT'),
        user: this.get('DB_USER'),
        password: this.get('DB_PASSWORD'),
        database: this.get('DB_NAME'),
        connectionLimit: this.get('DB_CONNECTION_LIMIT'),
        queueLimit: this.get('DB_QUEUE_LIMIT'),
        acquireTimeout: this.get('DB_ACQUIRE_TIMEOUT'),
        timeout: this.get('DB_TIMEOUT'),
        reconnect: this.get('DB_RECONNECT'),
        charset: this.get('DB_CHARSET')
      };
    }
  }

  /**
     * Get CORS configuration
     * @returns {Object} - CORS configuration
     */
  getCorsConfig() {
    return {
      origin: this.get('CORS_ORIGINS'),
      credentials: this.get('CORS_CREDENTIALS'),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Cookie',
        'Accept',
        'X-Requested-With',
        'X-Correlation-ID'
      ],
      exposedHeaders: ['Set-Cookie', 'X-Correlation-ID']
    };
  }

  /**
     * Get security configuration
     * @returns {Object} - Security configuration
     */
  getSecurityConfig() {
    return {
      sessionSecret: this.get('SESSION_SECRET'),
      sessionMaxAge: this.get('SESSION_MAX_AGE'),
      rateLimitWindow: this.get('RATE_LIMIT_WINDOW'),
      rateLimitMax: this.get('RATE_LIMIT_MAX'),
      rateLimitMaxAuth: this.get('RATE_LIMIT_MAX_AUTH') ?? this.get('RATE_LIMIT_MAX'),
      rateLimitMaxAnon: this.get('RATE_LIMIT_MAX_ANON') ?? this.get('RATE_LIMIT_MAX')
    };
  }

  /**
     * Get AI configuration
     * @returns {Object} - AI configuration
     */
  getAIConfig() {
    return {
      apiKey: this.get('OPENAI_API_KEY'),
      model: this.get('OPENAI_MODEL'),
      maxTokens: this.get('OPENAI_MAX_TOKENS'),
      temperature: this.get('OPENAI_TEMPERATURE'),
      timeout: this.get('OPENAI_TIMEOUT'),
      maxRetries: this.get('OPENAI_MAX_RETRIES')
    };
  }

  /**
     * Get logging configuration
     * @returns {Object} - Logging configuration
     */
  getLoggingConfig() {
    return {
      level: this.get('LOG_LEVEL'),
      format: this.get('LOG_FORMAT'),
      file: this.get('LOG_FILE')
    };
  }

  /**
     * Get monitoring configuration
     * @returns {Object} - Monitoring configuration
     */
  getMonitoringConfig() {
    return {
      enableMetrics: this.get('ENABLE_METRICS'),
      metricsPort: this.get('METRICS_PORT'),
      healthCheckInterval: this.get('HEALTH_CHECK_INTERVAL')
    };
  }

  /**
     * Get feature flags
     * @returns {Object} - Feature flags
     */
  getFeatureFlags() {
    return {
      enableAI: this.get('ENABLE_AI_FEATURES'),
      enableChatHistory: this.get('ENABLE_CHAT_HISTORY'),
      enableScriptVersioning: this.get('ENABLE_SCRIPT_VERSIONING'),
      enableAuditLogs: this.get('ENABLE_AUDIT_LOGS')
    };
  }

  /**
     * Check if running in development mode
     * @returns {boolean} - Whether in development mode
     */
  isDevelopment() {
    return this.get('NODE_ENV') === 'development';
  }

  /**
     * Check if running in production mode
     * @returns {boolean} - Whether in production mode
     */
  isProduction() {
    return this.get('NODE_ENV') === 'production';
  }

  /**
     * Check if running in test mode
     * @returns {boolean} - Whether in test mode
     */
  isTest() {
    return this.get('NODE_ENV') === 'test';
  }

  /**
     * Get server configuration
     * @returns {Object} - Server configuration
     */
  getServerConfig() {
    return {
      port: this.get('PORT'),
      host: this.get('HOST'),
      env: this.get('NODE_ENV')
    };
  }

  /**
     * Validate configuration on startup
     * @returns {boolean} - Whether configuration is valid
     */
  validate() {
    try {
      // Check required configurations for production
      if (this.isProduction()) {
        const required = ['OPENAI_API_KEY', 'SESSION_SECRET'];
        const missing = required.filter(key => !this.get(key));

        if (missing.length > 0) {
          throw new Error(`Missing required configuration for production: ${missing.join(', ')}`);
        }
      }

      // Validate database connection
      const databaseUrl = this.get('DATABASE_URL');
      console.log('Validation - DATABASE_URL:', databaseUrl ? 'SET' : 'NOT SET');

      if (databaseUrl) {
        // Validate DATABASE_URL format
        try {
          const url = new URL(databaseUrl);
          if (!url.hostname || !url.username || !url.pathname.slice(1)) {
            throw new Error('Invalid DATABASE_URL format: must include hostname, username, and database name');
          }
          console.log('DATABASE_URL validation passed');
        } catch (error) {
          throw new Error(`Invalid DATABASE_URL: ${error.message}`);
        }
      } else {
        // Validate individual database environment variables
        const dbHost = this.get('DB_HOST');
        const dbUser = this.get('DB_USER');
        const dbName = this.get('DB_NAME');

        console.log('Individual DB vars - Host:', dbHost, 'User:', dbUser, 'Name:', dbName);

        if (!dbHost || !dbUser || !dbName) {
          throw new Error('Invalid database configuration: either provide DATABASE_URL or set DB_HOST, DB_USER, and DB_NAME');
        }
      }

      return true;
    } catch (error) {
      console.error('Configuration validation failed:', error.message);
      return false;
    }
  }

  /**
     * Get configuration summary (without sensitive data)
     * @returns {Object} - Configuration summary
     */
  getSummary() {
    const config = this.getAll();
    const sensitive = ['DB_PASSWORD', 'SESSION_SECRET', 'OPENAI_API_KEY'];

    const summary = { ...config };
    sensitive.forEach(key => {
      if (summary[key]) {
        summary[key] = '***REDACTED***';
      }
    });

    return summary;
  }
}

// Create singleton instance with lazy loading
let configInstance = null;

const config = {
  get(key) {
    if (!configInstance) {
      configInstance = new Config();
    }
    return configInstance.get(key);
  },
  getAll() {
    if (!configInstance) {
      configInstance = new Config();
    }
    return configInstance.getAll();
  },
  getDatabaseConfig() {
    if (!configInstance) {
      configInstance = new Config();
    }
    return configInstance.getDatabaseConfig();
  },
  getCorsConfig() {
    if (!configInstance) {
      configInstance = new Config();
    }
    return configInstance.getCorsConfig();
  },
  getSecurityConfig() {
    if (!configInstance) {
      configInstance = new Config();
    }
    return configInstance.getSecurityConfig();
  },
  getAIConfig() {
    if (!configInstance) {
      configInstance = new Config();
    }
    return configInstance.getAIConfig();
  },
  getLoggingConfig() {
    if (!configInstance) {
      configInstance = new Config();
    }
    return configInstance.getLoggingConfig();
  },
  getMonitoringConfig() {
    if (!configInstance) {
      configInstance = new Config();
    }
    return configInstance.getMonitoringConfig();
  },
  getFeatureFlags() {
    if (!configInstance) {
      configInstance = new Config();
    }
    return configInstance.getFeatureFlags();
  },
  isDevelopment() {
    if (!configInstance) {
      configInstance = new Config();
    }
    return configInstance.isDevelopment();
  },
  isProduction() {
    if (!configInstance) {
      configInstance = new Config();
    }
    return configInstance.isProduction();
  },
  isTest() {
    if (!configInstance) {
      configInstance = new Config();
    }
    return configInstance.isTest();
  },
  getServerConfig() {
    if (!configInstance) {
      configInstance = new Config();
    }
    return configInstance.getServerConfig();
  },
  validate() {
    if (!configInstance) {
      configInstance = new Config();
    }
    return configInstance.validate();
  },
  getSummary() {
    if (!configInstance) {
      configInstance = new Config();
    }
    return configInstance.getSummary();
  }
};

export default config;
