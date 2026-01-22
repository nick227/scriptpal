import { DEFAULT_FORMAT, isValidFormat } from '../../../constants/formats.js';
import { ScriptLine } from './ScriptLine.js';

export class ScriptDocument {
    /**
     * @param {ScriptLine[]} lines
     */
    constructor (lines = []) {
        this.lines = Array.isArray(lines) ? lines : [];
        this.lineIndex = new Map();
        this._contentCache = '';
        this._contentDirty = true;
        this._rebuildIndex();
    }

    /**
     * @param {string} [content]
     */
    static fromContent (content = '') {
        return ScriptDocument.fromStorage(content);
    }

    /**
     * Parse stored content into a ScriptDocument.
     * Supports JSON storage and legacy tag-based strings.
     * @param {string} [content]
     */
    static fromStorage (content = '') {
        if (typeof content !== 'string') {
            return new ScriptDocument([]);
        }

        const trimmed = content.trim();
        if (!trimmed) {
            return new ScriptDocument([]);
        }

        const parsed = ScriptDocument._tryParseJson(trimmed);
        if (parsed) {
            const lines = ScriptDocument._parseJsonLines(parsed);
            if (lines) {
                return new ScriptDocument(lines);
            }

            if (parsed && typeof parsed.content === 'string') {
                return ScriptDocument.fromStorage(parsed.content);
            }
        }

        const rawLines = content.split(/\r?\n/);
        const lines = rawLines.map(line => {
            const parsedLine = ScriptDocument._parseTaggedLine(line);
            return new ScriptLine({
                id: ScriptDocument.createLineId(),
                format: parsedLine.format,
                content: parsedLine.content
            });
        });
        return new ScriptDocument(lines);
    }

    static createLineId () {
        return `line_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    /**
     * @param {string} line
     */
    static _parseTaggedLine (line) {
        if (!line) {
            return { format: DEFAULT_FORMAT, content: '' };
        }

        const match = line.match(/<([\w-]+)>([\s\S]*)<\/\1>/);
        if (!match) {
            const selfClosingMatch = line.match(/<([\w-]+)\/>/);
            if (selfClosingMatch) {
                const format = selfClosingMatch[1].toLowerCase();
                return {
                    format: isValidFormat(format) ? format : DEFAULT_FORMAT,
                    content: ''
                };
            }
            return { format: DEFAULT_FORMAT, content: line };
        }

        const format = match[1].toLowerCase();
        const content = match[2];
        return {
            format: isValidFormat(format) ? format : DEFAULT_FORMAT,
            content
        };
    }

    static _tryParseJson (content) {
        const firstChar = content[0];
        if (firstChar !== '{' && firstChar !== '[') {
            return null;
        }

        try {
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }

    static _parseJsonLines (parsed) {
        const rawLines = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed.lines)
                ? parsed.lines
                : null;

        if (!rawLines) {
            return null;
        }

        return rawLines.map(line => {
            const format = isValidFormat(line?.format) ? line.format : DEFAULT_FORMAT;
            const content = typeof line?.content === 'string'
                ? line.content
                : typeof line?.text === 'string'
                    ? line.text
                    : '';
            return new ScriptLine({
                id: line?.id || ScriptDocument.createLineId(),
                format,
                content
            });
        });
    }

    /**
     * @param {object} data
     * @param {string} [data.id]
     * @param {string} [data.format]
     * @param {string} [data.content]
     */
    createLine (data = {}) {
        const format = isValidFormat(data.format) ? data.format : DEFAULT_FORMAT;
        return new ScriptLine({
            id: data.id || ScriptDocument.createLineId(),
            format,
            content: data.content || ''
        });
    }

    getLineById (lineId) {
        const index = this.lineIndex.get(lineId);
        return index === undefined ? null : this.lines[index];
    }

    getLineIndex (lineId) {
        const index = this.lineIndex.get(lineId);
        return index === undefined ? -1 : index;
    }

    /**
     * @param {number} index
     * @param {ScriptLine|object} lineData
     */
    insertLineAt (index, lineData) {
        const line = lineData instanceof ScriptLine ? lineData : this.createLine(lineData);
        const insertIndex = Math.min(this.lines.length, Math.max(0, index));
        this.lines.splice(insertIndex, 0, line);
        this.lineIndex.set(line.id, insertIndex);
        this._updateIndexFrom(insertIndex + 1);
        this._contentDirty = true;
        return line;
    }

    /**
     * @param {string} lineId
     * @param {ScriptLine|object} lineData
     */
    insertLineAfter (lineId, lineData) {
        const index = this.getLineIndex(lineId);
        if (index === -1) {
            return this.insertLineAt(this.lines.length, lineData);
        }
        return this.insertLineAt(index + 1, lineData);
    }

    removeLineById (lineId) {
        const index = this.getLineIndex(lineId);
        if (index === -1) return null;
        const [removed] = this.lines.splice(index, 1);
        this.lineIndex.delete(removed.id);
        this._updateIndexFrom(index);
        this._contentDirty = true;
        return removed;
    }

    removeLineByIndex (index) {
        if (index < 0 || index >= this.lines.length) return null;
        const [removed] = this.lines.splice(index, 1);
        this.lineIndex.delete(removed.id);
        this._updateIndexFrom(index);
        this._contentDirty = true;
        return removed;
    }

    /**
     * @param {string} lineId
     * @param {object} updates
     */
    updateLine (lineId, updates = {}) {
        const line = this.getLineById(lineId);
        if (!line) return null;
        let changed = false;
        if (updates.format && isValidFormat(updates.format) && line.format !== updates.format) {
            line.format = updates.format;
            changed = true;
        }
        if (updates.content !== undefined && line.content !== updates.content) {
            line.content = updates.content;
            changed = true;
        }
        if (changed) {
            this._contentDirty = true;
        }
        return line;
    }

    /**
     * @param {number} startIndex
     * @param {number} endIndex
     * @param {object} lineData
     */
    replaceRange (startIndex, endIndex, lineData) {
        const safeStart = Math.max(0, startIndex);
        const safeEnd = Math.min(this.lines.length - 1, endIndex);
        if (safeStart > safeEnd) {
            return null;
        }

        const removedLines = this.lines.slice(safeStart, safeEnd + 1);
        const newLine = this.createLine(lineData);
        this.lines.splice(safeStart, safeEnd - safeStart + 1, newLine);
        removedLines.forEach(line => this.lineIndex.delete(line.id));
        this.lineIndex.set(newLine.id, safeStart);
        this._updateIndexFrom(safeStart + 1);
        this._contentDirty = true;
        return newLine;
    }

    toContentString () {
        return this.toStorageString();
    }

    toStorageString () {
        if (!this._contentDirty) {
            return this._contentCache;
        }

        const payload = {
            version: 2,
            lines: this.lines.map(line => ({
                id: line.id,
                format: line.format,
                content: line.content
            }))
        };
        this._contentCache = JSON.stringify(payload);
        this._contentDirty = false;
        return this._contentCache;
    }

    toPlainText () {
        return this.lines.map(line => line.content).join('\n');
    }

    _rebuildIndex () {
        this.lineIndex.clear();
        this.lines.forEach((line, index) => {
            this.lineIndex.set(line.id, index);
        });
    }

    _updateIndexFrom (startIndex) {
        for (let i = startIndex; i < this.lines.length; i++) {
            this.lineIndex.set(this.lines[i].id, i);
        }
    }
}
