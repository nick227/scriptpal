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

import {
  INTENT_TYPES,
  SCRIPT_CONTEXT_PREFIX,
  VALID_FORMATS,
  VALID_FORMAT_VALUES,
  OUTPUT_CONTRACTS,
  SCRIPT_MUTATION,
  validateAiResponse
} from '../../../shared/langchainConstants.js';

export {
  INTENT_TYPES,
  SCRIPT_CONTEXT_PREFIX,
  VALID_FORMATS,
  VALID_FORMAT_VALUES,
  OUTPUT_CONTRACTS,
  SCRIPT_MUTATION,
  validateAiResponse
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
  NEXT_FIVE_LINES: 'Write the next five lines in the script (formatted) and explain why they fit.',
  SCRIPT_REFLECTION: 'Reflect on the script and its themes, characters, and choices without writing new script lines; just offer analysis and questions.',
  GENERAL_CONVERSATION: 'Handle short-form or unrelated dialogue that should not automatically append the script context.',
  SCENE_IDEA: 'Generate a scene title and description based on the script and scene context.',
  CHARACTER_IDEA: 'Generate a character title and description based on the script and character context.',
  LOCATION_IDEA: 'Generate a location item title and description based on the script and location context.',
  THEME_IDEA: 'Generate a theme title and description based on the script and theme context.'
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
  model: 'gpt-3.5-turbo',
  temperature: 0.3,
  max_tokens: TOKEN_LIMITS.DEFAULT,
  response_format: { type: 'json_object' }
};

// System instructions for AI responses
export const COMMON_PROMPT_INSTRUCTIONS = {
  SYSTEM_PREFIX: `
You are a script writing assistant.
Follow the system and developer instructions carefully.
Return outputs only in the format explicitly requested.
`,
  RESPONSE_GUIDELINES: {
    FORMAT: 'Always using meaningful and concise language.',
    VALIDATION: 'Include critical thinking and rationale for responses',
    CONTEXT: 'Avoid generic or obvious language.'
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
