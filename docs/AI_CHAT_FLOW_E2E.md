# AI Chat Flow — End-to-End Analysis

> **Last Updated:** February 2026

## Executive Summary

This document traces the complete flow of an AI chat request from the frontend through the backend API, AI processing, database persistence, and response handling.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│                                                                             │
│  ChatManager ──► ScriptPalAPI ──► fetch('/api/chat') ───────────────────────┤
│       │                                                                     │
│       ▼                                                                     │
│  extractResponseContent() ◄── processAndRenderMessage() ◄── handleSend()   │
│       │                              │                                      │
│       ▼                              ▼                                      │
│  ScriptOperationsHandler     ChatRenderer                                   │
│       │                                                                     │
│       ▼                                                                     │
│  ScriptOrchestrator ──► EditorCoordinator ──► DOM                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                         │
│                                                                             │
│  routes.js ──► chatController.startChat() ───────────────────────────────── │
│                        │                                                    │
│       ┌────────────────┼────────────────┬────────────────┐                  │
│       ▼                ▼                ▼                ▼                  │
│  isNextFiveLines  isAppendPage  isFullScript  ConversationCoordinator       │
│       │                │                │                │                  │
│       ▼                ▼                ▼                ▼                  │
│  router.route() ◄─────────────────────────────────────────┘                 │
│       │                                                                     │
│       ▼                                                                     │
│  IntentRouter ──► ChainFactory ──► [Chain].run()                            │
│                                          │                                  │
│                                          ▼                                  │
│                                    BaseChain.execute()                      │
│                                          │                                  │
│                                          ▼                                  │
│                                    ai.generateCompletion()                  │
│                                          │                                  │
│                                          ▼                                  │
│                                    OpenAI / Anthropic API                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE                                        │
│                                                                             │
│  chatMessageRepository.create() ──► chat_messages table                     │
│       │                                                                     │
│       ├── userId, scriptId, role, content                                   │
│       ├── intent, metadata (JSON)                                           │
│       └── prompt_tokens, completion_tokens, total_tokens, cost_usd          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Request Flow

### 2.1 User Initiates Chat

**File:** `public/js/widgets/chat/core/ChatManager.js`

```javascript
// User types message and hits send
async handleSend(message) {
    // 1. Validate input
    if (!this.validateSendConditions(message)) return null;
    
    // 2. Render user message
    await this.processAndRenderMessage(message, MESSAGE_TYPES.USER);
    
    // 3. Save to local history
    await this.chatHistoryManager.addMessage({ content: message, type: 'user' });
    
    // 4. Call API
    const data = await this.getApiResponseWithTimeout(message);
    
    // 5. Extract and render assistant response
    const responseContent = this.extractResponseContent(data);
    await this.processAndRenderMessage(responseContent, MESSAGE_TYPES.ASSISTANT);
    
    // 6. Handle script operations (if applicable)
    await this.handleScriptOperations(data);
    
    return data;
}
```

### 2.2 API Client

**File:** `public/js/services/api/ScriptPalAPI.js`

```javascript
async getChatResponse(content, context = {}) {
    const enhancedContext = {
        scriptId: localStorage.getItem('currentScriptId'),
        scriptTitle: localStorage.getItem('currentScriptTitle'),
        scriptVersion: localStorage.getItem('currentScriptVersion'),
        timestamp: new Date().toISOString(),
        ...context
    };

    return await this._makeRequest('/api/chat', 'POST', {
        prompt: content,
        context: enhancedContext
    });
}
```

**Request Payload:**
```json
{
    "prompt": "Write the next 5 lines",
    "context": {
        "scriptId": "123",
        "scriptTitle": "My Script",
        "scriptVersion": "1",
        "timestamp": "2026-02-03T10:00:00.000Z"
    }
}
```

---

## 3. Backend Request Handling

### 3.1 Route Definition

**File:** `server/routes.js`

```javascript
{
    path: '/chat',
    method: 'post',
    handler: chatController.startChat,
    middleware: [validateSession]
}
```

### 3.2 Controller Logic

**File:** `server/controllers/chatController.js`

The controller implements a decision tree for routing requests:

