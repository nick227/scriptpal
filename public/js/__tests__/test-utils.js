/**
 * Test utilities for ScriptPal frontend tests
 */

describe('Test Utilities', () => {
    it('should be available for use in other tests', () => {
        expect(true).toBe(true);
    });
});

/**
 * Create a mock DOM element with attributes
 * @param {string} tag - HTML tag name
 * @param {object} attributes - Element attributes
 * @param {string} content - Element content
 * @returns {HTMLElement} - Mock element
 */
export function createMockElement (tag = 'div', attributes = {}, content = '') {
    const element = document.createElement(tag);

    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });

    if (content) {
        element.textContent = content;
    }

    return element;
}

/**
 * Create a mock event
 * @param {string} type - Event type
 * @param {object} options - Event options
 * @returns {Event} - Mock event
 */
export function createMockEvent (type, options = {}) {
    return new Event(type, {
        bubbles: true,
        cancelable: true,
        ...options
    });
}

/**
 * Create a mock custom event
 * @param {string} type - Event type
 * @param {*} detail - Event detail
 * @param {object} options - Event options
 * @returns {CustomEvent} - Mock custom event
 */
export function createMockCustomEvent (type, detail = null, options = {}) {
    return new CustomEvent(type, {
        detail,
        bubbles: true,
        cancelable: true,
        ...options
    });
}

/**
 * Wait for specified milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} - Promise that resolves after delay
 */
export function waitFor (ms = 0) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for next tick
 * @returns {Promise} - Promise that resolves on next tick
 */
export function waitForNextTick () {
    return new Promise(resolve => setImmediate(resolve));
}

/**
 * Mock API response
 * @param {*} data - Response data
 * @param {number} status - HTTP status code
 * @param {object} headers - Response headers
 * @returns {object} - Mock response object
 */
export function mockApiResponse (data, status = 200, headers = {}) {
    const mockResponse = {
        ok: status >= 200 && status < 300,
        status,
        headers: new Headers(headers),
        json: async () => data,
        text: async () => JSON.stringify(data),
        blob: async () => new Blob([JSON.stringify(data)]),
        arrayBuffer: async () => new ArrayBuffer(0)
    };

    fetch.mockResolvedValueOnce(mockResponse);
    return mockResponse;
}

/**
 * Mock API error
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @returns {Error} - Mock error object
 */
export function mockApiError (message = 'API Error', status = 500) {
    const error = new Error(message);
    error.status = status;
    fetch.mockRejectedValueOnce(error);
    return error;
}

/**
 * Create mock user data
 * @param {object} overrides - User data overrides
 * @returns {object} - Mock user object
 */
export function createMockUser (overrides = {}) {
    return {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        ...overrides
    };
}

/**
 * Create mock script data
 * @param {object} overrides - Script data overrides
 * @returns {object} - Mock script object
 */
export function createMockScript (overrides = {}) {
    return {
        id: 1,
        title: 'Test Script',
        content: 'Test script content',
        user_id: 1,
        version_number: 1,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        ...overrides
    };
}

/**
 * Create mock chat message
 * @param {object} overrides - Message data overrides
 * @returns {object} - Mock message object
 */
export function createMockMessage (overrides = {}) {
    return {
        id: 1,
        content: 'Test message',
        type: 'user',
        timestamp: '2023-01-01T00:00:00Z',
        script_id: 1,
        user_id: 1,
        ...overrides
    };
}

/**
 * Setup DOM for testing
 * @param {string} html - HTML content to set
 */
export function setupDOM (html = '') {
    document.body.innerHTML = html;
}

/**
 * Clean up DOM after testing
 */
export function cleanupDOM () {
    document.body.innerHTML = '';
}

/**
 * Mock localStorage
 * @param {object} data - Data to store
 */
export function mockLocalStorage (data = {}) {
    const storage = localStorage;
    Object.entries(data).forEach(([key, value]) => {
        storage.setItem(key, JSON.stringify(value));
    });
}

/**
 * Clear all localStorage
 */
export function clearLocalStorage () {
    localStorage.clear();
}

/**
 * Mock sessionStorage
 * @param {object} data - Data to store
 */
export function mockSessionStorage (data = {}) {
    Object.entries(data).forEach(([key, value]) => {
        sessionStorage.setItem(key, JSON.stringify(value));
    });
}

/**
 * Clear all sessionStorage
 */
export function clearSessionStorage () {
    sessionStorage.clear();
}

/**
 * Create mock AbortController
 * @returns {object} - Mock AbortController
 */
