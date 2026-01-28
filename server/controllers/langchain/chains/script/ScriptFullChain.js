import { BaseChain } from '../base/BaseChain.js';
import { SCRIPT_CONTEXT_PREFIX, VALID_FORMAT_VALUES } from '../../constants.js';
import { buildScriptHeader } from '../helpers/ScriptPromptUtils.js';
import { sanitizeScriptLines } from '../helpers/ScriptSanitization.js';
import { buildContractMetadata } from '../helpers/ChainOutputGuards.js';
import { formatScriptCollections } from '../helpers/ScriptCollectionsFormatter.js';

export const FULL_SCRIPT_INTENT = 'SCRIPT_FULL_SCRIPT';

const MIN_PAGES = 5;
const MAX_PAGES = 6;
const MIN_LINES_PER_PAGE = 12;
const MAX_LINES_PER_PAGE = 22;
const LINE_MIN = MIN_PAGES * MIN_LINES_PER_PAGE;
const LINE_MAX = MAX_PAGES * MAX_LINES_PER_PAGE;
const MAX_ATTEMPTS = 1;
const FULL_SCRIPT_FUNCTIONS = [{
  name: 'provide_full_script',
  description: 'Return new script pages plus a short chat response.',
  parameters: {
    type: 'object',
    properties: {
      formattedScript: {
        type: 'string',
        description: 'New script lines wrapped in validated tags (<header>, <action>, <speaker>, <dialog>, <directions>, <chapter-break>).'
      },
      assistantResponse: {
        type: 'string',
        description: 'Short, simple chat response under 40 words.'
      }
    },
    required: ['formattedScript', 'assistantResponse']
  }
}];

const SYSTEM_INSTRUCTION = `You are a screenplay architect.
- Respond only in JSON with two keys: "formattedScript" and "assistantResponse".
  - "formattedScript" must contain 5-6 new pages of script lines using valid tags (${VALID_FORMAT_VALUES.join(', ')} and <chapter-break></chapter-break>).
  - Treat each "<chapter-break></chapter-break>" as a page boundary and deliver roughly 15-16 lines per page.
  - "assistantResponse" should be a short, simple chat response (under 40 words).
- Escape any double quotes inside JSON strings as \\".
- Focus on a clear story arc (setup, escalation, turning point, resolution).
- Do not rewrite what has already happened; pick up exactly where the script left off.
- Do not include markdown, commentary, numbering, or prose outside the JSON envelope.`;

export class ScriptFullChain extends BaseChain {
  constructor() {
    super({
      type: FULL_SCRIPT_INTENT,
      temperature: 0.45,
      modelConfig: {
        response_format: { type: 'json_object' },
        functions: FULL_SCRIPT_FUNCTIONS,
        function_call: { name: 'provide_full_script' }
      }
    });
  }

  buildMessages(context, prompt, retryNote = '') {
    const userPrompt = retryNote ? `${prompt}\n\nCorrection: ${retryNote}` : prompt;
    const scriptContent = context?.scriptContent || '';
    const scriptHeader = buildScriptHeader(context?.scriptTitle, context?.scriptDescription);
    const collectionBlock = formatScriptCollections(context?.scriptCollections);
    const contextBlocks = [
      collectionBlock,
      scriptContent ? `${SCRIPT_CONTEXT_PREFIX}\n${scriptContent}` : ''
    ].filter(Boolean).join('\n\n');
    const content = contextBlocks
      ? `${userPrompt}\n\n${scriptHeader}\n\n${contextBlocks}`
      : userPrompt;

    const systemInstruction = context?.systemInstruction || SYSTEM_INSTRUCTION;

    return [{
      role: 'system',
      content: systemInstruction
    }, {
      role: 'user',
      content
    }];
  }

