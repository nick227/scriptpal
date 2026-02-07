import { API_ENDPOINTS } from '../../constants.js';
import { HttpClient } from './HttpClient.js';
import { ValidationError } from './APIError.js';

/**
 * Service for script entities: scenes, characters, locations, themes
 */
export class ScriptEntitiesService {
    /**
     * @param {HttpClient} httpClient - Shared HTTP client instance
     */
    constructor(httpClient) {
        this.http = httpClient;
    }

    /**
     * Build endpoint path for script items
     * @private
     */
    _buildPath(scriptId, segment, itemId = null) {
        const base = `${API_ENDPOINTS.SCRIPT}/${scriptId}/${segment}`;
        return itemId ? `${base}/${itemId}` : base;
    }

    /**
     * Validate script ID is provided
     * @private
     */
    _requireScriptId(scriptId) {
        if (!scriptId) {
            throw new ValidationError('SCRIPT_ID_REQUIRED');
        }
    }

    /**
     * Validate both script ID and item ID are provided
     * @private
     */
    _requireIds(scriptId, itemId, itemName) {
        if (!scriptId || !itemId) {
            throw new ValidationError('ITEM_ID_REQUIRED', { 
                message: `Script ID and ${itemName} ID are required` 
            });
        }
    }

    // ==================== SCENES ====================

    /**
     * Get all scenes for a script
     * @param {string} scriptId - Script ID
     * @returns {Promise<object[]>} Array of scene objects
     */
    async getScenes(scriptId) {
        this._requireScriptId(scriptId);
        return this.http.request(this._buildPath(scriptId, 'scenes'), { method: 'GET' });
    }

    /**
     * Create a new scene
     * @param {string} scriptId - Script ID
     * @param {object} sceneData - Scene data
     * @returns {Promise<object>} Created scene object
     */
    async createScene(scriptId, sceneData) {
        this._requireScriptId(scriptId);
        return this.http.request(this._buildPath(scriptId, 'scenes'), {
            method: 'POST',
            data: sceneData
        });
    }

    /**
     * Update a scene
     * @param {string} scriptId - Script ID
     * @param {string} sceneId - Scene ID
     * @param {object} sceneData - Scene data to update
     * @returns {Promise<object>} Updated scene object
     */
    async updateScene(scriptId, sceneId, sceneData) {
        this._requireIds(scriptId, sceneId, 'scene');
        return this.http.request(this._buildPath(scriptId, 'scenes', sceneId), {
            method: 'PUT',
            data: sceneData
        });
    }

    /**
     * Delete a scene
     * @param {string} scriptId - Script ID
     * @param {string} sceneId - Scene ID
     * @returns {Promise<void>}
     */
    async deleteScene(scriptId, sceneId) {
        this._requireIds(scriptId, sceneId, 'scene');
        return this.http.request(this._buildPath(scriptId, 'scenes', sceneId), { method: 'DELETE' });
    }

    /**
     * Reorder scenes
     * @param {string} scriptId - Script ID
     * @param {string[]} order - Array of scene IDs in new order
     * @returns {Promise<void>}
     */
    async reorderScenes(scriptId, order) {
        this._requireScriptId(scriptId);
        return this.http.request(`${this._buildPath(scriptId, 'scenes')}/reorder`, {
            method: 'PUT',
            data: { order }
        });
    }

    /**
     * Generate AI scene idea for existing scene
     * @param {string} scriptId - Script ID
     * @param {string} sceneId - Scene ID
     * @param {object} payload - Generation parameters
     * @returns {Promise<object>} Generated idea
     */
    async generateSceneIdea(scriptId, sceneId, payload = {}) {
        this._requireIds(scriptId, sceneId, 'scene');
        return this.http.request(`${this._buildPath(scriptId, 'scenes', sceneId)}/ai/scene-idea`, {
            method: 'POST',
            data: payload
        });
    }

    /**
     * Generate AI scene idea for new scene draft
     * @param {string} scriptId - Script ID
     * @param {object} payload - Generation parameters
     * @returns {Promise<object>} Generated idea
     */
    async generateSceneIdeaDraft(scriptId, payload = {}) {
        this._requireScriptId(scriptId);
        return this.http.request(`${this._buildPath(scriptId, 'scenes')}/ai/scene-idea`, {
            method: 'POST',
            data: payload
        });
    }

    // ==================== CHARACTERS ====================

    /**
     * Get all characters for a script
     * @param {string} scriptId - Script ID
     * @returns {Promise<object[]>} Array of character objects
     */
    async getCharacters(scriptId) {
        this._requireScriptId(scriptId);
        return this.http.request(this._buildPath(scriptId, 'characters'), { method: 'GET' });
    }

    /**
     * Create a new character
     * @param {string} scriptId - Script ID
     * @param {object} characterData - Character data
     * @returns {Promise<object>} Created character object
     */
    async createCharacter(scriptId, characterData) {
        this._requireScriptId(scriptId);
        return this.http.request(this._buildPath(scriptId, 'characters'), {
            method: 'POST',
            data: characterData
        });
    }

