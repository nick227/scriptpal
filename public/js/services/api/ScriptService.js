import { API_ENDPOINTS, ERROR_MESSAGES } from '../../constants.js';
import { debugLog } from '../../core/logger.js';
import { HttpClient } from './HttpClient.js';
import { ValidationError } from './APIError.js';

/**
 * Script service for script CRUD operations
 */
export class ScriptService {
    /**
     * @param {HttpClient} httpClient - Shared HTTP client instance
     */
    constructor(httpClient) {
        this.http = httpClient;
    }

    /**
     * Get script by ID
     * @param {string} id - Script ID
     * @returns {Promise<object>} Script object
     */
    async getScript(id) {
        return this.http.request(`${API_ENDPOINTS.SCRIPT}/${id}`, { method: 'GET' });
    }

    /**
     * Create a new script
     * @param {object} scriptData - Script data
     * @param {string} scriptData.title - Script title
     * @param {string} scriptData.content - Script content
     * @returns {Promise<object>} Created script object
     */
    async createScript(scriptData) {
        return this.http.request(API_ENDPOINTS.SCRIPT, {
            method: 'POST',
            data: scriptData
        });
    }

    /**
     * Update an existing script
     * @param {string} id - Script ID
     * @param {object} scriptData - Script data to update
     * @param {string} scriptData.title - Script title
     * @param {string} scriptData.content - Script content
     * @param {string} [scriptData.author] - Script author
     * @param {string} [scriptData.description] - Script description
     * @param {string} [scriptData.visibility] - Script visibility ('private' or 'public')
     * @returns {Promise<object>} Updated script object
     */
    async updateScript(id, scriptData) {
        if (!id || !scriptData) {
            throw new ValidationError('INVALID_DATA', { message: ERROR_MESSAGES.VALIDATION_ERROR });
        }

        const updateData = {
            title: scriptData.title || 'Untitled',
            content: scriptData.content
        };

        if (scriptData.author !== undefined) {
            updateData.author = scriptData.author;
        }
        if (scriptData.description !== undefined) {
            updateData.description = scriptData.description;
        }
        if (scriptData.visibility !== undefined) {
            const normalizedVisibility = String(scriptData.visibility || '').toLowerCase();
            if (normalizedVisibility === 'private' || normalizedVisibility === 'public') {
                updateData.visibility = normalizedVisibility;
            }
        }

        debugLog('[API] Updating script:', {
            id,
            title: updateData.title,
            contentLength: updateData.content?.length || 0
        });

        const result = await this.http.request(`${API_ENDPOINTS.SCRIPT}/${id}`, {
            method: 'PUT',
            data: updateData
        });

        debugLog('[API] Script update result:', {
            success: !!result,
            id,
            versionNumber: result?.versionNumber,
            timestamp: new Date().toISOString()
        });

        return result;
    }

    /**
     * Delete a script
     * @param {string} id - Script ID
     * @returns {Promise<void>}
     */
    async deleteScript(id) {
        return this.http.request(`${API_ENDPOINTS.SCRIPT}/${id}`, { method: 'DELETE' });
    }

    /**
     * Get all scripts for a user
     * @param {string} userId - User ID
     * @returns {Promise<object[]>} Array of script objects
     */
    async getAllScriptsByUser(userId) {
        return this.http.request(`${API_ENDPOINTS.SCRIPT}?userId=${userId}`, { method: 'GET' });
    }

    /**
     * Get script by slug
     * @param {string} slug - Script slug
     * @returns {Promise<object>} Script object
     */
    async getScriptBySlug(slug) {
        if (!slug) {
            throw new ValidationError('SLUG_REQUIRED');
        }
        return this.http.request(`${API_ENDPOINTS.SCRIPT_SLUG}/${encodeURIComponent(slug)}`, { method: 'GET' });
    }

    /**
     * Request next lines generation for a script
     * @param {string} scriptId - Script ID
     * @param {object} context - Additional context
     * @returns {Promise<object>} Generated lines response
     */
    async requestNextLines(scriptId, context = {}) {
        if (!scriptId) {
            throw new ValidationError('SCRIPT_ID_REQUIRED');
        }

        return this.http.request(`${API_ENDPOINTS.SCRIPT}/${scriptId}/next-lines`, {
            method: 'POST',
            data: {
                scriptId,
                context: {
                    timestamp: new Date().toISOString(),
                    ...context
                }
            }
        });
    }
}
