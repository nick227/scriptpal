# Chat System Analysis - ScriptPal

## Executive Summary

This document provides a comprehensive analysis of how the ScriptPal screenplay writing assistant handles AI chat messages, from the frontend user interaction through the backend processing and OpenAI API integration.

## System Architecture Overview

```
┌─────────────────┐
│   Frontend UI   │
│  (User Input)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ChatManager    │──► Manages UI state & message rendering
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   ScriptPal     │──► Handles HTTP requests
│      API        │    (with script context)
└────────┬────────┘
         │
         ▼ POST /api/chat
┌─────────────────┐
│ chatController  │──► Entry point & validation
│   (Express)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Chat Class    │──► Orchestrates chat flow
└────────┬────────┘
         │
         ├──► IntentClassifier ──► Determines user intent
         │
         ├──► ChainHandler ──► Routes to appropriate chain
         │
         └──► ChatHistoryManager ──► Persists conversations
```

## Detailed Flow Analysis

### 1. Frontend Layer

#### 1.1 User Interaction (`ChatManager.js`)
**Location:** `public/js/widgets/chat/core/ChatManager.js`

**Key Responsibilities:**
- Process user input and button clicks
- Manage message rendering
- Handle loading states
- Process AI responses
- Extract and display follow-up questions

**Core Methods:**

```javascript
// User sends a message
async handleSend(message) {
    // 1. Validate message
    // 2. Render user message
    // 3. Save to chat history
    // 4. Get API response with timeout (30s)
    // 5. Process and render AI response
    // 6. Handle script operations based on intent
}
```

**Message Processing Pipeline:**
1. `validateSendConditions()` - Ensures renderer, API, and message are valid
2. `processAndRenderMessage()` - Parses and displays message
3. `getApiResponseWithTimeout()` - Calls API with script context
4. `handleScriptOperations()` - Executes intent-specific actions

#### 1.2 API Client (`api.js`)
**Location:** `public/js/classes/api.js`

**Key Features:**
- Cookie-based authentication
- Request timeout handling (30s default)
- Retry logic for failed requests
- Script context enrichment
- Correlation ID tracking

**Chat Request Method:**
```javascript
async getChatResponse(content, context = {}) {
    // 1. Get current script from localStorage
    const scriptId = localStorage.getItem('currentScriptId');
    const scriptTitle = localStorage.getItem('currentScriptTitle');
    
    // 2. Build enhanced context
    const enhancedContext = {
        scriptId,
        scriptTitle,
        scriptVersion,
        timestamp: new Date().toISOString(),
        ...context
    };
    
    // 3. Send POST request to /api/chat
    return this._makeRequest(API_ENDPOINTS.CHAT, 'POST', {
        prompt: content,
        context: enhancedContext
    });
}
```

**Request Headers:**
- `Content-Type: application/json`
- `X-Correlation-ID: req_{timestamp}_{random}`
- `credentials: 'include'` (for cookies)

### 2. Backend Layer

#### 2.1 HTTP Router (`routes.js`)
**Location:** `server/routes.js`

**Chat Endpoints:**
```javascript
{
    path: '/chat',
    method: 'post',
    handler: chatController.startChat,
    middleware: [validateSession]
}
```

**Authentication Flow:**
- `validateSession` middleware checks for valid session cookie
- Extracts `userId` from session
- Attaches to `req.userId` for downstream use

#### 2.2 Chat Controller (`chatController.js`)
**Location:** `server/controllers/chatController.js`

**Primary Endpoint: `startChat()`**

**Request Validation:**
```javascript
// 1. Check for prompt
if (!req.body.prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
}

// 2. Extract and validate scriptId
const context = req.body.context || {};
let scriptId = parseInt(req.body.scriptId || context.scriptId, 10);
if (isNaN(scriptId)) {
    return res.status(400).json({ error: 'Invalid script ID' });
}
```

**Processing Flow:**
```javascript
// 1. Create Chat instance
const chat = new Chat(req.userId, scriptId);

// 2. Process message (main orchestration)
const result = await chat.processMessage(req.body.prompt, context);

// 3. Return standardized response
res.status(200).json(result);
```

**Error Handling:**
- `handleChatError()` - Maps errors to appropriate HTTP status codes
- Returns structured error responses with details
- Handles: Invalid format, script not found, invalid intent, chain failures

