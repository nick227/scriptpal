import { EDITOR_EVENTS } from '../constants.js';
import { debugLog } from '../../../core/logger.js';
import { ScriptAnalysisService } from './ScriptAnalysisService.js';
import { EditorCommandExecutor } from './EditorCommandExecutor.js';

/**
 * Event constants for AI Command Lifecycle
 */
export const AI_COMMAND_EVENTS = {
    START: 'commandStart',
    COMPLETE: 'commandComplete',
    ERROR: 'commandError'
};

/**
 *
 */
export class AICommandManager {
    /**
     * @param stateManager
     */
    constructor (stateManager) {
        if (!stateManager) throw new Error('StateManager is required');

        this.stateManager = stateManager;
        this.content = null;
        this.eventHandlers = new Map();
        
        // Services
        this.analysisService = new ScriptAnalysisService(stateManager);
        this.executor = new EditorCommandExecutor();

        // Processing states
        this.isMutating = false;
        this.isAnalyzing = false;

        // Performance optimizations
        this._commandCache = new Map();
        this._cacheExpiry = 30000; // 30 seconds
        this._lastCacheCleanup = 0;
        this._batchCommands = [];
        this._isBatching = false;

        /**
         * COORDINDATE SYSTEM NOTE:
         * All internal logic in AICommandManager assumes 0-BASED coordinates.
         * Conversion to 1-based editor coordinates happens only at the point
         * of calling this.content.applyCommands() inside the handlers.
         */

        // Explicit set of read-only commands
        this.ANALYSIS_COMMANDS = new Set([
            'analyze',
            'analyzeStructure',
            'analyzeFormat',
            'analyzeContent'
        ]);

        // Initialize command handlers once to avoid re-binding
        this._initHandlers();
        
        // Define command schemas for validation
        this._initSchemas();
    }

    /**
     * Initialize the command handler map
     * @private
     */
    _initHandlers () {
        this.handlers = {
            'format': this.executor.handleFormatCommand.bind(this.executor),
            'insert': this.executor.handleInsertCommand.bind(this.executor),
            'delete': this.executor.handleDeleteCommand.bind(this.executor),
            'replace': this.executor.handleReplaceCommand.bind(this.executor),
            'analyze': this.handleAnalyzeCommand.bind(this),
            'append': this.executor.handleAppendCommand.bind(this.executor),
            'prepend': this.executor.handlePrependCommand.bind(this.executor),
            'insertAt': this.executor.handleInsertAtCommand.bind(this.executor),
            'replaceRange': this.executor.handleReplaceRangeCommand.bind(this.executor),
            'analyzeStructure': this.handleAnalyzeStructureCommand.bind(this),
            'analyzeFormat': this.handleAnalyzeFormatCommand.bind(this),
            'analyzeContent': this.handleAnalyzeContentCommand.bind(this)
        };
    }

