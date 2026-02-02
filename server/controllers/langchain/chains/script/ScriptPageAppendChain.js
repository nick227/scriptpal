import { BaseChain } from '../base/BaseChain.js';
import { SCRIPT_CONTEXT_PREFIX, VALID_FORMAT_VALUES } from '../../constants.js';
import { getPromptById } from '../../../../../shared/promptRegistry.js';
import { buildScriptHeader } from '../helpers/ScriptPromptUtils.js';
import { sanitizeScriptLines } from '../helpers/ScriptSanitization.js';
import { buildContractMetadata } from '../helpers/ChainOutputGuards.js';
import { formatScriptCollections } from '../helpers/ScriptCollectionsFormatter.js';

export const APPEND_PAGE_INTENT = 'SCRIPT_APPEND_PAGE';
const LINE_MIN = 12;
const LINE_MAX = 16;
const MAX_ATTEMPTS = 3;
const MAX_CONTEXT_LINES = 30; // Smart truncation: only send recent context

// Function schema: structural only (behavioral rules live in system prompt)
const APPEND_PAGE_FUNCTIONS = [{
  name: 'provide_append_page',
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

/**
 * Smart context truncation: keep only the last N lines.
 * Reduces token usage and improves relevance.
 */
const truncateToRecentLines = (scriptContent, maxLines = MAX_CONTEXT_LINES) => {
  if (!scriptContent || typeof scriptContent !== 'string') {
    return '';
  }
  const tagPattern = /<(header|action|speaker|dialog|directions|chapter-break)>[\s\S]*?<\/\1>/g;
  const matches = scriptContent.match(tagPattern);
  if (!matches || matches.length <= maxLines) {
    return scriptContent;
  }
  return matches.slice(-maxLines).join('\n');
};

/**
 * Grammar validation: speaker must be followed by dialog.
 */
const validateScreenplayGrammar = (formattedScript) => {
  const tagSequence = [];
  const tagPattern = /<(header|action|speaker|dialog|directions|chapter-break)>/g;
  let match;
  while ((match = tagPattern.exec(formattedScript)) !== null) {
    tagSequence.push(match[1]);
  }

  for (let i = 0; i < tagSequence.length; i++) {
    if (tagSequence[i] === 'speaker') {
      const next = tagSequence[i + 1];
      const afterNext = tagSequence[i + 2];
      if (next !== 'dialog' && !(next === 'directions' && afterNext === 'dialog')) {
        return { valid: false, error: `<speaker> at position ${i + 1} not followed by <dialog>` };
      }
    }
    if (tagSequence[i] === 'dialog') {
      const prev = tagSequence[i - 1];
      const beforePrev = tagSequence[i - 2];
      if (prev !== 'speaker' && !(prev === 'directions' && beforePrev === 'speaker')) {
        return { valid: false, error: `<dialog> at position ${i + 1} has no preceding <speaker>` };
      }
    }
  }
  return { valid: true };
};

const APPEND_PAGE_PROMPT = getPromptById('append-page');

if (!APPEND_PAGE_PROMPT) {
  throw new Error('Append page prompt definition is missing from the registry');
}

const SYSTEM_INSTRUCTION = APPEND_PAGE_PROMPT.systemInstruction;
const ATTACH_SCRIPT_CONTEXT = APPEND_PAGE_PROMPT.attachScriptContext ?? true;

export class ScriptPageAppendChain extends BaseChain {
  constructor() {
    super({
      type: APPEND_PAGE_INTENT,
      temperature: 0.4,
      modelConfig: {
        response_format: { type: 'json_object' },
        functions: APPEND_PAGE_FUNCTIONS,
        function_call: { name: 'provide_append_page' }
      }
    });
  }

  addCommonInstructions(messages) {
    return messages;
  }

  buildMessages(context, prompt, retryNote = '') {
    const userPrompt = retryNote
      ? `${prompt}\n\nCorrection: ${retryNote}`
      : prompt;
    const shouldAttachScriptContext = context?.attachScriptContext ?? ATTACH_SCRIPT_CONTEXT;

    // Smart context truncation: only send last N lines
    const truncatedContent = shouldAttachScriptContext
      ? truncateToRecentLines(context.scriptContent, MAX_CONTEXT_LINES)
      : '';

    const scriptHeader = buildScriptHeader(context?.scriptTitle, context?.scriptDescription);
    const collectionBlock = formatScriptCollections(context?.scriptCollections);
    const scriptContentBlock = truncatedContent
      ? `${SCRIPT_CONTEXT_PREFIX}\n${truncatedContent}`
      : '';

    const contextBlocks = [collectionBlock, scriptContentBlock].filter(Boolean).join('\n\n');
    const content = contextBlocks
      ? `${userPrompt}\n\n${scriptHeader}\n\n${contextBlocks}`
      : userPrompt;

    const systemInstruction = context?.systemInstruction || SYSTEM_INSTRUCTION;

    return [{
      role: 'system',
      content: systemInstruction
    }, {
      role: 'user',
      content: content
    }];
  }

  validateAppendText(text) {
    if (!text || typeof text !== 'string') {
      return { ok: false, reason: 'Empty response' };
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return { ok: false, reason: 'Empty response' };
    }

    if (trimmed.includes('```')) {
      return { ok: false, reason: 'Contains code fences' };
    }

    const lines = trimmed
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length < LINE_MIN || lines.length > LINE_MAX) {
      return {
        ok: false,
        reason: `Line count ${lines.length} (expected ${LINE_MIN}-${LINE_MAX})`
      };
    }

    return { ok: true, lineCount: lines.length };
  }

  normalizeAppendText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/<chapter-break\s*\/>/gi, '<chapter-break></chapter-break>')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  }

  formatResponse(responseText, context, lineCount, validationError, assistantResponse = '') {
    const responseContent = assistantResponse && assistantResponse.trim()
      ? assistantResponse.trim()
      : responseText;

    // Grammar validation (log but don't fail)
    const grammarResult = validateScreenplayGrammar(responseText);
    if (!grammarResult.valid) {
      console.warn('[ScriptPageAppendChain] Grammar validation failed:', grammarResult);
    }

    const metadata = {
      ...this.extractMetadata(context, ['scriptId', 'scriptTitle']),
      appendPage: true,
      formattedScript: responseText,
      lineCount: lineCount || null,
      grammarValid: grammarResult.valid,
      grammarError: grammarResult.error || null,
      timestamp: new Date().toISOString()
    };

    if (validationError) {
      metadata.validationError = validationError;
    }

    const response = {
      response: responseContent,
      assistantResponse: responseContent,
      type: APPEND_PAGE_INTENT,
      metadata: {
        ...metadata
      }
    };
    Object.assign(response.metadata, buildContractMetadata(APPEND_PAGE_INTENT, response));
    return response;
  }

  async run(context, prompt) {
    let lastError = '';
    let lastResponseText = '';
    let lastAssistantResponse = '';

    const maxAttempts = Number.isInteger(context?.maxAttempts) ? context.maxAttempts : MAX_ATTEMPTS;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const retryNote = lastError
        ? `${lastError}. Respond only in JSON with "formattedScript" and "assistantResponse". Return 12-16 tagged lines using: ${VALID_FORMAT_VALUES.join(', ')}.`
        : '';
      const messages = await this.buildMessages(context, prompt, retryNote);
      const response = await this.execute(messages, {
        ...context,
        chainConfig: {
          ...context.chainConfig,
          shouldGenerateQuestions: false
        }
      }, false);

      let validated = null;
      try {
        validated = this.parseFunctionPayload(response, {
          required: ['formattedScript', 'assistantResponse']
        }, 'Invalid JSON payload from function call');
      } catch (error) {
        lastError = error.message || 'Invalid append payload';
        console.warn('[ScriptPageAppendChain] Invalid append payload', {
          attempt,
          error: lastError
        });
        continue;
      }

      const formattedScript = typeof validated.formattedScript === 'string'
        ? validated.formattedScript
        : JSON.stringify(validated.formattedScript);
      lastAssistantResponse = typeof validated.assistantResponse === 'string'
        ? validated.assistantResponse
        : '';
      lastResponseText = this.normalizeAppendText(formattedScript);
      const { lines: sanitizedLines, stats } = sanitizeScriptLines(lastResponseText, VALID_FORMAT_VALUES);
      if (stats.invalidTagCount || stats.coercedCount || stats.droppedCount) {
        console.warn('[ScriptPageAppendChain] Sanitized AI output', stats);
      }
      if (sanitizedLines.length > LINE_MAX) {
        console.warn('[ScriptPageAppendChain] Truncating lines to max', {
          originalCount: sanitizedLines.length,
          max: LINE_MAX
        });
      }
      const finalLines = sanitizedLines.slice(0, LINE_MAX);
      if (finalLines.length >= LINE_MIN) {
        const finalText = finalLines.join('\n');
        const validation = this.validateAppendText(finalText);
        if (validation.ok) {
          return this.formatResponse(finalText, context, validation.lineCount, null, lastAssistantResponse);
        }
        console.warn('[ScriptPageAppendChain] Validation failed after sanitize', {
          attempt,
          reason: validation.reason
        });
        lastError = validation.reason;
      } else {
        lastError = `Line count ${finalLines.length} (expected ${LINE_MIN}-${LINE_MAX})`;
        console.warn('[ScriptPageAppendChain] Validation failed', {
          attempt,
          reason: lastError
        });
      }
    }

    throw new Error(`append_validation_failed: ${lastError}`);
  }
}
