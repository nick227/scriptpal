/**
 * ScriptPalAPI - Facade providing backwards-compatible access to API services
 *
 * This class delegates to focused service classes for clean separation of concerns.
 *
 * @example
 * // Legacy usage (deprecated - will be removed in v2.0)
 * const api = new ScriptPalAPI();
 * await api.login(email, password);
 * await api.getScript(id);
 *
 * @example
 * // Recommended usage - access services directly
 * const api = new ScriptPalAPI();
 * await api.auth.login(email, password);
 * await api.scripts.getScript(id);
 * await api.chat.getChatResponse(content, { scriptId, scriptTitle });
 *
 * @property {HttpClient} http - Shared HTTP client
 * @property {AuthService} auth - Authentication and session management
 * @property {UserService} users - User CRUD operations
 * @property {ScriptService} scripts - Script CRUD operations
 * @property {ChatService} chat - AI chat and message history
 * @property {MediaService} media - Media upload and generation
 * @property {BrainstormService} brainstorm - Brainstorming boards
 * @property {ScriptEntitiesService} entities - Scenes, characters, locations, themes
 * @property {PublicScriptService} publicScripts - Public script access
 */

import { debugLog } from '../../core/logger.js';

import { AuthService } from './AuthService.js';
import { BrainstormService } from './BrainstormService.js';
import { ChatService } from './ChatService.js';
import { HttpClient } from './HttpClient.js';
import { MediaService } from './MediaService.js';
import { PublicScriptService } from './PublicScriptService.js';
import { ScriptEntitiesService } from './ScriptEntitiesService.js';
import { ScriptService } from './ScriptService.js';
import { UserService } from './UserService.js';

// Re-export error types for consumers
export {
    APIError,
    ValidationError,
    NetworkError,
    TimeoutError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError
} from './APIError.js';

/**
 * Unified API client facade
 */
export class ScriptPalAPI {
    /** @type {HttpClient} */
    http;
    /** @type {AuthService} */
    auth;
    /** @type {UserService} */
    users;
    /** @type {ScriptService} */
    scripts;
    /** @type {ChatService} */
    chat;
    /** @type {MediaService} */
    media;
    /** @type {BrainstormService} */
    brainstorm;
    /** @type {ScriptEntitiesService} */
    entities;
    /** @type {PublicScriptService} */
    publicScripts;

    constructor () {
        // Shared HTTP client
        this.http = new HttpClient();

        // Initialize services
        this.auth = new AuthService(this.http);
        this.users = new UserService(this.http);
        this.scripts = new ScriptService(this.http);
        this.chat = new ChatService(this.http);
        this.media = new MediaService(this.http);
        this.brainstorm = new BrainstormService(this.http);
        this.entities = new ScriptEntitiesService(this.http);
        this.publicScripts = new PublicScriptService(this.http);

        debugLog('[API] Initialized with service-based architecture');
    }

    /**
     * Base API origin (legacy consumers expect this property)
     */
    get baseUrl () {
        return this.http?.baseUrl || '';
    }

    async getChatResponse (content, context = {}) {
        return this.chat.getChatResponse(content, context);
    }

    async triggerSystemPrompt (promptType, scriptId = null, context = {}) {
        return this.chat.triggerSystemPrompt(promptType, scriptId, context);
    }

    async getChatMessages (scriptId, limit, offset) {
        return this.chat.getChatMessages(scriptId, limit, offset);
    }

    async clearChatMessages (scriptId) {
        return this.chat.clearChatMessages(scriptId);
    }

    async getOwnerMedia (ownerType, ownerId, role) {
        return this.media.getOwnerMedia(ownerType, ownerId, role);
    }

    async listMedia (params = {}) {
        return this.media.listMedia(params);
    }

    async uploadMedia (file, type) {
        return this.media.uploadMedia(file, type);
    }

    async generateMedia (payload) {
        return this.media.generateMedia(payload);
    }

    async getMediaJob (jobId) {
        return this.media.getMediaJob(jobId);
    }

    async attachMedia (assetId, payload) {
        return this.media.attachMedia(assetId, payload);
    }

    async getPublicScripts (options = {}) {
        return this.publicScripts.getPublicScripts(options);
    }

    async getTokenWatch () {
        return this.auth.getTokenWatch();
    }

    /**
     * Check if any requests are pending
     * @returns {boolean}
     */
    get isLoading () {
        return this.http.getPendingCount() > 0;
    }

    // ==================== REQUEST MANAGEMENT ====================

    /**
     * Cancel a specific request by correlation ID
     * @param {string} correlationId - Correlation ID of request to cancel
     */
    cancelRequest (correlationId) {
        this.http.cancelRequest(correlationId);
    }

    /**
     * Cancel all pending requests
     */
    cancelAllRequests () {
        this.http.cancelAllRequests();
    }

    /**
     * Get request statistics
     * @returns {{ pendingRequests: number, isLoading: boolean }}
     */
    getStats () {
        return {
            pendingRequests: this.http.getPendingCount(),
            isLoading: this.isLoading
        };
    }

    /**
     * Clean up all resources and cancel pending requests
     */
    destroy () {
        // Cancel all pending HTTP requests
        this.http.cancelAllRequests();

        // Destroy services that have cleanup
        const services = [this.auth];
        for (const service of services) {
            if (typeof service?.destroy === 'function') {
                service.destroy();
            }
        }
    }
}
