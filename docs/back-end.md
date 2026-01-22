# ScriptPal Backend Documentation

## Overview

The ScriptPal backend is a Node.js application built with Express.js, providing a RESTful API for script management, user authentication, AI integration, and real-time chat functionality. The backend follows a layered architecture with clear separation of concerns.

## Technology Stack

- **Node.js**: Server runtime with ES6 modules
- **Express.js**: Web framework with middleware support
- **MySQL**: Database with connection pooling
- **OpenAI API**: AI/LLM integration for script assistance
- **Jest**: Testing framework
- **Pino**: Structured logging
- **Joi**: Configuration validation
- **Zod**: Input validation

## Project Structure

```
server/
├── server.js                    # Main server entry point
├── config/                      # Configuration management
│   └── index.js                # Configuration loader and validation
├── controllers/                 # HTTP request handlers
│   ├── scriptController.js     # Script CRUD operations
│   ├── userController.js       # User authentication
│   ├── chatController.js       # AI chat functionality
│   ├── healthController.js     # Health monitoring
│   ├── langchain/              # AI workflow management
│   │   ├── chains/             # LangChain implementations
│   │   ├── prompts/            # AI prompt templates
│   │   └── router/             # AI routing logic
│   └── scripts/                # Script-specific controllers
├── models/                      # Data access layer
│   ├── user.js                 # User model
│   ├── script.js               # Script model
│   ├── conversation.js         # Chat model
│   └── item.js                 # Generic item model
├── services/                    # Business logic services
│   └── AIClient.js             # OpenAI integration
├── middleware/                  # Express middleware
│   ├── auth.js                 # Authentication middleware
│   └── security.js             # Security middleware
├── db/                         # Database layer
│   ├── ConnectionPool.js       # MySQL connection pool
│   └── index.js                # Database wrapper
├── utils/                      # Utility functions
│   └── logger.js               # Logging configuration
├── routes.js                   # Route definitions
├── schema.sql                  # Database schema
└── __tests__/                  # Test files
```

## Server Architecture

### Main Server Class

The `ScriptPalServer` class orchestrates the entire backend:

```javascript
class ScriptPalServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.dbPool = null;
    this.aiClient = null;
    this.healthController = null;
    this.securityMiddleware = new SecurityMiddleware();
  }

  async initialize() {
    // 1. Validate configuration
    if (!config.validate()) {
      throw new Error('Configuration validation failed');
    }

    // 2. Initialize database
    await this._initializeDatabase();

    // 3. Initialize AI client
    await this._initializeAIClient();

    // 4. Setup middleware
    this._setupMiddleware();

    // 5. Setup routes
    this._setupRoutes();

    // 6. Setup error handling
    this._setupErrorHandling();
  }

  async start() {
    await this.initialize();
    
    const serverConfig = config.getServerConfig();
    this.server = this.app.listen(serverConfig.port, serverConfig.host, () => {
      logger.info('ScriptPal server started', {
        host: serverConfig.host,
        port: serverConfig.port,
        environment: serverConfig.env
      });
    });
  }
}
```

### Configuration Management

The configuration system uses Joi for validation:

```javascript
// config/index.js
const configSchema = Joi.object({
  // Server configuration
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),
  HOST: Joi.string().default('localhost'),

  // Database configuration
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().port().default(3306),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').default(''),
  DB_NAME: Joi.string().required(),
  DB_CONNECTION_LIMIT: Joi.number().min(1).max(100).default(10),

  // AI configuration
  OPENAI_API_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  OPENAI_MODEL: Joi.string().default('gpt-3.5-turbo'),
  OPENAI_MAX_TOKENS: Joi.number().min(1).max(4000).default(1000),

  // Security configuration
  SESSION_SECRET: Joi.string().min(32).required(),
  RATE_LIMIT_WINDOW: Joi.number().min(1000).default(900000),
  RATE_LIMIT_MAX: Joi.number().min(1).default(100)
});

class Config {
  constructor() {
    this.config = this._loadConfig();
  }

  _loadConfig() {
    const { error, value } = configSchema.validate(process.env);
    if (error) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }
    return value;
  }

  get(key) {
    return this.config[key];
  }

  getDatabaseConfig() {
    return {
      host: this.get('DB_HOST'),
      port: this.get('DB_PORT'),
      user: this.get('DB_USER'),
      password: this.get('DB_PASSWORD'),
      database: this.get('DB_NAME'),
      connectionLimit: this.get('DB_CONNECTION_LIMIT')
    };
  }

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
}
```

