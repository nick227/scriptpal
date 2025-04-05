import { StateManager } from '../../core/StateManager.js';

export class EditorAutosave {
    constructor(contentManager, toolbar) {
        this.contentManager = contentManager;
        this.toolbar = toolbar;
        this.script = null;
        this.saveTimeout = null;
        this.SAVE_DELAY = 2000; // 2 seconds
        this.boundHandleContentChange = this.handleContentChange.bind(this);
    }

    initialize(script) {
        this.script = script;
        this.setupAutosave();
    }

    setupAutosave() {
        // Set up new handler
        if (this.contentManager) {
            this.contentManager.on('contentChanged', this.boundHandleContentChange);
        }
    }

    handleContentChange() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        this.saveTimeout = setTimeout(() => {
            this.saveContent();
        }, this.SAVE_DELAY);
    }

    async saveContent() {
        if (!this.script) {
            console.warn('No script to save');
            return;
        }

        try {
            // Get content as XML string
            const content = this.contentManager.getContent();

            // Update save status
            if (this.toolbar) {
                this.toolbar.setSaveState('saving');
            }

            // Get current script data
            const currentScript = this.script.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
            if (!currentScript || !currentScript.title) {
                throw new Error('Current script title is required');
            }

            // Save content with title
            await this.script.saveContent(content, currentScript.title);
            console.log('Autosave successful');
            console.log(currentScript);
            console.log(content);
            console.log('--------^^^^-------^^^^----------^^^^-------');

            // Update save status
            if (this.toolbar) {
                this.toolbar.setSaveState('saved');
                setTimeout(() => this.toolbar.setSaveState('idle'), 2000);
            }
        } catch (error) {
            console.error('Autosave failed:', error);
            if (this.toolbar) {
                this.toolbar.setSaveState('error');
                setTimeout(() => this.toolbar.setSaveState('idle'), 2000);
            }
        }
    }

    destroy() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        if (this.contentManager) {
            this.contentManager.off('contentChanged', this.boundHandleContentChange);
        }
        this.contentManager = null;
        this.toolbar = null;
        this.script = null;
    }
}