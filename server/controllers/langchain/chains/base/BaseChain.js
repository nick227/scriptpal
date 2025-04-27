import { ChatOpenAI } from "@langchain/openai";
import { CHAIN_CONFIG, ERROR_TYPES, INTENT_TYPES, COMMON_PROMPT_INSTRUCTIONS } from '../../constants.js';
import db from "../../../../db/index.js";
import { OpenAI } from 'openai';
import { ChainHelper } from '../helpers/ChainHelper.js';
import { QuestionGenerator } from './QuestionGenerator.js';

export class BaseChain {
    constructor(config) {
        if (!config || !config.type) {
            throw new Error('Chain configuration must include type');
        }

        const { type, temperature = 0.7, modelConfig = {} } = config;
        this.type = type;
        this.temperature = temperature;

        // Merge configurations once
        this.config = {
            ...CHAIN_CONFIG,
            ...modelConfig,
            temperature: temperature
        };

        try {
            this.openai = new OpenAI();
        } catch (error) {
            console.error('Failed to initialize OpenAI:', error);
            throw new Error('OpenAI initialization failed');
        }

        // Initialize question generator
        this.questionGenerator = new QuestionGenerator(this.openai);
    }

    /**
     * Validate a single message object
     * @private
     */
    validateMessage(msg, source = 'unknown') {
        try {
            // Basic structure check
            if (!msg || typeof msg !== 'object') {
                console.warn(`Invalid message format from ${source}:`, msg);
                return null;
            }

            // Role validation
            const validRoles = ['user', 'assistant', 'system'];
            if (!validRoles.includes(msg.role)) {
                console.warn(`Invalid role "${msg.role}" from ${source}, defaulting to user`);
                msg.role = 'user';
            }

            // Content validation
            if (typeof msg.content !== 'string') {
                if (msg.content === null || msg.content === undefined) {
                    console.warn(`Empty content from ${source}, skipping message`);
                    return null;
                }
                console.warn(`Non-string content from ${source}, converting to string`);
                msg.content = String(msg.content);
            }

            // Trim content and check if empty
            msg.content = msg.content.trim();
            if (msg.content.length === 0) {
                console.warn(`Empty content after trimming from ${source}, skipping message`);
                return null;
            }

            return msg;
        } catch (error) {
            console.error(`Error validating message from ${source}:`, error);
            return null;
        }
    }