export function createMockAbortController () {
    return {
        signal: {
            aborted: false,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
        },
        abort: jest.fn()
    };
}

/**
 * Create mock ResizeObserver
 * @returns {object} - Mock ResizeObserver
 */
export function createMockResizeObserver () {
    return {
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn()
    };
}

/**
 * Create mock IntersectionObserver
 * @returns {object} - Mock IntersectionObserver
 */
export function createMockIntersectionObserver () {
    return {
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn()
    };
}

/**
 * Create mock MutationObserver
 * @returns {object} - Mock MutationObserver
 */
export function createMockMutationObserver () {
    return {
        observe: jest.fn(),
        disconnect: jest.fn(),
        takeRecords: jest.fn()
    };
}

/**
 * Assert that element has specific attributes
 * @param {HTMLElement} element - Element to check
 * @param {object} attributes - Expected attributes
 */
export function expectElementAttributes (element, attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
        expect(element.getAttribute(key)).toBe(value);
    });
}

/**
 * Assert that element has specific classes
 * @param {HTMLElement} element - Element to check
 * @param {string[]} classes - Expected classes
 */
export function expectElementClasses (element, classes) {
    classes.forEach(className => {
        expect(element.classList.contains(className)).toBe(true);
    });
}

/**
 * Assert that element has specific content
 * @param {HTMLElement} element - Element to check
 * @param {string} content - Expected content
 */
export function expectElementContent (element, content) {
    expect(element.textContent.trim()).toBe(content);
}

/**
 * Assert that function was called with specific arguments
 * @param {Function} mockFn - Mock function
 * @param {number} callIndex - Call index (0-based)
 * @param {...any} expectedArgs - Expected arguments
 */
export function expectFunctionCall (mockFn, callIndex = 0, ...expectedArgs) {
    expect(mockFn).toHaveBeenNthCalledWith(callIndex + 1, ...expectedArgs);
}

/**
 * Assert that async function resolves with specific value
 * @param {Function} asyncFn - Async function
 * @param {*} expectedValue - Expected resolved value
 */
export async function expectAsyncResolve (asyncFn, expectedValue) {
    const result = await asyncFn();
    expect(result).toEqual(expectedValue);
}

/**
 * Assert that async function rejects with specific error
 * @param {Function} asyncFn - Async function
 * @param {string|Error} expectedError - Expected error message or Error instance
 */
export async function expectAsyncReject (asyncFn, expectedError) {
    await expect(asyncFn()).rejects.toThrow(expectedError);
}

/**
 * Create a spy that tracks calls
 * @param {Function} fn - Function to spy on
 * @returns {Function} - Spy function
 */
export function createSpy (fn = jest.fn()) {
    return fn;
}

/**
 * Create a mock that returns specific values
 * @param {...any} returnValues - Values to return in sequence
 * @returns {Function} - Mock function
 */
export function createMock (...returnValues) {
    return jest.fn().mockImplementation((...args) => {
        const value = returnValues.shift();
        return typeof value === 'function' ? value(...args) : value;
    });
}

/**
 * Create a mock that throws specific errors
 * @param {...Error|string} errors - Errors to throw in sequence
 * @returns {Function} - Mock function
 */
export function createMockThatThrows (...errors) {
    return jest.fn().mockImplementation(() => {
        const error = errors.shift();
        throw typeof error === 'string' ? new Error(error) : error;
    });
}

/**
 * Wait for condition to be true
 * @param {Function} condition - Condition function
 * @param {number} timeout - Timeout in milliseconds
 * @param {number} interval - Check interval in milliseconds
 * @returns {Promise} - Promise that resolves when condition is true
 */
export function waitForCondition (condition, timeout = 5000, interval = 100) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const check = () => {
            if (condition()) {
                resolve();
            } else if (Date.now() - startTime > timeout) {
                reject(new Error('Condition timeout'));
            } else {
                setTimeout(check, interval);
            }
        };

        check();
    });
}

/**
 * Create a mock that resolves after delay
 * @param {*} value - Value to resolve with
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Mock function
 */
export function createDelayedMock (value, delay = 100) {
    return jest.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(value), delay))
    );
}

/**
 * Create a mock that rejects after delay
 * @param {Error|string} error - Error to reject with
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Mock function
 */
export function createDelayedRejectMock (error, delay = 100) {
    return jest.fn().mockImplementation(() =>
        new Promise((resolve, reject) =>
            setTimeout(() => reject(typeof error === 'string' ? new Error(error) : error), delay)
        )
    );
}
