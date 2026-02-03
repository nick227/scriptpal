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
     * Check if any requests are pending
     * @returns {boolean}
     */
    get isLoading () {
        return this.http.getPendingCount() > 0;
    }

    // ==================== AUTH METHODS ====================

    /**
     * @deprecated Removed in v2.0. Use api.auth.login() instead.
     * @example await api.auth.login(email, password)
     */
    async login (email, password) {
        return this.auth.login(email, password);
    }

    /**
     * @deprecated Removed in v2.0. Use api.auth.logout() instead.
     * @example await api.auth.logout()
     */
    async logout () {
        return this.auth.logout();
    }

    /**
     * @deprecated Removed in v2.0. Use api.auth.getCurrentUser() instead.
     * @example await api.auth.getCurrentUser()
     */
    async getCurrentUser () {
        return this.auth.getCurrentUser();
    }

    /**
     * @deprecated Removed in v2.0. Use api.auth.getTokenWatch() instead.
     * @example await api.auth.getTokenWatch()
     */
    async getTokenWatch () {
        return this.auth.getTokenWatch();
    }

    // ==================== USER METHODS ====================

    /**
     * @deprecated Removed in v2.0. Use api.users.getUser() instead.
     * @example await api.users.getUser(id)
     */
    async getUser (id) {
        return this.users.getUser(id);
    }

    /**
     * @deprecated Removed in v2.0. Use api.users.createUser() instead.
     * @example await api.users.createUser(userData)
     */
    async createUser (userData) {
        return this.users.createUser(userData);
    }

    // ==================== SCRIPT METHODS ====================

    /**
     * @deprecated Removed in v2.0. Use api.scripts.getScript() instead.
     * @example await api.scripts.getScript(id)
     */
    async getScript (id) {
        return this.scripts.getScript(id);
    }

    /**
     * @deprecated Removed in v2.0. Use api.scripts.createScript() instead.
     * @example await api.scripts.createScript(scriptData)
     */
    async createScript (scriptData) {
        return this.scripts.createScript(scriptData);
    }

    /**
     * @deprecated Removed in v2.0. Use api.scripts.updateScript() and pass title explicitly.
     * localStorage auto-fallback will be removed in v2.0.
     * @example await api.scripts.updateScript(id, { title, content })
     */
    async updateScript (id, scriptData) {
        // Backwards compatibility: localStorage fallback (removed in v2.0)
        if (!scriptData.title && typeof localStorage !== 'undefined') {
            const fallbackTitle = localStorage.getItem('currentScriptTitle');
            if (fallbackTitle) {
                console.warn('[API] updateScript: localStorage title fallback is deprecated. Pass title explicitly.');
                scriptData = { ...scriptData, title: fallbackTitle };
            }
        }
        return this.scripts.updateScript(id, scriptData);
    }

    /**
     * @deprecated Removed in v2.0. Use api.scripts.deleteScript() instead.
     * @example await api.scripts.deleteScript(id)
     */
    async deleteScript (id) {
        return this.scripts.deleteScript(id);
    }

    /**
     * @deprecated Removed in v2.0. Use api.scripts.getAllScriptsByUser() instead.
     * @example await api.scripts.getAllScriptsByUser(userId)
     */
    async getAllScriptsByUser (userId) {
        return this.scripts.getAllScriptsByUser(userId);
    }

    /**
     * @deprecated Removed in v2.0. Use api.scripts.getScriptBySlug() instead.
     * @example await api.scripts.getScriptBySlug(slug)
     */
    async getScriptBySlug (slug) {
        return this.scripts.getScriptBySlug(slug);
    }

    /**
     * @deprecated Removed in v2.0. Use api.scripts.requestNextLines() instead.
     * @example await api.scripts.requestNextLines(scriptId, context)
     */
    async requestNextLines (scriptId, context = {}) {
        return this.scripts.requestNextLines(scriptId, context);
    }

    // ==================== CHAT METHODS ====================

    /**
     * @deprecated Removed in v2.0. Use api.chat.getChatResponse() and pass context explicitly.
     * localStorage auto-context will be removed in v2.0.
     * @example await api.chat.getChatResponse(content, { scriptId, scriptTitle, scriptVersion })
     */
    async getChatResponse (content, context = {}) {
        // Backwards compatibility: localStorage context (removed in v2.0)
        const needsLocalStorage = !context.scriptId && typeof localStorage !== 'undefined';
        if (needsLocalStorage) {
            const scriptId = localStorage.getItem('currentScriptId');
            if (scriptId) {
                console.warn('[API] getChatResponse: localStorage context is deprecated. Pass context explicitly.');
                context = {
                    scriptId,
                    scriptTitle: context.scriptTitle || localStorage.getItem('currentScriptTitle'),
                    scriptVersion: context.scriptVersion || localStorage.getItem('currentScriptVersion'),
                    ...context
                };
            }
        }
        return this.chat.getChatResponse(content, context);
    }

    /**
     * @deprecated Removed in v2.0. Use api.chat.triggerSystemPrompt() instead.
     * @example await api.chat.triggerSystemPrompt(promptType, scriptId, context)
     */
    async triggerSystemPrompt (promptType, scriptId = null, context = {}) {
        return this.chat.triggerSystemPrompt(promptType, scriptId, context);
    }

    /**
     * @deprecated Removed in v2.0. Use api.chat.getChatMessages() instead.
     * @example await api.chat.getChatMessages(scriptId, limit, offset)
     */
    async getChatMessages (scriptId = null, limit = 30, offset = 0) {
        return this.chat.getChatMessages(scriptId, limit, offset);
    }

    /**
     * @deprecated Removed in v2.0. Use api.chat.addChatMessage() instead.
     * @example await api.chat.addChatMessage(scriptId, message)
     */
    async addChatMessage (scriptId, message) {
        return this.chat.addChatMessage(scriptId, message);
    }

    /**
     * @deprecated Removed in v2.0. Use api.chat.clearChatMessages() instead.
     * @example await api.chat.clearChatMessages(scriptId)
     */
    async clearChatMessages (scriptId) {
        return this.chat.clearChatMessages(scriptId);
    }

    // ==================== MEDIA METHODS ====================

    /** @deprecated Removed in v2.0. Use api.media.uploadMedia() instead. */
    async uploadMedia (file, type) {
        return this.media.uploadMedia(file, type);
    }

    /** @deprecated Removed in v2.0. Use api.media.generateMedia() instead. */
    async generateMedia (payload) {
        return this.media.generateMedia(payload);
    }

    /** @deprecated Removed in v2.0. Use api.media.listMedia() instead. */
    async listMedia (params = {}) {
        return this.media.listMedia(params);
    }

    /** @deprecated Removed in v2.0. Use api.media.attachMedia() instead. */
    async attachMedia (assetId, payload) {
        return this.media.attachMedia(assetId, payload);
    }

    /** @deprecated Removed in v2.0. Use api.media.getMediaJob() instead. */
    async getMediaJob (jobId) {
        return this.media.getMediaJob(jobId);
    }

    /** @deprecated Removed in v2.0. Use api.media.getOwnerMedia() instead. */
    async getOwnerMedia (ownerType, ownerId, role) {
        return this.media.getOwnerMedia(ownerType, ownerId, role);
    }

    // ==================== BRAINSTORM METHODS ====================

    /** @deprecated Removed in v2.0. Use api.brainstorm.listBoards() instead. */
    async listBrainstormBoards () {
        return this.brainstorm.listBoards();
    }

    /** @deprecated Removed in v2.0. Use api.brainstorm.getBoard() instead. */
    async getBrainstormBoard (boardId) {
        return this.brainstorm.getBoard(boardId);
    }

    /** @deprecated Removed in v2.0. Use api.brainstorm.createBoard() instead. */
    async createBrainstormBoard ({ title, seed, notes }) {
        return this.brainstorm.createBoard({ title, seed, notes });
    }

    /** @deprecated Removed in v2.0. Use api.brainstorm.updateBoard() instead. */
    async updateBrainstormBoard (boardId, { title, seed, notes }) {
        return this.brainstorm.updateBoard(boardId, { title, seed, notes });
    }

    /** @deprecated Removed in v2.0. Use api.brainstorm.deleteBoard() instead. */
    async deleteBrainstormBoard (boardId) {
        return this.brainstorm.deleteBoard(boardId);
    }

    /** @deprecated Removed in v2.0. Use api.brainstorm.requestNotes() instead. */
    async requestBrainstormNotes (boardId, category) {
        return this.brainstorm.requestNotes(boardId, category);
    }

    /** @deprecated Removed in v2.0. Use api.brainstorm.requestTitle() instead. */
    async requestBrainstormTitle (boardId) {
        return this.brainstorm.requestTitle(boardId);
    }

    // ==================== SCENE METHODS ====================

    /** @deprecated Removed in v2.0. Use api.entities.getScenes() instead. */
    async getScenes (scriptId) {
        return this.entities.getScenes(scriptId);
    }

    /** @deprecated Removed in v2.0. Use api.entities.createScene() instead. */
    async createScene (scriptId, sceneData) {
        return this.entities.createScene(scriptId, sceneData);
    }

    /** @deprecated Removed in v2.0. Use api.entities.updateScene() instead. */
    async updateScene (scriptId, sceneId, sceneData) {
        return this.entities.updateScene(scriptId, sceneId, sceneData);
    }

    /** @deprecated Removed in v2.0. Use api.entities.deleteScene() instead. */
    async deleteScene (scriptId, sceneId) {
        return this.entities.deleteScene(scriptId, sceneId);
    }

    /** @deprecated Removed in v2.0. Use api.entities.reorderScenes() instead. */
    async reorderScenes (scriptId, order) {
        return this.entities.reorderScenes(scriptId, order);
    }

    /** @deprecated Removed in v2.0. Use api.entities.generateSceneIdea() instead. */
    async generateSceneIdea (scriptId, sceneId, payload = {}) {
        return this.entities.generateSceneIdea(scriptId, sceneId, payload);
    }

    /** @deprecated Removed in v2.0. Use api.entities.generateSceneIdeaDraft() instead. */
    async generateSceneIdeaDraft (scriptId, payload = {}) {
        return this.entities.generateSceneIdeaDraft(scriptId, payload);
    }

    // ==================== CHARACTER METHODS ====================

    /** @deprecated Removed in v2.0. Use api.entities.getCharacters() instead. */
    async getCharacters (scriptId) {
        return this.entities.getCharacters(scriptId);
    }

    /** @deprecated Removed in v2.0. Use api.entities.createCharacter() instead. */
    async createCharacter (scriptId, characterData) {
        return this.entities.createCharacter(scriptId, characterData);
    }

    /** @deprecated Removed in v2.0. Use api.entities.updateCharacter() instead. */
    async updateCharacter (scriptId, characterId, characterData) {
        return this.entities.updateCharacter(scriptId, characterId, characterData);
    }

    /** @deprecated Removed in v2.0. Use api.entities.deleteCharacter() instead. */
    async deleteCharacter (scriptId, characterId) {
        return this.entities.deleteCharacter(scriptId, characterId);
    }

    /** @deprecated Removed in v2.0. Use api.entities.reorderCharacters() instead. */
    async reorderCharacters (scriptId, order) {
        return this.entities.reorderCharacters(scriptId, order);
    }

    /** @deprecated Removed in v2.0. Use api.entities.generateCharacterIdea() instead. */
    async generateCharacterIdea (scriptId, characterId, payload = {}) {
        return this.entities.generateCharacterIdea(scriptId, characterId, payload);
    }

    /** @deprecated Removed in v2.0. Use api.entities.generateCharacterIdeaDraft() instead. */
    async generateCharacterIdeaDraft (scriptId, payload = {}) {
        return this.entities.generateCharacterIdeaDraft(scriptId, payload);
    }

    // ==================== LOCATION METHODS ====================

    /** @deprecated Removed in v2.0. Use api.entities.getLocations() instead. */
    async getLocations (scriptId) {
        return this.entities.getLocations(scriptId);
    }

    /** @deprecated Removed in v2.0. Use api.entities.createLocation() instead. */
    async createLocation (scriptId, locationData) {
        return this.entities.createLocation(scriptId, locationData);
    }

    /** @deprecated Removed in v2.0. Use api.entities.updateLocation() instead. */
    async updateLocation (scriptId, locationId, locationData) {
        return this.entities.updateLocation(scriptId, locationId, locationData);
    }

    /** @deprecated Removed in v2.0. Use api.entities.deleteLocation() instead. */
    async deleteLocation (scriptId, locationId) {
        return this.entities.deleteLocation(scriptId, locationId);
    }

    /** @deprecated Removed in v2.0. Use api.entities.reorderLocations() instead. */
    async reorderLocations (scriptId, order) {
        return this.entities.reorderLocations(scriptId, order);
    }

    /** @deprecated Removed in v2.0. Use api.entities.generateLocationIdea() instead. */
    async generateLocationIdea (scriptId, locationId, payload = {}) {
        return this.entities.generateLocationIdea(scriptId, locationId, payload);
    }

    /** @deprecated Removed in v2.0. Use api.entities.generateLocationIdeaDraft() instead. */
    async generateLocationIdeaDraft (scriptId, payload = {}) {
        return this.entities.generateLocationIdeaDraft(scriptId, payload);
    }

    // ==================== THEME METHODS ====================

    /** @deprecated Removed in v2.0. Use api.entities.getThemes() instead. */
    async getThemes (scriptId) {
        return this.entities.getThemes(scriptId);
    }

    /** @deprecated Removed in v2.0. Use api.entities.createTheme() instead. */
    async createTheme (scriptId, themeData) {
        return this.entities.createTheme(scriptId, themeData);
    }

    /** @deprecated Removed in v2.0. Use api.entities.updateTheme() instead. */
    async updateTheme (scriptId, themeId, themeData) {
        return this.entities.updateTheme(scriptId, themeId, themeData);
    }

    /** @deprecated Removed in v2.0. Use api.entities.deleteTheme() instead. */
    async deleteTheme (scriptId, themeId) {
        return this.entities.deleteTheme(scriptId, themeId);
    }

    /** @deprecated Removed in v2.0. Use api.entities.reorderThemes() instead. */
    async reorderThemes (scriptId, order) {
        return this.entities.reorderThemes(scriptId, order);
    }

    /** @deprecated Removed in v2.0. Use api.entities.generateThemeIdea() instead. */
    async generateThemeIdea (scriptId, themeId, payload = {}) {
        return this.entities.generateThemeIdea(scriptId, themeId, payload);
    }

    /** @deprecated Removed in v2.0. Use api.entities.generateThemeIdeaDraft() instead. */
    async generateThemeIdeaDraft (scriptId, payload = {}) {
        return this.entities.generateThemeIdeaDraft(scriptId, payload);
    }

    // ==================== PUBLIC SCRIPT METHODS ====================

    /** @deprecated Removed in v2.0. Use api.publicScripts.getPublicScripts() instead. */
    async getPublicScripts (options = {}) {
        return this.publicScripts.getPublicScripts(options);
    }

    /** @deprecated Removed in v2.0. Use api.publicScripts.getPublicScript() instead. */
    async getPublicScript (id) {
        return this.publicScripts.getPublicScript(id);
    }

    /** @deprecated Removed in v2.0. Use api.publicScripts.getPublicScriptBySlug() instead. */
    async getPublicScriptBySlug (slug) {
        return this.publicScripts.getPublicScriptBySlug(slug);
    }

    /** @deprecated Removed in v2.0. Use api.publicScripts.getComments() instead. */
    async getPublicScriptComments (scriptId, options = {}) {
        return this.publicScripts.getComments(scriptId, options);
    }

    /** @deprecated Removed in v2.0. Use api.publicScripts.addComment() instead. */
    async addPublicScriptComment (scriptId, content) {
        return this.publicScripts.addComment(scriptId, content);
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

    // ==================== LEGACY COMPATIBILITY ====================

    /**
     * @deprecated Token handling removed - using cookies instead. No-op.
     */
    setToken () {
        debugLog('[API] Token method called but using cookies');
    }

    /**
     * @deprecated Token handling removed - using cookies instead. Always returns null.
     * @returns {null}
     */
    getToken () {
        return null;
    }
}
