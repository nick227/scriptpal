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
        this.loadWelcomeButtons();
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

            const response = await this.api.getResponse(message);
            if (response.html) {
                this.renderer.render(response.html, MESSAGE_TYPES.ASSISTANT);
                this.eventManager.publish(EventManager.EVENTS.CHAT.MESSAGE_RECEIVED, { response });
            }
            if (response.buttons) {
                this.renderer.renderButtons(response.buttons);
            }
        } catch (error) {
            this.handleError(error, 'chat');
            this.renderer.render(ERROR_MESSAGES.API_ERROR, MESSAGE_TYPES.ERROR);
        } finally {
            this.isProcessing = false;
            this.stateManager.setState(StateManager.KEYS.LOADING, false);
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