```javascript
async startChat(req, res) {
    // 1. Validate inputs
    if (!req.body.prompt) return res.status(400).json({ error: 'Missing prompt' });
    if (!req.userId) return res.status(401).json({ error: 'Authentication required' });

    // 2. Load script (if scriptId provided)
    const { scriptId, script } = await loadScriptOrThrow(req, { required: false });

    // 3. Intent Detection Cascade
    
    // 3a. Full Script Generation
    if (isFullScriptRequest(prompt)) {
        return generateFullScript({ scriptId, userId, prompt });
    }
    
    // 3b. Next Five Lines
    if (isNextFiveLinesRequest(prompt)) {
        const context = await buildPromptContext({ scriptId, ... });
        const response = await router.route(intentResult, context, prompt);
        return res.status(200).json(buildValidatedChatResponse({ ... }));
    }
    
    // 3c. Append Page
    if (isAppendPageRequest(prompt)) {
        return generateAppendPage({ scriptId, userId, prompt });
    }
    
    // 3d. General Conversation (fallback)
    const chat = new ConversationCoordinator(userId, scriptId);
    const result = await chat.processMessage(prompt, context);
    return res.status(200).json(result);
}
```

### 3.3 Intent Detection Heuristics

**File:** `server/controllers/chat/intent/heuristics.js`

```javascript
// Pattern matching for request types
isNextFiveLinesRequest(prompt)  // "next 5 lines", "continue script"
isAppendPageRequest(prompt)      // "next page", "write more"
isFullScriptRequest(prompt)      // "write full script", "generate entire"
isGeneralConversation(prompt)    // Questions, feedback, general chat
isReflectionRequest(prompt)      // "analyze", "review", "feedback"
```

---

## 4. Conversation Coordination

### 4.1 ConversationCoordinator

**File:** `server/controllers/chat/orchestrator/ConversationCoordinator.js`

For general conversation and script chat:

```javascript
async processMessage(prompt, context) {
    // 1. Load script (if any)
    const script = this.scriptId ? await this.scriptManager.getScript(this.scriptId) : null;
    
    // 2. Classify intent using AI
    const classification = await this.intentClassifier.classify(classifierContext, prompt);
    const intent = this.resolveIntent(classification?.intent) || this.determineIntent(prompt, script);
    
    // 3. Build context bundle
    const preparedContext = await this.buildContext(script, context, prompt, intent);
    
    // 4. Route to appropriate chain
    const response = await router.route(intentResult, preparedContext, prompt);
    
    // 5. Save to history (async, non-blocking)
    this.historyManager.saveInteraction(prompt, response, this.scriptId, intent)
        .catch(error => console.error('Chat history save failed:', error));
    
    // 6. Format and return response
    return this.formatResponse(response, intentResult);
}
```

### 4.2 Context Building

**File:** `server/controllers/script/context-builder.service.js`

```javascript
const context = {
    userId,
    scriptId,
    intent,
    scriptTitle,
    scriptDescription,
    scriptContent,           // Actual script text (may be truncated)
    scriptMetadata,          // Version, dates, etc.
    scriptCollections,       // Scenes, characters, locations, themes
    chatHistory,             // Recent conversation turns
    systemInstruction,       // Prompt from registry
    chainConfig: {
        modelConfig: { temperature, response_format },
        shouldGenerateQuestions: boolean
    }
};
```

---

## 5. Intent Routing

### 5.1 IntentRouter

**File:** `server/controllers/langchain/router/index.js`

```javascript
async route(intentResult, context, prompt) {
    const { intent } = intentResult;
    
    // Get chain class from registry
    const ChainClass = this.chainRegistry.getChain(intent);
    
    if (!ChainClass) {
        // Fallback to default chain
        const DefaultChainClass = this.chainRegistry.getChain(INTENT_TYPES.GENERAL_CONVERSATION);
        const defaultChain = new DefaultChainClass();
        return await defaultChain.run(context, prompt);
    }
    
    // Create and run chain
    const chain = new ChainClass();
    return await chain.run(context, prompt);
}
```

### 5.2 Chain Registry

**File:** `server/controllers/langchain/chains/registry.js`

Maps intents to chain classes:

