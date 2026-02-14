export const INTENT_TYPES = {
  SCRIPT_CONVERSATION: 'SCRIPT_CONVERSATION',
  NEXT_FIVE_LINES: 'NEXT_FIVE_LINES',
  SCRIPT_REFLECTION: 'SCRIPT_REFLECTION',
  GENERAL_CONVERSATION: 'GENERAL_CONVERSATION',
  SCENE_IDEA: 'SCENE_IDEA',
  CHARACTER_IDEA: 'CHARACTER_IDEA',
  LOCATION_IDEA: 'LOCATION_IDEA',
  THEME_IDEA: 'THEME_IDEA',
  OUTLINE_IDEA: 'OUTLINE_IDEA',
  BRAINSTORM_GENERAL: 'BRAINSTORM_GENERAL',
  BRAINSTORM_STORY: 'BRAINSTORM_STORY',
  BRAINSTORM_CHARACTER: 'BRAINSTORM_CHARACTER',
  BRAINSTORM_LOCATION: 'BRAINSTORM_LOCATION',
  BRAINSTORM_TITLE: 'BRAINSTORM_TITLE'
};

export const SCRIPT_MUTATION = {
  NONE: 'NONE',
  APPEND: 'APPEND'
};

export const SCRIPT_CONTEXT_PREFIX = 'SCRIPT CONTEXT (do not repeat or rewrite existing lines):';

export const VALID_FORMATS = Object.freeze({
  HEADER: 'header',
  ACTION: 'action',
  SPEAKER: 'speaker',
  DIALOG: 'dialog',
  DIRECTIONS: 'directions',
  CHAPTER_BREAK: 'chapter-break'
});

export const VALID_FORMAT_VALUES = Object.freeze(Object.values(VALID_FORMATS));

// ═══════════════════════════════════════════════════════════════════════════
// SCREENPLAY GRAMMAR CONTRACT (v1)
// This is the AI → Editor contract. Reference in all generation prompts.
// ═══════════════════════════════════════════════════════════════════════════

export const VALID_TAGS_BLOCK = `VALID TAGS
<header>   Scene heading (INT./EXT. LOCATION - TIME)
<action>   Description of what happens
<speaker>  Character name in CAPS
<dialog>   Spoken words
`;

export const SCREENPLAY_GRAMMAR_V1 = `SCREENPLAY GRAMMAR (enforced)
1. <speaker> MUST be followed by <dialog>
2. Never output <dialog> without a preceding <speaker>
4. <action> stands alone — describes visuals, not speech
5. Each XML tag = 1 line`;

export const JSON_ESCAPE_RULE = 'Output JSON only — no markdown, no extra text.';

const countScriptLines = (text) => {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .length;
};

/**
 * Normalize AI response to canonical shape (v2).
 */
const normalizeAiResponse = (response) => {
  if (!response) return { message: null, script: null, metadata: {} };
  
  if (typeof response === 'string') {
    return { message: response, script: null, metadata: {} };
  }

  if (typeof response === 'object') { 
    return {
      message: response.message || null,
      script: response.script || null,
      metadata: response.metadata || {}
    };
  }

  return { message: null, script: null, metadata: {} };
};

/**
 * Extract script from canonical response (v2).
 */
const extractFormattedScript = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return '';
  }
  // CANONICAL: use script field
  return payload.script || '';
};

// OUTPUT CONTRACTS (v2) - uses canonical fields
export const OUTPUT_CONTRACTS = {
  NEXT_FIVE_LINES: {
    responseFields: ['message'],
    scriptRequired: true,
    minLines: 2,
    maxLines: 16
  },
  APPEND_SCRIPT: {
    responseFields: [],
    scriptRequired: true,
    minLines: 12,
    maxLines: 16
  },
  SCRIPT_APPEND_PAGE: {
    responseFields: [],
    scriptRequired: true,
    minLines: 12,
    maxLines: 26
  },
  FULL_SCRIPT: {
    responseFields: [],
    scriptRequired: true,
    minLines: 40,
    maxLines: 132
  }
};

/**
 * Validate AI response against contract (v2 - canonical fields).
 */
export const validateAiResponse = (intent, response) => {
  const normalized = normalizeAiResponse(response);
  const contract = OUTPUT_CONTRACTS[intent];
  if (!contract) {
    return { valid: true, errors: [] };
  }

  const errors = [];

  // Validate required response fields (e.g., message)
  (contract.responseFields || []).forEach(field => {
    if (!normalized[field]) {
      errors.push(`Missing response field: ${field}`);
    }
  });

  // Validate script is present if required
  if (contract.scriptRequired && !normalized.script) {
    errors.push('Missing required script field');
  }

  // Validate line count
  const script = extractFormattedScript(normalized);
  const lineCount = countScriptLines(script);
  if (typeof contract.minLines === 'number' && lineCount < contract.minLines) {
    errors.push(`Script line count ${lineCount} below minimum ${contract.minLines}`);
  }
  if (typeof contract.maxLines === 'number' && lineCount > contract.maxLines) {
    errors.push(`Script line count ${lineCount} above maximum ${contract.maxLines}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    script,
    lineCount
  };
};
