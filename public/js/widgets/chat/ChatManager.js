import { BaseManager } from '../../core/BaseManager.js';
import { MESSAGE_TYPES, ERROR_MESSAGES } from '../../constants.js';
import { EventManager } from '../../core/EventManager.js';
import { StateManager } from '../../core/StateManager.js';
import { RendererFactory } from '../../renderers.js';

export class ChatManager extends BaseManager {
    constructor(stateManager, api, eventManager) {
        super(stateManager);
        if (!api || !eventManager) {
            throw new Error('API and EventManager are required for ChatManager');
        }
        this.api = api;
        this.eventManager = eventManager;
        this.isProcessing = false;
    }

    initialize(elements) {
        if (!elements.messagesContainer) {
            throw new Error('Messages container element is required');
        }
        super.initialize(elements);

        this.setRenderer(RendererFactory.createMessageRenderer(elements.messagesContainer, this));
        this.stateManager.subscribe(StateManager.KEYS.CURRENT_SCRIPT, this.handleScriptChange.bind(this));
        // TODO: Add welcome buttons back in
        //this.loadWelcomeButtons();
    }

    async loadWelcomeButtons() {
        try {
            if (!this.api) {
                console.warn('API not initialized, skipping welcome buttons');
                return;
            }

            const response = await this.api.getRandomButtons();
            if (!response) {
                console.warn('No response received from getRandomButtons');
                return;
            }

            if (Array.isArray(response.buttons) && response.buttons.length > 0) {
                this.renderer.renderButtons(response.buttons);
            } else {
                console.warn('No buttons received in response');
            }
        } catch (error) {
            console.error('Failed to load welcome buttons:', error);
            this.handleError(error, 'welcome buttons');
        }
    }

    handleScriptChange(script) {
        if (!script || !this.renderer) return;

        this.renderer.clear();
        this.renderer.render(`Now chatting about: ${script.title}`, MESSAGE_TYPES.ASSISTANT);
        this.loadWelcomeButtons();
    }

    async handleSend(message) {
        if (!message || typeof message !== 'string' || !this.renderer.container || this.isProcessing) {
            return;
        }

        try {
            this.isProcessing = true;
            this.stateManager.setState(StateManager.KEYS.LOADING, true);

            this.renderer.render(message, MESSAGE_TYPES.USER);
            this.eventManager.publish(EventManager.EVENTS.CHAT.MESSAGE_SENT, { message });

            const data = await this.api.getChatResponse(message);
            console.log('data:::', data);
            if (data.response) {
                const response = this.processResponse(data.response);
                const wordGroups = this.getWordGroups(response);
                this.renderer.render(response, MESSAGE_TYPES.ASSISTANT);
                this.eventManager.publish(EventManager.EVENTS.CHAT.MESSAGE_RECEIVED, { response: response });
            }
            if (data.suggestions) {
                console.log('data.suggestions:::', data.suggestions);
                this.renderer.renderButtons(data.suggestions);
            }
        } catch (error) {
            this.handleError(error, 'chat');
            this.renderer.render(ERROR_MESSAGES.API_ERROR, MESSAGE_TYPES.ERROR);
        } finally {
            this.isProcessing = false;
            this.stateManager.setState(StateManager.KEYS.LOADING, false);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }


    getWordGroups(response) {
        const words = response.split(' ');
        const maxWordsPerGroup = 30;
        const wordGroups = [];
        for (let i = 0; i < words.length; i += maxWordsPerGroup) {
            const chunk = words.slice(i, i + maxWordsPerGroup);
            wordGroups.push(chunk.join(' '));
        }
        return wordGroups;
    }

    processResponse(response) {
        if (response.response && typeof response.response === 'string') {
            return response.response;
        }
        if (response.response && response.response.response && typeof response.response.response === 'string') {
            return response.response.response;
        }
        try {
            const json = JSON.parse(text);
            if (json.response) {
                return this.processResponse(json.response);
            }
            return json;
        } catch (error) {
            return response;
        }
    }

    handleButtonClick(text) {
        if (text) {
            this.handleSend(text);
        }
    }

    clearChat() {
        if (this.renderer.container) {
            this.renderer.clear();
            this.loadWelcomeButtons();
        }
    }

    updateChat(chat) {
        if (!chat.api) {
            throw new Error('Invalid chat object provided for update');
        }
        this.api = chat.api;
        this.clearChat();
    }

    handleError(error, context) {
        console.error(`Error in ${context}:`, error);
        this.stateManager.setState(StateManager.KEYS.ERROR, error);
    }

    destroy() {
        if (this.renderer.container) {
            this.renderer.clear();
        }
        super.destroy();
    }
}