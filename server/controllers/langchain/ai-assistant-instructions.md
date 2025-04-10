ScriptPal is an AI-powered screenwriting assistant that helps users develop film scripts through iterative collaboration. The assistant runs within a larger UI platform and leverages LangChain, OpenAI, and a MySQL backend. The assistant must:

    Understand user intent per input
    Route prompts to the appropriate tool or generation chain
    Avoid multitasking within a single prompt
    Trigger backend saves through structured function calls
    Log all activity

This specification outlines the AI orchestration system, focusing on LangChain integration, prompt control, intent parsing, persona handling, and MySQL data flow.

# AI Script Writing Assistant Documentation

## System Architecture

The AI script writing assistant is built using a modular chain-based architecture that processes user inputs through several specialized components:

### Core Components

1. **Chat Controller** (`chatController.js`)
   - Entry point for all user interactions
   - Handles request validation and response formatting
   - Manages the flow from intent classification to chain execution

2. **Intent Router** (`router/index.js`)
   - Routes classified intents to appropriate chains
   - Manages script context and database interactions
   - Handles multi-intent processing

3. **Base Chain** (`chains/base/BaseChain.js`)
   - Parent class for all chain implementations
   - Provides standardized model configuration
   - Implements common validation and execution logic

4. **Prompt Manager** (`prompts/index.js`)
   - Centralizes prompt template management
   - Handles template registration and formatting
   - Maintains default variables and configurations

## Chain Types

### System Chains
1. **Intent Classifier** (`chains/system/classifyIntent.js`)
   - Analyzes user input to determine intent
   - Maps to predefined intent types
   - Supports multi-intent detection

2. **Intent Splitter** (`chains/system/intentSplitter.js`)
   - Breaks down complex requests into sub-intents
   - Maintains execution order
   - Ensures contextual continuity

### Creative Chains
1. **Scene Lister** (`chains/creative/sceneLister.js`)
   - Generates and manages scene structures
   - Validates scene components
   - Maintains scene relationships

2. **Beat Lister** (`chains/creative/beatLister.js`)
   - Creates story beat breakdowns
   - Tracks emotional impact
   - Suggests beat placements

3. **Inspiration Generator** (`chains/creative/inspirationGen.js`)
   - Provides creative strategy
   - References similar ideas
   - Offers implementation strategies

4. **Script Questions** (`chains/creative/scriptQuestions.js`)
   - Answers specific questions about script content
   - Provides focused analysis based on question type
   - Handles character, plot, theme, and structure queries
   - Returns single comprehensive answers

### Analysis Chains
1. **Script Analyzer** (`chains/analysis/scriptAnalyzer.js`)
   - Performs comprehensive script analysis
   - Evaluates structure, characters, and themes
   - Provides actionable recommendations

## Data Flow

1. **Request Processing**
   ```
   User Input → Chat Controller → Intent Classification → Router → Specific Chain
   ```

2. **Context Management**
   ```
   Script ID → Database Lookup → Context Assembly → Chain Execution
   ```

3. **Response Flow**
   ```
   Chain Output → Validation → Database Storage → Response Formatting → User
   ```

## Database Integration

Each chain interacts with the database through standardized methods:
- `createElement`: Stores new script elements
- `getScriptProfile`: Retrieves script metadata
- `getScriptPersonas`: Fetches character information
- `getScriptStats`: Obtains script statistics

## Usage Guidelines

### Creating New Chains
1. Extend `BaseChain`
2. Register prompts with `promptManager`
3. Implement `run()` method
4. Add validation logic
5. Register in `ChainFactory`

### Adding Prompts
1. Use `promptManager.registerTemplate()`
2. Include required variables
3. Define default values
4. Specify response format

### Error Handling
- All chains should use `ERROR_TYPES`
- Implement proper validation
- Maintain error context
- Log errors appropriately

## Best Practices

1. **Chain Development**
   - Keep chains focused and single-purpose
   - Implement proper validation
   - Use consistent response formats
   - Document expected inputs/outputs

2. **Prompt Management**
   - Use clear, consistent instructions
   - Define explicit response formats
   - Include examples where helpful
   - Maintain template versioning

3. **Database Operations**
   - Use transaction where appropriate
   - Implement proper error handling
   - Maintain data consistency
   - Log significant operations

4. **Testing**
   - Validate chain outputs
   - Test edge cases
   - Verify database operations
   - Check error handling

## Configuration

Key configuration is managed through environment variables and constants:
- `OPENAI_MODEL`: Model selection
- `CHAIN_CONFIG`: Default chain settings
- `ERROR_TYPES`: Standardized error codes
- `VALIDATION_RULES`: Input/output validation rules

## Maintenance

Regular maintenance tasks:
1. Review and update prompts
2. Monitor chain performance
3. Update validation rules
4. Optimize database queries
5. Review error logs

export const INTENT_TYPES = {
    // Core Script Analysis
    LIST_SCENES: 'scene_list',
    LIST_BEATS: 'beat_list',
    ANALYZE_SCRIPT: 'comprehensive_analysis',

    // Creative Support
    GET_INSPIRATION: 'inspiration',
    SCRIPT_QUESTIONS: 'script_questions',

    // Meta Intents
    MULTI_INTENT: 'multi_intent',
    EVERYTHING_ELSE: 'everything_else'
};

export const INTENT_DESCRIPTIONS = {
    scene_list: 'List and analyze scenes in the script',
    beat_list: 'List and analyze story beats',
    inspiration: 'Generate creative ideas and thoughts',
    comprehensive_analysis: 'Perform complete script analysis including structure, characters, plot, and themes',
    script_questions: 'Answer specific questions about script content with focused analysis',
    MULTI_INTENT: 'Multiple operations requested',
    EVERYTHING_ELSE: 'Not script related or general conversation'
};