## Database Layer

### Connection Pool

The `ConnectionPool` class manages MySQL connections with health monitoring:

```javascript
class ConnectionPool {
  constructor() {
    this.pool = null;
    this.isHealthy = false;
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      totalQueries: 0,
      failedQueries: 0,
      averageQueryTime: 0
    };
  }

  async initialize() {
    const dbConfig = config.getDatabaseConfig();
    
    this.pool = mysql.createPool({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: dbConfig.connectionLimit,
      queueLimit: 0,
      idleTimeout: 300000,
      maxIdle: 10,
      enableKeepAlive: true
    });

    this._setupEventListeners();
    await this._testConnection();
    this._startHealthMonitoring();
  }

  async query(query, params = [], options = {}) {
    const maxRetries = options.maxRetries || 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await this.pool.execute(query, params);
        const queryTime = Date.now() - startTime;

        this.metrics.totalQueries++;
        this._updateAverageQueryTime(queryTime);
        return result;

      } catch (error) {
        lastError = error;
        this.metrics.failedQueries++;

        if (this._isRetryableError(error) && attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt - 1);
          await this._sleep(delay);
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  async transaction(callback) {
    const connection = await this.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
```

### Database Wrapper

The database wrapper provides a clean interface for data operations:

```javascript
// db/index.js
const db = {
  // User operations
  getUser: async (id) => {
    const rows = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0];
  },

  createUser: async (user) => {
    const result = await db.query(
      'INSERT INTO users (email) VALUES (?)',
      [user.email]
    );
    return { id: result.insertId, ...user };
  },

  // Script operations
  getScript: async (id) => {
    const rows = await db.query(
      'SELECT * FROM scripts WHERE id = ? ORDER BY version_number DESC LIMIT 1',
      [id]
    );
    return rows[0];
  },

  createScript: async (script) => {
    const result = await db.query(
      'INSERT INTO scripts (user_id, title, content, version_number, status) VALUES (?, ?, ?, ?, ?)',
      [script.user_id, script.title, script.content, script.version_number, script.status]
    );
    return { id: result.insertId, ...script };
  },

  updateScript: async (id, script) => {
    const result = await db.query(
      'UPDATE scripts SET title = ?, content = ?, version_number = ?, status = ?, updated_at = NOW() WHERE id = ?',
      [script.title, script.content, script.version_number, script.status, id]
    );
    return result.affectedRows > 0 ? { id, ...script } : null;
  },

  getAllScriptsByUser: async (userId) => {
    return await db.query(
      'SELECT * FROM scripts WHERE user_id = ? ORDER BY updated_at DESC',
      [userId]
    );
  },

  // Chat operations
  getChatHistory: async (userId, scriptId = null) => {
    let query = 'SELECT * FROM chat_history WHERE user_id = ?';
    const params = [userId];
    
    if (scriptId) {
      query += ' AND script_id = ?';
      params.push(scriptId);
    }
    
    query += ' ORDER BY timestamp ASC';
    return await db.query(query, params);
  },

  saveChatMessage: async (message) => {
    const result = await db.query(
      'INSERT INTO chat_history (user_id, script_id, content, type) VALUES (?, ?, ?, ?)',
      [message.user_id, message.script_id, message.content, message.type]
    );
    return { id: result.insertId, ...message };
  }
};
```

## Controllers

### Script Controller

The `ScriptController` handles script CRUD operations:

