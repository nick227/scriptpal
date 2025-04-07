// Function definitions
export const FUNCTION_DEFINITIONS = {
    SAVE_SCRIPT: "save_script",
    SAVE_ELEMENT: "save_story_element",
    CHANGE_SCRIPT_TITLE: "change_script_title",
    SHARE_SCRIPT: "share_script"
};

// Intent Types - Consolidated
export const INTENT_TYPES = {
    // Core Script Analysis
    LIST_SCENES: 'scene_list',
    LIST_BEATS: 'beat_list',
    SCRIPT_QUESTIONS: 'script_questions',

    // Creative Support
    GET_INSPIRATION: 'inspiration',
    BRAINSTORMING: 'brainstorming',

    // Script Operations
    EDIT_SCRIPT: 'edit_script',
    SAVE_ELEMENT: 'save_element',

    // Analysis & Feedback
    GIVE_FEEDBACK: 'give_feedback',
    SCRIPT_THINKING: 'script_thinking',

    // Meta Intents
    MULTI_INTENT: 'multi_intent',
    EVERYTHING_ELSE: 'everything_else',

    // Comprehensive Analysis
    ANALYZE_SCRIPT: 'comprehensive_analysis'
};

// Intent Descriptions - Consolidated
export const INTENT_DESCRIPTIONS = {
    scene_list: 'List and analyze scenes in the script',
    beat_list: 'List and analyze story beats',
    script_questions: 'Answer specific questions about the script content',
    inspiration: 'Generate creative ideas and suggestions',
    comprehensive_analysis: 'Perform complete script analysis including structure, characters, plot, and themes',
    LIST_SCENES: 'Break down and organize script into formatted scenes',
    LIST_BEATS: 'Analyze and list major story beats',
    GET_INSPIRATION: 'Generate creative ideas and break writer\'s block',
    BRAINSTORMING: 'Brainstorming, list making, or generating creative ideas',
    EDIT_SCRIPT: 'Make direct changes to the script',
    SAVE_ELEMENT: 'Save or update script components',
    GIVE_FEEDBACK: 'Provide script analysis and feedback',
    SCRIPT_THINKING: 'Help discussing existing script and analyzing current content',
    MULTI_INTENT: 'Multiple operations requested',
    EVERYTHING_ELSE: 'Not script related or general conversation'
};

// Output Formats
export const OUTPUT_FORMATS = {
    SCENE: {
        required: ['sceneNumber', 'description', 'location', 'timeOfDay'],
        optional: ['characters', 'mood', 'notes'],
        example: {
            sceneNumber: 1,
            description: 'Opening scene',
            location: 'INT. OFFICE',
            timeOfDay: 'DAY',
            characters: ['JOHN', 'MARY'],
            mood: 'tense',
            notes: 'Sets up main conflict'
        }
    },
    BEAT: {
        required: ['beatNumber', 'description', 'purpose'],
        optional: ['emotionalChange', 'notes'],
        example: {
            beatNumber: 1,
            description: 'Inciting incident',
            purpose: 'Set main conflict in motion',
            emotionalChange: 'Hope to uncertainty',
            notes: 'Key character decision point'
        }
    },
    INSPIRATION: {
        required: ['idea', 'reasoning'],
        optional: ['alternatives', 'impact'],
        example: {
            idea: 'Character reveals hidden motivation',
            reasoning: 'Adds depth to conflict',
            alternatives: ['Delayed reveal', 'Partial reveal'],
            impact: 'Changes audience perception'
        }
    }
};

// Chain Configuration
export const CHAIN_CONFIG = {
    TEMPERATURE: 0.7,
    MAX_TOKENS: 1000,
    MODEL: 'gpt-4-turbo-preview',
    RESPONSE_FORMAT: 'json'
};

// Common Prompt Instructions
export const COMMON_PROMPT_INSTRUCTIONS = {
    SYSTEM_PREFIX: `You are a professional script writing assistant. Follow these core principles:
1. Focus on script improvement and storytelling
2. Provide specific, actionable feedback
3. Maintain consistent story elements
4. Consider emotional impact and audience engagement
5. Respect the writer's creative vision
6. Use industry-standard terminology
7. Keep responses clear and structured`,
    RESPONSE_GUIDELINES: {
        FORMAT: 'Always structure responses in clear, parseable JSON, never use ```json or ```python',
        VALIDATION: 'Include rationale for suggestions',
        CONTEXT: 'Reference specific script elements when possible'
    }
};

// Error Types
export const ERROR_TYPES = {
    INVALID_INTENT: 'INVALID_INTENT',
    INVALID_FORMAT: 'INVALID_FORMAT',
    MISSING_REQUIRED: 'MISSING_REQUIRED',
    CHAIN_ERROR: 'CHAIN_ERROR',
    ROUTING_ERROR: 'ROUTING_ERROR'
};

// Validation Rules
export const VALIDATION_RULES = {
    MAX_SCENE_LENGTH: 1000,
    MAX_BEAT_LENGTH: 500,
    MAX_IDEAS: 5,
    REQUIRED_FIELDS_THRESHOLD: 0.8
};