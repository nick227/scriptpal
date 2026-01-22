/**
 * Tests for ChatHistoryManager
 */

import { MESSAGE_TYPES } from '../../../constants.js';
import { ChatHistoryManager } from '../../../widgets/chat/ChatHistoryManager.js';

const createStateManager = () => ({
    subscribe: jest.fn(),
    getState: jest.fn().mockReturnValue(null)
});

describe('ChatHistoryManager - Script-Specific Chat History', () => {
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
        mockEventManager = {
            publish: jest.fn()
        };

        chatHistoryManager = new ChatHistoryManager({
            api: mockApi,
            stateManager: mockStateManager,
            eventManager: mockEventManager
        });
    });

    afterEach(() => {
        chatHistoryManager.destroy();
    });

    describe('Initialization', () => {
        test('should initialize with required dependencies', () => {
            expect(chatHistoryManager.api).toBe(mockApi);
            expect(chatHistoryManager.stateManager).toBe(mockStateManager);
            expect(chatHistoryManager.eventManager).toBe(mockEventManager);
            expect(chatHistoryManager.currentScriptId).toBeNull();
        });

        test('should require all dependencies', () => {
            expect(() => {
                new ChatHistoryManager({
                    api: null,
                    stateManager: mockStateManager,
                    eventManager: mockEventManager
                });
            }).toThrow('API service is required');

            expect(() => {
                new ChatHistoryManager({
                    api: mockApi,
                    stateManager: null,
                    eventManager: mockEventManager
                });
            }).toThrow('State manager is required');

            expect(() => {
                new ChatHistoryManager({
                    api: mockApi,
                    stateManager: mockStateManager,
                    eventManager: null
                });
            }).toThrow('Event manager is required');
        });
    });

    describe('Script Change Handling', () => {
        test('should handle script changes', async () => {
            const script = { id: 'script-1', title: 'My Script' };

            await chatHistoryManager.handleScriptChange(script);

            expect(chatHistoryManager.currentScriptId).toBe('script-1');
            expect(mockApi.getChatMessages).toHaveBeenCalledWith('script-1');
        });

        test('should handle invalid script changes', async () => {
            const originalScriptId = chatHistoryManager.currentScriptId;

            await chatHistoryManager.handleScriptChange(null);
            await chatHistoryManager.handleScriptChange({});

            expect(chatHistoryManager.currentScriptId).toBe(originalScriptId);
        });
    });

    describe('Chat History Loading', () => {
        test('should load chat history for script', async () => {
            const scriptId = 'script-1';
            const mockHistory = [
                { id: 'msg-1', content: 'Hello', type: 'user', timestamp: Date.now() },
                { id: 'msg-2', content: 'Hi there!', type: 'assistant', timestamp: Date.now() }
            ];

            mockApi.getChatMessages.mockResolvedValue(mockHistory);

            const history = await chatHistoryManager.loadScriptHistory(scriptId);

            expect(mockApi.getChatMessages).toHaveBeenCalledWith(scriptId);
            expect(history).toHaveLength(2);
            expect(chatHistoryManager.chatHistories.has(scriptId)).toBe(true);
        });

        test('should return cached history if already loaded', async () => {
            const scriptId = 'script-1';
            const mockHistory = [{ id: 'msg-1', content: 'Hello', type: 'user' }];

            mockApi.getChatMessages.mockResolvedValue(mockHistory);
            await chatHistoryManager.loadScriptHistory(scriptId);

            const history = await chatHistoryManager.loadScriptHistory(scriptId);

            expect(mockApi.getChatMessages).toHaveBeenCalledTimes(1);
            expect(history).toEqual(mockHistory);
        });
    });

    describe('Message Management', () => {
        beforeEach(() => {
            chatHistoryManager.currentScriptId = 'script-1';
        });

        test('should add message to current script history', async () => {
            const message = {
                content: 'Hello, AI!',
                type: MESSAGE_TYPES.USER
            };

            const result = await chatHistoryManager.addMessage(message);

            expect(result).toBe(true);
            expect(chatHistoryManager.chatHistories.get('script-1')).toHaveLength(1);
            expect(mockEventManager.publish).toHaveBeenCalledWith('CHAT:MESSAGE_ADDED', expect.any(Object));
        });

        test('should handle invalid messages', async () => {
            const result1 = await chatHistoryManager.addMessage(null);
            const result2 = await chatHistoryManager.addMessage({});
            const result3 = await chatHistoryManager.addMessage({ content: '' });

            expect(result1).toBe(false);
            expect(result2).toBe(false);
            expect(result3).toBe(false);
        });
    });

    describe('History Retrieval', () => {
        test('should get current script history', async () => {
            chatHistoryManager.currentScriptId = 'script-1';
            const mockHistory = [{ id: 'msg-1', content: 'Hello', type: 'user' }];

            mockApi.getChatMessages.mockResolvedValue(mockHistory);
            await chatHistoryManager.loadScriptHistory('script-1');

            const history = chatHistoryManager.getCurrentScriptHistory();
            expect(history.messages).toEqual(mockHistory);
        });
    });

    describe('History Clearing', () => {
        test('should clear script history', async () => {
            const scriptId = 'script-1';
            const result = await chatHistoryManager.clearScriptHistory(scriptId);

            expect(result).toBe(true);
            expect(mockApi.clearChatMessages).toHaveBeenCalledWith(scriptId);
        });
    });

    describe('Cleanup', () => {
        test('should destroy properly', () => {
            chatHistoryManager.currentScriptId = 'script-1';
            chatHistoryManager.chatHistories.set('script-1', []);

            chatHistoryManager.destroy();

            expect(chatHistoryManager.currentScriptId).toBeNull();
            expect(chatHistoryManager.chatHistories.size).toBe(0);
        });
    });
});