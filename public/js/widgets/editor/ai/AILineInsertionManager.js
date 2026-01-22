/**
 * AILineInsertionManager - Manages AI response with target line number insertion
 * Handles parsing AI responses for line numbers and inserting content at specific positions
 */

import { EventManager } from '../../../core/EventManager.js';
import { StateManager } from '../../../core/StateManager.js';

/**
 * AILineInsertionManager class for managing AI line insertion
 */
export class AILineInsertionManager {
    /**
     * Constructor
     * @param {object} options - Configuration options
     * @param {object} options.stateManager - State manager for current script tracking
     * @param {object} options.eventManager - Event manager for notifications
     * @param {object} options.contentManager - Content manager for script content access
     * @param {object} options.aiCommandManager - AI command manager for script operations
     */
    constructor (options) {
        if (!options.stateManager) {
            throw new Error('StateManager is required for AILineInsertionManager');
        }
        if (!options.eventManager) {
            throw new Error('EventManager is required for AILineInsertionManager');
        }
        if (!options.contentManager) {
            throw new Error('ContentManager is required for AILineInsertionManager');
        }
        if (!options.aiCommandManager) {
            throw new Error('AICommandManager is required for AILineInsertionManager');
        }

        this.stateManager = options.stateManager;
        this.eventManager = options.eventManager;
        this.contentManager = options.contentManager;
        this.aiCommandManager = options.aiCommandManager;

        // Line insertion state
        this.insertionHistory = [];
        this.maxHistorySize = 50;

        // Parsing patterns for AI responses
        this.lineNumberPatterns = [
            /line\s+(\d+)/gi,
            /at\s+line\s+(\d+)/gi,
            /insert\s+at\s+line\s+(\d+)/gi,
            /after\s+line\s+(\d+)/gi,
            /before\s+line\s+(\d+)/gi,
            /position\s+(\d+)/gi,
            /\[line\s*(\d+)\]/gi,
            /\(line\s*(\d+)\)/gi
        ];

        // Content markers for AI responses
        this.contentMarkers = [
            /```script\s*\n([\s\S]*?)\n```/gi,
            /```\s*\n([\s\S]*?)\n```/gi,
            /<script>\s*\n([\s\S]*?)\n<\/script>/gi,
            /<content>\s*\n([\s\S]*?)\n<\/content>/gi
        ];

        // Event handlers
        this.eventHandlers = new Map();

        // Initialize
        this.initialize();
    }

    /**
     * Initialize the AI line insertion manager
     */
    async initialize () {

        // Set up event listeners
        this.setupEventListeners();

    }

    /**
     * Set up event listeners
     */
    setupEventListeners () {
        // Listen for AI responses
        this.eventManager.subscribe(EventManager.EVENTS.AI.RESPONSE_RECEIVED, this.handleAIResponse.bind(this));

        // Listen for script changes
        this.stateManager.subscribe(StateManager.KEYS.CURRENT_SCRIPT, this.handleScriptChange.bind(this));
    }

    /**
     * Handle AI response for line insertion
     * @param {object} event - AI response event
     */
    async handleAIResponse (event) {
        if (!event.response || !event.response.content) {
            return;
        }

        try {

            const insertionData = this.parseAIResponse(event.response);

            if (insertionData) {
                await this.executeLineInsertion(insertionData);
            }

        } catch (error) {
            console.error('[AILineInsertionManager] Failed to handle AI response:', error);
            this.handleError(error, 'handleAIResponse');
        }
    }

    /**
     * Parse AI response for line insertion data
     * @param {object} response - AI response object
     * @returns {object|null} - Parsed insertion data or null
     */
    parseAIResponse (response) {
        const { content } = response;
        if (!content || typeof content !== 'string') {
            return null;
        }


        // Extract line number
        const lineNumber = this.extractLineNumber(content);
        if (lineNumber === null) {
            return null;
        }

        // Extract script content
        const scriptContent = this.extractScriptContent(content);
        if (!scriptContent) {
            return null;
        }

        // Determine insertion type
        const insertionType = this.determineInsertionType(content, lineNumber);

        // Extract format if specified
        const format = this.extractFormat(content) || 'action';

        return {
            lineNumber,
            content: scriptContent,
            format,
            type: insertionType,
            originalResponse: content,
            timestamp: Date.now()
        };
    }

