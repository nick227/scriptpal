import { BaseChain } from '../base/BaseChain.js';
import { INTENT_TYPES, SCRIPT_CONTEXT_PREFIX } from '../../constants.js';
import { buildScriptHeader } from '../helpers/ScriptPromptUtils.js';
import { buildContractMetadata, validateAiResponse } from '../helpers/ChainOutputGuards.js';
import { normalizeFormattedScript } from '../../../../lib/scriptFormatter.js';
import { formatScriptCollections } from '../helpers/ScriptCollectionsFormatter.js';

const NEXT_FIVE_FUNCTIONS = [{
  name: 'provide_next_lines',
  description: 'Return five new script lines plus rationale.',
  parameters: {
    type: 'object',
    properties: {
      formattedScript: {
        type: 'string',
        description: 'Five script lines wrapped in validated tags (<header>, <action>, <speaker>, <dialog>, <directions>, <chapter-break>).'
      },
      assistantResponse: {
        type: 'string',
        description: 'Why the new lines fit and how they connect to context.'
      }
    },
    required: ['formattedScript', 'assistantResponse']
  }
}];

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
    const contextBlocks = [
      collectionBlock,
      context?.scriptContent ? `${SCRIPT_CONTEXT_PREFIX}\n${context.scriptContent}` : ''
    ].filter(Boolean).join('\n\n');
    const scriptContext = contextBlocks
      ? `${scriptHeader}\n\n${contextBlocks}`
      : 'No script content available.';

    const systemInstruction = context?.systemInstruction;

    const userContent = `
${prompt}

${scriptContext}
`;

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
