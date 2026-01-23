//=============================================================================
// SYSTEM FUNCTIONS & OPERATIONS
//=============================================================================

// Core function definitions for system operations
export const FUNCTION_DEFINITIONS = {
  SAVE_SCRIPT: 'save_script',
  SAVE_ELEMENT: 'save_element',
  CHANGE_SCRIPT_TITLE: 'change_script_title',
  SHARE_SCRIPT: 'share_script'
};

//=============================================================================
// INTENT CLASSIFICATION
//=============================================================================

// Core intent types for request classification
export const INTENT_TYPES = {
  SCRIPT_CONVERSATION: 'SCRIPT_CONVERSATION',
  GENERAL_CONVERSATION: 'GENERAL_CONVERSATION'
};

// Intent confidence thresholds
export const INTENT_CONFIDENCE = {
  // Minimum confidence to proceed with intent execution
  THRESHOLD: 0.7,

  // High confidence - proceed without question
  HIGH: 0.85,

  // Medium confidence - proceed but monitor
  MEDIUM: 0.7,

  // Low confidence - ask for clarification
  LOW: 0.5
};

// Detailed descriptions for each intent type
export const INTENT_DESCRIPTIONS = {
  SCRIPT_CONVERSATION: 'Discuss the current script with the full script context appended so the AI can reason about scenes, characters, and next steps.',
  GENERAL_CONVERSATION: 'Handle short-form or unrelated dialogue that should not automatically append the script context.'
};

//=============================================================================
// COMMAND DEFINITIONS & FORMATS
//=============================================================================

// Available edit commands for script modifications
export const EDIT_COMMANDS = {
  SAVE_ELEMENT: 'SAVE_ELEMENT',
  REPLACE_TEXT: 'REPLACE_TEXT'
};

//=============================================================================
// OUTPUT FORMATS & VALIDATION
//=============================================================================

// Structured output formats for different operations
export const OUTPUT_FORMATS = {
  EDIT_SCRIPT: {
    required: ['command', 'target', 'value'],
    example: {
      command: 'ADD',
      lineNumber: '15',
      value: '<SPEAKER>BILL</SPEAKER> <DIALOG>I\'m not sure what to do.</DIALOG>'
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
  ANALYSIS: 4000 // Comprehensive analysis needs more tokens
};

export const CHAIN_CONFIG = {
  MODEL: 'gpt-3.5-turbo',
  TEMPERATURE: 0.3,
  MAX_TOKENS: TOKEN_LIMITS.DEFAULT,
  RESPONSE_FORMAT: 'json'
};

// Valid script format types - must match frontend constants
export const VALID_FORMATS = Object.freeze({
  HEADER: 'header',
  ACTION: 'action',
  SPEAKER: 'speaker',
  DIALOG: 'dialog',
  DIRECTIONS: 'directions',
  CHAPTER_BREAK: 'chapter-break'
});

export const VALID_FORMAT_VALUES = Object.freeze(Object.values(VALID_FORMATS));

// System instructions for AI responses
export const COMMON_PROMPT_INSTRUCTIONS = {
  SYSTEM_PREFIX: `
You are a script writing assistant. Follow these core principles:

1. Focus on script improvement and storytelling
2. Provide creative, unexpected, and unexpected feedback
3. Ask questions to learn more about the script and the writer
4. Be emotional and passionate about the script
5. Figure out ways to help the user keep writing
6. Use industry-standard terminology
7. Keep responses clear and structured

Always use markdown formatting:

    <header>header</header>
    <action>action</action>
    <speaker>speaker</speaker>
    <dialog>dialog</dialog>
    <directions>directions</directions>
    <chapter-break>chapter-break</chapter-break>
`,
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
