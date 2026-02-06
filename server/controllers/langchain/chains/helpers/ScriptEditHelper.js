import { VALID_FORMAT_VALUES } from '../../constants.js';

const XML_TAG_REGEX = /<([\w-]+)>([\s\S]*?)<\/\1>/;

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

      const parsed = this.parseContent(scriptContent);
      const { lines, format } = parsed;
      const results = [];
      let modified = false;

      // Sort commands in reverse order to handle line numbers correctly
      const addCommands = editCommands.filter(cmd => cmd.command === 'ADD').sort((a, b) => a.lineNumber - b.lineNumber);
      const otherCommands = editCommands.filter(cmd => cmd.command !== 'ADD').sort((a, b) => b.lineNumber - a.lineNumber);
      const sortedCommands = [...otherCommands, ...addCommands];

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
        content: modified ? this.serializeContent(lines, format) : scriptContent,
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
    const { command, value } = cmd;
    const lineNumber = Number.isFinite(cmd.lineNumber) ? Number(cmd.lineNumber) : NaN;
    const maxLine = command === 'ADD' ? lines.length + 1 : lines.length;

    if (Number.isNaN(lineNumber) || lineNumber < 1 || lineNumber > maxLine) {
      throw new Error(`${EditErrors.INVALID_LINE_NUMBER}: Line number ${cmd.lineNumber} is out of bounds`);
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
        const insertIndex = Math.max(0, Math.min(lines.length, Math.floor(lineNumber)));
        this.addLineAfter(lines, insertIndex, tag, content);
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
    const match = value.match(XML_TAG_REGEX);
    if (!match) {
      throw new Error(`${EditErrors.INVALID_XML_FORMAT}: Value must be in format <tag>content</tag>`);
    }

    const [, tag, content] = match;
    if (!VALID_FORMAT_VALUES.includes(tag)) {
      throw new Error(`${EditErrors.INVALID_TAG}: Invalid tag '${tag}'. Must be one of: ${VALID_FORMAT_VALUES.join(', ')}`);
    }

    return { tag, content: content.trim() };
  }

  /**
     * Parse script content into an array of lines while preserving line numbers
     * @private
     */
  static parseContent(content) {
    const parsed = this.tryParseJson(content);
    if (parsed) {
      return { format: 'json', lines: this.parseStructuredLines(parsed) };
    }
    return { format: 'xml', lines: this.parseScriptToLines(content) };
  }

  static tryParseJson(content) {
    if (!content || (content[0] !== '{' && content[0] !== '[')) {
      return null;
    }
    try {
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  static parseStructuredLines(parsed) {
    const rawLines = Array.isArray(parsed?.lines) ? parsed.lines : Array.isArray(parsed) ? parsed : [];
    return rawLines.map(line => {
      const format = line?.format || null;
      const content = typeof line?.content === 'string'
        ? line.content
        : typeof line?.text === 'string'
          ? line.text
          : '';
      const raw = line?.raw || (format ? `<${format}>${content}</${format}>` : '');
      return {
        raw,
        tag: format,
        content,
        id: line?.id || null
      };
    });
  }

  static parseScriptToLines(content) {
    return content.split('\n').map(line => {
      const match = line.match(XML_TAG_REGEX);
      if (!match) return { raw: line, tag: null, content: null, id: null };

      const [, tag, text] = match;
      return {
        raw: line,
        tag,
        content: text.trim(),
        id: null
      };
    });
  }

  /**
     * Convert lines array back to script content
     * @private
     */
  static serializeContent(lines, format) {
    if (format === 'json') {
      return this.linesToStructuredContent(lines);
    }
    return this.linesToScript(lines);
  }

  static linesToScript(lines) {
    if (!Array.isArray(lines) || lines.length === 0) return '';

    return lines
      .map(line => {
        if (!line.tag || line.content === null || line.content === undefined) return line.raw;
        return `<${line.tag}>${line.content}</${line.tag}>`;
      })
      .join('\n');
  }

  static linesToStructuredContent(lines) {
    if (!Array.isArray(lines) || lines.length === 0) return JSON.stringify({ version: 2, lines: [] });

    return JSON.stringify({
      version: 2,
      lines: lines.map(line => ({
        id: line.id || `line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        format: line.tag || line.format || 'action',
        content: line.content || ''
      }))
    });
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