    async getChatHistory(context) {
        try {
            if (!context || !context.userId) {
                console.log('No userId in context, skipping history');
                return [];
            }

            console.log('Fetching chat history for user:', context.userId);

            try {
                // Get last 3 messages from chat history
                const [results] = await db.query(
                    'SELECT type as role, content FROM chat_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT 3', [context.userId]
                );

                // MySQL2 always returns an array of results
                const rows = Array.isArray(results) ? results : [];

                console.log('Raw chat history result:', {
                    hasRows: rows.length > 0,
                    rowCount: rows.length
                });

                // Validate each message from history
                const validMessages = rows.reverse()
                    .map(row => {
                        if (!row || typeof row !== 'object') return null;

                        // Handle both role and type fields
                        const role = row.role || row.type || 'user';
                        const content = typeof row.content === 'string' ? row.content : String(row.content || '');

                        return this.validateMessage({
                            role: role,
                            content: content
                        }, 'chat_history');
                    })
                    .filter(Boolean); // Remove null values

                console.log('Chat history retrieved:', {
                    requestedCount: 3,
                    retrievedCount: rows.length,
                    validCount: validMessages.length
                });

                return validMessages;

            } catch (dbError) {
                console.error('Database error fetching chat history:', dbError);
                return [];
            }
        } catch (error) {
            console.error('Error in getChatHistory:', error);
            return []; // Return empty array on error
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

    /**
     * Helper to extract metadata from various sources
     * @private
     */
    extractMetadata(source, fields) {
        const result = {};
        for (const field of fields) {
            result[field] = source[field] ||
                (source.context && source.context[field]) ||
                (source.metadata && source.metadata[field]);
        }
        return result;
    }

    /**
     * Create standardized response object
     * @private
     */
    createResponse(content, context, questions = null) {
        const response = {
            response: content,
            type: this.type,
            metadata: {
                ...this.extractMetadata(context, ['scriptId', 'scriptTitle']),
                timestamp: new Date().toISOString()
            }
        };

        if (questions !== null) {
            response.questions = Array.isArray(questions) ? questions : this.getDefaultQuestions();
        }

        return response;
    }

    async run(context, prompt) {
        try {
            console.log('BaseChain.run starting with context:',
                this.extractMetadata(context, ['scriptId', 'scriptTitle', 'intent']));

            // Build messages using the chain's specific logic
            const messages = await this.buildMessages(context, prompt);

            // Get chain configuration
            const chainConfig = context.chainConfig || {};
            const shouldGenerateQuestions = chainConfig.shouldGenerateQuestions !== undefined ?
                chainConfig.shouldGenerateQuestions : true;

            // Ensure script metadata is preserved without duplication
            const enrichedMetadata = {
                ...context,
                ...this.extractMetadata(context, ['scriptId', 'scriptTitle', 'userId']),
                chainConfig,
                modelConfig: this.config
            };

            console.log('Executing with enriched metadata:',
                this.extractMetadata(enrichedMetadata, ['scriptId', 'scriptTitle', 'intent']));

            // Execute with full context and proper configuration
            return this.execute(messages, enrichedMetadata, shouldGenerateQuestions);
        } catch (error) {
            console.error('Error in BaseChain.run:', error);
            throw error;
        }
    }

    async execute(messages, metadata = {}, shouldGenerateQuestions = true) {
        try {
            console.log('BaseChain.execute starting...');
            const processedMessages = this.addCommonInstructions(messages);
            console.log('Messages processed with common instructions');

            // Extract context without duplication
            const context = {
                ...metadata,
                ...this.extractMetadata(metadata, ['scriptId', 'scriptTitle', 'userId', 'intent'])
            };

            // Store original prompt for question generation
            const lastMessage = messages[messages.length - 1];
            const originalPrompt = lastMessage ? lastMessage.content : '';

            console.log('Context prepared:', {
                ...this.extractMetadata(context, ['scriptId', 'scriptTitle', 'intent']),
                hasMetadata: !!metadata.metadata,
                hasPrompt: !!originalPrompt
            });

            // Get chat history and combine with current messages
            console.log('Building message chain...');
            const allMessages = await Promise.race([
                this.buildMessageChain(processedMessages, context),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Message chain build timeout')), 5000))
            ]).catch(error => {
                console.warn('Message chain build failed or timed out:', error);
                return processedMessages;
            });
            console.log('Message chain built, preparing API call...', { messageCount: allMessages.length });

            // Create chat completion with proper config handling
            const chainConfig = context.chainConfig || {};
            const modelConfig = chainConfig.modelConfig || {};

            // Add timeout promise for OpenAI call
            console.log('Making API call to OpenAI...');
            const completionPromise = this.openai.chat.completions.create({
                model: modelConfig.model || this.config.model || 'gpt-4-turbo-preview',
                messages: allMessages,
                temperature: this.temperature,
                max_tokens: 4000,
                ...this.modelConfig,
                ...modelConfig
            });

            const completion = await Promise.race([
                completionPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI API timeout')), 30000))
            ]).catch(error => {
                console.error('OpenAI API error or timeout:', error);
                throw new Error(`API call failed: ${error.message}`);
            });

            if (!completion) {
                throw new Error('No completion received from OpenAI');
            }

            console.log('API call completed successfully');
            const responseContent = completion.choices[0].message.content;

            // Log this interaction to chat history if we have user context and history isn't disabled
            if (context.userId && !context.disableHistory) {
                console.log('Logging to chat history...');
                await Promise.race([
                    this.logToHistory(context.userId, allMessages[allMessages.length - 1], responseContent),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('History logging timeout')), 5000))
                ]).catch(error => {
                    console.warn('History logging failed or timed out:', error);
                });
            }

            // If questions are disabled, return response directly
            if (!shouldGenerateQuestions || chainConfig.shouldGenerateQuestions === false) {
                return this.createResponse(responseContent, context);
            }

            // Generate questions for all intents when enabled
            try {
                console.log('Generating follow-up questions...');
                const questions = await this.questionGenerator.generateQuestions(
                    context,
                    originalPrompt, // Pass the original prompt
                    responseContent
                );
                console.log('Questions generated successfully');
                return this.createResponse(responseContent, context, questions);
            } catch (error) {
                console.warn('Question generation failed, using defaults:', error);
                return this.createResponse(responseContent, context, this.getDefaultQuestions());
            }

        } catch (error) {
            console.error('Chain execution error:', error);
            throw error;
        }
    }

    async buildMessageChain(currentMessages, context) {
        try {
            // Ensure currentMessages is an array
            if (!Array.isArray(currentMessages)) {
                currentMessages = [currentMessages];
            }

            // For ANALYZE_SCRIPT, only use current messages
            if (context.intent === 'ANALYZE_SCRIPT') {
                return currentMessages.map(msg => this.validateMessage(msg, 'current_messages')).filter(Boolean);
            }

            // Get history if we have context and it's not disabled
            const history = (context.userId && !context.disableHistory) ?
                await this.getChatHistory(context) : [];

            console.log('Retrieved chat history:', {
                historyLength: history.length
            });

            // Validate all messages
            const validHistory = history.map(msg => this.validateMessage(msg, 'history')).filter(Boolean);
            const validCurrentMessages = currentMessages.map(msg => this.validateMessage(msg, 'current')).filter(Boolean);

            // Combine in correct order: system -> history -> current (excluding system)
            const systemMessages = validCurrentMessages.filter(m => m.role === 'system');
            const nonSystemMessages = validCurrentMessages.filter(m => m.role !== 'system');

            const finalMessages = [
                ...systemMessages,
                ...validHistory,
                ...nonSystemMessages
            ];

            console.log('Final message chain built:', {
                systemCount: systemMessages.length,
                historyCount: validHistory.length,
                nonSystemCount: nonSystemMessages.length,
                totalCount: finalMessages.length
            });

            return finalMessages;
        } catch (error) {
            console.error('Error building message chain:', error);
            // Fallback to just current messages if history fails
            return currentMessages.map(msg => this.validateMessage(msg, 'fallback')).filter(Boolean);
        }
    }

    async logToHistory(userId, lastUserMessage, assistantResponse) {
        try {
            // Using the correct column names from schema: type and content
            await db.query(
                'INSERT INTO chat_history (user_id, type, content) VALUES (?, ?, ?), (?, ?, ?)', [
                    userId,
                    'user',
                    lastUserMessage.content,
                    userId,
                    'assistant',
                    assistantResponse
                ]
            );
        } catch (error) {
            console.error('Error logging to chat history:', error);
            // Non-blocking - continue even if logging fails
        }
    }

    /**
     * Build messages for the chain - Must be implemented by child classes
     * @returns {Promise<Array>} Array of messages with system message first
     */
    async buildMessages(context, prompt) {
        throw new Error('buildMessages() must be implemented by chain class');
    }

    /**
     * Format the response - Can be overridden by child classes
     */
    async formatResponse(response) {
        return response;
    }

    /**
     * Get default questions if generation fails
     */
    getDefaultQuestions() {
        return ChainHelper.getDefaultQuestions();
    }
}