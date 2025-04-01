import { EventManager } from '../core/EventManager.js';
import { StateManager } from '../core/StateManager.js';
import { BaseRenderer } from '../core/BaseRenderer.js';

export class BaseWidget {
    constructor(elements = {}) {
        this.elements = elements;
        this.stateManager = null;
        this.eventManager = null;
        this.renderer = null;
        this.requiredElements = []; // Default to no required elements
    }

    async initialize() {
        // Only validate elements if there are required ones
        if (this.requiredElements.length > 0) {
            this.validateElements();
        }

        // Only set up renderer if messages container exists
        if (this.elements.messagesContainer) {
            this.renderer = new BaseRenderer(this.elements.messagesContainer);
        }

        await this.setupEventListeners();
        await this.setupStateSubscriptions();
    }

    validateElements() {
        // Check for all required elements
        this.requiredElements.forEach(elementName => {
            if (!this.elements[elementName]) {
                throw new Error(`${elementName} element is required`);
            }
        });
    }

    setupEventListeners() {
        // Override in child classes
    }

    setupStateSubscriptions() {
        // Override in child classes
    }

    subscribe(event, callback) {
        return this.eventManager.subscribe(event, callback, this);
    }

    publish(event, data) {
        this.eventManager.publish(event, data);
    }

    setState(key, value) {
        this.stateManager.setState(key, value);
    }

    getState(key) {
        return this.stateManager.getState(key);
    }

    subscribeToState(key, callback) {
        return this.stateManager.subscribe(key, callback, this);
    }

    handleError(error) {
        console.error('Widget Error:', error);
        this.publish(EventManager.EVENTS.ERROR, { error });
    }

    destroy() {
        // Clean up event subscriptions
        this.eventManager.unsubscribeAll(this);

        // Clean up state subscriptions
        this.stateManager.unsubscribeAll(this);

        // Clean up renderer
        if (this.renderer) {
            this.renderer = null;
        }

        // Clean up elements
        this.elements = {};
    }

    setManagers(stateManager, eventManager) {
        this.stateManager = stateManager;
        this.eventManager = eventManager;
    }

    // Common utility methods for all widgets
    scrollToBottom() {
        if (this.elements.messagesContainer) {
            this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
        }
    }

    clearContainer(container) {
        if (container) {
            container.innerHTML = '';
        }
    }

    createElement(tag, className, textContent = '') {
        const element = document.createElement(tag);
        if (className) {
            element.className = className;
        }
        if (textContent) {
            element.textContent = textContent;
        }
        return element;
    }

    appendToContainer(container, element) {
        if (container && element) {
            container.appendChild(element);
            this.scrollToBottom();
        }
    }
}