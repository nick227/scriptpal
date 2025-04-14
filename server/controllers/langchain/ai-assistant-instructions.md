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
