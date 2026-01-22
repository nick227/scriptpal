/**
 * Accessibility Manager
 * Provides ARIA roles, labels, and keyboard navigation support
 */
export class AccessibilityManager {
    /**
     *
     * @param options
     */
    constructor (options = {}) {
        this.announcer = options.announcer || this._createAnnouncer();
        this.keyboardShortcuts = new Map();
        this.focusableElements = new Set();
        this.currentFocusIndex = -1;
        this.focusTrap = null;
        this.announcements = [];
        this.maxAnnouncements = 10;
    }

    /**
     * Create screen reader announcer
     * @returns {HTMLElement} - Announcer element
     */
    _createAnnouncer () {
        const announcer = document.createElement('div');
        announcer.setAttribute('aria-live', 'polite');
        announcer.setAttribute('aria-atomic', 'true');
        announcer.className = 'sr-only';
        announcer.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        document.body.appendChild(announcer);
        return announcer;
    }

    /**
     * Announce message to screen readers
     * @param {string} message - Message to announce
     * @param {string} priority - Priority level (polite, assertive)
     */
    announce (message, priority = 'polite') {
        if (!message) return;

        const announcer = this.announcer;
        announcer.setAttribute('aria-live', priority);

        // Clear previous message
        announcer.textContent = '';

        // Add new message
        setTimeout(() => {
            announcer.textContent = message;
        }, 100);

        // Store announcement
        this.announcements.unshift({
            message,
            priority,
            timestamp: new Date().toISOString()
        });

        // Limit announcements
        if (this.announcements.length > this.maxAnnouncements) {
            this.announcements.pop();
        }
    }

    /**
     * Set up ARIA roles and labels for editor
     * @param {HTMLElement} editorContainer - Editor container
     * @param {HTMLElement} toolbar - Editor toolbar
     * @param {HTMLElement} editorArea - Editor content area
     */
    setupEditorAccessibility (editorContainer, toolbar, editorArea) {
        // Editor container
        editorContainer.setAttribute('role', 'application');
        editorContainer.setAttribute('aria-label', 'Script Editor');
        editorContainer.setAttribute('aria-describedby', 'editor-instructions');

        // Toolbar
        if (toolbar) {
            toolbar.setAttribute('role', 'toolbar');
            toolbar.setAttribute('aria-label', 'Editor Formatting Tools');
            toolbar.setAttribute('aria-orientation', 'horizontal');
        }

        // Editor area
        editorArea.setAttribute('role', 'textbox');
        editorArea.setAttribute('aria-label', 'Script Content');
        editorArea.setAttribute('aria-multiline', 'true');
        editorArea.setAttribute('aria-describedby', 'editor-instructions');
        editorArea.setAttribute('tabindex', '0');

        // Add instructions
        this._addEditorInstructions(editorContainer);
    }

    /**
     * Add editor instructions
     * @param {HTMLElement} container - Container element
     */
    _addEditorInstructions (container) {
        const instructions = document.createElement('div');
        instructions.id = 'editor-instructions';
        instructions.className = 'sr-only';
        instructions.innerHTML = `
            <p>Script Editor Instructions:</p>
            <ul>
                <li>Use Enter to create new lines</li>
                <li>Use Left/Right arrow keys to change line format</li>
                <li>Use Tab to navigate between toolbar buttons</li>
                <li>Use Escape to exit edit mode</li>
            </ul>
        `;
        container.appendChild(instructions);
    }

    /**
     * Set up ARIA roles for chat widget
     * @param {HTMLElement} chatContainer - Chat container
     * @param {HTMLElement} chatInput - Chat input
     * @param {HTMLElement} chatMessages - Chat messages area
     */
    setupChatAccessibility (chatContainer, chatInput, chatMessages) {
        // Chat container
        chatContainer.setAttribute('role', 'region');
        chatContainer.setAttribute('aria-label', 'AI Assistant Chat');
        chatContainer.setAttribute('aria-describedby', 'chat-instructions');

        // Chat input
        chatInput.setAttribute('role', 'textbox');
        chatInput.setAttribute('aria-label', 'Chat message input');
        chatInput.setAttribute('aria-describedby', 'chat-instructions');
        chatInput.setAttribute('aria-expanded', 'false');

        // Chat messages
        chatMessages.setAttribute('role', 'log');
        chatMessages.setAttribute('aria-label', 'Chat messages');
        chatMessages.setAttribute('aria-live', 'polite');
        chatMessages.setAttribute('aria-atomic', 'false');

        // Add chat instructions
        this._addChatInstructions(chatContainer);
    }

    /**
     * Add chat instructions
     * @param {HTMLElement} container - Container element
     */
    _addChatInstructions (container) {
        const instructions = document.createElement('div');
        instructions.id = 'chat-instructions';
        instructions.className = 'sr-only';
        instructions.innerHTML = `
            <p>Chat Instructions:</p>
            <ul>
                <li>Type your message and press Enter to send</li>
                <li>Use Shift+Enter for new lines</li>
                <li>Use Escape to close chat</li>
            </ul>
        `;
        container.appendChild(instructions);
    }

