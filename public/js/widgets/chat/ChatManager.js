import { MESSAGE_TYPES, ERROR_MESSAGES } from '../../constants.js';
import { BaseManager } from '../../core/BaseManager.js';
import { EventManager } from '../../core/EventManager.js';
import { StateManager } from '../../core/StateManager.js';
import { RendererFactory } from '../../renderers.js';
import { ScriptContextManager } from '../editor/context/ScriptContextManager.js';
import { debugLog } from '../../core/logger.js';

import { ChatHistoryManager } from './ChatHistoryManager.js';
import { ScriptOperationsHandler } from './ScriptOperationsHandler.js';

const PAGE_LOAD_WELCOME_MESSAGE = 'Welcome to ScriptPal. I can help you write, edit, and explore your script. Select or create a script to get started.';

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
     * @param stateManager
     * @param api
     * @param eventManager
     */
    constructor (stateManager, api, eventManager) {
        super(stateManager);
        if (!api || !eventManager) {
            throw new Error('API and EventManager are required for ChatManager');
        }
        this.api = api;
        this.eventManager = eventManager;
        this.isProcessing = false;
        this.currentScriptId = null;

        this.scriptOperationsHandler = new ScriptOperationsHandler({
            getScriptOrchestrator: () => this.scriptOrchestrator,
            eventManager: this.eventManager,
            renderMessage: (content, type) => this.processAndRenderMessage(content, type),
            onError: this.handleError.bind(this)
        });

        // Initialize chat history manager
        this.chatHistoryManager = new ChatHistoryManager({
            api: this.api,
            stateManager: this.stateManager,
            eventManager: this.eventManager
        });

        // Initialize script context manager
        this.scriptContextManager = new ScriptContextManager({
            stateManager: this.stateManager,
            eventManager: this.eventManager
        });
    }

    /**
     *
     * @param refreshManager
     */
    setRefreshManager (refreshManager) {
        this.refreshManager = refreshManager;
    }

    /**
     *
     * @param orchestrator
     */
    setScriptOrchestrator (orchestrator) {
        this.scriptOrchestrator = orchestrator;
    }

    /**
     *
     * @param elements
     */
    initialize (elements) {
        super.initialize(elements);
        this.setRenderer(RendererFactory.createMessageRenderer(elements.messagesContainer, this));
        this.stateManager.subscribe(StateManager.KEYS.CURRENT_SCRIPT, this.handleScriptChange.bind(this));
        const currentScript = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
        if (!currentScript) {
            this.renderWelcomeMessage();
        }
    }

    /**
     *
     * @param script
     */
    async handleScriptChange (script) {
        if (!script || !this.renderer) {
            return;
        }

        const previousScriptId = this.currentScriptId;
        this.currentScriptId = script.id;
        const isNewScript = !previousScriptId || previousScriptId !== script.id;

        // Only add title message if it's a different script (by ID)
        if (isNewScript) {
            this.renderer.clear();
            this.renderer.render(`Now chatting about: ${script.title}`, MESSAGE_TYPES.ASSISTANT);
            const history = await this.chatHistoryManager.loadScriptHistory(script.id);
            if (history.length > 0) {
                await this.loadChatHistory(history, { skipClear: true });
            } else {
                this.renderWelcomeMessage();
            }
        }
    }

    /**
     * Render static welcome message on page load.
     */
    renderWelcomeMessage () {
        if (!this.renderer) {
            return;
        }
        this.renderer.render(PAGE_LOAD_WELCOME_MESSAGE, MESSAGE_TYPES.ASSISTANT);
    }

    /**
     * ==============================================
     * Message Processing and Rendering
     * ==============================================
     * Core message handling functionality
     * Processes messages, extracts content, and renders to UI
     * @param {string|object} messageData - The message data to process
     * @param {string} type - The message type (user, assistant, error)
     * @returns {Promise<string|null>} - The processed content or null if failed
     */
    async processAndRenderMessage (messageData, type) {
        if (!messageData) {
            console.warn('[ChatManager] No message data provided');
            return null;
        }

        try {
            const parsedData = this.parseMessageData(messageData);
            const content = this.extractMessageContent(parsedData);
            if (!content) {
                console.warn('[ChatManager] No content extracted from message data:', messageData);
                return null;
            }

            const normalizedMessage = this.normalizeMessage({
                ...((typeof parsedData === 'object' && parsedData) ? parsedData : {}),
                content
            }, type);

            await this.safeRenderMessage(normalizedMessage);
            this.processQuestionButtons(parsedData);

            debugLog('[ChatManager] Message processed successfully:', {
                type,
                contentLength: normalizedMessage.content.length,
                hasButtons: this.hasQuestionButtons(parsedData)
            });

            return normalizedMessage;
        } catch (error) {
            console.error('[ChatManager] Failed to process and render message:', error);
            this.handleError(error, 'processAndRenderMessage');
            return null;
        }
    }

    /**
     * Process question buttons from response data
     * @param {object} data - The response data containing questions
     */
    processQuestionButtons (data) {
        if (!data || typeof data !== 'object') {
            return;
        }

        const questions = data.questions ||
                (data.response && data.response.questions);

        if (Array.isArray(questions) && questions.length > 0) {
            this.renderer.renderButtons(questions);
        }
    }

    /**
     * Check if response data contains question buttons
     * @param {object} data - The response data to check
     * @returns {boolean} - True if questions are present
     */
    hasQuestionButtons (data) {
        if (!data || typeof data !== 'object') {
            return false;
        }

        const questions = data.questions ||
            (data.response && data.response.questions);

        return Array.isArray(questions) && questions.length > 0;
    }

    /**
     * ==============================================
     * User Interaction Handlers
     * ==============================================
     * Methods for handling user actions
     * Sending messages, clicking buttons, etc.
     * @param {string} message - The message to send
     * @returns {Promise<object|null>} - The API response or null if failed
     */
    async handleSend (message) {
        if (!this.validateSendConditions(message)) {
            console.warn('[ChatManager] Message validation failed:', message);
            return null;
        }

        try {
            this.eventManager.publish(EventManager.EVENTS.CHAT.TYPING_INDICATOR_SHOW, {});
            await this.startMessageProcessing();

            // Process and render user message
            await this.processAndRenderMessage(message, MESSAGE_TYPES.USER);

            // Save user message to chat history
            await this.chatHistoryManager.addMessage({
                content: message,
                type: MESSAGE_TYPES.USER
            });

            this.eventManager.publish(EventManager.EVENTS.CHAT.MESSAGE_SENT, { message });

            // Get and process API response with timeout
            const data = await this.getApiResponseWithTimeout(message);
            if (!data) {
                console.warn('[ChatManager] Empty response received from API');
                return null;
            }

            debugLog('[ChatManager] API response received:', {
                hasResponse: !!data.response,
                hasIntent: !!data.intent,
                responseType: typeof data.response
            });

            // Process question buttons
            this.processQuestionButtons(data.response);

            // Extract response content and metadata
            const responseContent = this.extractResponseContent(data);
            if (!responseContent) {
                console.warn('[ChatManager] No content found in response');
                return null;
            }

            // Process and render assistant response
            await this.processAndRenderMessage(responseContent, MESSAGE_TYPES.ASSISTANT);

            // Save assistant response to chat history
            await this.chatHistoryManager.addMessage({
                content: responseContent,
                type: MESSAGE_TYPES.ASSISTANT,
                metadata: {
                    intent: data.intent,
                    hasButtons: this.hasQuestionButtons(data.response)
                }
            });

            // Handle script operations based on intent
            await this.handleScriptOperations(data);

            return data;
        } catch (error) {
            this.handleError(error, 'handleSend');
            await this.safeRenderMessage(ERROR_MESSAGES.API_ERROR, MESSAGE_TYPES.ERROR);
            throw error;
        } finally {
            await this.endMessageProcessing();
            this.eventManager.publish(EventManager.EVENTS.CHAT.TYPING_INDICATOR_HIDE, {});
        }
    }

    /**
     * Handle button click events
     * @param {string} text - The button text to send as message
     */
    handleButtonClick (text) {
        if (text && typeof text === 'string' && text.trim()) {
            this.handleSend(text.trim());
        }
    }

    /**
     * Get API response with timeout handling and script context
     * @param {string} message - The message to send
     * @returns {Promise<object|null>} - The API response or null if failed
     */
    async getApiResponseWithTimeout (message) {
        const timeout = 30000; // 30 seconds timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), timeout);
        });

        try {
            // Get script context for AI
            const scriptContext = await this.scriptContextManager.getAIChatContext({
                includeHistory: true,
                maxTokens: 1000
            });

            return await Promise.race([
                this.api.getChatResponse(message, scriptContext),
                timeoutPromise
            ]);
        } catch (error) {
            if (error.message === 'Request timeout') {
                console.error('[ChatManager] API request timed out after', timeout, 'ms');
            }
            throw error;
        }
    }

    /**
     * Handle script operations based on response intent
     * @param {object} data - The API response data
     */
    async handleScriptOperations (data) {
        const intent = data.intent || (data.response && data.response.intent);

        if (!intent) {
            return;
        }

        await this.scriptOperationsHandler.handleIntent(intent, data);
    }

    /**
     * ==============================================
     * Chat History Management
     * ==============================================
     * Loading and managing chat history
     * Processing historical messages
     * @param {Array} messages - The messages to load
     */
    async loadChatHistory (messages, options = {}) {
        if (!this.validateHistoryConditions(messages)) {
            return;
        }

        try {
            await this.startMessageProcessing();
            const { skipClear = false } = options;
            if (!skipClear) {
                this.renderer.clear();
            }

            for (const message of messages) {
                const type = this.determineMessageType(message);
                await this.processAndRenderMessage(message, type);
            }
        } catch (error) {
            this.handleError(error, 'loadChatHistory');
        } finally {
            await this.endMessageProcessing();
        }
    }

    /**
     * Load chat history for current script
     * @returns {Promise<Array>} - The loaded chat history
     */
    async loadCurrentScriptHistory () {
        try {
            const history = await this.chatHistoryManager.loadScriptHistory(
                this.chatHistoryManager.currentScriptId
            );

            if (history.length > 0) {
                await this.loadChatHistory(history);
            }

            return history;
        } catch (error) {
            this.handleError(error, 'loadCurrentScriptHistory');
            return [];
        }
    }

    /**
     * Get current script's chat history
     * @returns {Array} - The current script's chat history
     */
    getCurrentScriptHistory () {
        return this.chatHistoryManager.getCurrentScriptHistory();
    }

    /**
     * Clear chat history for current script
     * @returns {Promise<boolean>} - True if cleared successfully
     */
    async clearCurrentScriptHistory () {
        try {
            const result = await this.chatHistoryManager.clearScriptHistory(
                this.chatHistoryManager.currentScriptId
            );

            if (result) {
                this.renderer.clear();
            }

            return result;
        } catch (error) {
            this.handleError(error, 'clearCurrentScriptHistory');
            return false;
        }
    }

    /**
     *
     * @param message
     */
    determineMessageType (message) {
        if (message.type) {
            return message.type;
        }
        if (message.role) {
            return message.role === 'assistant' ? MESSAGE_TYPES.ASSISTANT : MESSAGE_TYPES.USER;
        }
        return MESSAGE_TYPES.USER;
    }

    parseMessageData (data) {
        if (typeof data === 'string') {
            try {
                return JSON.parse(data);
            } catch (error) {
                return data;
            }
        }
        return data;
    }

    extractMessageContent (data) {
        if (typeof data === 'string') {
            const parsed = this.tryParseJsonString(data);
            if (parsed) {
                return this.extractMessageContent(parsed);
            }
            return data.trim();
        }

        if (!data) {
            return '';
        }

        if (typeof data === 'object') {
            if (data.response && typeof data.response === 'string') {
                return data.response.trim();
            }

            const messageFields = ['message', 'text', 'content', 'details', 'answer', 'reply'];
            for (const field of messageFields) {
                if (data[field] && typeof data[field] === 'string') {
                    const parsed = this.tryParseJsonString(data[field]);
                    if (parsed) {
                        return this.extractMessageContent(parsed);
                    }
                    return data[field].trim();
                }
            }

            if (data.response && typeof data.response === 'object') {
                return this.extractMessageContent(data.response);
            }

            if (data.content && typeof data.content === 'string') {
                return data.content.trim();
            }

            if (typeof data.toString === 'function' && data.toString() !== '[object Object]') {
                return data.toString().trim();
            }
        }

        console.warn('[ChatManager] Could not extract content from response:', data);
        return '';
    }

    tryParseJsonString (value) {
        if (!value || typeof value !== 'string') {
            return null;
        }
        const trimmed = value.trim();
        if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) {
            return null;
        }
        try {
            const parsed = JSON.parse(trimmed);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (error) {
            return null;
        }
    }

    normalizeMessage (messageData, type) {
        const data = (messageData && typeof messageData === 'object') ? messageData : { content: messageData };
        const role = data.role || data.type || type || MESSAGE_TYPES.USER;

        return {
            id: data.id || this.generateMessageId(),
            role,
            type: role,
            content: data.content || '',
            timestamp: data.timestamp || new Date().toISOString(),
            status: data.status,
            metadata: data.metadata || {},
            intent: data.intent || (data.metadata && data.metadata.intent)
        };
    }

    extractResponseContent (data) {
        if (!data || !data.response) {
            return null;
        }

        if (typeof data.response === 'string') {
            return data.response;
        }

        if (typeof data.response === 'object') {
            return data.response.response ||
                   data.response.message ||
                   data.response.content ||
                   data.response;
        }

        return null;
    }

    /**
     * ==============================================
     * Validation and State Management
     * ==============================================
     * Methods for validating conditions and managing state
     * @param {string} message - The message to validate
     * @returns {boolean} - True if validation passes
     */
    validateSendConditions (message) {
        if (!this.renderer) {
            console.error('[ChatManager] No renderer available');
            return false;
        }

        if (!this.renderer.container) {
            console.error('[ChatManager] No renderer container available');
            return false;
        }

        if (!message || typeof message !== 'string') {
            console.error('[ChatManager] Invalid message format:', typeof message);
            return false;
        }

        const trimmedMessage = message.trim();
        if (!trimmedMessage) {
            console.warn('[ChatManager] Empty message provided');
            return false;
        }

        if (trimmedMessage.length > 10000) {
            console.warn('[ChatManager] Message too long:', trimmedMessage.length);
            return false;
        }

        if (this.isProcessing) {
            console.warn('[ChatManager] Message processing already in progress');
            return false;
        }

        if (!this.api || typeof this.api.getChatResponse !== 'function') {
            console.error('[ChatManager] API not available or invalid');
            return false;
        }

        return true;
    }

    /**
     *
     * @param messages
     */
    validateHistoryConditions (messages) {
        if (!Array.isArray(messages)) {
            console.warn('[ChatManager] Messages is not an array:', messages);
            return false;
        }
        if (!this.renderer || !this.renderer.container) {
            console.error('[ChatManager] No renderer or container available');
            return false;
        }
        return true;
    }

    /**
     *
     */
    async startMessageProcessing () {
        if (this.isProcessing) {
            throw new Error('Message processing already in progress');
        }
        this.isProcessing = true;
        await this.stateManager.setState(StateManager.KEYS.LOADING, true);
    }

    /**
     *
     */
    async endMessageProcessing () {
        this.isProcessing = false;
        await this.stateManager.setState(StateManager.KEYS.LOADING, false);
    }

    /**
     * ==============================================
     * Error Handling and Utilities
     * ==============================================
     * Error handling, rendering safety, and cleanup
     * @param content
     * @param type
     */
    async safeRenderMessage (content, type) {
        try {
            await Promise.resolve(this.renderer.render(content, type));
        } catch (error) {
            console.error('Failed to render message:', error);
            this.handleError(error, 'renderMessage');
        }
    }

    /**
     * Generate a unique message ID
     * @returns {string}
     */
    generateMessageId () {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Handle errors with proper logging and state management
     * @param {Error} error - The error object
     * @param {string} context - The context where the error occurred
     */
    handleError (error, context) {
        const errorMessage = error && error.message || 'Unknown error occurred';
        const errorDetails = {
            context,
            message: errorMessage,
            stack: error && error.stack,
            timestamp: new Date().toISOString()
        };

        console.error(`[ChatManager] Error in ${context}:`, errorDetails);

        // Set error state
        this.stateManager.setState(StateManager.KEYS.ERROR, errorDetails);

        // Emit error event for external handling
        if (this.eventManager) {
            this.eventManager.publish(EventManager.EVENTS.CHAT.ERROR, errorDetails);
        }
    }

    /**
     * ==============================================
     * Cleanup and Maintenance
     * ==============================================
     * Methods for cleaning up and updating chat state
     */
    clearChat () {
        if (this.renderer && this.renderer.container) {
            this.renderer.clear();
        }
    }

    /**
     *
     * @param chat
     */
    updateChat (chat) {
        if (!chat.api) {
            throw new Error('Invalid chat object provided for update');
        }
        this.api = chat.api;
        this.clearChat();
    }

    /**
     * Set content manager for script context
     * @param {object} contentManager - Content manager instance
     */
    setContentManager (contentManager) {
        this.scriptContextManager.setContentManager(contentManager);
    }

    /**
     * Set page manager for script context
     * @param {object} pageManager - Page manager instance
     */
    setPageManager (pageManager) {
        this.scriptContextManager.setPageManager(pageManager);
    }

    /**
     * Set chapter manager for script context
     * @param {object} chapterManager - Chapter manager instance
     */
    setChapterManager (chapterManager) {
        this.scriptContextManager.setChapterManager(chapterManager);
    }

    /**
     * Get script context for AI operations
     * @param {object} options - Context options
     * @returns {Promise<object>} - Script context
     */
    async getScriptContext (options = {}) {
        return this.scriptContextManager.getScriptContext(options);
    }

    /**
     * Get AI chat context
     * @param {object} options - Context options
     * @returns {Promise<object>} - AI chat context
     */
    async getAIChatContext (options = {}) {
        return this.scriptContextManager.getAIChatContext(options);
    }

    /**
     * Destroy the chat manager and clean up resources
     */
    destroy () {
        this.clearChat();

        // Destroy chat history manager
        if (this.chatHistoryManager) {
            this.chatHistoryManager.destroy();
            this.chatHistoryManager = null;
        }

        // Destroy script context manager
        if (this.scriptContextManager) {
            this.scriptContextManager.destroy();
            this.scriptContextManager = null;
        }

        super.destroy();
    }

}
