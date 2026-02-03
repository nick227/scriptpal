import { debugLog } from '../../../core/logger.js';

/**
 * EditorCommandExecutor
 * Handles the low-level mechanics of applying AI-driven mutations to the editor.
 * This class owns coordinate conversion, command formatting, and editor protocol.
 */
export class EditorCommandExecutor {
    constructor () {
        this.content = null;
    }

    /**
     * @param {object} content - The editor content instance
     */
    setContent (content) {
        this.content = content;
    }

    /**
     * Build the specialized XML-like value string for editor commands
     * @private
     */
    _buildCommandValue (format, content) {
        const safeFormat = typeof format === 'string' && format.trim().length > 0 ? format : 'action';
        const safeContent = typeof content === 'string' ? content : '';
        return `<${safeFormat}>${safeContent}</${safeFormat}>`;
    }

    /**
     * Apply low-level editor commands with coordinate normalization
     * @private
     */
    async _applyCommands (commands, source) {
        if (!this.content || typeof this.content.applyCommands !== 'function') {
            throw new Error('Editor content is not available for commands');
        }

        // Convert 0-based internal coordinates to 1-based editor coordinates
        const normalizedCommands = commands.map(cmd => {
            if (cmd.lineNumber !== undefined) {
                return { ...cmd, lineNumber: cmd.lineNumber + 1 };
            }
            return cmd;
        });

        return this.content.applyCommands(normalizedCommands, { source });
    }

    /**
     * Handle formatting change for a line
     */
    async handleFormatCommand (data) {
        const { lineId, format } = data;
        const line = this.content.getLineById(lineId);
        if (!line) throw new Error('Line not found');

        this.content.applyFormatCommand({
            type: 'setFormat',
            lineId,
            format
        });
        return { success: true, lineId, format };
    }

    /**
     * Handle inserting text at a specific location
     */
    async handleInsertCommand (data) {
        const { text, format, afterLineId } = data;
        const afterIndex = afterLineId ? this.content.getLineIndex(afterLineId) : -1;
        const insertIndex = afterIndex === -1 ? this.content.getLineCount() : afterIndex + 1;
        
        const command = {
            command: 'ADD',
            lineNumber: insertIndex,
            value: this._buildCommandValue(format, text)
        };
        const result = await this._applyCommands([command], 'ai_insert');
        const line = this.content.getLines()[insertIndex] || null;
        return { success: result.success, lineId: line?.id, result };
    }

    /**
     * Handle deleting a specific line
     */
    async handleDeleteCommand (data) {
        const { lineId } = data;
        const index = this.content.getLineIndex(lineId);
        if (index === -1) throw new Error('Line not found');
        
        const command = {
            command: 'DELETE',
            lineNumber: index
        };
        const result = await this._applyCommands([command], 'ai_delete');
        return { success: result.success };
    }

    /**
     * Handle replacing text on a line while preserving format
     */
    async handleReplaceCommand (data) {
        const { lineId, text } = data;
        const line = this.content.getLineById(lineId);
        if (!line) throw new Error('Line not found');

        const command = {
            command: 'EDIT',
            lineNumber: this.content.getLineIndex(lineId),
            value: this._buildCommandValue(line.format, text)
        };
        const result = await this._applyCommands([command], 'ai_replace');
        return { success: result.success, lineId };
    }

    /**
     * Handle appending content to the end of the script
     */
    async handleAppendCommand (data) {
        const { content, format = 'action' } = data;
        const command = {
            command: 'ADD',
            lineNumber: this.content.getLineCount(),
            value: this._buildCommandValue(format, content)
        };
        const result = await this._applyCommands([command], 'ai_append');
        return { success: result.success, operation: 'append', result };
    }

    /**
     * Handle prepending content to the beginning of the script
     */
    async handlePrependCommand (data) {
        const { content, format = 'action' } = data;
        const command = {
            command: 'ADD',
            lineNumber: 0,
            value: this._buildCommandValue(format, content)
        };
        const result = await this._applyCommands([command], 'ai_prepend');
        return { success: result.success, operation: 'prepend', result };
    }

    /**
     * Handle inserting at a specific numeric index
     */
    async handleInsertAtCommand (data) {
        const { content, position, format = 'action' } = data;
        const command = {
            command: 'ADD',
            lineNumber: position,
            value: this._buildCommandValue(format, content)
        };
        const result = await this._applyCommands([command], 'ai_insert_at');
        return { success: result.success, operation: 'insertAt', position, result };
    }

    /**
     * Handle replacing a range of lines with new content
     */
    async handleReplaceRangeCommand (data) {
        const { content, startPosition, endPosition, format = 'action' } = data;
        const lineCount = this.content.getLineCount();
        const safeStart = Math.max(0, startPosition);
        const safeEnd = Math.min(lineCount - 1, endPosition);
        
        if (safeStart > safeEnd) {
            throw new Error('Invalid replace range');
        }

        const deleteCommands = [];
        for (let index = safeEnd; index >= safeStart; index -= 1) {
            deleteCommands.push({
                command: 'DELETE',
                lineNumber: index
            });
        }

        const addCommand = {
            command: 'ADD',
            lineNumber: safeStart,
            value: this._buildCommandValue(format, content)
        };

        const result = await this._applyCommands([...deleteCommands, addCommand], 'ai_replace_range');
        return { success: result.success, operation: 'replaceRange', startPosition, endPosition, result };
    }
}
