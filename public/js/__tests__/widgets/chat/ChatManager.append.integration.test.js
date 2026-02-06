import { ChatManager } from '../../../widgets/chat/core/ChatManager.js';
import { resetSingleton } from '../../../widgets/chat/core/ChatHistoryManager.js';

describe('ChatManager append integration', () => {
    test('routes APPEND_SCRIPT response to orchestrator append', async () => {
        resetSingleton();
        const mockStateManager = {
            subscribe: jest.fn(),
            setState: jest.fn(),
            getState: jest.fn((key) => {
                if (key === 'currentScript') {
                    return { id: 'script-1', title: 'Test Script' };
                }
                if (key === 'editorReady') {
                    return true;
                }
                return null;
            })
        };
        const formattedScript = Array.from({ length: 12 }, (_, index) => `LINE ${index + 1}`).join('\n');
        const mockApi = {
            getChatMessages: jest.fn().mockResolvedValue([]),
            getChatResponse: jest.fn().mockResolvedValue({
                intent: 'APPEND_SCRIPT',
                response: {
                    script: formattedScript,
                    message: 'Added the next lines.',
                    metadata: {}
                }
            })
        };
        const mockEventManager = {
            publish: jest.fn(),
            subscribe: jest.fn().mockReturnValue(() => {})
        };
        const mockElements = {
            messagesContainer: document.createElement('div'),
            inputField: document.createElement('input'),
            sendButton: document.createElement('button')
        };
        const mockRenderer = {
            render: jest.fn().mockResolvedValue(true),
            renderButtons: jest.fn(),
            clear: jest.fn(),
            container: mockElements.messagesContainer
        };

        const chatManager = new ChatManager(mockStateManager, mockApi, mockEventManager);
        chatManager.initialize(mockElements);
        chatManager.renderer = mockRenderer;

        chatManager.chatHistoryManager = {
            addMessage: jest.fn().mockResolvedValue(true),
            loadScriptHistory: jest.fn().mockResolvedValue([]),
            clearScriptHistory: jest.fn().mockResolvedValue(true),
            destroy: jest.fn()
        };
        chatManager.scriptContextManager = {
            getAIChatContext: jest.fn().mockResolvedValue({})
        };

        const mockOrchestrator = {
            handleScriptAppend: jest.fn().mockResolvedValue(true)
        };
        chatManager.setScriptOrchestrator(mockOrchestrator);

        await chatManager.handleSend('Write the next scene');

        expect(mockApi.getChatResponse).toHaveBeenCalled();
        expect(mockOrchestrator.handleScriptAppend).toHaveBeenCalledWith({
            content: formattedScript,
            isFromAppend: true
        });
    });
});
