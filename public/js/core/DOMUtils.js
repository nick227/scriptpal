/**
 * DOM utility functions for safe element queries and manipulation
 * Centralizes DOM operations to prevent NPEs and improve error handling
 */

/**
 * Safely query for a single element
 * @param {string} selector - CSS selector
 * @param {Element|Document} context - Context element (defaults to document)
 * @param {boolean} required - Whether element is required (throws if not found)
 * @returns {Element|null} - Found element or null
 */
export function safeQuery (selector, context = document, required = false) {
    if (!selector) {
        throw new Error('Selector is required');
    }

    if (!context) {
        throw new Error('Context is required');
    }

    const element = context.querySelector(selector);

    if (required && !element) {
        throw new Error(`Required element not found: ${selector}`);
    }

    return element;
}

/**
 * Safely query for multiple elements
 * @param {string} selector - CSS selector
 * @param {Element|Document} context - Context element (defaults to document)
 * @param {boolean} required - Whether at least one element is required
 * @returns {NodeList} - Found elements
 */
export function safeQueryAll (selector, context = document, required = false) {
    if (!selector) {
        throw new Error('Selector is required');
    }

    if (!context) {
        throw new Error('Context is required');
    }

    const elements = context.querySelectorAll(selector);

    if (required && elements.length === 0) {
        throw new Error(`Required elements not found: ${selector}`);
    }

    return elements;
}

/**
 * Create an element with attributes and content
 * @param {string} tagName - HTML tag name
 * @param {object} attributes - Element attributes
 * @param {string|Element} content - Element content
 * @returns {Element} - Created element
 */
export function createElement (tagName, attributes = {}, content = null) {
    const element = document.createElement(tagName);

    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'textContent') {
            element.textContent = value;
        } else if (key === 'innerHTML') {
            element.innerHTML = value;
        } else {
            element.setAttribute(key, value);
        }
    });

    // Set content
    if (content !== null) {
        if (typeof content === 'string') {
            element.textContent = content;
        } else if (content instanceof Element) {
            element.appendChild(content);
        }
    }

    return element;
}

/**
 * Safely add event listener with cleanup tracking
 * @param {Element} element - Target element
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @param {object} options - Event options
 * @returns {Function} - Cleanup function
 */
export function safeAddEventListener (element, event, handler, options = {}) {
    if (!element) {
        throw new Error('Element is required');
    }

    if (!event) {
        throw new Error('Event name is required');
    }

    if (typeof handler !== 'function') {
        throw new Error('Handler must be a function');
    }

    element.addEventListener(event, handler, options);

    // Return cleanup function
    return () => {
        element.removeEventListener(event, handler, options);
    };
}

/**
 * Safely remove event listener
 * @param {Element} element - Target element
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @param {object} options - Event options
 */
export function safeRemoveEventListener (element, event, handler, options = {}) {
    if (!element || !event || typeof handler !== 'function') {
        return;
    }

    element.removeEventListener(event, handler, options);
}

/**
 * Check if element exists and is visible
 * @param {Element} element - Element to check
 * @returns {boolean} - True if element exists and is visible
 */
export function isElementVisible (element) {
    if (!element) {
        return false;
    }

    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0';
}

/**
 * Get element's position relative to viewport
 * @param {Element} element - Element to measure
 * @returns {object} - Position object with top, left, width, height
 */
export function getElementPosition (element) {
    if (!element) {
        throw new Error('Element is required');
    }

    const rect = element.getBoundingClientRect();
    return {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right
    };
}

/**
 * Scroll element into view with options
 * @param {Element} element - Element to scroll to
 * @param {object} options - Scroll options
 */
export function scrollIntoView (element, options = {}) {
    if (!element) {
        throw new Error('Element is required');
    }

    const defaultOptions = {
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
    };

    element.scrollIntoView({ ...defaultOptions, ...options });
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
export function debounce (func, delay) {
    let timeoutId;

    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Throttle function execution
 * @param {Function} func - Function to throttle
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Throttled function
 */
export function throttle (func, delay) {
    let lastCall = 0;

    return function (...args) {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            return func.apply(this, args);
        }
    };
}

/**
 * Wait for element to appear in DOM
 * @param {string} selector - CSS selector
 * @param {Element|Document} context - Context element
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Element>} - Promise that resolves with element
 */
export function waitForElement (selector, context = document, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const element = safeQuery(selector, context);
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const element = safeQuery(selector, context);
            if (element) {
                obs.disconnect();
                resolve(element);
            }
        });

        observer.observe(context, {
            childList: true,
            subtree: true
        });

        // Timeout
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Element not found within ${timeout}ms: ${selector}`));
        }, timeout);
    });
}

/**
 * DOM utility class for managing element collections
 */
export class DOMCollection {
    /**
     *
     * @param selector
     * @param context
     */
    constructor (selector, context = document) {
        this.selector = selector;
        this.context = context;
        this.elements = new Map();
        this.refresh();
    }

    /**
     *
     */
    refresh () {
        const elements = safeQueryAll(this.selector, this.context);
        this.elements.clear();

        elements.forEach((element, index) => {
            this.elements.set(index, element);
        });
    }

    /**
     *
     * @param index
     */
    get (index) {
        return this.elements.get(index);
    }

    /**
     *
     */
    get length () {
        return this.elements.size;
    }

    /**
     *
     * @param callback
     */
    forEach (callback) {
        this.elements.forEach(callback);
    }

    /**
     *
     * @param callback
     */
    find (callback) {
        for (const element of this.elements.values()) {
            if (callback(element)) {
                return element;
            }
        }
        return null;
    }

    /**
     *
     * @param callback
     */
    filter (callback) {
        const results = [];
        for (const element of this.elements.values()) {
            if (callback(element)) {
                results.push(element);
            }
        }
        return results;
    }
}
