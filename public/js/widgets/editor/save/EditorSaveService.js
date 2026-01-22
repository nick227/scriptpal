import { EDITOR_EVENTS } from '../constants.js';

/**
 * EditorSaveService - Simplified debounce + queue wrapper for persistence
 */
export class EditorSaveService {
    constructor (options = {}) {
        if (!options.content) throw new Error('Content manager is required');
        if (!options.toolbar) throw new Error('Toolbar is required');
        if (!options.scriptStore) throw new Error('ScriptStore is required');

        this.content = options.content;
        this.toolbar = options.toolbar;
        this.scriptStore = options.scriptStore;

        this.debounceDelay = 5000; //ms
        this.saveTimer = null;
        this.lastNormalizedContent = '';

        this.handleContentChange = this.handleContentChange.bind(this);
        this.handleFocusOut = this.handleFocusOut.bind(this);
        this.handleManualSave = this.handleManualSave.bind(this);
        this.handlePageExit = this.handlePageExit.bind(this);

        this.setupListeners();
    }

    setupListeners () {
        this.content.on(EDITOR_EVENTS.CONTENT_CHANGE, this.handleContentChange);
        this.content.on(EDITOR_EVENTS.FOCUS_OUT, this.handleFocusOut);
        this.toolbar.onSave(this.handleManualSave);
        window.addEventListener('beforeunload', this.handlePageExit);
        window.addEventListener('pagehide', this.handlePageExit);
    }

    handleContentChange (content) {
        const normalizedContent = this.scriptStore.normalizeContent(content);
        if (normalizedContent === this.lastNormalizedContent) {
            return;
        }
        this.lastNormalizedContent = normalizedContent;
        this.scheduleSave('auto');
    }

    handleLineChange (content) {
        this.handleContentChange(content);
    }

    scheduleSave (reason = 'auto') {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }

        this.saveTimer = setTimeout(() => {
            this.flushSave(reason);
        }, this.debounceDelay);
    }

    async flushSave (reason = 'auto', options = {}) {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }

        const scriptId = this.scriptStore.getCurrentScriptId();
        if (!scriptId) {
            return false;
        }

        const contentValue = this.scriptStore.normalizeContent(this.content.getContent());
        const currentScript = this.scriptStore.getCurrentScript();
        if (currentScript) {
            const currentContent = this.scriptStore.normalizeContent(currentScript.content);
            if (currentContent === contentValue) {
                return false;
            }
        }
        this.lastNormalizedContent = contentValue;

        this.scriptStore.queuePatch(scriptId, {
            content: contentValue
        }, 'editor');

        if (options.immediate) {
            this.scriptStore.flushPatch(scriptId);
        }

        return true;
    }

    handleFocusOut () {
        this.flushSave('focus');
    }

    async handleManualSave () {
        return this.flushSave('manual');
    }

    handlePageExit () {
        this.flushSave('exit', { immediate: true });
    }

    destroy () {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }

        this.content.off(EDITOR_EVENTS.CONTENT_CHANGE, this.handleContentChange);
        this.content.off(EDITOR_EVENTS.FOCUS_OUT, this.handleFocusOut);
        window.removeEventListener('beforeunload', this.handlePageExit);
        window.removeEventListener('pagehide', this.handlePageExit);
        this.content = null;
        this.toolbar = null;
        this.scriptStore = null;
    }
}
