import { ERROR_MESSAGES } from '../constants.js';
import { BaseManager } from '../core/BaseManager.js';
import { EventManager } from '../core/EventManager.js';
import { debugLog } from '../core/logger.js';
import { StateManager } from '../core/StateManager.js';
import { ScriptFormatter } from '../services/format/ScriptFormatter.js';
import { loadRawFromStorage, removeFromStorage } from '../services/persistence/PersistenceManager.js';

import { resolveCacheState } from './storeLoadUtils.js';

/** @type {Set<string>} Valid visibility values */
const ALLOWED_VISIBILITIES = new Set(['private', 'public']);

/** @type {Set<string>} Valid visibility filter values */
const ALLOWED_FILTERS = new Set(['all', 'private', 'public']);

/** @type {string[]} Fields to check for dirty state in patches */
const PATCHABLE_FIELDS = ['content', 'title', 'author', 'description', 'visibility', 'versionNumber'];

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
        this.currentUserId = null;
        this.isLoading = false;
        this.formatter = new ScriptFormatter();
        this.patchQueue = new Map();
        this.patchTimers = new Map();
        this.activePatches = new Set();
        this.patchFlushDelay = 10000; // milliseconds
        this.patchRescheduleCooldown = 8000; // milliseconds between flushes
        this.maxPatchRetryDelay = 30000; // milliseconds
        this.lastSuccessfulFlush = new Map();
        this.visibilityFilter = 'all';
        this.authEventUnsubscribers = [];
        this._bindAuthEvents();
    }

    normalizeVisibility (value) {
        if (!value || typeof value !== 'string') {
            return 'private';
        }
        const normalized = value.toLowerCase();
        return ALLOWED_VISIBILITIES.has(normalized) ? normalized : 'private';
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
            description: script.description || '',
            userId: script.userId ?? this.currentUserId ?? null,
            visibility: this.normalizeVisibility(script.visibility),
            timestamp: Date.now()
        };
    }

    getFilteredScripts () {
        if (this.visibilityFilter === 'all') {
            return [...this.scripts];
        }
        return this.scripts.filter((script) => String(script.visibility || 'private') === this.visibilityFilter);
    }

    updateScriptsState () {
        this.stateManager.setState(StateManager.KEYS.SCRIPTS, this.getFilteredScripts());
    }

    setVisibilityFilter (filter) {
        const normalized = ALLOWED_FILTERS.has(filter) ? filter : 'all';
        if (this.visibilityFilter === normalized) return;
        this.visibilityFilter = normalized;
        this.updateScriptsState();
    }

    /**
     * Load scripts for a user
     * @param {number|string} userId
     * @param {object} options
     */
    async loadScripts (userId, options = {}) {
        const normalizedUserId = Number(userId);
        if (!normalizedUserId) {
            console.error('[ScriptStore] User ID required to load scripts');
            return [];
        }

        this.clearScriptError();

        const cacheState = resolveCacheState({
            currentId: this.currentUserId,
            nextId: normalizedUserId,
            items: this.scripts,
            force: options.force
        });
        if (cacheState.hasChanged) {
            this.clearState();
        }
        this.currentUserId = normalizedUserId;

        if (cacheState.shouldReturnCache) {
            return this.scripts;
        }

        try {
            this.setLoading(true);
            const scripts = await this.api.getAllScriptsByUser(normalizedUserId);

            if (!scripts || !Array.isArray(scripts)) {
                this.scripts = [];
                this.updateScriptsState();
                return [];
            }

            this.scripts = scripts.map(script => this.standardizeScript(script));
            this.updateScriptsState();

            return this.scripts;
        } catch (error) {
            console.error('[ScriptStore] Failed to load scripts:', error);
            this.handleAuthError(error);
            this.handleError(error, 'script');
            this.scripts = [];
            this.updateScriptsState();
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
            const ownerMatches = cached && this.currentUserId && String(cached.userId) === String(this.currentUserId);
            const shouldUseCache = hasCachedContent && ownerMatches && !options.forceFresh;

            const script = shouldUseCache
                ? cached
                : await this.api.getScript(scriptId);
            console.log('[ScriptStore] loadScript raw api response', { scriptId, script });

            return this.applyLoadedScript(script, options);
        } catch (error) {
            console.error('[ScriptStore] Failed to load script:', error);
            this.handleAuthError(error);
            this.handleError(error, 'script');
            return null;
        } finally {
            this.setLoading(false);
        }
    }

    async loadScriptBySlug (slug, options = {}) {
        if (!slug) {
            console.warn('[ScriptStore] Invalid script slug');
            return null;
        }

        this.clearScriptError();

        try {
            this.setLoading(true);
            const script = await this.api.getScriptBySlug(slug);
            console.log('[ScriptStore] loadScriptBySlug raw api response', { slug, script });
            return this.applyLoadedScript(script, options);
        } catch (error) {
            console.error('[ScriptStore] Failed to load script by slug:', error);
            this.handleAuthError(error);
            this.handleError(error, 'script');
            if (error?.status === 404) {
                this.setScriptError({
                    type: 'slug_not_found',
                    slug,
                    status: 404,
                    message: ERROR_MESSAGES.SCRIPT_NOT_FOUND
                });
            }
            return null;
        } finally {
            this.setLoading(false);
        }
    }

    applyLoadedScript (script, options = {}) {
        if (!script || !script.id) {
            console.warn('[ScriptStore] Invalid script data received');
            return null;
        }

        this.clearScriptError();
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
        this.updateScriptsState();

        if (options.forceFresh) {
            this.eventManager.publish(EventManager.EVENTS.SCRIPT.CONTENT_UPDATED, {
                script: standardized,
                source: options.source || 'refresh',
                preserveState: options.preserveState,
                timestamp: Date.now()
            });
        }

        return standardized;
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
     * Build effective patch by removing unchanged fields
     * @param {object} patch - Proposed patch
     * @param {object} currentScript - Current script state
     * @returns {object} Patch with only changed fields
     */
    buildEffectivePatch (patch, currentScript) {
        const effectivePatch = {};

        for (const field of PATCHABLE_FIELDS) {
            if (!Object.prototype.hasOwnProperty.call(patch, field)) {
                continue;
            }

            const patchValue = patch[field];
            const currentValue = currentScript?.[field];

            if (field === 'content') {
                const normalizedPatch = this.normalizeContent(patchValue);
                const normalizedCurrent = this.normalizeContent(currentValue);
                if (normalizedPatch !== normalizedCurrent) {
                    effectivePatch.content = patchValue;
                }
            } else if (field === 'visibility') {
                const normalizedPatch = this.normalizeVisibility(patchValue);
                const normalizedCurrent = this.normalizeVisibility(currentValue);
                if (normalizedPatch !== normalizedCurrent) {
                    effectivePatch.visibility = normalizedPatch;
                }
            } else if (patchValue !== currentValue) {
                effectivePatch[field] = patchValue;
            }
        }

        return effectivePatch;
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
        const effectivePatch = this.buildEffectivePatch(patch, currentScript);

        if (Object.keys(effectivePatch).length === 0) {
            return;
        }

        const now = Date.now();
        const existing = this.patchQueue.get(scriptId) || { patch: {}, queuedAt: now };
        existing.patch = {
            ...existing.patch,
            ...effectivePatch
        };
        existing.reason = reason;
        existing.queuedAt = now;

        debugLog('[PATCH_QUEUE] queued', { scriptId, patch: existing.patch, reason, timestamp: now });
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
        const now = Date.now();
        const lastSuccess = this.lastSuccessfulFlush.get(scriptId) || 0;
        const cooldownRemaining = lastSuccess && now - lastSuccess < this.patchRescheduleCooldown
            ? this.patchRescheduleCooldown - (now - lastSuccess)
            : 0;

        if (cooldownRemaining > 0 && this.patchTimers.has(scriptId)) {
            return;
        }

        this.clearPatchTimer(scriptId);
        const nextDelay = cooldownRemaining > 0
            ? Math.max(delay, cooldownRemaining)
            : delay;

        const timer = setTimeout(() => {
            this.flushPatch(scriptId);
        }, nextDelay);
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

        // Race condition protection: skip if script switched away
        if (!currentScript || String(currentScript.id) !== String(scriptId)) {
            debugLog('[PATCH_QUEUE] skipping flush - script switched', { scriptId });
            return;
        }

        // Race condition protection: if script was updated more recently than patch was queued,
        // re-validate the patch against current state to avoid overwriting newer changes
        const scriptTimestamp = currentScript.timestamp || 0;
        const patchQueuedAt = entry.queuedAt || 0;

        if (scriptTimestamp > patchQueuedAt) {
            debugLog('[PATCH_QUEUE] patch is stale, re-validating', { scriptId, scriptTimestamp, patchQueuedAt });
            const revalidatedPatch = this.buildEffectivePatch(entry.patch, currentScript);

            if (Object.keys(revalidatedPatch).length === 0) {
                debugLog('[PATCH_QUEUE] patch no longer needed after revalidation', { scriptId });
                this.patchQueue.delete(scriptId);
                this.emitSaveState(scriptId, 'SAVE_SAVED', { reason: 'revalidated' });
                return;
            }

            entry.patch = revalidatedPatch;
            entry.queuedAt = Date.now();
        }

        const payload = {
            title: entry.patch.title ?? currentScript.title,
            author: entry.patch.author ?? currentScript.author,
            description: entry.patch.description ?? currentScript.description,
            content: entry.patch.content ?? currentScript.content ?? '',
            versionNumber: entry.patch.versionNumber ?? currentScript.versionNumber ?? 1,
            visibility: entry.patch.visibility ?? currentScript.visibility ?? 'private'
        };

        this.activePatches.add(scriptId);
        this.emitSaveState(scriptId, 'SAVE_SAVING', { reason: entry.reason });

        try {
            await this.updateScript(scriptId, payload);
            this.lastSuccessfulFlush.set(scriptId, Date.now());
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

    async flushPatchImmediately (scriptId) {
        if (!scriptId) return;
        await this.flushPatch(scriptId);
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
            this.updateScriptsState();
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

        const versionNumber = scriptData.versionNumber ?? scriptData.version_number;
        if (!versionNumber || typeof versionNumber !== 'number') {
            throw new Error('Invalid version number provided');
        }

        try {
            const rawContent = this.normalizeContent(scriptData.content);
            const trimmedContent = typeof rawContent === 'string'
                ? rawContent.trim()
                : '';
            let formattedContent = rawContent;
            let formatInvalid = false;

            if (trimmedContent.length > 0) {
                if (!this.isStructuredContent(trimmedContent)) {
                    formattedContent = this.formatter.format(rawContent);
                    if (!this.formatter.validateFormat(formattedContent)) {
                        // Flag as invalid instead of throwing - allows sync to continue
                        formatInvalid = true;
                        console.warn('[ScriptStore] Script format validation failed, flagging for review', { id });
                        this.eventManager.publish(EventManager.EVENTS.SCRIPT.FORMAT_INVALID, {
                            scriptId: id,
                            reason: 'Format validation failed'
                        });
                    }
                }
            } else {
                formattedContent = '';
            }

            const updateData = {
                title: scriptData.title || 'Unknown Title',
                content: formattedContent,
                versionNumber: versionNumber
            };
            if (scriptData.author !== undefined) {
                updateData.author = scriptData.author;
            }
            if (scriptData.description !== undefined) {
                updateData.description = scriptData.description;
            }
            if (scriptData.visibility !== undefined) {
                updateData.visibility = this.normalizeVisibility(scriptData.visibility);
            }

            const updatedScript = await this.api.updateScript(id, updateData);
            if (!updatedScript || !updatedScript.id) {
                throw new Error('Invalid response from API');
            }

            const standardized = this.standardizeScript(updatedScript);
            if (formatInvalid) {
                standardized.formatInvalid = true;
            }
            this.updateScriptInCache(standardized);

            if (String(this.currentScriptId) === String(id)) {
                this.setCurrentScript(standardized, { source: 'update' });
            }

            this.eventManager.publish(EventManager.EVENTS.SCRIPT.UPDATED, {
                script: standardized,
                formatInvalid
            });

            return standardized;
        } catch (error) {
            console.error('[ScriptStore] Update failed:', error);
            this.handleAuthError(error);
            this.handleError(error, 'script');
            return null;
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
            const pendingIndex = this.scripts.findIndex(item => item.pending && item.title === standardized.title);
            if (pendingIndex !== -1) {
                this.scripts.splice(pendingIndex, 1);
            }
            this.scripts.unshift(standardized);
        } else {
            this.scripts[index] = standardized;
        }
        this.updateScriptsState();
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
            return false;
        }

        let wasDeleted = false;
        try {
            this.setLoading(true);
            await this.api.deleteScript(id);

            this.finalizeDelete(id);
            wasDeleted = true;
        } catch (error) {
            console.error('[ScriptStore] Delete failed:', error);
            if (error && error.status === 404) {
                this.finalizeDelete(id);
                wasDeleted = true;
            } else {
                this.handleError(error, 'script');
            }
        } finally {
            this.setLoading(false);
        }
        return wasDeleted;
    }

    finalizeDelete (id) {
        this.scripts = this.scripts.filter(s => String(s.id) !== String(id));
        this.updateScriptsState();

        if (String(this.currentScriptId) === String(id)) {
            this.setCurrentScript(null, { source: 'delete' });
        }

        this.eventManager.publish(EventManager.EVENTS.SCRIPT.DELETED, {
            scriptId: id,
            remainingScripts: this.scripts.length
        });
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
        this.updateScriptsState();

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
        this.updateScriptsState();

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
            console.log('[ScriptStore] setCurrentScript', script.id, script.visibility);
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
        const storedId = loadRawFromStorage('currentScriptId');
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

    setScriptError (payload) {
        if (!this.stateManager) {
            return;
        }
        this.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT_ERROR, payload);
        if (this.eventManager && payload) {
            this.eventManager.publish(EventManager.EVENTS.SCRIPT.ERROR, payload);
        }
    }

    clearScriptError () {
        if (!this.stateManager) {
            return;
        }
        this.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT_ERROR, null);
    }

    _bindAuthEvents () {
        if (!this.eventManager) {
            return;
        }
        this.authEventUnsubscribers.push(
            this.eventManager.subscribe(EventManager.EVENTS.AUTH.LOGOUT, () => this.clearState()),
            this.eventManager.subscribe(EventManager.EVENTS.AUTH.REGISTER, () => this.clearState())
        );
    }

    _unsubscribeFromAuthEvents () {
        if (!this.authEventUnsubscribers.length) {
            return;
        }
        this.authEventUnsubscribers.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.authEventUnsubscribers = [];
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
            await this.createScript(userId, {
                title: 'Untitled Script',
                content: ''
            });
            return this.scripts;
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
        this.updateScriptsState();
        this.clearAllPatchState();
        this.clearPersistedScriptSelection();
        this.clearScriptError();
        this.currentUserId = null;
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
        this.lastSuccessfulFlush.clear();
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

    destroy () {
        this._unsubscribeFromAuthEvents();
        this.clearState();
        this.api = null;
        this.eventManager = null;
        super.destroy();
    }
}
