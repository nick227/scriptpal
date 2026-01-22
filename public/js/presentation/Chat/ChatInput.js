/**
 * ChatInput - Single responsibility: Handle chat input
 * Under 300 lines, focused on input handling only
 */
export class ChatInput {
    /**
     *
     * @param container
     */
    constructor (container) {
        this.container = container;
        this.inputElement = null;
        this.sendButton = null;
        this.eventHandlers = new Map();
        this.isEnabled = true;
    }

    /**
     * Initialize chat input
     */
    init () {
        this.createInputElements();
        this.setupEventListeners();
    }

    /**
     * Create input DOM elements
     */
    createInputElements () {
        // Create input container
        const inputContainer = document.createElement('div');
        inputContainer.className = 'chat-input-container';

        // Create input field
        this.inputElement = document.createElement('textarea');
        this.inputElement.className = 'chat-input';
        this.inputElement.placeholder = 'Type your message...';
        this.inputElement.rows = 1;

        // Create send button
        this.sendButton = document.createElement('button');
        this.sendButton.className = 'chat-send-button';
        this.sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
        this.sendButton.disabled = true;

        // Assemble elements
        inputContainer.appendChild(this.inputElement);
        inputContainer.appendChild(this.sendButton);
        this.container.appendChild(inputContainer);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners () {
        // Input change handler
        const inputHandler = () => this.handleInputChange();
        this.inputElement.addEventListener('input', inputHandler);
        this.eventHandlers.set('input', inputHandler);

        // Send button click handler
        const sendHandler = () => this.handleSend();
        this.sendButton.addEventListener('click', sendHandler);
        this.eventHandlers.set('send', sendHandler);

        // Enter key handler
        const keyHandler = (e) => this.handleKeyPress(e);
        this.inputElement.addEventListener('keydown', keyHandler);
        this.eventHandlers.set('keydown', keyHandler);

        // Auto-resize handler
        const resizeHandler = () => this.autoResize();
        this.inputElement.addEventListener('input', resizeHandler);
        this.eventHandlers.set('resize', resizeHandler);
    }

    /**
     * Handle input change
     */
    handleInputChange () {
        const hasText = this.inputElement.value.trim().length > 0;
        this.sendButton.disabled = !hasText || !this.isEnabled;
    }

    /**
     * Handle send button click
     */
    handleSend () {
        if (!this.isEnabled) return;

        const message = this.inputElement.value.trim();
        if (message) {
            this.sendMessage(message);
            this.clearInput();
        }
    }

    /**
     * Handle key press
     * @param event
     */
    handleKeyPress (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.handleSend();
        }
    }

    /**
     * Auto-resize textarea
     */
    autoResize () {
        this.inputElement.style.height = 'auto';
        this.inputElement.style.height = Math.min(this.inputElement.scrollHeight, 120) + 'px';
    }

    /**
     * Send message (emit event)
     * @param message
     */
    sendMessage (message) {
        const event = new CustomEvent('chatMessage', {
            detail: { message }
        });
        this.container.dispatchEvent(event);
    }

    /**
     * Clear input field
     */
    clearInput () {
        this.inputElement.value = '';
        this.inputElement.style.height = 'auto';
        this.sendButton.disabled = true;
    }

    /**
     * Enable/disable input
     * @param enabled
     */
    setEnabled (enabled) {
        this.isEnabled = enabled;
        this.inputElement.disabled = !enabled;
        this.sendButton.disabled = !enabled || this.inputElement.value.trim().length === 0;
    }

    /**
     * Focus input field
     */
    focus () {
        this.inputElement.focus();
    }

    /**
     * Get current input value
     */
    getValue () {
        return this.inputElement.value;
    }

    /**
     * Set input value
     * @param value
     */
    setValue (value) {
        this.inputElement.value = value;
        this.handleInputChange();
    }

    /**
     * Clean up event listeners
     */
    destroy () {
        this.eventHandlers.forEach((handler, event) => {
            this.inputElement.removeEventListener(event, handler);
        });
        this.eventHandlers.clear();
    }
}
