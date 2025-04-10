//=============================================================================
// SYSTEM FUNCTIONS & OPERATIONS
//=============================================================================

// Core function definitions for system operations
export const FUNCTION_DEFINITIONS = {
    SAVE_SCRIPT: "save_script",
    SAVE_ELEMENT: "save_element",
    CHANGE_SCRIPT_TITLE: "change_script_title",
    SHARE_SCRIPT: "share_script"
};

//=============================================================================
// INTENT CLASSIFICATION
//=============================================================================

// Core intent types for request classification
export const INTENT_TYPES = {
    // Core Script Analysis
    SCRIPT_QUESTIONS: 'SCRIPT_QUESTIONS',
    ANALYZE_SCRIPT: 'ANALYZE_SCRIPT',

    // Creative Support
    GET_INSPIRATION: 'GET_INSPIRATION',
    GET_QUESTIONS: 'GET_QUESTIONS',

    // Script Operations
    EDIT_SCRIPT: 'EDIT_SCRIPT',
    SAVE_ELEMENT: 'SAVE_ELEMENT',

    // Meta Intents
    MULTI_INTENT: 'MULTI_INTENT',
    EVERYTHING_ELSE: 'EVERYTHING_ELSE'
};

// Detailed descriptions for each intent type
export const INTENT_DESCRIPTIONS = {
    SCRIPT_QUESTIONS: 'Answer questions, provide feedback, and discuss any aspect of the script including analysis, scenes, beats, characters, and general feedback',
    ANALYZE_SCRIPT: 'Perform complete script analysis including structure, characters, plot, themes, and potential improvements',
    GET_INSPIRATION: 'Generate creative ideas, help with brainstorming, and break writer\'s block',
    GET_QUESTIONS: 'Generate relevant follow-up questions to help explore and improve the script',
    EDIT_SCRIPT: 'Make direct changes to the script content or structure',
    SAVE_ELEMENT: 'Save or update script components and maintain script consistency',
    MULTI_INTENT: 'Handle multiple script-related operations in a single request',
    EVERYTHING_ELSE: 'Handle general script-related queries or conversations'
};

//=============================================================================
// COMMAND DEFINITIONS & FORMATS
//=============================================================================

// Available edit commands for script modifications
export const EDIT_COMMANDS = {
    SAVE_ELEMENT: 'SAVE_ELEMENT',
    REPLACE_TEXT: 'REPLACE_TEXT'
};

// Valid targets for save operations
export const SAVE_TARGETS = {
    CHARACTER: 'CHARACTER',
    SCENE: 'SCENE',
    DIALOGUE: 'DIALOGUE',
    PLOT_POINT: 'PLOT_POINT'
};

//=============================================================================
// OUTPUT FORMATS & VALIDATION
//=============================================================================

// Structured output formats for different operations
export const OUTPUT_FORMATS = {
    EDIT_SCRIPT: {
        required: ['command', 'target', 'value'],
        example: {
            command: 'REPLACE_CHARACTER_NAME',
            target: 'NICK',
            value: 'BILL'
        }
    },
    SAVE_ELEMENT: {
        required: ['target', 'value'],
        example: {
            target: 'CHARACTER',
            value: {
                name: 'JOHN',
                description: 'A determined detective',
                traits: ['intelligent', 'persistent']
            }
        }
    }
};

// Validation rules for content length and structure
export const VALIDATION_RULES = {
    MAX_SCENE_LENGTH: 1000,
    MAX_BEAT_LENGTH: 500,
    MAX_IDEAS: 5,
    REQUIRED_FIELDS_THRESHOLD: 0.8
};

//=============================================================================
// AI CONFIGURATION & INSTRUCTIONS
//=============================================================================

// Configuration for AI chain operations
export const TOKEN_LIMITS = {
    DEFAULT: 2000,
    ANALYSIS: 4000, // Comprehensive analysis needs more tokens
};

export const CHAIN_CONFIG = {
    MODEL: "gpt-3.5-turbo",
    TEMPERATURE: 0.3,
    MAX_TOKENS: TOKEN_LIMITS.DEFAULT,
    RESPONSE_FORMAT: 'json'
};

// System instructions for AI responses
export const COMMON_PROMPT_INSTRUCTIONS = {
    SYSTEM_PREFIX: `You are a professional script writing assistant. Follow these core principles:
1. Focus on script improvement and storytelling
2. Provide creative, unexpected, and unexpected feedback
3. Ask questions to learn more about the script and the writer
4. Be emotional and passionate about the script
5. Figure out ways to help the user keep writing
6. Use industry-standard terminology
7. Keep responses clear and structured`,
    RESPONSE_GUIDELINES: {
        FORMAT: 'Always structure responses in creative, engaging, and concise format. Use h2 and p tags for formatting.',
        VALIDATION: 'Include rationale for responses',
        CONTEXT: 'Reference specific script elements when possible'
    }
};

//=============================================================================
// ERROR HANDLING
//=============================================================================

// Error type definitions for system operations
export const ERROR_TYPES = {
    INVALID_INTENT: 'INVALID_INTENT',
    INVALID_FORMAT: 'INVALID_FORMAT',
    MISSING_REQUIRED: 'MISSING_REQUIRED',
    CHAIN_ERROR: 'CHAIN_ERROR',
    ROUTING_ERROR: 'ROUTING_ERROR'
};