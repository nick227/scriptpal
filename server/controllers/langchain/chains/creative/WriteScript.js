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

            // Extract script details from context
            const { scriptId, scriptContent, scriptTitle } = context;

            // Format the system prompt for script writing
            const systemPrompt = await promptManager.formatPrompt(INTENT_TYPES.WRITE_SCRIPT, {
                scriptTitle: scriptTitle || 'Untitled',
                currentContent: scriptContent || ''
            });

            // Prepare messages for the chain
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ];

            // Call the language model using execute with shouldGenerateQuestions=false
            const response = await this.execute(messages, {
                scriptTitle: scriptTitle || 'Untitled',
                metadata: {
                    scriptId,
                    scriptTitle,
                    timestamp: new Date().toISOString()
                }
            }, false);

            // Process and format the response
            const formattedResponse = await this.formatResponse(response);

            // Build the final response object
            const finalResponse = {
                type: 'script_update',
                content: formattedResponse.content,
                metadata: {
                    scriptId,
                    scriptTitle,
                    updatedAt: new Date().toISOString()
                },
                // Add custom questions for script writing
                questions: [{
                    text: "Apply to the script",
                    intent: INTENT_TYPES.WRITE_SCRIPT,
                    description: "Applying the changes to the script"
                }, {
                    text: "Try again",
                    intent: INTENT_TYPES.WRITE_SCRIPT,
                    description: "Try again with the same prompt"
                }, {
                    text: "Keep going",
                    intent: INTENT_TYPES.WRITE_SCRIPT,
                    description: "Keep going with the same prompt"
                }]
            };

            return finalResponse;

        } catch (error) {
            console.error('WriteScript Chain Error:', error);
            throw new Error(ERROR_TYPES.CHAIN_EXECUTION_ERROR);
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