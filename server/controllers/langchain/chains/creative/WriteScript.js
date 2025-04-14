import { BaseChain } from '../base/BaseChain.js';
import { promptManager } from '../../prompts/index.js';
import { ERROR_TYPES, INTENT_TYPES } from '../../constants.js';
import { ChainHelper } from '../helpers/ChainHelper.js';
import db from "../../../../db/index.js";

export class WriteScriptChain extends BaseChain {
    constructor() {
        super({
            type: INTENT_TYPES.WRITE_SCRIPT,
            temperature: 0.3,
            modelConfig: {
                response_format: { type: "text" } // Force text response
            }
        });
    }

    async run(context, prompt) {
        try {
            // Validate context and prompt
            if (!context || !prompt) {
                throw new Error(ERROR_TYPES.INVALID_INPUT);
            }

            // Extract metadata
            const { scriptId, scriptTitle } = ChainHelper.extractContext(context);

            // Create messages array
            const messages = [{
                role: 'system',
                content: promptManager.getPrompt('WRITE_SCRIPT')
            }, {
                role: 'user',
                content: prompt
            }];

            // Call the language model using execute with context
            const response = await this.execute(messages, {
                scriptTitle: scriptTitle || 'Untitled',
                metadata: {
                    scriptId,
                    scriptTitle,
                    timestamp: new Date().toISOString()
                },
                context: {
                    userId: context.userId,
                    scriptId: scriptId
                }
            });

            // Get the actual content from the response
            const responseContent = typeof response === 'object' && response.response ? response.response : response;

            // Process and format the response
            const formattedResponse = await this.formatResponse(responseContent);

            // Return the final response with custom questions
            return {
                response: formattedResponse,
                questions: [{
                    text: "Continue writing from here",
                    intent: INTENT_TYPES.WRITE_SCRIPT,
                    description: "Continue the current writing flow"
                }, {
                    text: "Analyze what I've written",
                    intent: INTENT_TYPES.ANALYZE_SCRIPT,
                    description: "Get feedback on the current content"
                }, {
                    text: "Save this version",
                    intent: INTENT_TYPES.SAVE_SCRIPT,
                    description: "Save the current version"
                }]
            };

        } catch (error) {
            console.error('WriteScript chain error:', error);
            throw error;
        }
    }

    async formatResponse(response) {
        // Ensure response is properly formatted
        if (!response || typeof response !== 'string') {
            throw new Error(ERROR_TYPES.INVALID_RESPONSE);
        }

        // Clean and format the response
        const cleanedContent = response
            .replace(/\0/g, '') // Remove null chars
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Remove control chars
            .replace(/\r\n/g, '\n') // Normalize line endings
            .replace(/\r/g, '\n')
            .replace(/\n{3,}/g, '\n\n') // Remove excessive blank lines
            .trim();

        return {
            content: cleanedContent,
            originalResponse: response
        };
    }
}