```javascript
const scriptController = {
  getScript: async (req, res) => {
    try {
      const script = await scriptModel.getScript(req.params.id);
      if (!script) {
        return res.status(404).json({ error: 'Script not found' });
      }
      res.json(script);
    } catch (error) {
      req.logger.error('Error getting script', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  createScript: async (req, res) => {
    try {
      const { user_id, title, status, content } = req.body;
      
      if (!user_id || !title) {
        return res.status(400).json({ error: 'User ID and title are required' });
      }

      const script = await scriptModel.createScript({
        user_id,
        title,
        status: status || 'draft',
        version_number: 1,
        content: content || JSON.stringify({
          content: '',
          format: 'plain',
          pageCount: 1,
          chapters: [],
          metadata: {
            lastModified: new Date().toISOString(),
            formatVersion: '1.0'
          }
        })
      });

      res.status(201).json(script);
    } catch (error) {
      req.logger.error('Error creating script', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  updateScript: async (req, res) => {
    try {
      const { title, status, content, version_number } = req.body;

      // Validate required fields
      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }

      // Validate content format
      if (typeof content === 'string' && content.includes('</')) {
        const validTags = ['header', 'action', 'speaker', 'dialog', 'parenthetical', 'transition'];
        const tagPattern = /<(\w+)>.*?<\/\1>/g;
        const matches = content.match(tagPattern);

        if (!matches) {
          return res.status(400).json({ error: 'Content must contain valid script elements' });
        }

        const invalidTags = matches
          .map(match => match.match(/<(\w+)>/)[1])
          .filter(tag => !validTags.includes(tag));

        if (invalidTags.length > 0) {
          return res.status(400).json({
            error: `Invalid script elements: ${invalidTags.join(', ')}`
          });
        }
      }

      const script = await scriptModel.updateScript(req.params.id, {
        title,
        content,
        status,
        version_number: version_number || 1,
        updated_at: new Date().toISOString()
      });

      if (!script) {
        return res.status(404).json({ error: 'Script not found' });
      }

      res.json(script);
    } catch (error) {
      req.logger.error('Error updating script', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
```

### Chat Controller

The `ChatController` handles AI chat functionality:

```javascript
const chatController = {
  sendMessage: async (req, res) => {
    try {
      const { prompt, scriptId, context } = req.body;
      const userId = req.user.id;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      // Get script context if provided
      let scriptContext = null;
      if (scriptId && context?.includeScript) {
        scriptContext = await scriptModel.getScript(scriptId);
      }

      // Get chat history if requested
      let chatHistory = [];
      if (context?.includeHistory) {
        chatHistory = await conversationModel.getChatHistory(userId, scriptId);
      }

      // Generate AI response
      const aiResponse = await req.aiClient.generateCompletion({
        messages: [
          {
            role: 'system',
            content: 'You are a helpful script writing assistant. Provide creative and constructive feedback on scripts.'
          },
          ...chatHistory.map(msg => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.content
          })),
          {
            role: 'user',
            content: scriptContext 
              ? `Script context:\n${scriptContext.content}\n\nUser prompt: ${prompt}`
              : prompt
          }
        ]
      });

      if (!aiResponse.success) {
        return res.status(500).json({ error: 'AI service unavailable' });
      }

      // Save chat messages
      await conversationModel.saveChatMessage({
        user_id: userId,
        script_id: scriptId,
        content: prompt,
        type: 'user'
      });

      await conversationModel.saveChatMessage({
        user_id: userId,
        script_id: scriptId,
        content: aiResponse.data.choices[0].message.content,
        type: 'assistant'
      });

      res.json({
        response: aiResponse.data.choices[0].message.content,
        usage: aiResponse.data.usage,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      req.logger.error('Error processing chat message', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getHistory: async (req, res) => {
    try {
      const userId = req.user.id;
      const scriptId = req.query.script_id;

      const history = await conversationModel.getChatHistory(userId, scriptId);
      res.json(history);
    } catch (error) {
      req.logger.error('Error getting chat history', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
```

## AI Integration

### AI Client

The `AIClient` provides OpenAI integration with retry logic and monitoring:

