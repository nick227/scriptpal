import db from "../../db/index.js";

export class ChatHistoryManager {
    constructor(userId) {
        this.userId = userId;
    }

    async saveInteraction(userPrompt, assistantResponse) {
        try {
            await Promise.all([
                db.createChatHistory(this.userId, userPrompt, 'user'),
                db.createChatHistory(
                    this.userId,
                    typeof assistantResponse === 'string' ?
                    assistantResponse :
                    JSON.stringify(assistantResponse),
                    'assistant'
                )
            ]);
        } catch (error) {
            // Log but don't fail the operation
            console.error('Failed to save chat history:', error);
        }
    }

    async getHistory(limit = 3) {
        try {
            return await db.getChatHistory(this.userId, limit);
        } catch (error) {
            console.error('Failed to fetch chat history:', error);
            return [];
        }
    }
}