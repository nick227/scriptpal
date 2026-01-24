import {
    VALID_FORMATS,
    DEFAULT_FORMAT,
    isValidFormat as validateFormat,
    getNextFormat
} from '../../constants/formats.js';

import { EditorFormatFlowManager } from './handlers/EditorFormatFlowManager.js';
import { debugLog } from '../../core/logger.js';

/**
 *
 */
export class LineFormatter {
    /**
     *
     * @param stateManager
     */
    constructor (stateManager) {
        if (!stateManager) {
            throw new Error('StateManager is required for LineFormatter');
        }

        this.stateManager = stateManager;
        this.formatFlowManager = new EditorFormatFlowManager();
        this.keydownHandler = null;

        // Use centralized format constants
        this.VALID_FORMATS = VALID_FORMATS;
        this.DEFAULT_FORMAT = DEFAULT_FORMAT;

        // Performance optimizations
        this._formatCache = new Map();
        this._lastFormatUpdate = 0;
        this._batchFormatUpdates = [];
        this._isBatching = false;
    }

    /**
     *
     * @param handler
     */
    setKeydownHandler (handler) {
        this.keydownHandler = handler;
    }

    /**
     *
     * @param currentFormat
     */
    getNextFlowFormat (currentFormat) {
        return this.formatFlowManager.getNextFormat(currentFormat);
    }

    /**
     * @param {string} currentFormat
     * @param {number} direction
     */
    getNextFormatInFlow (currentFormat, direction = 1) {
        return getNextFormat(currentFormat, direction);
    }

    /**
     *
     * @param format
     */
    createFormattedLine (format = this.DEFAULT_FORMAT) {
        // Ensure format is valid
        if (!this.isValidFormat(format)) {
            console.warn(`Invalid format "${format}", using default format "${this.DEFAULT_FORMAT}"`);
            format = this.DEFAULT_FORMAT;
        }

        const line = document.createElement('div');
        line.className = 'script-line';
        line.dataset.format = format;
        line.setAttribute('role', 'textbox');
        line.setAttribute('aria-label', `${format} line`);
        line.setAttribute('data-enable-grammarly', 'false');
        line.contentEditable = 'true';
        line.classList.add(`format-${format}`);

        // Store event handlers for cleanup
        const mousedownHandler = (e) => {
            // Allow natural selection if clicking text content
            if (e.target.nodeType === Node.TEXT_NODE ||
                (e.target === line && line.textContent.length > 0)) {
                return;
            }

            // Prevent focus loss only when clicking empty areas
            if (document.activeElement === line && !line.textContent.trim()) {
                e.preventDefault();
            }
        };

        const dblclickHandler = (e) => {
            // If user double-clicked text, let browser handle word selection
            if (e.target.nodeType === Node.TEXT_NODE ||
                window.getSelection().toString()) {
                return;
            }

            // Only select all if double-clicking empty space
            this.highlightContents(line);
        };

        line.addEventListener('mousedown', mousedownHandler);
        line.addEventListener('dblclick', dblclickHandler);

        // Store handlers for cleanup
        line._eventHandlers = {
            mousedown: mousedownHandler,
            dblclick: dblclickHandler
        };

        // Handle cursor positioning
        line.addEventListener('click', (e) => {
            // Don't interfere with existing selection
            const selection = window.getSelection();
            if (selection.toString()) {
                return;
            }

            // Only handle clicks directly on the line element
            if (e.target !== line) {
                return;
            }

            const rect = line.getBoundingClientRect();
            const clickX = e.clientX - rect.left;

            // Find nearest text position
            const range = document.createRange();
            const textNode = line.firstChild;
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                let position = Math.round((clickX / rect.width) * textNode.length);
                position = Math.max(0, Math.min(position, textNode.length));

                range.setStart(textNode, position);
                range.setEnd(textNode, position);

                selection.removeAllRanges();
                selection.addRange(range);
            }
        });

