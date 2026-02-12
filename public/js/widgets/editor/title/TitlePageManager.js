/**
 * Streamlined TitlePageManager - focuses purely on author/title rendering + persistence
 * All state mutations go through queuePatch; this manager only renders and queues patches.
 */

import { debugLog } from '../../../core/logger.js';
import { StateManager } from '../../../core/StateManager.js';
import { loadJsonFromStorage } from '../../../services/persistence/PersistenceManager.js';
import { MediaPickerWidget } from '../../media/MediaPickerWidget.js';

const MAX_SCRIPT_TAGS = 10;

const TITLE_PAGE_TEMPLATE = `
    <div class="title-page">
        <div class="title-page-content">
            <div class="title-section">
                <label class="title-label">TITLE</label>
                <textarea class="title-input" type="text" placeholder="Enter script title"></textarea>
            </div>
            <div class="author-section">
                <label class="author-label">AUTHOR</label>
                <input class="author-input" type="text" placeholder="Enter author name">
            </div>
            <div class="description-section">
                <label class="description-label">DESCRIPTION</label>
                <textarea class="description-input" placeholder="Enter script description"></textarea>
            </div>
            <div class="tags-section">
                <label class="tags-label" for="script-tags-input">TAGS</label>
                <div class="tags-input-wrapper">
                    <input id="script-tags-input" class="tags-input" type="text" placeholder="Add tags (comma or Enter)">
                </div>
                <div class="tags-chips" data-script-tags-chips></div>
                <p class="tags-feedback" data-script-tags-feedback aria-live="polite"></p>
            </div>
            <div class="title-media-section">
                <label class="title-label">SCRIPT IMAGE</label>
                <div class="title-media-container"></div>
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
        <div class="title-page-footer">
            <h6 class="hidden-title-input" aria-live="polite" role="button" tabindex="0"></h6>
            <h5 class="toggle-title-page" role="button" tabindex="0">↓</h5>
        </div>
    </div>
`;

/**
 *
 */
export class TitlePageManager {
    /**
     *
     * @param options
     */
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

