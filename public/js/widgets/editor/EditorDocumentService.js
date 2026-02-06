import { DEFAULT_FORMAT, resolveLineFormat, VALID_FORMATS } from '../../constants/formats.js';

import { ScriptDocument } from './model/ScriptDocument.js';


/**
 * EditorDocumentService - DOCUMENT MUTATION AUTHORITY.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * COMMAND CONTRACT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Command format (structured, lossless):
 *   | { command: 'ADD',    lineNumber, data: ScriptLine }
 *   | { command: 'DELETE', lineNumber, data: ScriptLine }  // snapshot for undo
 *   | { command: 'EDIT',   lineNumber, data: ScriptLine }
 *   | { command: 'MERGE_LINES', toLineId, fromLineId }
 *
 * ScriptLine:
 *   { id: string, format: string, content: string }
 *
 * Inverse commands include FULL LINE SNAPSHOTS:
 *   - No re-parsing
 *   - No reconstruction
 *   - No guessing
 *
 * Every command contains enough data to undo itself.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
const INITIAL_LINE_FORMAT = VALID_FORMATS.HEADER;

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

    getLineContentById (lineId) {
        const line = this.getLineById(lineId);
        return line ? line.content || '' : '';
    }

    isLineEmptyById (lineId) {
        return this.getLineContentById(lineId).trim() === '';
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
            this.document.insertLineAt(0, { format: INITIAL_LINE_FORMAT, content: '' });
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
        const resolvedFormat = resolveLineFormat(updates.format, { content: updates.content });
        const format = updates.format !== undefined ? resolvedFormat : line.format;
        const content = updates.content !== undefined ? updates.content : line.content;
        return {
            command: 'EDIT',
            lineNumber: this.getLineIndex(lineId) + 1,
            data: { format, content }
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
        const safeFormat = resolveLineFormat(format, { content });
        // NOTE: Do NOT cap lineNumber here - it will be capped during command execution.
        // Capping here breaks batch operations because getLineCount() hasn't changed yet.
        return {
            command: 'ADD',
            lineNumber: Math.max(0, insertIndex),
            data: { format: safeFormat, content }
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
     *
     * Command format (structured, lossless):
     *   { command: 'ADD'|'EDIT'|'DELETE'|'MERGE_LINES', lineNumber, data: ScriptLine }
     *
     * Inverse commands include FULL LINE SNAPSHOTS for lossless undo.
     * No re-parsing, no reconstruction, no guessing.
     *
     * @param {Array} commands
     * @returns {{success: boolean, results: Array, inverseCommands: Array}}
     */
    applyCommands (commands = []) {
        if (!Array.isArray(commands) || commands.length === 0) {
            return { success: false, reason: 'no_commands' };
        }

        const results = [];
        const inverseCommands = [];

        // Extract structured ScriptLine from command
        // Supports both new `data` format and legacy `value` format
        const extractLine = (cmd) => {
            if (cmd.data && typeof cmd.data === 'object') {
                return {
                    id: cmd.data.id || null,
                    format: resolveLineFormat(cmd.data.format, { content: cmd.data.content }),
                    content: cmd.data.content ?? ''
                };
            }
            // Legacy fallback: parse serialized value (to be removed)
            if (typeof cmd.value === 'string') {
                const match = cmd.value.match(/<([\w-]+)>([\s\S]*)<\/\1>/);
                if (match) {
                    return {
                        id: null,
                        format: resolveLineFormat(match[1]),
                        content: match[2]
                    };
                }
                return { id: null, format: DEFAULT_FORMAT, content: cmd.value };
            }
            return { id: null, format: DEFAULT_FORMAT, content: '' };
        };

        // Snapshot a line for inverse commands (FULL data, lossless)
        const snapshotLine = (line) => ({
            id: line.id,
            format: line.format,
            content: line.content
        });

        const addCommands = commands.filter(cmd => cmd.command === 'ADD')
            .sort((a, b) => (a.lineNumber || 0) - (b.lineNumber || 0));
        const otherCommands = commands.filter(cmd => cmd.command !== 'ADD')
            .sort((a, b) => (b.lineNumber || 0) - (a.lineNumber || 0));

        const orderedCommands = [...otherCommands, ...addCommands];

        for (const cmd of orderedCommands) {
            const { command, lineNumber } = cmd;
            try {
                if (command === 'DELETE') {
                    const removed = this.document.removeLineByIndex(lineNumber - 1);
                    if (!removed) {
                        throw new Error(`Line ${lineNumber} not found`);
                    }
                    // Inverse: ADD with full snapshot (preserves ID for exact restoration)
                    inverseCommands.unshift({
                        command: 'ADD',
                        lineNumber: Math.max(0, lineNumber - 1),
                        data: snapshotLine(removed)
                    });
                    results.push({ success: true, command: cmd, removed: snapshotLine(removed) });

                } else if (command === 'EDIT') {
                    const line = this.document.lines[lineNumber - 1];
                    if (!line) {
                        throw new Error(`Line ${lineNumber} not found`);
                    }
                    const before = snapshotLine(line);
                    const { format, content } = extractLine(cmd);
                    this.document.updateLine(line.id, { format, content });
                    const after = snapshotLine(line);

                    // Inverse: EDIT with before snapshot
                    inverseCommands.unshift({
                        command: 'EDIT',
                        lineNumber,
                        lineId: line.id,
                        data: before
                    });
                    results.push({ success: true, command: cmd, before, after });

                } else if (command === 'ADD') {
                    const lineData = extractLine(cmd);
                    const insertIndex = Math.min(this.document.lines.length, Math.max(0, lineNumber));
                    const added = this.document.insertLineAt(insertIndex, {
                        id: lineData.id, // Preserve ID if provided (for undo)
                        format: lineData.format,
                        content: lineData.content
                    });
                    if (!added) {
                        throw new Error(`Failed to add line at ${insertIndex}`);
                    }
                    // Inverse: DELETE with full snapshot
                    inverseCommands.unshift({
                        command: 'DELETE',
                        lineNumber: insertIndex + 1,
                        data: snapshotLine(added)
                    });
                    results.push({ success: true, command: cmd, added: snapshotLine(added) });

                } else if (command === 'MERGE_LINES') {
                    const { toLineId, fromLineId } = cmd;
                    if (!toLineId || !fromLineId) {
                        throw new Error('Merge requires toLineId and fromLineId');
                    }

                    const toIndex = this.getLineIndex(toLineId);
                    const fromIndex = this.getLineIndex(fromLineId);
                    if (toIndex === -1 || fromIndex === -1) {
                        throw new Error('Merge lines not found');
                    }

                    const toLine = this.document.lines[toIndex];
                    const fromLine = this.document.lines[fromIndex];
                    if (!toLine || !fromLine) {
                        throw new Error('Merge lines not found');
                    }

                    const toBefore = snapshotLine(toLine);
                    const fromBefore = snapshotLine(fromLine);

                    // Inverse: restore toLine, then ADD fromLine back
                    inverseCommands.unshift({
                        command: 'EDIT',
                        lineNumber: toIndex + 1,
                        lineId: toLine.id,
                        data: toBefore
                    });
                    inverseCommands.unshift({
                        command: 'ADD',
                        lineNumber: fromIndex,
                        data: fromBefore
                    });

                    const mergedContent = `${toLine.content}${fromLine.content}`;
                    this.document.updateLine(toLine.id, { content: mergedContent });
                    this.document.removeLineByIndex(fromIndex);

                    results.push({
                        success: true,
                        command: cmd,
                        merged: { to: toBefore, from: fromBefore }
                    });

                } else {
                    throw new Error(`Unknown command type: ${command}`);
                }
            } catch (error) {
                console.error('[EditorDocumentService] Command apply failed:', error);
                results.push({ success: false, command: cmd, error: error.message });
            }
        }

        this.ensureMinimumLine();

        return { success: true, results, inverseCommands };
    }
}
