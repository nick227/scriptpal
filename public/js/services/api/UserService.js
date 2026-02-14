import { API_ENDPOINTS } from '../../constants.js';
import { HttpClient } from './HttpClient.js';

/**
 * User service for user CRUD operations
 */
export class UserService {
    /**
     * @param {HttpClient} httpClient - Shared HTTP client instance
     */
    constructor(httpClient) {
        this.http = httpClient;
    }

    /**
     * Get user by ID
     * @param {string} id - User ID
     * @returns {Promise<object>} User object
     */
    async getUser(id) {
        return this.http.request(`${API_ENDPOINTS.USER}/${id}`, { method: 'GET' });
    }

    /**
     * Create a new user
     * @param {object} userData - User data
     * @param {string} userData.email - User email
     * @param {string} userData.password - User password
     * @param {string} userData.name - User name
     * @returns {Promise<object>} Created user object
     */
    async createUser(userData) {
        return this.http.request(API_ENDPOINTS.USER, {
            method: 'POST',
            data: userData
        });
    }

    /**
     * Update current user profile
     * @param {{ username: string }} profileData
     * @returns {Promise<object>}
     */
    async updateCurrentProfile(profileData) {
        return this.http.request(API_ENDPOINTS.USER_CURRENT_PROFILE, {
            method: 'PATCH',
            data: profileData
        });
    }

    /**
     * Change current user password
     * @param {{ currentPassword: string, newPassword: string }} passwordData
     * @returns {Promise<object>}
     */
    async changePassword(passwordData) {
        return this.http.request(API_ENDPOINTS.USER_CURRENT_PASSWORD, {
            method: 'POST',
            data: passwordData
        });
    }

    /**
     * Soft delete current user account
     * @param {{ password: string, confirm: string, deleteReason?: string }} payload
     * @returns {Promise<void>}
     */
    async softDeleteCurrentUser(payload) {
        return this.http.request(API_ENDPOINTS.USER_CURRENT, {
            method: 'DELETE',
            data: payload
        });
    }
}
