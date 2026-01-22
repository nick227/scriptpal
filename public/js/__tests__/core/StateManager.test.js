/**
 * Tests for StateManager
 */

import { StateManager, STATE_KEYS } from '../../core/StateManager.js';

describe('StateManager', () => {
    let stateManager;

    beforeEach(() => {
        stateManager = new StateManager();
    });

    afterEach(() => {
        stateManager = null;
    });

    describe('STATE_KEYS', () => {
        it('should have all required state keys', () => {
            expect(STATE_KEYS.AUTHENTICATED).toBe('authenticated');
            expect(STATE_KEYS.USER).toBe('user');
            expect(STATE_KEYS.LOADING).toBe('loading');
            expect(STATE_KEYS.EDITOR_LOADING).toBe('editorLoading');
            expect(STATE_KEYS.CHAT_LOADING).toBe('chatLoading');
            expect(STATE_KEYS.AUTH_LOADING).toBe('authLoading');
            expect(STATE_KEYS.CURRENT_VIEW).toBe('currentView');
            expect(STATE_KEYS.READY).toBe('ready');
            expect(STATE_KEYS.ERROR).toBe('error');
            expect(STATE_KEYS.CURRENT_SCRIPT).toBe('currentScript');
            expect(STATE_KEYS.CURRENT_SCRIPT_ID).toBe('currentScriptId');
            expect(STATE_KEYS.SCRIPTS).toBe('scripts');
            expect(STATE_KEYS.CONTENT).toBe('content');
            expect(STATE_KEYS.CURRENT_LINE).toBe('currentLine');
            expect(STATE_KEYS.CURRENT_FORMAT).toBe('currentFormat');
            expect(STATE_KEYS.PAGE_COUNT).toBe('pageCount');
        });

        it('should be frozen to prevent modification', () => {
            expect(() => {
                STATE_KEYS.NEW_KEY = 'newKey';
            }).toThrow();
        });
    });

    describe('constructor', () => {
        it('should initialize with default state values', () => {
            expect(stateManager.state).toBeDefined();
            expect(stateManager.state.size).toBeGreaterThan(0);
            expect(stateManager.listeners).toBeDefined();
            expect(stateManager.listeners.size).toBeGreaterThan(0);
        });
    });

    describe('getState', () => {
        it('should return value for valid key', () => {
            stateManager.setState(STATE_KEYS.READY, true);
            const value = stateManager.getState(STATE_KEYS.READY);
            expect(value).toBe(true);
        });

        it('should throw error for invalid key', () => {
            expect(() => {
                stateManager.getState('invalidKey');
            }).toThrow('Invalid state key');
        });
    });

    describe('setState', () => {
        it('should update state with valid key and value', () => {
            stateManager.setState(STATE_KEYS.READY, true);
            const value = stateManager.getState(STATE_KEYS.READY);
            expect(value).toBe(true);
        });

        it('should throw error for invalid key', () => {
            expect(() => {
                stateManager.setState('invalidKey', true);
            }).toThrow('Invalid state key');
        });

        it('should throw error for invalid value type', () => {
            expect(() => {
                stateManager.setState(STATE_KEYS.READY, 'not a boolean');
            }).toThrow('Invalid value type');
        });
    });

    describe('subscribe', () => {
        it('should call callback when state changes', () => {
            const callback = jest.fn();
            stateManager.subscribe(STATE_KEYS.READY, callback);

            stateManager.setState(STATE_KEYS.READY, true);

            expect(callback).toHaveBeenCalledWith(true, false);
        });

        it('should add listener to listeners map', () => {
            const callback = jest.fn();
            stateManager.subscribe(STATE_KEYS.READY, callback);

            expect(stateManager.listeners.get(STATE_KEYS.READY).has(callback)).toBe(true);
        });

        it('should throw error for invalid key', () => {
            expect(() => {
                stateManager.subscribe('invalidKey', jest.fn());
            }).toThrow('Invalid state key');
        });
    });

    describe('unsubscribe', () => {
        it('should remove listener', () => {
            const callback = jest.fn();
            stateManager.subscribe(STATE_KEYS.READY, callback);
            stateManager.unsubscribe(STATE_KEYS.READY, callback);

            stateManager.setState(STATE_KEYS.READY, true);
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('validateValue', () => {
        it('should validate correct value types', () => {
            expect(stateManager.validateValue(STATE_KEYS.READY, true)).toBe(true);
            expect(stateManager.validateValue(STATE_KEYS.READY, false)).toBe(true);
        });

        it('should reject incorrect value types', () => {
            expect(stateManager.validateValue(STATE_KEYS.READY, 'string')).toBe(false);
            expect(stateManager.validateValue(STATE_KEYS.READY, 123)).toBe(false);
        });

        it('should handle nullable values', () => {
            expect(stateManager.validateValue(STATE_KEYS.USER, null)).toBe(true);
            expect(stateManager.validateValue(STATE_KEYS.READY, null)).toBe(false);
        });
    });

    describe('getExpectedType', () => {
        it('should return correct type for key', () => {
            expect(stateManager.getExpectedType(STATE_KEYS.READY)).toBe('boolean');
            expect(stateManager.getExpectedType(STATE_KEYS.USER)).toBe('object');
            expect(stateManager.getExpectedType(STATE_KEYS.SCRIPTS)).toBe('array');
        });

        it('should throw error for invalid key', () => {
            expect(() => {
                stateManager.getExpectedType('invalidKey');
            }).toThrow('Unknown state key');
        });
    });

    describe('integration tests', () => {
        it('should handle complete state workflow', () => {
            // Set initial state
            stateManager.setState(STATE_KEYS.READY, false);
            expect(stateManager.getState(STATE_KEYS.READY)).toBe(false);

            // Subscribe to changes
            const callback = jest.fn();
            stateManager.subscribe(STATE_KEYS.READY, callback);

            // Update state
            stateManager.setState(STATE_KEYS.READY, true);
            expect(stateManager.getState(STATE_KEYS.READY)).toBe(true);
            expect(callback).toHaveBeenCalledWith(true, false);

            // Unsubscribe
            stateManager.unsubscribe(STATE_KEYS.READY, callback);
            stateManager.setState(STATE_KEYS.READY, false);
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });
});
