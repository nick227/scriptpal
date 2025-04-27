import { router } from "../../langchain/router/index.js";
import { ChatHistoryManager } from "../ChatHistoryManager.js";

export class ChainHandler {
    constructor(userId, scriptId, intentResult) {
        this.userId = userId;
        this.scriptId = scriptId;
        this.intentResult = intentResult;
        this.historyManager = new ChatHistoryManager(userId);
    }

    prepareContext(script) {
        return {
            userId: this.userId,
            scriptId: this.scriptId,
            intent: this.intentResult.intent,
            scriptContent: script.content,
            scriptTitle: script.title,
            scriptMetadata: {
                lastUpdated: script.updated_at,
                version_number: script.version_number,
                status: script.status
            },
            chainConfig: {
                shouldGenerateQuestions: this.intentResult.intent !== 'ANALYZE_SCRIPT', // Disable for analysis
                modelConfig: {
                    temperature: 0.7,
                    response_format: { type: "text" } // Force text response for analysis
                }
            }
        };
    }

    async execute(script, prompt) {
        try {
            const context = this.prepareContext(script);

            // For script analysis, we don't need chat history
            if (this.intentResult.intent === 'ANALYZE_SCRIPT') {
                context.chatHistory = [];
                context.disableHistory = true; // Explicitly disable history
            } else {
                // Get chat history for other intents
                const history = await this.historyManager.getHistory();
                if (history && Array.isArray(history)) {
                    context.chatHistory = history.map(msg => ({
                        role: msg.type === 'user' ? 'user' : 'assistant',
                        content: msg.content
                    }));
                } else {
                    context.chatHistory = [];
                }
            }

            console.log('Executing chain with context:', {
                intent: this.intentResult.intent,
                scriptTitle: context.scriptTitle,
                historyLength: context.chatHistory.length
            });

            return await router.route(this.intentResult, context, prompt);
        } catch (error) {
            console.error('Chain processing failed:', error);
            throw new Error(`Chain processing failed: ${error.message}`);
        }
    }
}