import { EDITOR_EVENTS } from '../constants.js';

const AUTO_SAVE_DEBOUNCE_MS = 800;

/**
 * EditorSaveService - Debounced auto-save on CONTENT_PERSIST; immediate flush on focus-out, manual save, exit.
 */
export class EditorSaveService {
    constructor (options = {}) {
        if (!options.content) throw new Error('Content manager is required');
        if (!options.toolbar) throw new Error('Toolbar is required');
        if (!options.scriptStore) throw new Error('ScriptStore is required');

        this.content = options.content;
        this.toolbar = options.toolbar;
        this.scriptStore = options.scriptStore;
        this.lastNormalizedContent = '';
        this.autoSaveTimer = null;

        this.handleContentChange = this.handleContentChange.bind(this);
        this.handleFocusOut = this.handleFocusOut.bind(this);
        this.handleManualSave = this.handleManualSave.bind(this);
        this.handlePageExit = this.handlePageExit.bind(this);

        this.setupListeners();
    }

    setupListeners () {
        this.content.on(EDITOR_EVENTS.CONTENT_PERSIST, this.handleContentChange);
        this.content.on(EDITOR_EVENTS.FOCUS_OUT, this.handleFocusOut);
        this.toolbar.onSave(this.handleManualSave);
        window.addEventListener('beforeunload', this.handlePageExit);
        window.addEventListener('pagehide', this.handlePageExit);
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
        const scriptId = this.scriptStore.getCurrentScriptId();
        if (!scriptId) {
            return false;
        }

        const contentValue = this.content.getContent();
        const normalized = this.scriptStore.normalizeContent(contentValue);

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

    handlePageExit () {
        this.cancelAutoSave();
        this.flushSave('exit');
    }

    destroy () {
        this.cancelAutoSave();
        this.content.off(EDITOR_EVENTS.CONTENT_PERSIST, this.handleContentChange);
        this.content.off(EDITOR_EVENTS.FOCUS_OUT, this.handleFocusOut);
        window.removeEventListener('beforeunload', this.handlePageExit);
        window.removeEventListener('pagehide', this.handlePageExit);
        this.content = null;
        this.toolbar = null;
        this.scriptStore = null;
    }
}
