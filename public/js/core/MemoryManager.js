import { debugLog } from './logger.js';

/**
 * Memory Management Utilities
 *
 * This module provides utilities for managing memory usage and preventing memory leaks
 * across the application.
 */

/**
 *
 */
export class MemoryManager {
    /**
     *
     */
    constructor () {
        this.managedObjects = new WeakMap();
        this.eventListeners = new Map();
        this.intervals = new Set();
        this.timeouts = new Set();
        this.observers = new Set();
        this.memoryStats = {
            objectsCreated: 0,
            objectsDestroyed: 0,
            eventListenersAdded: 0,
            eventListenersRemoved: 0,
            intervalsCreated: 0,
            intervalsCleared: 0,
            timeoutsCreated: 0,
            timeoutsCleared: 0,
            observersCreated: 0,
            observersDisconnected: 0
        };
    }

    /**
     * Register an object for memory management
     * @param {object} obj - Object to manage
     * @param {Function} cleanupFn - Cleanup function
     * @returns {object} - The managed object
     */
    manageObject (obj, cleanupFn) {
        if (!obj || typeof obj !== 'object') {
            throw new Error('Invalid object provided for memory management');
        }

        this.managedObjects.set(obj, {
            cleanup: cleanupFn,
            createdAt: Date.now()
        });

        this.memoryStats.objectsCreated++;
        return obj;
    }

    /**
     * Clean up a managed object
     * @param {object} obj - Object to clean up
     */
    cleanupObject (obj) {
        const managed = this.managedObjects.get(obj);
        if (managed) {
            try {
                managed.cleanup();
            } catch (error) {
                console.error('[MemoryManager] Error during object cleanup:', error);
            }
            this.managedObjects.delete(obj);
            this.memoryStats.objectsDestroyed++;
        }
    }

    /**
     * Add an event listener with automatic cleanup tracking
     * @param {HTMLElement} element - Element to add listener to
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     * @param {object} options - Event options
     * @returns {Function} - Cleanup function
     */
    addEventListener (element, event, handler, options = {}) {
        const listenerId = `${element.constructor.name}-${event}-${Date.now()}`;

        element.addEventListener(event, handler, options);

        this.eventListeners.set(listenerId, {
            element,
            event,
            handler,
            options,
            addedAt: Date.now()
        });

        this.memoryStats.eventListenersAdded++;

        // Return cleanup function
        return () => {
            this.removeEventListener(listenerId);
        };
    }

    /**
     * Remove an event listener by ID
     * @param {string} listenerId - Listener ID
     */
    removeEventListener (listenerId) {
        const listener = this.eventListeners.get(listenerId);
        if (listener) {
            listener.element.removeEventListener(listener.event, listener.handler, listener.options);
            this.eventListeners.delete(listenerId);
            this.memoryStats.eventListenersRemoved++;
        }
    }

    /**
     * Create an interval with automatic cleanup tracking
     * @param {Function} callback - Callback function
     * @param {number} delay - Delay in milliseconds
     * @returns {number} - Interval ID
     */
    setInterval (callback, delay) {
        const id = setInterval(callback, delay);
        this.intervals.add(id);
        this.memoryStats.intervalsCreated++;
        return id;
    }

    /**
     * Clear an interval
     * @param {number} id - Interval ID
     */
    clearInterval (id) {
        if (this.intervals.has(id)) {
            clearInterval(id);
            this.intervals.delete(id);
            this.memoryStats.intervalsCleared++;
        }
    }

    /**
     * Create a timeout with automatic cleanup tracking
     * @param {Function} callback - Callback function
     * @param {number} delay - Delay in milliseconds
     * @returns {number} - Timeout ID
     */
    setTimeout (callback, delay) {
        const id = setTimeout(callback, delay);
        this.timeouts.add(id);
        this.memoryStats.timeoutsCreated++;
        return id;
    }

    /**
     * Clear a timeout
     * @param {number} id - Timeout ID
     */
    clearTimeout (id) {
        if (this.timeouts.has(id)) {
            clearTimeout(id);
            this.timeouts.delete(id);
            this.memoryStats.timeoutsCleared++;
        }
    }

    /**
     * Create a MutationObserver with automatic cleanup tracking
     * @param {Function} callback - Observer callback
     * @param {object} options - Observer options
     * @returns {MutationObserver} - Observer instance
     */
    createObserver (callback, options = {}) {
        const observer = new MutationObserver(callback);
        this.observers.add(observer);
        this.memoryStats.observersCreated++;
        return observer;
    }

