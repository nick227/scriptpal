import { StateManager } from './core/StateManager.js';
import { EventManager } from './core/EventManager.js';

export class ScriptPalScript {
    constructor(api, user, chat) {
        this.api = api;
        this.user = user;
        this.chat = chat;
        this.stateManager = null;
        this.eventManager = null;
        this.major_version = 1;
    }

    async initialize() {
        if (!this.user.currentUser) {
            throw new Error('Cannot initialize script manager without authenticated user');
        }

        this.userId = this.user.currentUser.id;
        const scripts = await this.api.getAllScriptsByUser(this.userId);

        this.stateManager.setState(StateManager.KEYS.SCRIPTS, scripts);

        this.checkCurrentScriptId();
        this.loadCurrentScript();
    }

    clearCurrentScript() {
        localStorage.removeItem('currentScriptId');
        this.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT, null);
    }

    checkCurrentScriptId() {
        const currentScriptId = localStorage.getItem('currentScriptId');

        if (currentScriptId) {
            this.setCurrentScript(currentScriptId);
        } else {

            // If no script selected but we have scripts, select the first one
            const scripts = this.stateManager.getState(StateManager.KEYS.SCRIPTS);
            if (scripts && scripts.length > 0) {

                this.setCurrentScript(scripts[0].id);
            }
        }
    }

    setCurrentScript(currentScriptId) {

        const scripts = this.stateManager.getState(StateManager.KEYS.SCRIPTS);


        // Convert IDs to same type for comparison
        currentScriptId = parseInt(currentScriptId, 10);
        const currentScript = scripts.find(script => script.id === currentScriptId);


        if (!currentScript) {
            console.warn('No script found with ID:', currentScriptId);
            return;
        }

        localStorage.setItem('currentScriptId', currentScriptId);
        this.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT, currentScript);

        // Set major version from script
        if (currentScript.version_number) {
            this.major_version = parseInt(currentScript.version_number, 10);
        }

        this.eventManager.publish(EventManager.EVENTS.SCRIPT.SELECTED, { scriptId: currentScriptId });

        // Load the script content immediately
        this.loadCurrentScript();
    }

    loadCurrentScript() {
        const scripts = this.stateManager.getState(StateManager.KEYS.SCRIPTS);
        if (!scripts || scripts.length === 0) {
            this.eventManager.publish(EventManager.EVENTS.SCRIPT.UPDATED, {
                message: "You don't have any scripts yet. Would you like to create one?",
                type: 'assistant'
            });
            return;
        }

        const currentScript = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
        if (currentScript) {
            // Parse version number if it exists
            if (currentScript.version_number) {
                // Convert version number to string format if it's a number
                const versionStr = typeof currentScript.version_number === 'number' ?
                    `${currentScript.version_number}.0` :
                    currentScript.version_number;

                const [major] = versionStr.split('.');
                this.major_version = parseInt(major, 10) || 1;
            }

            // Try to parse the content as serialized state
            let contentMessage;
            try {
                const state = JSON.parse(currentScript.content);
                contentMessage = `Loaded "${currentScript.title}" (v${currentScript.version_number || '1.0'})`;
                if (state.metadata && state.metadata.lastModified) {
                    const lastModified = new Date(state.metadata.lastModified);
                    contentMessage += ` - Last modified ${lastModified.toLocaleString()}`;
                }
            } catch (e) {
                // Legacy content format
                contentMessage = `Loaded "${currentScript.title}" (Legacy Format)`;
            }

            this.eventManager.publish(EventManager.EVENTS.SCRIPT.UPDATED, {
                message: contentMessage,
                type: 'assistant'
            });
            this.eventManager.publish(EventManager.EVENTS.SCRIPT.ACTIONS, {
                actions: [
                    { text: "Edit Script", actionType: "edit", scriptId: currentScript.id },
                    { text: "Create Version", actionType: "version", scriptId: currentScript.id },
                    { text: "Delete Script", actionType: "delete", scriptId: currentScript.id }
                ]
            });
        } else {
            this.eventManager.publish(EventManager.EVENTS.SCRIPT.UPDATED, {
                message: "What script should we work on?",
                type: 'assistant'
            });
            this.eventManager.publish(EventManager.EVENTS.SCRIPT.BUTTONS, {
                buttons: scripts.map(script => ({
                    text: script.title,
                    actionType: "select",
                    scriptId: script.id
                }))
            });
        }
    }

    setManagers(stateManager, eventManager) {
        this.stateManager = stateManager;
        this.eventManager = eventManager;
    }

    getContent() {
        const currentScript = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
        if (!currentScript) return null;

        let content = currentScript.content;

        // Handle empty content - start with HEADER format
        if (!content || content.trim() === '') {
            return JSON.stringify({
                content: '[HEADER][/HEADER]',
                format: 'header',
                metadata: {
                    lastModified: new Date().toISOString(),
                    version: currentScript.version_number || '1.0',
                    formatVersion: '2.0'
                }
            });
        }

        // Try to parse as JSON first
        try {
            const parsedContent = JSON.parse(content);

            // Check for format version to handle different formats
            if (parsedContent.metadata && parsedContent.metadata.formatVersion) {
                if (parsedContent.metadata.formatVersion === '2.0') {
                    // New format with markers - return as is
                    return content;
                }
            }

            // If it's our old structured format, convert to new format
            if (parsedContent.content) {
                // Convert legacy content to new format
                const lines = parsedContent.content.split('\n');
                const formattedLines = lines.map(line => {
                    // Default to ACTION for legacy content
                    return `[ACTION]${line.trim()}[/ACTION]`;
                }).join('\n');

                return JSON.stringify({
                    content: formattedLines,
                    format: parsedContent.format || 'action',
                    pageCount: parsedContent.pageCount || 1,
                    chapters: parsedContent.chapters || [],
                    metadata: {
                        lastModified: new Date().toISOString(),
                        formatVersion: '2.0'
                    }
                });
            }

            // If it's some other JSON format, wrap it
            return JSON.stringify({
                content: `[ACTION]${content}[/ACTION]`,
                format: 'action',
                metadata: {
                    lastModified: currentScript.updated_at,
                    version: currentScript.version_number || '1.0',
                    formatVersion: '2.0'
                }
            });
        } catch (e) {
            // Legacy plain text format - wrap it in our structure
            return JSON.stringify({
                content: `[ACTION]${content}[/ACTION]`,
                format: 'action',
                metadata: {
                    lastModified: currentScript.updated_at,
                    version: currentScript.version_number || '1.0',
                    formatVersion: '2.0'
                }
            });
        }
    }

    async saveContent(updateData) {

        try {
            const currentScript = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
            if (!currentScript || !currentScript.id) {
                throw new Error('No current script selected');
            }

            // Handle content serialization
            let contentToSave = updateData.content;

            // If content is an object and not already stringified, stringify it
            if (typeof contentToSave === 'object') {
                contentToSave = JSON.stringify(contentToSave);
            } else if (typeof contentToSave === 'string') {
                // Validate if it's proper JSON
                try {
                    JSON.parse(contentToSave);
                    // If parse successful, it's valid JSON, use as is
                } catch (e) {
                    console.warn('Content is not valid JSON, wrapping it');
                    contentToSave = JSON.stringify({
                        content: contentToSave,
                        format: 'text',
                        metadata: {
                            lastModified: new Date().toISOString(),
                            version: updateData.version_number || currentScript.version_number || '1.0'
                        }
                    });
                }
            } else {
                throw new Error('Invalid content format: ' + typeof contentToSave);
            }

            // Prepare update data
            const scriptData = {
                ...currentScript,
                content: contentToSave,
                version_number: updateData.version_number || currentScript.version_number || '1.0',
                title: updateData.title || currentScript.title || 'Untitled Script',
                status: updateData.status || currentScript.status || 'draft'
            };

            console.log('Saving script id:', currentScript.id);
            console.log('Saving script data:', scriptData);

            // Save to server
            const updatedScript = await this.api.updateScript(currentScript.id, scriptData);

            if (!updatedScript) {
                throw new Error('Failed to update script - no response from server');
            }

            console.log('Server response:', {
                id: updatedScript.id,
                title: updatedScript.title,
                version: updatedScript.version_number
            });

            // Update both the current script and the scripts list
            this.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT, updatedScript);

            // Update the script in the scripts list
            const scripts = this.stateManager.getState(StateManager.KEYS.SCRIPTS);
            if (scripts) {
                const updatedScripts = scripts.map(script =>
                    script.id === updatedScript.id ? updatedScript : script
                );
                this.stateManager.setState(StateManager.KEYS.SCRIPTS, updatedScripts);
            }

            // Publish events
            this.eventManager.publish(EventManager.EVENTS.SCRIPT.UPDATED, {
                script: updatedScript,
                type: 'success',
                message: `Saved "${updatedScript.title}" (v${updatedScript.version_number})`
            });

            return true;
        } catch (error) {
            console.error('Failed to save script content:', error);
            // Publish error event
            this.eventManager.publish(EventManager.EVENTS.SCRIPT.UPDATED, {
                type: 'error',
                message: `Failed to save: ${error.message}`
            });
            throw error;
        }
    }
}