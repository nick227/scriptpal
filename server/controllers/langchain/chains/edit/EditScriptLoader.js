import db from '../../../../db/index.js';
import { ScriptEditHelper } from '../helpers/ScriptEditHelper.js';

/**
 * Handles script loading and content validation
 */
export class EditScriptLoader {
    /**
     * Load script content from the database
     * @param {number} scriptId - The ID of the script to load
     * @returns {Promise<string>} The script content
     */
    static async loadScriptContent(scriptId) {
        const script = await db.getScript(scriptId);
        if (!script) {
            throw new Error(`Script not found with ID: ${scriptId}`);
        }
        return script.content || '';
    }

    /**
     * Validate edit commands against script content
     * @param {Array} commands - Array of edit commands
     * @param {string} scriptContent - Current script content
     */
    static validateCommands(commands, scriptContent) {
        if (!Array.isArray(commands)) {
            throw new Error('Commands must be an array');
        }

        const lines = ScriptEditHelper.parseScriptToLines(scriptContent);

        for (const cmd of commands) {
            const { command, lineNumber, value } = cmd;

            // Validate command type
            if (!['ADD', 'EDIT', 'DELETE'].includes(command)) {
                throw new Error(`Invalid command type: ${command}`);
            }

            // Validate line number
            if (command === 'ADD') {
                if (lineNumber < 0 || lineNumber > lines.length + 1) {
                    throw new Error(`Invalid line number for ADD: ${lineNumber}`);
                }
            } else {
                if (lineNumber < 1 || lineNumber > lines.length) {
                    throw new Error(`Invalid line number: ${lineNumber}`);
                }
            }

            // Validate value for ADD/EDIT commands
            if (['ADD', 'EDIT'].includes(command) && !value) {
                throw new Error(`Value is required for ${command} command`);
            }
        }
    }

    /**
     * Generate a response message summarizing the edit results
     * @param {Array} commands - Array of edit commands
     * @param {string} content - Updated script content
     * @returns {string} Summary message
     */
    static generateResponseMessage(commands, content) {
        const successCount = commands.filter(cmd => cmd.success).length;
        const lines = content.split('\n').length;

        return `Successfully applied ${successCount} out of ${commands.length} edits. ` +
            `The script now has ${lines} lines.`;
    }
}