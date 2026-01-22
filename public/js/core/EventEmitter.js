// Event emitter implementation
/**
 *
 */
export class EventEmitter {
    /**
     *
     */
    constructor () {
        this._events = new Map();
    }

    /**
     *
     * @param event
     * @param listener
     */
    on (event, listener) {
        if (!this._events.has(event)) {
            this._events.set(event, new Set());
        }
        this._events.get(event).add(listener);
    }

    /**
     *
     * @param event
     * @param listener
     */
    off (event, listener) {
        if (this._events.has(event)) {
            this._events.get(event).delete(listener);
        }
    }

    /**
     *
     * @param event
     * @param {...any} args
     */
    emit (event, ...args) {
        if (this._events.has(event)) {
            for (const listener of this._events.get(event)) {
                try {
                    listener.apply(this, args);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            }
        }
    }

    /**
     *
     * @param event
     */
    removeAllListeners (event) {
        if (event) {
            this._events.delete(event);
        } else {
            this._events.clear();
        }
    }
}

// Disposable interface
const Disposable = {
    dispose () {
        if (typeof this.destroy === 'function') {
            this.destroy();
        }
    }
};

// Utility function for assertions
/**
 *
 * @param condition
 * @param message
 */
function assert (condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
