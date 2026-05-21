import { EventManager } from '../../../core/EventManager.js';
import { ChatIntegration } from '../../../widgets/chat/integration/ChatIntegration.js';

describe('ChatIntegration', () => {
    test('does not render assistant chat text from AI:RESPONSE_RECEIVED', () => {
        const subscriptions = [];
        const mockEventManager = {
            subscribe: jest.fn((event, callback) => {
                subscriptions.push({ event, callback });
                return () => {};
            })
        };
        const integration = Object.create(ChatIntegration.prototype);
        integration.eventManager = mockEventManager;
        integration.chatManager = {
            processAndRenderMessage: jest.fn()
        };

        integration.setupIntegrationEvents();

        const aiSubscription = subscriptions.find(
            subscription => subscription.event === EventManager.EVENTS.AI.RESPONSE_RECEIVED
        );

        expect(aiSubscription).toBeUndefined();
        expect(integration.chatManager.processAndRenderMessage).not.toHaveBeenCalled();
    });
});
