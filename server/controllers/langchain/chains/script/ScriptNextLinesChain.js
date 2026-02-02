import { BaseChain } from '../base/BaseChain.js';
import { INTENT_TYPES, SCRIPT_CONTEXT_PREFIX, VALID_FORMAT_VALUES } from '../../constants.js';
import { buildScriptHeader } from '../helpers/ScriptPromptUtils.js';
import { buildContractMetadata, validateAiResponse } from '../helpers/ChainOutputGuards.js';
import { normalizeFormattedScript } from '../../../../lib/scriptFormatter.js';
import { formatScriptCollections } from '../helpers/ScriptCollectionsFormatter.js';

// Function schema: structural only, no behavioral rules (those live in system prompt)
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

const EXPECTED_LINE_COUNT = 5;
const MAX_CONTEXT_LINES = 20; // Only send last N lines for better relevance & lower tokens
const VALID_TAGS_PATTERN = new RegExp(`<(${VALID_FORMAT_VALUES.join('|')})>`, 'g');

/**
 * Smart context truncation: keep only the last N lines.
 * Reduces token usage and improves relevance.
 * @param {string} scriptContent - Full script content
 * @param {number} maxLines - Maximum lines to keep
 * @returns {string} - Truncated content
 */
const truncateToRecentLines = (scriptContent, maxLines = MAX_CONTEXT_LINES) => {
  if (!scriptContent || typeof scriptContent !== 'string') {
    return '';
  }

  // Split by line tags to count actual script lines
  const tagPattern = /<(header|action|speaker|dialog|directions|chapter-break)>[\s\S]*?<\/\1>/g;
  const matches = scriptContent.match(tagPattern);

  if (!matches || matches.length <= maxLines) {
    return scriptContent;
  }

  // Keep only the last N lines
  const recentLines = matches.slice(-maxLines);
  return recentLines.join('\n');
};

/**
 * Hard validation: exactly 5 lines required.
 * @param {string} formattedScript
 * @returns {{valid: boolean, count: number, error?: string}}
 */
const validateLineCount = (formattedScript) => {
  const matches = formattedScript.match(VALID_TAGS_PATTERN);
  const count = matches ? matches.length : 0;
  if (count !== EXPECTED_LINE_COUNT) {
    return {
      valid: false,
      count,
      error: `Expected ${EXPECTED_LINE_COUNT} lines, got ${count}`
    };
  }
  return { valid: true, count };
};

/**
 * Grammar validation: speaker must be followed by dialog.
 * @param {string} formattedScript
 * @returns {{valid: boolean, error?: string}}
 */
const validateScreenplayGrammar = (formattedScript) => {
  // Extract sequence of tags
  const tagSequence = [];
  const tagPattern = /<(header|action|speaker|dialog|directions|chapter-break)>/g;
  let match;
  while ((match = tagPattern.exec(formattedScript)) !== null) {
    tagSequence.push(match[1]);
  }

  // Rule: speaker must be followed by dialog (with optional directions in between)
  for (let i = 0; i < tagSequence.length; i++) {
    if (tagSequence[i] === 'speaker') {
      const next = tagSequence[i + 1];
      const afterNext = tagSequence[i + 2];
      // Valid: speaker → dialog, or speaker → directions → dialog
      if (next !== 'dialog' && !(next === 'directions' && afterNext === 'dialog')) {
        return {
          valid: false,
          error: `Grammar violation: <speaker> at position ${i + 1} not followed by <dialog>`
        };
      }
    }
    // Rule: dialog must have a preceding speaker
    if (tagSequence[i] === 'dialog') {
      const prev = tagSequence[i - 1];
      const beforePrev = tagSequence[i - 2];
      // Valid: speaker → dialog, or speaker → directions → dialog
      if (prev !== 'speaker' && !(prev === 'directions' && beforePrev === 'speaker')) {
        return {
          valid: false,
          error: `Grammar violation: <dialog> at position ${i + 1} has no preceding <speaker>`
        };
      }
    }
  }

  return { valid: true };
};