#### 2.3 Chat Class (`Chat.js`)
**Location:** `server/controllers/chat/Chat.js`

**Core Orchestration:**

```javascript
async processMessage(prompt, context = {}) {
    // 1. Classify user intent
    const intentResult = await this.classifier.classify(prompt);
    
    // 2. Get script details if scriptId exists
    const script = this.scriptId 
        ? await this.scriptManager.getScript(this.scriptId) 
        : { content: '', title: '', ... };
    
    // 3. Create and execute chain handler
    const handler = new ChainHandler(this.userId, this.scriptId, intentResult);
    const response = await handler.execute(script, prompt, context);
    
    // 4. Save chat history (non-blocking)
    this.historyManager.saveInteraction(prompt, response, this.scriptId)
        .catch(error => console.error('Chat history save failed:', error));
    
    // 5. Format and return response
    return this.formatResponse(response, intentResult);
}
```

**Response Format:**
```javascript
{
    success: true,
    intent: "EDIT_SCRIPT" | "WRITE_SCRIPT" | "SCRIPT_QUESTIONS" | etc.,
    confidence: 0.0-1.0,
    target: null | string,
    value: null | string,
    scriptId: number,
    scriptTitle: string,
    timestamp: ISO8601 string,
    response: {
        response: string,
        questions: [array of follow-up questions],
        metadata: { ... }
    }
}
```

### 3. AI Integration Layer

#### 3.1 Intent Classification

**IntentClassifier** (`langchain/classifier/index.js`)
- Wraps the `classifyIntent` chain
- Single responsibility: determine user intent

**ClassifyIntent Chain** (`langchain/chains/system/classifyIntent.js`)

**AI Model Configuration:**
```javascript
const model = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    temperature: 0.3
});
```

**Intent Types:**
1. `EDIT_SCRIPT` - Modify existing script content
2. `WRITE_SCRIPT` - Add new content to script
3. `SCRIPT_QUESTIONS` - Discussion about the script
4. `SAVE_ELEMENT` - Save story elements/concepts
5. `EVERYTHING_ELSE` - General queries

**Processing Chain:**
```javascript
const chain = promptTemplate
    .pipe(model)          // OpenAI API call
    .pipe(outputParser)   // Parse response string
    .pipe(processResponse); // Validate & normalize
```

**Prompt Template:**
```
You are an intent classifier for a script writing assistant.
Classify the user prompt into one of the 5 commands...

START USER PROMPT:
{text}
END USER PROMPT

Return the intent string only.
```

**Output:**
```javascript
{
    intent: "WRITE_SCRIPT",
    confidence: 1.0,
    target: null,
    value: null
}
```

#### 3.2 Chain Routing

**ChainHandler** (`controllers/chat/handlers/ChainHandler.js`)

**Context Preparation:**
```javascript
prepareContext(script) {
    return {
        userId,
        scriptId,
        intent,
        scriptContent: script.content,
        scriptTitle: script.title,
        scriptMetadata: {
            lastUpdated: script.updated_at,
            version_number: script.version_number,
            status: script.status
        },
        chainConfig: {
            shouldGenerateQuestions: true/false,
            modelConfig: { temperature: 0.7, ... }
        }
    };
}
```

**Chat History Integration:**
```javascript
// Get last 3 chat messages (except for ANALYZE_SCRIPT)
const history = await this.historyManager.getHistory(3, this.scriptId);

context.chatHistory = history.map(msg => ({
    role: msg.type === 'user' ? 'user' : 'assistant',
    content: msg.content
}));
```

**Chain Execution:**
```javascript
return await router.route(this.intentResult, context, prompt);
```

**IntentRouter** (`langchain/router/index.js`)

```javascript
async route(intentResult, context, prompt) {
    const { intent } = intentResult;
    
    // Get registered chain class for intent
    const ChainClass = this.chainRegistry.getChain(intent);
    
    if (!ChainClass) {
        // Fallback to default chain
        const DefaultChainClass = this.chainRegistry.getChain('EVERYTHING_ELSE');
        return await new DefaultChainClass().run(context, prompt);
    }
    
    // Execute specific chain
    const chain = new ChainClass();
    return await chain.run(context, prompt);
}
```

#### 3.3 Chain Registry

