import { BaseChain } from '../base/BaseChain.js';
import { SCRIPT_CONTEXT_PREFIX, VALID_FORMAT_VALUES } from '../../constants.js';
import { buildScriptHeader } from '../helpers/ScriptPromptUtils.js';
import { buildContractMetadata } from '../helpers/ChainOutputGuards.js';
import { formatScriptCollections } from '../helpers/ScriptCollectionsFormatter.js';

export const FULL_SCRIPT_INTENT = 'SCRIPT_FULL_SCRIPT';

const MIN_PAGES = 5;
const MAX_PAGES = 6;
const MIN_LINES_PER_PAGE = 14;
const MAX_LINES_PER_PAGE = 18;
const LINE_MIN = MIN_PAGES * MIN_LINES_PER_PAGE;
const LINE_MAX = MAX_PAGES * MAX_LINES_PER_PAGE;
const ALLOWED_TAGS = new Set([...VALID_FORMAT_VALUES, 'chapter-break']);
const ALLOWED_TAGS_LIST = Array.from(ALLOWED_TAGS);

const FULL_SCRIPT_FUNCTIONS = [{
  name: 'provide_full_script',
  description: 'Return new script pages plus a short chat response.',
  parameters: {
    type: 'object',
    properties: {
      lines: {
        type: 'array',
        minItems: LINE_MIN,
        maxItems: LINE_MAX,
        description: 'Screenplay lines for the next pages.',
        items: {
          type: 'object',
          properties: {
            tag: {
              type: 'string',
              enum: ALLOWED_TAGS_LIST,
              description: 'Screenplay tag for this line.'
            },
            text: {
              type: 'string',
              minLength: 1,
              description: 'Content of the line only.'
            }
          },
          required: ['tag', 'text'],
          additionalProperties: false
        }
      },
      assistantResponse: {
        type: 'string',
        description: 'Short, simple chat response under 40 words.'
      }
    },
    required: ['lines', 'assistantResponse'],
    additionalProperties: false
  }
}];

const SYSTEM_INSTRUCTION = `You are a screenplay architect.
- Respond only in JSON with two keys: "lines" and "assistantResponse".
  - "lines" must contain 5-6 new pages of screenplay beats using valid tags (${VALID_FORMAT_VALUES.join(', ')} and <chapter-break></chapter-break>).
  - Each page must contain between ${MIN_LINES_PER_PAGE} and ${MAX_LINES_PER_PAGE} lines.
  - Treat each "<chapter-break></chapter-break>" as an explicit page boundary.
  - "assistantResponse" should be a short, simple chat response (under 40 words).
- Focus on a clear story arc (setup, escalation, turning point, resolution).
- Do not rewrite what has already happened; pick up exactly where the script left off.
- Do not include markdown, commentary, numbering, or prose outside the JSON envelope.`;

const escapeLineText = (text) => (
  text.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
);

const renderLinesToXml = (lines) => (
  lines.map(line => `<${line.tag}>${escapeLineText(line.text)}</${line.tag}>`).join('\n')
);

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

  buildMessages(context, prompt) {
    const userPrompt = prompt;
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

  validateScriptLines(lines) {
    if (!Array.isArray(lines)) {
      return { ok: false, reason: 'Lines missing' };
    }

    const lineCount = lines.length;
    const chapterBreakCount = lines
      .filter((line) => {
        const tag = typeof line?.tag === 'string' ? line.tag.toLowerCase() : '';
        return tag === 'chapter-break';
      })
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
    // Default chat message if AI didn't provide one - never use script content as chat message
    const lineCount = validation?.lineCount || 'several';
    const defaultMessage = `Generated ${lineCount} lines for your script.`;
    const chatMessage = assistantResponse && assistantResponse.trim()
      ? assistantResponse.trim()
      : defaultMessage;
    
    const metadata = {
      ...this.extractMetadata(context, ['scriptId', 'scriptTitle']),
      fullScript: true,
      timestamp: new Date().toISOString()
    };
    if (validation?.lineCount) {
      metadata.lineCount = validation.lineCount;
    }
    if (validation?.pageCount) {
      metadata.pageCount = validation.pageCount;
    }

    const canonical = {
      message: chatMessage,
      script: responseText,
      metadata
    };
    Object.assign(canonical.metadata, buildContractMetadata(FULL_SCRIPT_INTENT, canonical));
    return this.ensureCanonicalResponse(canonical);
  }

  async run(context, prompt) {
    const messages = await this.buildMessages(context, prompt);
    const response = await this.execute(messages, context, false);

    const payload = this.parseFunctionPayload(response, {
      required: ['lines', 'assistantResponse']
    }, 'Invalid JSON payload from function call');

    const rawLines = Array.isArray(payload.lines) ? payload.lines : [];
    const normalizedLines = rawLines
      .map(line => ({
        tag: typeof line?.tag === 'string' ? line.tag.toLowerCase() : '',
        text: typeof line?.text === 'string' ? line.text.trim() : ''
      }))
      .filter(line => ALLOWED_TAGS.has(line.tag) && line.text.length > 0);

    if (!normalizedLines.length || normalizedLines[0]?.tag === 'chapter-break') {
      throw new Error('Script cannot start with chapter-break');
    }

    for (let i = 1; i < normalizedLines.length; i += 1) {
      if (
        normalizedLines[i].tag === 'chapter-break' &&
        normalizedLines[i - 1].tag === 'chapter-break'
      ) {
        throw new Error('Consecutive chapter-break tags');
      }
    }

    const validation = this.validateScriptLines(normalizedLines);
    if (!validation.ok) {
      throw new Error(validation.reason || 'full_script_validation_failed');
    }

    const script = renderLinesToXml(normalizedLines);
    const assistantResponse = typeof payload.assistantResponse === 'string'
      ? payload.assistantResponse.trim()
      : '';

    return this.formatResponse(script, context, validation, assistantResponse);
  }
}
