import { ChatOpenAI } from "@langchain/openai";
import { CHAIN_CONFIG, ERROR_TYPES, INTENT_TYPES, COMMON_PROMPT_INSTRUCTIONS } from '../../constants.js';
import db from "../../../../db/index.js";

// Internal questions generator class
class QuestionGenerator {
    constructor(model) {
        this.model = model;
    }

    async generateQuestions(context, prompt) {
        try {
            const messages = [{
                role: 'system',
                content: `
Generate 4 relevant follow-up questions or prompts that help the user explore their script or drive the story forward.

Prompts should be a maximum of 15 words.

The wording should be simple and easily readable.

Avoid using the title of the script in the prompts.

Phrase them as prompts for the user to click, when clicked the text will be sent to the LLM.

Format each question as a JSON object with:
- text: The actual question or prompt
- intent: The type of operation (${Object.values(INTENT_TYPES).join(', ')})
- description: A brief explanation of what this question will help with

Return an array of exactly 4 prompts.
`
            }, {
                role: 'user',
                content: `Current script title: ${context.scriptTitle || 'Untitled'}
Last operation: ${prompt}
Generate relevant follow-up questions.`
            }];

            const response = await this.model.invoke(messages);
            try {
                return JSON.parse(response.content);
            } catch {
                // Return default questions if parsing fails
                return [{
                    text: "Would you like to analyze your script?",
                    intent: INTENT_TYPES.ANALYZE_SCRIPT,
                    description: "Get a comprehensive analysis of your script"
                }];
            }
        } catch (error) {
            console.error('Questions generation error:', error);
            return [];
        }
    }
}

export class BaseChain {
    constructor(config = {}) {
        // Initialize the model with configuration
        this.model = new ChatOpenAI({
            modelName: config.model || CHAIN_CONFIG.MODEL,
            temperature: config.temperature || CHAIN_CONFIG.TEMPERATURE,
            maxTokens: config.maxTokens || CHAIN_CONFIG.MAX_TOKENS,
            ...config.modelConfig
        });

        this.config = {
            ...CHAIN_CONFIG,
            ...config
        };

        // Initialize question generator
        this.questionGenerator = new QuestionGenerator(this.model);
    }

    // Helper to get chat history
    async getChatHistory(context) {
        if (!context.userId) return [];

        try {
            const history = await db.getChatHistory(context.userId);
            return history.map(msg => ({
                role: msg.type === 'user' ? 'user' : 'assistant',
                content: msg.content
            })).slice(-10); // Get last 10 messages
        } catch (error) {
            console.error('Error fetching chat history:', error);
            return [];
        }
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

    async execute(messages, context = {}, shouldGenerateQuestions = true) {
        try {
            // Get chat history
            const history = await this.getChatHistory(context);

            // Combine history with current messages
            const fullMessages = [
                // System message always first
                messages.find(m => m.role === 'system'),
                // Then chat history
                ...history,
                // Then current user message
                ...messages.filter(m => m.role !== 'system')
            ].filter(Boolean); // Remove any undefined entries

            // Log the final OpenAI API Request Parameters
            console.log('\n=== OpenAI API Request Parameters ===');
            console.log('Model:', this.model.modelName);
            console.log('Temperature:', this.model.temperature);
            console.log('Max Tokens:', this.model.maxTokens);
            console.log('Messages:', JSON.stringify(fullMessages, null, 2));
            console.log('Additional Config:', JSON.stringify(this.model.config, null, 2));
            console.log('=====================================\n');

            // Get model response
            const response = await this.model.invoke(fullMessages);
            const content = response.content;

            // Save the interaction to history if we have a userId
            if (context.userId) {
                // Save user message
                await db.createChatHistory(
                    context.userId,
                    fullMessages[fullMessages.length - 1].content,
                    'user'
                );
                // Save assistant response
                await db.createChatHistory(
                    context.userId,
                    content,
                    'assistant'
                );
            }

            // Skip questions for default chain or if not requested
            if (!shouldGenerateQuestions || this.config.type === INTENT_TYPES.EVERYTHING_ELSE) {
                return content;
            }

            // Generate follow-up questions
            const questions = await this.questionGenerator.generateQuestions(context, messages[messages.length - 1].content);

            // Return response and questions at the top level
            return {
                response: content,
                type: this.config.type || 'unknown_response',
                questions: questions || [],
                metadata: context.metadata || {}
            };

        } catch (error) {
            console.error('Chain execution error:', error);
            throw new Error(ERROR_TYPES.CHAIN_EXECUTION_ERROR + ': ' + error.message);
        }
    }

    // Abstract method that chains must implement
    async run(input, context = {}) {
        throw new Error('run() must be implemented by chain class');
    }
}