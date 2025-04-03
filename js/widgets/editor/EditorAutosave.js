import { StateManager } from '../../core/StateManager.js';

export class EditorAutosave {
    constructor(scriptManager, scriptData) {
        // Validate script manager
        if (!scriptManager) {
            console.error('No script manager provided to EditorAutosave');
            throw new Error('Script manager is required');
        }

        // Validate script manager has required methods and properties
        if (typeof scriptManager.saveContent !== 'function') {
            console.error('Script manager missing saveContent method');
            throw new Error('Invalid script manager: missing saveContent method');
        }

        if (!scriptManager.stateManager) {
            console.error('Script manager missing stateManager');
            throw new Error('Invalid script manager: missing stateManager');
        }

        // Validate script data
        if (!scriptData) {
            console.error('No script data provided to EditorAutosave');
            throw new Error('Script data is required');
        }

        if (!scriptData.id) {
            console.error('Script data missing id');
            throw new Error('Invalid script data: missing id');
        }

        this.scriptManager = scriptManager;
        this.scriptData = scriptData;
        this.autosaveTimer = null;
        this.autosaveInterval = 30000; // 30 seconds
        this.lastSavedState = null;
        this.minorVersion = 0;
        this.toolbar = null;
    }

    async initialize() {
        try {
            if (this.scriptData.version_number) {
                // Parse version number format: major.minor (e.g. "1.5")
                const versionStr = typeof this.scriptData.version_number === 'number' ?
                    `${this.scriptData.version_number}.0` :
                    this.scriptData.version_number;
                const [major, minor] = versionStr.split('.').map(Number);
                this.minorVersion = minor || 0;
            } else {
                this.minorVersion = 0;
            }

            return true;
        } catch (error) {
            console.error('Error initializing EditorAutosave:', error);
            throw error;
        }
    }

    serializeEditorState(content, editorState) {
        console.log('EditorAutosave: Serializing state with content:', content);
        const state = {
            content: content, // Content already has format markers
            format: editorState.getCurrentFormat(),
            pageCount: editorState.getPageCount(),
            chapters: editorState.getChapters(),
            metadata: {
                lastModified: new Date().toISOString(),
                formatVersion: '2.0' // Updated version for new format
            }
        };
        console.log('EditorAutosave: Serialized state:', state);
        return state;
    }

    setToolbar(toolbar) {
        this.toolbar = toolbar;
    }

    async triggerAutosave(content, editorState) {
        console.log('EditorAutosave: triggerAutosave');
        if (this.autosaveTimer) {
            clearTimeout(this.autosaveTimer);
        }

        this.autosaveTimer = setTimeout(async() => {
            try {
                const currentState = this.serializeEditorState(content, editorState);

                // Only save if state has changed
                const currentStateStr = JSON.stringify(currentState);
                const lastSavedStateStr = JSON.stringify(this.lastSavedState);
                const hasChanged = currentStateStr !== lastSavedStateStr;

                if (hasChanged) {
                    this.minorVersion++;
                    if (this.toolbar) {
                        this.toolbar.setSaveState('autosaving');
                    }
                    console.log('EditorAutosave: Saving content state:', currentState);
                    await this.saveContent(currentState);
                    console.log('EditorAutosave: Finished');
                    if (this.toolbar) {
                        this.toolbar.setSaveState('saved');
                        setTimeout(() => this.toolbar.setSaveState('idle'), 2000);
                    }
                    this.lastSavedState = currentState;
                }
            } catch (error) {
                console.error('Autosave failed:', error);
                if (this.toolbar) {
                    this.toolbar.setSaveState('idle');
                }
            }
        }, this.autosaveInterval);
    }

    async saveContent(serializedState) {
        if (this.scriptManager) {
            console.log('EditorAutosave: Saving content state:', serializedState);
            const updateData = {
                content: serializedState, // Don't JSON.stringify, it's already an object
                version_number: `${this.scriptManager.major_version || 1}.${this.minorVersion}`,
                title: this.scriptData.title || 'Untitled Script',
                status: this.scriptData.status || 'draft'
            };
            console.log('EditorAutosave: Update data being sent:', updateData);

            try {
                await this.scriptManager.saveContent(updateData);

                // Update our script data from the state manager
                const updatedScript = this.scriptManager.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
                if (updatedScript) {
                    this.scriptData = updatedScript;
                }

                // Update last saved state with the actual saved content
                this.lastSavedState = serializedState;
            } catch (error) {
                console.error('Failed to save content:', error);
                throw error;
            }
        } else {
            console.warn('No script manager instance available for saving');
            throw new Error('Script manager not available');
        }
    }

    // Called when user explicitly saves a version
    async createMajorVersion(description) {
        if (this.scriptManager) {
            const currentState = this.lastSavedState;
            if (!currentState) return;

            this.scriptManager.major_version = (this.scriptManager.major_version || 1) + 1;
            this.minorVersion = 0;

            const versionData = {
                ...currentState,
                metadata: {
                    ...currentState.metadata,
                    description,
                    versionType: 'major',
                    versionNumber: `${this.scriptManager.major_version}.0`
                }
            };

            await this.saveContent(versionData);
        }
    }

    setLastSavedState(state) {
        this.lastSavedState = state;
    }

    destroy() {
        if (this.autosaveTimer) {
            clearTimeout(this.autosaveTimer);
        }
        this.autosaveTimer = null;
        this.lastSavedState = null;
    }
}