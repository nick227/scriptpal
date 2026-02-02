import { ScriptDocument } from '../model/ScriptDocument.js';

/**
 * Parses raw script content into normalized line data.
 * Handles JSON, tagged, and plain text formats.
 */
export class DocumentParser {
    /**
     * @param {object} lineFormatter - LineFormatter instance for format validation
     */
    constructor (lineFormatter) {
        this.lineFormatter = lineFormatter;
    }

    /**
     * Parse script content into normalized lines array.
     * @param {string} content - Raw script content
     * @returns {Array<{id: string, text: string, format: string}>}
     */
    parse (content) {
        if (!content || typeof content !== 'string') {
            return [];
        }

        const trimmed = content.trim();

        // Try JSON format first
        if (trimmed && (trimmed[0] === '{' || trimmed[0] === '[')) {
            const jsonLines = this._parseJsonFormat(trimmed);
            if (jsonLines) {
                return jsonLines;
            }
        }

        // Fall back to legacy tagged/plain text format
        return this._parseLegacyFormat(content);
    }

    /**
     * @param {string} trimmed - Trimmed content string
     * @returns {Array|null}
     */
    _parseJsonFormat (trimmed) {
        try {
            const parsed = JSON.parse(trimmed);
            const rawLines = Array.isArray(parsed?.lines)
                ? parsed.lines
                : Array.isArray(parsed)
                    ? parsed
                    : null;

            if (!rawLines) {
                return null;
            }

            return rawLines.map(line => this._normalizeJsonLine(line));
        } catch {
            return null;
        }
    }

    /**
     * @param {object} line - Raw line object from JSON
     * @returns {{id: string, text: string, format: string}}
     */
    _normalizeJsonLine (line) {
        const format = this.lineFormatter.isValidFormat(line?.format)
            ? line.format
            : this.lineFormatter.DEFAULT_FORMAT;

        const text = typeof line?.content === 'string'
            ? line.content
            : typeof line?.text === 'string'
                ? line.text
                : '';

        return {
            id: line?.id || ScriptDocument.createLineId(),
            text,
            format
        };
    }

    /**
     * @param {string} content - Raw content string
     * @returns {Array<{id: string, text: string, format: string}>}
     */
    _parseLegacyFormat (content) {
        const lines = content.split('\n');

        return lines.map(line => {
            const trimmedLine = line.trim();

            if (!trimmedLine) {
                return {
                    id: ScriptDocument.createLineId(),
                    text: '',
                    format: this.lineFormatter.DEFAULT_FORMAT
                };
            }

            // Try tagged format: <format>text</format>
            const tagMatch = trimmedLine.match(/<([\w-]+)>(.*?)<\/\1>/);
            if (tagMatch) {
                const format = tagMatch[1].toLowerCase();
                return {
                    id: ScriptDocument.createLineId(),
                    text: tagMatch[2],
                    format: this.lineFormatter.isValidFormat(format)
                        ? format
                        : this.lineFormatter.DEFAULT_FORMAT
                };
            }

            // Plain text
            return {
                id: ScriptDocument.createLineId(),
                text: trimmedLine,
                format: this.lineFormatter.DEFAULT_FORMAT
            };
        });
    }
}
