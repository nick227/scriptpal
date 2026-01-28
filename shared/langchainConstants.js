export const INTENT_TYPES = {
  SCRIPT_CONVERSATION: 'SCRIPT_CONVERSATION',
  NEXT_FIVE_LINES: 'NEXT_FIVE_LINES',
  SCRIPT_REFLECTION: 'SCRIPT_REFLECTION',
  GENERAL_CONVERSATION: 'GENERAL_CONVERSATION',
  SCENE_IDEA: 'SCENE_IDEA',
  CHARACTER_IDEA: 'CHARACTER_IDEA',
  LOCATION_IDEA: 'LOCATION_IDEA',
  THEME_IDEA: 'THEME_IDEA'
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

const normalizeAiResponse = (response) => {
  if (typeof response === 'string') {
    return { response };
  }

  if (!response || typeof response !== 'object') {
    return {};
  }

  if (Object.prototype.hasOwnProperty.call(response, 'response')) {
    return response;
  }

  if (Object.prototype.hasOwnProperty.call(response, 'content')) {
    const { content, ...rest } = response;
    return { ...rest, response: content };
  }

  return response;
};

const extractFormattedScript = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return '';
  }
  return (
    payload.metadata?.formattedScript ||
    payload.formattedScript ||
    ''
  );
};

export const OUTPUT_CONTRACTS = {
  NEXT_FIVE_LINES: {
    responseFields: ['assistantResponse'],
    metadataFields: ['formattedScript'],
    nonEmptyMetadata: ['formattedScript'],
    minLines: 2,
    maxLines: 16
  },
  APPEND_SCRIPT: {
    responseFields: [],
    metadataFields: ['formattedScript'],
    nonEmptyMetadata: ['formattedScript'],
    minLines: 12,
    maxLines: 16
  },
  SCRIPT_APPEND_PAGE: {
    responseFields: [],
    metadataFields: ['formattedScript'],
    nonEmptyMetadata: ['formattedScript'],
    minLines: 12,
    maxLines: 26
  },
  FULL_SCRIPT: {
    responseFields: [],
    metadataFields: ['formattedScript'],
    nonEmptyMetadata: ['formattedScript'],
    minLines: 40,
    maxLines: 132
  }
};

export const validateAiResponse = (intent, response) => {
  const normalized = normalizeAiResponse(response);
  const contract = OUTPUT_CONTRACTS[intent];
  if (!contract) {
    return { valid: true, errors: [] };
  }

  const errors = [];
  (contract.responseFields || []).forEach(field => {
    if (typeof normalized[field] === 'undefined') {
      errors.push(`Missing response field: ${field}`);
    }
  });

  const metadata = normalized.metadata || {};
  (contract.metadataFields || []).forEach(field => {
    if (typeof metadata[field] === 'undefined') {
      errors.push(`Missing metadata field: ${field}`);
    }
  });

  (contract.nonEmptyMetadata || []).forEach(field => {
    const value = metadata[field] || normalized[field];
    if (typeof value === 'undefined' || !String(value).trim()) {
      errors.push(`Metadata field "${field}" must be non-empty`);
    }
  });

  const formattedScript = extractFormattedScript(normalized);
  const lineCount = countScriptLines(formattedScript);
  if (typeof contract.minLines === 'number' && lineCount < contract.minLines) {
    errors.push(`Formatted script line count ${lineCount} below minimum ${contract.minLines}`);
  }
  if (typeof contract.maxLines === 'number' && lineCount > contract.maxLines) {
    errors.push(`Formatted script line count ${lineCount} above maximum ${contract.maxLines}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    formattedScript,
    lineCount
  };
};
