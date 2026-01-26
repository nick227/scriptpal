/**
 * Tests for Requirement #8: The user can switch active script loading the script UI and switching the AI context
 */

import { ChatHistoryManager } from '../../widgets/chat/core/ChatHistoryManager.js';
import { ScriptContextManager } from '../../widgets/editor/context/ScriptContextManager.js';

// Minimal state manager stub
const createStateManager = () => ({
    getState: jest.fn().mockReturnValue(null),
    setState: jest.fn(),
    subscribe: jest.fn()
});

describe('Requirement #8: Switch Active Script with AI Context', () => {
    let chatHistoryManager;
    let scriptContextManager;
    let mockApi;
    let mockStateManager;
    let mockEventManager;
    let mockContentManager;
    let mockPageManager;
    let mockChapterManager;

    beforeEach(() => {
        mockApi = {
            getChatMessages: jest.fn().mockResolvedValue([
                { id: 1, content: 'Hello', type: 'user', timestamp: '2023-01-01T00:00:00Z' }
            ])
        };

        mockStateManager = createStateManager();

        mockEventManager = {
            publish: jest.fn(),
            subscribe: jest.fn()
        };

        mockContentManager = {
            getContent: jest.fn().mockReturnValue('Test content'),
            setContent: jest.fn(),
            getLineCount: jest.fn().mockReturnValue(10)
        };

        mockPageManager = {
            getPageCount: jest.fn().mockReturnValue(3),
            getCurrentPage: jest.fn().mockReturnValue(1)
        };

        mockChapterManager = {
            getChapterCount: jest.fn().mockReturnValue(2),
            getChapters: jest.fn().mockReturnValue([])
        };

        chatHistoryManager = new ChatHistoryManager({
            api: mockApi,
            stateManager: mockStateManager,
            eventManager: mockEventManager
        });

        scriptContextManager = new ScriptContextManager({
            stateManager: mockStateManager,
            eventManager: mockEventManager,
            contentManager: mockContentManager,
            pageManager: mockPageManager,
            chapterManager: mockChapterManager
        });
    });

    afterEach(() => {
        chatHistoryManager.destroy();
        scriptContextManager.destroy();
    });

    describe('AI Context Switching', () => {
        test('should update AI context when script changes', () => {
            const script1 = { id: 1, title: 'Script 1', content: 'Content 1', author: 'Author 1' };
            const script2 = { id: 2, title: 'Script 2', content: 'Content 2', author: 'Author 2' };

            scriptContextManager.handleScriptChange(script1);
            let context = scriptContextManager.getScriptMetadata();
            expect(context.id).toBe(1);
            expect(context.title).toBe('Script 1');

            scriptContextManager.handleScriptChange(script2);
            context = scriptContextManager.getScriptMetadata();
            expect(context.id).toBe(2);
            expect(context.title).toBe('Script 2');
        });

        test('should invalidate context cache when script changes', () => {
            const script1 = { id: 1, title: 'Script 1', content: 'Content 1' };
            const script2 = { id: 2, title: 'Script 2', content: 'Content 2' };

            scriptContextManager.handleScriptChange(script1);
            scriptContextManager.getScriptMetadata();

            scriptContextManager.handleScriptChange(script2);
            scriptContextManager.invalidateCache();

            const context = scriptContextManager.getScriptMetadata();
            expect(context.id).toBe(2);
        });
    });

    describe('Chat History Context Switching', () => {
        test('should switch chat history when script changes', async () => {
            const script1 = { id: 1, title: 'Script 1' };
            const script2 = { id: 2, title: 'Script 2' };

            mockApi.getChatMessages
                .mockResolvedValueOnce([{ id: 1, content: 'Script 1 chat', type: 'user' }])
                .mockResolvedValueOnce([{ id: 2, content: 'Script 2 chat', type: 'user' }]);

            await chatHistoryManager.handleScriptChange(script1);
            let history = chatHistoryManager.getCurrentScriptHistory();
            expect(history.scriptId).toBe(1);

            await chatHistoryManager.handleScriptChange(script2);
            history = chatHistoryManager.getCurrentScriptHistory();
            expect(history.scriptId).toBe(2);
        });

        test('should load script-specific chat history', async () => {
            const script = { id: 1, title: 'Script 1' };
            const mockHistory = [
                { id: 1, content: 'Hello', type: 'user', timestamp: '2023-01-01T00:00:00Z' },
                { id: 2, content: 'Hi there!', type: 'assistant', timestamp: '2023-01-01T00:01:00Z' }
            ];

            mockApi.getChatMessages.mockResolvedValue(mockHistory);

            await chatHistoryManager.handleScriptChange(script);

            expect(mockApi.getChatMessages).toHaveBeenCalledWith(script.id);
            expect(chatHistoryManager.getCurrentScriptHistory().messages).toEqual(mockHistory);
        });
    });
});