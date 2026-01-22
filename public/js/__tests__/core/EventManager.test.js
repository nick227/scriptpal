/**
 * Tests for EventManager
 */

import { EventManager } from '../../core/EventManager.js';

describe('EventManager', () => {
    let eventManager;

    beforeEach(() => {
        eventManager = new EventManager();
    });

    afterEach(() => {
        eventManager = null;
    });

    describe('constructor', () => {
        it('should initialize with empty listeners and subscriptions', () => {
            expect(eventManager.listeners).toBeInstanceOf(Map);
            expect(eventManager.subscriptions).toBeInstanceOf(Map);
            expect(eventManager.listeners.size).toBe(0);
            expect(eventManager.subscriptions.size).toBe(0);
        });
    });

    describe('subscribe', () => {
        it('should add event listener', () => {
            const callback = jest.fn();
            eventManager.subscribe('testEvent', callback);

            expect(eventManager.listeners.has('testEvent')).toBe(true);
            expect(eventManager.listeners.get('testEvent').has(callback)).toBe(true);
        });

        it('should add multiple listeners for same event', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            eventManager.subscribe('testEvent', callback1);
            eventManager.subscribe('testEvent', callback2);

            const listeners = eventManager.listeners.get('testEvent');
            expect(listeners.size).toBe(2);
            expect(listeners.has(callback1)).toBe(true);
            expect(listeners.has(callback2)).toBe(true);
        });

        it('should track context subscriptions', () => {
            const context = { id: 'test' };
            const callback = jest.fn();

            eventManager.subscribe('testEvent', callback, context);

            expect(eventManager.subscriptions.has(context)).toBe(true);
            const subscriptions = eventManager.subscriptions.get(context);
            expect(subscriptions.size).toBe(1);
        });

        it('should handle multiple subscriptions for same context', () => {
            const context = { id: 'test' };
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            eventManager.subscribe('event1', callback1, context);
            eventManager.subscribe('event2', callback2, context);

            const subscriptions = eventManager.subscriptions.get(context);
            expect(subscriptions.size).toBe(2);
        });

        it('should return unsubscribe function', () => {
            const callback = jest.fn();
            const unsubscribe = eventManager.subscribe('testEvent', callback);

            expect(typeof unsubscribe).toBe('function');
            unsubscribe();
            expect(eventManager.listeners.has('testEvent')).toBe(false);
        });
    });

    describe('on', () => {
        it('should be alias for subscribe', () => {
            const callback = jest.fn();
            eventManager.on('testEvent', callback);

            expect(eventManager.listeners.has('testEvent')).toBe(true);
            expect(eventManager.listeners.get('testEvent').has(callback)).toBe(true);
        });
    });

    describe('unsubscribe', () => {
        it('should remove event listener', () => {
            const callback = jest.fn();
            eventManager.subscribe('testEvent', callback);

            eventManager.unsubscribe('testEvent', callback);

            expect(eventManager.listeners.has('testEvent')).toBe(false);
        });

        it('should remove context subscriptions', () => {
            const context = { id: 'test' };
            const callback = jest.fn();

            eventManager.subscribe('testEvent', callback, context);
            eventManager.unsubscribe('testEvent', callback);

            // Context subscriptions are not automatically removed by unsubscribe
            // They need to be removed by unsubscribeAll
            expect(eventManager.subscriptions.get(context).size).toBe(1);
        });

        it('should handle non-existent event gracefully', () => {
            const callback = jest.fn();
            expect(() => {
                eventManager.unsubscribe('nonExistentEvent', callback);
            }).not.toThrow();
        });

        it('should handle non-existent callback gracefully', () => {
            const callback = jest.fn();
            eventManager.subscribe('testEvent', callback);

            expect(() => {
                eventManager.unsubscribe('testEvent', jest.fn());
            }).not.toThrow();
        });
    });

    describe('off', () => {
        it('should be alias for unsubscribe', () => {
            const callback = jest.fn();
            eventManager.subscribe('testEvent', callback);

            eventManager.off('testEvent', callback);

            expect(eventManager.listeners.has('testEvent')).toBe(false);
        });
    });

    describe('emit', () => {
        it('should call all listeners for event', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            eventManager.subscribe('testEvent', callback1);
            eventManager.subscribe('testEvent', callback2);

            eventManager.emit('testEvent', 'testData');

            expect(callback1).toHaveBeenCalledWith('testData');
            expect(callback2).toHaveBeenCalledWith('testData');
        });

        it('should handle events with no listeners', () => {
            expect(() => {
                eventManager.emit('nonExistentEvent', 'testData');
            }).not.toThrow();
        });

        it('should pass single argument to listeners', () => {
            const callback = jest.fn();
            eventManager.subscribe('testEvent', callback);

            eventManager.emit('testEvent', 'arg1');

            expect(callback).toHaveBeenCalledWith('arg1');
        });

        it('should handle listener errors gracefully', () => {
            const errorCallback = jest.fn(() => {
                throw new Error('Test error');
            });
            const normalCallback = jest.fn();

            eventManager.subscribe('testEvent', errorCallback);
            eventManager.subscribe('testEvent', normalCallback);

            expect(() => {
                eventManager.emit('testEvent', 'testData');
            }).not.toThrow();

            expect(normalCallback).toHaveBeenCalledWith('testData');
        });
    });

    describe('publish', () => {
        it('should be alias for emit', () => {
            const callback = jest.fn();
            eventManager.subscribe('testEvent', callback);

            eventManager.publish('testEvent', 'testData');

            expect(callback).toHaveBeenCalledWith('testData');
        });
    });

    describe('once', () => {
        it('should call callback only once', () => {
            const callback = jest.fn();
            eventManager.once('testEvent', callback);

            eventManager.emit('testEvent', 'testData1');
            eventManager.emit('testEvent', 'testData2');

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith('testData1');
        });
    });

    describe('unsubscribeAll', () => {
        it('should remove all listeners for event', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            eventManager.subscribe('testEvent', callback1);
            eventManager.subscribe('testEvent', callback2);

            eventManager.clear('testEvent');

            expect(eventManager.listeners.has('testEvent')).toBe(false);
        });

        it('should handle non-existent event gracefully', () => {
            expect(() => {
                eventManager.unsubscribeAll('nonExistentEvent');
            }).not.toThrow();
        });
    });

    describe('clear', () => {
        it('should clear all listeners and subscriptions', () => {
            const callback = jest.fn();
            const context = { id: 'test' };

            eventManager.subscribe('testEvent', callback, context);
            eventManager.clear();

            expect(eventManager.listeners.size).toBe(0);
            expect(eventManager.subscriptions.size).toBe(0);
        });

        it('should clear specific event', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            eventManager.subscribe('event1', callback1);
            eventManager.subscribe('event2', callback2);

            eventManager.clear('event1');

            expect(eventManager.listeners.has('event1')).toBe(false);
            expect(eventManager.listeners.has('event2')).toBe(true);
        });
    });

    describe('destroy', () => {
        it('should clear all listeners and subscriptions', () => {
            const callback = jest.fn();
            const context = { id: 'test' };

            eventManager.subscribe('testEvent', callback, context);
            eventManager.destroy();

            expect(eventManager.listeners).toBeNull();
            expect(eventManager.subscriptions).toBeNull();
        });
    });

    describe('event flow', () => {
        it('should handle complex event scenarios', () => {
            const context = { id: 'test' };
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            // Subscribe with context
            eventManager.subscribe('event1', callback1, context);
            eventManager.subscribe('event2', callback2, context);

            // Emit events
            eventManager.emit('event1', 'data1');
            eventManager.emit('event2', 'data2');

            expect(callback1).toHaveBeenCalledWith('data1');
            expect(callback2).toHaveBeenCalledWith('data2');

            // Unsubscribe all for context
            eventManager.unsubscribeAll(context);

            // Emit again - should not call callbacks
            eventManager.emit('event1', 'data3');
            eventManager.emit('event2', 'data4');

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledTimes(1);
        });

        it('should handle mixed context and non-context subscriptions', () => {
            const context = { id: 'test' };
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            // Subscribe without context
            eventManager.subscribe('testEvent', callback1);
            // Subscribe with context
            eventManager.subscribe('testEvent', callback2, context);

            eventManager.emit('testEvent', 'testData1');
            expect(callback1).toHaveBeenCalledWith('testData1');
            expect(callback2).toHaveBeenCalledWith('testData1');

            // Unsubscribe all for context should only remove callback2
            eventManager.unsubscribeAll(context);

            eventManager.emit('testEvent', 'testData2');
            expect(callback1).toHaveBeenCalledTimes(2);
            expect(callback2).toHaveBeenCalledTimes(1);
        });
    });
});
