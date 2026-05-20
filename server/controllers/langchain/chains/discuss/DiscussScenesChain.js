import { BaseChain } from '../base/BaseChain.js';
import { INTENT_TYPES } from '../../constants.js';

const SYSTEM_INSTRUCTION = `You are a script development assistant focused on the user's scene outline.
- Discuss structure, order, pacing, and dramatic purpose of scenes.
- Reference scene titles and descriptions from the outline provided.
- Do not output screenplay XML or formatted script lines.
- Keep your reply short (a few sentences). No bullet essays.`;

export class DiscussScenesChain extends BaseChain {
  constructor () {
    super({
      type: INTENT_TYPES.DISCUSS_SCENES,
      temperature: 0.5,
      applyCommonInstructions: false,
      modelConfig: {
        response_format: { type: 'text' }
      }
    });
  }

  buildMessages (context, prompt) {
    const header = [
      context?.scriptTitle ? `Script: ${context.scriptTitle}` : '',
      context?.scriptDescription ? `Description: ${context.scriptDescription}` : ''
    ].filter(Boolean).join('\n');

    const outline = context?.sceneOutline || 'No scene outline available.';

    const userContent = [
      prompt,
      header,
      `Scene outline:\n${outline}`
    ].filter(Boolean).join('\n\n');

    return [{
      role: 'system',
      content: context?.systemInstruction || SYSTEM_INSTRUCTION
    }, {
      role: 'user',
      content: userContent
    }];
  }

  formatResponse (response) {
    const raw = typeof response === 'string'
      ? response
      : (response?.message || response?.response || '');
    const message = typeof raw === 'string' ? raw.trim() : '';

    return {
      message,
      script: null,
      type: INTENT_TYPES.DISCUSS_SCENES,
      metadata: {
        ...this.extractMetadata(response, ['scriptId', 'scriptTitle']),
        discussScenes: true,
        timestamp: new Date().toISOString()
      }
    };
  }

  async run (context, prompt) {
    const messages = await this.buildMessages(context, prompt);
    const response = await this.execute(messages, {
      ...context,
      chainConfig: {
        shouldGenerateQuestions: false,
        persistResponse: true
      }
    });
    return {
      ...this.formatResponse(response),
      questions: []
    };
  }
}
