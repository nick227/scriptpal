export class ChatPerformanceManager {
    constructor ({ cacheExpiry = 30000, cacheCleanupInterval = 60000 } = {}) {
        this._messageCache = new Map();
        this._cacheExpiry = cacheExpiry;
        this._lastCacheCleanup = 0;
        this._batchOperations = [];
        this._isBatching = false;
        this._cacheCleanupInterval = cacheCleanupInterval;
    }

    cacheMessage (key, message, ttl = null) {
        const expiry = ttl || this._cacheExpiry;
        this._messageCache.set(key, {
            data: message,
            timestamp: Date.now(),
            expiry
        });
        this._cleanupCacheIfNeeded();
    }

    getCachedMessage (key) {
        const cached = this._messageCache.get(key);
        if (!cached) {
            return null;
        }

        const now = Date.now();
        if (now - cached.timestamp > cached.expiry) {
            this._messageCache.delete(key);
            return null;
        }

        return cached.data;
    }

    _cleanupCacheIfNeeded () {
        const now = Date.now();
        if (now - this._lastCacheCleanup < this._cacheCleanupInterval) {
            return;
        }

        this._lastCacheCleanup = now;
        const expiredKeys = [];

        this._messageCache.forEach((value, key) => {
            if (now - value.timestamp > value.expiry) {
                expiredKeys.push(key);
            }
        });

        expiredKeys.forEach(key => this._messageCache.delete(key));
    }

    batchOperation (operation) {
        this._batchOperations.push(operation);

        if (!this._isBatching) {
            this._isBatching = true;
            requestAnimationFrame(() => {
                this._processBatchOperations();
            });
        }
    }

    _processBatchOperations () {
        if (this._batchOperations.length === 0) {
            this._isBatching = false;
            return;
        }

        this._batchOperations.forEach(operation => {
            try {
                operation();
            } catch (error) {
                console.error('[ChatPerformanceManager] Error in batched operation:', error);
            }
        });

        this._batchOperations = [];
        this._isBatching = false;
    }

    getStats () {
        return {
            cacheSize: this._messageCache.size,
            batchQueueSize: this._batchOperations.length,
            isBatching: this._isBatching,
            lastCacheCleanup: this._lastCacheCleanup
        };
    }

    clearCaches () {
        this._messageCache.clear();
        this._batchOperations = [];
        this._isBatching = false;
    }
}