**ChainFactory** (`langchain/chains/ChainFactory.js`)

**Registered Chains:**
```javascript
// Writing & Editing
chainRegistry.registerChain(INTENT_TYPES.WRITE_SCRIPT, WriteScriptChain);
chainRegistry.registerChain(INTENT_TYPES.EDIT_SCRIPT, EditScriptChain);

// Analysis
chainRegistry.registerChain(INTENT_TYPES.SCRIPT_QUESTIONS, ScriptQuestionsChain);
chainRegistry.registerChain(INTENT_TYPES.ANALYZE_SCRIPT, ScriptAnalyzerChain);

// Creative
chainRegistry.registerChain(INTENT_TYPES.GET_INSPIRATION, InspirationChain);

// Storage
chainRegistry.registerChain(INTENT_TYPES.SAVE_ELEMENT, SaveElementChain);

// Default
chainRegistry.registerChain(INTENT_TYPES.EVERYTHING_ELSE, DefaultChain);
```

#### 3.4 Base Chain Implementation

**BaseChain** (`langchain/chains/base/BaseChain.js`)

**OpenAI Client Initialization:**
```javascript
constructor(config) {
    this.type = config.type;
    this.temperature = config.temperature || 0.7;
    this.openai = new OpenAI(); // Uses OPENAI_API_KEY from env
    this.questionGenerator = new QuestionGenerator(this.openai);
}
```

**Execution Flow:**
```javascript
async run(context, prompt) {
    // 1. Build messages using chain-specific logic
    const messages = await this.buildMessages(context, prompt);
    
    // 2. Execute with configuration
    return this.execute(messages, context, shouldGenerateQuestions);
}

async execute(messages, metadata, shouldGenerateQuestions) {
    // 1. Add common instructions to messages
    const processedMessages = this.addCommonInstructions(messages);
    
    // 2. Build message chain (current + history)
    const allMessages = await this.buildMessageChain(processedMessages, context);
    
    // 3. Call OpenAI API
    const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: allMessages,
        temperature: this.temperature,
        max_tokens: 4000,
        ...modelConfig
    });
    
    // 4. Extract response
    const responseContent = completion.choices[0].message.content;
    
    // 5. Log to chat history
    await this.logToHistory(userId, lastUserMessage, responseContent);
    
    // 6. Generate follow-up questions (if enabled)
    const questions = await this.questionGenerator.generateQuestions(
        context, prompt, responseContent
    );
    
    // 7. Return formatted response
    return this.createResponse(responseContent, context, questions);
}
```

**Message Chain Building:**
```javascript
async buildMessageChain(currentMessages, context) {
    // System messages first
    // Then chat history (last 3 messages)
    // Then current user message
    
    return [
        ...systemMessages,
        ...chatHistory,
        ...currentUserMessages
    ];
}
```

**Chat History Logging:**
```javascript
async logToHistory(userId, lastUserMessage, assistantResponse) {
    await db.query(
        'INSERT INTO chat_history (user_id, type, content) VALUES (?, ?, ?), (?, ?, ?)',
        [userId, 'user', userMessage, userId, 'assistant', assistantResponse]
    );
}
```

#### 3.5 Specific Chain Example: WriteScriptChain

**WriteScriptChain** (`langchain/chains/edit/WriteScript.js`)

```javascript
async buildMessages(context, prompt) {
    const scriptContent = await EditScriptLoader.loadScriptContent(context.scriptId);
    return WriteScriptMessages.buildMessages(scriptContent, prompt);
}

async execute(messages, metadata) {
    // 1. Get structured commands from LLM using function calling
    const llmResponse = await this.llm.invoke(messages, {
        functions: [WriteScriptMessages.getFunctionSchema()],
        function_call: { name: 'write_script' }
    });
    
    // 2. Parse function call arguments
    const editCommands = JSON.parse(
        llmResponse.additional_kwargs.function_call.arguments
    );
    
    // 3. Apply edits to script
    const editResult = await this.versionService.applyEdits(
        scriptId, editCommands.commands, scriptContent
    );
    
    // 4. Return formatted response
    return this.createResponse({
        commands,
        results: editResult.results,
        content: editResult.content,
        message: `Successfully applied ${successfulEdits} edits`,
        version_number: editResult.script.version_number
    }, metadata);
}
```

