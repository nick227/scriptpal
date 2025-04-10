import { EDIT_COMMANDS, ERROR_TYPES } from '../constants.js';
import db from '../../../db/index.js';

class AISystemEventHandler {
    constructor() {
        // Command handlers map
        this.handlers = {
            edit: this.handleEdit.bind(this),
            save: this.handleSave.bind(this)
        };

        // Operation tracking
        this.pendingOperations = new Map();
    }

    /**
     * Generic command processor
     * @param {string} type - Command type (edit/save)
     * @param {Object} command - Command data
     * @returns {Promise<Object>} Operation result
     */
    async processCommand(type, command) {
        const operationId = Date.now().toString();
        this.pendingOperations.set(operationId, { type, command, status: 'processing' });

        try {
            const handler = this.handlers[type];
            if (!handler) {
                throw new Error(`Unknown command type: ${type}`);
            }

            const result = await handler(command);
            this.pendingOperations.set(operationId, {...result, status: 'completed' });

            return {
                success: true,
                operationId,
                ...result
            };
        } catch (error) {
            console.error(`Command processing error:`, error);
            return {
                success: false,
                error: error.message,
                type,
                command
            };
        }
    }

    /**
     * Handle edit operations
     * @param {Object} command - Edit command data
     */
    async handleEdit(command) {
        if (!Object.values(EDIT_COMMANDS).includes(command.command)) {
            throw new Error(`Invalid edit command: ${command.command}`);
        }
        return await this.executeOperation('edit', command);
    }

    /**
     * Handle save operations
     * @param {Object} command - Save command data
     */
    async handleSave({ script_id, target, value }) {
        const elementData = {
            script_id,
            type: target.toUpperCase(),
            subtype: this.deriveSubtype(value),
            content: typeof value === 'string' ? value : JSON.stringify(value)
        };

        return await this.executeOperation('save', elementData);
    }

    deriveSubtype(value) {
        if (typeof value === 'object') {
            return value.name || value.title || value.id || value.identifier || 'unnamed';
        }
        return typeof value === 'string' ? value.slice(0, 50) : 'default';
    }

    /**
     * Execute database operation
     * @param {string} type - Operation type
     * @param {Object} data - Transformed data
     */
    async executeOperation(type, data) {
        try {
            if (type === 'save') {
                const elements = await db.getScriptElements(data.script_id);
                const existingElement = elements.find(el =>
                    el.type === data.type &&
                    el.subtype === data.subtype
                );

                return existingElement ?
                    await db.updateElement(existingElement.id, data) :
                    await db.createElement(data);
            }
            throw new Error(`Unsupported operation type: ${type}`);
        } catch (error) {
            throw new Error(`Operation failed: ${error.message}`);
        }
    }

    /**
     * Get operation status
     * @param {string} operationId - Operation ID to check
     */
    getOperationStatus(operationId) {
        return this.pendingOperations.get(operationId) || { status: 'not_found' };
    }
}

// Export a singleton instance
export const aiSystemEventHandler = new AISystemEventHandler();