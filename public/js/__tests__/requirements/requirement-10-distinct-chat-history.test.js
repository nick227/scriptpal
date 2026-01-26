/**
 * Tests for Requirement #10: Each script has its own distinct chat history
 */

import { ChatHistoryManager } from '../../widgets/chat/core/ChatHistoryManager.js';

describe('Requirement #10: Distinct Chat History Per Script', () => {
    let chatHistoryManager;
    let mockApi;
    let mockStateManager;
    let mockEventManager;

    beforeEach(() => {
        // Create mock API
        mockApi = {
            getScriptChatHistory: jest.fn().mockResolvedValue([]),
            addChatMessage: jest.fn().mockResolvedValue({ success: true }),
            clearScriptChatHistory: jest.fn().mockResolvedValue({ success: true })
        };

        // Create mock state manager
        mockStateManager = {
            getState: jest.fn().mockReturnValue({ id: 1, email: 'test@example.com' }),
            setState: jest.fn(),
            subscribe: jest.fn()
        };

        // Create mock event manager
        mockEventManager = {
            publish: jest.fn(),
            subscribe: jest.fn()
        };

        // Create chat history manager
        chatHistoryManager = new ChatHistoryManager({
            api: mockApi,
            stateManager: mockStateManager,
            eventManager: mockEventManager
        });
    });

    afterEach(() => {
        chatHistoryManager.destroy();
    });

    describe('Script-Specific Chat History', () => {
        test('should maintain separate chat history for each script', async () => {
            const script1 = { id: 1, title: 'Script 1' };
            const script2 = { id: 2, title: 'Script 2' };

            // Mock different chat histories for each script
            mockApi.getScriptChatHistory
                .mockResolvedValueOnce([
                    { id: 1, message: 'Script 1 message 1', type: 'user', timestamp: '2023-01-01T00:00:00Z' },
                    { id: 2, message: 'Script 1 message 2', type: 'ai', timestamp: '2023-01-01T00:01:00Z' }
                ])
                .mockResolvedValueOnce([
                    { id: 3, message: 'Script 2 message 1', type: 'user', timestamp: '2023-01-02T00:00:00Z' },
                    { id: 4, message: 'Script 2 message 2', type: 'ai', timestamp: '2023-01-02T00:01:00Z' }
                ]);

            // Load chat history for script 1
            await chatHistoryManager.loadScriptHistory(script1.id);
            const history1 = chatHistoryManager.getCurrentScriptHistory();
            expect(history1.scriptId).toBe(1);
            expect(history1.messages).toHaveLength(2);
            expect(history1.messages[0].message).toBe('Script 1 message 1');

            // Load chat history for script 2
            await chatHistoryManager.loadScriptHistory(script2.id);
            const history2 = chatHistoryManager.getCurrentScriptHistory();
            expect(history2.scriptId).toBe(2);
            expect(history2.messages).toHaveLength(2);
            expect(history2.messages[0].message).toBe('Script 2 message 1');
        });

        test('should isolate chat messages between scripts', async () => {
            const script1 = { id: 1, title: 'Script 1' };
            const script2 = { id: 2, title: 'Script 2' };

            // Add message to script 1
            await chatHistoryManager.loadScriptHistory(script1.id);
            await chatHistoryManager.addMessage({
                message: 'Hello from script 1',
                type: 'user',
                timestamp: '2023-01-01T00:00:00Z'
            });

            // Add message to script 2
            await chatHistoryManager.loadScriptHistory(script2.id);
            await chatHistoryManager.addMessage({
                message: 'Hello from script 2',
                type: 'user',
                timestamp: '2023-01-02T00:00:00Z'
            });

            // Verify isolation
            const history1 = chatHistoryManager.getCurrentScriptHistory();
            expect(history1.scriptId).toBe(2); // Current script
            expect(history1.messages).toHaveLength(1);
            expect(history1.messages[0].message).toBe('Hello from script 2');
        });

        test('should maintain chat history persistence per script', async () => {
            const script1 = { id: 1, title: 'Script 1' };
            const script2 = { id: 2, title: 'Script 2' };

            // Mock persistent chat histories
            const script1History = [
                { id: 1, message: 'Persistent message 1', type: 'user', timestamp: '2023-01-01T00:00:00Z' },
                { id: 2, message: 'Persistent message 2', type: 'ai', timestamp: '2023-01-01T00:01:00Z' }
            ];

            const script2History = [
                { id: 3, message: 'Different persistent message', type: 'user', timestamp: '2023-01-02T00:00:00Z' }
            ];

            mockApi.getScriptChatHistory
                .mockResolvedValueOnce(script1History)
                .mockResolvedValueOnce(script2History);

            // Load and verify script 1 history
            await chatHistoryManager.loadScriptHistory(script1.id);
            let currentHistory = chatHistoryManager.getCurrentScriptHistory();
            expect(currentHistory.messages).toEqual(script1History);

            // Load and verify script 2 history
            await chatHistoryManager.loadScriptHistory(script2.id);
            currentHistory = chatHistoryManager.getCurrentScriptHistory();
            expect(currentHistory.messages).toEqual(script2History);
        });
    });

    describe('Chat History Management', () => {
        test('should add messages to correct script history', async () => {
            const script = { id: 1, title: 'Script 1' };
            const message = {
                message: 'Test message',
                type: 'user',
                timestamp: '2023-01-01T00:00:00Z'
            };

            await chatHistoryManager.loadScriptHistory(script.id);
            await chatHistoryManager.addMessage(message);

            expect(mockApi.addChatMessage).toHaveBeenCalledWith(script.id, message);
        });

        test('should clear chat history for specific script', async () => {
            const script = { id: 1, title: 'Script 1' };

            await chatHistoryManager.clearScriptHistory(script.id);

            expect(mockApi.clearScriptChatHistory).toHaveBeenCalledWith(script.id);
        });

        test('should load chat history for specific script', async () => {
            const script = { id: 1, title: 'Script 1' };
            const mockHistory = [
                { id: 1, message: 'Loaded message', type: 'user', timestamp: '2023-01-01T00:00:00Z' }
            ];

            mockApi.getScriptChatHistory.mockResolvedValue(mockHistory);

            await chatHistoryManager.loadScriptHistory(script.id);

            expect(mockApi.getScriptChatHistory).toHaveBeenCalledWith(script.id);
            expect(chatHistoryManager.getCurrentScriptHistory().messages).toEqual(mockHistory);
        });
    });

    describe('Script Context Switching', () => {
        test('should switch chat history when script changes', async () => {
            const script1 = { id: 1, title: 'Script 1' };
            const script2 = { id: 2, title: 'Script 2' };

            // Mock different histories
            mockApi.getScriptChatHistory
                .mockResolvedValueOnce([{ id: 1, message: 'Script 1 chat', type: 'user' }])
                .mockResolvedValueOnce([{ id: 2, message: 'Script 2 chat', type: 'user' }]);

            // Switch to script 1
            await chatHistoryManager.handleScriptChange(script1);
            expect(chatHistoryManager.getCurrentScriptHistory().scriptId).toBe(1);

            // Switch to script 2
            await chatHistoryManager.handleScriptChange(script2);
            expect(chatHistoryManager.getCurrentScriptHistory().scriptId).toBe(2);
        });

        test('should preserve chat history when switching back to script', async () => {
            const script1 = { id: 1, title: 'Script 1' };
            const script2 = { id: 2, title: 'Script 2' };

            // Mock histories
            const script1History = [{ id: 1, message: 'Script 1 original', type: 'user' }];
            const script2History = [{ id: 2, message: 'Script 2 original', type: 'user' }];

            mockApi.getScriptChatHistory
                .mockResolvedValueOnce(script1History)
                .mockResolvedValueOnce(script2History)
                .mockResolvedValueOnce(script1History); // Return to script 1

            // Switch to script 1
            await chatHistoryManager.handleScriptChange(script1);
            expect(chatHistoryManager.getCurrentScriptHistory().messages).toEqual(script1History);

            // Switch to script 2
            await chatHistoryManager.handleScriptChange(script2);
            expect(chatHistoryManager.getCurrentScriptHistory().messages).toEqual(script2History);

            // Switch back to script 1
            await chatHistoryManager.handleScriptChange(script1);
            expect(chatHistoryManager.getCurrentScriptHistory().messages).toEqual(script1History);
        });

        test('should handle script change events', async () => {
            const script = { id: 1, title: 'Script 1' };
            const mockHistory = [{ id: 1, message: 'Event triggered message', type: 'user' }];

            mockApi.getScriptChatHistory.mockResolvedValue(mockHistory);

            // Simulate script change event
            await chatHistoryManager.handleScriptChange(script);

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'CHAT:HISTORY_CHANGED',
                { scriptId: script.id, history: mockHistory }
            );
        });
    });

    describe('Chat History Data Structure', () => {
        test('should maintain proper chat history structure', async () => {
            const script = { id: 1, title: 'Script 1' };
            const mockHistory = [
                {
                    id: 1,
                    message: 'User message',
                    type: 'user',
                    timestamp: '2023-01-01T00:00:00Z',
                    scriptId: 1
                },
                {
                    id: 2,
                    message: 'AI response',
                    type: 'ai',
                    timestamp: '2023-01-01T00:01:00Z',
                    scriptId: 1
                }
            ];

            mockApi.getScriptChatHistory.mockResolvedValue(mockHistory);

            await chatHistoryManager.loadScriptHistory(script.id);
            const history = chatHistoryManager.getCurrentScriptHistory();

            expect(history).toHaveProperty('scriptId');
            expect(history).toHaveProperty('messages');
            expect(history).toHaveProperty('lastUpdated');
            expect(history.scriptId).toBe(1);
            expect(history.messages).toEqual(mockHistory);
        });

        test('should validate message structure when adding', async () => {
            const script = { id: 1, title: 'Script 1' };
            const validMessage = {
                message: 'Valid message',
                type: 'user',
                timestamp: '2023-01-01T00:00:00Z'
            };

            await chatHistoryManager.loadScriptHistory(script.id);
            await chatHistoryManager.addMessage(validMessage);

            expect(mockApi.addChatMessage).toHaveBeenCalledWith(script.id, validMessage);
        });

        test('should handle message timestamps correctly', async () => {
            const script = { id: 1, title: 'Script 1' };
            const message1 = {
                message: 'First message',
                type: 'user',
                timestamp: '2023-01-01T00:00:00Z'
            };
            const message2 = {
                message: 'Second message',
                type: 'ai',
                timestamp: '2023-01-01T00:01:00Z'
            };

            await chatHistoryManager.loadScriptHistory(script.id);
            await chatHistoryManager.addMessage(message1);
            await chatHistoryManager.addMessage(message2);

            const history = chatHistoryManager.getCurrentScriptHistory();
            expect(history.messages).toHaveLength(2);
            expect(history.messages[0].timestamp).toBe('2023-01-01T00:00:00Z');
            expect(history.messages[1].timestamp).toBe('2023-01-01T00:01:00Z');
        });
    });

    describe('Error Handling', () => {
        test('should handle API errors gracefully', async () => {
            const script = { id: 1, title: 'Script 1' };
            mockApi.getScriptChatHistory.mockRejectedValue(new Error('API Error'));

            await expect(chatHistoryManager.loadScriptHistory(script.id)).resolves.not.toThrow();
        });

        test('should handle missing script gracefully', async () => {
            const script = { id: 999, title: 'Non-existent Script' };
            mockApi.getScriptChatHistory.mockResolvedValue([]);

            await chatHistoryManager.loadScriptHistory(script.id);
            const history = chatHistoryManager.getCurrentScriptHistory();

            expect(history.scriptId).toBe(999);
            expect(history.messages).toEqual([]);
        });

        test('should handle malformed chat history data', async () => {
            const script = { id: 1, title: 'Script 1' };
            const malformedHistory = [
                { id: 1, message: 'Valid message', type: 'user' },
                { id: 2, message: 'Invalid message' }, // Missing type and timestamp
                { id: 3, message: 'Another valid message', type: 'ai', timestamp: '2023-01-01T00:00:00Z' }
            ];

            mockApi.getScriptChatHistory.mockResolvedValue(malformedHistory);

            await chatHistoryManager.loadScriptHistory(script.id);
            const history = chatHistoryManager.getCurrentScriptHistory();

            expect(history.messages).toEqual(malformedHistory);
        });
    });

    describe('Performance and Caching', () => {
        test('should cache chat history for performance', async () => {
            const script = { id: 1, title: 'Script 1' };
            const mockHistory = [{ id: 1, message: 'Cached message', type: 'user' }];

            mockApi.getScriptChatHistory.mockResolvedValue(mockHistory);

            // First load
            await chatHistoryManager.loadScriptHistory(script.id);
            expect(mockApi.getScriptChatHistory).toHaveBeenCalledTimes(1);

            // Second load (should use cache)
            await chatHistoryManager.loadScriptHistory(script.id);
            expect(mockApi.getScriptChatHistory).toHaveBeenCalledTimes(1);
        });

        test('should invalidate cache when script changes', async () => {
            const script1 = { id: 1, title: 'Script 1' };
            const script2 = { id: 2, title: 'Script 2' };

            mockApi.getScriptChatHistory
                .mockResolvedValueOnce([{ id: 1, message: 'Script 1', type: 'user' }])
                .mockResolvedValueOnce([{ id: 2, message: 'Script 2', type: 'user' }]);

            // Load script 1
            await chatHistoryManager.loadScriptHistory(script1.id);
            expect(mockApi.getScriptChatHistory).toHaveBeenCalledTimes(1);

            // Load script 2 (should make new API call)
            await chatHistoryManager.loadScriptHistory(script2.id);
            expect(mockApi.getScriptChatHistory).toHaveBeenCalledTimes(2);
        });

        test('should handle large chat histories efficiently', async () => {
            const script = { id: 1, title: 'Script 1' };
            const largeHistory = Array.from({ length: 1000 }, (_, i) => ({
                id: i + 1,
                message: `Message ${i + 1}`,
                type: i % 2 === 0 ? 'user' : 'ai',
                timestamp: `2023-01-01T00:${String(i).padStart(2, '0')}:00Z`
            }));

            mockApi.getScriptChatHistory.mockResolvedValue(largeHistory);

            const startTime = Date.now();
            await chatHistoryManager.loadScriptHistory(script.id);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
            expect(chatHistoryManager.getCurrentScriptHistory().messages).toHaveLength(1000);
        });
    });

    describe('Integration with Chat System', () => {
        test('should integrate with chat message events', async () => {
            const script = { id: 1, title: 'Script 1' };
            const message = {
                message: 'Integration test message',
                type: 'user',
                timestamp: '2023-01-01T00:00:00Z'
            };

            await chatHistoryManager.loadScriptHistory(script.id);
            await chatHistoryManager.addMessage(message);

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'CHAT:MESSAGE_ADDED',
                { scriptId: script.id, message }
            );
        });

        test('should handle chat history updates from other sources', async () => {
            const script = { id: 1, title: 'Script 1' };
            const newMessage = {
                id: 1,
                message: 'External message',
                type: 'ai',
                timestamp: '2023-01-01T00:00:00Z'
            };

            await chatHistoryManager.loadScriptHistory(script.id);

            // Simulate external message addition
            chatHistoryManager.handleExternalMessage(newMessage);

            const history = chatHistoryManager.getCurrentScriptHistory();
            expect(history.messages).toContain(newMessage);
        });
    });
});
