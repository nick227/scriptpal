import { BaseChain } from '../base/BaseChain.js';
import { INTENT_TYPES, VALID_FORMAT_VALUES } from '../../constants.js';
import { buildScriptHeader } from '../helpers/ScriptPromptUtils.js';
import { truncateScriptToTail } from '../../../chat/context/scriptTail.js';
import { normalizeLineItems, renderLinesToXml } from '../helpers/screenplayLinePayload.js';
import { buildWritingOutput, runWritingAttemptLoop } from '../helpers/writingChainRunner.js';

const LINE_MIN = 8;
const LINE_MAX = 48;
const MAX_CONTEXT_LINES = 30;
const MAX_ATTEMPTS = 3;

const WRITE_SCENE_FUNCTIONS = [{
  name: 'provide_scene_script',
  description: 'Write screenplay lines for one scene from the outline.',
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

const SCENE_NUMBER_PATTERN = /\bscene\s*#?\s*(\d+)\b/i;

const pickTargetSceneBlock = (sceneOutline, sceneNumber) => {
  if (!sceneOutline || typeof sceneOutline !== 'string') {
    return '';
  }
  if (!sceneNumber) {
    return sceneOutline;
  }

  const lines = sceneOutline.split('\n').filter((line) => line.trim());
  const targetPrefix = `${sceneNumber}.`;
  const block = lines.filter((line) => line.trim().startsWith(targetPrefix));
  return block.length > 0 ? block.join('\n') : sceneOutline;
};

export class WriteSceneChain extends BaseChain {
  constructor () {
    super({
      type: INTENT_TYPES.WRITE_SCENE,
      temperature: 0.4,
      modelConfig: {
        response_format: { type: 'json_object' },
        functions: WRITE_SCENE_FUNCTIONS,
        function_call: { name: 'provide_scene_script' }
      }
    });
  }

  buildMessages (context, prompt, retryNote = '') {
    const scriptHeader = buildScriptHeader(context?.scriptTitle, context?.scriptDescription);
    const tail = truncateScriptToTail(context?.scriptContent || '', MAX_CONTEXT_LINES);
    const sceneMatch = typeof prompt === 'string' ? prompt.match(SCENE_NUMBER_PATTERN) : null;
    const sceneNumber = sceneMatch ? Number(sceneMatch[1]) : null;
    const targetScene = pickTargetSceneBlock(context?.sceneOutline, sceneNumber);

    const parts = [
      prompt,
      `Write screenplay lines for the target scene only (${LINE_MIN}-${LINE_MAX} lines).`,
      'Use the function schema. Do not repeat existing script lines.',
      scriptHeader,
      `Target scene from outline:\n${targetScene}`
    ];

    if (tail) {
      parts.push(`Recent script tail (continue naturally after this):\n${tail}`);
    }

    if (retryNote) {
      parts.push(retryNote);
    }

    return [{
      role: 'system',
      content: context?.systemInstruction || `You write one scene of a screenplay as tagged XML lines.
Return only new lines for the requested scene. Keep assistantResponse brief.`
    }, {
      role: 'user',
      content: parts.join('\n\n')
    }];
  }

  formatPayload (response, schema) {
    return this.parseFunctionPayload(response, schema, 'Invalid write-scene payload');
  }

  async run (context, prompt) {
    const schema = { required: ['lines', 'assistantResponse'] };

    return runWritingAttemptLoop({
      maxAttempts: Number.isInteger(context?.maxAttempts) ? context.maxAttempts : MAX_ATTEMPTS,
      runAttempt: async ({ retryNote }) => {
        const messages = await this.buildMessages(context, prompt, retryNote);
        const raw = await this.execute(messages, context, false);
        const payload = this.formatPayload(raw, schema);
        const items = normalizeLineItems(payload.lines);

        if (items.length < LINE_MIN) {
          throw new Error(`scene_lines_too_few:${items.length}`);
        }

        const finalItems = items.slice(0, LINE_MAX);
        const script = renderLinesToXml(finalItems);
        const sceneMatch = typeof prompt === 'string' ? prompt.match(SCENE_NUMBER_PATTERN) : null;

        const formatted = buildWritingOutput({
          contractKey: INTENT_TYPES.WRITE_SCENE,
          type: INTENT_TYPES.WRITE_SCENE,
          assistantMessage: payload.assistantResponse,
          formattedScript: script,
          metadata: {
            ...this.extractMetadata(context, ['scriptId', 'scriptTitle']),
            lineCount: finalItems.length,
            sceneNumber: sceneMatch ? Number(sceneMatch[1]) : null,
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