    /**
     * Disconnect an observer
     * @param {MutationObserver} observer - Observer to disconnect
     */
    disconnectObserver (observer) {
        if (this.observers.has(observer)) {
            observer.disconnect();
            this.observers.delete(observer);
            this.memoryStats.observersDisconnected++;
        }
    }

    /**
     * Create a component with automatic memory management
     * @param {string} name - Component name
     * @param {Function} initFn - Initialization function
     * @param {Function} destroyFn - Destruction function
     * @returns {object} - Component instance
     */
    createComponent (name, initFn, destroyFn) {
        const component = {
            name,
            isDestroyed: false,
            _cleanupFunctions: []
        };

        // Initialize component
        if (typeof initFn === 'function') {
            const initResult = initFn(component);
            if (initResult && typeof initResult === 'object') {
                Object.assign(component, initResult);
            }
        }

        // Add cleanup function
        component.addCleanup = (fn) => {
            if (typeof fn === 'function') {
                component._cleanupFunctions.push(fn);
            }
        };

        // Add destroy method
        component.destroy = () => {
            if (component.isDestroyed) {
                return;
            }

            // Run all cleanup functions
            component._cleanupFunctions.forEach(fn => {
                try {
                    fn();
                } catch (error) {
                    console.error(`[MemoryManager] Error in cleanup function for ${name}:`, error);
                }
            });

            // Run main destroy function
            if (typeof destroyFn === 'function') {
                try {
                    destroyFn(component);
                } catch (error) {
                    console.error(`[MemoryManager] Error destroying component ${name}:`, error);
                }
            }

            component.isDestroyed = true;
            this.cleanupObject(component);
        };

        // Register for management
        this.manageObject(component, component.destroy);

        return component;
    }

    /**
     * Create a disposable resource
     * @param {Function} disposeFn - Disposal function
     * @returns {object} - Disposable resource
     */
    createDisposable (disposeFn) {
        const disposable = {
            isDisposed: false,
            dispose: () => {
                if (disposable.isDisposed) {
                    return;
                }

                try {
                    disposeFn();
                } catch (error) {
                    console.error('[MemoryManager] Error disposing resource:', error);
                }

                disposable.isDisposed = true;
            }
        };

        this.manageObject(disposable, disposable.dispose);
        return disposable;
    }

    /**
     * Force garbage collection (if available)
     */
    forceGC () {
        if (window.gc && typeof window.gc === 'function') {
            window.gc();
        }
    }

    /**
     * Get memory usage statistics
     * @returns {object} - Memory statistics
     */
    getMemoryStats () {
        const stats = {
            ...this.memoryStats,
            activeEventListeners: this.eventListeners.size,
            activeIntervals: this.intervals.size,
            activeTimeouts: this.timeouts.size,
            activeObservers: this.observers.size,
            managedObjects: this.managedObjects.size || 'Unknown (WeakMap)'
        };

        // Add browser memory info if available
        if (performance.memory) {
            stats.browserMemory = {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB',
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + ' MB',
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'
            };
        }

        return stats;
    }

    /**
     * Clean up all managed resources
     */
    cleanupAll () {
        // Clear all intervals
        this.intervals.forEach(id => clearInterval(id));
        this.intervals.clear();

        // Clear all timeouts
        this.timeouts.forEach(id => clearTimeout(id));
        this.timeouts.clear();

        // Disconnect all observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();

        // Remove all event listeners
        this.eventListeners.forEach((listener, id) => {
            this.removeEventListener(id);
        });

        // Note: Managed objects will be cleaned up automatically when they're garbage collected
        // since we use WeakMap
    }

    /**
     * Monitor memory usage and log warnings
     * @param {number} threshold - Memory usage threshold in MB
     */
    startMemoryMonitoring (threshold = 100) {
        if (!performance.memory) {
            console.warn('[MemoryManager] Performance.memory not available');
            return;
        }

        const checkMemory = () => {
            const usedMB = performance.memory.usedJSHeapSize / 1024 / 1024;

            if (usedMB > threshold) {
                console.warn(`[MemoryManager] High memory usage: ${usedMB.toFixed(2)} MB`);
                debugLog('[MemoryManager] Memory stats:', this.getMemoryStats());
            }
        };

        // Check memory every 30 seconds
        this.setInterval(checkMemory, 30000);
    }
}

// Create global instance
export const memoryManager = new MemoryManager();
