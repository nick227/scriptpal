/**
 * ChatRenderer - Single responsibility: Render chat messages to DOM
 * Under 300 lines, focused on rendering only
 */
export class ChatRenderer {
    /**
     *
     * @param container
     */
    constructor (container) {
        this.container = container;
        this.messages = new Map();
        this.isScrolledToBottom = true;
    }

    /**
     * Render a chat message
     * @param message
     */
    renderMessage (message) {
        const messageElement = this.createMessageElement(message);
        this.messages.set(message.id, messageElement);
        this.container.appendChild(messageElement);

        // Auto-scroll to bottom if user was already there
        if (this.isScrolledToBottom) {
            this.scrollToBottom();
        }

        return messageElement;
    }

    /**
     * Create message DOM element
     * @param message
     */
    createMessageElement (message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.type}`;
        messageDiv.dataset.messageId = message.id;

        const timestamp = new Date(message.timestamp).toLocaleTimeString();

        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${message.sender}</span>
                <span class="message-time">${timestamp}</span>
            </div>
            <div class="message-content">${message.content}</div>
        `;

        return messageDiv;
    }

    /**
     * Update message content
     * @param message
     */
    updateMessage (message) {
        const messageElement = this.messages.get(message.id);
        if (messageElement) {
            const contentDiv = messageElement.querySelector('.message-content');
            contentDiv.textContent = message.content;
        }
    }

    /**
     * Remove message from DOM
     * @param messageId
     */
    removeMessage (messageId) {
        const messageElement = this.messages.get(messageId);
        if (messageElement) {
            messageElement.remove();
            this.messages.delete(messageId);
        }
    }

    /**
     * Clear all messages
     */
    clear () {
        this.messages.forEach(messageElement => messageElement.remove());
        this.messages.clear();
    }

    /**
     * Scroll to bottom of chat
     */
    scrollToBottom () {
        this.container.scrollTop = this.container.scrollHeight;
    }

    /**
     * Check if user is scrolled to bottom
     */
    checkScrollPosition () {
        const threshold = 100;
        this.isScrolledToBottom =
            this.container.scrollTop + this.container.clientHeight >=
            this.container.scrollHeight - threshold;
    }

    /**
     * Get message element by ID
     * @param messageId
     */
    getMessageElement (messageId) {
        return this.messages.get(messageId);
    }
}