| Intent | Chain Class |
|--------|-------------|
| `NEXT_FIVE_LINES` | ScriptNextLinesChain |
| `APPEND_SCRIPT` | ScriptPageAppendChain |
| `SCRIPT_CONVERSATION` | ScriptAppendChain |
| `SCRIPT_REFLECTION` | ScriptReflectionChain |
| `GENERAL_CONVERSATION` | DefaultChain |
| `SCENE_IDEA` | SceneIdeaChain |
| `CHARACTER_IDEA` | CharacterIdeaChain |
| ... | ... |

---

## 6. Chain Execution

### 6.1 BaseChain

**File:** `server/controllers/langchain/chains/base/BaseChain.js`

All chains extend `BaseChain`:

```javascript
async run(context, prompt) {
    // 1. Build messages (implemented by subclass)
    const messages = await this.buildMessages(context, prompt);
    
    // 2. Execute chain
    return this.execute(messages, context, shouldGenerateQuestions);
}

async execute(messages, metadata, shouldGenerateQuestions) {
    // 1. Add common instructions
    const processedMessages = this.addCommonInstructions(messages);
    
    // 2. Build message chain (includes history)
    const allMessages = await this.buildMessageChain(processedMessages, context);
    
    // 3. Make AI API call
    const completionParams = {
        model: 'gpt-4-turbo-preview',
        messages: allMessages,
        temperature: this.temperature,
        max_tokens: 4000,
        ...modelConfig
    };
    
    const result = await ai.generateCompletion(completionParams);
    
    // 4. Extract response content
    const aiMessage = result.data.choices?.[0]?.message || {};
    const responseContent = aiMessage.content || aiMessage.function_call?.arguments || '';
    
    // 5. Log to database
    await chatMessageRepository.create({
        userId: context.userId,
        scriptId: context.scriptId,
        role: 'assistant',
        content: responseContent,
        intent: context.intent,
        metadata: { userPrompt: originalPrompt, chainType: this.type },
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        costUsd: metrics.cost
    });
    
    // 6. Generate follow-up questions (optional)
    const questions = shouldGenerateQuestions 
        ? await this.questionGenerator.generateQuestions(context, prompt, responseContent)
        : null;
    
    // 7. Create response object
    return this.createResponse(responseContent, context, questions, { aiUsage });
}
```

### 6.2 Specialized Chains

**ScriptNextLinesChain** (`server/controllers/langchain/chains/script/ScriptNextLinesChain.js`):

```javascript
async run(context, prompt) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const messages = await this.buildMessages(context, prompt, retryNote);
        const rawResponse = await this.execute(messages, context, false);
        return this.formatResponse(rawResponse, isLastAttempt);
    }
}

formatResponse(response, isLastAttempt) {
    // 1. Parse function payload
    const validated = this.parseFunctionPayload(response, { 
        required: ['formattedScript', 'assistantResponse'] 
    });
    
    // 2. Normalize script
    const normalizedScript = normalizeFormattedScript(validated.formattedScript);
    
    // 3. Grammar validation (hard)
    const grammarResult = validateScreenplayGrammar(normalizedScript);
    if (!grammarResult.valid) {
        if (isLastAttempt) {
            // Repair grammar on final attempt
            normalizedScript = repairScreenplayGrammar(normalizedScript);
        } else {
            // Throw to trigger retry
            throw new Error(`grammar_invalid: ${grammarResult.errors.join('; ')}`);
        }
    }
    
    // 4. Line count validation
    const lineCountResult = validateLineCount(normalizedScript);
    
    // 5. Build response
    return {
        response: chatMessage,              // For chat display
        assistantResponse: chatMessage,     // Alias
        type: INTENT_TYPES.NEXT_FIVE_LINES,
        metadata: {
            formattedScript: normalizedScript,  // For editor
            lineCount: lineCountResult.count,
            grammarValid: grammarResult.valid,
            grammarRepaired: wasRepaired
        }
    };
}
```

---

## 7. AI Provider Integration

### 7.1 AI Client

**File:** `server/lib/ai.js`

```javascript
async generateCompletion(params) {
    const provider = this.getProvider(params.model);
    
    const response = await provider.createChatCompletion({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.max_tokens,
        functions: params.functions,
        function_call: params.function_call,
        response_format: params.response_format
    });
    
    return {
        success: true,
        data: {
            choices: response.choices,
            usage: response.usage
        },
        metrics: {
            cost: calculateCost(response.usage),
            responseTime: elapsed
        }
    };
}
```

