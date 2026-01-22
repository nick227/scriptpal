import { BaseManager } from '../core/BaseManager.js';
import { EventManager } from '../core/EventManager.js';
import { StateManager } from '../core/StateManager.js';
import { debugLog } from '../core/logger.js';
import { removeFromStorage } from '../managers/PersistenceManager.js';
import { ScriptFormatter } from '../services/scriptFormatter.js';

/**
 * ScriptStore - single source of truth for script state
 */
export class ScriptStore extends BaseManager {
    /**
     * @param {object} api
     * @param {StateManager} stateManager
     * @param {EventManager} eventManager
     */
    constructor (api, stateManager, eventManager) {
        super(stateManager);
        if (!api) throw new Error('API is required for ScriptStore');
        if (!eventManager) throw new Error('EventManager is required for ScriptStore');

        this.api = api;
        this.eventManager = eventManager;
        this.scripts = [];
        this.currentScriptId = null;
        this.isLoading = false;
        this.formatter = new ScriptFormatter();
        this.patchQueue = new Map();
        this.patchTimers = new Map();
        this.activePatches = new Set();
        this.patchFlushDelay = 5000; // milliseconds
        this.maxPatchRetryDelay = 30000; // milliseconds
    }

    handleAuthError (error) {
        if (!error || error.status !== 401) {
            return;
        }

        this.stateManager.setState(StateManager.KEYS.USER, null);
        this.stateManager.setState(StateManager.KEYS.AUTHENTICATED, false);
        this.clearState();

        this.eventManager.publish(EventManager.EVENTS.AUTH.LOGOUT, {
            reason: error.message || 'Session expired'
        });
    }

    /**
     * Normalize content into a string for persistence
     * @param {string|object} content
     * @returns {string}
     */
    normalizeContent (content) {
        if (typeof content === 'string') {
            return content;
        }
        if (content && typeof content.content === 'string') {
            return content.content;
        }
        return JSON.stringify(content);
    }

    isStructuredContent (content) {
        if (typeof content !== 'string') {
            return false;
        }

        const trimmed = content.trim();
        if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) {
            return false;
        }

