/**
 * Centralized event bus for widget communication
 */
export class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    subscribe(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    unsubscribe(event, callback) {
        const listeners = this.listeners.get(event);
        if (listeners) {
            listeners.delete(callback);
        }
    }

    publish(event, data) {
        const listeners = this.listeners.get(event);
        if (listeners) {
            listeners.forEach(callback => callback(data));
        }
    }

    // Common event types
    static EVENTS = {
        AUTH: {
            LOGIN: 'auth:login',
            LOGOUT: 'auth:logout',
            REGISTER: 'auth:register'
        },
        CHAT: {
            MESSAGE_SENT: 'chat:message:sent',
            MESSAGE_RECEIVED: 'chat:message:received',
            BUTTON_CLICKED: 'chat:button:clicked'
        },
        SCRIPT: {
            SELECTED: 'script:selected',
            UPDATED: 'script:updated',
            CREATED: 'script:created'
        },
        VIEW: {
            CHANGED: 'view:changed'
        }
    };
}