import { API_ENDPOINTS } from '../../constants.js';
import { ValidationError } from './APIError.js';

/**
 * Service for public script endpoints
 */
export class PublicScriptService {
    /**
     * @param {HttpClient} httpClient - Shared HTTP client instance
     */
    constructor(httpClient) {
        this.http = httpClient;
    }

    /**
     * Get list of public scripts
     * @param {object} options - Query options
     * @param {number} [options.page] - Page number
     * @param {number} [options.pageSize] - Items per page
     * @param {string} [options.sortBy] - Sort field
     * @param {string} [options.order] - Sort order ('asc' or 'desc')
     * @returns {Promise<object>} Paginated list of public scripts
     */
    async getPublicScripts(options = {}) {
        const params = new URLSearchParams();
        if (options.page) params.set('page', String(options.page));
        if (options.pageSize) params.set('pageSize', String(options.pageSize));
        if (options.sortBy) params.set('sortBy', options.sortBy);
        if (options.order) params.set('order', options.order);

        const query = params.toString();
        const endpoint = query
            ? `${API_ENDPOINTS.PUBLIC_SCRIPTS}?${query}`
            : API_ENDPOINTS.PUBLIC_SCRIPTS;

        return this.http.request(endpoint, { method: 'GET' });
    }

    /**
     * Get a public script by ID
     * @param {string} id - Public script ID
     * @returns {Promise<object>} Public script object
     */
    async getPublicScript(id) {
        if (!id) {
            throw new ValidationError('SCRIPT_ID_REQUIRED');
        }
        return this.http.request(`${API_ENDPOINTS.PUBLIC_SCRIPTS}/${id}`, { method: 'GET' });
    }

    /**
     * Get a public script by its stable public ID
     * @param {string} publicId - Stable public identifier
     * @returns {Promise<object>} Public script object
     */
    async getPublicScriptByPublicId(publicId) {
        if (!publicId) {
            throw new ValidationError('PUBLIC_ID_REQUIRED');
        }
        return this.http.request(API_ENDPOINTS.PUBLIC_SCRIPT_BY_PUBLIC_ID(encodeURIComponent(publicId)), { method: 'GET' });
    }

    /**
     * Get a public script by slug
     * @param {string} slug - Public script slug
     * @returns {Promise<object>} Public script object
     */
    async getPublicScriptBySlug(slug) {
        if (!slug) {
            throw new ValidationError('SLUG_REQUIRED');
        }
        return this.http.request(`${API_ENDPOINTS.PUBLIC_SCRIPTS_SLUG}/${encodeURIComponent(slug)}`, { method: 'GET' });
    }

    /**
     * Clone a public script into the authenticated user's account
     * @param {string} publicId - Stable public script identifier
     * @param {object} [options] - Clone options
     * @param {number} [options.versionNumber] - Specific version to clone
     * @returns {Promise<object>} Cloned script object
     */
    async clonePublicScriptByPublicId(publicId, options = {}) {
        if (!publicId) {
            throw new ValidationError('PUBLIC_ID_REQUIRED');
        }

        const payload = {};
        if (options.versionNumber !== undefined && options.versionNumber !== null) {
            payload.versionNumber = Number(options.versionNumber);
        }

        return this.http.request(API_ENDPOINTS.PUBLIC_SCRIPT_CLONE(encodeURIComponent(publicId)), {
            method: 'POST',
            data: payload
        });
    }

    /**
     * Get comments for a public script
     * @param {string} scriptId - Script ID
     * @param {object} options - Pagination options
     * @param {number} [options.page=1] - Page number
     * @param {number} [options.pageSize=20] - Items per page
     * @returns {Promise<object>} Paginated comments
     */
    async getComments(scriptId, { page = 1, pageSize = 20 } = {}) {
        if (!scriptId) {
            throw new ValidationError('SCRIPT_ID_REQUIRED');
        }

        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('pageSize', String(pageSize));

        const endpoint = `${API_ENDPOINTS.PUBLIC_SCRIPT_COMMENTS(scriptId)}?${params.toString()}`;
        return this.http.request(endpoint, { method: 'GET' });
    }

    /**
     * Add a comment to a public script
     * @param {string} scriptId - Script ID
     * @param {string} content - Comment content
     * @returns {Promise<object>} Created comment
     */
    async addComment(scriptId, content) {
        if (!scriptId) {
            throw new ValidationError('SCRIPT_ID_REQUIRED');
        }
        if (!content?.trim()) {
            throw new ValidationError('CONTENT_REQUIRED');
        }

        return this.http.request(API_ENDPOINTS.PUBLIC_SCRIPT_COMMENTS(scriptId), {
            method: 'POST',
            data: { content: content.trim() }
        });
    }

    /**
     * Get a public user profile by username
     * @param {string} username
     * @param {{ page?: number, pageSize?: number }} options
     * @returns {Promise<object>}
     */
    async getPublicUserProfile(username, options = {}) {
        if (!username) {
            throw new ValidationError('USERNAME_REQUIRED');
        }

        const params = new URLSearchParams();
        if (options.page) params.set('page', String(options.page));
        if (options.pageSize) params.set('pageSize', String(options.pageSize));

        const query = params.toString();
        const endpoint = query
            ? `${API_ENDPOINTS.PUBLIC_USERS}/${encodeURIComponent(username)}?${query}`
            : `${API_ENDPOINTS.PUBLIC_USERS}/${encodeURIComponent(username)}`;

        return this.http.request(endpoint, { method: 'GET' });
    }
}
