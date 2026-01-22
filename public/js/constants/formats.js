/**
 * Centralized script format constants
 * This module defines all valid script formats used throughout the application
 * and ensures consistency between frontend and backend
 */

/**
 * Valid script format types
 * These must match the server-side format definitions
 */
export const VALID_FORMATS = Object.freeze({
    HEADER: 'header',
    ACTION: 'action',
    SPEAKER: 'speaker',
    DIALOG: 'dialog',
    DIRECTIONS: 'directions',
    CHAPTER_BREAK: 'chapter-break'
});

/**
 * Array of all valid format values for iteration
 */
export const VALID_FORMAT_VALUES = Object.freeze(Object.values(VALID_FORMATS));

/**
 * Default format for new lines
 */
export const DEFAULT_FORMAT = VALID_FORMATS.ACTION;

/**
 * Format display names for UI
 */
export const FORMAT_DISPLAY_NAMES = Object.freeze({
    [VALID_FORMATS.HEADER]: 'Scene Header',
    [VALID_FORMATS.ACTION]: 'Action',
    [VALID_FORMATS.SPEAKER]: 'Speaker',
    [VALID_FORMATS.DIALOG]: 'Dialog',
    [VALID_FORMATS.DIRECTIONS]: 'Directions',
    [VALID_FORMATS.CHAPTER_BREAK]: 'Chapter Break'
});

/**
 * Format validation function
 * @param {string} format - The format to validate
 * @returns {boolean} - True if format is valid
 */
export function isValidFormat (format) {
    return VALID_FORMAT_VALUES.includes(format);
}

/**
 * Get display name for a format
 * @param {string} format - The format
 * @returns {string} - Display name or format itself if not found
 */
export function getFormatDisplayName (format) {
    return FORMAT_DISPLAY_NAMES[format] || format;
}

/**
 * Format flow state machine
 * Defines the natural progression of formats in a script
 */
export const FORMAT_FLOW = Object.freeze({
    [VALID_FORMATS.HEADER]: VALID_FORMATS.ACTION,
    [VALID_FORMATS.ACTION]: VALID_FORMATS.ACTION,
    [VALID_FORMATS.SPEAKER]: VALID_FORMATS.DIALOG,
    [VALID_FORMATS.DIALOG]: VALID_FORMATS.SPEAKER,
    [VALID_FORMATS.DIRECTIONS]: VALID_FORMATS.DIALOG,
    [VALID_FORMATS.CHAPTER_BREAK]: VALID_FORMATS.HEADER
});

/**
 * Get next format in the flow
 * @param {string} currentFormat - Current format
 * @param {number} direction - Direction (1 for next, -1 for previous)
 * @returns {string} - Next format in the flow
 */
export function getNextFormat (currentFormat, direction = 1) {
    if (direction === -1) {
        // Get previous format in cycle
        const formatCycle = Object.keys(FORMAT_FLOW);
        const currentIndex = formatCycle.indexOf(currentFormat);
        if (currentIndex === -1) {
            return DEFAULT_FORMAT;
        }
        const prevIndex = (currentIndex - 1 + formatCycle.length) % formatCycle.length;
        return formatCycle[prevIndex];
    }

    return FORMAT_FLOW[currentFormat] || DEFAULT_FORMAT;
}

/**
 * XML tag mapping for formats
 * Used for serialization/deserialization
 */
export const FORMAT_XML_TAGS = Object.freeze({
    [VALID_FORMATS.HEADER]: 'header',
    [VALID_FORMATS.ACTION]: 'action',
    [VALID_FORMATS.SPEAKER]: 'speaker',
    [VALID_FORMATS.DIALOG]: 'dialog',
    [VALID_FORMATS.DIRECTIONS]: 'directions',
    [VALID_FORMATS.CHAPTER_BREAK]: 'chapter-break'
});

/**
 * Create XML tag for a format
 * @param {string} format - The format
 * @param {string} content - The content
 * @returns {string} - XML formatted line
 */
export function createFormatXML (format, content) {
    const tag = FORMAT_XML_TAGS[format];
    if (!tag) {
        throw new Error(`Invalid format: ${format}`);
    }
    return `<${tag}>${content}</${tag}>`;
}

/**
 * Parse XML content to extract format and text
 * @param {string} xmlContent - XML formatted content
 * @returns {object} - {format, text} or null if invalid
 */
export function parseFormatXML (xmlContent) {
    const match = xmlContent.match(/<([\w-]+)>(.*?)<\/\1>/);
    if (!match) {
        return null;
    }

    const [, tag, text] = match;
    const format = Object.keys(FORMAT_XML_TAGS).find(f => FORMAT_XML_TAGS[f] === tag);

    if (!format) {
        return null;
    }

    return { format, text };
}

/**
 * Validate format object structure
 * @param {object} formatObj - Object to validate
 * @returns {boolean} - True if valid
 */
export function validateFormatObject (formatObj) {
    return formatObj &&
           typeof formatObj === 'object' &&
           typeof formatObj.format === 'string' &&
           isValidFormat(formatObj.format) &&
           typeof formatObj.text === 'string';
}
