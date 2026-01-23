import { BaseChain } from '../base/BaseChain.js';
import { INTENT_TYPES } from '../../constants.js';
import { ChainHelper } from '../helpers/ChainHelper.js';

const SYSTEM_INSTRUCTION = `You are a scriptwriting assistant tasked specifically with appending or continuing scripts. Use the script context and user prompt to add meaningful, coherent lines that extend the story without rewriting previous content.`;

export class AppendScriptChain extends BaseChain {
    constructor () {
        super({
        type: INTENT_TYPES.SCRIPT_CONVERSATION,
            temperature: 0.5,
            modelConfig: {
                response_format: { type: 'text' }
            }
        });
    }

    buildMessages (context, prompt) {
        const scriptContent = context?.scriptContent || '';
        const scriptSnippet = scriptContent ? `${prompt}\n\nCurrent script:\n${scriptContent}` : prompt;
        const systemPrompt = context?.systemInstruction || SYSTEM_INSTRUCTION;

        const messages = [{
            role: 'system',
            content: systemPrompt
        }, {
            role: 'user',
            content: scriptSnippet
        }];

        return this.addCommonInstructions(messages);
    }

    formatResponse (response) {
        return {
            response: typeof response === 'string' ? response : response.response || response,
      type: INTENT_TYPES.SCRIPT_CONVERSATION,
            metadata: {
                ...this.extractMetadata(response, ['scriptId', 'scriptTitle']),
                appendWithScript: true,
                timestamp: new Date().toISOString()
            }
        };
    }

    getDefaultQuestions () {
        return ChainHelper.getDefaultQuestions();
    }

    async run (context, prompt) {
        try {
            const messages = await this.buildMessages(context, prompt);
            const response = await this.execute(messages, context);
            const formattedResponse = await this.formatResponse(response);
            return {
                ...formattedResponse,
                questions: this.getDefaultQuestions()
            };
        } catch (error) {
            console.error('AppendScriptChain execution error:', error);
            return {
                response: 'I appended to your script.',
                type: INTENT_TYPES.SCRIPT_CONVERSATION,
                metadata: {
                    appendWithScript: true,
                    error: error.message,
                    timestamp: new Date().toISOString()
                },
                questions: this.getDefaultQuestions()
            };
        }
    }
}
