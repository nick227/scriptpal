import { API_ENDPOINTS } from '../../constants.js';
import { HttpClient } from './HttpClient.js';
import { ValidationError } from './APIError.js';

/**
 * Brainstorm service for brainstorming boards
 */
export class BrainstormService {
    /**
     * @param {HttpClient} httpClient - Shared HTTP client instance
     */
    constructor(httpClient) {
        this.http = httpClient;
    }

    /**
     * List all brainstorm boards
     * @returns {Promise<object[]>} Array of board objects
     */
    async listBoards() {
        return this.http.request(API_ENDPOINTS.BRAINSTORM_BOARDS, { method: 'GET' });
    }

    /**
     * Get a specific brainstorm board
     * @param {string} boardId - Board ID
     * @returns {Promise<object>} Board object
     */
    async getBoard(boardId) {
        if (!boardId) {
            throw new ValidationError('BOARD_ID_REQUIRED');
        }
        return this.http.request(`${API_ENDPOINTS.BRAINSTORM_BOARDS}/${boardId}`, { method: 'GET' });
    }

    /**
     * Create a new brainstorm board
     * @param {object} data - Board data
     * @param {string} data.title - Board title
     * @param {string} [data.seed] - Initial seed idea
     * @param {object[]} [data.notes] - Board notes array
     * @returns {Promise<object>} Created board object
     */
    async createBoard({ title, seed, notes }) {
        const requestData = {
            title: title,
            seed: seed,
            notes: Array.isArray(notes) ? notes : []
        };
        return this.http.request(API_ENDPOINTS.BRAINSTORM_BOARDS, {
            method: 'POST',
            data: requestData
        });
    }

    /**
     * Update a brainstorm board
     * @param {string} boardId - Board ID
     * @param {object} data - Board data to update
     * @param {string} [data.title] - Board title
     * @param {string} [data.seed] - Seed idea
     * @param {object[]} [data.notes] - Board notes array
     * @returns {Promise<object>} Updated board object
     */
    async updateBoard(boardId, { title, seed, notes }) {
        if (!boardId) {
            throw new ValidationError('BOARD_ID_REQUIRED');
        }
        return this.http.request(`${API_ENDPOINTS.BRAINSTORM_BOARDS}/${boardId}`, {
            method: 'PUT',
            data: { title, seed, notes }
        });
    }

    /**
     * Delete a brainstorm board
     * @param {string} boardId - Board ID
     * @returns {Promise<void>}
     */
    async deleteBoard(boardId) {
        if (!boardId) {
            throw new ValidationError('BOARD_ID_REQUIRED');
        }
        return this.http.request(`${API_ENDPOINTS.BRAINSTORM_BOARDS}/${boardId}`, { method: 'DELETE' });
    }

    /**
     * Request AI-generated notes for a category
     * @param {string} boardId - Board ID
     * @param {string} category - Category to generate notes for
     * @returns {Promise<object>} Generated notes
     */
    async requestNotes(boardId, category) {
        if (!boardId) {
            throw new ValidationError('BOARD_ID_REQUIRED');
        }
        if (!category) {
            throw new ValidationError('CATEGORY_REQUIRED');
        }
        return this.http.request(API_ENDPOINTS.BRAINSTORM_AI(boardId, category), {
            method: 'POST',
            data: {}
        });
    }

    /**
     * Request AI-generated title suggestion
     * @param {string} boardId - Board ID
     * @returns {Promise<object>} Generated title suggestion
     */
    async requestTitle(boardId) {
        if (!boardId) {
            throw new ValidationError('BOARD_ID_REQUIRED');
        }
        return this.http.request(API_ENDPOINTS.BRAINSTORM_AI(boardId, 'title'), {
            method: 'POST',
            data: {}
        });
    }
}
