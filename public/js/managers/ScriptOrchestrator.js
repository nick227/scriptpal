import { EventManager } from '../core/EventManager.js';
import { StateManager } from '../core/StateManager.js';
import { isValidFormat } from '../constants/formats.js';

/**
 *
 */
export class ScriptOrchestrator {
    /**
     *
     * @param scriptStore
     * @param scriptSyncService
     * @param container
     * @param editorWidgetInstance
     */
    constructor (scriptStore, scriptSyncService, container, editorWidgetInstance) {
        if (!scriptStore) throw new Error('ScriptStore is required for ScriptOrchestrator');
        if (!scriptSyncService) throw new Error('ScriptSyncService is required for ScriptOrchestrator');
        if (!container) throw new Error('Container element is required for ScriptOrchestrator');
        if (!editorWidgetInstance) throw new Error('Editor instance is required for ScriptOrchestrator');
        this.scriptStore = scriptStore;
        this.syncService = scriptSyncService;
        this.container = container;
        this.editorWidgetInstance = editorWidgetInstance;

        // Initialize event handling
        this.eventManager = scriptStore.eventManager;
        this.stateManager = scriptStore.stateManager;
        if (!this.eventManager || !this.stateManager) {
            throw new Error('EventManager and StateManager are required for ScriptOrchestrator');
        }

        // Subscribe to events
        this.setupEventSubscriptions();
    }

    /**
     *
     */
    setupEventSubscriptions () {
        if (!this.eventManager) return;

        this.eventManager.subscribe(
            EventManager.EVENTS.SCRIPT.EDIT,
            this.handleScriptEdit.bind(this)
        );
    }

    /**
     *
     * @param scriptData
     */
    async handleScriptEdit (scriptData) {
        let currentScript = null;
        try {
            currentScript = await this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
            if (!scriptData || !currentScript) {
                throw new Error('Invalid script data or no current script');
            }

            // Validate required data
            if (!scriptData.content || !scriptData.versionNumber) {
                throw new Error('Missing required script data (content or version)');
            }

            // Create updated script object
            const updatedScript = {
                ...currentScript,
                content: scriptData.content,
                versionNumber: scriptData.versionNumber,
                timestamp: Date.now()
            };

            // Update cache and current script in the store
            this.scriptStore.updateScriptInCache(updatedScript);
            this.scriptStore.setCurrentScript(updatedScript, { source: 'edit' });

            // First update editor state
            if (Array.isArray(scriptData.commands) && scriptData.commands.length > 0) {
                await this.editorWidgetInstance.applyCommands(scriptData.commands);
            } else {
                console.warn('[ORCHESTRATOR] AI edit missing commands, skipping update');
            }

            // Then notify content update
            this.eventManager.publish(EventManager.EVENTS.EDITOR.CONTENT_UPDATE, {
                content: updatedScript.content,
                script: updatedScript,
                source: 'edit',
                isEdit: true,
                forceUpdate: false, // Don't force update to prevent loops
                clearFirst: true,
                timestamp: Date.now()
            });

            return updatedScript;

        } catch (error) {
            console.error('[ORCHESTRATOR] Edit failed:', error);

            this.eventManager.publish(EventManager.EVENTS.SCRIPT.ERROR, {
                error: error.message,
                type: 'edit',
                scriptId: currentScript ? currentScript.id : null,
                timestamp: Date.now()
            });

            return null;
        }
    }

    /**
     *
     * @param data
     */
    /**
     *
     */
    destroy () {
        if (this.eventManager) {
            this.eventManager.unsubscribeAll(this);
        }

        // Clear all state
        this.scriptStore = null;
        this.syncService = null;
        this.container = null;
        this.eventManager = null;
        this.stateManager = null;
    }

    // ==============================================
    // AI Script Operations
    // ==============================================

    /**
     * Handle script append operations from AI
     * @param {object} data - Append data
     * @param {string} data.content - Content to append
     * @param {boolean} data.isFromAppend - Whether this is from an append operation
     * @returns {Promise<boolean>} - Success status
     */
    async handleScriptAppend (data) {
        try {

            if (!data || !data.content) {
                throw new Error('Invalid append data: content is required');
            }

            // Get the editor content component
            const editorContent = this.editorWidgetInstance?.getComponent('content');
            if (!editorContent) {
                console.warn('[ScriptOrchestrator] Editor content component not available');
                throw new Error('Editor content component not available');
            }

            const rawLines = String(data.content).split(/\r?\n/);
            const lines = rawLines
                .map(line => line.trim())
                .filter(line => line.length > 0);
            console.log('[ScriptOrchestrator] append line normalization', {
                rawLineCount: rawLines.length,
                normalizedLineCount: lines.length
            });
            const lineItems = lines.map((line) => {
                const parsed = this.parseTaggedLine(line);
                if (parsed) {
                    return parsed;
                }
                return {
                    content: line,
                    format: this.determineContentFormat(line)
                };
            });
            const formatCounts = lineItems.reduce((acc, item) => {
                const key = item.format || 'unknown';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});
            console.log('[ScriptOrchestrator] append format breakdown', {
                formatCounts,
                sample: lineItems.slice(0, 5)
            });

            console.log('[ScriptOrchestrator] append lines', {
                totalLines: lineItems.length
            });

            const result = await editorContent.appendLines(lineItems);

            if (result.success) {

                // Emit success event
                this.eventManager.publish(EventManager.EVENTS.SCRIPT.APPENDED, {
                    content: data.content,
                    format: result.format,
                    element: result.element
                });

                return true;
            } else {
                throw new Error('Append operation failed');
            }
        } catch (error) {
            console.error('[ScriptOrchestrator] Script append failed:', error);
            this.handleError(error, 'handleScriptAppend');
            return false;
        }
    }

