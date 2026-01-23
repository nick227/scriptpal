// Valid script tags - cached for performance
const _VALID_TAGS = Object.freeze(['header', 'action', 'speaker', 'dialog', 'directions', 'chapter-break']);

// Error types for better error handling
const _EditErrors = {
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_LINE_NUMBER: 'INVALID_LINE_NUMBER',
  INVALID_XML_FORMAT: 'INVALID_XML_FORMAT',
  INVALID_TAG: 'INVALID_TAG',
  UNKNOWN_COMMAND: 'UNKNOWN_COMMAND'
};

/**
 * Helper class for script editing operations
 */
export class RawScriptEditHelper {
  /**
     * Process script edits by applying commands to modify script content
     * @param {string} scriptContent - Original script content with XML tags
     * @param {string} newContent - New content to replace the script content
     * @returns {{content: string, results: Array<Object>, modified: boolean}} Edit operation results
     * @throws {Error} If input validation fails
     */
}
