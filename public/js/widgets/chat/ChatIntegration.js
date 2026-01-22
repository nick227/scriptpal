/**
 * Chat Integration Module
 *
 * This module provides easy integration of the modern chat interface
 * into the main ScriptPal application.
 */

import { SYSTEM_PROMPTS } from '../../../../shared/systemPrompts.js';
import { EventManager } from '../../core/EventManager.js';
import { debugLog } from '../../core/logger.js';
import { StateManager } from '../../core/StateManager.js';

import { ChatManager } from './ChatManager.js';
import { ModernChatWidget } from './ModernChatWidget.js';
import { SystemPromptOrchestrator } from './SystemPromptOrchestrator.js';

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
        this.systemPromptOrchestrator = null;
        this.systemPromptIndicator = null;
        this.systemPromptToolbar = null;
        this.systemPromptIndicatorTimeout = null;
        this.systemPromptEventUnsubscribers = [];
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

            this.systemPromptOrchestrator = new SystemPromptOrchestrator({
                api: this.api,
                chatManager: this.chatManager,
                eventManager: this.eventManager
            });
            this.systemPromptOrchestrator.initialize();

            // Setup integration events
            this.setupIntegrationEvents();

            // Setup system prompt UI helpers
            this.setupSystemPromptUI(chatContainer);

            this.isInitialized = true;
            debugLog('[ChatIntegration] Modern chat initialized successfully');

        } catch (error) {
            console.error('[ChatIntegration] Failed to initialize:', error);
            throw error;
        }
    }

    /**
     * Setup integration events
     */
    setupIntegrationEvents () {
        // UI-driven requests
        this.eventManager.subscribe(
            EventManager.EVENTS.CHAT.REQUEST_SEND,
            this.handleRequestSend.bind(this)
        );

        this.eventManager.subscribe(
            EventManager.EVENTS.CHAT.REQUEST_CLEAR,
            this.handleRequestClear.bind(this)
        );

        this.eventManager.subscribe(
            EventManager.EVENTS.CHAT.REQUEST_HISTORY,
            this.handleRequestHistory.bind(this)
        );

        this.eventManager.subscribe(
            EventManager.EVENTS.CHAT.REQUEST_EXPORT,
            this.handleRequestExport.bind(this)
        );

        // Listen for script changes to update chat context
        this.eventManager.subscribe(
            EventManager.EVENTS.SCRIPT.SELECTED,
            this.handleScriptSelected.bind(this)
        );

        // Listen for script updates
        this.eventManager.subscribe(
            EventManager.EVENTS.SCRIPT.UPDATED
            // TODO: Uncomment this when we have a need to handle script updates
            // this.handleScriptUpdated.bind(this)
        );

        // Listen for AI responses
        this.eventManager.subscribe(
            EventManager.EVENTS.AI.RESPONSE_RECEIVED,
            this.handleAIResponse.bind(this)
        );
    }

    /**
     * Handle UI send request
     * @param data
     */
    handleRequestSend (data) {
        if (!this.chatManager || !data || !data.message) return;
        this.chatManager.handleSend(data.message);
    }

    /**
     * Handle UI clear request
     */
    async handleRequestClear () {
        if (!this.chatManager) return;
        await this.chatManager.clearCurrentScriptHistory();
    }

    /**
     * Handle UI history request
     */
    async handleRequestHistory () {
        if (!this.chatManager) return;
        await this.chatManager.loadCurrentScriptHistory();
    }

    /**
     * Handle UI export request (placeholder for future implementation)
     */
    handleRequestExport () {
        console.warn('[ChatIntegration] Export not implemented yet');
    }

    /**
     * Handle script selection
     * @param data
     */
    handleScriptSelected (data) {
        if (this.chatManager && data.script) {
            this.chatManager.handleScriptChange(data.script);
        }
    }

    /**
     * Handle script updates
     * @param data
     */
    handleScriptUpdated (data) {
        if (this.chatManager && data.script) {
            // Update chat context with new script content
            this.chatManager.processAndRenderMessage(
                `Script "${data.script.title}" has been updated. I can help you with the changes!`,
                'assistant'
            );
        }
    }

    /**
     * Handle AI responses
     * @param data
     */
    handleAIResponse (data) {
        if (this.chatManager && data.response) {
            this.chatManager.processAndRenderMessage(data.response, 'assistant');
        }
    }

    setupSystemPromptUI (container) {
        if (!container) {
            return;
        }

        const computedPosition = window.getComputedStyle(container).position;
        if (!computedPosition || computedPosition === 'static') {
            container.style.position = 'relative';
        }

        if (!document.getElementById('system-prompt-spin-style')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'system-prompt-spin-style';
            styleEl.textContent = `
                @keyframes system-prompt-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(styleEl);
        }

        this.systemPromptToolbar = document.createElement('div');
        this.systemPromptToolbar.style.bottom = '12px';
        this.systemPromptToolbar.style.left = '12px';
        this.systemPromptToolbar.style.display = 'flex';
        this.systemPromptToolbar.style.gap = '4px';
        this.systemPromptToolbar.style.zIndex = '5';

        SYSTEM_PROMPTS.forEach(prompt => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = prompt.label;
            button.style.padding = '4px 8px';
            button.style.fontSize = '11px';
            button.style.borderRadius = '3px';
            button.style.border = '1px solid rgba(255, 255, 255, 0.5)';
            button.style.background = 'rgba(255, 255, 255, 0.1)';
            button.style.color = '#fff';
            button.style.cursor = 'pointer';
            button.addEventListener('click', () => this.handleSystemPromptButton(prompt.id));
            this.systemPromptToolbar.appendChild(button);
        });

        this.systemPromptIndicator = document.createElement('div');
        this.systemPromptIndicator.style.position = 'absolute';
        this.systemPromptIndicator.style.top = '12px';
        this.systemPromptIndicator.style.right = '12px';
        this.systemPromptIndicator.style.padding = '4px 10px';
        this.systemPromptIndicator.style.borderRadius = '16px';
        this.systemPromptIndicator.style.fontSize = '12px';
        this.systemPromptIndicator.style.fontWeight = '600';
        this.systemPromptIndicator.style.transition = 'opacity 0.3s ease';
        this.systemPromptIndicator.style.opacity = '0';
        this.systemPromptIndicator.style.zIndex = '6';
        this.systemPromptIndicator.textContent = 'System prompt idle';
        this.systemPromptIndicator.style.backgroundColor = 'rgba(33, 150, 243, 0.85)';

        this.systemPromptSpinner = document.createElement('div');
        this.systemPromptSpinner.style.width = '14px';
        this.systemPromptSpinner.style.height = '14px';
        this.systemPromptSpinner.style.border = '2px solid rgba(255, 255, 255, 0.6)';
        this.systemPromptSpinner.style.borderTopColor = 'transparent';
        this.systemPromptSpinner.style.borderRadius = '50%';
        this.systemPromptSpinner.style.marginLeft = '8px';
        this.systemPromptSpinner.style.animation = 'system-prompt-spin 1s linear infinite';
        this.systemPromptSpinner.style.opacity = '0';
        this.systemPromptSpinner.setAttribute('aria-hidden', 'true');

        container.appendChild(this.systemPromptToolbar);
        container.appendChild(this.systemPromptIndicator);
        this.systemPromptIndicator.appendChild(this.systemPromptSpinner);

        const readyUnsub = this.eventManager.subscribe(
            EventManager.EVENTS.SYSTEM_PROMPT.READY,
            this.handleSystemPromptReady.bind(this)
        );
        const firedUnsub = this.eventManager.subscribe(
            EventManager.EVENTS.SYSTEM_PROMPT.FIRED,
            this.handleSystemPromptFired.bind(this)
        );
        const failedUnsub = this.eventManager.subscribe(
            EventManager.EVENTS.SYSTEM_PROMPT.FAILED,
            this.handleSystemPromptFailed.bind(this)
        );

        this.systemPromptEventUnsubscribers.push(readyUnsub, firedUnsub, failedUnsub);
    }

    handleSystemPromptButton (promptId) {
        if (!this.systemPromptOrchestrator) {
            return;
        }
        const script = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
        const scriptId = script ? script.id : null;
        this.systemPromptOrchestrator.firePrompt(promptId, scriptId, { manual: true })
            .catch(error => {
                console.error('[ChatIntegration] Manual system prompt failed:', error);
            });
    }

    handleSystemPromptReady () {
        this.showSystemPromptSpinner();
        this.updateSystemPromptIndicator('✔️');
    }

    handleSystemPromptFired () {
        this.hideSystemPromptSpinner();
        this.updateSystemPromptIndicator('-');
    }

    handleSystemPromptFailed () {
        this.hideSystemPromptSpinner();
        this.updateSystemPromptIndicator('e');
    }

    updateSystemPromptIndicator (message) {
        if (!this.systemPromptIndicator) {
            return;
        }

        this.systemPromptIndicator.textContent = message;
        this.systemPromptIndicator.style.opacity = '1';

        if (this.systemPromptIndicatorTimeout) {
            clearTimeout(this.systemPromptIndicatorTimeout);
        }

        this.systemPromptIndicatorTimeout = setTimeout(() => {
            if (this.systemPromptIndicator) {
                this.systemPromptIndicator.style.opacity = '0';
            }
        }, 4000);
    }

    showSystemPromptSpinner () {
        if (this.systemPromptSpinner) {
            this.systemPromptSpinner.style.opacity = '1';
        }
    }

    hideSystemPromptSpinner () {
        if (this.systemPromptSpinner) {
            this.systemPromptSpinner.style.opacity = '0';
        }
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

        if (this.systemPromptOrchestrator) {
            this.systemPromptOrchestrator.destroy();
            this.systemPromptOrchestrator = null;
        }

        if (this.systemPromptToolbar) {
            this.systemPromptToolbar.remove();
            this.systemPromptToolbar = null;
        }

        if (this.systemPromptIndicator) {
            this.systemPromptIndicator.remove();
            this.systemPromptIndicator = null;
        }

        if (this.systemPromptIndicatorTimeout) {
            clearTimeout(this.systemPromptIndicatorTimeout);
            this.systemPromptIndicatorTimeout = null;
        }

        this.systemPromptEventUnsubscribers.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.systemPromptEventUnsubscribers = [];

        this.isInitialized = false;
    }
}
