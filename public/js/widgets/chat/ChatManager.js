import { MESSAGE_TYPES, ERROR_MESSAGES } from '../../constants.js';
import { BaseManager } from '../../core/BaseManager.js';
import { EventManager } from '../../core/EventManager.js';
import { StateManager } from '../../core/StateManager.js';
import { RendererFactory } from '../../renderers.js';
import { ScriptContextManager } from '../editor/context/ScriptContextManager.js';
import { debugLog } from '../../core/logger.js';

import { ChatHistoryManager } from './ChatHistoryManager.js';

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

        // Performance optimizations
        this._messageCache = new Map();
        this._cacheExpiry = 30000; // 30 seconds
        this._lastCacheCleanup = 0;
        this._batchOperations = [];
        this._isBatching = false;

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
    }

    /**
     *
     * @param script
     */
    handleScriptChange (script) {
        if (!script || !this.renderer) {
            return;
        }

        // Get previous script
        const previousScript = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);

        // Only add title message if it's a different script (by ID)
        if (!previousScript || previousScript.id !== script.id) {
            this.renderer.render(`Now chatting about: ${script.title}`, MESSAGE_TYPES.ASSISTANT);
        }
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
            // Parse content if it's a string
            let parsedData;
            if (typeof messageData === 'string') {
                try {
                    parsedData = JSON.parse(messageData);
                } catch (e) {
                    // If JSON parsing fails, treat as plain text
                    parsedData = messageData;
                }
            } else {
                parsedData = messageData;
            }

            // Extract the actual message content
            const content = this.processResponse(parsedData);
            if (!content) {
                console.warn('[ChatManager] Could not process message content:', messageData);
                return null;
            }

            const normalizedMessage = this.normalizeMessage({
                ...((typeof parsedData === 'object' && parsedData) ? parsedData : {}),
                content
            }, type);

            // Render the message with error handling
            await this.safeRenderMessage(normalizedMessage);

            // Process question buttons if present
            this.processQuestionButtons(parsedData);

            // Log successful processing
            debugLog('[ChatManager] Message processed successfully:', {
                type,
                contentLength: content.length,
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
     * Process and extract content from response data
     * @param {string|object} data - The response data to process
     * @returns {string} - The extracted content string
     */
    processResponse (data) {
        // If data is a string, return it directly
        if (typeof data === 'string') {
            return data.trim();
        }

        // If data is null or undefined, return empty string
        if (!data) {
            return '';
        }

        // Handle response object
        if (typeof data === 'object') {
            // Check for direct response content
            if (data.response && typeof data.response === 'string') {
                return data.response.trim();
            }

            // Check common message fields in order of preference
            const messageFields = ['message', 'text', 'content', 'details', 'answer', 'reply'];
            for (const field of messageFields) {
                if (data[field] && typeof data[field] === 'string') {
                    return data[field].trim();
                }
            }

            // If response is an object, recursively extract content
            if (data.response && typeof data.response === 'object') {
                return this.processResponse(data.response);
            }

            // Check for nested content in common structures
            if (data.content && typeof data.content === 'string') {
                return data.content.trim();
            }

            // If data has a toString method, use it
            if (typeof data.toString === 'function' && data.toString() !== '[object Object]') {
                return data.toString().trim();
            }
        }

        // If we can't extract content, return empty string
        console.warn('[ChatManager] Could not extract content from response:', data);
        return '';
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
     * Extract response content from API data
     * @param {object} data - The API response data
     * @returns {string|null} - The extracted content or null if not found
     */
    extractResponseContent (data) {
        if (!data || !data.response) {
            return null;
        }

        // Handle string response
        if (typeof data.response === 'string') {
            return data.response;
        }

        // Handle object response
        if (typeof data.response === 'object') {
            return data.response.response ||
                   data.response.message ||
                   data.response.content ||
                   data.response;
        }

        return null;
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


        if (intent === 'EDIT_SCRIPT' || intent === 'WRITE_SCRIPT') {
            await this.handleScriptEdit(data);
        } else if (intent === 'ANALYZE_SCRIPT') {
            await this.handleScriptAnalysis(data);
        } else if (intent === 'APPEND_SCRIPT') {
            await this.handleScriptAppend(data);
        }
    }

    /**
     * Handle script edit operations
     * @param {object} data - The API response data
     */
    async handleScriptEdit (data) {
        const content = data.response && data.response.content;
        const commands = data.response && data.response.commands;
        if (!content) {
            console.warn('[ChatManager] No content provided for script edit');
            return;
        }

        if (!this.scriptOrchestrator) {
            console.warn('[ChatManager] No script orchestrator available for script edit');
            return;
        }

        try {
            await this.scriptOrchestrator.handleScriptEdit({
                content: content,
                isFromEdit: true,
                versionNumber: data.response.versionNumber,
                commands: commands
            });
        } catch (error) {
            console.error('[ChatManager] Script edit failed:', error);
            this.handleError(error, 'handleScriptEdit');
        }
    }

    /**
     * Handle script analysis operations
     * @param {object} data - The API response data
     */
    async handleScriptAnalysis (data) {
        // Handle script analysis
        await this._handleScriptAnalysis(data);
    }

    /**
     * Internal method to handle script analysis
     * @param {object} data - The API response data
     */
    async _handleScriptAnalysis (data) {
        try {
            if (!data || !data.response) {
                throw new Error('Invalid analysis data received');
            }

            const analysis = data.response;

            // Display analysis in chat
            this.addMessage({
                type: 'ai',
                content: analysis,
                timestamp: new Date().toISOString()
            });

            // Emit analysis event
            this.eventManager.publish(EventManager.EVENTS.SCRIPT.ANALYSIS_COMPLETE, {
                analysis: analysis,
                scriptId: data.scriptId
            });

        } catch (error) {
            console.error('[ChatManager] Script analysis failed:', error);
            this.handleError(error, 'scriptAnalysis');
        }
    }

    /**
     * Handle script append operations
     * @param {object} data - The API response data
     */
    async handleScriptAppend (data) {

        // Check if response contains line insertion data
        if (this.hasLineInsertionData(data)) {
            await this.handleLineInsertion(data);
        } else {
            // Fallback to regular append
            const content = data.response && data.response.content;
            if (content && this.scriptOrchestrator) {
                try {
                    await this.scriptOrchestrator.handleScriptAppend({
                        content: content,
                        isFromAppend: true
                    });
                } catch (error) {
                    console.error('[ChatManager] Script append failed:', error);
                    this.handleError(error, 'handleScriptAppend');
                }
            }
        }
    }

    /**
     * Check if response contains line insertion data
     * @param {object} data - The API response data
     * @returns {boolean} - Whether response contains line insertion data
     */
    hasLineInsertionData (data) {
        const content = data.response && data.response.content;
        if (!content || typeof content !== 'string') {
            return false;
        }

        // Check for line number patterns
        const lineNumberPatterns = [
            /line\s+(\d+)/gi,
            /at\s+line\s+(\d+)/gi,
            /insert\s+at\s+line\s+(\d+)/gi,
            /after\s+line\s+(\d+)/gi,
            /before\s+line\s+(\d+)/gi
        ];

        return lineNumberPatterns.some(pattern => pattern.test(content));
    }

    /**
     * Handle line insertion from AI response
     * @param {object} data - The API response data
     */
    async handleLineInsertion (data) {
        try {

            // Emit AI response event for line insertion manager
            this.eventManager.publish(EventManager.EVENTS.AI.RESPONSE_RECEIVED, {
                response: data.response,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('[ChatManager] Line insertion failed:', error);
            this.handleError(error, 'handleLineInsertion');
        }
    }

    /**
     * ==============================================
     * Chat History Management
     * ==============================================
     * Loading and managing chat history
     * Processing historical messages
     * @param {Array} messages - The messages to load
     */
    async loadChatHistory (messages) {
        if (!this.validateHistoryConditions(messages)) {
            return;
        }

        try {
            await this.startMessageProcessing();
            this.renderer.clear();

            const sortedMessages = [...messages].reverse();
            for (const message of sortedMessages) {
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

    /**
     * ==============================================
     * Validation and State Management
     * ==============================================
     * Methods for validating conditions and managing state
     * @param {string} message - The message to validate
     * @returns {boolean} - True if validation passes
     */
    validateSendConditions (message) {
        // Check renderer availability
        if (!this.renderer) {
            console.error('[ChatManager] No renderer available');
            return false;
        }

        if (!this.renderer.container) {
            console.error('[ChatManager] No renderer container available');
            return false;
        }

        // Check message format
        if (!message || typeof message !== 'string') {
            console.error('[ChatManager] Invalid message format:', typeof message);
            return false;
        }

        // Check message content
        const trimmedMessage = message.trim();
        if (!trimmedMessage) {
            console.warn('[ChatManager] Empty message provided');
            return false;
        }

        // Check message length
        if (trimmedMessage.length > 10000) {
            console.warn('[ChatManager] Message too long:', trimmedMessage.length);
            return false;
        }

        // Check processing state
        if (this.isProcessing) {
            console.warn('[ChatManager] Message processing already in progress');
            return false;
        }

        // Check API availability
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
            console.warn('Messages is not an array:', messages);
            return false;
        }
        if (!this.renderer || !this.renderer.container) {
            console.error('No renderer or container available');
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
     * Normalize message data to a canonical shape
     * @param {object|string} messageData
     * @param {string} type
     * @returns {object}
     */
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

    // ==============================================
    // Performance Optimization Methods
    // ==============================================

    /**
     * Cache message for performance
     * @param key
     * @param message
     * @param ttl
     */
    cacheMessage (key, message, ttl = null) {
        const expiry = ttl || this._cacheExpiry;
        this._messageCache.set(key, {
            data: message,
            timestamp: Date.now(),
            expiry: expiry
        });

        // Cleanup old cache entries periodically
        this._cleanupCacheIfNeeded();
    }

    /**
     * Get cached message
     * @param key
     */
    getCachedMessage (key) {
        const cached = this._messageCache.get(key);
        if (!cached) {
            return null;
        }

        const now = Date.now();
        if (now - cached.timestamp > cached.expiry) {
            this._messageCache.delete(key);
            return null;
        }

        return cached.data;
    }

    /**
     * Clean up expired cache entries
     */
    _cleanupCacheIfNeeded () {
        const now = Date.now();
        if (now - this._lastCacheCleanup < 60000) { // Cleanup every minute
            return;
        }

        this._lastCacheCleanup = now;
        const expiredKeys = [];

        this._messageCache.forEach((value, key) => {
            if (now - value.timestamp > value.expiry) {
                expiredKeys.push(key);
            }
        });

        expiredKeys.forEach(key => this._messageCache.delete(key));

        if (expiredKeys.length > 0) {
        }
    }

    /**
     * Batch multiple operations for better performance
     * @param operation
     */
    batchOperation (operation) {
        this._batchOperations.push(operation);

        if (!this._isBatching) {
            this._isBatching = true;
            requestAnimationFrame(() => {
                this._processBatchOperations();
            });
        }
    }

    /**
     * Process batched operations
     */
    _processBatchOperations () {
        if (this._batchOperations.length === 0) {
            this._isBatching = false;
            return;
        }

        // Process all batched operations
        this._batchOperations.forEach(operation => {
            try {
                operation();
            } catch (error) {
                console.error('[ChatManager] Error in batched operation:', error);
            }
        });

        // Clear the batch
        this._batchOperations = [];
        this._isBatching = false;
    }

    /**
     * Optimized message processing with caching
     * @param message
     * @param type
     */
    async processMessageOptimized (message, type) {
        const cacheKey = `${type}_${message}`;
        const cached = this.getCachedMessage(cacheKey);

        if (cached) {
            return cached;
        }

        const result = await this.processAndRenderMessage(message, type);

        if (result) {
            this.cacheMessage(cacheKey, result);
        }

        return result;
    }

    /**
     * Get chat performance statistics
     */
    getPerformanceStats () {
        return {
            cacheSize: this._messageCache.size,
            batchQueueSize: this._batchOperations.length,
            isBatching: this._isBatching,
            isProcessing: this.isProcessing,
            lastCacheCleanup: this._lastCacheCleanup
        };
    }

    /**
     * Clear all caches
     */
    clearCaches () {
        this._messageCache.clear();
        this._batchOperations = [];
        this._isBatching = false;
    }
}
