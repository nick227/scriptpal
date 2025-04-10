import { BaseManager } from '../../core/BaseManager.js';
import { MESSAGE_TYPES, ERROR_MESSAGES } from '../../constants.js';
import { EventManager } from '../../core/EventManager.js';
import { StateManager } from '../../core/StateManager.js';
import { RendererFactory } from '../../renderers.js';

/**
 * ChatManager handles all chat-related functionality including:
 * - Message processing and rendering
 * - Chat history management
 * - User interaction (buttons, sending messages)
 * - Error handling
 * - State management
 */
export class ChatManager extends BaseManager {
    /**
     * ==============================================
     * Initialization and Setup
     * ==============================================
     * Constructor and initialization methods
     * Setting up event listeners and renderer
     */
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
        super.initialize(elements);
        this.setRenderer(RendererFactory.createMessageRenderer(elements.messagesContainer, this));
        this.stateManager.subscribe(StateManager.KEYS.CURRENT_SCRIPT, this.handleScriptChange.bind(this));
    }

    handleScriptChange(script) {
        if (!script || !this.renderer) return;
        this.renderer.clear();
        this.renderer.render(`Now chatting about: ${script.title}`, MESSAGE_TYPES.ASSISTANT);
    }

    /**
     * ==============================================
     * Message Processing and Rendering
     * ==============================================
     * Core message handling functionality
     * Processes messages, extracts content, and renders to UI
     */
    async processAndRenderMessage(messageData, type) {
        if (!messageData) return null;

        try {
            // Parse content if it's a string
            let parsedData;
            if (typeof messageData === 'string') {
                try {
                    parsedData = JSON.parse(messageData);
                } catch (e) {
                    parsedData = messageData;
                }
            } else {
                parsedData = messageData;
            }

            // Extract the actual message content
            const content = this.processResponse(parsedData);
            if (!content) {
                console.warn('Could not process message content:', messageData);
                return null;
            }

            // Render the message
            await this.safeRenderMessage(content, type);

            // Handle questions if present
            if (parsedData && typeof parsedData === 'object') {
                const questions = parsedData.questions ||
                    (parsedData.response && parsedData.response.questions);

                if (Array.isArray(questions) && questions.length > 0) {
                    this.renderer.renderButtons(questions);
                }
            }

            return content;
        } catch (error) {
            console.error('Failed to process and render message:', error);
            return null;
        }
    }

    processResponse(data) {
        // If data is a string, try to parse it as JSON first
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                // If it's not valid JSON, return the string as is
                return data;
            }
        }

        // Handle different response formats
        if (!data) return '';

        // Direct string response
        if (typeof data === 'string') return data;

        // Handle nested response objects
        if (typeof data === 'object') {
            // First check for message in response object
            if (data.message) {
                return data.message;
            }

            // Check common response fields
            const possibleFields = ['response', 'text', 'content', 'details'];
            for (const field of possibleFields) {
                if (data[field]) {
                    // If the field is an object, recursively process it
                    if (typeof data[field] === 'object') {
                        return this.processResponse(data[field]);
                    }
                    // If it's a string, return it directly
                    if (typeof data[field] === 'string') {
                        return data[field];
                    }
                }
            }

            // If no known fields found but object has a string representation
            if (data.toString && data.toString() !== '[object Object]') {
                return data.toString();
            }
        }

        // If we can't process the response, return empty string
        return '';
    }

    /**
     * ==============================================
     * User Interaction Handlers
     * ==============================================
     * Methods for handling user actions
     * Sending messages, clicking buttons, etc.
     */
    async handleSend(message) {
        if (!this.validateSendConditions(message)) return;

        try {
            await this.startMessageProcessing();

            // Process and render user message
            await this.processAndRenderMessage(message, MESSAGE_TYPES.USER);
            this.eventManager.publish(EventManager.EVENTS.CHAT.MESSAGE_SENT, { message });

            // Get and process API response
            const data = await this.api.getChatResponse(message);
            if (!data || !data.response) {
                console.warn('Empty response received from API');
                return null;
            }

            // Process and render assistant response
            const response = await this.processAndRenderMessage(data.response, MESSAGE_TYPES.ASSISTANT);
            if (response) {
                this.eventManager.publish(EventManager.EVENTS.CHAT.MESSAGE_RECEIVED, { response });
            }

            return response;
        } catch (error) {
            this.handleError(error, 'chat');
            this.renderer.render(ERROR_MESSAGES.API_ERROR, MESSAGE_TYPES.ERROR);
            throw error;
        } finally {
            await this.endMessageProcessing();
        }
    }

    handleButtonClick(text) {
        if (text) this.handleSend(text);
    }

    /**
     * ==============================================
     * Chat History Management
     * ==============================================
     * Loading and managing chat history
     * Processing historical messages
     */
    async loadChatHistory(messages) {
        if (!this.validateHistoryConditions(messages)) return;

        try {
            await this.startMessageProcessing();
            this.renderer.clear();

            const sortedMessages = [...messages].reverse();
            for (const message of sortedMessages) {
                const type = this.determineMessageType(message);
                await this.processAndRenderMessage(message.content, type);
            }
        } catch (error) {
            this.handleError(error, 'loadChatHistory');
        } finally {
            await this.endMessageProcessing();
        }
    }

    determineMessageType(message) {
        if (message.type) return message.type;
        if (message.role) return message.role === 'assistant' ? MESSAGE_TYPES.ASSISTANT : MESSAGE_TYPES.USER;
        return MESSAGE_TYPES.USER;
    }

    /**
     * ==============================================
     * Validation and State Management
     * ==============================================
     * Methods for validating conditions and managing state
     */
    validateSendConditions(message) {
        if (!this.renderer) {
            console.error('No renderer available');
            return false;
        }
        if (!this.renderer.container) {
            console.error('No renderer container available');
            return false;
        }
        if (!message || typeof message !== 'string') {
            console.error('Invalid message format');
            return false;
        }
        if (this.isProcessing) {
            console.warn('Message processing already in progress');
            return false;
        }
        return true;
    }

    validateHistoryConditions(messages) {
        if (!Array.isArray(messages)) {
            console.warn('Messages is not an array:', messages);
            return false;
        }
        if (!this.renderer || !this.renderer.container) {
            console.error('No renderer or container available');
            return false;
        }
        return true;
    }

    async startMessageProcessing() {
        if (this.isProcessing) {
            throw new Error('Message processing already in progress');
        }
        this.isProcessing = true;
        await this.stateManager.setState(StateManager.KEYS.LOADING, true);
    }

    async endMessageProcessing() {
        this.isProcessing = false;
        await this.stateManager.setState(StateManager.KEYS.LOADING, false);
    }

    /**
     * ==============================================
     * Error Handling and Utilities
     * ==============================================
     * Error handling, rendering safety, and cleanup
     */
    async safeRenderMessage(content, type) {
        try {
            await Promise.resolve(this.renderer.render(content, type));
        } catch (error) {
            console.error('Failed to render message:', error);
            this.handleError(error, 'renderMessage');
        }
    }

    handleError(error, context) {
        const errorMessage = error && error.message || 'Unknown error occurred';
        console.error(`Error in ${context}:`, errorMessage, error);
        this.stateManager.setState(StateManager.KEYS.ERROR, { context, error: errorMessage });
    }

    /**
     * ==============================================
     * Cleanup and Maintenance
     * ==============================================
     * Methods for cleaning up and updating chat state
     */
    clearChat() {
        if (this.renderer && this.renderer.container) {
            this.renderer.clear();
        }
    }

    updateChat(chat) {
        if (!chat.api) {
            throw new Error('Invalid chat object provided for update');
        }
        this.api = chat.api;
        this.clearChat();
    }

    destroy() {
        this.clearChat();
        super.destroy();
    }
}