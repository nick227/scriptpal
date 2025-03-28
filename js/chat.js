import { CONFIG } from './config.js';

export class ScriptPalChat {
    constructor(api, user) {
        this.api = api;
        this.user = user;
        this.messages = null;
    }

    async initialize() {
        this.messages = [];
    }

    async processMessage(content) {
        const response = await this.api.getResponse(content);
        this.messages.push({
            content: response.html || '',
            type: CONFIG.ui.messageTypes.assistant,
            timestamp: Date.now()
        });

        return response;
    }

    getMessages() {
        return [...this.messages];
    }

    clearMessages() {
        this.messages = [];
    }
}