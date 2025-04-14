import { ChainHandler } from './handlers/ChainHandler.js';
import { IntentClassifier } from '../langchain/classifier/index.js';
import { ScriptManager } from '../scripts/ScriptManager.js';
import { ChatHistoryManager } from "./ChatHistoryManager.js";

export class Chat {
    static CHAT_ERRORS = {
        SCRIPT_NOT_FOUND: 'SCRIPT_NOT_FOUND',
        INVALID_INTENT: 'INVALID_INTENT',
        SAVE_FAILED: 'SAVE_FAILED',
        PROCESSING_ERROR: 'PROCESSING_ERROR'
    };

    constructor(userId, scriptId) {
        this.userId = userId;
        this.scriptId = scriptId;
        this.classifier = new IntentClassifier();
        this.scriptManager = new ScriptManager();
        this.historyManager = new ChatHistoryManager(userId);
    }

    formatResponse(response, intentResult) {
        // Handle string responses (common in analysis)
        if (typeof response === 'string') {
            response = {
                response: response,
                type: intentResult.intent
            };
        }

        // Get script title from metadata or direct property
        const scriptTitle = response.metadata && response.metadata.scriptTitle ||
            response.scriptTitle ||
            'Untitled Script';

        return {
            success: true,
            intent: intentResult.intent,
            confidence: intentResult.confidence,
            target: intentResult.target,
            value: intentResult.value,
            scriptId: this.scriptId,
            scriptTitle: scriptTitle,
            timestamp: new Date().toISOString(),
            response: response.response || response
        };
    }

    async processMessage(prompt) {
        try {
            console.log('\n=== Starting Chat Processing ===');

            // Classify the intent
            const intentResult = await this.classifier.classify(prompt);
            console.log('Intent classification:', intentResult);

            if (!intentResult || !intentResult.intent) {
                throw new Error(Chat.CHAT_ERRORS.INVALID_INTENT);
            }

            // Get script details if scriptId exists
            const script = this.scriptId ?
                await this.scriptManager.getScript(this.scriptId) : { content: '', title: '', updated_at: null, version: 1, status: 'active' };

            // Log script details for debugging
            console.log('Script Details:', {
                scriptId: this.scriptId,
                scriptTitle: script.title,
                hasContent: !!script.content
            });

            // Create and execute chain handler
            const handler = new ChainHandler(this.userId, this.scriptId, intentResult);
            const response = await handler.execute(script, prompt);

            // Save chat history (non-blocking)
            this.historyManager.saveInteraction(prompt, response)
                .catch(error => console.error('Chat history save failed:', error));

            // Format and return response
            console.log('\n=== Operation Complete ===');
            return this.formatResponse(response, intentResult);

        } catch (error) {
            console.error('Message processing failed:', error);
            throw new Error(`Message processing failed: ${error.message}`);
        }
    }
}