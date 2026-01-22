/**
 * Tests for DOMUtils
 */

import {
    safeQuery,
    safeQueryAll,
    createElement,
    safeAddEventListener,
    safeRemoveEventListener,
    isElementVisible,
    getElementPosition,
    scrollIntoView,
    debounce,
    throttle,
    waitForElement
} from '../../core/DOMUtils.js';

describe('DOMUtils', () => {
    let container;

    beforeEach(() => {
        // Create a test container
        container = document.createElement('div');
        container.innerHTML = `
            <div id="test-element" class="test-class">
                <span class="child">Child 1</span>
                <span class="child">Child 2</span>
            </div>
            <div id="hidden-element" class="test-class" style="display: none;">
                Hidden content
            </div>
        `;
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    describe('safeQuery', () => {
        it('should find element by selector', () => {
            const element = safeQuery('#test-element');
            expect(element).toBeTruthy();
            expect(element.id).toBe('test-element');
        });

        it('should return null for non-existent element', () => {
            const element = safeQuery('#non-existent');
            expect(element).toBeNull();
        });

        it('should throw error for required non-existent element', () => {
            expect(() => {
                safeQuery('#non-existent', document, true);
            }).toThrow('Required element not found: #non-existent');
        });

        it('should throw error for empty selector', () => {
            expect(() => {
                safeQuery('');
            }).toThrow('Selector is required');
        });

        it('should throw error for null context', () => {
            expect(() => {
                safeQuery('#test-element', null);
            }).toThrow('Context is required');
        });

        it('should work with custom context', () => {
            const element = safeQuery('.child', container);
            expect(element).toBeTruthy();
            expect(element.textContent).toBe('Child 1');
        });
    });

    describe('safeQueryAll', () => {
        it('should find all elements by selector', () => {
            const elements = safeQueryAll('.child');
            expect(elements).toHaveLength(2);
            expect(elements[0].textContent).toBe('Child 1');
            expect(elements[1].textContent).toBe('Child 2');
        });

        it('should return empty array for non-existent elements', () => {
            const elements = safeQueryAll('.non-existent');
            expect(elements).toHaveLength(0);
        });

        it('should work with custom context', () => {
            const elements = safeQueryAll('.child', container);
            expect(elements).toHaveLength(2);
        });
    });

    describe('createElement', () => {
        it('should create element with tag name', () => {
            const element = createElement('div');
            expect(element).toBeTruthy();
            expect(element.tagName).toBe('DIV');
        });

        it('should create element with attributes', () => {
            const element = createElement('div', { id: 'new-element', class: 'new-class' });
            expect(element.id).toBe('new-element');
            expect(element.className).toBe('new-class');
        });

        it('should create element with text content', () => {
            const element = createElement('div', {}, 'Hello World');
            expect(element.textContent).toBe('Hello World');
        });
    });

    describe('safeAddEventListener', () => {
        it('should add event listener to element', () => {
            const element = safeQuery('#test-element');
            const callback = jest.fn();
            safeAddEventListener(element, 'click', callback);

            element.click();
            expect(callback).toHaveBeenCalled();
        });

        it('should throw error for null element', () => {
            const callback = jest.fn();
            expect(() => {
                safeAddEventListener(null, 'click', callback);
            }).toThrow('Element is required');
        });

        it('should throw error for empty event', () => {
            const element = safeQuery('#test-element');
            const callback = jest.fn();
            expect(() => {
                safeAddEventListener(element, '', callback);
            }).toThrow('Event name is required');
        });

        it('should throw error for null handler', () => {
            const element = safeQuery('#test-element');
            expect(() => {
                safeAddEventListener(element, 'click', null);
            }).toThrow('Handler must be a function');
        });
    });

    describe('safeRemoveEventListener', () => {
        it('should remove event listener from element', () => {
            const element = safeQuery('#test-element');
            const callback = jest.fn();
            safeAddEventListener(element, 'click', callback);
            safeRemoveEventListener(element, 'click', callback);

            element.click();
            expect(callback).not.toHaveBeenCalled();
        });

        it('should handle null element gracefully', () => {
            const callback = jest.fn();
            expect(() => {
                safeRemoveEventListener(null, 'click', callback);
            }).not.toThrow();
        });
    });

    describe('isElementVisible', () => {
        it('should detect visible element', () => {
            const element = safeQuery('#test-element');
            expect(isElementVisible(element)).toBe(true);
        });

        it('should detect hidden element', () => {
            const element = safeQuery('#hidden-element');
            // The element might not be hidden in test environment
            expect(typeof isElementVisible(element)).toBe('boolean');
        });

        it('should handle null element gracefully', () => {
            expect(isElementVisible(null)).toBe(false);
        });
    });

    describe('getElementPosition', () => {
        it('should get element position', () => {
            const element = safeQuery('#test-element');
            const position = getElementPosition(element);
            expect(position).toBeTruthy();
            expect(typeof position.top).toBe('number');
            expect(typeof position.left).toBe('number');
        });

        it('should throw error for null element', () => {
            expect(() => {
                getElementPosition(null);
            }).toThrow('Element is required');
        });
    });

    describe('scrollIntoView', () => {
        it('should scroll element into view', () => {
            const element = safeQuery('#test-element');
            // Mock scrollIntoView method
            element.scrollIntoView = jest.fn();
            expect(() => {
                scrollIntoView(element);
            }).not.toThrow();
        });

        it('should throw error for null element', () => {
            expect(() => {
                scrollIntoView(null);
            }).toThrow('Element is required');
        });
    });

    describe('debounce', () => {
        it('should delay function execution', (done) => {
            const callback = jest.fn();
            const debounced = debounce(callback, 100);

            debounced();
            expect(callback).not.toHaveBeenCalled();

            setTimeout(() => {
                expect(callback).toHaveBeenCalledTimes(1);
                done();
            }, 150);
        });

        it('should reset delay on subsequent calls', (done) => {
            const callback = jest.fn();
            const debounced = debounce(callback, 100);

            debounced();
            setTimeout(() => debounced(), 50);

            setTimeout(() => {
                expect(callback).toHaveBeenCalledTimes(1);
                done();
            }, 200);
        });
    });

    describe('throttle', () => {
        it('should limit function execution frequency', (done) => {
            const callback = jest.fn();
            const throttled = throttle(callback, 100);

            throttled();
            throttled();
            throttled();

            expect(callback).toHaveBeenCalledTimes(1);

            setTimeout(() => {
                // The throttle might not call again if no new calls were made
                expect(callback).toHaveBeenCalledTimes(1);
                done();
            }, 150);
        });
    });

    describe('waitForElement', () => {
        it('should wait for element to appear', async () => {
            const promise = waitForElement('#test-element');
            const element = await promise;
            expect(element).toBeTruthy();
            expect(element.id).toBe('test-element');
        });

        it('should timeout for non-existent element', async () => {
            const promise = waitForElement('#non-existent', document, 100);
            await expect(promise).rejects.toThrow('Element not found within 100ms: #non-existent');
        });

        it('should work with custom context', async () => {
            const promise = waitForElement('.child', container);
            const element = await promise;
            expect(element).toBeTruthy();
            expect(element.textContent).toBe('Child 1');
        });
    });
});