        try {
            const parsed = JSON.parse(trimmed);
            return Array.isArray(parsed?.lines) || Array.isArray(parsed);
        } catch (error) {
            return false;
        }
    }

    /**
     * @param {object} script
     * @returns {object}
     */
    standardizeScript (script) {
        if (!script || typeof script !== 'object') {
            return {
                id: 0,
                content: '',
                versionNumber: 1,
                title: 'Invalid Script',
                author: '',
                timestamp: Date.now()
            };
        }

        return {
            ...script,
            content: script.content || '',
            title: script.title || 'UNKNOWN',
            author: script.author || '',
            timestamp: Date.now()
        };
    }

    /**
     * Load scripts for a user
     * @param {number|string} userId
     * @param {object} options
     */
    async loadScripts (userId, options = {}) {
        if (!userId) {
            console.error('[ScriptStore] User ID required to load scripts');
            return [];
        }

        if (this.scripts.length > 0 && !options.force) {
            return this.scripts;
        }

        try {
            this.setLoading(true);
            const scripts = await this.api.getAllScriptsByUser(userId);

            if (!scripts || !Array.isArray(scripts)) {
                this.scripts = [];
                this.stateManager.setState(StateManager.KEYS.SCRIPTS, []);
                return [];
            }

            this.scripts = scripts.map(script => this.standardizeScript(script));
            this.stateManager.setState(StateManager.KEYS.SCRIPTS, this.scripts);

            this.eventManager.publish(EventManager.EVENTS.SCRIPT.LIST_UPDATED, {
                scripts: this.scripts
            });

            return this.scripts;
        } catch (error) {
            console.error('[ScriptStore] Failed to load scripts:', error);
            this.handleAuthError(error);
            this.handleError(error, 'script');
            return [];
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Select and load a script as current
     * @param {number|string} id
     * @param {object} options
     */
    async selectScript (id, options = {}) {
        return await this.loadScript(id, options);
    }

    /**
     * Load a script by id
     * @param {number|string} id
     * @param {object} options
     */
    async loadScript (id, options = {}) {
        if (!id) {
            console.warn('[ScriptStore] Invalid script ID');
            return null;
        }

        try {
            this.setLoading(true);

            const scriptId = String(id);
            const cached = this.scripts.find(script => String(script.id) === scriptId);
            const hasCachedContent = cached && cached.content !== undefined && cached.content !== null;
            const shouldUseCache = hasCachedContent && !options.forceFresh;

            const script = shouldUseCache
                ? cached
                : await this.api.getScript(scriptId);

            if (!script || !script.id) {
                console.warn('[ScriptStore] Invalid script data received');
                return null;
            }

            const standardized = this.standardizeScript(script);
            this.setCurrentScript(standardized, {
                source: options.source || 'selection',
                preserveState: options.preserveState
            });

            const index = this.scripts.findIndex(s => String(s.id) === String(standardized.id));
            if (index === -1) {
                this.scripts.unshift(standardized);
            } else {
                this.scripts[index] = standardized;
            }
            this.stateManager.setState(StateManager.KEYS.SCRIPTS, this.scripts);

            if (options.forceFresh) {
                this.eventManager.publish(EventManager.EVENTS.SCRIPT.CONTENT_UPDATED, {
                    script: standardized,
                    source: options.source || 'refresh',
                    preserveState: options.preserveState,
                    timestamp: Date.now()
                });
            }

            return standardized;
        } catch (error) {
            console.error('[ScriptStore] Failed to load script:', error);
            this.handleAuthError(error);
            this.handleError(error, 'script');
            return null;
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Emit save state events for UI feedback
     * @param {number|string} scriptId
     * @param {string} stateKey
     * @param {object} data
     */
    emitSaveState (scriptId, stateKey, data = {}) {
        const eventName = EventManager.EVENTS.SCRIPT[stateKey];
        if (eventName) {
            this.eventManager.publish(eventName, {
                scriptId,
                ...data
            });
        }
    }

    /**
     * Queue a patch for eventual persistence
     * @param {number|string} scriptId
     * @param {object} patch
     * @param {string} reason
     */
    queuePatch (scriptId, patch = {}, reason = 'patch') {
        if (!scriptId) {
            console.warn('[ScriptStore] Invalid script ID for patch queue');
            return;
        }

        const currentScript = this.getCurrentScript();
        const effectivePatch = { ...patch };
        if (currentScript) {
            if (Object.prototype.hasOwnProperty.call(effectivePatch, 'content')) {
                const currentContent = this.normalizeContent(currentScript.content);
                const nextContent = this.normalizeContent(effectivePatch.content);
                if (currentContent === nextContent) {
                    delete effectivePatch.content;
                }
            }
            if (Object.prototype.hasOwnProperty.call(effectivePatch, 'title')
                && effectivePatch.title === currentScript.title) {
                delete effectivePatch.title;
            }
            if (Object.prototype.hasOwnProperty.call(effectivePatch, 'author')
                && effectivePatch.author === currentScript.author) {
                delete effectivePatch.author;
            }
            if (Object.prototype.hasOwnProperty.call(effectivePatch, 'versionNumber')
                && effectivePatch.versionNumber === currentScript.versionNumber) {
                delete effectivePatch.versionNumber;
            }
        }
        if (Object.keys(effectivePatch).length === 0) {
            return;
        }

        const existing = this.patchQueue.get(scriptId) || { patch: {} };
        existing.patch = {
            ...existing.patch,
            ...effectivePatch
        };
        existing.reason = reason;

        debugLog('[PATCH_QUEUE] queued', { scriptId, patch: existing.patch, reason, timestamp: Date.now() });
        this.patchQueue.set(scriptId, existing);
        this.applyPatchLocally(scriptId, existing.patch);
        this.emitSaveState(scriptId, 'SAVE_DIRTY', { reason });
        this.schedulePatchFlush(scriptId);
    }

    /**
     * Schedule the flush timer for a script patch
     * @param {number|string} scriptId
     */
    schedulePatchFlush (scriptId, delay = this.patchFlushDelay) {
        this.clearPatchTimer(scriptId);
        const timer = setTimeout(() => {
            this.flushPatch(scriptId);
        }, delay);
        this.patchTimers.set(scriptId, timer);
    }

    /**
     * Clear the flush timer for the script
     * @param {number|string} scriptId
     */
    clearPatchTimer (scriptId) {
        const timer = this.patchTimers.get(scriptId);
        if (timer) {
            clearTimeout(timer);
            this.patchTimers.delete(scriptId);
        }
    }

    /**
     * Flush pending patch for a script
     * @param {number|string} scriptId
     */
    async flushPatch (scriptId) {
        const entry = this.patchQueue.get(scriptId);
        if (!entry || this.activePatches.has(scriptId)) {
            return;
        }

        this.clearPatchTimer(scriptId);
        const currentScript = this.getCurrentScript();
        if (!currentScript || String(currentScript.id) !== String(scriptId)) {
            return;
        }

        const payload = {
            title: entry.patch.title ?? currentScript.title,
            author: entry.patch.author ?? currentScript.author,
            content: entry.patch.content ?? currentScript.content ?? '',
            versionNumber: entry.patch.versionNumber ?? currentScript.versionNumber ?? 1
        };

        this.activePatches.add(scriptId);
        this.emitSaveState(scriptId, 'SAVE_SAVING', { reason: entry.reason });

        try {
            await this.updateScript(scriptId, payload);
            entry.retryDelay = null;
            this.emitSaveState(scriptId, 'SAVE_SAVED', { reason: entry.reason });
            this.patchQueue.delete(scriptId);
        } catch (error) {
            this.emitSaveState(scriptId, 'SAVE_ERROR', {
                reason: entry.reason,
                error: error && error.message ? error.message : error
            });
            if (this.isRateLimitError(error)) {
                entry.retryDelay = this.getNextPatchRetryDelay(entry.retryDelay);
            }
        } finally {
            this.activePatches.delete(scriptId);
            if (this.patchQueue.has(scriptId)) {
                this.schedulePatchFlush(scriptId, entry.retryDelay || this.patchFlushDelay);
            }
        }
    }

    /**
     * Apply patch data to local script cache and current script state
     * @param {number|string} scriptId
     * @param {object} patch
     */
    applyPatchLocally (scriptId, patch) {
        if (!scriptId || !patch || typeof patch !== 'object') {
            return;
        }
        const normalizedId = String(scriptId);
        const index = this.scripts.findIndex(script => String(script.id) === normalizedId);
        if (index !== -1) {
            const updatedScript = {
                ...this.scripts[index],
                ...patch
            };
            this.scripts[index] = updatedScript;
            this.stateManager.setState(StateManager.KEYS.SCRIPTS, this.scripts);
        }

        const currentScript = this.getCurrentScript();
        if (currentScript && String(currentScript.id) === normalizedId) {
            const updatedCurrent = {
                ...currentScript,
                ...patch
            };
            this.setCurrentScript(updatedCurrent, { source: 'patch' });
        }
    }

    /**
     * Update a script via API
     * @param {number|string} id
     * @param {object} scriptData
     */
    async updateScript (id, scriptData) {
        if (!id || !scriptData || scriptData.content === null || scriptData.content === undefined) {
            console.warn('[ScriptStore] Invalid update data');
            return null;
        }

        if (!scriptData.versionNumber || typeof scriptData.versionNumber !== 'number') {
            throw new Error('Invalid version number provided');
        }

        try {
            const rawContent = this.normalizeContent(scriptData.content);
            const trimmedContent = typeof rawContent === 'string'
                ? rawContent.trim()
                : '';
            let formattedContent = rawContent;

            if (trimmedContent.length > 0) {
                if (!this.isStructuredContent(trimmedContent)) {
                    formattedContent = this.formatter.format(rawContent);
                    if (!this.formatter.validateFormat(formattedContent)) {
                        throw new Error('Invalid script format');
                    }
                }
            } else {
                formattedContent = '';
            }

            const updateData = {
                title: scriptData.title || 'Unknown Title',
                content: formattedContent,
                versionNumber: scriptData.versionNumber
            };
            if (scriptData.author !== undefined) {
                updateData.author = scriptData.author;
            }

            const updatedScript = await this.api.updateScript(id, updateData);
            if (!updatedScript || !updatedScript.id) {
                throw new Error('Invalid response from API');
            }

            const standardized = this.standardizeScript(updatedScript);
            this.updateScriptInCache(standardized);

            if (String(this.currentScriptId) === String(id)) {
                this.setCurrentScript(standardized, { source: 'update' });
            }

            this.eventManager.publish(EventManager.EVENTS.SCRIPT.UPDATED, {
                script: standardized
            });

            return standardized;
        } catch (error) {
            console.error('[ScriptStore] Update failed:', error);
            this.handleAuthError(error);
            this.handleError(error, 'script');
            throw error;
        }
    }

    isRateLimitError (error) {
        if (!error) {
            return false;
        }
        if (error.status === 429) {
            return true;
        }
        const message = String(error.message || '').toLowerCase();
        return message.includes('too many requests');
    }

    getNextPatchRetryDelay (currentDelay) {
        const baseDelay = currentDelay && currentDelay > 0 ? currentDelay : this.patchFlushDelay;
        return Math.min(baseDelay * 2, this.maxPatchRetryDelay);
    }

    /**
     * Update the current script cache and state without API calls
     * @param {object} script
     */
    updateScriptInCache (script) {
        if (!script || !script.id) {
            return;
        }

        const standardized = this.standardizeScript(script);
        const index = this.scripts.findIndex(s => String(s.id) === String(standardized.id));
        if (index === -1) {
            this.scripts.unshift(standardized);
        } else {
            this.scripts[index] = standardized;
        }
        this.stateManager.setState(StateManager.KEYS.SCRIPTS, this.scripts);
    }

    /**
     * Create a new script
     * @param {number|string} userId
     * @param {object} options
     */
    async createScript (userId, options = {}) {
        const { title = 'Untitled Script', content = '', author } = options;

        let newScript;
        try {
            newScript = await this.api.createScript({
                userId: userId,
                title,
                status: 'draft',
                content,
                author
            });
        } catch (error) {
            this.handleAuthError(error);
            throw error;
        }

        const standardized = this.standardizeScript(newScript);
        this.updateScriptInCache(standardized);
        this.setCurrentScript(standardized, { source: 'create' });

        this.eventManager.publish(EventManager.EVENTS.SCRIPT.CREATED, {
            script: standardized
        });

        return standardized;
    }

    /**
     * Delete a script
     * @param {number|string} id
     */
    async deleteScript (id) {
        if (!id || this.isLoading) {
            console.warn('[ScriptStore] Invalid script ID or already loading:', id);
            return;
        }

        try {
            this.setLoading(true);
            await this.api.deleteScript(id);

            this.scripts = this.scripts.filter(s => String(s.id) !== String(id));
            this.stateManager.setState(StateManager.KEYS.SCRIPTS, this.scripts);

            if (String(this.currentScriptId) === String(id)) {
                this.setCurrentScript(null, { source: 'delete' });
            }

            this.eventManager.publish(EventManager.EVENTS.SCRIPT.DELETED, {
                scriptId: id,
                remainingScripts: this.scripts.length
            });
        } catch (error) {
            console.error('[ScriptStore] Delete failed:', error);
            this.handleError(error, 'script');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Optimistically update a script title locally
     * @param {string|number} id
     * @param {string} title
     */
    updateScriptTitle (id, title) {
        const normalizedId = String(id);
        const index = this.scripts.findIndex(script => String(script.id) === normalizedId);
        if (index === -1) {
            return;
        }

        const updatedScript = {
            ...this.scripts[index],
            title
        };

        this.scripts[index] = updatedScript;
        this.stateManager.setState(StateManager.KEYS.SCRIPTS, this.scripts);

        if (String(this.currentScriptId) === normalizedId) {
            this.setCurrentScript({
                ...this.getCurrentScript(),
                title
            }, { source: 'title' });
        }
    }

    /**
     * Optimistically update a script author locally
     * @param {string|number} id
     * @param {string} author
     */
    updateScriptAuthor (id, author) {
        const normalizedId = String(id);
        const index = this.scripts.findIndex(script => String(script.id) === normalizedId);
        if (index === -1) {
            return;
        }

        const updatedScript = {
            ...this.scripts[index],
            author
        };

        this.scripts[index] = updatedScript;
        this.stateManager.setState(StateManager.KEYS.SCRIPTS, this.scripts);

        if (String(this.currentScriptId) === normalizedId) {
            this.setCurrentScript({
                ...this.getCurrentScript(),
                author
            }, { source: 'title' });
        }
    }

    /**
     * Set the current script and update persistence
     * @param {object|null} script
     * @param {object} options
     */
    setCurrentScript (script, options = {}) {
        if (script && script.id) {
            this.currentScriptId = script.id;
            this.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT_ID, Number(script.id));
            this.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT, script);

            this.eventManager.publish(EventManager.EVENTS.SCRIPT.SELECTED, {
                script,
                source: options.source || 'selection',
                preserveState: options.preserveState
            });
        } else {
            this.currentScriptId = null;
            this.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT_ID, null);
            this.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT, null);
        }
    }

    /**
     * @returns {Array}
     */
    getScripts () {
        return this.scripts;
    }

    /**
     * @returns {object|null}
     */
    getCurrentScript () {
        return this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
    }

    /**
     * @returns {number|null}
     */
    getCurrentScriptId () {
        return this.currentScriptId;
    }

    /**
     * @returns {number|null}
     */
    getStoredCurrentScriptId () {
        const storedId = localStorage.getItem('currentScriptId');
        if (!storedId) {
            return null;
        }
        const parsed = Number(storedId);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }

    clearPersistedScriptSelection () {
        const keys = [
            'currentScriptId',
            'currentScriptState',
            'currentScriptVersion',
            'currentScriptTitle'
        ];
        keys.forEach(key => removeFromStorage(key));
    }

    clearInvalidSelection (scripts = []) {
        const storedId = this.getStoredCurrentScriptId();
        if (!storedId) {
            return false;
        }
        const exists = scripts.some(script => String(script.id) === String(storedId));
        if (!exists) {
            this.clearPersistedScriptSelection();
            return true;
        }
        return false;
    }

    async ensureUserHasScripts (userId) {
        const scripts = await this.loadScripts(userId);
        if (!scripts || scripts.length === 0) {
            this.clearPersistedScriptSelection();
            const newScript = await this.createScript(userId, {
                title: 'Untitled Script',
                content: ''
            });
            return newScript ? [newScript] : [];
        }
        this.clearInvalidSelection(scripts);
        return scripts;
    }

    async selectInitialScript (options = {}) {
        const current = this.getCurrentScript();
        if (current && current.id) {
            return current;
        }
        if (!this.scripts || this.scripts.length === 0) {
            return null;
        }

        const storedId = this.getStoredCurrentScriptId();
        let preferredId = this.scripts[0].id;
        if (storedId) {
            const storedScript = this.scripts.find(script => String(script.id) === String(storedId));
            if (storedScript) {
                preferredId = storedScript.id;
            } else {
                this.clearPersistedScriptSelection();
            }
        }

        return await this.selectScript(preferredId, {
            source: options.source || 'startup',
            preserveState: options.preserveState
        });
    }

    /**
     * Clear script state (used on logout)
     */
    clearState () {
        this.scripts = [];
        this.setCurrentScript(null);
        this.stateManager.setState(StateManager.KEYS.SCRIPTS, []);
        this.clearAllPatchState();
    }

    /**
     * Clear pending patch timers/state
     */
    clearAllPatchState () {
        for (const timer of this.patchTimers.values()) {
            clearTimeout(timer);
        }
        this.patchTimers.clear();
        this.patchQueue.clear();
        this.activePatches.clear();
    }

    /**
     * @returns {Array}
     */
    getValidTags () {
        return this.formatter.getValidTags();
    }

    /**
     * @param {boolean} loading
     */
    setLoading (loading) {
        this.isLoading = loading;
        super.setLoading(loading);
    }
}
