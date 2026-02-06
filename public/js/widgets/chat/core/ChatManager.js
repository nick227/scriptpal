import { MESSAGE_TYPES, ERROR_MESSAGES } from '../../../constants.js';
import { BaseManager } from '../../../core/BaseManager.js';
import { EventManager } from '../../../core/EventManager.js';
import { debugLog } from '../../../core/logger.js';
import { StateManager } from '../../../core/StateManager.js';
import { RendererFactory } from '../../../renderers.js';
import { ScriptContextManager } from '../../editor/context/ScriptContextManager.js';

import { ChatHistoryManager } from './ChatHistoryManager.js';
import { validateSendConditions, validateHistoryConditions } from './ChatValidationService.js';
import {
    extractFormattedScriptFromResponse,
    extractRenderableContent
} from './ResponseExtractor.js';
import { ScriptOperationsHandler } from './ScriptOperationsHandler.js';

const createDefaultRenderer = () => {
    const container = typeof document !== 'undefined' && document.createElement
        ? document.createElement('div')
        : {};

    return {
        container,
        render: () => Promise.resolve(true),
        renderButtons: () => {},
        clear: () => {}
    };
};

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
        this.appendQueue = new Map();
        this._boundHandleScriptChange = this.handleScriptChange.bind(this);

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

    ensureRenderer () {
        if (this.renderer && this.renderer.container) {
            return;
        }
        this.renderer = createDefaultRenderer();
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
        this.flushAppendQueue();
    }

    /**
     *
     * @param elements
     */
    initialize (elements) {
        super.initialize(elements);
        this.setRenderer(RendererFactory.createMessageRenderer(elements.messagesContainer, this));
        this.stateManager.subscribe(StateManager.KEYS.CURRENT_SCRIPT, this._boundHandleScriptChange);
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
        const scriptId = script?.id || null;
        const previousScriptId = this.currentScriptId;
        const isNewScript = !previousScriptId || (scriptId && previousScriptId !== scriptId);
        this.currentScriptId = scriptId;

        if (!script || !this.renderer) {
            return;
        }

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

        this.dropQueueForOtherScripts(script.id);
        this.flushAppendQueue();
    }

    flushAppendQueue () {
        if (!this.scriptOrchestrator || this.appendQueue.size === 0) {
            return;
        }

        if (!this.isEditorReady()) {
            return;
        }

        const currentScript = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
        if (!currentScript || !currentScript.id) {
            return;
        }

        this.processAppendQueueForScript(currentScript.id);
    }

    async processAppendQueueForScript (scriptId) {
        const queued = this.appendQueue.get(scriptId) || [];
        if (queued.length === 0) {
            return;
        }

        const remaining = [...queued];
        while (remaining.length > 0) {
            const payload = remaining[0];
            try {
                await this.scriptOperationsHandler.handleIntent('APPEND_SCRIPT', payload);
                remaining.shift();
            } catch (_error) {
                this.processAndRenderMessage(
                    'Append replay failed. Please try again.',
                    MESSAGE_TYPES.ASSISTANT
                );
                break;
            }
        }

        if (remaining.length > 0) {
            this.appendQueue.set(scriptId, remaining);
            return;
        }

        this.appendQueue.delete(scriptId);
    }

    dropQueueForOtherScripts (activeScriptId) {
        const activeId = String(activeScriptId);
        const dropped = [];
        for (const [scriptId, entries] of this.appendQueue.entries()) {
            if (String(scriptId) !== activeId) {
                dropped.push(...entries);
                this.appendQueue.delete(scriptId);
            }
        }

        if (dropped.length > 0) {
            this.processAndRenderMessage(
                'Append discarded because you switched scripts before the editor was ready.',
                MESSAGE_TYPES.ASSISTANT
            );
        }
    }

    isEditorReady () {
        return this.stateManager.getState(StateManager.KEYS.EDITOR_READY) === true;
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
     * Renders message content to UI.
     * Expects a string (API responses are already extracted upstream via extractResponseContent).
     * @param {string} messageData - The message content to render
     * @param {string} type - The message type (user, assistant, error)
     * @returns {Promise<string|null>} - The processed content or null if failed
     */
    async processAndRenderMessage (messageData, type) {
        const content = extractRenderableContent(messageData);
        if (!content) {
            if (messageData != null) {
                console.warn('[ChatManager] No content in message data:', messageData);
            }
            return messageData == null ? '' : null;
        }

        try {
            await this.safeRenderMessage(content, type);

            debugLog('[ChatManager] Message processed successfully:', {
                type,
                contentLength: content.length
            });

            return content;
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
        this.ensureRenderer();

        const sendValidation = validateSendConditions({
            message,
            renderer: this.renderer,
            api: this.api,
            isProcessing: this.isProcessing
        });
        if (!sendValidation.ok) {
            console.warn('[ChatManager] Message validation failed:', sendValidation.reason, message);
            return null;
        }

        try {
            this.eventManager.publish(EventManager.EVENTS.CHAT.TYPING_INDICATOR_SHOW, {});
            await this.startMessageProcessing();

            // Get and process API response with timeout
            const currentScript = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
            const currentScriptId = currentScript?.id ?? null;
            console.log('[ChatManager] Sending AI request', {
                prompt: message,
                scriptId: currentScriptId,
                scriptTitle: currentScript?.title
            });
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
            console.log('[ChatManager] Raw AI response', data);

            const historyRows = data?.history ?? data?.messages ?? [];

            if (Array.isArray(historyRows) && historyRows.length > 0) {
                this.processQuestionButtons(data.response);
                await this.appendServerMessages(historyRows);
            } else {
                const content = extractRenderableContent(data.response);
                if (!content) {
                    await this.safeRenderMessage(ERROR_MESSAGES.API_ERROR, MESSAGE_TYPES.ERROR);
                    return null;
                }
                await this.processAndRenderMessage(content, MESSAGE_TYPES.ASSISTANT);
            }

            this.eventManager.publish(EventManager.EVENTS.CHAT.MESSAGE_SENT, { message });

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
            return this.handleSend(text.trim());
        }
        return null;
    }

    /**
     * Get API response with timeout handling and script context
     * @param {string} message - The message to send
     * @returns {Promise<object|null>} - The API response or null if failed
     */
    async getApiResponseWithTimeout (message) {
        const timeout = 90000; // 90 seconds timeout
        const timeoutPromise = new Promise((_resolve, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), timeout);
        });

        try {
            // Get script context for AI
            const scriptContext = await this.scriptContextManager.getAIChatContext({
                includeHistory: true,
                maxTokens: 1000
            });
            return await Promise.race([
                this.api.getChatResponse(message, {
                    ...scriptContext
                }),
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
        let intent = data.intent || (data.response && data.response.intent);
        if (!intent) {
            return;
        }

        let operationData = data;
        if (intent === 'NEXT_FIVE_LINES') {
            const formattedScript = extractFormattedScriptFromResponse(data.response);
            if (!formattedScript) {
                this.emitScriptBlockedEmpty({
                    intent,
                    reason: 'formatted_script_missing'
                });
                return;
            }
            intent = 'APPEND_SCRIPT';
            operationData = {
                ...data,
                response: {
                    ...(data.response && typeof data.response === 'object' ? data.response : {}),
                    content: formattedScript,
                    metadata: {
                        ...(data.response && typeof data.response === 'object' ? data.response.metadata : {}),
                        formattedScript
                    }
                }
            };
        }

        console.log('[ChatManager] handleScriptOperations', {
            intent,
            hasResponse: !!operationData.response,
            responseType: typeof operationData.response
        });

        if (intent === 'APPEND_SCRIPT') {
            const currentScript = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
            if (!currentScript || !currentScript.id) {
                await this.processAndRenderMessage(
                    'Select a script before appending new content.',
                    MESSAGE_TYPES.ASSISTANT
                );
                return;
            }

            if (!this.isEditorReady()) {
                console.debug('[ChatManager] Editor not ready, queueing append');
                const existing = this.appendQueue.get(currentScript.id) || [];
                this.appendQueue.set(currentScript.id, [
                    ...existing,
                    { ...operationData, scriptId: currentScript.id, timestamp: Date.now() }
                ]);
                return;
            }

            if (!this.scriptOrchestrator) {
                await this.processAndRenderMessage(
                    'Append failed: editor not ready.',
                    MESSAGE_TYPES.ASSISTANT
                );
                return;
            }
        }

        await this.scriptOperationsHandler.handleIntent(intent, operationData);
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
        const historyValidation = validateHistoryConditions({
            messages,
            renderer: this.renderer
        });
        if (!historyValidation.ok) {
            console.warn('[ChatManager] History validation failed:', historyValidation.reason);
            return;
        }

        try {
            const { skipClear = false } = options;
            if (!skipClear) {
                this.renderer.clear();
            }

            for (const message of messages) {
                const type = this.determineMessageType(message);
                const content = message?.content ?? message?.message ?? '';
                if (content) {
                    await this.processAndRenderMessage(content, type);
                }
            }
        } catch (error) {
            this.handleError(error, 'loadChatHistory');
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
                await this.loadCurrentScriptHistory();
            }

            return result;
        } catch (error) {
            this.handleError(error, 'clearCurrentScriptHistory');
            return false;
        }
    }

    /**
     * Determine message type from server row. Expects server to return role.
     * Long term: drop type; use role only.
     * @param {object} message - Server row with role or type
     * @returns {string}
     */
    determineMessageType (message) {
        if (message.role) {
            return message.role === 'assistant' ? MESSAGE_TYPES.ASSISTANT : MESSAGE_TYPES.USER;
        }
        if (message.type) {
            return message.type;
        }
        return MESSAGE_TYPES.USER;
    }

    emitScriptBlockedEmpty (details = {}) {
        console.warn('[ChatManager] Script blocked due to empty output', details);
        if (this.eventManager) {
            this.eventManager.publish(EventManager.EVENTS.AI.SCRIPT_BLOCKED_EMPTY, {
                ...details,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Append a batch of server-provided messages without clearing the renderer.
     * @param {Array} messages
     */
    async appendServerMessages (messages = []) {
        if (!Array.isArray(messages) || messages.length === 0) return;

        const historyValidation = validateHistoryConditions({
            messages,
            renderer: this.renderer
        });
        if (!historyValidation.ok) {
            console.warn('[ChatManager] History validation failed:', historyValidation.reason);
            return;
        }

        await this.loadChatHistory(messages, { skipClear: true });
        this.chatHistoryManager.appendHistory(messages);
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
        if (!chat || !chat.api) {
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

        if (this.stateManager && this._boundHandleScriptChange) {
            this.stateManager.unsubscribe(StateManager.KEYS.CURRENT_SCRIPT, this._boundHandleScriptChange);
            this._boundHandleScriptChange = null;
        }

        super.destroy();
    }

}