    /**
     * Extract line number from AI response
     * @param {string} content - AI response content
     * @returns {number|null} - Line number or null
     */
    extractLineNumber (content) {
        for (const pattern of this.lineNumberPatterns) {
            const matches = content.match(pattern);
            if (matches && matches.length > 0) {
                // Extract the first number found
                const numberMatch = matches[0].match(/\d+/);
                if (numberMatch) {
                    const lineNumber = parseInt(numberMatch[0], 10);
                    if (lineNumber > 0) {
                        return lineNumber;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Extract script content from AI response
     * @param {string} content - AI response content
     * @returns {string|null} - Script content or null
     */
    extractScriptContent (content) {
        for (const pattern of this.contentMarkers) {
            const matches = content.match(pattern);
            if (matches && matches.length > 0) {
                return matches[1].trim();
            }
        }

        // If no markers found, try to extract content after line number
        const lineNumberMatch = content.match(/(?:line\s+\d+[:\s]*)([\s\S]*)/i);
        if (lineNumberMatch && lineNumberMatch[1]) {
            const extractedContent = lineNumberMatch[1].trim();
            if (extractedContent.length > 10) { // Minimum content length
                return extractedContent;
            }
        }

        return null;
    }

    /**
     * Determine insertion type from content
     * @param {string} content - AI response content
     * @param {number} lineNumber - Target line number
     * @returns {string} - Insertion type
     */
    determineInsertionType (content, lineNumber) {
        const lowerContent = content.toLowerCase();

        if (lowerContent.includes('after line') || lowerContent.includes('insert after')) {
            return 'after';
        } else if (lowerContent.includes('before line') || lowerContent.includes('insert before')) {
            return 'before';
        } else if (lowerContent.includes('replace line') || lowerContent.includes('at line')) {
            return 'replace';
        } else {
            return 'after'; // Default to after
        }
    }

    /**
     * Extract format from AI response
     * @param {string} content - AI response content
     * @returns {string|null} - Format or null
     */
    extractFormat (content) {
        const formatPatterns = [
            /format[:\s]+(\w+)/gi,
            /type[:\s]+(\w+)/gi,
            /style[:\s]+(\w+)/gi
        ];

        for (const pattern of formatPatterns) {
            const match = content.match(pattern);
            if (match) {
                return match[1].toLowerCase();
            }
        }

        return null;
    }

    /**
     * Execute line insertion
     * @param {object} insertionData - Insertion data
     */
    async executeLineInsertion (insertionData) {
        try {

            const { lineNumber, content, format, type } = insertionData;

            // Validate line number
            const totalLines = this.getTotalLines();
            if (lineNumber > totalLines) {
                console.warn(`[AILineInsertionManager] Line number ${lineNumber} exceeds total lines ${totalLines}`);
                // Insert at the end instead
                insertionData.lineNumber = totalLines;
                insertionData.type = 'after';
            }

            // Execute insertion based on type
            let result;
            switch (type) {
                case 'after':
                    result = await this.insertAfterLine(lineNumber, content, format);
                    break;
                case 'before':
                    result = await this.insertBeforeLine(lineNumber, content, format);
                    break;
                case 'replace':
                    result = await this.replaceLine(lineNumber, content, format);
                    break;
                default:
                    result = await this.insertAfterLine(lineNumber, content, format);
            }

            // Record insertion in history
            this.recordInsertion(insertionData, result);

            // Emit insertion completed event
            this.eventManager.publish(EventManager.EVENTS.AI.LINE_INSERTION_COMPLETED, {
                insertionData,
                result
            });


        } catch (error) {
            console.error('[AILineInsertionManager] Line insertion failed:', error);
            this.handleError(error, 'executeLineInsertion');
        }
    }

    /**
     * Insert content after specified line
     * @param {number} lineNumber - Target line number
     * @param {string} content - Content to insert
     * @param {string} format - Content format
     * @returns {object} - Insertion result
     */
    async insertAfterLine (lineNumber, content, format) {
        const lines = this.parseContentToLines(content, format);
        const results = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const insertPosition = lineNumber + i;

            const result = await this.aiCommandManager.executeCommand('insertAt', {
                content: line.content,
                position: insertPosition,
                format: line.format
            });

            results.push(result);
        }

        return {
            type: 'after',
            lineNumber,
            linesInserted: lines.length,
            results
        };
    }

    /**
     * Insert content before specified line
     * @param {number} lineNumber - Target line number
     * @param {string} content - Content to insert
     * @param {string} format - Content format
     * @returns {object} - Insertion result
     */
    async insertBeforeLine (lineNumber, content, format) {
        const lines = this.parseContentToLines(content, format);
        const results = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const insertPosition = lineNumber + i;

            const result = await this.aiCommandManager.executeCommand('insertAt', {
                content: line.content,
                position: insertPosition,
                format: line.format
            });

            results.push(result);
        }

        return {
            type: 'before',
            lineNumber,
            linesInserted: lines.length,
            results
        };
    }

    /**
     * Replace content at specified line
     * @param {number} lineNumber - Target line number
     * @param {string} content - Content to replace with
     * @param {string} format - Content format
     * @returns {object} - Replacement result
     */
    async replaceLine (lineNumber, content, format) {
        const lines = this.parseContentToLines(content, format);

        if (lines.length === 1) {
            // Single line replacement
            const result = await this.aiCommandManager.executeCommand('replaceRange', {
                startLine: lineNumber,
                endLine: lineNumber,
                content: lines[0].content,
                format: lines[0].format
            });

            return {
                type: 'replace',
                lineNumber,
                linesReplaced: 1,
                result
            };
        } else {
            // Multi-line replacement
            const result = await this.aiCommandManager.executeCommand('replaceRange', {
                startLine: lineNumber,
                endLine: lineNumber + lines.length - 1,
                content: lines.map(line => line.content).join('\n'),
                format: lines[0].format
            });

            return {
                type: 'replace',
                lineNumber,
                linesReplaced: lines.length,
                result
            };
        }
    }

    /**
     * Parse content to lines with format
     * @param {string} content - Content to parse
     * @param {string} defaultFormat - Default format
     * @returns {Array} - Array of line objects
     */
    parseContentToLines (content, defaultFormat) {
        const lines = content.split('\n');
        return lines.map(line => ({
            content: line.trim(),
            format: this.detectLineFormat(line) || defaultFormat
        })).filter(line => line.content.length > 0);
    }

    /**
     * Detect line format from content
     * @param {string} line - Line content
     * @returns {string|null} - Detected format or null
     */
    detectLineFormat (line) {
        // Disabled automatic format detection - every line is explicitly formatted
        // No automatic format detection - every line is explicitly formatted
        return null;
    }

    /**
     * Get total number of lines in current script
     * @returns {number} - Total lines
     */
    getTotalLines () {
        try {
            const content = this.contentManager.getPlainText
                ? this.contentManager.getPlainText()
                : this.contentManager.getContent();
            if (!content) {
                return 0;
            }

            const lines = content.split('\n');
            return lines.length;

        } catch (error) {
            console.error('[AILineInsertionManager] Failed to get total lines:', error);
            return 0;
        }
    }

    /**
     * Record insertion in history
     * @param {object} insertionData - Insertion data
     * @param {object} result - Insertion result
     */
    recordInsertion (insertionData, result) {
        const historyEntry = {
            ...insertionData,
            result,
            timestamp: Date.now()
        };

        this.insertionHistory.unshift(historyEntry);

        // Trim history if too long
        if (this.insertionHistory.length > this.maxHistorySize) {
            this.insertionHistory = this.insertionHistory.slice(0, this.maxHistorySize);
        }

    }

    /**
     * Handle script changes
     * @param {object} script - The new current script
     */
    handleScriptChange (script) {
        if (!script) {
            return;
        }

        this.insertionHistory = [];
    }

    /**
     * Handle errors
     * @param {Error} error - Error object
     * @param {string} context - Error context
     */
    handleError (error, context) {
        console.error(`[AILineInsertionManager] Error in ${context}:`, error);

        // Emit error event
        this.eventManager.publish(EventManager.EVENTS.AI.LINE_INSERTION_ERROR, {
            error: error.message,
            context,
            timestamp: Date.now()
        });
    }

    /**
     * Get insertion history
     * @returns {Array} - Insertion history
     */
    getInsertionHistory () {
        return [...this.insertionHistory];
    }

    /**
     * Clear insertion history
     */
    clearInsertionHistory () {
        this.insertionHistory = [];
    }

    /**
     * Get insertion statistics
     * @returns {object} - Insertion statistics
     */
    getInsertionStats () {
        const totalInsertions = this.insertionHistory.length;
        const typeCounts = this.insertionHistory.reduce((counts, entry) => {
            counts[entry.type] = (counts[entry.type] || 0) + 1;
            return counts;
        }, {});

        return {
            totalInsertions,
            typeCounts,
            lastInsertion: this.insertionHistory[0] || null
        };
    }

    /**
     * Destroy the manager
     */
    destroy () {
        // Clear event handlers
        this.eventHandlers.clear();

        // Clear references
        this.stateManager = null;
        this.eventManager = null;
        this.contentManager = null;
        this.aiCommandManager = null;
        this.insertionHistory = [];

    }
}
