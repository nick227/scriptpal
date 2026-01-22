# ScriptPal Architecture Documentation

## System Architecture Overview

ScriptPal follows a modern, modular architecture with clear separation of concerns between frontend, backend, and data layers. The system is designed for scalability, maintainability, and extensibility.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Browser)                       │
├─────────────────────────────────────────────────────────────┤
│  ScriptPal App  │  Widgets  │  Managers  │  Core Services  │
│  - Main Orchestrator │  - Editor │  - Script │  - Events    │
│  - Initialization    │  - Chat   │  - Sync   │  - State     │
│  - Component Coord   │  - Auth   │  - Orchestrator │  - API │
└─────────────────────────────────────────────────────────────┘
                                │
                                │ HTTP/REST API
                                │
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js)                        │
├─────────────────────────────────────────────────────────────┤
│  Express Server  │  Controllers  │  Services  │  Middleware │
│  - Route Handling │  - Script     │  - AI      │  - Security│
│  - Middleware     │  - User       │  - Database│  - Auth    │
│  - Error Handling │  - Chat       │  - Logging │  - CORS    │
└─────────────────────────────────────────────────────────────┘
                                │
                                │ SQL Queries
                                │
┌─────────────────────────────────────────────────────────────┐
│                    Database (MySQL)                         │
├─────────────────────────────────────────────────────────────┤
│  Users  │  Scripts  │  Chat History  │  Sessions  │  Elements│
│  - Auth │  - Content│  - Messages    │  - Tokens  │  - Meta  │
│  - Profile│  - Versions│  - Context   │  - Expiry  │  - Types │
└─────────────────────────────────────────────────────────────┘
                                │
                                │ API Calls
                                │
┌─────────────────────────────────────────────────────────────┐
│                    External Services                        │
├─────────────────────────────────────────────────────────────┤
│  OpenAI API  │  LangChain    │  Monitoring  │  File Storage│
│  - GPT Models│  - Chains     │  - Logs      │  - Assets    │
│  - Completions│  - Prompts   │  - Metrics   │  - Backups   │
└─────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Core Application Structure

```javascript
// Main Application Class
class ScriptPal {
  constructor() {
    this.api = new ScriptPalAPI();
    this.user = new ScriptPalUser(this.api);
    this.ui = new ScriptPalUI();
    this.editor = new EditorWidget();
    this.chat = new ChatIntegration();
    this.scriptManager = new ScriptManager();
    this.scriptOrchestrator = new ScriptOrchestrator();
  }
}
```

### Widget-Based UI System

The frontend uses a widget-based architecture where each major UI component is encapsulated:

- **EditorWidget**: Handles script editing with format-aware functionality
- **ChatIntegration**: Wires the modern chat UI to the shared ChatManager
- **AuthWidget**: Handles user authentication and session management
- **BaseWidget**: Common functionality for all widgets

### Manager Pattern

Managers handle business logic and coordinate between components:

- **ScriptManager**: Script CRUD operations and caching
- **ScriptOrchestrator**: Coordinates script loading and UI updates
- **ScriptSyncService**: Handles auto-save and synchronization
- **EventManager**: Centralized event handling
- **StateManager**: Application state management

### Core Services

- **ScriptPalAPI**: HTTP client with error handling and retries
- **ScriptFormatter**: Script format validation and transformation
- **RendererFactory**: DOM rendering with performance optimization

## Backend Architecture

### Server Structure

```javascript
class ScriptPalServer {
  constructor() {
    this.app = express();
    this.dbPool = new ConnectionPool();
    this.aiClient = new AIClient();
    this.securityMiddleware = new SecurityMiddleware();
  }
}
```

### Layered Architecture

1. **Presentation Layer**: Express.js routes and controllers
2. **Business Logic Layer**: Services and domain logic
3. **Data Access Layer**: Models and database operations
4. **Infrastructure Layer**: External services and utilities

### Controller Pattern

Controllers handle HTTP requests and delegate to services:

- **ScriptController**: Script CRUD operations
- **UserController**: User authentication and management
- **ChatController**: AI chat functionality
- **HealthController**: System health and monitoring

### Service Layer

Services contain business logic and coordinate between layers:

- **AIClient**: OpenAI API integration with retry logic
- **ConnectionPool**: Database connection management
- **SecurityMiddleware**: Input validation and security

## Data Architecture

### Database Schema

The database uses a normalized schema with the following key entities:

```sql
-- Core Entities
users (id, email, created_at)
scripts (id, user_id, title, content, version_number, status, timestamps)
chat_history (id, user_id, script_id, content, type, timestamp)
sessions (id, user_id, token, expires_at)

-- Supporting Entities
script_elements (id, script_id, type, subtype, content)
personas (id, script_id, description)
chat_messages (id, user_id, script_id, role, content, metadata)
```

### Data Flow Patterns