```javascript
class AIClient {
  constructor(options = {}) {
    this.aiConfig = config.getAIConfig();
    this.logger = logger.child({ context: 'AIClient' });

    this.client = new OpenAI({
      apiKey: this.aiConfig.apiKey,
      timeout: this.aiConfig.timeout,
      maxRetries: this.aiConfig.maxRetries
    });

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      averageResponseTime: 0
    };
  }

  async generateCompletion(params, options = {}) {
    const startTime = Date.now();
    const maxRetries = options.maxRetries || this.aiConfig.maxRetries;
    let lastError;

    this.metrics.totalRequests++;
    this.metrics.lastRequestTime = new Date().toISOString();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const completion = await this.client.chat.completions.create({
          model: this.aiConfig.model,
          messages: params.messages,
          max_tokens: this.aiConfig.maxTokens,
          temperature: this.aiConfig.temperature,
          ...params
        });

        const responseTime = Date.now() - startTime;
        this._updateMetrics(completion, responseTime, true);

        return {
          success: true,
          data: completion,
          metrics: {
            tokens: completion.usage?.total_tokens || 0,
            cost: this._calculateCost(completion),
            responseTime
          }
        };

      } catch (error) {
        lastError = error;
        this.metrics.failedRequests++;

        if (this._isRetryableError(error) && attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt - 1);
          await this._sleep(delay);
          continue;
        }

        return {
          success: false,
          error: this._mapError(error),
          metrics: { tokens: 0, cost: 0, responseTime: Date.now() - startTime }
        };
      }
    }
    throw lastError;
  }

  async healthCheck() {
    try {
      const response = await this.client.models.list();
      return Array.isArray(response.data);
    } catch (error) {
      this.logger.error('AI health check failed', { error: error.message });
      return false;
    }
  }
}
```

### LangChain Integration

The system uses LangChain for complex AI workflows:

```javascript
// controllers/langchain/ChainRegistry.js
class ChainRegistry {
  constructor() {
    this.chains = new Map();
  }

  register(intent, ChainClass, config = {}) {
    this.chains.set(intent, { ChainClass, config });
  }

  async execute(intent, input) {
    const chainConfig = this.chains.get(intent);
    if (!chainConfig) {
      throw new Error(`Chain not found: ${intent}`);
    }

    const chain = new chainConfig.ChainClass(chainConfig.config);
    return await chain.execute(input);
  }
}

// controllers/langchain/chains/BaseChain.js
class BaseChain {
  constructor(config) {
    this.config = config;
    this.aiClient = new AIClient();
  }

  async execute(input) {
    throw new Error('execute method must be implemented');
  }

  async generateResponse(messages) {
    return await this.aiClient.generateCompletion({ messages });
  }
}
```

## Middleware

### Security Middleware

The `SecurityMiddleware` provides comprehensive security features:

```javascript
class SecurityMiddleware {
  constructor() {
    this.rateLimitStore = new Map();
  }

  getAllSecurityMiddleware() {
    return [
      this.corsMiddleware(),
      this.helmetMiddleware(),
      this.rateLimitMiddleware(),
      this.requestSizeLimitMiddleware(),
      this.securityHeadersMiddleware(),
      this.inputValidationMiddleware()
    ];
  }

  corsMiddleware() {
    return cors({
      origin: config.get('CORS_ORIGINS').split(','),
      credentials: config.get('CORS_CREDENTIALS'),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID']
    });
  }

  rateLimitMiddleware() {
    return (req, res, next) => {
      const key = req.ip;
      const now = Date.now();
      const windowMs = config.get('RATE_LIMIT_WINDOW');
      const maxRequests = config.get('RATE_LIMIT_MAX');

      if (!this.rateLimitStore.has(key)) {
        this.rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
        return next();
      }

      const record = this.rateLimitStore.get(key);
      
      if (now > record.resetTime) {
        record.count = 1;
        record.resetTime = now + windowMs;
        return next();
      }

      if (record.count >= maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil((record.resetTime - now) / 1000)
        });
      }

      record.count++;
      next();
    };
  }

  inputValidationMiddleware() {
    return (req, res, next) => {
      // Validate request body against schemas
      const validationSchemas = {
        '/api/scripts': ValidationSchemas.script.create,
        '/api/chat/message': ValidationSchemas.chat.message
      };

      const schema = validationSchemas[req.path];
      if (schema) {
        const result = schema.safeParse(req.body);
        if (!result.success) {
          return res.status(422).json({
            error: 'Validation failed',
            details: result.error.errors
          });
        }
        req.body = result.data;
      }

      next();
    };
  }
}
```

