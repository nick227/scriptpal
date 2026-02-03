import { API_ENDPOINTS, ERROR_MESSAGES } from '../../constants.js';
import { HttpClient } from './HttpClient.js';
import { ValidationError } from './APIError.js';

/**
 * Media service for upload, generation, and management
 */
export class MediaService {
    /**
     * @param {HttpClient} httpClient - Shared HTTP client instance
     */
    constructor(httpClient) {
        this.http = httpClient;
    }

    /**
     * Upload a media file
     * @param {File} file - File to upload
     * @param {string} type - Media type
     * @returns {Promise<object>} Upload result with asset info
     */
    async uploadMedia(file, type) {
        if (!file) {
            throw new ValidationError('FILE_REQUIRED');
        }
        if (!type) {
            throw new ValidationError('TYPE_REQUIRED');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        return this.http.formRequest(API_ENDPOINTS.MEDIA_UPLOAD, formData);
    }

    /**
     * Generate media via AI
     * @param {object} payload - Generation parameters
     * @param {string} payload.prompt - Generation prompt
     * @param {string} payload.type - Media type to generate
     * @returns {Promise<object>} Generation result
     */
    async generateMedia(payload) {
        return this.http.request(API_ENDPOINTS.MEDIA_GENERATE, {
            method: 'POST',
            data: payload
        });
    }

    /**
     * List media assets
     * @param {object} params - Query parameters
     * @param {string} [params.type] - Filter by type
     * @param {number} [params.page] - Page number
     * @param {number} [params.pageSize] - Items per page
     * @returns {Promise<object>} Paginated media list
     */
    async listMedia(params = {}) {
        const query = new URLSearchParams();
        if (params.type) query.set('type', params.type);
        if (params.page) query.set('page', String(params.page));
        if (params.pageSize) query.set('pageSize', String(params.pageSize));

        const suffix = query.toString();
        const endpoint = suffix ? `${API_ENDPOINTS.MEDIA}?${suffix}` : API_ENDPOINTS.MEDIA;

        return this.http.request(endpoint, { method: 'GET' });
    }

    /**
     * Attach media to an entity
     * @param {string} assetId - Media asset ID
     * @param {object} payload - Attachment info
     * @param {string} payload.ownerType - Owner type (script, scene, character, etc.)
     * @param {string} payload.ownerId - Owner ID
     * @param {string} [payload.role] - Media role
     * @returns {Promise<object>} Attachment result
     */
    async attachMedia(assetId, payload) {
        if (!assetId) {
            throw new ValidationError('ITEM_ID_REQUIRED', { field: 'assetId' });
        }
        if (!payload) {
            throw new ValidationError('INVALID_DATA');
        }

        return this.http.request(`${API_ENDPOINTS.MEDIA}/${assetId}/attach`, {
            method: 'POST',
            data: payload
        });
    }

    /**
     * Get media generation job status
     * @param {string} jobId - Job ID
     * @returns {Promise<object>} Job status
     */
    async getMediaJob(jobId) {
        if (!jobId) {
            throw new ValidationError('ITEM_ID_REQUIRED', { field: 'jobId' });
        }

        return this.http.request(`${API_ENDPOINTS.MEDIA_JOBS}/${jobId}`, { method: 'GET' });
    }

    /**
     * Get media for an owner
     * @param {string} ownerType - Owner type
     * @param {string} ownerId - Owner ID
     * @param {string} [role] - Filter by role
     * @returns {Promise<object[]>} Media list
     */
    async getOwnerMedia(ownerType, ownerId, role) {
        if (!ownerType || !ownerId) {
            throw new ValidationError('INVALID_DATA', { message: ERROR_MESSAGES.VALIDATION_ERROR });
        }

        const query = role ? `?role=${encodeURIComponent(role)}` : '';
        return this.http.request(`${API_ENDPOINTS.OWNER_MEDIA(ownerType, ownerId)}${query}`, { method: 'GET' });
    }
}