#### 3.6 Default Chain

**DefaultChain** (`langchain/chains/base/DefaultChain.js`)

**Simple conversational AI:**
```javascript
buildMessages(context, prompt) {
    return [{
        role: 'system',
        content: `You are a helpful AI assistant for scriptwriting.
                  Provide general assistance and answer questions.
                  Keep responses focused on scriptwriting.
                  Be concise but informative.`
    }, {
        role: 'user',
        content: prompt
    }];
}
```

### 4. Chat History Management

#### 4.1 ChatHistoryManager (Backend)
**Location:** `server/controllers/chat/ChatHistoryManager.js`

```javascript
class ChatHistoryManager {
    async saveInteraction(userPrompt, assistantResponse, scriptId) {
        await Promise.all([
            db.createChatHistory(userId, userPrompt, 'user', scriptId),
            db.createChatHistory(userId, assistantResponse, 'assistant', scriptId)
        ]);
    }
    
    async getHistory(limit = 3, scriptId = null) {
        return await db.getChatHistory(userId, scriptId);
    }
    
    async clearScriptHistory(scriptId) {
        return await db.clearScriptChatHistory(scriptId);
    }
}
```

#### 4.2 ChatHistoryManager (Frontend)
**Location:** `public/js/widgets/chat/core/ChatHistoryManager.js`

- Manages in-memory chat history
- Syncs with server via API
- Supports per-script history isolation

### 5. Database Schema

**chat_history Table:**
```sql
CREATE TABLE chat_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type VARCHAR(20) NOT NULL,  -- 'user' or 'assistant'
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    script_id INT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (script_id) REFERENCES scripts(id)
);
```

## Message Flow Sequence

### Complete End-to-End Flow

```
1. USER TYPES MESSAGE
   └─► ChatManager.handleSend()

2. FRONTEND VALIDATION
   └─► validateSendConditions()
   
3. RENDER USER MESSAGE
   └─► processAndRenderMessage(message, 'user')
   
4. BUILD REQUEST CONTEXT
   └─► ScriptContextManager.getAIChatContext()
       ├─► scriptId from localStorage
       ├─► scriptTitle from localStorage
       └─► scriptVersion from localStorage

5. API REQUEST
   └─► ScriptPalAPI.getChatResponse(message, context)
       └─► POST /api/chat
           {
               prompt: "user message",
               context: {
                   scriptId: 123,
                   scriptTitle: "My Script",
                   scriptVersion: 5,
                   timestamp: "2026-01-20T..."
               }
           }

6. BACKEND RECEIVES REQUEST
   └─► routes.js → validateSession middleware
       └─► chatController.startChat()

7. CHAT ORCHESTRATION
   └─► new Chat(userId, scriptId)
       └─► chat.processMessage(prompt, context)

8. INTENT CLASSIFICATION
   └─► IntentClassifier.classify(prompt)
       └─► classifyIntent chain
           └─► OpenAI API Call #1
               Model: gpt-4-turbo-preview
               Temperature: 0.3
               Input: "Classify this prompt: {prompt}"
               Output: { intent: "WRITE_SCRIPT", confidence: 1.0 }

9. LOAD SCRIPT DATA
   └─► ScriptManager.getScript(scriptId)
       └─► Database query for script content

10. CHAIN ROUTING
    └─► ChainHandler.execute(script, prompt, context)
        └─► prepareContext() - builds full context object
        └─► getChatHistory() - loads last 3 messages
        └─► IntentRouter.route(intent, context, prompt)

11. CHAIN EXECUTION
    └─► WriteScriptChain.run(context, prompt)
        └─► buildMessages(context, prompt)
            └─► Creates system + user messages
        └─► execute(messages, metadata)
            └─► OpenAI API Call #2
                Model: gpt-4
                Temperature: 0
                Functions: [write_script function schema]
                Messages: [
                    { role: "system", content: "..." },
                    { role: "user", content: "history msg 1" },
                    { role: "assistant", content: "history msg 2" },
                    { role: "user", content: "current prompt" }
                ]
                Output: Function call with edit commands

12. PROCESS AI RESPONSE
    └─► Parse function call arguments
    └─► Apply edits to script
    └─► Generate version
    └─► Create formatted response

13. GENERATE FOLLOW-UP QUESTIONS (Optional)
    └─► QuestionGenerator.generateQuestions()
        └─► OpenAI API Call #3
            Model: gpt-4-turbo-preview
            Purpose: Generate contextual follow-up questions

14. SAVE TO CHAT HISTORY
    └─► ChatHistoryManager.saveInteraction()
        └─► INSERT INTO chat_history (user message)
        └─► INSERT INTO chat_history (assistant response)

15. RETURN TO FRONTEND
    └─► Response format:
        {
            success: true,
            intent: "WRITE_SCRIPT",
            confidence: 1.0,
            scriptId: 123,
            scriptTitle: "My Script",
            timestamp: "2026-01-20T...",
            response: {
                response: "I've added 3 new lines...",
                questions: ["Would you like...", "Should I..."],
                content: "updated script content",
                version_number: 6
            }
        }

16. FRONTEND PROCESSES RESPONSE
    └─► ChatManager.handleSend() resolves
        └─► extractResponseContent(data)
        └─► processAndRenderMessage(response, 'assistant')
        └─► processQuestionButtons(data)
        └─► handleScriptOperations(data)
            └─► scriptOrchestrator.handleScriptEdit()
                └─► Updates editor with new script content

17. RENDER TO UI
    └─► MessageRenderer.render(content, 'assistant')
    └─► ButtonRenderer.renderButtons(questions)
```

