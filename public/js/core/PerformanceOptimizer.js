import { debugLog } from './logger.js';

/**
 * Performance Optimization Utilities
 *
 * This module provides utilities for optimizing performance across the application
 * including debouncing, throttling, caching, and memory management.
 */

/**
 *
 */
export class PerformanceOptimizer {
    /**
     *
     */
    constructor () {
        this.debounceTimers = new Map();
        this.throttleTimers = new Map();
        this.caches = new Map();
        this.performanceMetrics = {
            debounceCalls: 0,
            throttleCalls: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
    }

    /**
     * Debounce function calls to prevent excessive execution
     * @param {string} key - Unique key for the debounced function
     * @param {Function} func - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @param {*} context - Context to bind the function to
     * @returns {Function} - Debounced function
     */
    debounce (key, func, delay = 300, context = null) {
        this.performanceMetrics.debounceCalls++;

        return (...args) => {
            if (this.debounceTimers.has(key)) {
                clearTimeout(this.debounceTimers.get(key));
            }

            const timer = setTimeout(() => {
                this.debounceTimers.delete(key);
                if (context) {
                    func.apply(context, args);
                } else {
                    func(...args);
                }
            }, delay);

            this.debounceTimers.set(key, timer);
        };
    }

    /**
     * Throttle function calls to limit execution frequency
     * @param {string} key - Unique key for the throttled function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Minimum time between calls in milliseconds
     * @param {*} context - Context to bind the function to
     * @returns {Function} - Throttled function
     */
    throttle (key, func, limit = 100, context = null) {
        this.performanceMetrics.throttleCalls++;

        return (...args) => {
            const now = Date.now();
            const lastCall = this.throttleTimers.get(key) || 0;

            if (now - lastCall >= limit) {
                this.throttleTimers.set(key, now);
                if (context) {
                    func.apply(context, args);
                } else {
                    func(...args);
                }
            }
        };
    }

    /**
     * Create a memoized cache for expensive operations
     * @param {string} cacheName - Name of the cache
     * @param {Function} computeFn - Function to compute cache values
     * @param {number} ttl - Time to live in milliseconds
     * @returns {Function} - Cached function
     */
    memoize (cacheName, computeFn, ttl = 300000) { // 5 minutes default
        if (!this.caches.has(cacheName)) {
            this.caches.set(cacheName, new Map());
        }

        const cache = this.caches.get(cacheName);

        return (...args) => {
            const key = JSON.stringify(args);
            const cached = cache.get(key);

            if (cached && Date.now() - cached.timestamp < ttl) {
                this.performanceMetrics.cacheHits++;
                return cached.value;
            }

            this.performanceMetrics.cacheMisses++;
            const value = computeFn(...args);
            cache.set(key, {
                value,
                timestamp: Date.now()
            });

            return value;
        };
    }

    /**
     * Batch DOM operations for better performance
     * @param {Function} operation - DOM operation to batch
     * @param {number} delay - Delay before executing batch
     * @returns {Function} - Batched operation function
     */
    batchDOMOperations (operation, delay = 16) { // ~60fps
        let pendingOperations = [];
        let scheduled = false;

        return (...args) => {
            pendingOperations.push(args);

            if (!scheduled) {
                scheduled = true;
                requestAnimationFrame(() => {
                    const operations = pendingOperations.slice();
                    pendingOperations = [];
                    scheduled = false;

                    // Execute all operations in a single frame
                    operations.forEach(opArgs => operation(...opArgs));
                });
            }
        };
    }

    /**
     * Optimize event listener management
     * @param {HTMLElement} element - Element to add listeners to
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     * @param {object} options - Event options
     * @returns {Function} - Cleanup function
     */
    addOptimizedEventListener (element, event, handler, options = {}) {
        // Use passive listeners for better performance when possible
        const optimizedOptions = {
            passive: true,
            ...options
        };

        element.addEventListener(event, handler, optimizedOptions);

        // Return cleanup function
        return () => {
            element.removeEventListener(event, handler, optimizedOptions);
        };
    }

    /**
     * Create a virtual scrolling manager for large lists
     * @param {HTMLElement} container - Container element
     * @param {Array} items - Array of items to render
     * @param {Function} renderItem - Function to render individual items
     * @param {number} itemHeight - Height of each item
     * @returns {object} - Virtual scrolling manager
     */
    createVirtualScroller (container, items, renderItem, itemHeight = 50) {
        const visibleCount = Math.ceil(container.clientHeight / itemHeight) + 2;
        let startIndex = 0;
        let endIndex = Math.min(visibleCount, items.length);

        const updateVisibleItems = () => {
            const scrollTop = container.scrollTop;
            startIndex = Math.floor(scrollTop / itemHeight);
            endIndex = Math.min(startIndex + visibleCount, items.length);

            // Clear container
            container.innerHTML = '';

            // Add spacer for items before visible range
            if (startIndex > 0) {
                const spacer = document.createElement('div');
                spacer.style.height = `${startIndex * itemHeight}px`;
                container.appendChild(spacer);
            }

            // Render visible items
            for (let i = startIndex; i < endIndex; i++) {
                const itemElement = renderItem(items[i], i);
                container.appendChild(itemElement);
            }

            // Add spacer for items after visible range
            const remainingItems = items.length - endIndex;
            if (remainingItems > 0) {
                const spacer = document.createElement('div');
                spacer.style.height = `${remainingItems * itemHeight}px`;
                container.appendChild(spacer);
            }
        };

        // Throttle scroll events
        const throttledUpdate = this.throttle('virtual-scroll', updateVisibleItems, 16);
        container.addEventListener('scroll', throttledUpdate);

        // Initial render
        updateVisibleItems();

        return {
            update: updateVisibleItems,
            destroy: () => {
                container.removeEventListener('scroll', throttledUpdate);
            }
        };
    }

    /**
     * Clean up all timers and caches
     */
    cleanup () {
        // Clear all debounce timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();

        // Clear all throttle timers
        this.throttleTimers.clear();

        // Clear all caches
        this.caches.clear();

        // Reset metrics
        this.performanceMetrics = {
            debounceCalls: 0,
            throttleCalls: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
    }

    /**
     * Get performance metrics
     * @returns {object} - Performance metrics
     */
    getMetrics () {
        return {
            ...this.performanceMetrics,
            cacheHitRate: this.performanceMetrics.cacheHits /
                (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) || 0,
            activeDebounceTimers: this.debounceTimers.size,
            activeCaches: this.caches.size
        };
    }

    /**
     * Create a performance monitor for tracking function execution times
     * @param {string} name - Name of the function being monitored
     * @param {Function} func - Function to monitor
     * @returns {Function} - Monitored function
     */
    monitor (name, func) {
        return (...args) => {
            const start = performance.now();
            const result = func(...args);
            const end = performance.now();

            debugLog(`[Performance] ${name} executed in ${(end - start).toFixed(2)}ms`);

            return result;
        };
    }
}

// Create global instance
export const performanceOptimizer = new PerformanceOptimizer();
