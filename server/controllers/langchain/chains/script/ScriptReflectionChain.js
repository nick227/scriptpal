import { BaseChain } from '../base/BaseChain.js';
import { INTENT_TYPES } from '../../constants.js';
import { getDefaultQuestions } from '../helpers/ChainInputUtils.js';
import { formatScriptCollections } from '../helpers/ScriptCollectionsFormatter.js';

const SYSTEM_INSTRUCTION = `
You are a thoughtful script consultant who helps the writer understand the current material.
- Reflect on themes, character arcs, and turning points instead of adding new lines.
- Reference the provided script context when making observations.
- Highlight potential risks, opportunities, or questions the writer can explore.
- Ask one clarifying follow-up question when relevant, but do not produce formatted script lines.
`;

export class ScriptReflectionChain extends BaseChain {
  constructor() {
    super({
      type: INTENT_TYPES.SCRIPT_REFLECTION,
      temperature: 0.4,
      applyCommonInstructions: false,
      modelConfig: {
        response_format: { type: 'text' }
      }
    });
  }

  buildMessages(context, prompt) {
    const scriptContext = context?.scriptContent
      ? `Current script:\n${context.scriptContent}`
      : 'No script context was supplied.';
    const collectionBlock = formatScriptCollections(context?.scriptCollections);
    const combinedContext = collectionBlock
      ? `${scriptContext}\n\n${collectionBlock}`
      : scriptContext;

    const userContent = prompt
      ? `${prompt}\n\n${combinedContext}`
      : combinedContext;

    return [{
      role: 'system',
      content: context?.systemInstruction || SYSTEM_INSTRUCTION
    }, {
      role: 'user',
      content: userContent
    }];
  }

  formatResponse(response) {
    return {
      response: typeof response === 'string' ? response : response.response || response,
      type: INTENT_TYPES.SCRIPT_REFLECTION,
      metadata: {
        ...this.extractMetadata(response, ['scriptId', 'scriptTitle']),
        reflection: true,
        timestamp: new Date().toISOString()
      }
    };
  }

  getDefaultQuestions() {
    return getDefaultQuestions();
  }

  async run(context, prompt) {
    try {
      const messages = await this.buildMessages(context, prompt);
      const response = await this.execute(messages, context);
      const formattedResponse = await this.formatResponse(response);
      const questions = this.resolveQuestions(response);
      return {
        ...formattedResponse,
        questions
      };
    } catch (error) {
      console.error('ScriptReflectionChain execution error:', error);
      return {
        response: 'I reflected on the script but could not complete the response.',
        type: INTENT_TYPES.SCRIPT_REFLECTION,
        metadata: {
          reflection: true,
          error: error.message,
          timestamp: new Date().toISOString()
        },
        questions: this.getDefaultQuestions()
      };
    }
  }
}