## Key Features & Patterns

### 1. Intent-Based Routing
- Every message is classified before processing
- Different chains handle different intent types
- Extensible through chain registry

### 2. Context-Aware Processing
- Script content included in AI context
- Chat history (last 3 messages) included
- Script metadata (title, version) tracked

### 3. Error Handling Strategy
```javascript
// Controller level
try {
    const result = await chat.processMessage(prompt, context);
    res.status(200).json(result);
} catch (error) {
    const errorResponse = handleChatError(error);
    res.status(errorResponse.status).json(errorResponse.body);
}

// Chain level
try {
    const completion = await this.openai.chat.completions.create(...);
    return processResponse(completion);
} catch (error) {
    console.error('Chain execution error:', error);
    throw error;
}

// Frontend level
try {
    const data = await this.getApiResponseWithTimeout(message);
    await this.processAndRenderMessage(data, 'assistant');
} catch (error) {
    this.handleError(error, 'handleSend');
    await this.safeRenderMessage(ERROR_MESSAGES.API_ERROR, 'error');
}
```

### 4. Non-Blocking Chat History
```javascript
// Save doesn't block response
this.historyManager.saveInteraction(prompt, response, scriptId)
    .catch(error => console.error('Chat history save failed:', error));
```

### 5. Timeout Management
- Frontend: 30s timeout for API requests
- Backend: 30s timeout for OpenAI calls
- Promise.race() pattern for timeout handling

### 6. Question Generation
- Automatic follow-up questions for user engagement
- Separate AI call after main response
- Contextual to current conversation
- Fallback to default questions on failure

## OpenAI API Usage Summary

### API Calls Per User Message

**Minimum: 2 calls**
1. Intent Classification
2. Main Chain Execution

**Maximum: 3 calls**
1. Intent Classification
2. Main Chain Execution
3. Question Generation (optional)

### Model Configuration

| Purpose | Model | Temperature | Max Tokens |
|---------|-------|-------------|------------|
| Intent Classification | gpt-4-turbo-preview | 0.3 | 4000 |
| Script Writing | gpt-4 | 0.0 | 4000 |
| Script Editing | gpt-4 | 0.0 | 4000 |
| Questions/Analysis | gpt-4-turbo-preview | 0.7 | 4000 |
| Default Chain | gpt-4-turbo-preview | 0.5 | 4000 |
| Question Generation | gpt-4-turbo-preview | 0.7 | 4000 |

### Rate Limiting & Retry Logic
- 3 retry attempts for network failures
- Exponential backoff: 1s, 2s, 4s
- Only retries idempotent operations (GET, PUT, DELETE)
- POST requests (including chat) are NOT retried

## Security Considerations

### Authentication
- Session-based authentication via cookies
- `validateSession` middleware on all protected routes
- User ID extracted from session, not client input

