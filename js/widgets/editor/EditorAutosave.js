export class EditorAutosave {
    constructor(script) {
        this.script = script;
        this.autosaveTimer = null;
        this.autosaveInterval = 30000; // 30 seconds
        this.lastSavedContent = '';
    }

    async initialize() {
        // No initialization needed
    }

    triggerAutosave(content) {
        if (this.autosaveTimer) {
            clearTimeout(this.autosaveTimer);
        }

        this.autosaveTimer = setTimeout(async() => {
            try {
                if (content !== this.lastSavedContent) {
                    await this.saveContent(content);
                    this.lastSavedContent = content;
                }
            } catch (error) {
                console.error('Autosave failed:', error);
            }
        }, this.autosaveInterval);
    }

    async saveContent(content) {
        if (this.script) {
            await this.script.saveContent(content);
        }
    }

    setLastSavedContent(content) {
        this.lastSavedContent = content;
    }

    destroy() {
        if (this.autosaveTimer) {
            clearTimeout(this.autosaveTimer);
        }
        this.autosaveTimer = null;
        this.lastSavedContent = '';
    }
}