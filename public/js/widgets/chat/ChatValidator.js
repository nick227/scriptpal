export class ChatValidator {
    constructor ({ rendererGetter, apiGetter, processingFlagGetter } = {}) {
        this.rendererGetter = rendererGetter;
        this.apiGetter = apiGetter;
        this.processingFlagGetter = processingFlagGetter;
    }

    validateSend (message) {
        const renderer = this.rendererGetter && this.rendererGetter();
        if (!renderer) {
            console.error('[ChatValidator] No renderer available');
            return false;
        }

        if (!renderer.container) {
            console.error('[ChatValidator] No renderer container available');
            return false;
        }

        if (!message || typeof message !== 'string') {
            console.error('[ChatValidator] Invalid message format:', typeof message);
            return false;
        }

        const trimmedMessage = message.trim();
        if (!trimmedMessage) {
            console.warn('[ChatValidator] Empty message provided');
            return false;
        }

        if (trimmedMessage.length > 10000) {
            console.warn('[ChatValidator] Message too long:', trimmedMessage.length);
            return false;
        }

        const processing = this.processingFlagGetter && this.processingFlagGetter();
        if (processing) {
            console.warn('[ChatValidator] Message processing already in progress');
            return false;
        }

        const api = this.apiGetter && this.apiGetter();
        if (!api || typeof api.getChatResponse !== 'function') {
            console.error('[ChatValidator] API not available or invalid');
            return false;
        }

        return true;
    }

    validateHistory (messages) {
        const renderer = this.rendererGetter && this.rendererGetter();
        if (!Array.isArray(messages)) {
            console.warn('[ChatValidator] Messages is not an array:', messages);
            return false;
        }
        if (!renderer || !renderer.container) {
            console.error('[ChatValidator] No renderer or container available');
            return false;
        }
        return true;
    }
}
