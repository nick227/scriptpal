import { ChatManager } from '../../../widgets/chat/core/ChatManager.js';
import { resetSingleton } from '../../../widgets/chat/core/ChatHistoryManager.js';
import { StateManager } from '../../../core/StateManager.js';

describe('ChatManager timeout', () => {
    let chatManager;
    let stateStorage;
    let mockStateManager;
    let mockApi;
    let mockEventManager;

    beforeEach(() => {
        jest.useFakeTimers();

        stateStorage = {
            [StateManager.KEYS.CURRENT_SCRIPT]: { id: 'script-1', title: 'My Script', versionNumber: 1 },
            [StateManager.KEYS.USER]: { id: 'user-1' },
            [StateManager.KEYS.EDITOR_READY]: true
        };

        mockStateManager = {
            subscribe: jest.fn().mockReturnValue(() => {}),
            unsubscribe: jest.fn(),
            setState: jest.fn(),
            getState: jest.fn((key) => stateStorage[key])
        };

        mockApi = {
            getChatResponse: jest.fn(() => new Promise(() => {})),
            getChatMessages: jest.fn().mockResolvedValue([]),
            clearChatMessages: jest.fn().mockResolvedValue(true)
        };

        mockEventManager = {
            publish: jest.fn(),
            subscribe: jest.fn().mockReturnValue(() => {})
        };

        resetSingleton();
        chatManager = new ChatManager(mockStateManager, mockApi, mockEventManager);
        chatManager.scriptContextManager.getAIChatContext = jest.fn().mockResolvedValue({});
    });

    afterEach(() => {
        jest.useRealTimers();
        chatManager.destroy();
        resetSingleton();
    });

    test('times out chat responses after 30 seconds', async () => {
        const promise = chatManager.getApiResponseWithTimeout('hello');
        const assertion = expect(promise).rejects.toThrow('Request timeout');
        await jest.advanceTimersByTimeAsync(30000);
        await assertion;
    });
});