### 7.2 Function Calling

For structured output (next-five-lines, append-page):

```javascript
const NEXT_FIVE_FUNCTIONS = [{
    name: 'provide_next_lines',
    description: 'Return script continuation.',
    parameters: {
        type: 'object',
        properties: {
            formattedScript: {
                type: 'string',
                description: 'Script lines in XML tags.'
            },
            assistantResponse: {
                type: 'string',
                description: 'Brief explanation.'
            }
        },
        required: ['formattedScript', 'assistantResponse']
    }
}];
```

---

## 8. Database Persistence

### 8.1 Chat Messages Table

**Schema:**
```sql
CREATE TABLE chat_messages (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    userId         INT NOT NULL,
    scriptId       INT,
    role           ENUM('user', 'assistant') NOT NULL,
    content        TEXT NOT NULL,
    intent         VARCHAR(50),
    metadata       JSON,
    prompt_tokens  INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    total_tokens   INT DEFAULT 0,
    cost_usd       DECIMAL(10, 6) DEFAULT 0,
    createdAt      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 8.2 Repository Operations

**File:** `server/repositories/chatMessageRepository.js`

```javascript
// Create message
await chatMessageRepository.create({
    userId,
    scriptId,
    role: 'assistant',
    content: responseContent,
    intent,
    metadata: { userPrompt, chainType },
    promptTokens, completionTokens, totalTokens, costUsd
});

// List messages for script
const messages = await chatMessageRepository.listByUser(userId, scriptId, limit, offset);

// Clear history
await chatMessageRepository.clearByUserAndScript(userId, scriptId);
```

---

## 9. Response Normalization

### 9.1 buildAiResponse

**File:** `server/controllers/common/ai-response.service.js`

```javascript
export const buildAiResponse = ({ intentResult, scriptId, scriptTitle, response, mode, validation }) => {
    // Normalize response (rename 'response' to 'content')
    const normalizedResponse = normalizeAiResponse(response);
    
    return {
        success: true,
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        scriptId,
        scriptTitle,
        timestamp: new Date().toISOString(),
        mode,                          // e.g., 'NEXT_FIVE_LINES'
        validation,                    // Contract validation result
        result: normalizedResponse,    // Legacy field
        response: normalizedResponse   // Primary response object
    };
};
```

### 9.2 Response Payload Structure (Canonical Shape v2)

```json
{
    "success": true,
    "intent": "NEXT_FIVE_LINES",
    "confidence": 1,
    "scriptId": 123,
    "scriptTitle": "My Script",
    "timestamp": "2026-02-03T10:00:00.000Z",
    "mode": "NEXT_FIVE_LINES",
    "validation": {
        "valid": true,
        "errors": []
    },
    "response": {
        "message": "Added 5 lines continuing the scene.",
        "script": "<speaker>JOHN</speaker>\n<dialog>Hello.</dialog>\n...",
        "metadata": {
            "lineCount": 5,
            "grammarValid": true,
            "grammarRepaired": false
        },
        "type": "NEXT_FIVE_LINES"
    }
}
```

**Extraction Rule (v2 - strict, no fallbacks):**
- Chat message: `response.message`
- Script content: `response.script`

---

## 10. Frontend Response Handling

### 10.1 Response Extraction

**File:** `public/js/widgets/chat/core/ChatManager.js`

```javascript
extractResponseContent(data) {
    if (!data || !data.response) return null;
    
    if (typeof data.response === 'object') {
        return data.response.response ||      // Nested response
               data.response.message ||
               data.response.content ||       // Normalized content
               data.response.assistantResponse;
    }
    
    return null;
}

