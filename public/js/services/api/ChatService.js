import { API_ENDPOINTS } from '../../constants.js';
import { debugLog } from '../../core/logger.js';
import { HttpClient } from './HttpClient.js';
import { ValidationError } from './APIError.js';

/**
 * Chat service for AI chat and message history
 */
export class ChatService {
    /**
     * @param {HttpClient} httpClient - Shared HTTP client instance
     */
    constructor(httpClient) {
        this.http = httpClient;
    }

    /**
     * Get chat response from AI
     * @param {string} content - The chat message content
     * @param {object} context - Context information
     * @param {string} [context.scriptId] - Current script ID
     * @param {string} [context.scriptTitle] - Current script title
     * @param {string} [context.scriptVersion] - Current script version
     * @returns {Promise<object>} Chat response with html property
     */
    async getChatResponse(content, context = {}) {
        const enhancedContext = {
            scriptId: context.scriptId || null,
            scriptTitle: context.scriptTitle || null,
            scriptVersion: context.scriptVersion || null,
            timestamp: new Date().toISOString(),
            ...context
        };

        debugLog('[API] Chat request with context:', {
            prompt: content,
            scriptId: enhancedContext.scriptId,
            scriptTitle: enhancedContext.scriptTitle,
            hasContext: Object.keys(context).length > 0
        });

        const result = await this.http.request(API_ENDPOINTS.CHAT, {
            method: 'POST',
            data: {
                prompt: content,
                context: enhancedContext
            }
        });

        // Normalize response format
        const processedResult = Array.isArray(result) ? result[0] : result;
        return typeof processedResult === 'string' ? { html: processedResult } : processedResult;
    }

    /**
     * Trigger a system prompt from the server
     * @param {string} promptType - Type of system prompt
     * @param {string|null} scriptId - Associated script ID
     * @param {object} context - Additional context
     * @returns {Promise<object>} System prompt response
     */
    async triggerSystemPrompt(promptType, scriptId = null, context = {}) {
        if (!promptType) {
            throw new ValidationError('PROMPT_TYPE_REQUIRED');
        }

        return this.http.request(API_ENDPOINTS.SYSTEM_PROMPTS, {
            method: 'POST',
            data: {
                promptType,
                scriptId,
                context: {
                    timestamp: new Date().toISOString(),
                    ...context
                }
            }
        });
    }

    /**
     * Get chat history
     * @param {string|null} scriptId - Filter by script ID
     * @param {number} limit - Maximum messages to return
     * @param {number} offset - Pagination offset
     * @returns {Promise<object[]>} Array of chat messages
     */
    async getChatMessages(scriptId = null, limit = 30, offset = 0) {
        const params = new URLSearchParams();
        if (scriptId) params.set('scriptId', scriptId);
        if (limit) params.set('limit', String(limit));
        if (offset) params.set('offset', String(offset));

        const queryString = params.toString();
        const endpoint = queryString
            ? `${API_ENDPOINTS.CHAT}/messages?${queryString}`
            : `${API_ENDPOINTS.CHAT}/messages`;

        return this.http.request(endpoint, { method: 'GET' });
    }

    /**
     * Add a chat message
     * @param {string} scriptId - Script ID
     * @param {object} message - Message object
     * @returns {Promise<object>} Saved message
     */
    async addChatMessage(scriptId, message) {
        return this.http.request(`${API_ENDPOINTS.CHAT}/messages`, {
            method: 'POST',
            data: { scriptId, message }
        });
    }

    /**
     * Clear chat messages for a script
     * @param {string} scriptId - Script ID
     * @returns {Promise<void>}
     */
    async clearChatMessages(scriptId) {
        return this.http.request(`${API_ENDPOINTS.CHAT}/messages/${scriptId}`, { method: 'DELETE' });
    }
}