    /**
     * Determine the appropriate format for content
     * @param {string} content - The content to analyze
     * @returns {string} - The determined format
     */
    determineContentFormat (content) {
        if (!content || typeof content !== 'string') {
            return 'action';
        }

        const trimmedContent = content.trim();

        // Check for scene headers (usually in caps)
        if (trimmedContent.match(/^(INT\.|EXT\.|INTERIOR|EXTERIOR)/i)) {
            return 'header';
        }

        // Check for speaker names (usually in caps, short)
        if (trimmedContent.match(/^[A-Z][A-Z\s]+$/)) {
            return 'speaker';
        }

        // Check for dialogue (usually in quotes or starts with lowercase)
        if (trimmedContent.match(/^["'].*["']$/) || trimmedContent.match(/^[a-z]/)) {
            return 'dialog';
        }

        // Check for directions (usually in parentheses)
        if (trimmedContent.match(/^\(.*\)$/)) {
            return 'directions';
        }

        // Default to action
        return 'action';
    }

    parseTaggedLine (line) {
        if (typeof line !== 'string') {
            return null;
        }
        const trimmedLine = line.trim();
        if (!trimmedLine) {
            return null;
        }
        const selfClosingMatch = trimmedLine.match(/^<([\w-]+)\s*\/>$/);
        if (selfClosingMatch) {
            const format = selfClosingMatch[1].toLowerCase();
            if (!isValidFormat(format)) {
                return null;
            }
            if (format !== 'chapter-break') {
                return null;
            }
            return {
                format,
                content: ''
            };
        }
        const match = trimmedLine.match(/^<([\w-]+)>([\s\S]*)<\/\1>$/);
        if (!match) {
            return null;
        }
        const format = match[1].toLowerCase();
        if (!isValidFormat(format)) {
            return null;
        }
        return {
            format,
            content: match[2].trim()
        };
    }

    /**
     * Handle script prepend operations from AI
     * @param {object} data - Prepend data
     * @param {string} data.content - Content to prepend
     * @returns {Promise<boolean>} - Success status
     */
    async handleScriptPrepend (data) {
        try {

            if (!data || !data.content) {
                throw new Error('Invalid prepend data: content is required');
            }

            // Get the editor content component
            const editorContent = this.editorWidgetInstance?.getComponent('content');
            if (!editorContent) {
                throw new Error('Editor content component not available');
            }

            // Determine format based on content
            const format = this.determineContentFormat(data.content);

            // Prepend the content
            const result = await editorContent.prependContent(data.content, format);

            if (result.success) {

                // Emit success event
                this.eventManager.publish(EventManager.EVENTS.SCRIPT.PREPENDED, {
                    content: data.content,
                    format: format,
                    element: result.element
                });

                return true;
            } else {
                throw new Error('Prepend operation failed');
            }
        } catch (error) {
            console.error('[ScriptOrchestrator] Script prepend failed:', error);
            this.handleError(error, 'handleScriptPrepend');
            return false;
        }
    }

    /**
     * Handle script insert operations from AI
     * @param {object} data - Insert data
     * @param {string} data.content - Content to insert
     * @param {number} data.position - Position to insert at
     * @returns {Promise<boolean>} - Success status
     */
    async handleScriptInsert (data) {
        try {

            if (!data || !data.content || data.position === undefined) {
                throw new Error('Invalid insert data: content and position are required');
            }

            // Get the editor content component
            const editorContent = this.editorWidgetInstance?.getComponent('content');
            if (!editorContent) {
                throw new Error('Editor content component not available');
            }

            // Determine format based on content
            const format = this.determineContentFormat(data.content);

            // Insert the content
            const result = await editorContent.insertContentAt(data.content, data.position, format);

            if (result.success) {

                // Emit success event
                this.eventManager.publish(EventManager.EVENTS.SCRIPT.INSERTED, {
                    content: data.content,
                    format: format,
                    position: data.position,
                    element: result.element
                });

                return true;
            } else {
                throw new Error('Insert operation failed');
            }
        } catch (error) {
            console.error('[ScriptOrchestrator] Script insert failed:', error);
            this.handleError(error, 'handleScriptInsert');
            return false;
        }
    }

    /**
     * Handle errors in script operations
     * @param {Error} error - The error object
     * @param {string} context - The context where the error occurred
     */
    handleError (error, context) {
        const errorDetails = {
            context,
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        };

        console.error(`[ScriptOrchestrator] Error in ${context}:`, errorDetails);

        // Emit error event
        this.eventManager.publish(EventManager.EVENTS.SCRIPT.ERROR, errorDetails);
    }
}