export class ScriptNextLinesChain extends BaseChain {
  constructor () {
    super({
      type: INTENT_TYPES.NEXT_FIVE_LINES,
      temperature: 0.4,
      modelConfig: {
        response_format: { type: 'json_object' },
        functions: NEXT_FIVE_FUNCTIONS,
        function_call: { name: 'provide_next_lines' }
      }
    });
  }

  async run (context, prompt) {
    try {
      const messages = await this.buildMessages(context, prompt);
      const rawResponse = await this.execute(messages, context, false);
      return this.formatResponse(rawResponse?.response ?? rawResponse);
    } catch (error) {
      console.error('ScriptNextLinesChain execution error:', error);
      throw error;
    }
  }

  buildMessages (context, prompt) {
    const scriptHeader = buildScriptHeader(context?.scriptTitle, context?.scriptDescription);
    const collectionBlock = formatScriptCollections(context?.scriptCollections);

    // Smart context truncation: only send last N lines
    const truncatedContent = truncateToRecentLines(context?.scriptContent, MAX_CONTEXT_LINES);
    const scriptContentBlock = truncatedContent
      ? `${SCRIPT_CONTEXT_PREFIX}\n${truncatedContent}`
      : '';

    const contextBlocks = [collectionBlock, scriptContentBlock].filter(Boolean).join('\n\n');
    const scriptContext = contextBlocks
      ? `${scriptHeader}\n\n${contextBlocks}`
      : 'No script content available.';

    const systemInstruction = context?.systemInstruction;

    // Minimal user content: task + context
    const userContent = `${prompt}\n\n${scriptContext}`;

    return [{
      role: 'system',
      content: systemInstruction
    }, {
      role: 'user',
      content: userContent
    }];
  }

  addCommonInstructions (messages) {
    return messages;
  }

  formatResponse (response) {
    const schema = { required: ['formattedScript', 'assistantResponse'] };
    const validated = this.parseFunctionPayload(response, schema, 'Invalid JSON payload from function call');
    console.log('[ScriptNextLinesChain] function payload', validated);

    const formattedScript = typeof validated.formattedScript === 'string'
      ? validated.formattedScript
      : JSON.stringify(validated.formattedScript);
    const normalizedScript = normalizeFormattedScript(formattedScript);

    if (!normalizedScript || !normalizedScript.trim()) {
      throw new Error('formatted_script_missing');
    }

    // Hard validation: exactly 5 lines
    const lineCountResult = validateLineCount(normalizedScript);
    if (!lineCountResult.valid) {
      console.warn('[ScriptNextLinesChain] Line count validation failed:', lineCountResult);
      throw new Error(`line_count_invalid: ${lineCountResult.error}`);
    }

    // Grammar validation: screenplay rules
    const grammarResult = validateScreenplayGrammar(normalizedScript);
    if (!grammarResult.valid) {
      console.warn('[ScriptNextLinesChain] Grammar validation failed:', grammarResult);
      // Log but don't fail - grammar issues are softer than line count
      // This allows graceful degradation while we tune the prompt
    }

    const baseMetadata = {
      ...(response?.metadata || {}),
      ...this.extractMetadata(response, ['scriptId', 'scriptTitle'])
    };

    const formattedResponse = {
      response: validated.assistantResponse,
      assistantResponse: validated.assistantResponse,
      type: INTENT_TYPES.NEXT_FIVE_LINES,
      metadata: {
        ...baseMetadata,
        formattedScript: normalizedScript,
        lineCount: lineCountResult.count,
        grammarValid: grammarResult.valid,
        grammarError: grammarResult.error || null,
        timestamp: new Date().toISOString()
      }
    };

    const validation = validateAiResponse(INTENT_TYPES.NEXT_FIVE_LINES, formattedResponse);
    if (!validation.valid) {
      throw new Error(`ai_response_invalid: ${validation.errors.join('; ')}`);
    }

    Object.assign(formattedResponse.metadata, buildContractMetadata(INTENT_TYPES.NEXT_FIVE_LINES, formattedResponse));
    return formattedResponse;
  }

}
