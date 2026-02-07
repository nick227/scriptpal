import { BaseManager } from '../core/BaseManager.js';
import { EventManager } from '../core/EventManager.js';
import { debugLog } from '../core/logger.js';
import { StateManager } from '../core/StateManager.js';
import { ScriptFormatter } from '../services/format/ScriptFormatter.js';
import { loadRawFromStorage, removeFromStorage } from '../services/persistence/PersistenceManager.js';
import { buildMinePath, getMineSlugFromPathname } from '../services/script/slugPaths.js';

import { resolveCacheState } from './storeLoadUtils.js';

/** @type {Set<string>} Valid visibility values */
const ALLOWED_VISIBILITIES = new Set(['private', 'public']);

/** @type {Set<string>} Valid visibility filter values */
const ALLOWED_FILTERS = new Set(['all', 'private', 'public']);

/** @type {string[]} Fields to check for dirty state in patches */
const PATCHABLE_FIELDS = ['content', 'title', 'author', 'description', 'visibility', 'versionNumber'];

const replacePathWithCanonicalSlug = (slug, scriptId) => {
    if (!slug || typeof window === 'undefined') {
        return;
    }
    const pathSlug = getMineSlugFromPathname();
    if (pathSlug === slug) {
        return;
    }
    const nextPath = buildMinePath(slug);
    window.history.replaceState({ scriptId }, '', nextPath);
};

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
        this.activePatches = new Set();
        this.visibilityFilter = 'all';
        /** @type {boolean} True only after applyLoadedScript; cleared when current script is cleared. */
        this._currentScriptLoaded = false;
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

    /**
     * Reject blank/meaningless content (e.g. many empty lines) that would overwrite good data.
     * @param {string} content - Normalized JSON string
     * @returns {boolean}
     */
    hasMeaningfulContent (content) {
        if (typeof content !== 'string') return false;
        try {
            const parsed = JSON.parse(content);
            const lines = Array.isArray(parsed?.lines) ? parsed.lines : [];
            const counts = lines.reduce(
                (acc, line) => {
                    const text = String(line?.content ?? line?.text ?? '').replace(/\s+/g, '');
                    if (text.length > 0) {
                        acc.chars += text.length;
                        acc.lines++;
                    }
                    return acc;
                },
                { chars: 0, lines: 0 }
            );
            return counts.chars >= 50 || counts.lines >= 3;
        } catch {
            return false;
        }
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
        if (this.isLoading) {
            return this.scripts;
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
            const scripts = await this.api.scripts.getAllScriptsByUser(normalizedUserId);

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
        if (this.isLoading) {
            const cached = this.scripts.find(s => String(s.id) === String(id));
            return cached ? this.applyLoadedScript(cached, options) : null;
        }

        try {
            this.setLoading(true);

            const scriptId = String(id);
            const cached = this.scripts.find(script => String(script.id) === scriptId);
            const trimmed = typeof cached?.content === 'string' ? cached.content.trim() : '';
            const hasCachedContent = cached && trimmed.length > 0;
            const ownerMatches = cached && this.currentUserId && String(cached.userId) === String(this.currentUserId);
            const shouldUseCache = hasCachedContent && ownerMatches && !options.forceFresh;

            const script = shouldUseCache
                ? cached
                : await this.api.scripts.getScript(scriptId);
            debugLog('[ScriptStore] loadScript raw api response', { scriptId, script });

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
        if (this.isLoading) {
            const cached = this.scripts.find(s => s.slug === slug);
            return cached ? this.applyLoadedScript(cached, options) : null;
        }

        this.clearScriptError();

        try {
            this.setLoading(true);
            const script = await this.api.scripts.getScriptBySlug(slug);
            debugLog('[ScriptStore] loadScriptBySlug raw api response', { slug, script });
            return this.applyLoadedScript(script, options);
        } catch (error) {
            console.error('[ScriptStore] Failed to load script by slug:', error);
            this.handleAuthError(error);
            this.handleError(error, 'script');
            if (error?.status === 404) {
                error.type = error.type || 'slug_not_found';
                error.slug = slug;
            }
            throw error;
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
        this._currentScriptLoaded = true;

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

        if (effectivePatch.content !== undefined) {
            const normalized = this.normalizeContent(effectivePatch.content);
            debugLog('[PATCH_QUEUE] content metrics', {
                length: normalized?.length,
                meaningful: this.hasMeaningfulContent(normalized)
            });
            if (!this.hasMeaningfulContent(normalized)) {
                debugLog('[PATCH_QUEUE] rejected blank/meaningless content', { scriptId });
                return;
            }
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
    }

    /**
     * Flush pending patch for a script. Callers must invoke this after queuePatch; ScriptStore does not schedule.
     * @param {number|string} scriptId
     */
    async flushPatch (scriptId) {
        const entry = this.patchQueue.get(scriptId);
        if (!entry || this.activePatches.has(scriptId)) {
            return;
        }

        debugLog('[ScriptStore] flushPatch', {
            scriptId,
            hasContent: Boolean(entry.patch?.content),
            contentLength: entry.patch?.content?.length
        });

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
            versionNumber: entry.patch.versionNumber ?? currentScript.versionNumber ?? 1,
            visibility: entry.patch.visibility ?? currentScript.visibility ?? 'private'
        };
        if (entry.patch.content !== undefined) {
            payload.content = entry.patch.content;
        }

        this.activePatches.add(scriptId);
        this.emitSaveState(scriptId, 'SAVE_SAVING', { reason: entry.reason });

        try {
            await this.updateScript(scriptId, payload);
            this.emitSaveState(scriptId, 'SAVE_SAVED', { reason: entry.reason });
            this.patchQueue.delete(scriptId);
        } catch (error) {
            this.emitSaveState(scriptId, 'SAVE_ERROR', {
                reason: entry.reason,
                error: error && error.message ? error.message : error
            });
        } finally {
            this.activePatches.delete(scriptId);
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
        if (!id || !scriptData) {
            console.warn('[ScriptStore] Invalid update data');
            return null;
        }

        const versionNumber = scriptData.versionNumber ?? scriptData.version_number;
        if (!versionNumber || typeof versionNumber !== 'number') {
            throw new Error('Invalid version number provided');
        }
        const previousSlug = this.getCurrentScript()?.slug;

        try {
            const hasContent = scriptData.content !== undefined && scriptData.content !== null;
            let formattedContent = '';
            let formatInvalid = false;

            if (hasContent) {
                const rawContent = this.normalizeContent(scriptData.content);
                const trimmedContent = typeof rawContent === 'string'
                    ? rawContent.trim()
                    : '';
                formattedContent = rawContent;

                if (trimmedContent.length > 0) {
                    if (!this.isStructuredContent(trimmedContent)) {
                        formattedContent = this.formatter.format(rawContent);
                        if (!this.formatter.validateFormat(formattedContent)) {
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
            }

            const updateData = {
                title: scriptData.title || 'Unknown Title',
                versionNumber: versionNumber
            };
            if (hasContent && formattedContent && String(formattedContent).trim().length > 0) {
                updateData.content = formattedContent;
            }
            if (scriptData.author !== undefined) {
                updateData.author = scriptData.author;
            }
            if (scriptData.description !== undefined) {
                updateData.description = scriptData.description;
            }
            if (scriptData.visibility !== undefined) {
                updateData.visibility = this.normalizeVisibility(scriptData.visibility);
            }

            const updatedScript = await this.api.scripts.updateScript(id, updateData);
            if (!updatedScript || !updatedScript.id) {
                throw new Error('Invalid response from API');
            }

            const standardized = this.standardizeScript(updatedScript);
            if (formatInvalid) {
                standardized.formatInvalid = true;
            }
            this.updateScriptInCache(standardized);

            if (standardized.slug && standardized.slug !== previousSlug) {
                replacePathWithCanonicalSlug(standardized.slug, standardized.id);
            }

            if (String(this.currentScriptId) === String(id)) {
                this.setCurrentScript(standardized, { source: 'update' });
                this._currentScriptLoaded = true;
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
            newScript = await this.api.scripts.createScript({
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
        this._currentScriptLoaded = true;

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
            await this.api.scripts.deleteScript(id);

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
            debugLog('[ScriptStore] setCurrentScript', script.id, script.visibility);
            this.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT, script);

            this.eventManager.publish(EventManager.EVENTS.SCRIPT.SELECTED, {
                script,
                source: options.source || 'selection',
                preserveState: options.preserveState
            });
        } else {
            this.currentScriptId = null;
            this._currentScriptLoaded = false;
            this.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT_ID, null);
            this.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT, null);
        }
    }

    hasLoadedCurrentScript () {
        return Boolean(this._currentScriptLoaded);
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
        this._currentScriptLoaded = false;
        this.setCurrentScript(null);
        this.updateScriptsState();
        this.clearAllPatchState();
        this.clearPersistedScriptSelection();
        this.clearScriptError();
        this.currentUserId = null;
    }

    /**
     * Clear pending patch state (queue and active set). ScriptStore does not use timers.
     */
    clearAllPatchState () {
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

    destroy () {
        this._unsubscribeFromAuthEvents();
        this.clearState();
        this.api = null;
        this.eventManager = null;
        super.destroy();
    }
}
