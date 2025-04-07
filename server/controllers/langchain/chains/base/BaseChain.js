import { ChatOpenAI } from "@langchain/openai";
import { CHAIN_CONFIG, ERROR_TYPES, COMMON_PROMPT_INSTRUCTIONS } from '../../constants.js';

export class BaseChain {
    constructor(config = {}) {
        // Initialize the model with configuration
        this.model = new ChatOpenAI({
            modelName: config.model || CHAIN_CONFIG.MODEL,
            temperature: config.temperature || CHAIN_CONFIG.TEMPERATURE,
            maxTokens: config.maxTokens || CHAIN_CONFIG.MAX_TOKENS
        });

        this.config = {
            ...CHAIN_CONFIG,
            ...config
        };
    }

    // Helper to add common instructions to prompts
    addCommonInstructions(messages) {
        // If messages is a string, convert to system message
        if (typeof messages === 'string') {
            messages = [{ role: 'system', content: messages }];
        }

        // Ensure messages is an array
        if (!Array.isArray(messages)) {
            messages = [messages];
        }

        // Add common instructions to the first system message
        const systemMessage = messages.find(m => m.role === 'system');
        if (systemMessage) {
            systemMessage.content = `${COMMON_PROMPT_INSTRUCTIONS.SYSTEM_PREFIX}\n\n${systemMessage.content}\n\n${COMMON_PROMPT_INSTRUCTIONS.RESPONSE_GUIDELINES.FORMAT}`;
        } else {
            // If no system message exists, add one
            messages.unshift({
                role: 'system',
                content: COMMON_PROMPT_INSTRUCTIONS.SYSTEM_PREFIX
            });
        }

        return messages;
    }

    async validateResponse(response, schema) {
        if (!response) {
            throw new Error(ERROR_TYPES.MISSING_REQUIRED);
        }

        try {
            const parsed = typeof response === 'string' ? JSON.parse(response) : response;

            // Check required fields from schema
            if (schema.required) {
                for (const field of schema.required) {
                    if (!(field in parsed)) {
                        throw new Error(`Missing required field: ${field}`);
                    }
                }
            }

            return parsed;
        } catch (error) {
            throw new Error(ERROR_TYPES.INVALID_FORMAT);
        }
    }

    async execute(prompt, options = {}) {
        try {
            // Add common instructions to the prompt
            const enhancedPrompt = this.addCommonInstructions(prompt);

            const response = await this.model.invoke(enhancedPrompt);
            return response.content;
        } catch (error) {
            console.error('Chain execution error:', error);
            throw new Error(ERROR_TYPES.CHAIN_ERROR);
        }
    }

    // Abstract method that chains must implement
    async run(input, context = {}) {
        throw new Error('run() must be implemented by chain class');
    }
}