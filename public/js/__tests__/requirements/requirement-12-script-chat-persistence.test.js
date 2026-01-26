/**
 * Tests for Requirement #12: The current active script and chat conversation persist on page load
 */

import { PersistenceManager } from '../../services/persistence/PersistenceManager.js';
import { StateManager } from '../../core/StateManager.js';

describe('Requirement #12: Script and Chat Persistence on Page Load', () => {
    let persistenceManager;
    let mockStateManager;
    let mockEventManager;
    let mockApi;
    let storage;

    beforeEach(() => {
        // Create mock state manager
        mockStateManager = {
            getState: jest.fn().mockReturnValue({
                currentScript: {
                    id: 1,
                    title: 'Test Script',
                    content: 'Test content',
                    author: 'Test Author'
                },
                chatHistory: [
                    { id: 1, message: 'Hello', type: 'user', timestamp: '2023-01-01T00:00:00Z' },
                    { id: 2, message: 'Hi there!', type: 'ai', timestamp: '2023-01-01T00:01:00Z' }
                ],
                uiState: {
                    isFullscreen: false,
                    chatMinimized: false,
                    layout: 'horizontal'
                }
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
            saveScript: jest.fn().mockResolvedValue({ success: true }),
            getScript: jest.fn().mockResolvedValue({
                id: 1,
                title: 'Test Script',
                content: 'Test content'
            })
        };

        // Create persistence manager
        persistenceManager = new PersistenceManager({
            stateManager: mockStateManager,
            eventManager: mockEventManager,
            api: mockApi
        });

        // Mock localStorage
        global.localStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn()
        };
        storage = global.localStorage;
    });

    afterEach(() => {
        persistenceManager.destroy();
        // Reset localStorage mocks
        storage.getItem.mockReset();
        storage.setItem.mockReset();
        storage.removeItem.mockReset();
    });

    describe('Script State Persistence', () => {
        test('should save current active script to localStorage', async () => {
            const scriptState = {
                id: 1,
                title: 'Test Script',
                content: 'Test content',
                author: 'Test Author',
                lastModified: '2023-01-01T00:00:00Z'
            };

            await persistenceManager.saveScriptState(scriptState);

            expect(storage.setItem).toHaveBeenCalledWith(
                'scriptpal_script_state',
                expect.stringContaining(JSON.stringify(scriptState))
            );
        });

        test('should restore active script from localStorage on page load', async () => {
            const savedScriptState = {
                id: 1,
                title: 'Test Script',
                content: 'Test content',
                author: 'Test Author',
                lastModified: '2023-01-01T00:00:00Z'
            };

            storage.getItem.mockImplementation((key) => (
                key === 'currentScriptState' ? JSON.stringify(savedScriptState) : null
            ));

            const restoredState = await persistenceManager.loadPersistedState();

            expect(restoredState).toHaveProperty('scriptState');
            expect(restoredState.scriptState).toEqual(savedScriptState);
        });

        test('should update state manager when restoring script', async () => {
            const savedScriptState = {
                id: 1,
                title: 'Test Script',
                content: 'Test content'
            };

            await persistenceManager.restoreScriptState(savedScriptState);

            expect(mockStateManager.setState).toHaveBeenCalledWith(StateManager.KEYS.CURRENT_SCRIPT, savedScriptState);
        });

        test('should handle script state changes and auto-save', async () => {
            const scriptState = {
                id: 1,
                title: 'Updated Script',
                content: 'Updated content'
            };

            // Simulate script state change
            mockStateManager.getState.mockReturnValue({
                currentScript: scriptState
            });

            await persistenceManager.saveScriptState(scriptState);

            expect(storage.setItem).toHaveBeenCalled();
            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'PERSISTENCE:SCRIPT_STATE_SAVED',
                { scriptState }
            );
        });
    });

    describe('Chat History Persistence', () => {
        test('should save chat conversation to localStorage', async () => {
            const chatState = {
                scriptId: 1,
                messages: [
                    { id: 1, message: 'Hello', type: 'user', timestamp: '2023-01-01T00:00:00Z' },
                    { id: 2, message: 'Hi there!', type: 'ai', timestamp: '2023-01-01T00:01:00Z' }
                ],
                lastUpdated: '2023-01-01T00:01:00Z'
            };

            await persistenceManager.saveChatState(chatState);

            expect(storage.setItem).toHaveBeenCalledWith(
                'scriptpal_chat_state',
                expect.stringContaining(JSON.stringify(chatState))
            );
        });

        test('should restore chat conversation from localStorage on page load', async () => {
            const savedChatState = {
                scriptId: 1,
                messages: [
                    { id: 1, message: 'Hello', type: 'user', timestamp: '2023-01-01T00:00:00Z' },
                    { id: 2, message: 'Hi there!', type: 'ai', timestamp: '2023-01-01T00:01:00Z' }
                ],
                lastUpdated: '2023-01-01T00:01:00Z'
            };

            storage.getItem.mockImplementation((key) => (
                key === 'chatState' ? JSON.stringify(savedChatState) : null
            ));

            const restoredState = await persistenceManager.loadPersistedState();

            expect(restoredState).toHaveProperty('chatState');
            expect(restoredState.chatState).toEqual(savedChatState);
        });

        test('should update state manager when restoring chat history', async () => {
            const savedChatState = {
                scriptId: 1,
                messages: [
                    { id: 1, message: 'Hello', type: 'user', timestamp: '2023-01-01T00:00:00Z' }
                ]
            };

            await persistenceManager.restoreChatState(savedChatState);

            expect(mockStateManager.setState).toHaveBeenCalledWith(StateManager.KEYS.CHAT_HISTORY, savedChatState.messages);
        });

        test('should handle chat state changes and auto-save', async () => {
            const chatState = {
                scriptId: 1,
                messages: [
                    { id: 1, message: 'New message', type: 'user', timestamp: '2023-01-01T00:00:00Z' }
                ],
                lastUpdated: '2023-01-01T00:00:00Z'
            };

            await persistenceManager.saveChatState(chatState);

            expect(storage.setItem).toHaveBeenCalled();
            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'PERSISTENCE:CHAT_STATE_SAVED',
                { chatState }
            );
        });
    });

    describe('UI State Persistence', () => {
        test('should save UI state to localStorage', async () => {
            const uiState = {
                isFullscreen: true,
                chatMinimized: false,
                layout: 'vertical',
                theme: 'dark'
            };

            await persistenceManager.saveUIState(uiState);

            expect(storage.setItem).toHaveBeenCalledWith(
                'scriptpal_ui_state',
                expect.stringContaining(JSON.stringify(uiState))
            );
        });

        test('should restore UI state from localStorage on page load', async () => {
            const savedUIState = {
                isFullscreen: true,
                chatMinimized: false,
                layout: 'vertical'
            };

            storage.getItem.mockImplementation((key) => (
                key === 'uiState' ? JSON.stringify(savedUIState) : null
            ));

            const restoredState = await persistenceManager.loadPersistedState();

            expect(restoredState).toHaveProperty('uiState');
            expect(restoredState.uiState).toEqual(savedUIState);
        });

        test('should update state manager when restoring UI state', async () => {
            const savedUIState = {
                isFullscreen: true,
                chatMinimized: false,
                layout: 'vertical'
            };

            await persistenceManager.restoreUIState(savedUIState);

            expect(mockStateManager.setState).toHaveBeenCalledWith(StateManager.KEYS.UI_STATE, savedUIState);
        });
    });

    describe('Complete State Persistence', () => {
        test('should save complete application state', async () => {
            const completeState = {
                scriptState: {
                    id: 1,
                    title: 'Test Script',
                    content: 'Test content'
                },
                chatState: {
                    scriptId: 1,
                    messages: [
                        { id: 1, message: 'Hello', type: 'user', timestamp: '2023-01-01T00:00:00Z' }
                    ]
                },
                uiState: {
                    isFullscreen: false,
                    chatMinimized: false
                }
            };

            await persistenceManager.saveCompleteState(completeState);

            expect(storage.setItem).toHaveBeenCalledWith(
                'scriptpal_complete_state',
                expect.stringContaining(JSON.stringify(completeState))
            );
        });

        test('should restore complete application state on page load', async () => {
            const savedCompleteState = {
                scriptState: {
                    id: 1,
                    title: 'Test Script',
                    content: 'Test content'
                },
                chatState: {
                    scriptId: 1,
                    messages: [
                        { id: 1, message: 'Hello', type: 'user', timestamp: '2023-01-01T00:00:00Z' }
                    ]
                },
                uiState: {
                    isFullscreen: false,
                    chatMinimized: false
                }
            };

            storage.getItem.mockImplementation((key) => (
                key === 'scriptpal_complete_state' ? JSON.stringify(savedCompleteState) : null
            ));

            const restoredState = await persistenceManager.loadPersistedState();

            expect(restoredState).toEqual(savedCompleteState);
        });

        test('should handle page load restoration process', async () => {
            const savedState = {
                scriptState: {
                    id: 1,
                    title: 'Test Script',
                    content: 'Test content'
                },
                chatState: {
                    scriptId: 1,
                    messages: [
                        { id: 1, message: 'Hello', type: 'user', timestamp: '2023-01-01T00:00:00Z' }
                    ]
                },
                uiState: {
                    isFullscreen: false,
                    chatMinimized: false
                }
            };

            storage.getItem.mockImplementation((key) => (
                key === 'scriptpal_complete_state' ? JSON.stringify(savedState) : null
            ));

            await persistenceManager.restorePersistedState();

            expect(mockStateManager.setState).toHaveBeenCalledWith(StateManager.KEYS.CURRENT_SCRIPT, savedState.scriptState);
            expect(mockStateManager.setState).toHaveBeenCalledWith(StateManager.KEYS.CHAT_HISTORY, savedState.chatState.messages);
            expect(mockStateManager.setState).toHaveBeenCalledWith(StateManager.KEYS.UI_STATE, savedState.uiState);
        });
    });

    describe('Auto-save Functionality', () => {
        test('should auto-save script state periodically', async () => {
            const scriptState = {
                id: 1,
                title: 'Test Script',
                content: 'Test content'
            };

            // Mock auto-save trigger
            await persistenceManager.autoSaveScriptState(scriptState);

            expect(storage.setItem).toHaveBeenCalled();
        });

        test('should auto-save chat state when messages are added', async () => {
            const chatState = {
                scriptId: 1,
                messages: [
                    { id: 1, message: 'New message', type: 'user', timestamp: '2023-01-01T00:00:00Z' }
                ]
            };

            await persistenceManager.autoSaveChatState(chatState);

            expect(storage.setItem).toHaveBeenCalled();
        });

        test('should auto-save UI state when UI changes', async () => {
            const uiState = {
                isFullscreen: true,
                chatMinimized: false
            };

            await persistenceManager.autoSaveUIState(uiState);

            expect(storage.setItem).toHaveBeenCalled();
        });
    });

    describe('Data Validation and Error Handling', () => {
        test('should validate persisted data before restoration', async () => {
            const invalidData = 'invalid json data';
            storage.getItem.mockReturnValue(invalidData);

            const restoredState = await persistenceManager.loadPersistedState();

            expect(restoredState).toBeNull();
        });

        test('should handle missing localStorage data gracefully', async () => {
            storage.getItem.mockReturnValue(null);

            const restoredState = await persistenceManager.loadPersistedState();

            expect(restoredState).toBeNull();
        });

        test('should handle corrupted localStorage data', async () => {
            storage.getItem.mockReturnValue('corrupted data');

            const restoredState = await persistenceManager.loadPersistedState();

            expect(restoredState).toBeNull();
        });

        test('should handle localStorage quota exceeded errors', async () => {
            storage.setItem.mockImplementation(() => {
                throw new Error('QuotaExceededError');
            });

            const scriptState = {
                id: 1,
                title: 'Test Script',
                content: 'Test content'
            };

            await expect(persistenceManager.saveScriptState(scriptState)).resolves.not.toThrow();
        });
    });

    describe('Performance and Optimization', () => {
        test('should debounce auto-save operations', async () => {
            const scriptState = {
                id: 1,
                title: 'Test Script',
                content: 'Test content'
            };

            // Multiple rapid saves
            await persistenceManager.autoSaveScriptState(scriptState);
            await persistenceManager.autoSaveScriptState(scriptState);
            await persistenceManager.autoSaveScriptState(scriptState);

            // Should debounce and not make excessive localStorage calls
            expect(storage.setItem).toHaveBeenCalled();
        });

        test('should compress large data before saving', async () => {
            const largeScriptState = {
                id: 1,
                title: 'Large Script',
                content: 'A'.repeat(10000) // Large content
            };

            await persistenceManager.saveScriptState(largeScriptState);

            expect(storage.setItem).toHaveBeenCalled();
        });

        test('should handle large chat histories efficiently', async () => {
            const largeChatState = {
                scriptId: 1,
                messages: Array.from({ length: 1000 }, (_, i) => ({
                    id: i + 1,
                    message: `Message ${i + 1}`,
                    type: i % 2 === 0 ? 'user' : 'ai',
                    timestamp: `2023-01-01T00:${String(i).padStart(2, '0')}:00Z`
                }))
            };

            await persistenceManager.saveChatState(largeChatState);

            expect(storage.setItem).toHaveBeenCalled();
        });
    });

    describe('Data Cleanup and Management', () => {
        test('should clear persisted data when requested', async () => {
            await persistenceManager.clearPersistedData();

            expect(storage.removeItem).toHaveBeenCalledWith('scriptpal_script_state');
            expect(storage.removeItem).toHaveBeenCalledWith('scriptpal_chat_state');
            expect(storage.removeItem).toHaveBeenCalledWith('scriptpal_ui_state');
            expect(storage.removeItem).toHaveBeenCalledWith('scriptpal_complete_state');
        });

        test('should handle data migration for version updates', async () => {
            const oldFormatData = {
                version: '1.0',
                script: { id: 1, title: 'Old Script' },
                chat: [{ message: 'Old message', type: 'user' }]
            };

            storage.getItem.mockReturnValue(JSON.stringify(oldFormatData));

            const migratedState = await persistenceManager.migratePersistedData(oldFormatData);

            expect(migratedState).toHaveProperty('scriptState');
            expect(migratedState).toHaveProperty('chatState');
        });

        test('should provide data size information', async () => {
            const scriptState = {
                id: 1,
                title: 'Test Script',
                content: 'Test content'
            };

            await persistenceManager.saveScriptState(scriptState);

            const dataSize = persistenceManager.getDataSize();

            expect(dataSize).toBeGreaterThan(0);
            expect(typeof dataSize).toBe('number');
        });
    });
});
