export const widgetHtml = `
            <div class="chat-header">
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
            </div>
        `;
