import { StateManager } from '../../../core/StateManager.js';
import { getInstance, resetSingleton } from '../../../widgets/chat/core/ChatHistoryManager.js';

describe('ChatHistoryManager', () => {
    let mockApi;
    let mockStateManager;
    let mockEventManager;

    beforeEach(() => {
        resetSingleton();

        mockApi = {
            getChatMessages: jest.fn().mockResolvedValue([]),
            clearChatMessages: jest.fn().mockResolvedValue(true)
        };

        mockStateManager = {
            getState: jest.fn((key) => key === StateManager.KEYS.USER ? { id: 1 } : null),
            subscribe: jest.fn(),
            unsubscribe: jest.fn()
        };

        mockEventManager = {
            publish: jest.fn()
        };
    });

    afterEach(() => {
        resetSingleton();
    });

    test('does not re-fetch history when CURRENT_SCRIPT updates with same script id', async () => {
        const manager = getInstance({
            api: mockApi,
            stateManager: mockStateManager,
            eventManager: mockEventManager
        });

        await manager.handleScriptChange({ id: 5, title: 'Original' });
        await manager.handleScriptChange({ id: 5, title: 'Edited title', content: '{"lines":[]}' });

        expect(mockApi.getChatMessages).toHaveBeenCalledTimes(1);
        expect(mockApi.getChatMessages).toHaveBeenCalledWith(5);
    });
});
