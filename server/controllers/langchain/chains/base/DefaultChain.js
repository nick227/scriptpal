import { BaseChain } from './BaseChain.js';
import { INTENT_TYPES } from '../../constants.js';
import { ChainHelper } from '../helpers/ChainHelper.js';

export class DefaultChain extends BaseChain {
    constructor() {
        super({
            type: INTENT_TYPES.EVERYTHING_ELSE,
            temperature: 0.5,
            modelConfig: {
                response_format: { type: "text" }
            }
        });
    }

    /**
     * Build messages for the default chain
     */
    async buildMessages(context, prompt) {
        const messages = [{
            role: 'system',
            content: `You are a helpful AI assistant for scriptwriting. 
Your task is to provide general assistance and answer questions about scriptwriting.
Keep responses focused on scriptwriting and storytelling.
Be concise but informative.`
        }, {
            role: 'user',
            content: prompt
        }];

        return this.addCommonInstructions(messages);
    }

    /**
     * Format the response for the default chain
     */
    async formatResponse(response) {
        return {
            response: typeof response === 'string' ? response : response.response || response,
            type: INTENT_TYPES.EVERYTHING_ELSE,
            metadata: {
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Generate follow-up questions for the default chain
     */
    async generateQuestions(context, prompt) {
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
                response: "I'm here to help with your script. What would you like to do?",
                type: INTENT_TYPES.EVERYTHING_ELSE,
                metadata: {
                    error: error.message,
                    timestamp: new Date().toISOString()
                },
                questions: ChainHelper.getDefaultQuestions()
            };
        }
    }
}