extractFormattedScriptFromResponse(response) {
    const candidates = [
        response.metadata?.formattedScript,
        response.formattedScript,
        response.response?.metadata?.formattedScript,
        response.response?.formattedScript
    ];
    
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
            return candidate;
        }
    }
    return '';
}
```

### 10.2 Script Operations Handling

**File:** `public/js/widgets/chat/core/ChatManager.js`

```javascript
async handleScriptOperations(data) {
    let intent = data.intent || data.response?.intent;
    
    // Convert NEXT_FIVE_LINES to APPEND_SCRIPT
    if (intent === 'NEXT_FIVE_LINES') {
        const formattedScript = this.extractFormattedScriptFromResponse(data.response);
        intent = 'APPEND_SCRIPT';
        operationData = {
            ...data,
            response: {
                ...data.response,
                content: formattedScript,
                metadata: { ...data.response.metadata, formattedScript }
            }
        };
    }
    
    // Delegate to handler
    await this.scriptOperationsHandler.handleIntent(intent, operationData);
}
```

### 10.3 Script Operations Handler

**File:** `public/js/widgets/chat/core/ScriptOperationsHandler.js`

```javascript
async _handleScriptAppend(data) {
    // 1. Validate response
    const aiValidation = validateAiResponse(validationIntent, data?.response);
    if (!aiValidation.valid) {
        this.onError(new Error('AI response format invalid'));
        return;
    }
    
    // 2. Extract content
    const rawContent = this._extractAppendContent(data) || aiValidation.formattedScript;
    const content = this._sanitizeAppendContent(rawContent);
    
    // 3. Normalize (split long lines)
    const normalizedContent = orchestrator.splitLongAiLines(content);
    
    // 4. Append to editor
    await orchestrator.handleScriptAppend({
        content: normalizedContent,
        isFromAppend: true
    });
}
```

### 10.4 ScriptOrchestrator

**File:** `public/js/services/script/ScriptOrchestrator.js`

```javascript
async handleScriptAppend(data) {
    // 1. Normalize lines
    const normalizedLines = this.normalizeScriptLines(data.content);
    
    // 2. Build line items with format resolution
    const lineItems = normalizedLines
        .map(line => this.buildLineItem(line))
        .filter(Boolean);
    
    // 3. Create ADD commands
    const commands = lineItems.map((item, i) => ({
        command: 'ADD',
        lineNumber: startIndex + i,
        data: { format: item.format, content: item.content }
    }));
    
    // 4. Apply to editor
    await editorContent.applyCommands(commands, { source: 'script_append' });
}
```

---

## 11. Error Handling

### 11.1 Backend Errors

```javascript
function handleChatError(error) {
    const errorResponse = { status: 500, body: { error: 'Internal server error' } };
    
    if (error.message?.includes('Rate limit exceeded')) {
        errorResponse.status = 429;
        errorResponse.body.error = 'AI rate limit exceeded';
    } else if (error.message?.includes('Script not found')) {
        errorResponse.status = 404;
    } else if (error.message?.includes('Invalid intent')) {
        errorResponse.status = 400;
    }
    
    return errorResponse;
}
```

### 11.2 Frontend Error Display

```javascript
try {
    const data = await this.getApiResponseWithTimeout(message);
    // ... handle success
} catch (error) {
    this.handleError(error, 'handleSend');
    await this.safeRenderMessage(ERROR_MESSAGES.API_ERROR, MESSAGE_TYPES.ERROR);
}
```

---

## 12. Data Flow Summary

```
┌──────────────────────────────────────────────────────────────────────────┐
│  USER INPUT                                                              │
│  "Write the next 5 lines"                                                │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  FRONTEND REQUEST                                                        │
│  POST /api/chat { prompt: "...", context: { scriptId, ... } }            │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  CONTROLLER                                                              │
│  Detect intent → NEXT_FIVE_LINES                                         │
│  Build context (script content, collections, system prompt)              │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  ROUTER → CHAIN                                                          │
│  ScriptNextLinesChain.run(context, prompt)                               │
│  Build messages → Execute → Validate → Retry if needed                   │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  AI PROVIDER                                                             │
│  OpenAI gpt-4-turbo with function calling                                │
│  Returns { formattedScript, assistantResponse }                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  VALIDATION                                                              │
│  Grammar check (speaker → dialog)                                        │
│  Line count check (exactly 5)                                            │
│  Repair if on final retry attempt                                        │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  DATABASE                                                                │
│  INSERT INTO chat_messages (userId, scriptId, role, content, ...)        │
│  Track tokens + cost                                                     │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  API RESPONSE                                                            │
│  { success, intent, response: { content, metadata: { formattedScript }}} │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  FRONTEND EXTRACTION                                                     │
│  Chat message: response.content → render in chat                         │
│  Script content: response.metadata.formattedScript → append to editor    │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  EDITOR UPDATE                                                           │
│  ScriptOrchestrator → normalizeScriptLines → buildLineItem               │
│  EditorCoordinator → applyCommands (ADD) → DOM render                    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Key Files Reference

