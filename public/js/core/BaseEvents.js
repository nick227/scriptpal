/**
 * Base class for all event handlers with common event management
 */
export class BaseEvents {
    /**
     *
     * @param handlers
     */
    constructor (handlers) {
        this.handlers = handlers;
        this.listeners = new Map();
    }

    /**
     *
     * @param elements
     */
    initialize (elements) {
        if (!elements) {
            throw new Error('Elements required for initialization');
        }
        this.elements = elements;
        this.setupEvents();
    }

    /**
     *
     */
    setupEvents () {
        // Override in child classes
    }

    /**
     *
     * @param element
     * @param event
     * @param handler
     */
    addEventListener (element, event, handler) {
        if (!element) return;

        if (!this.listeners.has(element)) {
            this.listeners.set(element, new Set());
        }

        const elementListeners = this.listeners.get(element);
        elementListeners.add({ event, handler });
        element.addEventListener(event, handler);
    }

    /**
     *
     */
    cleanup () {
        this.listeners.forEach((elementListeners, element) => {
            elementListeners.forEach(({ event, handler }) => {
                element.removeEventListener(event, handler);
            });
        });
        this.listeners.clear();
    }

    /**
     *
     * @param type
     */
    getEventType (type) {
        const eventTypes = {
            auth: 'submit',
            chat: 'click',
            view: 'click'
        };
        return eventTypes[type] || 'click';
    }
}
