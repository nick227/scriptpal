import { CONFIG } from './config.js';
import { MESSAGE_TYPES } from './constants.js';

export class ScriptPalChat {
    constructor(api, user) {
        this.api = api;
        this.user = user;
        this.messages = [];
        this.chatManager = null;
    }

    setManager(chatManager) {
        this.chatManager = chatManager;
    }

    async initialize() {
        // Basic initialization without loading history
        if (!Array.isArray(this.messages)) {
            this.messages = [];
        }
    }

    async loadHistory(chatHistory) {
        if (!this.chatManager) {
            throw new Error('ChatManager must be set before loading chat history');
        }

        if (!Array.isArray(chatHistory)) {
            console.warn('Invalid chat history format');
            return;
        }

        // Store the messages
        this.messages = chatHistory;

        // Load the history into the chat manager
        await this.chatManager.loadChatHistory(this.messages);
    }

    getMessages() {
        return [...this.messages];
    }

    addMessage(content, type = MESSAGE_TYPES.USER) {
        const message = { content, type, timestamp: new Date().toISOString() };
        this.messages.push(message);
        return message;
    }

    clearMessages() {
        this.messages = [];
        if (this.chatManager) {
            this.chatManager.clearChat();
        }
    }
}