    /**
     * Update a character
     * @param {string} scriptId - Script ID
     * @param {string} characterId - Character ID
     * @param {object} characterData - Character data to update
     * @returns {Promise<object>} Updated character object
     */
    async updateCharacter(scriptId, characterId, characterData) {
        this._requireIds(scriptId, characterId, 'character');
        return this.http.request(this._buildPath(scriptId, 'characters', characterId), {
            method: 'PUT',
            data: characterData
        });
    }

    /**
     * Delete a character
     * @param {string} scriptId - Script ID
     * @param {string} characterId - Character ID
     * @returns {Promise<void>}
     */
    async deleteCharacter(scriptId, characterId) {
        this._requireIds(scriptId, characterId, 'character');
        return this.http.request(this._buildPath(scriptId, 'characters', characterId), { method: 'DELETE' });
    }

    /**
     * Reorder characters
     * @param {string} scriptId - Script ID
     * @param {string[]} order - Array of character IDs in new order
     * @returns {Promise<void>}
     */
    async reorderCharacters(scriptId, order) {
        this._requireScriptId(scriptId);
        return this.http.request(`${this._buildPath(scriptId, 'characters')}/reorder`, {
            method: 'PUT',
            data: { order }
        });
    }

    /**
     * Generate AI character idea for existing character
     * @param {string} scriptId - Script ID
     * @param {string} characterId - Character ID
     * @param {object} payload - Generation parameters
     * @returns {Promise<object>} Generated idea
     */
    async generateCharacterIdea(scriptId, characterId, payload = {}) {
        this._requireIds(scriptId, characterId, 'character');
        return this.http.request(`${this._buildPath(scriptId, 'characters', characterId)}/ai/character-idea`, {
            method: 'POST',
            data: payload
        });
    }

    /**
     * Generate AI character idea for new character draft
     * @param {string} scriptId - Script ID
     * @param {object} payload - Generation parameters
     * @returns {Promise<object>} Generated idea
     */
    async generateCharacterIdeaDraft(scriptId, payload = {}) {
        this._requireScriptId(scriptId);
        return this.http.request(`${this._buildPath(scriptId, 'characters')}/ai/character-idea`, {
            method: 'POST',
            data: payload
        });
    }

    // ==================== LOCATIONS ====================

    /**
     * Get all locations for a script
     * @param {string} scriptId - Script ID
     * @returns {Promise<object[]>} Array of location objects
     */
    async getLocations(scriptId) {
        this._requireScriptId(scriptId);
        return this.http.request(this._buildPath(scriptId, 'locations'), { method: 'GET' });
    }

    /**
     * Create a new location
     * @param {string} scriptId - Script ID
     * @param {object} locationData - Location data
     * @returns {Promise<object>} Created location object
     */
    async createLocation(scriptId, locationData) {
        this._requireScriptId(scriptId);
        return this.http.request(this._buildPath(scriptId, 'locations'), {
            method: 'POST',
            data: locationData
        });
    }

    /**
     * Update a location
     * @param {string} scriptId - Script ID
     * @param {string} locationId - Location ID
     * @param {object} locationData - Location data to update
     * @returns {Promise<object>} Updated location object
     */
    async updateLocation(scriptId, locationId, locationData) {
        this._requireIds(scriptId, locationId, 'location');
        return this.http.request(this._buildPath(scriptId, 'locations', locationId), {
            method: 'PUT',
            data: locationData
        });
    }

    /**
     * Delete a location
     * @param {string} scriptId - Script ID
     * @param {string} locationId - Location ID
     * @returns {Promise<void>}
     */
    async deleteLocation(scriptId, locationId) {
        this._requireIds(scriptId, locationId, 'location');
        return this.http.request(this._buildPath(scriptId, 'locations', locationId), { method: 'DELETE' });
    }

    /**
     * Reorder locations
     * @param {string} scriptId - Script ID
     * @param {string[]} order - Array of location IDs in new order
     * @returns {Promise<void>}
     */
    async reorderLocations(scriptId, order) {
        this._requireScriptId(scriptId);
        return this.http.request(`${this._buildPath(scriptId, 'locations')}/reorder`, {
            method: 'PUT',
            data: { order }
        });
    }

    /**
     * Generate AI location idea for existing location
     * @param {string} scriptId - Script ID
     * @param {string} locationId - Location ID
     * @param {object} payload - Generation parameters
     * @returns {Promise<object>} Generated idea
     */
    async generateLocationIdea(scriptId, locationId, payload = {}) {
        this._requireIds(scriptId, locationId, 'location');
        return this.http.request(`${this._buildPath(scriptId, 'locations', locationId)}/ai/location-idea`, {
            method: 'POST',
            data: payload
        });
    }