    /**
     * Initialize command validation schemas
     * @private
     */
    _initSchemas () {
        this.COMMAND_SCHEMAS = {
            'format': ['lineId', 'format'],
            'insert': ['text', 'format'],
            'delete': ['lineId'],
            'replace': ['lineId', 'text'],
            'analyze': ['type'],
            'append': ['content'],
            'prepend': ['content'],
            'insertAt': ['content', 'position'],
            'replaceRange': ['content', 'startPosition', 'endPosition'],
            'analyzeStructure': [],
            'analyzeFormat': [],
            'analyzeContent': []
        };
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
        this.analysisService.setContent(content);
        this.executor.setContent(content);
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

    // ==============================================
    // Command Dispatching & Processing
    // ==============================================

    /**
     * AI Command Events
     * @typedef {Object} AICommandEvents
     * @property {string} COMMAND_START - Emitted when a command begins processing
     * @property {string} COMMAND_COMPLETE - Emitted when a command finishes successfully
     * @property {string} COMMAND_ERROR - Emitted when a command fails
     */
    
    /**
     * Execute an AI command with proper error handling and validation
     * @param {object} command - The command to execute
     * @param {string} command.type - The command type (e.g., 'insert', 'analyze')
     * @param {object} command.data - The command payload
     * @returns {Promise<object>} - The command result
     * 
     * @emits AICommandManager#commandStart
     * @emits AICommandManager#commandComplete
     * @emits AICommandManager#commandError
     */
    async executeCommand (command) {
        const isAnalysis = this._isAnalysisCommand(command.type);
        
        if (isAnalysis) {
            // Analysis is allowed unless we are currently mutating
            if (this.isMutating) {
                throw new Error('Cannot run analysis while a mutation is in progress');
            }
        } else {
            // Mutations are strictly serialized
            if (this.isMutating) {
                throw new Error('Another mutation command is currently being processed');
            }
        }

        const flag = isAnalysis ? 'isAnalyzing' : 'isMutating';
        
        try {
            this[flag] = true;
            this.emit(AI_COMMAND_EVENTS.START, { command });

            // Validate command
            if (!this.validateCommand(command)) {
                throw new Error(`Invalid command format for type: ${command.type}`);
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

            // Invalidate analysis cache on successful mutations
            if (!isAnalysis && result.success) {
                this.analysisService.clearCache();
                debugLog('[AICommandManager] Mutation successful, invalidated analysis cache');
            }

            this.emit(AI_COMMAND_EVENTS.COMPLETE, { command, result });
            return result;
        } catch (error) {
            console.error('[AICommandManager] Command failed:', {
                type: command.type,
                error: error.message
            });
            this.emit(AI_COMMAND_EVENTS.ERROR, { command, error });
            throw error;
        } finally {
            this[flag] = false;
        }
    }

    /**
     * Check if a command is an analysis command (read-only)
     * @param {string} type
     * @returns {boolean}
     * @private
     */
    _isAnalysisCommand (type) {
        return this.ANALYSIS_COMMANDS.has(type);
    }

    /**
     * Validate command against defined schemas
     * @param {object} command
     * @returns {boolean}
     */
    validateCommand (command) {
        if (!command || typeof command !== 'object') return false;
        if (!command.type || typeof command.type !== 'string') return false;
        if (!command.data) return false;

        const requiredFields = this.COMMAND_SCHEMAS[command.type];
        if (!requiredFields) {
            debugLog(`[AICommandManager] Validation failed: No schema defined for command type: ${command.type}`);
            return false;
        }

        for (const field of requiredFields) {
            if (command.data[field] === undefined || command.data[field] === null) {
                debugLog(`[AICommandManager] Validation failed: missing field "${field}" for command "${command.type}"`);
                return false;
            }
        }

        return true;
    }

    /**
     * Process command by dispatching to appropriate handler
     * @param {object} command
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
        return this.handlers[type] || null;
    }


    // ==============================================
    // Analysis Handlers (Read-Only)
    // ==============================================

    /**
     * Handle analyze command (generic dispatcher)
     * @param data
     */
    async handleAnalyzeCommand (data) {
        const { type } = data;
        let result;

        switch (type) {
            case 'structure':
                result = this.analysisService.analyzeStructure();
                break;
            case 'format':
                result = this.analysisService.analyzeFormat();
                break;
            case 'stats':
                result = this.analysisService.analyzeStats();
                break;
            default:
                throw new Error(`Unknown analysis type: ${type}`);
        }

        return { success: true, result };
    }

    /**
     * Handle analyze structure command
     */
    async handleAnalyzeStructureCommand (data) {
        const analysis = this.analysisService.analyzeStats();
        return {
            success: true,
            operation: 'analyzeStructure',
            analysis: {
                structure: analysis.structure,
                stats: analysis.metrics
            }
        };
    }

    /**
     * Handle analyze format command
     */
    async handleAnalyzeFormatCommand (data) {
        const analysis = this.analysisService.analyzeStats();
        return {
            success: true,
            operation: 'analyzeFormat',
            analysis: {
                format: analysis.format,
                compliance: analysis.format?.compliance || 'unknown'
            }
        };
    }

    /**
     * Handle analyze content command
     */
    async handleAnalyzeContentCommand (data) {
        const analysis = this.analysisService.analyzeStats();
        return {
            success: true,
            operation: 'analyzeContent',
            analysis: {
                content: analysis.metrics,
                suggestions: analysis.recommendations
            }
        };
    }


    /**
     *
     */
    destroy () {
        this.eventHandlers.clear();
        this.content = null;
        this.stateManager = null;
        this.isMutating = false;
        this.isAnalyzing = false;
        this.analysisService.clearCache();
        this.executor.setContent(null);

        // Clear performance optimizations
        this._commandCache.clear();
        this._batchCommands = [];
        this._isBatching = false;
    }

    /**
     * Generate a stable, deterministic cache key for a command
     * @param {object} command
     * @returns {string}
     * @private
     */
    _generateCacheKey (command) {
        if (!command || !command.type) return 'invalid';
        const dataString = this._stableStringify(command.data || {});
        return `${command.type}_${dataString}`;
    }

    /**
     * Deterministically stringify an object by sorting its keys
     * @param {any} obj
     * @returns {string}
     * @private
     */
    _stableStringify (obj) {
        if (obj === null || typeof obj !== 'object') {
            return String(obj);
        }
        if (Array.isArray(obj)) {
            return '[' + obj.map(item => this._stableStringify(item)).join(',') + ']';
        }
        const keys = Object.keys(obj).sort();
        return '{' + keys.map(key => `"${key}":${this._stableStringify(obj[key])}`).join(',') + '}';
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
     * Process batched commands sequentially to ensure correct application
     * @private
     */
    async _processBatchCommands () {
        if (this._batchCommands.length === 0) {
            this._isBatching = false;
            return;
        }

        // Copy and clear the batch queue to prevent race conditions during processing
        const commandsToProcess = [...this._batchCommands];
        this._batchCommands = [];

        try {
            // Use for...of to correctly await each command in order
            for (const command of commandsToProcess) {
                try {
                    await this.executeCommand(command);
                } catch (error) {
                    console.error('[AICommandManager] Error in batched command:', {
                        type: command.type,
                        error: error.message
                    });
                }
            }
        } finally {
            this._isBatching = false;
            
            // If more commands were added during processing, schedule another batch
            if (this._batchCommands.length > 0) {
                this._isBatching = true;
                requestAnimationFrame(() => this._processBatchCommands());
            }
        }
    }

    /**
     * Optimized command execution with caching
     * @param command
     */
    async executeCommandOptimized (command) {
        const cacheKey = this._generateCacheKey(command);
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
            isMutating: this.isMutating,
            isAnalyzing: this.isAnalyzing,
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
