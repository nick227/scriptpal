import { BaseChain } from '../base/BaseChain.js';
import { VALID_FORMAT_VALUES } from '../../constants.js';
import { getPromptById } from '../../../../../shared/promptRegistry.js';
import { buildScriptHeader } from '../helpers/ScriptPromptUtils.js';
import { buildContractMetadata } from '../helpers/ChainOutputGuards.js';

export const APPEND_PAGE_INTENT = 'SCRIPT_APPEND_PAGE';

const LINE_MIN = 12;
const LINE_MAX = 16;
const MAX_CONTEXT_LINES = 30;
const MAX_ATTEMPTS = 3;

export const PAGE_APPEND_MAX_ATTEMPTS = MAX_ATTEMPTS;

// ─────────────────────────────────────────────────────────────
// Function schema: structural only (no grammar enforcement)
// ─────────────────────────────────────────────────────────────
const APPEND_PAGE_FUNCTIONS = [{
  name: 'provide_append_page',
  description: 'Append a new page of screenplay lines.',
  parameters: {
    type: 'object',
    properties: {
      lines: {
        type: 'array',
        minItems: LINE_MIN,
        maxItems: LINE_MAX,
        description: 'Screenplay lines to append, in natural order.',
        items: {
          type: 'object',
          properties: {
            tag: {
              type: 'string',
              enum: VALID_FORMAT_VALUES,
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
        description: 'Brief explanation.'
      }
    },
    required: ['lines', 'assistantResponse'],
    additionalProperties: false
  }
}];

// ─────────────────────────────────────────────────────────────
// Context helpers
// ─────────────────────────────────────────────────────────────
const truncateToRecentLines = (scriptContent, maxLines = MAX_CONTEXT_LINES) => {
  if (!scriptContent || typeof scriptContent !== 'string') return '';

  const tagPattern = /<(header|action|speaker|dialog|directions|chapter-break)>[\s\S]*?<\/\1>/g;
  const matches = scriptContent.match(tagPattern);
  if (!matches || matches.length <= maxLines) return scriptContent;

  let recent = matches.slice(-maxLines);

  // preserve speaker → dialog boundary
  const first = recent[0];
  if (first && (first.startsWith('<dialog>') || first.startsWith('<directions>'))) {
    const idx = matches.length - maxLines;
    if (idx > 0 && matches[idx - 1]?.startsWith('<speaker>')) {
      recent = [matches[idx - 1], ...recent];
    }
  }

  return recent.join('\n');
};

const CONTINUATION_BIAS = {
  header: 'After a header, action or a speaker usually follows.',
  action: 'Action often continues or introduces a speaker.',
  speaker: 'A speaker is typically followed by dialog.',
  dialog: 'Dialog often transitions to action or another speaker.',
  directions: 'Directions usually lead into dialog.',
  'chapter-break': 'After a chapter break, a new header usually follows.'
};

const analyzeContinuationBias = (truncatedContent) => {
  if (!truncatedContent) return '';

  const tagPattern = /<(header|action|speaker|dialog|directions|chapter-break)>/g;
  const matches = [...truncatedContent.matchAll(tagPattern)];
  if (!matches.length) return '';

  const lastTag = matches[matches.length - 1][1];
  const note = CONTINUATION_BIAS[lastTag];
  return note
    ? `Continuation hint (last line <${lastTag}>): ${note}`
    : '';
};

const renderLines = (lines) =>
  lines.map(l => `<${l.tag}>${l.text}</${l.tag}>`).join('\n');

// ─────────────────────────────────────────────────────────────
// Prompt wiring
// ─────────────────────────────────────────────────────────────
const APPEND_PAGE_PROMPT = getPromptById('append-page');
if (!APPEND_PAGE_PROMPT) {
  throw new Error('Append page prompt definition is missing from the registry');
}

const SYSTEM_INSTRUCTION = APPEND_PAGE_PROMPT.systemInstruction;
const ATTACH_SCRIPT_CONTEXT = APPEND_PAGE_PROMPT.attachScriptContext ?? true;

// ─────────────────────────────────────────────────────────────
// Chain
// ─────────────────────────────────────────────────────────────
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

  buildMessages(context, prompt, retryNote = '', precomputed = {}) {
    const truncatedContent = precomputed.truncatedContent ?? (
      (context?.attachScriptContext ?? ATTACH_SCRIPT_CONTEXT)
        ? truncateToRecentLines(context.scriptContent, MAX_CONTEXT_LINES)
        : ''
    );

    const continuationHint =
      precomputed.continuationHint ?? analyzeContinuationBias(truncatedContent);

    const scriptHeader = buildScriptHeader(
      context?.scriptTitle,
      context?.scriptDescription
    );

    const parts = [];

    parts.push(prompt);
    parts.push(
      `Return ${LINE_MIN}-${LINE_MAX} new screenplay lines using the function schema.`,
      `Do not repeat any existing lines.`
    );

    // Scene continuity bias (append-page specific)
    parts.push(
      `Scene continuity note:
A new page does NOT automatically mean a new scene.
Only introduce a <header> if the context clearly implies a scene change.`
    );

    if (continuationHint) parts.push(continuationHint);
    if (retryNote) parts.push(retryNote);

    parts.push(scriptHeader);

    if (truncatedContent) {
      parts.push(
        `Most recent script context (continue naturally after this point):\n\n${truncatedContent}`
      );
    } else {
      parts.push('No existing script content. Start fresh.');
    }

    return [{
      role: 'system',
      content: context?.systemInstruction || SYSTEM_INSTRUCTION
    }, {
      role: 'user',
      content: parts.join('\n\n')
    }];
  }

  async run(context, prompt) {
    let lastError = '';

    const shouldAttach = context?.attachScriptContext ?? ATTACH_SCRIPT_CONTEXT;
    const truncatedContent = shouldAttach
      ? truncateToRecentLines(context.scriptContent, MAX_CONTEXT_LINES)
      : '';

    const precomputed = {
      truncatedContent,
      continuationHint: analyzeContinuationBias(truncatedContent)
    };

    const maxAttempts =
      Number.isInteger(context?.maxAttempts)
        ? context.maxAttempts
        : MAX_ATTEMPTS;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const retryNote = lastError
        ? `Previous issue: ${lastError}. Please continue cleanly.`
        : '';

      const messages = await this.buildMessages(
        context,
        prompt,
        retryNote,
        precomputed
      );

      const response = await this.execute(messages, context, false);

      let payload;
      try {
        payload = this.parseFunctionPayload(
          response,
          { required: ['lines', 'assistantResponse'] },
          'Invalid append-page payload'
        );
      } catch (err) {
        lastError = err.message;
        continue;
      }

      const lines = Array.isArray(payload.lines) ? payload.lines : [];
      if (lines.length < LINE_MIN) {
        lastError = `Too few lines (${lines.length}, expected ${LINE_MIN}-${LINE_MAX})`;
        continue;
      }

      const finalLines = lines.slice(0, LINE_MAX);
      const script = renderLines(finalLines);

      if (!script.trim()) {
        lastError = 'Empty script output';
        continue;
      }

      const message = payload.assistantResponse?.trim()
        || `Added ${finalLines.length} lines to your script.`;

      const metadata = {
        ...this.extractMetadata(context, ['scriptId', 'scriptTitle']),
        appendPage: true,
        lineCount: finalLines.length,
        timestamp: new Date().toISOString()
      };

      const result = {
        message,
        script,
        type: APPEND_PAGE_INTENT,
        metadata
      };

      Object.assign(
        result.metadata,
        buildContractMetadata(APPEND_PAGE_INTENT, result)
      );

      this.ensureCanonicalResponse(result);

      return result;
    }

    throw new Error(`append_page_failed: ${lastError}`);
  }
}
