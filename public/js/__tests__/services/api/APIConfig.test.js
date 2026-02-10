import { getTimeoutForRequest, TIMEOUT_CONFIG } from '../../../services/api/APIConfig.js';

describe('APIConfig chat timeout policy', () => {
    test('caps /chat requests at 30 seconds', () => {
        const timeout = getTimeoutForRequest('POST', '/chat');
        expect(timeout).toBe(TIMEOUT_CONFIG.CHAT_MS);
        expect(timeout).toBe(30000);
    });

    test('caps /system-prompts requests at 30 seconds', () => {
        const timeout = getTimeoutForRequest('POST', '/system-prompts');
        expect(timeout).toBe(TIMEOUT_CONFIG.CHAT_MS);
        expect(timeout).toBe(30000);
    });
});