        this.titlePageData = { title: '', author: '', description: '', tags: [], date: '', visibility: 'private' };
        this.scriptId = null;
        this.persistTimer = null;
        this.persistDelay = 1500;
        this.visibilitySelect = null;
        this.isTitlePageCollapsed = false;
        this.mediaPicker = null;
        this.mediaContainer = null;
        this._updatingFromState = false;
    }

    /**
     *
     */
    async initialize () {
        this.render();
        this.attachHandlers();
        await this.initializeMediaPicker();
        this.subscribeToScript();
        this.hydrateFromState();
        debugLog('TitlePageManager initialized');
    }

    /**
     *
     */
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
        this.hiddenTitleInput = this.titlePage.querySelector('.hidden-title-input');
        this.authorInput = this.titlePage.querySelector('.author-input');
        this.descriptionInput = this.titlePage.querySelector('.description-input');
        this.tagsInput = this.titlePage.querySelector('.tags-input');
        this.tagsChips = this.titlePage.querySelector('[data-script-tags-chips]');
        this.tagsFeedback = this.titlePage.querySelector('[data-script-tags-feedback]');
        this.visibilitySelect = this.titlePage.querySelector('.visibility-select');
        this.dateDisplay = this.titlePage.querySelector('.date-display');
        this.toggleTitlePage = this.titlePage.querySelector('.toggle-title-page');
        this.mediaContainer = this.titlePage.querySelector('.title-media-container');
        this.isTitlePageCollapsed = this.checkLocalStorage('isTitlePageCollapsed', false);
        this.updateCollapsedState();
    }

    /**
     *
     */
    checkLocalStorage (key, defaultValue) {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : defaultValue;
    }

    async initializeMediaPicker () {
        if (!this.mediaContainer) {
            return;
        }
        this.mediaPicker = new MediaPickerWidget({
            api: this.api,
            container: this.mediaContainer,
            ownerType: 'script',
            ownerId: this.scriptId,
            role: 'cover',
            label: 'Select Image'
        });
        await this.mediaPicker.initialize();
    }

    /**
     *
     */
    attachHandlers () {
        if (this.titleInput) {
            this.titleInput.addEventListener('input', () => this.handleInputChange());
        }
        if (this.authorInput) {
            this.authorInput.addEventListener('input', () => this.handleInputChange());
        }
        if (this.descriptionInput) {
            this.descriptionInput.addEventListener('blur', () => this.handleDescriptionBlur());
        }
        if (this.tagsInput) {
            this.tagsInput.addEventListener('keydown', (event) => this.handleTagInputKeyDown(event));
            this.tagsInput.addEventListener('blur', () => this.handleTagInputBlur());
        }
        if (this.visibilitySelect) {
            this.visibilitySelect.addEventListener('change', () => this.handleVisibilityChange());
        }
        if (this.toggleTitlePage) {
            this.toggleTitlePage.addEventListener('click', () => this.toggleTitlePageVisibility());
            this.toggleTitlePage.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.toggleTitlePageVisibility();
                }
            });
        }
        if (this.hiddenTitleInput) {
            this.hiddenTitleInput.addEventListener('click', () => this.handleHiddenTitleActivation());
            this.hiddenTitleInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.handleHiddenTitleActivation();
                }
            });
        }
    }

    /**
     *
     */
    toggleTitlePageVisibility () {
        this.isTitlePageCollapsed = !this.isTitlePageCollapsed;
        this.updateCollapsedState();
    }

    /**
     *
     */
    openTitlePage () {
        if (!this.isTitlePageCollapsed) return;
        this.isTitlePageCollapsed = false;
        this.updateCollapsedState();
    }

    /**
     *
     */
    handleHiddenTitleActivation () {
        if (!this.isTitlePageCollapsed) return;
        this.openTitlePage();
    }

    /**
     *
     */
    updateCollapsedState () {
        if (!this.titlePage) return;
        this.titlePage.classList.toggle('title-page--collapsed', this.isTitlePageCollapsed);
        this.updateToggleLabel();
        this.updateHiddenTitleText();
        localStorage.setItem('isTitlePageCollapsed', this.isTitlePageCollapsed);
    }

    /**
     *
     */
    updateToggleLabel () {
        if (!this.toggleTitlePage) return;
        const label = this.isTitlePageCollapsed ? '↓' : '↑';
        this.toggleTitlePage.textContent = label;
        this.toggleTitlePage.setAttribute('aria-expanded', String(!this.isTitlePageCollapsed));
        this.toggleTitlePage.setAttribute('aria-label', this.isTitlePageCollapsed ? 'Show title page' : 'Hide title page');
    }

    /**
     *
     */
    updateHiddenTitleText () {
        if (!this.hiddenTitleInput) return;
        this.hiddenTitleInput.textContent = this.titlePageData.title || '';
    }

    /**
     *
     */
    subscribeToScript () {
        this.stateManager.subscribe(StateManager.KEYS.CURRENT_SCRIPT, this.handleScriptChange.bind(this));
    }

    /**
     *
     */
    hydrateFromState () {
        const currentScript = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
        if (currentScript) {
            this.handleScriptChange(currentScript);
            return;
        }
        const persisted = this.loadPersistedScriptState();
        if (persisted) {
            this.applyPersistedScriptState(persisted);
        }
    }

    /**
     *
     */
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

    /**
     *
     * @param scriptState
     */
    applyPersistedScriptState (scriptState) {
        if (!scriptState || !scriptState.scriptId) {
            return;
        }

        this.scriptId = Number(scriptState.scriptId);
        this.titlePageData.title = scriptState.title || this.titlePageData.title;
        this.titlePageData.author = scriptState.author || this.titlePageData.author;
        this.titlePageData.description = scriptState.description || this.titlePageData.description;
        this.titlePageData.tags = this.normalizeTagList(scriptState.tags);
        this.titlePageData.visibility = this.normalizeVisibility(scriptState.visibility);
        this.updateInputs();
    }

    /**
     *
     * @param script
     */
    handleScriptChange (script) {
        if (!script) return;
        this._updatingFromState = true;
        try {
            const previousScriptId = this.scriptId;
            this.scriptId = script.id;
            this.titlePageData.title = script.title || '';
            this.titlePageData.author = script.author || '';
            this.titlePageData.description = script.description || '';
            this.titlePageData.tags = this.normalizeTagList(script.tags);
            if (typeof script.visibility === 'string') {
                this.titlePageData.visibility = this.normalizeVisibility(script.visibility);
            }
            this.titlePageData.date = this.formatDate(script.createdAt);
            this.updateInputs();
            if (this.mediaPicker) {
                this.mediaPicker.setOwner({
                    ownerType: 'script',
                    ownerId: this.scriptId,
                    role: 'cover'
                });
                if (String(previousScriptId) !== String(this.scriptId)) {
                    this.mediaPicker.refreshPreview();
                }
            }
        } finally {
            this._updatingFromState = false;
        }
    }

    /**
     *
     */
    updateInputs () {
        if (this.titleInput) {
            this.titleInput.value = this.titlePageData.title;
        }
        if (this.authorInput) {
            this.authorInput.value = this.titlePageData.author;
        }
        if (this.descriptionInput) {
            this.descriptionInput.value = this.titlePageData.description;
        }
        this.renderTagChips();
        if (this.visibilitySelect) {
            this.visibilitySelect.value = this.titlePageData.visibility;
        }
        if (this.dateDisplay) {
            this.dateDisplay.textContent = this.titlePageData.date;
        }
        this.updateHiddenTitleText();
    }

    /**
     *
     */
    handleInputChange () {
        if (this._updatingFromState) return;
        this.titlePageData.title = this.titleInput?.value || '';
        this.titlePageData.author = this.authorInput?.value || '';
        this.titlePageData.description = this.descriptionInput?.value || '';
        this.titlePageData.visibility = this.normalizeVisibility(this.visibilitySelect?.value);
        this.updateHiddenTitleText();
        this.schedulePersist();
    }

    handleTagInputKeyDown (event) {
        if (!event) return;
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            this.commitTagInput();
            return;
        }
        if (event.key === 'Backspace' && !this.tagsInput?.value && this.titlePageData.tags.length > 0) {
            this.removeTag(this.titlePageData.tags.length - 1);
        }
    }

    handleTagInputBlur () {
        if (this._updatingFromState) return;
        this.commitTagInput();
    }

    normalizeTagValue (value) {
        if (typeof value !== 'string') return '';
        return value.trim().replace(/\s+/g, ' ').toLowerCase();
    }

    normalizeTagList (tags) {
        if (!Array.isArray(tags)) return [];
        const normalized = [];
        const seen = new Set();

        tags.forEach((tag) => {
            const compact = this.normalizeTagValue(tag);
            if (!compact || compact.length > 32 || seen.has(compact)) {
                return;
            }
            if (normalized.length < MAX_SCRIPT_TAGS) {
                seen.add(compact);
                normalized.push(compact);
            }
        });

        return normalized;
    }

    commitTagInput () {
        if (!this.tagsInput) return;
        const rawValue = this.tagsInput.value || '';
        this.tagsInput.value = '';
        const entries = rawValue
            .split(',')
            .map((entry) => this.normalizeTagValue(entry))
            .filter(Boolean);

        if (entries.length === 0) {
            this.renderTagFeedback();
            return;
        }

        const prior = this.titlePageData.tags.slice();
        entries.forEach((tag) => {
            if (this.titlePageData.tags.length >= MAX_SCRIPT_TAGS) {
                return;
            }
            if (!this.titlePageData.tags.includes(tag)) {
                this.titlePageData.tags.push(tag);
            }
        });

        this.titlePageData.tags = this.normalizeTagList(this.titlePageData.tags);
        this.renderTagChips();
        this.renderTagFeedback();

        if (JSON.stringify(prior) !== JSON.stringify(this.titlePageData.tags)) {
            this.persistTags();
        }
    }

    removeTag (index) {
        if (this._updatingFromState) return;
        if (!Array.isArray(this.titlePageData.tags)) return;
        if (index < 0 || index >= this.titlePageData.tags.length) return;
        this.titlePageData.tags.splice(index, 1);
        this.renderTagChips();
        this.renderTagFeedback();
        this.persistTags();
    }

    renderTagFeedback () {
        if (!this.tagsFeedback) return;
        const total = this.titlePageData.tags.length;
        if (total >= MAX_SCRIPT_TAGS) {
            this.tagsFeedback.textContent = `Tag limit reached (${MAX_SCRIPT_TAGS})`;
            return;
        }
        this.tagsFeedback.textContent = `${total}/${MAX_SCRIPT_TAGS} tags`;
    }

    renderTagChips () {
        if (!this.tagsChips) return;
        this.tagsChips.innerHTML = '';

        this.titlePageData.tags.forEach((tag, index) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'tag-chip';
            chip.setAttribute('aria-label', `Remove tag ${tag}`);
            chip.innerHTML = `<span>${tag}</span><span aria-hidden="true">&times;</span>`;
            chip.addEventListener('click', () => this.removeTag(index));
            this.tagsChips.appendChild(chip);
        });

        this.renderTagFeedback();
    }

    persistTags () {
        if (!this.scriptId || !this.scriptStore) {
            return;
        }
        this.scriptStore.queuePatch(this.scriptId, {
            tags: [...this.titlePageData.tags]
        }, 'title-page-tags');
        this.scriptStore.flushPatchImmediately(this.scriptId);
    }

    handleDescriptionBlur () {
        if (this._updatingFromState) return;
        this.titlePageData.description = this.descriptionInput?.value || '';

        if (!this.scriptId || !this.scriptStore) {
            return;
        }

        this.scriptStore.queuePatch(this.scriptId, {
            description: this.titlePageData.description
        }, 'title-page-description-blur');
        this.scriptStore.flushPatchImmediately(this.scriptId);
    }

    /**
     *
     */
    adjustInputHeights () {
        const fields = [this.titleInput, this.authorInput, this.descriptionInput];
        fields.forEach(field => {
            if (!field) return;

            field.style.height = 'auto';
            const scrollHeight = Number(field.scrollHeight) || 0;
            const clientHeight = Number(field.clientHeight) || 0;
            const naturalHeight = Math.max(scrollHeight, clientHeight);
            if (naturalHeight > 0) {
                field.style.height = `${naturalHeight}px`;
            }
        });
    }

    /**
     *
     */
    handleVisibilityChange () {
        if (this._updatingFromState) return;
        this.titlePageData.visibility = this.normalizeVisibility(this.visibilitySelect?.value);
        this.queueVisibilityUpdate();
    }

    /**
     *
     */
    queueVisibilityUpdate () {
        if (!this.scriptStore || !this.scriptId) {
            return;
        }
        this.scriptStore.queuePatch(this.scriptId, {
            visibility: this.titlePageData.visibility
        }, 'visibility-picker');
        this.scriptStore.flushPatchImmediately(this.scriptId);
    }

    /**
     *
     */
    schedulePersist () {
        if (!this.scriptId) return;
        clearTimeout(this.persistTimer);
        this.persistTimer = setTimeout(() => {
            this.scriptStore.queuePatch(this.scriptId, {
                title: this.titlePageData.title,
                author: this.titlePageData.author,
                description: this.titlePageData.description,
                tags: [...this.titlePageData.tags],
                visibility: this.titlePageData.visibility
            }, 'title-page');
            this.scriptStore.flushPatch(this.scriptId);
        }, this.persistDelay);
    }

    /**
     *
     * @param value
     */
    formatDate (value) {
        const date = value ? new Date(value) : new Date();
        return Number.isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
    }

    /**
     *
     * @param value
     */
    normalizeVisibility (value) {
        const allowed = new Set(['private', 'public']);
        if (!value || typeof value !== 'string') {
            return 'private';
        }
        const normalized = value.toLowerCase();
        return allowed.has(normalized) ? normalized : 'private';
    }

    /**
     *
     */
    destroy () {
        this.persistTimer && clearTimeout(this.persistTimer);
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
