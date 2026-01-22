# ScriptPal Database Documentation

## Overview

The ScriptPal database is built on MySQL with a normalized schema designed to support script management, user authentication, AI chat functionality, and comprehensive data tracking. The database layer includes connection pooling, health monitoring, and optimized query patterns.

## Database Schema

### Core Tables

#### Users Table
```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Scripts Table
```sql
CREATE TABLE scripts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  version_number INT DEFAULT 1,
  title VARCHAR(255) NOT NULL,
  status ENUM('draft','in_progress','complete') DEFAULT 'draft',
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY user_id (user_id),
  KEY updated_at (updated_at)
);
```

#### Chat History Table
```sql
CREATE TABLE chat_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  script_id INT DEFAULT NULL,
  content TEXT NOT NULL,
  type ENUM('user','assistant') NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY user_id (user_id),
  KEY script_id (script_id),
  KEY timestamp (timestamp)
);
```

#### Sessions Table
```sql
CREATE TABLE sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_token (token(32))
);
```

### Supporting Tables

#### Script Elements Table
```sql
CREATE TABLE script_elements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  script_id INT NOT NULL,
  type ENUM('section', 'chapter', 'act','beat','location','character','theme','plot','opening','ending','style','climax','resolution','conflict','tone','genre') NOT NULL,
  subtype VARCHAR(100) DEFAULT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY script_id (script_id),
  KEY type (type)
);
```

#### Personas Table
```sql
CREATE TABLE personas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  description TEXT NOT NULL,
  script_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### Chat Messages Table
```sql
CREATE TABLE chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  script_id INT DEFAULT NULL,
  session_id INT DEFAULT NULL,
  role ENUM('user', 'assistant') NOT NULL,
  user_prompt TEXT NOT NULL,
  system_prompt TEXT DEFAULT NULL,
  assistant_response TEXT DEFAULT NULL,
  model VARCHAR(50) DEFAULT NULL,
  intent VARCHAR(50) DEFAULT NULL,
  function_call JSON DEFAULT NULL,
  raw_openai_response JSON DEFAULT NULL,
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  cost_usd DECIMAL(10, 6) DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (user_id),
  INDEX (script_id),
  INDEX (session_id),
  INDEX (created_at)
);
```

## Data Models

### User Model
```javascript
// models/user.js
const userModel = {
  getUser: async (id) => {
    return await db.getUser(id);
  },

  createUser: async (user) => {
    return await db.createUser(user);
  },

  login: async (email) => {
    let user = await db.getUserByEmail(email);
    
    if (!user) {
      user = await db.createUser({ email });
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const session = await db.createSession(user.id, sessionToken);
    
    return { ...user, sessionToken };
  },

  validateSession: async (sessionToken) => {
    const session = await db.getSession(sessionToken);
    if (!session) return null;
    return await db.getUser(session.user_id);
  }
};
```

### Script Model
```javascript
// models/script.js
const scriptModel = {
  getScript: async (id) => {
    return await db.getScript(id);
  },

  createScript: async (script) => {
    return await db.createScript(script);
  },

  updateScript: async (id, script) => {
    return await db.updateScript(id, script);
  },

  getAllScriptsByUser: async (user_id) => {
    return await db.getAllScriptsByUser(user_id);
  },

  getScriptProfile: async (id) => {
    const script = await db.getScript(id);
    if (!script) return null;

    const elements = await db.getScriptElements(id);
    const personas = await db.getScriptPersonas(id);
    const conversations = await db.getScriptConversations(id);

    return { ...script, elements, personas, conversations };
  }
};
```

## Database Operations

### Connection Pool Management
```javascript
// db/ConnectionPool.js
class ConnectionPool {
  constructor() {
    this.pool = null;
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      totalQueries: 0,
      failedQueries: 0,
      averageQueryTime: 0
    };
  }

  async initialize() {
    this.pool = mysql.createPool({
      host: config.get('DB_HOST'),
      port: config.get('DB_PORT'),
      user: config.get('DB_USER'),
      password: config.get('DB_PASSWORD'),
      database: config.get('DB_NAME'),
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: config.get('DB_CONNECTION_LIMIT'),
      queueLimit: 0,
      idleTimeout: 300000,
      maxIdle: 10,
      enableKeepAlive: true
    });
  }

  async query(query, params = [], options = {}) {
    const maxRetries = options.maxRetries || 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await this.pool.execute(query, params);
        const queryTime = Date.now() - startTime;

        this.metrics.totalQueries++;
        this._updateAverageQueryTime(queryTime);
        return result;
      } catch (error) {
        if (this._isRetryableError(error) && attempt < maxRetries) {
          await this._sleep(1000 * Math.pow(2, attempt - 1));
          continue;
        }
        throw error;
      }
    }
  }
}
```

