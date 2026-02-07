import { EDITOR_EVENTS } from '../constants.js';
import { StateManager } from '../../../core/StateManager.js';

const AUTO_SAVE_DEBOUNCE_MS = 800;

/**
 * EditorSaveService - Debounced auto-save on CONTENT_PERSIST; immediate flush on focus-out and manual save.
 * Server saves on beforeunload/pagehide removed to avoid capturing stale/minimal content during teardown.
 */
export class EditorSaveService {
    constructor (options = {}) {
        if (!options.content) throw new Error('Content manager is required');
        if (!options.toolbar) throw new Error('Toolbar is required');
        if (!options.scriptStore) throw new Error('ScriptStore is required');
        if (!options.stateManager) throw new Error('StateManager is required for EditorSaveService');

        this.content = options.content;
        this.toolbar = options.toolbar;
        this.scriptStore = options.scriptStore;
        this.stateManager = options.stateManager;
        this.lastNormalizedContent = '';
        this.autoSaveTimer = null;

        this.handleContentChange = this.handleContentChange.bind(this);
        this.handleFocusOut = this.handleFocusOut.bind(this);
        this.handleManualSave = this.handleManualSave.bind(this);

        this.setupListeners();
    }

    setupListeners () {
        this.content.on(EDITOR_EVENTS.CONTENT_PERSIST, this.handleContentChange);
        this.content.on(EDITOR_EVENTS.FOCUS_OUT, this.handleFocusOut);
        this.toolbar.onSave(this.handleManualSave);
    }

    handleContentChange () {
        this.cancelAutoSave();
        this.autoSaveTimer = setTimeout(() => {
            this.autoSaveTimer = null;
            this.flushSave('auto');
        }, AUTO_SAVE_DEBOUNCE_MS);
    }

    cancelAutoSave () {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    handleLineChange () {
        this.handleContentChange();
    }

    flushSave (reason = 'auto') {
        const readOnly = typeof this.stateManager.isEditorReadOnly === 'function'
            ? this.stateManager.isEditorReadOnly()
            : this.stateManager.getState(StateManager.KEYS.EDITOR_MODE) === 'version-preview';
        if (readOnly) {
            console.warn('[EditorSaveService] Save blocked (read-only mode)');
            return false;
        }

        if (!this.content || !this.content.hasLoadedInitialContent || !this.content.hasLoadedInitialContent()) {
            console.warn('[EditorSaveService] Save skipped: content not loaded yet');
            return false;
        }

        const scriptId = this.scriptStore.getCurrentScriptId();
        if (!scriptId) {
            return false;
        }

        if (!this.scriptStore.hasLoadedCurrentScript() && !this.lastNormalizedContent) {
            return false;
        }

        const contentValue = this.content.getContent();
        const normalized = this.scriptStore.normalizeContent(contentValue);

        if (typeof normalized !== 'string' || normalized.length < 200) {
            console.warn('[EditorSaveService] Skipping save: suspiciously small content', normalized?.length ?? 0);
            return false;
        }
        if (!normalized.includes('"lines"')) {
            console.warn('[EditorSaveService] Skipping save: not storage JSON');
            return false;
        }

        if (normalized === this.lastNormalizedContent) {
            return false;
        }

        const currentScript = this.scriptStore.getCurrentScript();
        if (currentScript) {
            const currentContent = this.scriptStore.normalizeContent(currentScript.content);
            if (currentContent === normalized) {
                return false;
            }
        }

        this.lastNormalizedContent = normalized;

        this.scriptStore.queuePatch(scriptId, { content: normalized }, 'editor');
        this.scriptStore.flushPatch(scriptId);

        return true;
    }

    handleFocusOut () {
        this.cancelAutoSave();
        this.flushSave('focus');
    }

    async handleManualSave () {
        this.cancelAutoSave();
        return this.flushSave('manual');
    }

    destroy () {
        this.cancelAutoSave();
        this.content.off(EDITOR_EVENTS.CONTENT_PERSIST, this.handleContentChange);
        this.content.off(EDITOR_EVENTS.FOCUS_OUT, this.handleFocusOut);
        this.content = null;
        this.toolbar = null;
        this.scriptStore = null;
        this.stateManager = null;
    }
}