### Input Validation
```javascript
// Prompt validation
if (!req.body.prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
}

// Script ID validation
const scriptId = parseInt(req.body.scriptId, 10);
if (isNaN(scriptId)) {
    return res.status(400).json({ error: 'Invalid script ID' });
}
```

### Error Message Sanitization
- Internal errors logged but not exposed to client
- Generic error messages returned to frontend
- Correlation IDs for debugging

## Performance Optimizations

### Frontend
- Message caching with 30s expiry
- Batch operations support
- Debounced API calls
- Request deduplication

### Backend
- Non-blocking chat history saves
- Connection pooling for database
- Query result caching
- Lazy loading of script content

### API
- Correlation ID tracking
- Abort controller for request cancellation
- Request queue management
- Timeout handling

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────┐
│                     FRONTEND                              │
│                                                           │
│  User Input ──► ChatManager ──► ScriptPalAPI             │
│       │              │               │                    │
│       │              │               └─► POST /api/chat   │
│       │              │                                    │
│       │              └─► Message Rendering               │
│       │                                                   │
│       └─► Script Context (localStorage)                  │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼ HTTP Request
┌──────────────────────────────────────────────────────────┐
│                     BACKEND                               │
│                                                           │
│  POST /api/chat                                          │
│       │                                                   │
│       ├─► validateSession (middleware)                   │
│       │   └─► Extract userId from session                │
│       │                                                   │
│       └─► chatController.startChat()                     │
│           └─► new Chat(userId, scriptId)                 │
│               └─► chat.processMessage()                  │
│                   │                                       │
│                   ├─► 1. IntentClassifier.classify()     │
│                   │   └─► OpenAI API (gpt-4-turbo)       │
│                   │       [Intent Classification]         │
│                   │                                       │
│                   ├─► 2. ScriptManager.getScript()       │
│                   │   └─► MySQL (scripts table)          │
│                   │                                       │
│                   ├─► 3. ChainHandler.execute()          │
│                   │   ├─► prepareContext()               │
│                   │   ├─► getChatHistory()               │
│                   │   │   └─► MySQL (chat_history)       │
│                   │   │                                   │
│                   │   └─► IntentRouter.route()           │
│                   │       └─► WriteScriptChain.run()     │
│                   │           └─► OpenAI API (gpt-4)     │
│                   │               [Main Processing]       │
│                   │                                       │
│                   ├─► 4. QuestionGenerator (optional)    │
│                   │   └─► OpenAI API (gpt-4-turbo)       │
│                   │       [Question Generation]           │
│                   │                                       │
│                   └─► 5. ChatHistoryManager.save()       │
│                       └─► MySQL (chat_history)           │
│                           [Non-blocking]                  │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼ HTTP Response
┌──────────────────────────────────────────────────────────┐
│                     FRONTEND                              │
│                                                           │
│  ChatManager receives response                           │
│       │                                                   │
│       ├─► extractResponseContent()                       │
│       ├─► processAndRenderMessage()                      │
│       ├─► processQuestionButtons()                       │
│       └─► handleScriptOperations()                       │
│           └─► Update editor with new content             │
└──────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables
```bash
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview  # Default model

# Server
SERVER_PORT=3000

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=scriptpal
```

### Frontend Constants
```javascript
// API Configuration
SERVER_PORT = 3000
API_ENDPOINTS = {
    CHAT: '/chat',
    SCRIPT: '/script',
    USER: '/user'
}

// Timeouts
CHAT_TIMEOUT = 30000  // 30 seconds
API_TIMEOUT = 30000   // 30 seconds
```

## Conclusion

The ScriptPal chat system implements a sophisticated multi-layer architecture that:

1. **Intelligently routes** user messages based on classified intent
2. **Provides context-aware** responses using script content and chat history  
3. **Scales through** modular chain-based processing
4. **Ensures reliability** with comprehensive error handling and retry logic
5. **Enhances UX** with follow-up questions and seamless editor integration
6. **Maintains security** through session-based authentication
7. **Optimizes performance** with caching, timeouts, and non-blocking operations

The system makes strategic use of OpenAI's API:
- **Intent classification** to route appropriately
- **Function calling** for structured script edits
- **Conversational AI** for questions and analysis
- **Question generation** for user engagement

All interactions are persisted to maintain conversation continuity, while the frontend provides a smooth, responsive user experience with proper loading states and error handling.
