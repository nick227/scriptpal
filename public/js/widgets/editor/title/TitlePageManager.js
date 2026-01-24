/**
 * Streamlined TitlePageManager - focuses purely on author/title rendering + persistence
 * All state mutations go through queuePatch; this manager only renders and queues patches.
 */

import { debugLog } from '../../../core/logger.js';
import { StateManager } from '../../../core/StateManager.js';
import { loadJsonFromStorage } from '../../../managers/PersistenceManager.js';

const TITLE_PAGE_TEMPLATE = `
    <div class="title-page">
        <div class="title-page-content">
            <div class="title-section">
                <label class="title-label">TITLE</label>
                <input class="title-input" type="text" placeholder="Enter script title">
            </div>
            <div class="author-section">
                <label class="author-label">AUTHOR</label>
                <input class="author-input" type="text" placeholder="Enter author name">
            </div>
            <div class="visibility-section">
                <label class="visibility-label" for="visibility-select">VISIBILITY</label>
                <select id="visibility-select" class="visibility-select">
                    <option value="private">Private</option>
                    <option value="public">Public</option>
                </select>
            </div>
            <div class="date-section">
                <label class="date-label">DATE</label>
                <span class="date-display"></span>
            </div>
        </div>
    </div>
`;

export class TitlePageManager {
    constructor (options) {
        if (!options.container) throw new Error('Container is required for TitlePageManager');
        if (!options.stateManager) throw new Error('StateManager is required for TitlePageManager');
        if (!options.eventManager) throw new Error('EventManager is required for TitlePageManager');
        if (!options.api) throw new Error('API is required for TitlePageManager');
        if (!options.scriptStore) throw new Error('ScriptStore is required for TitlePageManager');

        this.container = options.container;
        this.stateManager = options.stateManager;
        this.eventManager = options.eventManager;
        this.api = options.api;
        this.scriptStore = options.scriptStore;

        this.titlePageData = { title: '', author: '', date: '', visibility: 'private' };
        this.scriptId = null;
        this.persistTimer = null;
        this.persistDelay = 400;
        this.visibilitySelect = null;
    }

    async initialize () {
        this.render();
        this.attachHandlers();
        this.subscribeToScript();
        this.hydrateFromState();
        debugLog('TitlePageManager initialized');
    }

    render () {
        if (!this.container) return;
        if (!this.titlePageWrapper) {
            this.titlePageWrapper = document.createElement('div');
            this.titlePageWrapper.className = 'title-page-wrapper';
            this.container.prepend(this.titlePageWrapper);
        }
        this.titlePageWrapper.innerHTML = '';
        const template = document.createElement('div');
        template.innerHTML = TITLE_PAGE_TEMPLATE.trim();
        this.titlePage = template.firstElementChild;
        this.titlePageWrapper.appendChild(this.titlePage);

        this.titleInput = this.titlePage.querySelector('.title-input');
        this.authorInput = this.titlePage.querySelector('.author-input');
        this.visibilitySelect = this.titlePage.querySelector('.visibility-select');
        this.dateDisplay = this.titlePage.querySelector('.date-display');
    }

    attachHandlers () {
        if (this.titleInput) {
            this.titleInput.addEventListener('input', () => this.handleInputChange());
        }
        if (this.authorInput) {
            this.authorInput.addEventListener('input', () => this.handleInputChange());
        }
        if (this.visibilitySelect) {
            this.visibilitySelect.addEventListener('change', () => this.handleVisibilityChange());
        }
    }

    subscribeToScript () {
        this.stateManager.subscribe(StateManager.KEYS.CURRENT_SCRIPT, this.handleScriptChange.bind(this));
    }

    hydrateFromState () {
        const currentScript = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
        console.log('[currentScript]', currentScript);
        if (currentScript) {
            this.handleScriptChange(currentScript);
            return;
        }
        const persisted = this.loadPersistedScriptState();
        console.log('[persisted]', persisted);
        if (persisted) {
            this.applyPersistedScriptState(persisted);
        }
    }

    loadPersistedScriptState () {
        try {
            const persisted = loadJsonFromStorage('currentScriptState');
            if (persisted && persisted.scriptId) {
                return persisted;
            }
        } catch (error) {
            console.warn('[TitlePageManager] Failed to load persisted script state:', error);
        }
        return null;
    }

    applyPersistedScriptState (scriptState) {
        if (!scriptState || !scriptState.scriptId) {
            return;
        }

        this.scriptId = Number(scriptState.scriptId);
        this.titlePageData.title = scriptState.title || this.titlePageData.title;
        this.titlePageData.author = scriptState.author || this.titlePageData.author;
        this.titlePageData.visibility = this.normalizeVisibility(scriptState.visibility);
        this.updateInputs();
    }

    handleScriptChange (script) {
        if (!script) return;
        this.scriptId = script.id;
        this.titlePageData.title = script.title || '';
        this.titlePageData.author = script.author || '';
        console.log('[TitlePageManager] handleScriptChange', script.id, script.visibility);
        if (typeof script.visibility === 'string') {
            this.titlePageData.visibility = this.normalizeVisibility(script.visibility);
        }
        this.titlePageData.date = this.formatDate(script.createdAt);
        this.updateInputs();
    }

    updateInputs () {
        if (this.titleInput) {
            this.titleInput.value = this.titlePageData.title;
        }
        if (this.authorInput) {
            this.authorInput.value = this.titlePageData.author;
        }
        console.log('[TitlePageTest]', this.visibilitySelect, this.titlePageData);
        if (this.visibilitySelect) {
            this.visibilitySelect.value = this.titlePageData.visibility;
        }
        if (this.dateDisplay) {
            this.dateDisplay.textContent = this.titlePageData.date;
        }
    }

    handleInputChange () {
        this.titlePageData.title = this.titleInput?.value || '';
        this.titlePageData.author = this.authorInput?.value || '';
        this.titlePageData.visibility = this.normalizeVisibility(this.visibilitySelect?.value);
        this.schedulePersist();
    }

    handleVisibilityChange () {
        this.titlePageData.visibility = this.normalizeVisibility(this.visibilitySelect?.value);
        this.queueVisibilityUpdate();
    }

    queueVisibilityUpdate () {
        if (!this.scriptStore || !this.scriptId) {
            return;
        }
        this.scriptStore.queuePatch(this.scriptId, {
            visibility: this.titlePageData.visibility
        }, 'visibility-picker');
        this.scriptStore.flushPatchImmediately(this.scriptId);
    }

    schedulePersist () {
        if (!this.scriptId) return;
        clearTimeout(this.persistTimer);
        this.persistTimer = setTimeout(() => {
            this.scriptStore.queuePatch(this.scriptId, {
                title: this.titlePageData.title,
                author: this.titlePageData.author,
                visibility: this.titlePageData.visibility
            }, 'title-page');
        }, this.persistDelay);
    }

    formatDate (value) {
        const date = value ? new Date(value) : new Date();
        return Number.isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
    }

    normalizeVisibility (value) {
        const allowed = new Set(['private', 'public']);
        if (!value || typeof value !== 'string') {
            return 'private';
        }
        const normalized = value.toLowerCase();
        return allowed.has(normalized) ? normalized : 'private';
    }

    destroy () {
        this.persistTimer && clearTimeout(this.persistTimer);
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
