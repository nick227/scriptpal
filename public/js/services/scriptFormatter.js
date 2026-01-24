import { VALID_FORMAT_VALUES } from '../constants/formats.js';
import { debugLog } from '../core/logger.js';

/**
 *
 */
export class ScriptFormatter {
    /**
     *
     */
    constructor () {
        this.validTags = VALID_FORMAT_VALUES;
    }

    /**
     * Main format method - orchestrates the formatting process
     * @param content
     */
    format (content) {
        try {
            this.validateInput(content);
            this.logFormatStart(content);

            const trimmedContent = content.trim();
            const hasMarkup = this.containsMarkup(trimmedContent);

            const formattedContent = hasMarkup ?
                this.formatExistingMarkup(trimmedContent) :
                this.formatPlainText(trimmedContent);

            this.validateResult(formattedContent);
            return formattedContent;
        } catch (error) {
            this.handleFormatError(error, content);
        }
    }

    /**
     * Input validation
     * @param content
     */
    validateInput (content) {
        if (!content || typeof content !== 'string') {
            throw new Error('Content must be a string');
        }
    }

    /**
     * Check if content contains markup
     * @param content
     */
    containsMarkup (content) {
        return content
            .split('\n')
            .some(line => {
                const trimmed = line.trim();
                return /^<([a-zA-Z-]+)>[\s\S]*<\/\1>$/.test(trimmed) ||
                    /^<chapter-break\s*\/>$/.test(trimmed);
            });
    }

    /**
     * Format content that already contains markup
     * @param content
     */
    formatExistingMarkup (content) {
        // Remove any XML declarations or doctype
        let formatted = content
            .replace(/<\?xml[^>]*\?>/g, '')
            .replace(/<!DOCTYPE[^>]*>/g, '');

        // Normalize known self-closing tags to canonical form
        formatted = formatted.replace(/<chapter-break\s*\/>/gi, '<chapter-break></chapter-break>');

        // Clean up whitespace between tags
        formatted = formatted
            .replace(/>\s+</g, '>\n<') // Add newlines between tags
            .replace(/^\s+|\s+$/g, ''); // Trim start/end whitespace

        return formatted;
    }

    /**
     * Format plain text content
     * @param content
     */
    formatPlainText (content) {
        // Normalize all line endings to \n first
        const normalizedContent = content
            .replace(/\r\n/g, '\n')  // Windows line endings
            .replace(/\r/g, '\n');   // Mac/old Unix line endings

        const lines = normalizedContent.split('\n');
        return lines
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => this.formatLine(line))
            .join('\n');
    }

    /**
     * Format a single line based on its prefix
     * @param line
     */
    formatLine (line) {
        const formatRules = [{
            prefix: 'HEADER:',
            tag: 'header',
            offset: 7
        },
        {
            prefix: 'SPEAKER:',
            tag: 'speaker',
            offset: 8
        },
        {
            prefix: 'DIALOG:',
            tag: 'dialog',
            offset: 7
        },
        {
            prefix: 'ACTION:',
            tag: 'action',
            offset: 7
        }
        ];

        // Check for special case first
        if (line === '---') {
            return this.createTaggedLine('chapter-break', '');
        }

        // Check against format rules
        for (const rule of formatRules) {
            if (line.startsWith(rule.prefix)) {
                return this.createTaggedLine(
                    rule.tag,
                    line.substring(rule.offset)
                );
            }
        }

        // Default to action
        return this.createTaggedLine('action', line);
    }

    /**
     * Create a properly formatted line with tags
     * @param tag
     * @param content
     */
    createTaggedLine (tag, content) {
        return `<${tag}>${this.escapeXML(content)}</${tag}>`;
    }

    /**
     * Validate the formatted result
     * @param content
     */
    validateResult (content) {
        const isValid = this.validateFormat(content);
        this.logValidationResult(isValid);

        if (!isValid) {
            throw new Error('Content validation failed after formatting');
        }
    }

    /**
     * Logging helpers
     * @param content
     */
    logFormatStart (content) {
        debugLog('[SCRIPT] Starting content formatting:', {
            contentLength: content.length,
            hasMarkup: this.containsMarkup(content)
        });
    }

    /**
     *
     * @param isValid
     */
    logValidationResult (isValid) {
        debugLog('[SCRIPT] Validation result:', { isValid });
    }

    /**
     *
     * @param error
     * @param content
     */
    handleFormatError (error, content) {
        console.error('[SCRIPT] Formatting error:', error, '\nContent:', content);
        throw new Error('Invalid script format: ' + error.message);
    }

    /**
     * XML escaping utility
     * @param str
     */
    escapeXML (str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Format validation
     * @param content
     */
    validateFormat (content) {
        if (!content || typeof content !== 'string') {
            console.warn('[SCRIPT] Invalid content type for validation');
            return false;
        }

        try {
            debugLog('[SCRIPT] Starting format validation:', {
                contentLength: content.length
            });

            return this.validateContentStructure(content.trim());
        } catch (error) {
            console.error('[SCRIPT] Format validation failed:', error);
            return false;
        }
    }

    /**
     * Validate content structure using DOM parsing
     * @param content
     */
    validateContentStructure (content) {
        return this.validateTextContent(content);
    }

    /**
     * Validate content using text-based parsing
     * @param content
     */
    validateTextContent (content) {
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                continue;
            }
            if (!this.isValidTagLine(trimmed)) {
                console.warn('[SCRIPT] Invalid tag line detected');
                return false;
            }
        }

        return true;
    }

    /**
     * Check if a line contains a valid tag
     * @param line
     */
    isValidTagLine (line) {
        if (!line.startsWith('<') || !line.endsWith('>')) return false;

        const tagMatch = line.match(/^<([a-zA-Z-]+)>[\s\S]*<\/\1>$/);
        return tagMatch && this.validTags.includes(tagMatch[1].toLowerCase());
    }

    /**
     * Get valid tags
     */
    getValidTags () {
        return [...this.validTags];
    }
}