### Authentication Middleware

The authentication middleware handles user sessions:

```javascript
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies.sessionToken;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await userModel.validateSession(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    req.user = user;
    req.sessionToken = token;
    next();
  } catch (error) {
    req.logger.error('Authentication error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
};

const authorize = (resource, action) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const resourceId = req.params.id;

      // Check if user owns the resource
      if (resource === 'script') {
        const script = await scriptModel.getScript(resourceId);
        if (!script || script.user_id !== userId) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      next();
    } catch (error) {
      req.logger.error('Authorization error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};
```

## Health Monitoring

### Health Controller

The `HealthController` provides system health monitoring:

```javascript
class HealthController {
  constructor({ dbPool, aiClient }) {
    this.dbPool = dbPool;
    this.aiClient = aiClient;
  }

  async health(req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: config.get('NODE_ENV')
      };

      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async readiness(req, res) {
    try {
      const checks = {
        database: await this._checkDatabase(),
        ai: await this._checkAI(),
        memory: this._checkMemory(),
        disk: this._checkDisk()
      };

      const isReady = Object.values(checks).every(check => check.status === 'healthy');

      res.status(isReady ? 200 : 503).json({
        status: isReady ? 'ready' : 'not ready',
        checks,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        status: 'not ready',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async metrics(req, res) {
    try {
      const metrics = {
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage()
        },
        database: this.dbPool.getMetrics(),
        ai: this.aiClient.getMetrics(),
        timestamp: new Date().toISOString()
      };

      res.json(metrics);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to collect metrics',
        timestamp: new Date().toISOString()
      });
    }
  }
}
```

## Error Handling

### Global Error Handler

The server includes comprehensive error handling:

```javascript
// Global error handler
app.use((error, req, res, next) => {
  req.logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method
  });

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
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.fatal('Unhandled promise rejection', {
    reason: reason?.message || reason,
    promise: promise.toString()
  });
  process.exit(1);
});
```

## Logging

### Structured Logging

The application uses Pino for structured logging:

```javascript
// utils/logger.js
import pino from 'pino';

const logger = pino({
  level: config.get('LOG_LEVEL'),
  formatters: {
    level: (label) => ({ level: label })
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type']
      }
    }),
    res: (res) => ({
      statusCode: res.statusCode
    })
  }
});

export const requestLoggingMiddleware = (logger) => {
  return (req, res, next) => {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] || 
                         crypto.randomUUID();

    req.correlationId = correlationId;
    req.logger = logger.child({ correlationId });

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      req.logger.info('Request completed', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration
      });
    });

    next();
  };
};
```

## Testing

### Test Structure

Tests are organized by component:

```
__tests__/
├── controllers/        # Controller tests
├── models/            # Model tests
├── services/          # Service tests
├── middleware/        # Middleware tests
├── db/               # Database tests
└── utils/            # Utility tests
```

### Test Example

```javascript
// __tests__/controllers/scriptController.test.js
describe('ScriptController', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      params: { id: '1' },
      body: { title: 'Test Script', content: '<action>Test content</action>' },
      user: { id: 1 },
      logger: { error: jest.fn() }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  test('should get script successfully', async () => {
    const mockScript = { id: 1, title: 'Test Script' };
    scriptModel.getScript = jest.fn().mockResolvedValue(mockScript);

    await scriptController.getScript(mockReq, mockRes);

    expect(scriptModel.getScript).toHaveBeenCalledWith('1');
    expect(mockRes.json).toHaveBeenCalledWith(mockScript);
  });

  test('should return 404 for non-existent script', async () => {
    scriptModel.getScript = jest.fn().mockResolvedValue(null);

    await scriptController.getScript(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Script not found' });
  });
});
```

## Deployment

### Environment Configuration

The application supports multiple environments:

```bash
# Development
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_NAME=scriptpal_dev

# Production
NODE_ENV=production
PORT=80
DB_HOST=production-db
DB_NAME=scriptpal_prod
OPENAI_API_KEY=sk-...
```

### Docker Support

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

This backend architecture provides a robust, scalable foundation for the ScriptPal application with comprehensive security, monitoring, and AI integration capabilities.
