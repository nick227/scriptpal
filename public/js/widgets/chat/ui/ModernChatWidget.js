/**
 * Modern Chat Widget
 *
 * A modern, feature-rich chat interface with:
 * - Beautiful gradient design
 * - Typing indicators
 * - Message status
 * - Emoji support
 * - File uploads
 * - Voice recording
 * - Message reactions
 * - Smooth animations
 */

import { EventManager } from '../../../core/EventManager.js';
import { BaseWidget } from '../../BaseWidget.js';

/**
 *
 */
export class ModernChatWidget extends BaseWidget {
    /**
     *
     * @param elements
     */
    constructor (elements, stateManager = null, eventManager = null) {
        super(elements);
        this.emojiPicker = null;
        this.fileUpload = null;
        this.voiceRecorder = null;
        this.reactions = new Map();
        this.isMinimized = false;
        this._boundHandleInputChange = this.handleInputChange.bind(this);
        this._boundHandleKeyDown = this.handleKeyDown.bind(this);
        this._boundHandlePaste = this.handlePaste.bind(this);
        this._boundHandleButtonClick = this.handleButtonClick.bind(this);
        this._boundAutoResize = this.autoResizeTextarea.bind(this);
        if (stateManager || eventManager) {
            this.setManagers(stateManager, eventManager);
        }
    }

    /**
     * Initialize the modern chat widget
     */
    async initialize () {
        this.createModernUI();
        await super.initialize();
        this.initializeFeatures();
        this.minimizeChat(true);
    }

    /**
     * Create the modern chat UI structure
     */
    createModernUI () {
        const container = this.elements.container;
        if (!container) return;

        // Clear existing content
        container.innerHTML = '';

        // Create modern chat structure
        container.innerHTML = `
            <div class="chat-header">
                <h2>Script Assistant</h2>
                    <button class="chat-action-btn" title="Minimize" data-action="minimize" aria-label="Minimize chat">
                        <i class="fas fa-minus"></i>
                    </button>
            </div>

            <div class="chat-surface">
                <div class="chat-messages" id="chat-messages" data-renderer="modern" role="log" aria-live="polite"></div>

                <div class="typing-indicator hidden" id="typing-indicator" aria-live="polite">
                    <div class="message-avatar">AI</div>
                    <div class="typing-dots">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                </div>
            </div>

            <div class="chat-input-area">
                <div class="prompt-helper-container" id="prompt-helper-panel"></div>
                <div class="chat-input-container">
                    <div class="chat-input-wrapper">
                        <textarea
                            id="user-input"
                            placeholder="Message ScriptPal..."
                            rows="1"
                            aria-label="Chat message"
                        ></textarea>
                    </div>
                    <div class="chat-input-actions">
                        <button class="chat-input-btn primary" title="Send" data-action="send" aria-label="Send message">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>

            <div class="chat-controls">
                <button class="chat-control-btn" data-action="clear">
                    <i class="fas fa-trash"></i>
                    <span>Clear</span>
                </button>
                <button class="chat-control-btn" data-action="export">
                    <i class="fas fa-download"></i>
                    <span>Export</span>
                </button>
                <button class="chat-control-btn" data-action="history">
                    <i class="fas fa-history"></i>
                    <span>History</span>
                </button>
            </div>
        `;

        // Store references to new elements
        this.elements.messagesContainer = container.querySelector('#chat-messages');
        this.elements.userInput = container.querySelector('#user-input');
        this.elements.typingIndicator = container.querySelector('#typing-indicator');
        this.elements.sendButton = container.querySelector('[data-action="send"]');
        this.elements.promptHelperPanel = container.querySelector('#prompt-helper-panel');
        this.elements.minimizeButton = container.querySelector('[data-action="minimize"]');
    }

    /**
     * Setup event listeners for the modern chat
     */
    setupEventListeners () {
        const container = this.elements.container;
        if (!container) return;

        // Input events
        const userInput = this.elements.userInput;
        if (userInput) {
            userInput.addEventListener('input', this._boundHandleInputChange);
            userInput.addEventListener('keydown', this._boundHandleKeyDown);
            userInput.addEventListener('paste', this._boundHandlePaste);
        }

        // Button events
        container.addEventListener('click', this._boundHandleButtonClick);

        // Auto-resize textarea
        if (userInput) {
            userInput.addEventListener('input', this._boundAutoResize);
        }

        if (this.eventManager) {
            this.subscribe(EventManager.EVENTS.CHAT.TYPING_INDICATOR_SHOW, this.showTypingIndicator.bind(this));
            this.subscribe(EventManager.EVENTS.CHAT.TYPING_INDICATOR_HIDE, this.hideTypingIndicator.bind(this));
        }
    }

    /**
     * Initialize modern chat features
     */
    initializeFeatures () {
        this.initializeEmojiPicker();
        this.initializeFileUpload();
        this.initializeVoiceRecorder();
        this.initializeMessageReactions();
    }

    /**
     * Initialize emoji picker
     */
    initializeEmojiPicker () {
        // TODO: Implement emoji picker
    }

    /**
     * Initialize file upload functionality
     */
    initializeFileUpload () {
        // TODO: Implement file upload
    }

    /**
     * Initialize voice recorder
     */
    initializeVoiceRecorder () {
        // TODO: Implement voice recording
    }

    /**
     * Initialize message reactions
     */
    initializeMessageReactions () {
        // TODO: Implement message reactions
    }

    /**
     * Handle input changes
     * @param event
     */
    handleInputChange (event) {
        const input = event.target;
        const value = input.value.trim();

        // Show/hide send button based on input
        const sendBtn = this.elements.sendButton;
        if (sendBtn) {
            if (value) {
                sendBtn.classList.add('active');
            } else {
                sendBtn.classList.remove('active');
            }
        }
    }

