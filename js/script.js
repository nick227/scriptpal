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
            return '<header></header>';
        }

        // Try to parse as JSON first (for backward compatibility)
        try {
            const parsedContent = JSON.parse(content);

            // Check for format version to handle different formats
            if (parsedContent.metadata && parsedContent.metadata.formatVersion) {
                if (parsedContent.lines) {
                    // Convert JSON lines to XML format
                    return parsedContent.lines.map(line =>
                        `<${line.format}>${line.text}</${line.format}>`
                    ).join('\n');
                }
            }

            // If it's our old structured format, convert to new format
            if (parsedContent.content) {
                // Convert legacy content to new format
                const lines = parsedContent.content.split('\n');
                return lines.map(line =>
                    `<action>${line.trim()}</action>`
                ).join('\n');
            }

            // If it's some other JSON format, wrap it
            return `<action>${content}</action>`;
        } catch (e) {
            // Not JSON, check if it's already in XML format
            if (content.includes('</')) {
                return content;
            }
            // Legacy plain text format - wrap it in action tags
            return content.split('\n')
                .filter(line => line.trim())
                .map(line => `<action>${line.trim()}</action>`)
                .join('\n');
        }
    }

    async saveContent(content, title) {
        try {
            // Ensure content is a string
            if (typeof content !== 'string') {
                throw new Error('Content must be a string');
            }

            // Validate XML format
            if (!this.isValidXMLFormat(content)) {
                throw new Error('Invalid script format. Content must be in XML format with valid tags.');
            }

            // Get current script
            const currentScript = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
            if (!currentScript) {
                throw new Error('No current script found');
            }

            // Format version number
            const version = this.major_version || 1;
            const formattedVersion = version.toString().includes('.') ?
                version.toString() :
                `${version.toString()}.0`;

            // Update script content
            const response = await this.api.updateScript(currentScript.id, {
                content: content,
                version: formattedVersion,
                title: title || currentScript.title // Use passed title or fallback to current
            });

            // Handle response
            if (!response) {
                throw new Error('Failed to save script - no response from server');
            }

            // Update state if save was successful
            this.stateManager.setState(StateManager.KEYS.CURRENT_SCRIPT, {
                ...currentScript,
                content: content,
                version_number: formattedVersion
            });

            return true;
        } catch (error) {
            console.error('Failed to save script content:', error);
            this.eventManager.publish(EventManager.EVENTS.SCRIPT.UPDATED, {
                type: 'error',
                message: `Failed to save: ${error.message}`
            });
            throw error;
        }
    }

    isValidXMLFormat(content) {
        const validTags = ['header', 'action', 'speaker', 'dialog', 'directions'];
        const xmlRegex = new RegExp(`<(${validTags.join('|')})>(.*?)</\\1>`, 'g');
        const matches = content.match(xmlRegex);

        // Content should have at least one valid tag
        if (!matches) {
            return false;
        }

        // Check for any invalid tags
        const invalidTagRegex = /<(\w+)>/g;
        let match;
        while ((match = invalidTagRegex.exec(content)) !== null) {
            const tag = match[1];
            if (!validTags.includes(tag)) {
                return false;
            }
        }

        return true;
    }
}