    /**
     * Generate AI location idea for new location draft
     * @param {string} scriptId - Script ID
     * @param {object} payload - Generation parameters
     * @returns {Promise<object>} Generated idea
     */
    async generateLocationIdeaDraft(scriptId, payload = {}) {
        this._requireScriptId(scriptId);
        return this.http.request(`${this._buildPath(scriptId, 'locations')}/ai/location-idea`, {
            method: 'POST',
            data: payload
        });
    }

    // ==================== OUTLINES ====================

    async getOutlines(scriptId) {
        this._requireScriptId(scriptId);
        return this.http.request(this._buildPath(scriptId, 'outlines'), { method: 'GET' });
    }

    async createOutline(scriptId, outlineData) {
        this._requireScriptId(scriptId);
        return this.http.request(this._buildPath(scriptId, 'outlines'), {
            method: 'POST',
            data: outlineData
        });
    }

    async updateOutline(scriptId, outlineId, outlineData) {
        this._requireIds(scriptId, outlineId, 'outline');
        return this.http.request(this._buildPath(scriptId, 'outlines', outlineId), {
            method: 'PUT',
            data: outlineData
        });
    }

    async deleteOutline(scriptId, outlineId) {
        this._requireIds(scriptId, outlineId, 'outline');
        return this.http.request(this._buildPath(scriptId, 'outlines', outlineId), { method: 'DELETE' });
    }

    async reorderOutlines(scriptId, order) {
        this._requireScriptId(scriptId);
        return this.http.request(`${this._buildPath(scriptId, 'outlines')}/reorder`, {
            method: 'PUT',
            data: { order }
        });
    }

    async generateOutlineIdea(scriptId, outlineId, payload = {}) {
        this._requireIds(scriptId, outlineId, 'outline');
        return this.http.request(`${this._buildPath(scriptId, 'outlines', outlineId)}/ai/outline-idea`, {
            method: 'POST',
            data: payload
        });
    }

    async generateOutlineIdeaDraft(scriptId, payload = {}) {
        this._requireScriptId(scriptId);
        return this.http.request(`${this._buildPath(scriptId, 'outlines')}/ai/outline-idea`, {
            method: 'POST',
            data: payload
        });
    }

    // ==================== THEMES ====================

    /**
     * Get all themes for a script
     * @param {string} scriptId - Script ID
     * @returns {Promise<object[]>} Array of theme objects
     */
    async getThemes(scriptId) {
        this._requireScriptId(scriptId);
        return this.http.request(this._buildPath(scriptId, 'themes'), { method: 'GET' });
    }

    /**
     * Create a new theme
     * @param {string} scriptId - Script ID
     * @param {object} themeData - Theme data
     * @returns {Promise<object>} Created theme object
     */
    async createTheme(scriptId, themeData) {
        this._requireScriptId(scriptId);
        return this.http.request(this._buildPath(scriptId, 'themes'), {
            method: 'POST',
            data: themeData
        });
    }

    /**
     * Update a theme
     * @param {string} scriptId - Script ID
     * @param {string} themeId - Theme ID
     * @param {object} themeData - Theme data to update
     * @returns {Promise<object>} Updated theme object
     */
    async updateTheme(scriptId, themeId, themeData) {
        this._requireIds(scriptId, themeId, 'theme');
        return this.http.request(this._buildPath(scriptId, 'themes', themeId), {
            method: 'PUT',
            data: themeData
        });
    }

    /**
     * Delete a theme
     * @param {string} scriptId - Script ID
     * @param {string} themeId - Theme ID
     * @returns {Promise<void>}
     */
    async deleteTheme(scriptId, themeId) {
        this._requireIds(scriptId, themeId, 'theme');
        return this.http.request(this._buildPath(scriptId, 'themes', themeId), { method: 'DELETE' });
    }

    /**
     * Reorder themes
     * @param {string} scriptId - Script ID
     * @param {string[]} order - Array of theme IDs in new order
     * @returns {Promise<void>}
     */
    async reorderThemes(scriptId, order) {
        this._requireScriptId(scriptId);
        return this.http.request(`${this._buildPath(scriptId, 'themes')}/reorder`, {
            method: 'PUT',
            data: { order }
        });
    }

    /**
     * Generate AI theme idea for existing theme
     * @param {string} scriptId - Script ID
     * @param {string} themeId - Theme ID
     * @param {object} payload - Generation parameters
     * @returns {Promise<object>} Generated idea
     */
    async generateThemeIdea(scriptId, themeId, payload = {}) {
        this._requireIds(scriptId, themeId, 'theme');
        return this.http.request(`${this._buildPath(scriptId, 'themes', themeId)}/ai/theme-idea`, {
            method: 'POST',
            data: payload
        });
    }

    /**
     * Generate AI theme idea for new theme draft
     * @param {string} scriptId - Script ID
     * @param {object} payload - Generation parameters
     * @returns {Promise<object>} Generated idea
     */
    async generateThemeIdeaDraft(scriptId, payload = {}) {
        this._requireScriptId(scriptId);
        return this.http.request(`${this._buildPath(scriptId, 'themes')}/ai/theme-idea`, {
            method: 'POST',
            data: payload
        });
    }
}
