import { BaseRenderer } from '../../core/BaseRenderer.js';
import { ChatManager } from './ChatManager.js';
import { ChatEvents } from './ChatEvents.js';
import { EventManager } from '../../core/EventManager.js';
import { BaseWidget } from '../BaseWidget.js';
import { MESSAGE_TYPES } from '../../constants.js';

export class ChatWidget extends BaseWidget {
    constructor(elements) {
        super(elements);
        this.chat = null;
        this.manager = null;
        this.events = null;
    }

    async initialize(chat) {
        if (!this.elements.messagesContainer || !chat) {
            throw new Error('Messages container and chat dependency are required');
        }

        this.chat = chat;
        await super.initialize();

        // Create and initialize manager first
        this.manager = new ChatManager(this.stateManager, this.chat.api, this.eventManager);
        this.manager.initialize(this.elements);

        // Set the manager on the chat instance
        this.chat.setManager(this.manager);

        // Create and initialize events
        this.events = new ChatEvents({
            handleSend: (message) => {
                if (this.manager) {
                    console.log('************************************************');
                    console.log('ChatWidget: handleSend', message);
                    console.log('************************************************');
                    this.manager.handleSend(message);
                }
            }
        });
        this.events.initialize(this.elements);

        // Set up event listeners
        this.setupEventListeners();

    }

    setupEventListeners() {
        if (!this.eventManager) return;

        this.subscribe(EventManager.EVENTS.SCRIPT.SELECTED, () => {
            if (this.manager) {
                this.manager.clearChat();
            }
        });

        this.subscribe(EventManager.EVENTS.AUTH.LOGOUT, this.handleLogout.bind(this));
    }

    update(chat) {
        if (!chat) {
            throw new Error('Chat dependency is required for ChatWidget update');
        }

        this.chat = chat;

        // If manager exists, update it and set it on the chat instance
        if (this.manager) {
            this.manager.updateChat(chat);
            this.chat.setManager(this.manager);
        } else {
            // If manager doesn't exist, reinitialize the widget
            this.initialize(chat);
        }
    }

    handleLogout() {
        if (this.manager) {
            this.manager.destroy();
            this.manager = null;
        }
        if (this.events) {
            this.events.cleanup();
            this.events = null;
        }
        this.chat = null;
    }

    destroy() {
        this.handleLogout();
        super.destroy();
    }
}