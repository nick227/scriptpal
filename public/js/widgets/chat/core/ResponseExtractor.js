/**
 * ResponseExtractor — Extract message content from API responses and history/DB shapes.
 *
 * USAGE:
 * - extractApiResponseContent(data) — For POST /chat, POST /system-prompts responses (canonical data.response)
 * - extractRenderableContent(messageData) — For processAndRenderMessage; handles strings, history messages, legacy shapes
 * - extractLegacyDbContent(data) — For history hydration only; deprecated for new API paths
 */

/**
 * Extract chat message from API response. Canonical shape (v2): data.response.message
 * Use for POST /chat and POST /system-prompts responses.
 * @param {object} data - Full API response with response: { message, script, metadata }
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
            const extracted = extractLegacyDbContent(parsed);
            if (extracted) {
                return extracted;
            }
            return data.trim();
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

        const structured = _formatStructuredObjectForDisplay(data);
        if (structured) {
            return structured;
        }
    }

    return '';
}

/**
 * Extract renderable string content from message data (string or object).
 * Use for processAndRenderMessage — handles history messages, strings, legacy DB shapes.
 * For API responses, prefer extractApiResponseContent when you have the full response object.
 * @param {string|object|null} messageData - Raw message (string, or object with message/content/response)
 * @returns {string}
 */
export function extractRenderableContent (messageData) {
    if (messageData == null) {
        return '';
    }
    const apiContent = extractApiResponseContent(messageData);
    if (apiContent) {
        return apiContent;
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

    if (typeof payload === 'object') {
        console.warn('[ResponseExtractor] No message-like field in payload', {
            keys: Object.keys(payload)
        });
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
            return _formatStructuredObjectForDisplay(parsed);
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

function _formatStructuredObjectForDisplay (value) {
    if (!value || typeof value !== 'object') {
        return '';
    }

    if (Array.isArray(value)) {
        const lines = value
            .map(item => (typeof item === 'string' ? item.trim() : ''))
            .filter(Boolean);
        return lines.join('\n');
    }

    if (Array.isArray(value.idea_nudges) && value.idea_nudges.length > 0) {
        return value.idea_nudges
            .map((entry, index) => {
                const idea = entry?.idea ? String(entry.idea).trim() : '';
                const reason = entry?.reason ? String(entry.reason).trim() : '';
                if (idea && reason) {
                    return `Idea ${index + 1}: ${idea}\nReason: ${reason}`;
                }
                return idea || reason;
            })
            .filter(Boolean)
            .join('\n\n');
    }

    const statusKeys = ['current_state_summary', 'progress', 'strengths', 'next_focus_area'];
    const statusLines = statusKeys
        .map((key) => {
            const raw = value[key];
            if (typeof raw !== 'string' || !raw.trim()) {
                return '';
            }
            const label = key.replace(/_/g, ' ');
            return `${label}: ${raw.trim()}`;
        })
        .filter(Boolean);
    if (statusLines.length > 0) {
        return statusLines.join('\n');
    }

    if (typeof value.intent === 'string' && typeof value.reason === 'string') {
        return `intent: ${value.intent}\nreason: ${value.reason}`;
    }

    try {
        return JSON.stringify(value, null, 2);
    } catch (_error) {
        return '';
    }
}
