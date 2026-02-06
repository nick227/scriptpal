/**
 * ResponseExtractor — Extract message content from API responses and legacy DB shapes.
 * Separate extractApiResponseContent (canonical) from extractLegacyDbContent (deprecated).
 * Do NOT use extractLegacyDbContent for new API paths.
 */

/**
 * Extract chat message from API response.
 * Canonical shape (v2): data.response.message
 * Use for new API responses only.
 * @param {object} data - API response data
 * @returns {string|null} Extracted content or null
 */
export function extractApiResponseContent (data) {
    if (!data?.response) {
        return null;
    }

    let message = null;
    if (typeof data.response === 'string') {
        message = data.response;
    } else if (data.response) {
        message = _findResponseMessage(data.response);
    }

    if (!message) {
        return null;
    }

    return _extractJsonAssistantMessage(message);
}

/**
 * @deprecated Legacy chat history compatibility only. Use extractApiResponseContent for API responses.
 * Extract content from old DB records (message, content, response, assistantResponse).
 * Use only when hydrating old chat history from database.
 * @param {object|string} data - Legacy DB record
 * @returns {string}
 */
export function extractLegacyDbContent (data) {
    if (typeof data === 'string') {
        const parsed = _tryParseJsonString(data);
        if (parsed) {
            return extractLegacyDbContent(parsed);
        }
        return data.trim();
    }

    if (!data) {
        return '';
    }

    if (typeof data === 'object') {
        if (data.message && typeof data.message === 'string') {
            return data.message.trim();
        }
        if (data.content && typeof data.content === 'string') {
            return data.content.trim();
        }
        if (data.response && typeof data.response === 'string') {
            return data.response.trim();
        }
        if (data.assistantResponse && typeof data.assistantResponse === 'string') {
            return data.assistantResponse.trim();
        }
    }

    return '';
}

/**
 * Extract renderable string content from message data (string or object).
 * Use for processAndRenderMessage — keeps extraction in ResponseExtractor.
 * @param {string|object|null} messageData - Raw message (string, or object with message/content/response)
 * @returns {string}
 */
export function extractRenderableContent (messageData) {
    if (messageData == null) {
        return '';
    }
    return extractLegacyDbContent(messageData);
}

/**
 * Extract script content from API response.
 * Canonical shape (v2): response.script
 * @param {object} response - Response object
 * @returns {string}
 */
export function extractFormattedScriptFromResponse (response) {
    if (!response || typeof response !== 'object') {
        return '';
    }
    return response.script || '';
}

// ─── Internal helpers ─────────────────────────────────────────────────────

function _findResponseMessage (payload) {
    if (!payload) {
        return null;
    }

    if (typeof payload === 'string') {
        return payload;
    }

    if (typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message;
    }

    if (typeof payload.assistantResponse === 'string' && payload.assistantResponse.trim()) {
        return payload.assistantResponse;
    }

    if (payload.response && payload.response !== payload) {
        return _findResponseMessage(payload.response);
    }

    return null;
}

function _extractJsonAssistantMessage (rawMessage) {
    if (!rawMessage || typeof rawMessage !== 'string') {
        return rawMessage;
    }

    const trimmed = rawMessage.trim();
    if (!trimmed.startsWith('{')) {
        return rawMessage;
    }

    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
            if (typeof parsed.assistantResponse === 'string' && parsed.assistantResponse.trim()) {
                return parsed.assistantResponse.trim();
            }
            if (typeof parsed.message === 'string' && parsed.message.trim()) {
                return parsed.message.trim();
            }
            if (typeof parsed.formattedScript === 'string' && parsed.formattedScript.trim()) {
                return parsed.formattedScript.trim();
            }
        }
    } catch (error) {
        console.warn('[ResponseExtractor] Failed to parse JSON response message:', error);
    }

    return rawMessage;
}

function _tryParseJsonString (value) {
    if (!value || typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) {
        return null;
    }
    try {
        const parsed = JSON.parse(trimmed);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_error) {
        return null;
    }
}
