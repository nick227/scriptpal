import { BaseChain } from './BaseChain.js';
import { INTENT_TYPES } from '../../constants.js';
import { ChainHelper } from '../helpers/ChainHelper.js';

export class DefaultChain extends BaseChain {
  constructor() {
    super({
      type: INTENT_TYPES.GENERAL_CONVERSATION,
      temperature: 0.5,
      modelConfig: {
        response_format: { type: 'text' }
      }
    });
  }

  /**
     * Build messages for the default chain
     */
  buildMessages(context, prompt) {
    const defaultInstruction = `You are a helpful AI assistant for scriptwriting. 
Your task is to provide general assistance and answer questions about scriptwriting.
Keep responses focused on scriptwriting and storytelling.
Be concise but informative.`;

    const includeScriptContext = context && context.includeScriptContext;
    const scriptContent = includeScriptContext && context?.scriptContent ? context.scriptContent : '';
    const userContent = scriptContent
      ? `${prompt}\n\nScript content:\n${scriptContent}`
      : prompt;

    const messages = [{
      role: 'system',
      content: context && context.systemInstruction
        ? context.systemInstruction
        : defaultInstruction
    }, {
      role: 'user',
      content: userContent
    }];

    return this.addCommonInstructions(messages);
  }

  /**
     * Format the response for the default chain
     */
  formatResponse(response) {
    return {
      response: typeof response === 'string' ? response : response.response || response,
      type: INTENT_TYPES.GENERAL_CONVERSATION,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
     * Generate follow-up questions for the default chain
     */
  generateQuestions(_context, _prompt) {
    return ChainHelper.getDefaultQuestions();
  }

  /**
     * Run method implementation
     */
  async run(context, prompt) {
    try {
      // Build messages using the chain's specific logic
      const messages = await this.buildMessages(context, prompt);

      // Execute without generating questions (we'll handle them separately)
      const response = await this.execute(messages, {
        context,
        chainConfig: {
          shouldGenerateQuestions: false // Prevent circular question generation
        }
      });

      // Format the response
      const formattedResponse = await this.formatResponse(response);

      // Add default questions
      return {
        ...formattedResponse,
        questions: ChainHelper.getDefaultQuestions()
      };
    } catch (error) {
      console.error('Default chain execution error:', error);
      // Return a basic response on error
      return {
        response: 'I\'m here to help with your script. What would you like to do?',
        type: INTENT_TYPES.GENERAL_CONVERSATION,
        metadata: {
          error: error.message,
          timestamp: new Date().toISOString()
        },
        questions: ChainHelper.getDefaultQuestions()
      };
    }
  }
}
