/**
 * Tests for BaseWidget
 */

import { BaseRenderer } from '../../core/BaseRenderer.js';
import { EventManager } from '../../core/EventManager.js';
import { StateManager } from '../../core/StateManager.js';
import { BaseWidget } from '../../widgets/BaseWidget.js';

describe('BaseWidget', () => {
    let widget;
    let stateManager;
    let eventManager;

    beforeEach(() => {
        stateManager = new StateManager();
        eventManager = new EventManager();
        widget = new BaseWidget();
    });

    afterEach(() => {
        widget = null;
        stateManager = null;
        eventManager = null;
    });

    describe('constructor', () => {
        it('should initialize with default values', () => {
            expect(widget.elements).toEqual({});
            expect(widget.stateManager).toBeNull();
            expect(widget.eventManager).toBeNull();
            expect(widget.renderer).toBeNull();
            expect(widget.requiredElements).toEqual([]);
        });

        it('should initialize with provided elements', () => {
            const elements = { container: document.createElement('div') };
            const widgetWithElements = new BaseWidget(elements);
            expect(widgetWithElements.elements).toEqual(elements);
        });
    });

    describe('initialize', () => {
        it('should initialize without required elements', async () => {
            await expect(widget.initialize()).resolves.not.toThrow();
        });

        it('should validate required elements when present', async () => {
            widget.requiredElements = ['container'];
            widget.elements = { container: document.createElement('div') };

            await expect(widget.initialize()).resolves.not.toThrow();
        });

        it('should throw error for missing required elements', async () => {
            widget.requiredElements = ['container'];
            widget.elements = {};

            await expect(widget.initialize()).rejects.toThrow();
        });

        it('should set up renderer when messages container exists', async () => {
            const messagesContainer = document.createElement('div');
            widget.elements = { messagesContainer };

            await widget.initialize();

            expect(widget.renderer).toBeInstanceOf(BaseRenderer);
        });
    });

    describe('validateElements', () => {
        it('should pass validation when all required elements exist', () => {
            widget.requiredElements = ['container', 'button'];
            widget.elements = {
                container: document.createElement('div'),
                button: document.createElement('button')
            };

            expect(() => widget.validateElements()).not.toThrow();
        });

        it('should throw error when required elements are missing', () => {
            widget.requiredElements = ['container', 'button'];
            widget.elements = {
                container: document.createElement('div')
                // button is missing
            };

            expect(() => widget.validateElements()).toThrow();
        });

        it('should throw error when element is null', () => {
            widget.requiredElements = ['container'];
            widget.elements = {
                container: null
            };

            expect(() => widget.validateElements()).toThrow();
        });

        it('should throw error when element is undefined', () => {
            widget.requiredElements = ['container'];
            widget.elements = {
                container: undefined
            };

            expect(() => widget.validateElements()).toThrow();
        });
    });

    describe('setManagers', () => {
        it('should set both managers', () => {
            widget.setManagers(stateManager, eventManager);
            expect(widget.stateManager).toBe(stateManager);
            expect(widget.eventManager).toBe(eventManager);
        });
    });

    describe('subscribe', () => {
        it('should subscribe to events', () => {
            widget.setManagers(stateManager, eventManager);
            const callback = jest.fn();

            const subscription = widget.subscribe('testEvent', callback);
            expect(subscription).toBeDefined();
        });
    });

    describe('publish', () => {
        it('should publish events', () => {
            widget.setManagers(stateManager, eventManager);

            expect(() => {
                widget.publish('testEvent', { data: 'test' });
            }).not.toThrow();
        });
    });

    describe('setState', () => {
        it('should set state', () => {
            widget.setManagers(stateManager, eventManager);

            expect(() => {
                widget.setState('ready', true);
            }).not.toThrow();
        });
    });

    describe('getState', () => {
        it('should get state', () => {
            widget.setManagers(stateManager, eventManager);

            const value = widget.getState('ready');
            expect(value).toBeDefined();
        });
    });

    describe('subscribeToState', () => {
        it('should subscribe to state changes', () => {
            widget.setManagers(stateManager, eventManager);
            const callback = jest.fn();

            const subscription = widget.subscribeToState('ready', callback);
            expect(subscription).toBeUndefined(); // StateManager.subscribe doesn't return unsubscribe function
        });
    });

    describe('handleError', () => {
        it('should handle errors', () => {
            widget.setManagers(stateManager, eventManager);

            expect(() => {
                widget.handleError(new Error('Test error'));
            }).not.toThrow();
        });
    });

    describe('destroy', () => {
        it('should clean up widget resources', () => {
            widget.setManagers(stateManager, eventManager);
            widget.elements = { container: document.createElement('div') };

            widget.destroy();

            expect(widget.elements).toEqual({});
            expect(widget.renderer).toBeNull();
        });

        it('should not throw error when managers are not set', () => {
            expect(() => {
                widget.destroy();
            }).not.toThrow();
        });
    });

    describe('scrollToBottom', () => {
        it('should scroll messages container to bottom', () => {
            const messagesContainer = document.createElement('div');
            // Mock scrollHeight and scrollTop
            Object.defineProperty(messagesContainer, 'scrollHeight', {
                value: 1000,
                writable: false
            });
            Object.defineProperty(messagesContainer, 'scrollTop', {
                value: 0,
                writable: true
            });

            widget.elements = { messagesContainer };

            widget.scrollToBottom();
            expect(messagesContainer.scrollTop).toBe(1000);
        });

        it('should not throw error when messages container is not available', () => {
            expect(() => {
                widget.scrollToBottom();
            }).not.toThrow();
        });
    });

    describe('scrollToTop', () => {
        it('should scroll messages container to top', () => {
            const messagesContainer = document.createElement('div');
            messagesContainer.scrollTop = 100;
            widget.elements = { messagesContainer };

            widget.scrollToTop();
            expect(messagesContainer.scrollTop).toBe(0);
        });

        it('should not throw error when messages container is not available', () => {
            expect(() => {
                widget.scrollToTop();
            }).not.toThrow();
        });
    });

    describe('clearContainer', () => {
        it('should clear container content', () => {
            const container = document.createElement('div');
            container.innerHTML = '<p>Test content</p>';

            widget.clearContainer(container);
            expect(container.innerHTML).toBe('');
        });

        it('should not throw error when container is null', () => {
            expect(() => {
                widget.clearContainer(null);
            }).not.toThrow();
        });
    });

    describe('createElement', () => {
        it('should create element with tag name', () => {
            const element = widget.createElement('div');
            expect(element.tagName).toBe('DIV');
        });

        it('should create element with class name', () => {
            const element = widget.createElement('div', 'test-class');
            expect(element.className).toBe('test-class');
        });

        it('should create element with text content', () => {
            const element = widget.createElement('div', '', 'Hello World');
            expect(element.textContent).toBe('Hello World');
        });

        it('should create element with all parameters', () => {
            const element = widget.createElement('p', 'test-class', 'Hello World');
            expect(element.tagName).toBe('P');
            expect(element.className).toBe('test-class');
            expect(element.textContent).toBe('Hello World');
        });
    });

    describe('appendToContainer', () => {
        it('should append element to container', () => {
            const container = document.createElement('div');
            const element = document.createElement('p');

            widget.appendToContainer(container, element);
            expect(container.contains(element)).toBe(true);
        });

        it('should not throw error when container is null', () => {
            const element = document.createElement('p');
            expect(() => {
                widget.appendToContainer(null, element);
            }).not.toThrow();
        });

        it('should not throw error when element is null', () => {
            const container = document.createElement('div');
            expect(() => {
                widget.appendToContainer(container, null);
            }).not.toThrow();
        });
    });

    describe('integration tests', () => {
        it('should handle complete widget lifecycle', async () => {
            // Initialize
            const container = document.createElement('div');
            widget.elements = { container };
            widget.requiredElements = ['container'];

            await widget.initialize();

            // Set managers
            widget.setManagers(stateManager, eventManager);

            expect(widget.stateManager).toBe(stateManager);
            expect(widget.eventManager).toBe(eventManager);

            // Test state management
            widget.setState('ready', true);
            const value = widget.getState('ready');
            expect(value).toBe(true);

            // Test event management
            const callback = jest.fn();
            widget.subscribe('testEvent', callback);
            widget.publish('testEvent', { data: 'test' });

            // Test utility methods
            const element = widget.createElement('p', 'test-class', 'Hello World');
            expect(element.tagName).toBe('P');
            expect(element.className).toBe('test-class');
            expect(element.textContent).toBe('Hello World');

            // Destroy
            widget.destroy();
            expect(widget.elements).toEqual({});
        });
    });
});
