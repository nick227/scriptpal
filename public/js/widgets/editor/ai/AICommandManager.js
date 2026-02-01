import { EDITOR_EVENTS } from '../constants.js';
import { debugLog } from '../../../core/logger.js';

/**
 *
 */
export class AICommandManager {
    /**
     *
     * @param stateManager
     */
    constructor (stateManager) {
        if (!stateManager) throw new Error('StateManager is required');

        this.stateManager = stateManager;
        this.content = null;
        this.commands = new Map();
        this.eventHandlers = new Map();
        this.isProcessing = false;

        // Performance optimizations
        this._commandCache = new Map();
        this._cacheExpiry = 30000; // 30 seconds
        this._lastCacheCleanup = 0;
        this._batchCommands = [];
        this._isBatching = false;
        this._analysisCache = new Map();
    }

    /**
     *
     */
    async initialize () {
        return true;
    }

    /**
     *
     * @param content
     */
    setContent (content) {
        this.content = content;
    }

    _buildCommandValue (format, content) {
        const safeFormat = typeof format === 'string' && format.trim().length > 0 ? format : 'action';
        const safeContent = typeof content === 'string' ? content : '';
        return `<${safeFormat}>${safeContent}</${safeFormat}>`;
    }

    async _applyCommands (commands, source) {
        if (!this.content || typeof this.content.applyCommands !== 'function') {
            throw new Error('Editor content is not available for commands');
        }
        return this.content.applyCommands(commands, { source });
    }

    /**
     *
     * @param stateManager
     */
    setStateManager (stateManager) {
        this.stateManager = stateManager;
    }

