// Valid script tags - cached for performance
const VALID_TAGS = Object.freeze(['header', 'action', 'speaker', 'dialog', 'directions', 'chapter-break']);

// Error types for better error handling
const EditErrors = {
    INVALID_INPUT: 'INVALID_INPUT',
    INVALID_LINE_NUMBER: 'INVALID_LINE_NUMBER',
    INVALID_XML_FORMAT: 'INVALID_XML_FORMAT',
    INVALID_TAG: 'INVALID_TAG',
    UNKNOWN_COMMAND: 'UNKNOWN_COMMAND'
};

/**
 * Helper class for script editing operations
 */
export class ScriptEditHelper {
    /**
     * Process script edits by applying commands to modify script content
     * @param {string} scriptContent - Original script content with XML tags
     * @param {Array<{command: string, lineNumber: number, value?: string}>} editCommands - Array of edit commands
     * @returns {{content: string, results: Array<Object>, modified: boolean}} Edit operation results
     * @throws {Error} If input validation fails
     */
    static editScript(scriptContent, editCommands) {
        try {
            // Input validation with detailed errors
            if (!scriptContent || typeof scriptContent !== 'string') {
                throw new Error(`${EditErrors.INVALID_INPUT}: Script content must be a non-empty string`);
            }
            if (!Array.isArray(editCommands) || editCommands.length === 0) {
                throw new Error(`${EditErrors.INVALID_INPUT}: Edit commands must be a non-empty array`);
            }

            // Parse script into lines while preserving line numbers
            const lines = this.parseScriptToLines(scriptContent);
            const results = [];
            let modified = false;

            // Sort commands in reverse order to handle line numbers correctly
            const sortedCommands = [...editCommands].sort((a, b) => b.lineNumber - a.lineNumber);

            // Process commands in batches for better performance
            for (const cmd of sortedCommands) {
                try {
                    const result = this.processCommand(cmd, lines);
                    if (result.success) {
                        modified = true;
                    }
                    results.push(result);
                } catch (cmdError) {
                    console.error('Command processing error:', { command: cmd, error: cmdError.message });
                    results.push({
                        success: false,
                        command: cmd,
                        error: cmdError.message
                    });
                }
            }

            return {
                content: modified ? this.linesToScript(lines) : scriptContent,
                results,
                modified
            };

        } catch (error) {
            console.error('Script edit failed:', error);
            throw error;
        }
    }

    /**
     * Process a single edit command
     * @private
     */
    static processCommand(cmd, lines) {
        const { command, lineNumber, value } = cmd;

        // Validate line number bounds
        if (lineNumber < 1 || lineNumber > lines.length + 1) {
            throw new Error(`${EditErrors.INVALID_LINE_NUMBER}: Line number ${lineNumber} is out of bounds`);
        }

        // Validate XML format for ADD/EDIT commands
        if (command !== 'DELETE') {
            if (!value) {
                throw new Error(`${EditErrors.INVALID_INPUT}: Value is required for ${command} command`);
            }

            const { tag, content } = this.parseXmlValue(value);

            // Execute the command
            switch (command) {
                case 'EDIT':
                    this.editLineAt(lines, lineNumber, tag, content);
                    break;
                case 'ADD':
                    this.addLineAfter(lines, lineNumber, tag, content);
                    break;
                default:
                    throw new Error(`${EditErrors.UNKNOWN_COMMAND}: Unknown command type ${command}`);
            }
        } else {
            this.deleteLineAt(lines, lineNumber);
        }

        return { success: true, command: cmd };
    }

    /**
     * Parse and validate XML value
     * @private
     */
    static parseXmlValue(value) {
        const match = value.match(/<(\w+)>([^<]+)<\/\1>/);
        if (!match) {
            throw new Error(`${EditErrors.INVALID_XML_FORMAT}: Value must be in format <tag>content</tag>`);
        }

        const [, tag, content] = match;
        if (!VALID_TAGS.includes(tag)) {
            throw new Error(`${EditErrors.INVALID_TAG}: Invalid tag '${tag}'. Must be one of: ${VALID_TAGS.join(', ')}`);
        }

        return { tag, content: content.trim() };
    }

    /**
     * Parse script content into an array of lines while preserving line numbers
     * @private
     */
    static parseScriptToLines(content) {
        return content.split('\n').map(line => {
            const match = line.match(/<(\w+)>([^<]+)<\/\1>/);
            if (!match) return { raw: line, tag: null, content: null };

            const [, tag, text] = match;
            return {
                raw: line,
                tag,
                content: text.trim()
            };
        });
    }

    /**
     * Convert lines array back to script content
     * @private
     */
    static linesToScript(lines) {
        if (!Array.isArray(lines) || lines.length === 0) return '';

        return lines
            .map(line => {
                if (!line.tag || !line.content) return line.raw;
                return `<${line.tag}>${line.content}</${line.tag}>`;
            })
            .join('\n');
    }

    /**
     * Delete a line at the specified index
     * @private
     */
    static deleteLineAt(lines, lineNumber) {
        if (lineNumber < 1 || lineNumber > lines.length) {
            throw new Error(`${EditErrors.INVALID_LINE_NUMBER}: Cannot delete line ${lineNumber}`);
        }
        lines.splice(lineNumber - 1, 1);
    }

    /**
     * Edit a line at the specified index
     * @private
     */
    static editLineAt(lines, lineNumber, tag, content) {
        if (lineNumber < 1 || lineNumber > lines.length) {
            throw new Error(`${EditErrors.INVALID_LINE_NUMBER}: Cannot edit line ${lineNumber}`);
        }

        lines[lineNumber - 1] = {
            raw: `<${tag}>${content}</${tag}>`,
            tag,
            content
        };
    }

    /**
     * Add a new line after the specified index
     * @private
     */
    static addLineAfter(lines, lineNumber, tag, content) {
        if (lineNumber < 0 || lineNumber > lines.length) {
            throw new Error(`${EditErrors.INVALID_LINE_NUMBER}: Cannot add after line ${lineNumber}`);
        }

        lines.splice(lineNumber, 0, {
            raw: `<${tag}>${content}</${tag}>`,
            tag,
            content
        });
    }
}