### Database Wrapper
```javascript
// db/index.js
const db = {
  // User operations
  getUser: async (id) => {
    const rows = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0];
  },

  getUserByEmail: async (email) => {
    const rows = await db.query('SELECT * FROM users WHERE email = ?', [email]);
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
  },

  // Session operations
  createSession: async (userId, sessionToken) => {
    const result = await db.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 14 DAY))',
      [userId, sessionToken]
    );
    return { id: result.insertId, user_id: userId, token: sessionToken };
  },

  getSession: async (sessionToken) => {
    const rows = await db.query(
      'SELECT * FROM sessions WHERE token = ? AND expires_at > NOW()',
      [sessionToken]
    );
    return rows[0];
  },

  deleteSession: async (sessionToken) => {
    const result = await db.query('DELETE FROM sessions WHERE token = ?', [sessionToken]);
    return result.affectedRows > 0;
  }
};
```

## Data Relationships

### Entity Relationships
- **Users** → **Scripts** (One-to-Many)
- **Users** → **Chat History** (One-to-Many)
- **Scripts** → **Script Elements** (One-to-Many)
- **Scripts** → **Personas** (One-to-Many)
- **Users** → **Sessions** (One-to-Many)

### Foreign Key Constraints
```sql
-- Sessions reference users
ALTER TABLE sessions ADD FOREIGN KEY (user_id) REFERENCES users(id);

-- Script elements reference scripts
ALTER TABLE script_elements ADD FOREIGN KEY (script_id) REFERENCES scripts(id);

-- Personas reference scripts and users
ALTER TABLE personas ADD FOREIGN KEY (script_id) REFERENCES scripts(id);
ALTER TABLE personas ADD FOREIGN KEY (user_id) REFERENCES users(id);
```

## Performance Optimizations

### Indexing Strategy
```sql
-- Primary indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_scripts_user_id ON scripts(user_id);
CREATE INDEX idx_scripts_updated_at ON scripts(updated_at);
CREATE INDEX idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX idx_chat_history_script_id ON chat_history(script_id);
CREATE INDEX idx_sessions_token ON sessions(token(32));
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Composite indexes
CREATE INDEX idx_chat_history_user_script ON chat_history(user_id, script_id);
CREATE INDEX idx_scripts_user_updated ON scripts(user_id, updated_at);
```

### Query Optimization
```javascript
// Optimized script loading with pagination
const getScriptsWithPagination = async (userId, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  return await db.query(
    'SELECT * FROM scripts WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?',
    [userId, limit, offset]
  );
};

// Optimized chat history loading
const getChatHistoryOptimized = async (userId, scriptId, limit = 50) => {
  return await db.query(
    'SELECT * FROM chat_history WHERE user_id = ? AND script_id = ? ORDER BY timestamp DESC LIMIT ?',
    [userId, scriptId, limit]
  );
};
```

## Data Validation

### Input Validation
```javascript
// Script content validation
const validateScriptContent = (content) => {
  if (typeof content !== 'string') return false;
  
  // Check for valid XML tags
  const validTags = ['header', 'action', 'speaker', 'dialog', 'directions', 'chapter-break'];
  const tagPattern = /<(\w+)>.*?<\/\1>/g;
  const matches = content.match(tagPattern);
  
  if (!matches) return false;
  
  const invalidTags = matches
    .map(match => match.match(/<(\w+)>/)[1])
    .filter(tag => !validTags.includes(tag));
  
  return invalidTags.length === 0;
};

// User input validation
const validateUserInput = (user) => {
  const schema = Joi.object({
    email: Joi.string().email().max(254).required(),
    name: Joi.string().min(1).max(100).optional()
  });
  
  return schema.validate(user);
};
```

## Backup and Recovery

### Backup Strategy
```sql
-- Full database backup
mysqldump -u username -p scriptpal > scriptpal_backup.sql

-- Incremental backup (binary logs)
mysqlbinlog --start-datetime="2024-01-01 00:00:00" mysql-bin.000001 > incremental_backup.sql
```

### Recovery Procedures
```sql
-- Restore from full backup
mysql -u username -p scriptpal < scriptpal_backup.sql

-- Point-in-time recovery
mysqlbinlog --start-datetime="2024-01-01 00:00:00" --stop-datetime="2024-01-01 12:00:00" mysql-bin.000001 | mysql -u username -p
```

## Monitoring and Maintenance

### Health Monitoring
```javascript
// Database health check
const checkDatabaseHealth = async () => {
  try {
    const startTime = Date.now();
    await db.query('SELECT 1');
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      responseTime,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};
```

### Performance Metrics
```javascript
// Query performance tracking
const trackQueryPerformance = (query, duration, success) => {
  const metrics = {
    query: query.substring(0, 100), // Truncate for logging
    duration,
    success,
    timestamp: new Date().toISOString()
  };
  
  logger.info('Query performance', metrics);
};
```

## Security Considerations

### SQL Injection Prevention
- All queries use parameterized statements
- Input validation before database operations
- Escaping of user inputs

### Access Control
- User-scoped data access
- Session-based authentication
- Role-based permissions

### Data Encryption
- Sensitive data encryption at rest
- Secure session token generation
- HTTPS for data in transit

This database architecture provides a robust, scalable foundation for the ScriptPal application with comprehensive data management, performance optimization, and security features.
