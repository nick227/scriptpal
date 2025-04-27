# ScriptPal LangChain Module

# Natural language 

## Core Components & Files

### Entry Points
- `chatController.js` - HTTP request handling
- `Chat.js` - Main orchestration class
- `router/index.js` - Intent routing and execution

### Chain Implementation
- `chains/base/BaseChain.js` - Base chain class
- `chains/registry.js` - Chain registration
- `chains/system/classifyIntent.js` - Intent detection

### Database Integration
- `db/index.js` - Database operations
- Script versioning uses composite keys (id, version_number)
- Elements stored with type/subtype structure

## Request Flows

### 1. Message Processing
```javascript
// 1. Client request
POST /chat {
    prompt: "Analyze the characters",
    scriptId: 123
}

// 2. Intent classification
const intent = await classifyIntent(prompt);
// Returns: { intent: INTENT_TYPES.ANALYZE_SCRIPT, confidence: 0.95 }

// 3. Script context loading
const context = await router.getScriptContext(scriptId);
// Returns: { scriptContent, title, elements, personas }

// 4. Chain execution
const result = await chainRegistry.execute(intent, context, prompt);
```

### 2. Script Analysis
```javascript
// 1. Analysis chain execution
const analysis = await analyzer.run(context, prompt);

// 2. Database storage
await db.createElement({
    script_id: scriptId,
    type: 'analysis',
    subtype: 'comprehensive',
    content: analysis
});

// 3. Response format
{
    response: "<h2>Character Analysis</h2><p>...</p>",
    type: "analysis",
    metadata: {
        scriptId: 123,
        scriptTitle: "My Script",
        analysisType: "comprehensive"
    }
}
```

### 3. Script Editing
```javascript
// 1. Edit command format
{
    command: "EDIT",
    lineNumber: 5,
    value: "<dialog>New line</dialog>"
}

// 2. Version management
await ScriptVersionService.applyEdits(scriptId, commands);

// 3. Response format
{
    response: "Updated line 5",
    type: "edit",
    metadata: {
        scriptId: 123,
        version_number: 2
    }
}
```

## Extending the System

### Adding a New Chain

1. Create Chain Class
```javascript
// chains/newFeature/NewFeatureChain.js
export class NewFeatureChain extends BaseChain {
    async run(context, prompt) {
        // Validate
        if (!context.scriptId) {
            throw new Error(ERROR_TYPES.INVALID_CONTEXT);
        }

        // Process
        const messages = await this.buildMessages(context, prompt);
        const result = await this.execute(messages, context);

        // Return
        return {
            response: result,
            type: 'new_feature',
            metadata: {
                scriptId: context.scriptId,
                scriptTitle: context.scriptTitle
            }
        };
    }
}
```

2. Register Chain
```javascript
// chains/registry.js
import { NewFeatureChain } from './newFeature/NewFeatureChain.js';
chainRegistry.register(INTENT_TYPES.NEW_FEATURE, NewFeatureChain);
```

3. Add Intent
```javascript
// constants.js
INTENT_TYPES.NEW_FEATURE = 'new_feature';
```
