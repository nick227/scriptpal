import { StateManager } from '../../core/StateManager.js';
import { debugLog } from '../../core/logger.js';

/**
 *
 */
export class EditorAutosave {
    /**
     *
     * @param options
     */
    constructor (options) {
        if (!options.content) throw new Error('Content manager is required');
        if (!options.saveHandler) throw new Error('Save handler is required');

        this.content = options.content;
        this.saveHandler = options.saveHandler;
        this.lastSavedContent = '';
        this.saveTimeout = null;
        this.SAVE_DELAY = 2000; // 2 seconds
        this.isEnabled = true;

        this.setupAutosave();
    }

    /**
     *
     */
    setupAutosave () {
        // Listen for content changes
        if (this.content.onChange) {
            this.content.onChange(() => {
                if (!this.isEnabled) return;
                this.debouncedSave();
            });
        }
    }

    /**
     *
     */
    debouncedSave () {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        this.saveTimeout = setTimeout(async () => {
            await this.saveContent();
        }, this.SAVE_DELAY);
    }

    /**
     *
     */
    async saveContent () {
        try {
            const currentContent = this.content.getContent();

            // Skip if content hasn't changed
            if (currentContent === this.lastSavedContent) {
                debugLog('[AUTOSAVE] Content unchanged, skipping save');
                return;
            }

            debugLog('[AUTOSAVE] Saving content...');
            const success = await this.saveHandler(currentContent);

            if (success) {
                this.lastSavedContent = currentContent;
                debugLog('[AUTOSAVE] Content saved successfully');
            }
        } catch (error) {
            console.error('[AUTOSAVE] Save failed:', error);
        }
    }

    /**
     *
     * @param content
     */
    setLastSavedContent (content) {
        if (content === undefined || content === null) {
            console.warn('[AUTOSAVE] Invalid content provided to setLastSavedContent');
            return;
        }
        debugLog('[AUTOSAVE] Setting last saved content');
        this.lastSavedContent = content;
    }

    /**
     *
     */
    enable () {
        this.isEnabled = true;
    }

    /**
     *
     */
    disable () {
        this.isEnabled = false;
    }

    /**
     *
     */
    destroy () {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.content = null;
        this.saveHandler = null;
    }
}