    /**
     * Set up keyboard shortcuts
     * @param {object} shortcuts - Shortcut definitions
     */
    setupKeyboardShortcuts (shortcuts) {
        for (const [key, handler] of Object.entries(shortcuts)) {
            this.keyboardShortcuts.set(key, handler);
        }

        document.addEventListener('keydown', this._handleKeyboardShortcuts.bind(this));
    }

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} event - Keyboard event
     */
    _handleKeyboardShortcuts (event) {
        const key = this._getShortcutKey(event);
        const handler = this.keyboardShortcuts.get(key);

        if (handler) {
            event.preventDefault();
            handler(event);
        }
    }

    /**
     * Get shortcut key string
     * @param {KeyboardEvent} event - Keyboard event
     * @returns {string} - Shortcut key
     */
    _getShortcutKey (event) {
        const modifiers = [];
        if (event.ctrlKey) modifiers.push('ctrl');
        if (event.altKey) modifiers.push('alt');
        if (event.shiftKey) modifiers.push('shift');
        if (event.metaKey) modifiers.push('meta');

        const key = event.key.toLowerCase();
        return modifiers.length > 0 ? `${modifiers.join('+')}+${key}` : key;
    }

    /**
     * Set up focus management
     * @param {HTMLElement[]} elements - Focusable elements
     */
    setupFocusManagement (elements) {
        this.focusableElements.clear();
        elements.forEach(element => {
            if (element && element instanceof HTMLElement) {
                this.focusableElements.add(element);
                element.setAttribute('tabindex', '0');
            }
        });
    }

    /**
     * Move focus to next element
     */
    focusNext () {
        const elements = Array.from(this.focusableElements);
        if (elements.length === 0) return;

        this.currentFocusIndex = (this.currentFocusIndex + 1) % elements.length;
        elements[this.currentFocusIndex].focus();
    }

    /**
     * Move focus to previous element
     */
    focusPrevious () {
        const elements = Array.from(this.focusableElements);
        if (elements.length === 0) return;

        this.currentFocusIndex = this.currentFocusIndex <= 0
            ? elements.length - 1
            : this.currentFocusIndex - 1;
        elements[this.currentFocusIndex].focus();
    }

    /**
     * Set up focus trap
     * @param {HTMLElement} container - Container to trap focus in
     */
    setupFocusTrap (container) {
        this.focusTrap = container;
        container.addEventListener('keydown', this._handleFocusTrap.bind(this));
    }

    /**
     * Handle focus trap
     * @param {KeyboardEvent} event - Keyboard event
     */
    _handleFocusTrap (event) {
        if (event.key !== 'Tab') return;

        const focusableElements = this._getFocusableElements(this.focusTrap);
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
            if (document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        }
    }

    /**
     * Get focusable elements within container
     * @param {HTMLElement} container - Container element
     * @returns {HTMLElement[]} - Focusable elements
     */
    _getFocusableElements (container) {
        const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        return Array.from(container.querySelectorAll(selector));
    }

    /**
     * Add ARIA attributes to element
     * @param {HTMLElement} element - Element to modify
     * @param {object} attributes - ARIA attributes
     */
    addARIAttributes (element, attributes) {
        for (const [key, value] of Object.entries(attributes)) {
            element.setAttribute(key, value);
        }
    }

    /**
     * Update ARIA state
     * @param {HTMLElement} element - Element to update
     * @param {string} state - State name
     * @param {*} value - State value
     */
    updateAriaState (element, state, value) {
        const attribute = `aria-${state}`;
        element.setAttribute(attribute, value);
    }

    /**
     * Create accessible button
     * @param {object} options - Button options
     * @returns {HTMLButtonElement} - Accessible button
     */
    createAccessibleButton (options) {
        const button = document.createElement('button');
        button.textContent = options.text || '';
        button.setAttribute('type', options.type || 'button');

        if (options.ariaLabel) {
            button.setAttribute('aria-label', options.ariaLabel);
        }

        if (options.ariaDescribedBy) {
            button.setAttribute('aria-describedby', options.ariaDescribedBy);
        }

        if (options.disabled) {
            button.disabled = true;
            button.setAttribute('aria-disabled', 'true');
        }

        return button;
    }

    /**
     * Create accessible input
     * @param {object} options - Input options
     * @returns {HTMLInputElement} - Accessible input
     */
    createAccessibleInput (options) {
        const input = document.createElement('input');
        input.type = options.type || 'text';
        input.placeholder = options.placeholder || '';

        if (options.ariaLabel) {
            input.setAttribute('aria-label', options.ariaLabel);
        }

        if (options.ariaDescribedBy) {
            input.setAttribute('aria-describedby', options.ariaDescribedBy);
        }

        if (options.required) {
            input.required = true;
            input.setAttribute('aria-required', 'true');
        }

        return input;
    }

    /**
     * Get accessibility statistics
     * @returns {object} - Accessibility statistics
     */
    getAccessibilityStats () {
        return {
            keyboardShortcuts: this.keyboardShortcuts.size,
            focusableElements: this.focusableElements.size,
            announcements: this.announcements.length,
            hasFocusTrap: !!this.focusTrap
        };
    }

    /**
     * Cleanup and destroy
     */
    destroy () {
        // Remove event listeners
        document.removeEventListener('keydown', this._handleKeyboardShortcuts.bind(this));

        // Remove announcer
        if (this.announcer && this.announcer.parentNode) {
            this.announcer.parentNode.removeChild(this.announcer);
        }

        // Clear data
        this.keyboardShortcuts.clear();
        this.focusableElements.clear();
        this.announcements = [];
    }
}

/**
 * Accessibility Manager Factory
 */
export class AccessibilityManagerFactory {
    /**
     * Create accessibility manager
     * @param {object} options - Manager options
     * @returns {AccessibilityManager} - New manager instance
     */
    static create (options = {}) {
        return new AccessibilityManager(options);
    }
}
