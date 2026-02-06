/**
 * ChatValidationService — Validate send and history conditions.
 * Returns { ok, reason } instead of boolean for better logging, UX, and tests.
 */

/** @typedef {{ ok: true } | { ok: false, reason: string }} ValidationResult */

/**
 * Validate conditions for sending a chat message.
 * @param {object} options
 * @param {string} options.message - Message to send
 * @param {object} options.renderer - Renderer instance
 * @param {object} options.api - API service
 * @param {boolean} options.isProcessing - Whether a message is already being processed
 * @returns {ValidationResult}
 */
export function validateSendConditions (options) {
    const { message, renderer, api, isProcessing } = options;

    if (!renderer) {
        return { ok: false, reason: 'NO_RENDERER' };
    }

    if (!renderer.container) {
        return { ok: false, reason: 'NO_RENDERER_CONTAINER' };
    }

    if (!message || typeof message !== 'string') {
        return { ok: false, reason: 'INVALID_MESSAGE_FORMAT' };
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
        return { ok: false, reason: 'EMPTY_MESSAGE' };
    }

    if (trimmedMessage.length > 10000) {
        return { ok: false, reason: 'MESSAGE_TOO_LONG' };
    }

    if (isProcessing) {
        return { ok: false, reason: 'ALREADY_PROCESSING' };
    }

    if (!api || typeof api.getChatResponse !== 'function') {
        return { ok: false, reason: 'API_NOT_AVAILABLE' };
    }

    return { ok: true };
}

/**
 * Validate conditions for loading chat history.
 * @param {object} options
 * @param {Array} options.messages - Messages to load
 * @param {object} options.renderer - Renderer instance
 * @returns {ValidationResult}
 */
export function validateHistoryConditions (options) {
    const { messages, renderer } = options;

    if (!Array.isArray(messages)) {
        return { ok: false, reason: 'NOT_ARRAY' };
    }

    if (!renderer || !renderer.container) {
        return { ok: false, reason: 'NO_RENDERER' };
    }

    return { ok: true };
}
