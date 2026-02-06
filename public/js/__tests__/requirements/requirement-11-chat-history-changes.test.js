/**
 * Tests for Requirement #11: The chat history changes on script change
 */

import { StateManager } from '../../core/StateManager.js';
import { getInstance, resetSingleton } from '../../widgets/chat/core/ChatHistoryManager.js';

const createStateManager = () => ({
    getState: jest.fn((key) => key === StateManager.KEYS.USER ? { id: 1 } : null),
    setState: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
});

describe('Requirement #11: Chat History Changes on Script Change', () => {
    let chatHistoryManager;
    let mockApi;
    let mockStateManager;
    let mockEventManager;

    beforeEach(() => {
        mockApi = {
            getChatMessages: jest.fn().mockResolvedValue([]),
            clearChatMessages: jest.fn().mockResolvedValue(true)
        };

        mockStateManager = createStateManager();
        mockEventManager = { publish: jest.fn(), subscribe: jest.fn() };

        resetSingleton();
        chatHistoryManager = getInstance({
            api: mockApi,
            stateManager: mockStateManager,
            eventManager: mockEventManager
        });
    });

    afterEach(() => {
        resetSingleton();
    });

    describe('Automatic Chat History Switching', () => {
        test('should change chat history when script changes', async () => {
            const script1 = { id: 1, title: 'Script 1' };
            const script2 = { id: 2, title: 'Script 2' };

            mockApi.getChatMessages
                .mockResolvedValueOnce([{ id: 1, content: 'Script 1 chat', type: 'user' }])
                .mockResolvedValueOnce([{ id: 2, content: 'Script 2 chat', type: 'user' }]);

            await chatHistoryManager.handleScriptChange(script1);
            expect(chatHistoryManager.currentScriptId).toBe(1);

            await chatHistoryManager.handleScriptChange(script2);
            expect(chatHistoryManager.currentScriptId).toBe(2);
        });

        test('should load chat history immediately on script change', async () => {
            const script = { id: 2, title: 'Script 2' };
            const scriptHistory = [
                { id: 1, content: 'New script chat', type: 'user', timestamp: '2023-01-01T00:00:00Z' }
            ];

            mockApi.getChatMessages.mockResolvedValue(scriptHistory);

            await chatHistoryManager.handleScriptChange(script);

            expect(mockApi.getChatMessages).toHaveBeenCalledWith(script.id);
            expect(chatHistoryManager.getCurrentScriptHistory()).toEqual(scriptHistory);
        });
    });

    describe('Caching and Performance', () => {
        test('should cache chat history for performance', async () => {
            const script = { id: 1, title: 'Script 1' };
            const history = [{ id: 1, content: 'Cached message', type: 'user' }];

            mockApi.getChatMessages.mockResolvedValue(history);

            await chatHistoryManager.handleScriptChange(script);
            await chatHistoryManager.handleScriptChange(script);

            expect(mockApi.getChatMessages).toHaveBeenCalledTimes(1);
        });

        test('should handle rapid script changes efficiently', async () => {
            const scripts = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, title: `Script ${i + 1}` }));
            mockApi.getChatMessages.mockResolvedValue([]);

            for (const script of scripts) {
                await chatHistoryManager.handleScriptChange(script);
            }

            expect(chatHistoryManager.currentScriptId).toBe(5);
        });
    });

    describe('Error Handling', () => {
        test('should handle API errors during script change', async () => {
            const script = { id: 1, title: 'Script 1' };
            mockApi.getChatMessages.mockRejectedValue(new Error('API Error'));

            await expect(chatHistoryManager.handleScriptChange(script)).resolves.not.toThrow();
        });

        test('should handle malformed script data', async () => {
            const script = { id: 1 }; // Missing title
            const mockHistory = [{ id: 1, content: 'Valid message', type: 'user' }];

            mockApi.getChatMessages.mockResolvedValue(mockHistory);

            await chatHistoryManager.handleScriptChange(script);

            expect(chatHistoryManager.currentScriptId).toBe(script.id);
            expect(chatHistoryManager.getCurrentScriptHistory()).toEqual(mockHistory);
        });
    });
});