1. **Read Operations**: Connection Pool → Query → Result Set → JSON Response
2. **Write Operations**: Validation → Transaction → Commit → Response
3. **Caching**: Frontend caches script data, backend uses connection pooling

## AI Integration Architecture

### LangChain Integration

The system uses LangChain for AI workflow management:

```javascript
// Chain Registry Pattern
class ChainRegistry {
  register(intent, ChainClass, config) {
    this.chains.set(intent, { ChainClass, config });
  }
  
  execute(intent, input) {
    const chain = this.chains.get(intent);
    return new chain.ChainClass(chain.config).execute(input);
  }
}
```

### AI Service Architecture

- **Prompt Engineering**: Structured prompts with script context
- **Response Validation**: JSON schema validation for AI responses
- **Error Handling**: Retry logic and fallback mechanisms
- **Cost Tracking**: Token usage and cost monitoring

## Security Architecture

### Multi-Layer Security

1. **Input Validation**: Zod schemas for all inputs
2. **Authentication**: Session-based auth with secure tokens
3. **Authorization**: User-scoped data access
4. **Rate Limiting**: Request throttling and abuse prevention
5. **CORS**: Cross-origin request security
6. **SQL Injection Prevention**: Parameterized queries

### Security Middleware Stack

```javascript
// Security Middleware Chain
app.use(helmet());                    // Security headers
app.use(cors(corsOptions));           // CORS configuration
app.use(rateLimit(rateLimitOptions)); // Rate limiting
app.use(validateInput(schema));       // Input validation
app.use(authenticate);                // Authentication
app.use(authorize);                   // Authorization
```

## Event-Driven Architecture

### Frontend Event System

```javascript
// Event Manager Pattern
class EventManager {
  publish(event, data) {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }
  
  subscribe(event, callback) {
    this.listeners.set(event, [...(this.listeners.get(event) || []), callback]);
  }
}
```

### Event Types

- **Script Events**: SELECTED, UPDATED, DELETED, VERSION_CONFLICT
- **UI Events**: CHAT_TOGGLED, EDITOR_FOCUSED, SAVE_COMPLETED
- **System Events**: ERROR, LOADING_STATE_CHANGED, NETWORK_STATUS

## Performance Architecture

### Frontend Optimizations

- **Virtual Scrolling**: Efficient rendering of large scripts
- **Debounced Auto-save**: Reduces server load
- **Component Lazy Loading**: On-demand component initialization
- **Event Batching**: Reduces DOM updates

### Backend Optimizations

- **Connection Pooling**: Efficient database connections
- **Query Optimization**: Indexed queries and prepared statements
- **Caching**: Response caching where appropriate
- **Compression**: Gzip compression for responses

### Database Optimizations

- **Indexing**: Strategic indexes on frequently queried columns
- **Connection Pooling**: Reuse database connections
- **Query Optimization**: Efficient SQL with proper joins
- **Transaction Management**: ACID compliance with rollback support

## Monitoring and Observability

### Logging Architecture

```javascript
// Structured Logging
logger.info('Script updated', {
  scriptId: 123,
  userId: 456,
  contentLength: 1500,
  version: 2,
  correlationId: 'req-789'
});
```

### Metrics Collection

- **Application Metrics**: Request counts, response times, error rates
- **Database Metrics**: Connection pool stats, query performance
- **AI Metrics**: Token usage, cost tracking, response times
- **System Metrics**: Memory usage, CPU utilization

### Health Monitoring

- **Health Endpoints**: `/health`, `/ready`, `/live`
- **Dependency Checks**: Database connectivity, AI service status
- **Performance Monitoring**: Response time tracking, error rate monitoring

## Scalability Considerations

### Horizontal Scaling

- **Stateless Design**: No server-side session storage
- **Database Scaling**: Read replicas and connection pooling
- **Load Balancing**: Multiple server instances
- **CDN Integration**: Static asset delivery

### Vertical Scaling

- **Connection Pooling**: Efficient resource utilization
- **Memory Management**: Garbage collection optimization
- **CPU Optimization**: Async/await patterns
- **I/O Optimization**: Non-blocking operations

## Development Architecture

### Code Organization

```
frontend/
├── js/
│   ├── app.js              # Main application
│   ├── classes/            # Core classes
│   ├── managers/           # Business logic managers
│   ├── widgets/            # UI components
│   ├── core/               # Core services
│   └── services/           # Utility services

backend/
├── server.js               # Main server
├── controllers/            # HTTP controllers
├── models/                 # Data models
├── services/               # Business services
├── middleware/             # Express middleware
└── db/                     # Database layer
```

### Testing Architecture

- **Unit Tests**: Individual component testing
- **Integration Tests**: API endpoint testing
- **Contract Tests**: Frontend-backend interface validation
- **E2E Tests**: Full user workflow testing

This architecture provides a solid foundation for a scalable, maintainable AI-powered script writing application with modern development practices and comprehensive quality assurance.