        // Attach keydown handler if available
        if (this.keydownHandler) {
            line.addEventListener('keydown', this.keydownHandler);
        }

        // Ensure line has initial text node for cursor positioning
        if (!line.firstChild) {
            const textNode = document.createTextNode('');
            line.appendChild(textNode);
        }

        return line;
    }
    /**
     * Create a static line element for read-only viewers.
     * @param {object} options
     * @param {string} [options.format]
     * @param {string} [options.content]
     */
    static createStaticLine ({ format = DEFAULT_FORMAT, content = '' } = {}) {
        const safeFormat = validateFormat(format) ? format : DEFAULT_FORMAT;
        const line = document.createElement('div');
        line.className = `script-line format-${safeFormat}`;
        line.dataset.format = safeFormat;
        line.setAttribute('role', 'presentation');
        line.setAttribute('aria-label', `${safeFormat} line`);
        line.setAttribute('data-static-line', 'true');
        line.contentEditable = 'false';
        line.tabIndex = -1;
        line.textContent = content || '';
        return line;
    }

    /**
     *
     * @param line
     */
    highlightContents (line) {
        const selection = window.getSelection();
        if (selection.toString()) {
            return;
        }

        const range = document.createRange();
        range.selectNodeContents(line);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    /**
     *
     * @param line
     */
    getFormatForLine (line) {
        return line.dataset.format || this.DEFAULT_FORMAT;
    }

    /**
     *
     * @param format
     * @param options
     */
    createFormatCommand (lineId, format, options = {}) {
        if (!lineId) {
            return null;
        }

        const { validate = true } = options;
        if (validate && !this.isValidFormat(format)) {
            return null;
        }

        return {
            type: 'setFormat',
            lineId,
            format
        };
    }

    /**
     *
     * @param lineId
     * @param format
     * @param options
     */
    setLineFormat (lineId, format, options = {}) {
        return this.createFormatCommand(lineId, format, options);
    }

    /**
     * Apply format to a DOM line element
     * @param {HTMLElement} line
     * @param {string} format
     * @param {object} options
     * @param {boolean} options.validate
     */
    applyFormatToLine (line, format, options = {}) {
        const { validate = true } = options;

        debugLog('[LineFormatter] applyFormatToLine called:', {
            format,
            validate,
            hasLine: !!line,
            lineId: line?.dataset?.lineId,
            currentFormat: line?.getAttribute?.('data-format'),
            className: line?.className
        });

        if (!this._validateLineAndFormat(line, format, validate)) {
            return false;
        }

        try {
            const previousFormat = line.getAttribute('data-format');
            const previousClassName = line.className;

            const success = this._applyFormatChanges(line, format);
            if (!success) {
                console.error('[LineFormatter] Failed to apply format changes');
                return false;
            }

            if (!this._verifyFormatApplied(line, format)) {
                console.error('[LineFormatter] Format verification failed, rolling back');
                this._rollbackFormatChanges(line, previousFormat, previousClassName);
                return false;
            }

            debugLog('[LineFormatter] Format applied:', {
                lineId: line.dataset?.lineId,
                format: line.getAttribute('data-format'),
                className: line.className
            });

            return true;
        } catch (error) {
            console.error('[LineFormatter] Unexpected error in applyFormatToLine:', error);
            return false;
        }
    }

    /**
     * Validate line element and format
     * @param {HTMLElement} line - The line element
     * @param {string} format - The format to validate
     * @param {boolean} validate - Whether to validate format
     * @returns {boolean} - True if valid
     */
    _validateLineAndFormat (line, format, validate) {
        // Check if line exists and is a valid element
        if (!line) {
            console.error('[LineFormatter] No line element provided');
            return false;
        }

        if (!(line instanceof HTMLElement)) {
            console.error('[LineFormatter] Line is not a valid HTMLElement:', line);
            return false;
        }

        // Check if line has required class
        if (!line.classList.contains('script-line')) {
            console.warn('[LineFormatter] Line does not have script-line class, adding it');
            line.classList.add('script-line');
        }

        // Validate format if requested
        if (validate && !this.isValidFormat(format)) {
            console.error('[LineFormatter] Invalid format:', {
                format,
                validFormats: Object.values(this.VALID_FORMATS),
                isValid: this.isValidFormat(format)
            });
            return false;
        }

        return true;
    }

    /**
     * Apply format changes to the line element
     * @param {HTMLElement} line - The line element
     * @param {string} format - The format to apply
     * @returns {boolean} - True if changes were applied successfully
     */
    _applyFormatChanges (line, format) {
        try {
            // Remove all existing format classes
            const formatClasses = Object.values(this.VALID_FORMATS).map(f => `format-${f}`);
            line.classList.remove(...formatClasses);

            // Set data attribute
            line.setAttribute('data-format', format);

            // Add new format class
            line.classList.add(`format-${format}`);

            // Ensure script-line class is present
            if (!line.classList.contains('script-line')) {
                line.classList.add('script-line');
            }

            return true;
        } catch (error) {
            console.error('[LineFormatter] Error applying format changes:', error);
            return false;
        }
    }

    /**
     * Verify that format was applied correctly
     * @param {HTMLElement} line - The line element
     * @param {string} expectedFormat - The expected format
     * @returns {boolean} - True if format is correctly applied
     */
    _verifyFormatApplied (line, expectedFormat) {
        try {
            const dataFormat = line.getAttribute('data-format');
            const hasFormatClass = line.classList.contains(`format-${expectedFormat}`);

            const isValid = dataFormat === expectedFormat && hasFormatClass;

            if (!isValid) {
                console.error('[LineFormatter] Format verification failed:', {
                    expected: expectedFormat,
                    dataFormat,
                    hasFormatClass,
                    className: line.className
                });
            }

            return isValid;
        } catch (error) {
            console.error('[LineFormatter] Error verifying format:', error);
            return false;
        }
    }

    /**
     * Rollback format changes if they failed
     * @param {HTMLElement} line - The line element
     * @param {string} previousFormat - The previous format
     * @param {string} previousClassName - The previous class name
     */
    _rollbackFormatChanges (line, previousFormat, previousClassName) {
        try {
            line.setAttribute('data-format', previousFormat);
            line.className = previousClassName;
            debugLog('[LineFormatter] Format changes rolled back');
        } catch (error) {
            console.error('[LineFormatter] Error rolling back format changes:', error);
        }
    }

    /**
     * Cycle format using FSM for proper transitions
     * @param {HTMLElement} line - The line element
     * @param {number} direction - Direction to cycle (1 for next, -1 for previous)
     * @param {object} options - Additional options for setLineFormat
     * @returns {boolean} - True if format was successfully cycled
     */
    cycleFormat (lineId, currentFormat, direction = 1, options = {}) {
        if (!lineId) {
            console.error('[LineFormatter] No lineId provided for format cycling');
            return null;
        }

        const formatArray = Object.values(this.VALID_FORMATS);
        const currentIndex = formatArray.indexOf(currentFormat);

        let newFormat;
        if (currentIndex === -1) {
            newFormat = 'action';
        } else {
            const nextIndex = direction > 0 ?
                (currentIndex + 1) % formatArray.length :
                (currentIndex - 1 + formatArray.length) % formatArray.length;
            newFormat = formatArray[nextIndex];
        }

        return this.setLineFormat(lineId, newFormat, options);
    }

    /**
     * Get the current format of a line safely
     * @param {HTMLElement} line - The line element
     * @returns {string|null} - The current format or null if invalid
     */
    getLineFormat (line) {
        if (!line || !(line instanceof HTMLElement)) {
            console.warn('[LineFormatter] Invalid line element for getLineFormat');
            return null;
        }

        const format = line.getAttribute('data-format');
        if (!format || !this.isValidFormat(format)) {
            console.warn('[LineFormatter] Invalid or missing format on line:', {
                format,
                className: line.className
            });
            return null;
        }

        return format;
    }

    /**
     * Check if a format is valid
     * @param {string} format - The format to validate
     * @returns {boolean} - True if format is valid
     */
    isValidFormat (format) {
        return validateFormat(format);
    }

    /**
     *
     */
    getAllFormats () {
        return Object.values(this.VALID_FORMATS);
    }

    /**
     *
     * @param format
     */
    getFormatName (format) {
        if (!this.isValidFormat(format)) {
            return '';
        }
        const entry = Object.entries(this.VALID_FORMATS)
            .find(([_, value]) => value === format);
        return entry && entry[0] ? entry[0].toLowerCase() : '';
    }

    /**
     *
     * @param line
     * @param unindent
     */
    indent (line, unindent = false) {
        const currentIndent = parseInt(line.style.marginLeft || '0', 10);
        const indentSize = 20; // pixels
        const newIndent = unindent ?
            Math.max(0, currentIndent - indentSize) :
            currentIndent + indentSize;

        line.style.marginLeft = `${newIndent}px`;
    }

    // ==============================================
    // Parsing Functionality (consolidated from parse/ directory)
    // ==============================================

    /**
     * Parse script content into formatted lines
     * @param text
     */
    parseScriptContent (text) {
        if (!text) {
            return { lines: [], metadata: { totalLines: 0, formats: {} } };
        }

        const rawLines = this.splitIntoLines(text);
        const lines = [];
        const metadata = {
            totalLines: 0,
            formats: {
                header: 0,
                speaker: 0,
                dialog: 0,
                directions: 0,
                'chapter-break': 0
            }
        };

        let previousLine = '';
        let nextLine = '';

        for (let i = 0; i < rawLines.length; i++) {
            const line = rawLines[i];
            nextLine = i < rawLines.length - 1 ? rawLines[i + 1] : '';

            if (this.shouldSkipLine(line)) {
                continue;
            }

            const cleanedLine = this.cleanText(line);
            let format = this.determineFormat(cleanedLine, previousLine, nextLine);
            format = this.applyContextualRules(format, cleanedLine);

            lines.push({ text: cleanedLine, format });
            metadata.formats[format] = (metadata.formats[format] || 0) + 1;
            metadata.totalLines++;

            previousLine = cleanedLine;
        }

        return { lines, metadata };
    }

    /**
     * Split text into lines
     * @param text
     */
    splitIntoLines (text) {
        return text.split(/\r?\n/);
    }

    /**
     * Clean text by trimming and normalizing whitespace
     * @param text
     */
    cleanText (text) {
        if (!text) {
            return '';
        }
        return text.trim().replace(/\s+/g, ' ');
    }

    /**
     * Check if line should be skipped during parsing
     * @param line
     */
    shouldSkipLine (line) {
        const cleaned = this.cleanText(line);
        return !cleaned || cleaned.length === 0;
    }

    /**
     * Determine format for a line based on content and context
     * @param line
     * @param previousLine
     * @param nextLine
     */
    determineFormat (line, previousLine, nextLine) {
        // Check for scene headers
        if (this.isSceneHeader(line)) {
            return 'header';
        }

        // Check for speakers
        if (this.isSpeaker(line, previousLine, nextLine)) {
            return 'speaker';
        }

        // Check for dialog (usually follows speakers)
        if (this.isDialog(line, previousLine, nextLine)) {
            return 'dialog';
        }

        // Check for directions
        if (this.isDirection(line, previousLine, nextLine)) {
            return 'directions';
        }

        // Check for chapter breaks
        if (this.isChapterBreak(line)) {
            return 'chapter-break';
        }

        // Default to dialog
        return 'dialog';
    }

    /**
     * Apply contextual rules to format determination
     * @param format
     * @param line
     */
    applyContextualRules (format, line) {
        // If line is very short and looks like a speaker, ensure it's speaker format
        if (format === 'dialog' && line.length < 20 && /^[A-Z\s]+$/.test(line)) {
            return 'speaker';
        }

        // If line contains parentheticals, it's likely dialog
        if (format === 'speaker' && /\([^)]+\)/.test(line)) {
            return 'dialog';
        }

        return format;
    }

    /**
     * Check if line is a scene header
     * @param line
     */
    isSceneHeader (line) {
        const cleaned = this.cleanText(line).toUpperCase();
        const sceneHeaders = new Set([
            'INT.', 'EXT.', 'INT/EXT.', 'I/E.', 'INT./EXT.', 'EXT./INT.'
        ]);

        return sceneHeaders.has(cleaned.split(' ')[0]) ||
               /^(?:INT\.|EXT\.|INT\/EXT\.|\.|I\/E\.)/i.test(cleaned);
    }

    /**
     * Check if line is a speaker
     * @param line
     * @param prevLine
     * @param nextLine
     */
    isSpeaker (line, prevLine, nextLine) {
        if (!line) {
            return false;
        }

        const lineClean = this.cleanText(line);

        // Check for parentheticals like (V.O.), (O.S.), etc.
        const hasParenthetical = /\([^)]+\)/.test(lineClean);

        // More flexible speaker pattern that allows parentheticals
        const speakerPattern = hasParenthetical
            ? /^[A-Z][A-Z\s\d]*\s*\([^)]+\)$/
            : /^[A-Z][A-Z\s\d]*$/;

        // Must be all caps (with possible parenthetical)
        const isAllCaps = /^[A-Z\s\d\(\)\.]+$/.test(lineClean);

        // Should not be too long (speakers are usually short)
        const isReasonableLength = lineClean.length < 50;

        // Should not contain common direction words
        const directionWords = ['CUT TO:', 'FADE IN:', 'FADE OUT:', 'DISSOLVE TO:'];
        const hasDirectionWords = directionWords.some(word =>
            lineClean.toUpperCase().includes(word)
        );

        return speakerPattern.test(lineClean) &&
               isAllCaps &&
               isReasonableLength &&
               !hasDirectionWords;
    }

    /**
     * Check if line is dialog
     * @param line
     * @param prevLine
     * @param nextLine
     */
    isDialog (line, prevLine, nextLine) {
        if (!line) {
            return false;
        }

        const lineClean = this.cleanText(line);

        // Dialog usually follows speakers
        const prevWasSpeaker = prevLine && this.isSpeaker(prevLine);

        // Dialog is usually mixed case
        const isMixedCase = /[a-z]/.test(lineClean) && /[A-Z]/.test(lineClean);

        // Dialog is usually longer than speakers
        const isReasonableLength = lineClean.length > 10;

        // Dialog can contain parentheticals
        const hasParenthetical = /\([^)]+\)/.test(lineClean);

        return (prevWasSpeaker || isMixedCase) &&
               (isReasonableLength || hasParenthetical);
    }

    /**
     * Check if line is direction
     * @param line
     * @param prevLine
     * @param nextLine
     */
    isDirection (line, prevLine, nextLine) {
        if (!line) {
            return false;
        }

        const lineClean = this.cleanText(line);

        // Directions often start with common words
        const directionStarters = [
            'CUT TO:', 'FADE IN:', 'FADE OUT:', 'DISSOLVE TO:', 'SMASH CUT TO:',
            'The camera', 'We see', 'We hear', 'Close on', 'Wide shot',
            'Camera moves', 'The scene', 'Meanwhile', 'Later', 'Earlier'
        ];

        const startsWithDirection = directionStarters.some(starter =>
            lineClean.toLowerCase().startsWith(starter.toLowerCase())
        );

        // Directions are often in mixed case and descriptive
        const isDescriptive = lineClean.length > 20 &&
                             /[a-z]/.test(lineClean) &&
                             /[A-Z]/.test(lineClean);

        return startsWithDirection || isDescriptive;
    }

    /**
     * Check if line is a chapter break
     * @param line
     */
    isChapterBreak (line) {
        const cleaned = this.cleanText(line);
        return /^#{1,6}\s/.test(cleaned) || // Markdown headers
               /^CHAPTER\s+\d+/i.test(cleaned) || // Chapter markers
               /^ACT\s+[IVX]+/i.test(cleaned); // Act markers
    }

    /**
     * Parse different format types
     * @param text
     */
    parseStandardFormat (text) {
        return this.parseScriptContent(text);
    }

    /**
     *
     * @param text
     */
    parsePlainTextFormat (text) {
        // Plain text - treat everything as dialog
        const lines = this.splitIntoLines(text);
        const result = { lines: [], metadata: { totalLines: 0, formats: { dialog: 0 } } };

        for (const line of lines) {
            const cleaned = this.cleanText(line);
            if (cleaned) {
                result.lines.push({ text: cleaned, format: 'dialog' });
                result.metadata.formats.dialog++;
                result.metadata.totalLines++;
            }
        }

        return result;
    }

    /**
     *
     * @param text
     */
    parsePDFFormat (text) {
        // PDF format - similar to standard but with different line breaks
        const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        return this.parseScriptContent(normalizedText);
    }

    // ==============================================
    // Performance Optimization Methods
    // ==============================================

    /**
     * Batch format updates for better performance
     * @param line
     * @param format
     * @param options
     */
    batchFormatUpdate (line, format, options = {}) {
        this._batchFormatUpdates.push({ line, format, options });

        if (!this._isBatching) {
            this._isBatching = true;
            requestAnimationFrame(() => {
                this._processBatchFormatUpdates();
            });
        }
    }

    /**
     * Process batched format updates
     */
    _processBatchFormatUpdates () {
        if (this._batchFormatUpdates.length === 0) {
            this._isBatching = false;
            return;
        }

        // Process all batched updates
        this._batchFormatUpdates.forEach(({ line, format, options }) => {
            try {
                this.applyFormatToLine(line, format, { ...options, validate: false });
            } catch (error) {
                console.error('[LineFormatter] Error in batched format update:', error);
            }
        });

        // Clear the batch
        this._batchFormatUpdates = [];
        this._isBatching = false;

        // Emit batch completion event
        if (this.stateManager) {
            this.stateManager.emit('batchFormatUpdateComplete', {
                count: this._batchFormatUpdates.length
            });
        }
    }

    /**
     * Optimized format validation with caching
     * @param format
     */
    isValidFormatCached (format) {
        const now = Date.now();

        // Use cache if recent
        if (this._formatCache.has(format) && (now - this._lastFormatUpdate) < 1000) {
            return this._formatCache.get(format);
        }

        // Validate and cache
        const isValid = this.isValidFormat(format);
        this._formatCache.set(format, isValid);
        this._lastFormatUpdate = now;

        return isValid;
    }

    /**
     * Clear format cache
     */
    clearFormatCache () {
        this._formatCache.clear();
        this._lastFormatUpdate = 0;
    }

    /**
     * Clean up event listeners from a line element
     * @param {HTMLElement} line - The line element to clean up
     */
    cleanupLineElement (line) {
        if (line && line._eventHandlers) {
            line.removeEventListener('mousedown', line._eventHandlers.mousedown);
            line.removeEventListener('dblclick', line._eventHandlers.dblclick);
            delete line._eventHandlers;
        }
    }

    /**
     * Get format statistics for debugging
     */
    getFormatStats () {
        return {
            cacheSize: this._formatCache.size,
            batchQueueSize: this._batchFormatUpdates.length,
            isBatching: this._isBatching,
            lastUpdate: this._lastFormatUpdate
        };
    }

    /**
     *
     */
    destroy () {
        this.keydownHandler = null;
    }
}