| Component | File Path |
|-----------|-----------|
| **Frontend API** | `public/js/services/api/ScriptPalAPI.js` |
| **Chat Manager** | `public/js/widgets/chat/core/ChatManager.js` |
| **Script Operations** | `public/js/widgets/chat/core/ScriptOperationsHandler.js` |
| **Script Orchestrator** | `public/js/services/script/ScriptOrchestrator.js` |
| **Routes** | `server/routes.js` |
| **Chat Controller** | `server/controllers/chatController.js` |
| **Conversation Coordinator** | `server/controllers/chat/orchestrator/ConversationCoordinator.js` |
| **Intent Router** | `server/controllers/langchain/router/index.js` |
| **Base Chain** | `server/controllers/langchain/chains/base/BaseChain.js` |
| **Next Lines Chain** | `server/controllers/langchain/chains/script/ScriptNextLinesChain.js` |
| **Page Append Chain** | `server/controllers/langchain/chains/script/ScriptPageAppendChain.js` |
| **AI Client** | `server/lib/ai.js` |
| **Chat Repository** | `server/repositories/chatMessageRepository.js` |
| **Response Builder** | `server/controllers/common/ai-response.service.js` |
| **Prompt Registry** | `shared/promptRegistry.js` |

---

## 14. Debugging Tips

### Server-Side Logging
```javascript
// Key log points in chatController
console.log('[ChatController] startChat routing check', { scriptId, prompt });
console.log('[ChatController] next-five-lines detected, generating');

// Key log points in chains
console.log('[ScriptNextLinesChain] function payload', validated);
console.warn('[ScriptNextLinesChain] Grammar validation failed:', grammarResult.errors);
```

### Client-Side Logging
```javascript
// ChatManager
console.log('[ChatManager] Raw AI response', data);
console.log('[ChatManager] handleScriptOperations', { intent, hasResponse });

// ScriptOperationsHandler
console.log('[ScriptOperationsHandler] append content format check', { totalLines, taggedLines });
console.log('[ScriptOperationsHandler] append intent received', { hasContent, hasOrchestrator });
```

### Common Issues

| Symptom | Likely Cause | Debug Location |
|---------|--------------|----------------|
| Empty chat response | `assistantResponse` empty | Chain `formatResponse` |
| Script not appending | `formattedScript` missing | `extractFormattedScriptFromResponse` |
| Grammar violations | AI returning invalid output | Chain validation, check `grammarErrors` |
| Dialog without speaker | Grammar repair failed | `repairScreenplayGrammar` |

---

## 15. Contract Summary

### Request Contract
```typescript
POST /api/chat
{
    prompt: string;           // Required
    context?: {
        scriptId?: number;
        scriptTitle?: string;
        scriptVersion?: string;
        forceAppend?: boolean;
        forceFullScript?: boolean;
    }
}
```

### Response Contract (Canonical Shape v2 - Strict)
```typescript
{
    success: boolean;
    intent: string;           // e.g., 'NEXT_FIVE_LINES', 'APPEND_SCRIPT'
    scriptId?: number;
    scriptTitle?: string;
    timestamp: string;
    mode?: string;
    validation?: { valid: boolean; errors: string[] };
    response: {
        message: string;          // Chat message to display
        script: string | null;    // Script content (XML-tagged), null if no mutation
        metadata: {
            lineCount?: number;
            grammarValid?: boolean;
            grammarRepaired?: boolean;
        };
        type?: string;
    }
}
```

**Note:** v2 removes all legacy aliases. Only `message` and `script` fields are used.

### Extraction Functions

**Shared constants** (`shared/langchainConstants.js`):
```javascript
// Strict extractors (v2) - no fallbacks
extractResponseMessage(data)  // → data?.response?.message || null
extractResponseScript(data)   // → data?.response?.script || null
```

**Frontend usage:**
```javascript
// ChatManager.js - strict extraction
extractResponseContent(data) {
    return data?.response?.message || null;
}

extractFormattedScriptFromResponse(response) {
    return response?.script || '';
}
```
