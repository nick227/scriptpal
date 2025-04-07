export class StateManager {
    constructor() {
        // Initialize with default state
        this.state = new Map([
            ['loading', false],
            ['authenticated', false],
            ['currentView', null],
            ['error', null],
            ['user', null],
            ['currentScript', null],
            ['scripts', []]
        ]);

        this.subscribers = new Map();
        this.subscriptions = new Map();
        this.validators = {
            loading: (value) => typeof value === 'boolean',
            authenticated: (value) => typeof value === 'boolean',
            currentView: (value) => typeof value === 'string' || value === null,
            error: (value) => value instanceof Error || value === null,
            user: (value) => typeof value === 'object' || value === null,
            currentScript: (value) => value === null || (typeof value === 'object' && value !== undefined),
            scripts: (value) => Array.isArray(value)
        };
    }

    setState(key, value) {
        // Validate key exists
        if (!this.state.has(key)) {
            console.warn(`Attempting to set unknown state key: ${key}`);
            return;
        }

        // Handle undefined values
        if (value === undefined) {
            value = null;
        }

        // Validate value if validator exists
        if (this.validators[key] && !this.validators[key](value)) {
            console.warn(`Invalid value for state key ${key}:`, value);
            return;
        }

        const oldValue = this.state.get(key);
        this.state.set(key, value);

        // Notify subscribers if value changed
        if (oldValue !== value) {
            this.notifySubscribers(key, value);
        }
    }

    getState(key) {
        if (!this.state.has(key)) {
            console.warn(`Attempting to get unknown state key: ${key}`);
            return null;
        }
        return this.state.get(key);
    }

    // Convenience getters
    isLoading() {
        return this.state.get('loading');
    }

    isAuthenticated() {
        return this.state.get('authenticated');
    }

    getCurrentUser() {
        return this.state.get('user');
    }

    getCurrentScript() {
        return this.state.get('currentScript');
    }

    getError() {
        return this.state.get('error');
    }

    clearError() {
        this.setState('error', null);
    }

    // Subscription management
    subscribe(key, callback, context = null) {
        if (!this.state.has(key)) {
            console.warn(`Attempting to subscribe to unknown state key: ${key}`);
            return;
        }

        if (typeof callback !== 'function') {
            console.warn('Invalid callback provided to subscribe');
            return;
        }

        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }
        this.subscribers.get(key).add(callback);

        // Track subscription for cleanup
        if (context) {
            if (!this.subscriptions.has(context)) {
                this.subscriptions.set(context, new Set());
            }
            this.subscriptions.get(context).add({ key, callback });
        }

        // Return unsubscribe function
        return () => this.unsubscribe(key, callback);
    }

    unsubscribe(key, callback) {
        if (!this.state.has(key)) {
            console.warn(`Attempting to unsubscribe from unknown state key: ${key}`);
            return;
        }

        const subscribers = this.subscribers.get(key);
        if (subscribers) {
            subscribers.delete(callback);
        }
    }

    unsubscribeAll(context) {
        const subscriptions = this.subscriptions.get(context);
        if (subscriptions) {
            subscriptions.forEach(({ key, callback }) => {
                this.unsubscribe(key, callback);
            });
            this.subscriptions.delete(context);
        }
    }

    notifySubscribers(key, value) {
        const subscribers = this.subscribers.get(key);
        if (subscribers) {
            subscribers.forEach(callback => {
                try {
                    callback(value);
                } catch (error) {
                    console.error(`Error in state listener for ${key}:`, error);
                }
            });
        }
    }

    reset() {
        // Reset to default state
        this.state = new Map([
            ['loading', false],
            ['authenticated', false],
            ['currentView', null],
            ['error', null],
            ['user', null],
            ['currentScript', null],
            ['scripts', []]
        ]);
        this.subscribers.clear();
        this.subscriptions.clear();
    }

    // Helper method to check if state is in a valid state
    isValid() {
        return Array.from(this.state.entries()).every(([key, value]) =>
            !this.validators[key] || this.validators[key](value)
        );
    }

    // Common state keys
    static KEYS = {
        AUTHENTICATED: 'authenticated',
        USER: 'user',
        CURRENT_VIEW: 'currentView',
        LOADING: 'loading',
        ERROR: 'error',
        CURRENT_SCRIPT: 'currentScript',
        SCRIPTS: 'scripts'
    };
}