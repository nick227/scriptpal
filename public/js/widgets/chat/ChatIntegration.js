/**
 * Chat Integration Module
 *
 * This module provides easy integration of the modern chat interface
 * into the main ScriptPal application.
 */

import { ChatManager } from './ChatManager.js';
import { ModernChatWidget } from './ModernChatWidget.js';
import { SystemPromptBridge } from './SystemPromptBridge.js';
import { EventManager } from '../../core/EventManager.js';

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
        this.systemPromptBridge = null;
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
            this.systemPromptBridge = new SystemPromptBridge({
                api: this.api,
                chatManager: this.chatManager,
                eventManager: this.eventManager,
                stateManager: this.stateManager,
                container: chatContainer
            });
            this.systemPromptBridge.initialize();

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
                        this.chatManager.processAndRenderMessage(data.response, 'assistant');
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

        if (this.systemPromptBridge) {
            this.systemPromptBridge.destroy();
            this.systemPromptBridge = null;
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
