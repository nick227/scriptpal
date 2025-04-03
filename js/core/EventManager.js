export class EventManager {
    constructor() {
        this.listeners = new Map();
        this.subscriptions = new Map();
    }

    subscribe(event, callback, context = null) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        // Track subscription for cleanup
        if (context) {
            if (!this.subscriptions.has(context)) {
                this.subscriptions.set(context, new Set());
            }
            this.subscriptions.get(context).add({ event, callback });
        }

        // Return unsubscribe function
        return () => this.unsubscribe(event, callback);
    }

    unsubscribe(event, callback) {
        const listeners = this.listeners.get(event);
        if (listeners) {
            listeners.delete(callback);
        }
    }

    unsubscribeAll(context) {
        const subscriptions = this.subscriptions.get(context);
        if (subscriptions) {
            subscriptions.forEach(({ event, callback }) => {
                this.unsubscribe(event, callback);
            });
            this.subscriptions.delete(context);
        }
    }

    publish(event, data) {
        console.log('EventManager: publish', event, data);
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
            CREATED: 'script:created',
            EDIT: 'script:edit',
            DELETE: 'script:delete',
            ACTIONS: 'script:actions',
            BUTTONS: 'script:buttons'
        },
        VIEW: {
            CHANGED: 'view:changed'
        },
        ERROR: 'error'
    };
}