    /**
     *
     * @param event
     * @param handler
     */
    on (event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event).add(handler);
    }

    /**
     *
     * @param event
     * @param data
     */
    emit (event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => handler(data));
        }
    }

    /**
     * Execute an AI command with proper error handling and validation
     * @param {object} command - The command to execute
     * @param {string} command.type - The command type
     * @param {object} command.data - The command data
     * @returns {Promise<object>} - The command result
     */
    async executeCommand (command) {
        if (this.isProcessing) {
            throw new Error('Another command is currently being processed');
        }

        try {
            this.isProcessing = true;
            this.emit('commandStart', { command });

            // Validate command
            if (!this.validateCommand(command)) {
                throw new Error('Invalid command format');
            }

            debugLog('[AICommandManager] Executing command:', {
                type: command.type,
                dataKeys: Object.keys(command.data || {})
            });

            // Process command
            const result = await this.processCommand(command);

            debugLog('[AICommandManager] Command completed successfully:', {
                type: command.type,
                success: result.success
            });

            this.emit('commandComplete', { command, result });
            return result;
        } catch (error) {
            console.error('[AICommandManager] Command failed:', {
                type: command.type,
                error: error.message
            });
            this.emit('commandError', { command, error });
            throw error;
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     *
     * @param command
     */
    validateCommand (command) {
        if (!command || typeof command !== 'object') return false;
        if (!command.type || typeof command.type !== 'string') return false;
        if (!command.data) return false;
        return true;
    }

    /**
     *
     * @param command
     */
    async processCommand (command) {
        const handler = this.getCommandHandler(command.type);
        if (!handler) {
            throw new Error(`No handler found for command type: ${command.type}`);
        }

        return handler(command.data);
    }

    /**
     * Get command handler for a specific command type
     * @param {string} type - The command type
     * @returns {Function|null} - The command handler function
     */
    getCommandHandler (type) {
        const handlers = {
            'format': this.handleFormatCommand.bind(this),
            'insert': this.handleInsertCommand.bind(this),
            'delete': this.handleDeleteCommand.bind(this),
            'replace': this.handleReplaceCommand.bind(this),
            'analyze': this.handleAnalyzeCommand.bind(this),
            'append': this.handleAppendCommand.bind(this),
            'prepend': this.handlePrependCommand.bind(this),
            'insertAt': this.handleInsertAtCommand.bind(this),
            'replaceRange': this.handleReplaceRangeCommand.bind(this),
            'analyzeStructure': this.handleAnalyzeStructureCommand.bind(this),
            'analyzeFormat': this.handleAnalyzeFormatCommand.bind(this),
            'analyzeContent': this.handleAnalyzeContentCommand.bind(this)
        };

        return handlers[type] || null;
    }

    /**
     *
     * @param data
     */
    async handleFormatCommand (data) {
        const { lineId, format } = data;
        if (!lineId || !format) throw new Error('Invalid format command data');

        const line = this.content.getLineById(lineId);
        if (!line) throw new Error('Line not found');

        this.content.applyFormatCommand({
            type: 'setFormat',
            lineId,
            format
        });
        return { success: true, lineId, format };
    }

    /**
     *
     * @param data
     */
    async handleInsertCommand (data) {
        const { text, format, afterLineId } = data;
        if (!text || !format) throw new Error('Invalid insert command data');

        const afterIndex = afterLineId ? this.content.getLineIndex(afterLineId) : -1;
        const insertIndex = afterIndex === -1 ? this.content.getLineCount() : afterIndex + 1;
        const command = {
            command: 'ADD',
            lineNumber: insertIndex,
            value: this._buildCommandValue(format, text)
        };
        const result = await this._applyCommands([command], 'ai_insert');
        const line = this.content.getLines()[insertIndex] || null;
        return { success: result.success, lineId: line?.id, result };
    }

    /**
     *
     * @param data
     */
    async handleDeleteCommand (data) {
        const { lineId } = data;
        if (!lineId) throw new Error('Invalid delete command data');

        const index = this.content.getLineIndex(lineId);
        if (index === -1) throw new Error('Line not found');
        const command = {
            command: 'DELETE',
            lineNumber: index + 1
        };
        const result = await this._applyCommands([command], 'ai_delete');
        return { success: result.success };
    }

    /**
     *
     * @param data
     */
    async handleReplaceCommand (data) {
        const { lineId, text } = data;
        if (!lineId || !text) throw new Error('Invalid replace command data');

        const line = this.content.getLineById(lineId);
        if (!line) throw new Error('Line not found');

        const command = {
            command: 'EDIT',
            lineNumber: this.content.getLineIndex(lineId) + 1,
            value: this._buildCommandValue(line.format, text)
        };
        const result = await this._applyCommands([command], 'ai_replace');
        return { success: result.success, lineId };
    }

    /**
     *
     * @param data
     */
    async handleAnalyzeCommand (data) {
        const { type } = data;
        if (!type) throw new Error('Invalid analyze command data');

        const content = this.content.getPlainText ? this.content.getPlainText() : this.content.getContent();
        let result;

        switch (type) {
            case 'structure':
                result = this.analyzeStructure(content);
                break;
            case 'format':
                result = this.analyzeFormat(content);
                break;
            case 'stats':
                result = this.analyzeStats(content);
                break;
            default:
                throw new Error(`Unknown analysis type: ${type}`);
        }

        return { success: true, result };
    }

    /**
     *
     * @param content
     */
    analyzeStructure (content) {
        const normalized = this.normalizeContent(content);
        return {
            lineCount: normalized.split('\n').length,
            paragraphCount: normalized.split('\n\n').length,
            chapterCount: this.content?.getChapterCount ? this.content.getChapterCount() : 0
        };
    }

    /**
     *
     * @param content
     */
    analyzeFormat (content) {
        const formats = new Map();
        const lines = this.content?.getLines ? this.content.getLines() : [];

        if (lines.length === 0) {
            return {};
        }

        lines.forEach(line => {
            const format = line?.format || 'action';
            formats.set(format, (formats.get(format) || 0) + 1);
        });

        return Object.fromEntries(formats);
    }

    /**
     * Analyze script statistics
     * @param {string} content - The script content
     * @returns {object} - Statistics object
     */
    analyzeStats (content) {
        const normalized = this.getContentForAnalysis(content);
        const cached = this._analysisCache.get(normalized);
        if (cached) {
            return cached;
        }

        const lines = normalized.split('\n');
        const words = normalized.split(/\s+/).filter(word => word.length > 0);
        const sentences = normalized.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
        const totalLines = this.content?.getLineCount ? this.content.getLineCount() : lines.length;
        const totalWords = this.content?.getWordCount ? this.content.getWordCount() : words.length;
        const totalCharacters = this.content?.getCharacterCount ? this.content.getCharacterCount() : normalized.length;

        const structureCounts = {
            totalLines,
            actionLines: 0,
            dialogueLines: 0,
            characterLines: 0,
            parentheticalLines: 0
        };

        const characters = new Map();
        let inDialogueBlock = false;
        let currentCharacter = null;

        lines.forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) {
                inDialogueBlock = false;
                currentCharacter = null;
                return;
            }

            if (/^\(.+\)$/.test(trimmed)) {
                structureCounts.parentheticalLines += 1;
                return;
            }

            if (/^(INT\.|EXT\.)/.test(trimmed)) {
                structureCounts.actionLines += 1;
                inDialogueBlock = false;
                currentCharacter = null;
                return;
            }

            if (trimmed === trimmed.toUpperCase() && trimmed.length <= 30) {
                structureCounts.characterLines += 1;
                inDialogueBlock = true;
                currentCharacter = trimmed;
                if (!characters.has(trimmed)) {
                    characters.set(trimmed, { lines: 0, words: 0 });
                }
                return;
            }

            if (inDialogueBlock && currentCharacter) {
                structureCounts.dialogueLines += 1;
                const entry = characters.get(currentCharacter);
                entry.lines += 1;
                entry.words += trimmed.split(/\s+/).filter(word => word.length > 0).length;
                return;
            }

            structureCounts.actionLines += 1;
        });

        const dialogueLineCount = Math.max(structureCounts.dialogueLines, 1);
        const dialogueWordCount = Array.from(characters.values()).reduce((total, entry) => total + entry.words, 0);
        const dialoguePercentage = totalLines > 0
            ? Math.round((structureCounts.dialogueLines / totalLines) * 100)
            : 0;

        const state = this.stateManager?.getState ? this.stateManager.getState() : null;
        const context = {
            title: state?.title || '',
            author: state?.author || '',
            status: state?.status || ''
        };

        const result = {
            structure: structureCounts,
            characters: {
                count: characters.size,
                list: Array.from(characters.keys()),
                dialogueDistribution: Object.fromEntries(
                    Array.from(characters.entries()).map(([name, data]) => [name, data.words])
                ),
                development: 'unknown',
                voiceConsistency: 'unknown',
                dialogueQuality: 'unknown'
            },
            scenes: {
                count: lines.filter(line => /^(INT\.|EXT\.)/.test(line.trim())).length,
                locations: [],
                transitions: []
            },
            dialogue: {
                totalWords: dialogueWordCount,
                averageWordsPerLine: dialogueWordCount / dialogueLineCount,
                characterVoice: Object.fromEntries(
                    Array.from(characters.entries()).map(([name, data]) => [name, data.lines])
                )
            },
            format: {
                actionLines: structureCounts.actionLines,
                actionEffectiveness: 'unknown',
                visualElements: [],
                compliance: 'unknown',
                suggestions: [],
                errors: []
            },
            insights: [
                'Script analysis completed with baseline metrics.'
            ],
            strengths: [],
            weaknesses: [],
            recommendations: [
                {
                    type: 'structure',
                    description: 'Review scene pacing and dialogue balance.',
                    priority: 'medium'
                }
            ],
            metrics: {
                totalLines,
                totalWords,
                totalCharacters,
                averageWordsPerLine: totalWords / Math.max(totalLines, 1),
                dialoguePercentage
            },
            pacing: {
                overall: 'unknown',
                sceneTransitions: 'unknown',
                dialogueFlow: 'unknown'
            },
            genre: {
                type: 'unknown',
                conventions: [],
                compliance: 'unknown'
            },
            feedback: {
                overall: 'Analysis generated.',
                specific: [],
                actionable: []
            },
            improvements: [],
            context,
            complexity: {
                level: totalLines > 200 ? 'high' : 'medium',
                factors: [],
                recommendations: []
            },
            status: {
                current: context.status || 'draft',
                suggestions: [],
                nextSteps: []
            },
            aiData: {
                summary: 'Script analysis summary.',
                keyPoints: [],
                context
            },
            aiResponse: {
                format: 'structured',
                tone: 'constructive',
                structure: 'sections'
            }
        };

        this._analysisCache.set(normalized, result);
        return result;
    }

    /**
     * Handle append command - add content to the end of the script
     * @param {object} data - Command data
     * @returns {Promise<object>} - Command result
     */
    async handleAppendCommand (data) {
        const { content, format = 'action' } = data;
        if (!content) throw new Error('Content is required for append command');

        try {
            const command = {
                command: 'ADD',
                lineNumber: this.content.getLineCount(),
                value: this._buildCommandValue(format, content)
            };
            const result = await this._applyCommands([command], 'ai_append');
            return { success: result.success, operation: 'append', result };
        } catch (error) {
            console.error('[AICommandManager] Append command failed:', error);
            throw error;
        }
    }

    /**
     * Handle prepend command - add content to the beginning of the script
     * @param {object} data - Command data
     * @returns {Promise<object>} - Command result
     */
    async handlePrependCommand (data) {
        const { content, format = 'action' } = data;
        if (!content) throw new Error('Content is required for prepend command');

        try {
            const command = {
                command: 'ADD',
                lineNumber: 0,
                value: this._buildCommandValue(format, content)
            };
            const result = await this._applyCommands([command], 'ai_prepend');
            return { success: result.success, operation: 'prepend', result };
        } catch (error) {
            console.error('[AICommandManager] Prepend command failed:', error);
            throw error;
        }
    }

    /**
     * Handle insert at specific position command
     * @param {object} data - Command data
     * @returns {Promise<object>} - Command result
     */
    async handleInsertAtCommand (data) {
        const { content, position, format = 'action' } = data;
        if (!content) throw new Error('Content is required for insertAt command');
        if (typeof position !== 'number') throw new Error('Position must be a number');

        try {
            const command = {
                command: 'ADD',
                lineNumber: position,
                value: this._buildCommandValue(format, content)
            };
            const result = await this._applyCommands([command], 'ai_insert_at');
            return { success: result.success, operation: 'insertAt', position, result };
        } catch (error) {
            console.error('[AICommandManager] InsertAt command failed:', error);
            throw error;
        }
    }

    /**
     * Handle replace range command - replace content in a specific range
     * @param {object} data - Command data
     * @returns {Promise<object>} - Command result
     */
    async handleReplaceRangeCommand (data) {
        const { content, startPosition, endPosition, format = 'action' } = data;
        if (!content) throw new Error('Content is required for replaceRange command');
        if (typeof startPosition !== 'number') throw new Error('Start position must be a number');
        if (typeof endPosition !== 'number') throw new Error('End position must be a number');

        try {
            const lineCount = this.content.getLineCount();
            const safeStart = Math.max(0, startPosition);
            const safeEnd = Math.min(lineCount - 1, endPosition);
            if (safeStart > safeEnd) {
                throw new Error('Invalid replace range');
            }

            const deleteCommands = [];
            for (let index = safeEnd; index >= safeStart; index -= 1) {
                deleteCommands.push({
                    command: 'DELETE',
                    lineNumber: index + 1
                });
            }

            const addCommand = {
                command: 'ADD',
                lineNumber: safeStart,
                value: this._buildCommandValue(format, content)
            };

            const result = await this._applyCommands([...deleteCommands, addCommand], 'ai_replace_range');
            return { success: result.success, operation: 'replaceRange', startPosition, endPosition, result };
        } catch (error) {
            console.error('[AICommandManager] ReplaceRange command failed:', error);
            throw error;
        }
    }

    /**
     * Handle analyze structure command
     * @param {object} data - Command data
     * @returns {Promise<object>} - Command result
     */
    async handleAnalyzeStructureCommand (data) {
        try {
            if (data?.type && data.type !== 'structure') {
                throw new Error('Invalid structure analysis request');
            }

            const content = this.content.getContent();
            const analysis = this.analyzeStats(content);
            return {
                success: true,
                operation: 'analyzeStructure',
                analysis: {
                    structure: analysis.structure,
                    stats: analysis.metrics
                }
            };
        } catch (error) {
            console.error('[AICommandManager] AnalyzeStructure command failed:', error);
            throw error;
        }
    }

    /**
     * Handle analyze format command
     * @param {object} data - Command data
     * @returns {Promise<object>} - Command result
     */
    async handleAnalyzeFormatCommand (data) {
        try {
            if (data?.type && data.type !== 'format') {
                throw new Error('Invalid format analysis request');
            }

            const content = this.content.getContent();
            const analysis = this.analyzeStats(content);
            return {
                success: true,
                operation: 'analyzeFormat',
                analysis: {
                    format: analysis.format,
                    compliance: analysis.format?.compliance || 'unknown'
                }
            };
        } catch (error) {
            console.error('[AICommandManager] AnalyzeFormat command failed:', error);
            throw error;
        }
    }

    /**
     * Handle analyze content command
     * @param {object} data - Command data
     * @returns {Promise<object>} - Command result
     */
    async handleAnalyzeContentCommand (data) {
        try {
            if (data?.type && data.type !== 'content') {
                throw new Error('Invalid content analysis request');
            }

            const content = this.content.getContent();
            const analysis = this.analyzeStats(content);
            return {
                success: true,
                operation: 'analyzeContent',
                analysis: {
                    content: analysis.metrics,
                    suggestions: analysis.recommendations
                }
            };
        } catch (error) {
            console.error('[AICommandManager] AnalyzeContent command failed:', error);
            throw error;
        }
    }

    /**
     *
     */
    destroy () {
        this.commands.clear();
        this.eventHandlers.clear();
        this.content = null;
        this.stateManager = null;
        this.isProcessing = false;
        this._analysisCache.clear();

        // Clear performance optimizations
        this._commandCache.clear();
        this._batchCommands = [];
        this._isBatching = false;
    }

    normalizeContent (content) {
        return typeof content === 'string' ? content : '';
    }

    getContentForAnalysis (content) {
        if (typeof content === 'string') {
            return content;
        }

        if (this.content?.getPlainText) {
            return this.content.getPlainText() || '';
        }

        return '';
    }

    // ==============================================
    // Performance Optimization Methods
    // ==============================================

    /**
     * Cache command result for performance
     * @param key
     * @param result
     * @param ttl
     */
    cacheCommandResult (key, result, ttl = null) {
        const expiry = ttl || this._cacheExpiry;
        this._commandCache.set(key, {
            data: result,
            timestamp: Date.now(),
            expiry: expiry
        });

        this._cleanupCacheIfNeeded();
    }

    /**
     * Get cached command result
     * @param key
     */
    getCachedCommandResult (key) {
        const cached = this._commandCache.get(key);
        if (!cached) {
            return null;
        }

        const now = Date.now();
        if (now - cached.timestamp > cached.expiry) {
            this._commandCache.delete(key);
            return null;
        }

        return cached.data;
    }

    /**
     * Clean up expired cache entries
     */
    _cleanupCacheIfNeeded () {
        const now = Date.now();
        if (now - this._lastCacheCleanup < 60000) { // Cleanup every minute
            return;
        }

        this._lastCacheCleanup = now;
        const expiredKeys = [];

        this._commandCache.forEach((value, key) => {
            if (now - value.timestamp > value.expiry) {
                expiredKeys.push(key);
            }
        });

        expiredKeys.forEach(key => this._commandCache.delete(key));

        if (expiredKeys.length > 0) {
            debugLog(`[AICommandManager] Cleaned up ${expiredKeys.length} expired cache entries`);
        }
    }

    /**
     * Batch multiple commands for better performance
     * @param command
     */
    batchCommand (command) {
        this._batchCommands.push(command);

        if (!this._isBatching) {
            this._isBatching = true;
            requestAnimationFrame(() => {
                this._processBatchCommands();
            });
        }
    }

    /**
     * Process batched commands
     */
    _processBatchCommands () {
        if (this._batchCommands.length === 0) {
            this._isBatching = false;
            return;
        }

        // Process all batched commands
        this._batchCommands.forEach(async (command) => {
            try {
                await this.executeCommand(command);
            } catch (error) {
                console.error('[AICommandManager] Error in batched command:', error);
            }
        });

        // Clear the batch
        this._batchCommands = [];
        this._isBatching = false;
    }

    /**
     * Optimized command execution with caching
     * @param command
     */
    async executeCommandOptimized (command) {
        const cacheKey = `${command.type}_${JSON.stringify(command.data)}`;
        const cached = this.getCachedCommandResult(cacheKey);

        if (cached) {
            debugLog('[AICommandManager] Using cached command result');
            return cached;
        }

        const result = await this.executeCommand(command);

        if (result) {
            this.cacheCommandResult(cacheKey, result);
        }

        return result;
    }

    /**
     * Get performance statistics
     */
    getPerformanceStats () {
        return {
            cacheSize: this._commandCache.size,
            batchQueueSize: this._batchCommands.length,
            isBatching: this._isBatching,
            isProcessing: this.isProcessing,
            lastCacheCleanup: this._lastCacheCleanup
        };
    }

    /**
     * Clear all caches
     */
    clearCaches () {
        this._commandCache.clear();
        this._batchCommands = [];
        this._isBatching = false;
        debugLog('[AICommandManager] All caches cleared');
    }
}