  normalizeScriptText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/<chapter-break\s*\/>/gi, '<chapter-break></chapter-break>')
      .trim();
  }

  validateScriptLines(lines) {
    if (!Array.isArray(lines)) {
      return { ok: false, reason: 'Lines missing' };
    }

    const lineCount = lines.length;
    const chapterBreakCount = lines
      .filter(line => line.toLowerCase().startsWith('<chapter-break'))
      .length;
    const pageCount = chapterBreakCount + 1;

    if (lineCount < LINE_MIN) {
      return { ok: false, reason: `Line count ${lineCount} below minimum ${LINE_MIN}`, lineCount, pageCount };
    }

    if (lineCount > LINE_MAX) {
      return { ok: false, reason: `Line count ${lineCount} above maximum ${LINE_MAX}`, lineCount, pageCount };
    }

    if (pageCount < MIN_PAGES) {
      return { ok: false, reason: `Page count ${pageCount} below minimum ${MIN_PAGES}`, lineCount, pageCount };
    }

    if (pageCount > MAX_PAGES) {
      return { ok: false, reason: `Page count ${pageCount} above maximum ${MAX_PAGES}`, lineCount, pageCount };
    }

    return { ok: true, lineCount, pageCount };
  }

  formatResponse(responseText, context, validation, assistantResponse = '') {
    const responseContent = assistantResponse && assistantResponse.trim()
      ? assistantResponse.trim()
      : responseText;
    const metadata = {
      ...this.extractMetadata(context, ['scriptId', 'scriptTitle']),
      fullScript: true,
      formattedScript: responseText,
      timestamp: new Date().toISOString()
    };
    if (validation?.lineCount) {
      metadata.lineCount = validation.lineCount;
    }
    if (validation?.pageCount) {
      metadata.pageCount = validation.pageCount;
    }

    const response = {
      response: responseContent,
      assistantResponse: responseContent,
      type: FULL_SCRIPT_INTENT,
      metadata
    };
    Object.assign(response.metadata, buildContractMetadata(FULL_SCRIPT_INTENT, response));
    return response;
  }

  async run(context, prompt) {
    let lastError = '';
    let lastResponseText = '';
    let lastAssistantResponse = '';

    const maxAttempts = Number.isInteger(context?.maxAttempts) ? context.maxAttempts : MAX_ATTEMPTS;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const retryNote = lastError
        ? `${lastError}. Respond only in JSON with "formattedScript" and "assistantResponse". Return exactly ${MIN_PAGES}-${MAX_PAGES} pages separated by <chapter-break></chapter-break> while keeping valid tags (${VALID_FORMAT_VALUES.join(', ')}).`
        : '';
      const messages = await this.buildMessages(context, prompt, retryNote);
      const response = await this.execute(messages, context, false);

      let validated = null;
      try {
        validated = this.parseFunctionPayload(response, {
          required: ['formattedScript', 'assistantResponse']
        }, 'Invalid JSON payload from function call');
      } catch (error) {
        lastError = error.message || 'Invalid full script payload';
        console.warn('[ScriptFullChain] Invalid full script payload', { attempt, error: lastError });
        continue;
      }

      const formattedScript = typeof validated.formattedScript === 'string'
        ? validated.formattedScript
        : JSON.stringify(validated.formattedScript);
      lastAssistantResponse = typeof validated.assistantResponse === 'string'
        ? validated.assistantResponse
        : '';
      lastResponseText = this.normalizeScriptText(formattedScript);
      const { lines: sanitizedLines, stats } = sanitizeScriptLines(lastResponseText, VALID_FORMAT_VALUES);
      if (stats.invalidTagCount || stats.coercedCount || stats.droppedCount) {
        console.warn('[ScriptFullChain] Sanitized AI output', stats);
      }

      if (sanitizedLines.length > LINE_MAX) {
        console.warn('[ScriptFullChain] Truncating lines to maximum', {
          originalCount: sanitizedLines.length,
          max: LINE_MAX
        });
      }

      const finalLines = sanitizedLines.slice(0, LINE_MAX);
      const validation = this.validateScriptLines(finalLines);

      if (validation.ok) {
        const finalText = finalLines.join('\n');
        return this.formatResponse(finalText, context, validation, lastAssistantResponse);
      }

      lastError = validation.reason || 'Validation failure';
      console.warn('[ScriptFullChain] Validation failed', { attempt, reason: lastError });
    }

    throw new Error(`full_script_validation_failed: ${lastError}`);
  }
}
