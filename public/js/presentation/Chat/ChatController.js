/**
 * ChatController - Chat controller using clean architecture
 * Focused on orchestrating chat components
 */
import { Controller } from '../../core/Controller.js';

import { ChatInput } from './ChatInput.js';
import { ChatRenderer } from './ChatRenderer.js';

/**
 *
 */
export class ChatController extends Controller {
    /**
     *
     */
    constructor () {
        super('Chat');
        this.chatRenderer = null;
        this.chatInput = null;
        this.container = null;
        this.messagesContainer = null;
        this.inputContainer = null;
        this.handleScrollPosition = this.handleScrollPosition.bind(this);
        this.handleChatMessageEvent = this.handleChatMessageEvent.bind(this);
    }

    /**
     * Initialize the chat controller
     */
    onEnter () {
        this.setupContainer();
        this.initializeComponents();
        this.attachListeners();
    }

    /**
     * Setup container elements
     */
    setupContainer () {
        this.container = document.querySelector('.chatbot-container');
        this.messagesContainer = document.querySelector('.chat-messages');
        this.inputContainer = document.querySelector('.chatbot-container');

        if (!this.container || !this.messagesContainer) {
            throw new Error('Chat container elements not found');
        }
    }

    /**
     * Initialize chat components
     */
    initializeComponents () {
        this.chatRenderer = new ChatRenderer(this.messagesContainer);
        this.addComponent('chatRenderer', this.chatRenderer);

        if (this.inputContainer) {
            this.chatInput = new ChatInput(this.inputContainer);
            this.chatInput.init();
            this.addComponent('chatInput', this.chatInput);
        }
    }

    /**
     * Attach event listeners (explicit triggers only)
     */
    attachListeners () {
        if (this.messagesContainer) {
            this.messagesContainer.addEventListener('scroll', this.handleScrollPosition);
        }
        window.addEventListener('resize', this.handleScrollPosition);

        if (this.inputContainer) {
            this.inputContainer.addEventListener('chatMessage', this.handleChatMessageEvent);
        }

        this.handleScrollPosition();
    }

    /**
     * Exit the chat controller
     */
    onExit () {
        this.cleanup();
    }

    /**
     * Clean up resources
     */
    cleanup () {
        if (this.messagesContainer) {
            this.messagesContainer.removeEventListener('scroll', this.handleScrollPosition);
        }
        window.removeEventListener('resize', this.handleScrollPosition);

        if (this.inputContainer) {
            this.inputContainer.removeEventListener('chatMessage', this.handleChatMessageEvent);
        }

        if (this.chatRenderer) {
            this.chatRenderer.clear();
        }

        if (this.chatInput) {
            this.chatInput.destroy();
        }
    }

    /**
     * Handle chat message event
     * @param e
     */
    handleChatMessageEvent (e) {
        this.handleChatMessage(e.detail.message);
    }

    /**
     * Explicit scroll position trigger
     */
    handleScrollPosition () {
        if (this.chatRenderer) {
            this.chatRenderer.checkScrollPosition();
        }
    }

    /**
     * Handle incoming chat message
     * @param message
     */
    handleChatMessage (message) {

        if (this.chatRenderer) {
            this.chatRenderer.checkScrollPosition();
        }

        const messageObj = {
            id: Date.now().toString(),
            content: message,
            sender: 'You',
            type: 'user',
            timestamp: Date.now()
        };

        this.chatRenderer.renderMessage(messageObj);
        this.emit('messageSent', messageObj);
    }

    /**
     * Add a received message
     * @param message
     */
    addReceivedMessage (message) {
        const messageObj = {
            id: message.id || Date.now().toString(),
            content: message.content,
            sender: message.sender || 'Assistant',
            type: 'assistant',
            timestamp: message.timestamp || Date.now()
        };

        this.chatRenderer.renderMessage(messageObj);
    }

    /**
     * Clear all messages
     */
    clearMessages () {
        if (this.chatRenderer) {
            this.chatRenderer.clear();
        }
    }

    /**
     * Enable/disable chat input
     * @param enabled
     */
    setInputEnabled (enabled) {
        if (this.chatInput) {
            this.chatInput.setEnabled(enabled);
        }
    }

    /**
     * Focus chat input
     */
    focusInput () {
        if (this.chatInput) {
            this.chatInput.focus();
        }
    }
}
