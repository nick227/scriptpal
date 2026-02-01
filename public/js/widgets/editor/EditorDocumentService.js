import { ScriptDocument } from './model/ScriptDocument.js';
import { DEFAULT_FORMAT, isValidFormat } from '../../constants/formats.js';

/**
 * Owns ScriptDocument and command application.
 */
export class EditorDocumentService {
    constructor () {
        this.document = new ScriptDocument();
    }

    /**
     * Replace the entire document content.
     * @param {string} content
     */
    setContent (content = '') {
        this.document = ScriptDocument.fromContent(content || '');
        this.ensureMinimumLine();
        return this.document;
    }

    /**
     * @returns {ScriptDocument}
     */
    getDocument () {
        return this.document;
    }

    getContent () {
        if (!this.document) {
            return '';
        }
        return this.document.toStorageString();
    }

    getPlainText () {
        if (!this.document) {
            return '';
        }
        return this.document.toPlainText();
    }

    getLines () {
        return this.document ? this.document.lines : [];
    }

    getLineById (lineId) {
        return this.document ? this.document.getLineById(lineId) : null;
    }

    getLineIndex (lineId) {
        return this.document ? this.document.getLineIndex(lineId) : -1;
    }

    getLineCount () {
        return this.document ? this.document.lines.length : 0;
    }

    getWordCount () {
        const text = this.getPlainText();
        if (!text) return 0;
        return text.split(/\s+/).filter(word => word.length > 0).length;
    }

    getCharacterCount () {
        const text = this.getPlainText();
        return text.length;
    }

    getChapterCount () {
        return this.document
            ? this.document.lines.filter(line => line.format === 'chapter-break').length
            : 0;
    }

    ensureMinimumLine () {
        if (!this.document) {
            this.document = new ScriptDocument();
        }
        if (this.document.lines.length === 0) {
            this.document.insertLineAt(0, { format: DEFAULT_FORMAT, content: '' });
        }
    }

    /**
     * @param {string} lineId
     * @param {object} updates
     */
    createEditCommandById (lineId, updates = {}) {
        const line = this.getLineById(lineId);
        if (!line) {
            return null;
        }
        const format = isValidFormat(updates.format) ? updates.format : line.format;
        const content = updates.content !== undefined ? updates.content : line.content;
        return {
            command: 'EDIT',
            lineNumber: this.getLineIndex(lineId) + 1,
            value: this._serializeLineValue(format, content)
        };
    }

    /**
     * @param {string} lineId
     */
    createDeleteCommandById (lineId) {
        const index = this.getLineIndex(lineId);
        if (index === -1) {
            return null;
        }
        return {
            command: 'DELETE',
            lineNumber: index + 1
        };
    }

    /**
     * @param {number} insertIndex
     * @param {object} options
     * @param {string} options.format
     * @param {string} options.content
     */
    createAddCommandAtIndex (insertIndex, { format = DEFAULT_FORMAT, content = '' } = {}) {
        const safeFormat = isValidFormat(format) ? format : DEFAULT_FORMAT;
        return {
            command: 'ADD',
            lineNumber: Math.min(this.getLineCount(), Math.max(0, insertIndex)),
            value: this._serializeLineValue(safeFormat, content)
        };
    }

    /**
     * @param {string} afterLineId
     * @param {object} options
     * @param {string} options.format
     * @param {string} options.content
     */
    createAddCommandAfterLine (afterLineId, { format = DEFAULT_FORMAT, content = '' } = {}) {
        const index = this.getLineIndex(afterLineId);
        const insertIndex = index === -1 ? this.getLineCount() : index + 1;
        return this.createAddCommandAtIndex(insertIndex, { format, content });
    }

    /**
     * Apply command-based edits to the document.
     * @param {Array} commands
     * @returns {object}
     */
    applyCommands (commands = []) {
        if (!Array.isArray(commands) || commands.length === 0) {
            return { success: false, reason: 'no_commands' };
        }

        const results = [];
        const inverseCommands = [];

        const parseValue = (value) => {
            if (typeof value !== 'string') {
                return { format: DEFAULT_FORMAT, content: '' };
            }

            const match = value.match(/<([\w-]+)>([\s\S]*)<\/\1>/);
            if (!match) {
                return { format: DEFAULT_FORMAT, content: value };
            }

            return {
                format: match[1].toLowerCase(),
                content: match[2]
            };
        };

        const addCommands = commands.filter(cmd => cmd.command === 'ADD')
            .sort((a, b) => a.lineNumber - b.lineNumber);
        const otherCommands = commands.filter(cmd => cmd.command !== 'ADD')
            .sort((a, b) => b.lineNumber - a.lineNumber);

        const orderedCommands = [...otherCommands, ...addCommands];

        for (const cmd of orderedCommands) {
            const { command, lineNumber, value } = cmd;
            try {
                if (command === 'DELETE') {
                    const removed = this.document.removeLineByIndex(lineNumber - 1);
                    if (!removed) {
                        throw new Error(`Line ${lineNumber} not found`);
                    }
                    inverseCommands.unshift({
                        command: 'ADD',
                        lineNumber: Math.max(0, lineNumber - 1),
                        value: this._serializeLineValue(removed.format, removed.content)
                    });
                } else if (command === 'EDIT') {
                    const line = this.document.lines[lineNumber - 1];
                    if (!line) {
                        throw new Error(`Line ${lineNumber} not found`);
                    }
                    inverseCommands.unshift({
                        command: 'EDIT',
                        lineNumber,
                        value: this._serializeLineValue(line.format, line.content)
                    });
                    const parsed = parseValue(value);
                    this.document.updateLine(line.id, {
                        format: parsed.format,
                        content: parsed.content
                    });
                } else if (command === 'ADD') {
                    const parsed = parseValue(value);
                    const insertIndex = Math.min(this.document.lines.length, Math.max(0, lineNumber));
                    const added = this.document.insertLineAt(insertIndex, {
                        format: parsed.format,
                        content: parsed.content
                    });
                    inverseCommands.unshift({
                        command: 'DELETE',
                        lineNumber: insertIndex + 1
                    });
                    if (!added) {
                        throw new Error(`Failed to add line at ${insertIndex}`);
                    }
                } else {
                    throw new Error(`Unknown command type: ${command}`);
                }

                results.push({ success: true, command: cmd });
            } catch (error) {
                console.error('[EditorDocumentService] Command apply failed:', error);
                results.push({ success: false, command: cmd, error: error.message });
            }
        }

        this.ensureMinimumLine();

        return { success: true, results, inverseCommands };
    }

    _serializeLineValue (format, content) {
        const safeFormat = isValidFormat(format) ? format : DEFAULT_FORMAT;
        const safeContent = typeof content === 'string' ? content : '';
        return `<${safeFormat}>${safeContent}</${safeFormat}>`;
    }
}
