import { ChatManager } from '../../../widgets/chat/ChatManager.js';

describe('ChatManager append integration', () => {
    test('routes APPEND_SCRIPT response to orchestrator append', async () => {
        const mockStateManager = {
            subscribe: jest.fn(),
            setState: jest.fn(),
            getState: jest.fn().mockReturnValue(null)
        };
        const mockApi = {
            getChatResponse: jest.fn().mockResolvedValue({
                intent: 'APPEND_SCRIPT',
                response: {
                    content: 'INT. ROOM - DAY\nJOHN\nhello there'
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
            content: 'INT. ROOM - DAY\nJOHN\nhello there',
            isFromAppend: true
        });
    });
});
