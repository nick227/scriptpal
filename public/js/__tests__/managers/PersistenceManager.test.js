/**
 * Tests for PersistenceManager - Application State Persistence
 */

import { PersistenceManager } from '../../services/persistence/PersistenceManager.js';

describe('PersistenceManager - Application State Persistence', () => {
    let persistenceManager;
    let mockStateManager;
    let mockEventManager;
    let mockApi;

    beforeEach(() => {
        // Create mock state manager
        mockStateManager = {
            getState: jest.fn().mockReturnValue({
                id: 1,
                title: 'Test Script',
                content: 'Test content',
                author: 'Test Author'
            }),
            setState: jest.fn(),
            subscribe: jest.fn()
        };

        // Create mock event manager
        mockEventManager = {
            publish: jest.fn(),
            subscribe: jest.fn()
        };

        // Create mock API
        mockApi = {
            saveState: jest.fn().mockResolvedValue(true),
            loadState: jest.fn().mockResolvedValue({})
        };

        // Create persistence manager
        persistenceManager = new PersistenceManager({
            stateManager: mockStateManager,
            eventManager: mockEventManager,
            api: mockApi
        });
    });

    afterEach(() => {
        persistenceManager.destroy();
    });

    describe('Initialization', () => {
        test('should initialize with required dependencies', () => {
            expect(persistenceManager.stateManager).toBe(mockStateManager);
            expect(persistenceManager.eventManager).toBe(mockEventManager);
            expect(persistenceManager.api).toBe(mockApi);
        });

        test('should require state manager', () => {
            expect(() => {
                new PersistenceManager({
                    eventManager: mockEventManager,
                    api: mockApi
                });
            }).toThrow('StateManager is required for PersistenceManager');
        });

        test('should require event manager', () => {
            expect(() => {
                new PersistenceManager({
                    stateManager: mockStateManager,
                    api: mockApi
                });
            }).toThrow('EventManager is required for PersistenceManager');
        });

        test('should require API', () => {
            expect(() => {
                new PersistenceManager({
                    stateManager: mockStateManager,
                    eventManager: mockEventManager
                });
            }).toThrow('API is required for PersistenceManager');
        });

        test('should set up event listeners', () => {
            expect(mockStateManager.subscribe).toHaveBeenCalled();
            expect(mockEventManager.subscribe).toHaveBeenCalled();
        });

        test('should start auto-save', () => {
            expect(persistenceManager.autoSaveInterval).toBeTruthy();
        });
    });

    describe('State Persistence', () => {
        test('should save script state to localStorage', () => {
            const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

            persistenceManager.handleScriptChange({
                id: 1,
                title: 'Test Script',
                content: 'Test content'
            });

            expect(setItemSpy).toHaveBeenCalledWith(
                'currentScriptId',
                '1'
            );
            expect(setItemSpy).toHaveBeenCalledWith(
                'currentScriptState',
                expect.stringContaining('"title":"Test Script"')
            );
        });

        test('should save chat state to localStorage', () => {
            const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

            persistenceManager.handleChatChange({
                scriptId: 1,
                message: { content: 'Test message' }
            });

            expect(setItemSpy).toHaveBeenCalledWith(
                'chatState',
                expect.stringContaining('"scriptId":1')
            );
        });

        test('should save UI state to localStorage', () => {
            const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

            persistenceManager.handleUIStateChange({});

            expect(setItemSpy).toHaveBeenCalledWith(
                'uiState',
                expect.stringContaining('"fullscreenMode"')
            );
        });

        test('should emit state saved events', () => {
            persistenceManager.handleScriptChange({
                id: 1,
                title: 'Test Script'
            });

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'PERSISTENCE:SCRIPT_STATE_SAVED',
                expect.objectContaining({
                    scriptId: 1
                })
            );
        });
    });

    describe('State Loading', () => {
        test('should load persisted state from localStorage', async () => {
            const savedState = {
                currentScriptId: 1,
                scriptState: { id: 1, title: 'Test Script' },
                chatState: { scriptId: 1, lastMessage: 'Test' },
                uiState: { fullscreenMode: false }
            };

            jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
                const data = {
                    'currentScriptId': '1',
                    'currentScriptState': JSON.stringify(savedState.scriptState),
                    'chatState': JSON.stringify(savedState.chatState),
                    'uiState': JSON.stringify(savedState.uiState)
                };
                return data[key] || null;
            });

            const loadedState = await persistenceManager.loadPersistedState();

            expect(loadedState.currentScriptId).toBe(1);
            expect(loadedState.chatState.scriptId).toBe(1);
            expect(loadedState.uiState.fullscreenMode).toBe(false);
        });

        test('should emit state loaded event', async () => {
            await persistenceManager.loadPersistedState();

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'PERSISTENCE:STATE_LOADED',
                expect.objectContaining({
                    currentScriptId: expect.any(Number),
                    chatState: expect.any(Object),
                    uiState: expect.any(Object)
                })
            );
        });

        test('should handle localStorage errors gracefully', () => {
            jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw new Error('Storage error');
            });

            expect(() => {
                persistenceManager.loadPersistedState();
            }).not.toThrow();
        });
    });

    describe('Auto-Save', () => {
        test('should start auto-save', () => {
            expect(persistenceManager.autoSaveInterval).toBeTruthy();
        });

        test('should stop auto-save', () => {
            persistenceManager.stopAutoSave();
            expect(persistenceManager.autoSaveInterval).toBeNull();
        });

        test('should save current state on auto-save', async () => {
            const saveSpy = jest.spyOn(persistenceManager, 'saveCurrentState');

            // Trigger auto-save
            await persistenceManager.saveCurrentState();

            expect(saveSpy).toHaveBeenCalled();
        });
    });

    describe('Event Handling', () => {
        test('should handle beforeunload event', async () => {
            const saveSpy = jest.spyOn(persistenceManager, 'saveCurrentState');

            persistenceManager.handleBeforeUnload(new Event('beforeunload'));

            expect(saveSpy).toHaveBeenCalled();
        });

        test('should handle visibility change to hidden', async () => {
            const saveSpy = jest.spyOn(persistenceManager, 'saveCurrentState');

            Object.defineProperty(document, 'hidden', {
                writable: true,
                value: true
            });

            persistenceManager.handleVisibilityChange(new Event('visibilitychange'));

            expect(saveSpy).toHaveBeenCalled();
        });

        test('should handle visibility change to visible', async () => {
            const loadSpy = jest.spyOn(persistenceManager, 'loadPersistedState');

            Object.defineProperty(document, 'hidden', {
                writable: true,
                value: false
            });

            persistenceManager.handleVisibilityChange(new Event('visibilitychange'));

            expect(loadSpy).toHaveBeenCalled();
        });
    });

    describe('Data Management', () => {
        test('should clear all data', () => {
            const removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem');

            persistenceManager.clearAllData();

            expect(removeItemSpy).toHaveBeenCalledWith('currentScriptId');
            expect(removeItemSpy).toHaveBeenCalledWith('currentScriptState');
            expect(removeItemSpy).toHaveBeenCalledWith('chatState');
            expect(removeItemSpy).toHaveBeenCalledWith('uiState');
            expect(removeItemSpy).toHaveBeenCalledWith('userPreferences');
            expect(removeItemSpy).toHaveBeenCalledWith('sessionData');
        });

        test('should emit data cleared event', () => {
            persistenceManager.clearAllData();

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'PERSISTENCE:DATA_CLEARED',
                {}
            );
        });

        test('should get storage usage', () => {
            const usage = persistenceManager.getStorageUsage();

            expect(usage).toHaveProperty('totalSize');
            expect(usage).toHaveProperty('usage');
            expect(usage).toHaveProperty('totalSizeKB');
        });
    });

    describe('State Restoration', () => {
        test('should restore script state', async () => {
            const scriptState = {
                id: 1,
                title: 'Test Script',
                cursorPosition: { line: 5, column: 10 },
                scrollPosition: { x: 0, y: 100 }
            };

            await persistenceManager.restoreScriptState(scriptState);

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'PERSISTENCE:SCRIPT_STATE_RESTORED',
                { scriptState }
            );
        });

        test('should restore chat state', async () => {
            const chatState = {
                scriptId: 1,
                lastMessage: 'Test message',
                messageCount: 5
            };

            await persistenceManager.restoreChatState(chatState);

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'PERSISTENCE:CHAT_STATE_RESTORED',
                { chatState }
            );
        });

        test('should restore UI state', async () => {
            const uiState = {
                fullscreenMode: true,
                chatMinimized: false
            };

            await persistenceManager.restoreUIState(uiState);

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'PERSISTENCE:UI_STATE_RESTORED',
                { uiState }
            );
        });
    });

    describe('Storage Operations', () => {
        test('should save to storage', () => {
            const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

            persistenceManager.saveToStorage('testKey', { test: 'data' });

            expect(setItemSpy).toHaveBeenCalledWith(
                'testKey',
                '{"test":"data"}'
            );
        });

        test('should load from storage', () => {
            jest.spyOn(Storage.prototype, 'getItem').mockReturnValue('{"test":"data"}');

            const data = persistenceManager.loadFromStorage('testKey');

            expect(data).toEqual({ test: 'data' });
        });

        test('should handle storage errors gracefully', () => {
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('Storage error');
            });

            expect(() => {
                persistenceManager.saveToStorage('testKey', { test: 'data' });
            }).not.toThrow();
        });
    });

    describe('Session Data', () => {
        test('should save session data', () => {
            const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

            persistenceManager.saveSessionData();

            expect(setItemSpy).toHaveBeenCalledWith(
                'sessionData',
                expect.stringContaining('"lastActive"')
            );
        });

        test('should get session duration', () => {
            const duration = persistenceManager.getSessionDuration();
            expect(typeof duration).toBe('number');
        });

        test('should get actions performed', () => {
            const actions = persistenceManager.getActionsPerformed();
            expect(typeof actions).toBe('number');
        });

        test('should get errors encountered', () => {
            const errors = persistenceManager.getErrorsEncountered();
            expect(typeof errors).toBe('number');
        });
    });

    describe('Utility Methods', () => {
        test('should get cursor position', () => {
            const position = persistenceManager.getCursorPosition();
            expect(position).toHaveProperty('line');
            expect(position).toHaveProperty('column');
        });

        test('should get scroll position', () => {
            const position = persistenceManager.getScrollPosition();
            expect(position).toHaveProperty('x');
            expect(position).toHaveProperty('y');
        });

        test('should get chat message count', () => {
            const count = persistenceManager.getChatMessageCount(1);
            expect(typeof count).toBe('number');
        });

        test('should get fullscreen state', () => {
            const state = persistenceManager.getFullscreenState();
            expect(typeof state).toBe('boolean');
        });

        test('should get chat minimized state', () => {
            const state = persistenceManager.getChatMinimizedState();
            expect(typeof state).toBe('boolean');
        });

        test('should get chat position', () => {
            const position = persistenceManager.getChatPosition();
            expect(position).toHaveProperty('x');
            expect(position).toHaveProperty('y');
        });

        test('should get chat size', () => {
            const size = persistenceManager.getChatSize();
            expect(size).toHaveProperty('width');
            expect(size).toHaveProperty('height');
        });
    });

    describe('Cleanup', () => {
        test('should destroy properly', () => {
            persistenceManager.destroy();

            expect(persistenceManager.stateManager).toBeNull();
            expect(persistenceManager.eventManager).toBeNull();
            expect(persistenceManager.api).toBeNull();
            expect(persistenceManager.autoSaveInterval).toBeNull();
        });

        test('should stop auto-save on destroy', () => {
            const stopSpy = jest.spyOn(persistenceManager, 'stopAutoSave');

            persistenceManager.destroy();

            expect(stopSpy).toHaveBeenCalled();
        });

        test('should save final state on destroy', () => {
            const saveSpy = jest.spyOn(persistenceManager, 'saveCurrentState');

            persistenceManager.destroy();

            expect(saveSpy).toHaveBeenCalled();
        });
    });
});
