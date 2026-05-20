import { BaseChain } from '../base/BaseChain.js';
import { INTENT_TYPES, VALID_FORMAT_VALUES } from '../../constants.js';
import { buildScriptHeader } from '../helpers/ScriptPromptUtils.js';
import { normalizeLineItems, renderLinesToXml } from '../helpers/screenplayLinePayload.js';
import { buildWritingOutput, runWritingAttemptLoop } from '../helpers/writingChainRunner.js';

const LINE_MIN = 1;
const LINE_MAX = 80;
const MAX_ATTEMPTS = 3;

const REWRITE_FUNCTIONS = [{
  name: 'provide_rewrite',
  description: 'Rewrite the selected script passage.',
  parameters: {
    type: 'object',
    properties: {
      lines: {
        type: 'array',
        minItems: LINE_MIN,
        maxItems: LINE_MAX,
        items: {
          type: 'object',
          properties: {
            tag: { type: 'string', enum: VALID_FORMAT_VALUES },
            text: { type: 'string', minLength: 1 }
          },
          required: ['tag', 'text'],
          additionalProperties: false
        }
      },
      assistantResponse: { type: 'string' }
    },
    required: ['lines', 'assistantResponse'],
    additionalProperties: false
  }
}];

export class RewriteChain extends BaseChain {
  constructor () {
    super({
      type: INTENT_TYPES.REWRITE,
      temperature: 0.4,
      modelConfig: {
        response_format: { type: 'json_object' },
        functions: REWRITE_FUNCTIONS,
        function_call: { name: 'provide_rewrite' }
      }
    });
  }

  buildMessages (context, prompt, retryNote = '') {
    const scriptHeader = buildScriptHeader(context?.scriptTitle, context?.scriptDescription);
    const selection = context?.selection || '';
    const range = context?.selectionRange || null;

    const parts = [
      prompt,
      'Rewrite ONLY the selected passage. Return replacement lines using the function schema.',
      scriptHeader
    ];

    if (range) {
      parts.push(`Selection range (line indices): ${range.startLine}-${range.endLine}`);
    }

    if (selection) {
      parts.push(`Selected passage to rewrite:\n${selection}`);
    }

    if (retryNote) {
      parts.push(retryNote);
    }

    return [{
      role: 'system',
      content: context?.systemInstruction || `You rewrite a selected screenplay passage.
Output tagged XML lines only for the replacement block. assistantResponse must be brief.`
    }, {
      role: 'user',
      content: parts.join('\n\n')
    }];
  }

  async run (context, prompt) {
    const schema = { required: ['lines', 'assistantResponse'] };
    const range = context?.selectionRange;

    return runWritingAttemptLoop({
      maxAttempts: Number.isInteger(context?.maxAttempts) ? context.maxAttempts : MAX_ATTEMPTS,
      runAttempt: async ({ retryNote }) => {
        const messages = await this.buildMessages(context, prompt, retryNote);
        const raw = await this.execute(messages, context, false);
        const payload = this.parseFunctionPayload(raw, schema, 'Invalid rewrite payload');
        const items = normalizeLineItems(payload.lines);

        if (items.length < LINE_MIN) {
          throw new Error('rewrite_lines_missing');
        }

        const script = renderLinesToXml(items.slice(0, LINE_MAX));
        const formatted = buildWritingOutput({
          contractKey: INTENT_TYPES.REWRITE,
          type: INTENT_TYPES.REWRITE,
          assistantMessage: payload.assistantResponse,
          formattedScript: script,
          metadata: {
            ...this.extractMetadata(context, ['scriptId', 'scriptTitle']),
            lineCount: items.length,
            replaceStartLine: range?.startLine ?? null,
            replaceEndLine: range?.endLine ?? null,
            timestamp: new Date().toISOString()
          }
        });

        this.ensureCanonicalResponse(formatted);
        this.persistAssistantMessage(raw, formatted.message);
        return this.attachPersistedFlag(formatted, raw);
      }
    });
  }
}
