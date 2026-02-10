/**
 * Chat Integration Module
 *
 * This module provides easy integration of the modern chat interface
 * into the main ScriptPal application.
 */

import { EventManager } from '../../../core/EventManager.js';

import { ChatManager } from '../core/ChatManager.js';
import { extractApiResponseContent, extractRenderableContent } from '../core/ResponseExtractor.js';
import { ModernChatWidget } from '../ui/ModernChatWidget.js';
import { PromptHelperBridge } from './PromptHelperBridge.js';

/**
 *
 */
export class ChatIntegration {
    /**
     *
     * @param api
     * @param stateManager
     * @param eventManager
     */
    constructor (api, stateManager, eventManager) {
        this.api = api;
        this.stateManager = stateManager;
        this.eventManager = eventManager;
        this.chatWidget = null;
        this.chatManager = null;
        this.scriptOrchestrator = null;
        this.promptHelperBridge = null;
        this.chatEventUnsubscribers = [];
        this.isInitialized = false;
    }

    /**
     * Initialize the modern chat integration
     */
    async initialize () {
        if (this.isInitialized) return;

        try {
            // Find chat container
            const chatContainer = document.querySelector('.chatbot-container');
            if (!chatContainer) {
                throw new Error('Chat container not found');
            }

            // Initialize modern chat widget
            this.chatWidget = new ModernChatWidget({ container: chatContainer }, this.stateManager, this.eventManager);
            await this.chatWidget.initialize();

            // Initialize shared chat manager
            this.chatManager = new ChatManager(
                this.stateManager,
                this.api,
                this.eventManager
            );
            await this.chatManager.initialize({
                container: chatContainer,
                messagesContainer: this.chatWidget.elements.messagesContainer
            });

            // Setup integration events
            this.setupIntegrationEvents();

            // Setup system prompt UI helpers
            this.promptHelperBridge = new PromptHelperBridge({
                api: this.api,
                chatManager: this.chatManager,
                eventManager: this.eventManager,
                stateManager: this.stateManager,
                helperContainer: this.chatWidget.elements?.promptHelperPanel
            });
            this.promptHelperBridge.initialize();

            this.isInitialized = true;

        } catch (error) {
            console.error('[ChatIntegration] Failed to initialize:', error);
            throw error;
        }
    }

    setScriptOrchestrator (orchestrator) {
        this.scriptOrchestrator = orchestrator;
        if (this.chatManager && orchestrator) {
            this.chatManager.setScriptOrchestrator(orchestrator);
        }
    }

    /**
     * Setup integration events
     */
    setupIntegrationEvents () {
        this.chatEventUnsubscribers = [
            this.eventManager.subscribe(
                EventManager.EVENTS.CHAT.REQUEST_SEND,
                (data) => {
                    if (!this.chatManager || !data || !data.message) return;
                    this.chatManager.handleSend(data.message);
                }
            ),
            this.eventManager.subscribe(
                EventManager.EVENTS.CHAT.REQUEST_CLEAR,
                async () => {
                    if (!this.chatManager) return;
                    await this.chatManager.clearCurrentScriptHistory();
                }
            ),
            this.eventManager.subscribe(
                EventManager.EVENTS.CHAT.REQUEST_HISTORY,
                async () => {
                    if (!this.chatManager) return;
                    await this.chatManager.loadCurrentScriptHistory();
                }
            ),
            this.eventManager.subscribe(
                EventManager.EVENTS.CHAT.REQUEST_EXPORT,
                () => {
                    console.warn('[ChatIntegration] Export not implemented yet');
                }
            ),
            this.eventManager.subscribe(
                EventManager.EVENTS.AI.RESPONSE_RECEIVED,
                (data) => {
                    if (this.chatManager && data && data.response) {
                        console.log('[ChatIntegration] AI.RESPONSE_RECEIVED', {
                            responseType: typeof data.response,
                            hasIntent: !!data.intent
                        });
                        const content = extractApiResponseContent(data) ||
                            extractRenderableContent(data.response);
                        if (!content) {
                            console.warn('[ChatIntegration] No renderable content on AI.RESPONSE_RECEIVED', data);
                            return;
                        }
                        console.log('[ChatIntegration] Rendering AI.RESPONSE_RECEIVED content', {
                            contentLength: content.length
                        });
                        this.chatManager.processAndRenderMessage(content, 'assistant');
                    }
                }
            )
        ];
    }

    /**
     * Get chat statistics
     */
    getChatStats () {
        console.warn('[ChatIntegration] Chat stats are not available in the shared manager yet');
        return null;
    }

    /**
     * Export chat history
     * @param format
     */
    exportChat (format = 'txt') {
        console.warn('[ChatIntegration] Export not implemented yet', format);
    }

    /**
     * Clear chat history
     */
    clearChat () {
        if (this.chatManager) {
            this.chatManager.clearCurrentScriptHistory();
        }
    }

    /**
     * Search chat messages
     * @param query
     */
    searchMessages (query) {
        console.warn('[ChatIntegration] Search not implemented yet', query);
        return [];
    }

    /**
     * Destroy the chat integration
     */
    destroy () {
        if (this.chatWidget) {
            this.chatWidget.destroy();
            this.chatWidget = null;
        }

        if (this.chatManager) {
            this.chatManager.destroy();
            this.chatManager = null;
        }

        if (this.promptHelperBridge) {
            this.promptHelperBridge.destroy();
            this.promptHelperBridge = null;
        }

        this.chatEventUnsubscribers.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.chatEventUnsubscribers = [];

        this.isInitialized = false;
    }
}