    /**
     * Show typing indicator
     */
    showTypingIndicator () {
        const indicator = this.elements.typingIndicator;
        if (indicator) {
            indicator.classList.remove('hidden');
            indicator.classList.add('fade-in');
        }
    }

    /**
     * Hide typing indicator
     */
    hideTypingIndicator () {
        const indicator = this.elements.typingIndicator;
        if (indicator) {
            indicator.classList.add('hidden');
            indicator.classList.remove('fade-in');
        }
    }

    /**
     * Handle key down events
     * @param event
     */
    handleKeyDown (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }

    /**
     * Handle paste events
     * @param event
     */
    handlePaste (event) {
        // Handle file paste
        const items = event.clipboardData?.items;
        if (items) {
            for (const item of items) {
                if (item.type.indexOf('image') !== -1) {
                    event.preventDefault();
                    this.handleImagePaste(item);
                }
            }
        }
    }

    /**
     * Handle image paste
     * @param item
     */
    handleImagePaste (item) {
        const file = item.getAsFile();
        if (file) {
            this.eventManager?.publish(EventManager.EVENTS.CHAT.INPUT_ENHANCEMENT_REQUESTED, {
                type: 'paste-image',
                file
            });
        }
    }

    /**
     * Handle button clicks
     * @param event
     */
    handleButtonClick (event) {
        const button = event.target.closest('button');
        if (!button) return;

        const action = button.dataset.action;
        if (!action) return;

        switch (action) {
            case 'send':
                this.sendMessage();
                break;
            case 'emoji':
                this.toggleEmojiPicker();
                break;
            case 'attach':
                this.openFileUpload();
                break;
            case 'voice':
                this.toggleVoiceRecording();
                break;
            case 'clear':
                this.clearChat();
                break;
            case 'export':
                this.exportChat();
                break;
            case 'history':
                this.showChatHistory();
                break;
            case 'settings':
                this.showSettings();
                break;
            case 'minimize':
                this.minimizeChat();
                break;
            case 'close':
                this.closeChat();
                break;
        }
    }

    /**
     * Send a message
     */
    sendMessage () {
        const input = this.elements.userInput;
        if (!input) return;

        const message = input.value.trim();
        if (!message) return;

        // Clear input
        input.value = '';
        this.autoResizeTextarea();

        // Emit send request
        this.eventManager?.publish(EventManager.EVENTS.CHAT.REQUEST_SEND, {
            message: message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Auto-resize textarea
     */
    autoResizeTextarea () {
        const textarea = this.elements.userInput;
        if (!textarea) return;

        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }


    /**
     * Toggle emoji picker
     */
    toggleEmojiPicker () {
        this.eventManager?.publish(EventManager.EVENTS.CHAT.INPUT_ENHANCEMENT_REQUESTED, {
            type: 'emoji'
        });
    }

    /**
     * Open file upload dialog
     */
    openFileUpload () {
        this.eventManager?.publish(EventManager.EVENTS.CHAT.INPUT_ENHANCEMENT_REQUESTED, {
            type: 'file'
        });
    }

    /**
     * Toggle voice recording
     */
    toggleVoiceRecording () {
        this.eventManager?.publish(EventManager.EVENTS.CHAT.INPUT_ENHANCEMENT_REQUESTED, {
            type: 'voice'
        });
    }

    /**
     * Clear chat
     */
    clearChat () {
        this.eventManager?.publish(EventManager.EVENTS.CHAT.REQUEST_CLEAR, {});
    }

    /**
     * Export chat
     */
    exportChat () {
        this.eventManager?.publish(EventManager.EVENTS.CHAT.REQUEST_EXPORT, {});
    }

    /**
     * Show chat history
     */
    showChatHistory () {
        this.eventManager?.publish(EventManager.EVENTS.CHAT.REQUEST_HISTORY, {});
    }

    /**
     * Show settings
     */
    showSettings () {
        this.eventManager?.publish(EventManager.EVENTS.CHAT.REQUEST_SETTINGS, {});
    }

    /**
     * Minimize chat
     */
    minimizeChat (initialState = false) {
        const container = this.elements.container;
        if (!container) return;

        const isMinimized = initialState ? initialState : container.classList.toggle('minimized') || false;
        this.isMinimized = isMinimized;

        const minimizeButton = this.elements.minimizeButton || container.querySelector('[data-action="minimize"]');
        const icon = minimizeButton ? minimizeButton.querySelector('i') : null;
        if (icon) {
            icon.classList.toggle('fa-comment-dots', isMinimized);
            icon.classList.toggle('fa-minus', !isMinimized);
        }

        this.eventManager?.publish(EventManager.EVENTS.CHAT.REQUEST_MINIMIZE, { minimized: isMinimized });
        this.eventManager?.publish(EventManager.EVENTS.CHAT.CONTAINER_MINIMIZED, { minimized: isMinimized });
    }

    /**
     * Close chat
     */
    closeChat () {
        this.eventManager?.publish(EventManager.EVENTS.CHAT.REQUEST_CLOSE, {});
    }

    /**
     * Destroy the widget
     */
    destroy () {
        const container = this.elements.container;
        const userInput = this.elements.userInput;
        if (container) {
            container.removeEventListener('click', this._boundHandleButtonClick);
        }
        if (userInput) {
            userInput.removeEventListener('input', this._boundHandleInputChange);
            userInput.removeEventListener('keydown', this._boundHandleKeyDown);
            userInput.removeEventListener('paste', this._boundHandlePaste);
            userInput.removeEventListener('input', this._boundAutoResize);
        }
        super.destroy();
    }
}
