import { isValidFormat, resolveLineFormat, DEFAULT_FORMAT } from '../../constants/formats.js';
import { EventManager } from '../../core/EventManager.js';
import { StateManager } from '../../core/StateManager.js';

const AI_MAX_LINE_LENGTH = 120;

/**
 * Chunk size for AI append operations.
 * Matches MAX_LINES_PER_PAGE to ensure page math runs between chunks.
 * This prevents content overflow when bulk-appending AI-generated lines.
 */
const AI_APPEND_CHUNK_SIZE = 22;

/**
 * ScriptOrchestrator - SEMANTIC AUTHORITY for AI script content.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCHITECTURAL CONTRACT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ScriptLine (single source of truth):
 *   { id: string, format: ScriptFormat, content: string }
 *
 * Ownership Rules:
 *   ┌────────────────────┬──────────────────────────────┐
 *   │ Concern            │ Owner                        │
 *   ├────────────────────┼──────────────────────────────┤
 *   │ AI normalization   │ ScriptOrchestrator           │
 *   │ Format resolution  │ resolveLineFormat()          │
 *   │ Commands           │ EditorCoordinator            │
 *   │ Document mutation  │ EditorDocumentService        │
 *   │ Rendering decisions│ EditorRendererAdapter        │
 *   │ DOM construction   │ LineFormatter                │
 *   └────────────────────┴──────────────────────────────┘
 *
 * ScriptOrchestrator is the ONLY place allowed to:
 *   - Parse AI text
 *   - Normalize tags
 *   - Split long lines
 *   - Infer formats
 *
 * After ScriptOrchestrator:
 *   Guaranteed invariant: Array<{ format: string, content: string }>
 *   Everything downstream TRUSTS this.
 *
 * Forbidden:
 *   - Regex parsing after orchestrator
 *   - Tagged strings in commands
 *   - Renderer generating IDs
 *   - Undo relying on recomputation
 *
 * Required:
 *   - ScriptLine snapshots everywhere
 *   - Deterministic command inverses
 *   - AI edits always atomic
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
export class ScriptOrchestrator {
    /**
     *
     * @param scriptStore
     * @param scriptSyncService
     * @param container
     * @param editorWidgetInstance
     */
    constructor (scriptStore, scriptSyncService, container, editorWidgetInstance) {
        if (!scriptStore) throw new Error('ScriptStore is required for ScriptOrchestrator');
        if (!scriptSyncService) throw new Error('ScriptSyncService is required for ScriptOrchestrator');
        if (!container) throw new Error('Container element is required for ScriptOrchestrator');
        if (!editorWidgetInstance) throw new Error('Editor instance is required for ScriptOrchestrator');
        this.scriptStore = scriptStore;
        this.syncService = scriptSyncService;
        this.container = container;
        this.editorWidgetInstance = editorWidgetInstance;

        // Initialize event handling
        this.eventManager = scriptStore.eventManager;
        this.stateManager = scriptStore.stateManager;
        if (!this.eventManager || !this.stateManager) {
            throw new Error('EventManager and StateManager are required for ScriptOrchestrator');
        }

        // Subscribe to events
        this.setupEventSubscriptions();
    }

    /**
     *
     */
    setupEventSubscriptions () {
        if (!this.eventManager) return;

        this.eventManager.subscribe(
            EventManager.EVENTS.SCRIPT.EDIT,
            this.handleScriptEdit.bind(this)
        );
    }

    /**
     *
     * @param scriptData
     */
    async handleScriptEdit (scriptData) {
        let currentScript = null;
        try {
            currentScript = await this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
            if (!scriptData || !currentScript) {
                throw new Error('Invalid script data or no current script');
            }

            // Validate required data
            if (!scriptData.content || !scriptData.versionNumber) {
                throw new Error('Missing required script data (content or version)');
            }

            // Determine the canonical content snapshot after commands run (prefer editor state)
            const editorContentComponent = this.editorWidgetInstance?.getComponent?.('content');
            const editorContent = editorContentComponent?.getContent
                ? editorContentComponent.getContent()
                : null;
            const canonicalContent = typeof editorContent === 'string'
                ? editorContent
                : (typeof scriptData.content === 'string' ? scriptData.content : currentScript.content);

            // Create updated script object
            const updatedScript = {
                ...currentScript,
                content: canonicalContent,
                versionNumber: scriptData.versionNumber,
                timestamp: Date.now()
            };

            // Update cache and current script in the store
            this.scriptStore.updateScriptInCache(updatedScript);
            this.scriptStore.setCurrentScript(updatedScript, { source: 'edit' });

            // First update editor state
            if (Array.isArray(scriptData.commands) && scriptData.commands.length > 0) {
                await this.editorWidgetInstance.applyCommands(scriptData.commands);
            } else {
                console.warn('[ORCHESTRATOR] AI edit missing commands, skipping update');
            }

            // Then notify content update
            this.eventManager.publish(EventManager.EVENTS.EDITOR.CONTENT_UPDATE, {
                content: updatedScript.content,
                script: updatedScript,
                source: 'edit',
                isEdit: true,
                forceUpdate: false, // Don't force update to prevent loops
                clearFirst: true,
                timestamp: Date.now()
            });

            return updatedScript;

        } catch (error) {
            console.error('[ORCHESTRATOR] Edit failed:', error);

            this.eventManager.publish(EventManager.EVENTS.SCRIPT.ERROR, {
                error: error.message,
                type: 'edit',
                scriptId: currentScript ? currentScript.id : null,
                timestamp: Date.now()
            });

            return null;
        }
    }

    /**
     *
     * @param data
     */
    /**
     *
     */
    destroy () {
        if (this.eventManager) {
            this.eventManager.unsubscribeAll(this);
        }

        // Clear all state
        this.scriptStore = null;
        this.syncService = null;
        this.container = null;
        this.eventManager = null;
        this.stateManager = null;
    }

    // ==============================================
    // AI Script Operations - UNIFIED ENTRY POINT
    // ==============================================

    /**
     * Unified AI entry point - SINGLE PUBLIC API for all AI script mutations.
     * Routes internally to appendLines, insertLines, or replaceRange.
     *
     * @param {object} delta - AI script delta
     * @param {'append'|'prepend'|'insert'|'replace'} delta.operation - Operation type
     * @param {string} delta.content - Raw AI text content
     * @param {number} [delta.position] - Insert position (for insert/prepend)
     * @param {string} [delta.startId] - Start line ID (for replace)
     * @param {string} [delta.endId] - End line ID (for replace)
     * @returns {Promise<{success: boolean, linesAffected: number}>}
     */
    async handleAiDelta (delta) {
        if (!delta || !delta.content) {
            return { success: false, error: 'Invalid delta: content is required' };
        }

        const operation = delta.operation || 'append';

        // Normalize content through canonical pipeline
        const normalizedLines = this.normalizeScriptLines(delta.content);
        const lineItems = normalizedLines
            .map(line => this.buildLineItem(line))
            .filter(Boolean);

        if (lineItems.length === 0) {
            return { success: true, linesAffected: 0 };
        }

        // Route to appropriate handler
        switch (operation) {
            case 'append':
                return this._applyAiLines(lineItems, { position: 'end', source: 'ai_append' });

            case 'prepend':
                return this._applyAiLines(lineItems, { position: 0, source: 'ai_prepend' });

            case 'insert':
                return this._applyAiLines(lineItems, {
                    position: delta.position ?? 0,
                    source: 'ai_insert'
                });

            case 'replace':
                return this._applyAiReplace(lineItems, {
                    startId: delta.startId,
                    endId: delta.endId,
                    source: 'ai_replace'
                });

            default:
                return { success: false, error: `Unknown operation: ${operation}` };
        }
    }

    /**
     * Internal: Apply AI lines at a position
     * Uses chunked appending for 'end' position to allow page math between chunks.
     * @private
     */
    async _applyAiLines (lineItems, { position, source }) {
        const editorContent = this.editorWidgetInstance?.getComponent('content');
        if (!editorContent) {
            throw new Error('Editor content component not available');
        }

        // 'end' means append - use chunked approach for proper page distribution
        if (position === 'end') {
            return this._chunkedAppend(editorContent, lineItems, source);
        }

        // Build structured commands for insert
        const commands = lineItems.map((item, i) => ({
            command: 'ADD',
            lineNumber: position + i,
            data: { format: item.format, content: item.content }
        }));

        const result = await editorContent.applyCommands(commands, { source });
        return { success: result.success, linesAffected: lineItems.length };
    }

    /**
     * Append lines in chunks to allow page math between batches.
     * Prevents content overflow when bulk-appending AI-generated lines.
     * @private
     */
    async _chunkedAppend (editorContent, lineItems, source) {
        let totalAppended = 0;
        let lastResult = { success: true };

        for (let i = 0; i < lineItems.length; i += AI_APPEND_CHUNK_SIZE) {
            const chunk = lineItems.slice(i, i + AI_APPEND_CHUNK_SIZE);
            const result = await editorContent.appendLines(chunk, { source });

            if (!result.success) {
                console.error('[ScriptOrchestrator] Chunk append failed at index', i);
                return { success: false, linesAffected: totalAppended, error: 'chunk_failed' };
            }

            totalAppended += chunk.length;
            lastResult = result;
        }

        return { success: true, linesAffected: totalAppended, result: lastResult };
    }

    /**
     * Internal: Replace range with AI lines
     * @private
     */
    async _applyAiReplace (lineItems, { startId, endId, source }) {
        const editorContent = this.editorWidgetInstance?.getComponent('content');
        if (!editorContent) {
            throw new Error('Editor content component not available');
        }

        // For replace, we delete the range then insert new lines
        // This is a future extension point
        console.warn('[ScriptOrchestrator] Replace operation not yet implemented');
        return { success: false, error: 'Replace not implemented' };
    }

    // ==============================================
    // Legacy AI Handlers (thin adapters)
    // ==============================================

    /**
     * Handle script append operations from AI
     * @deprecated Use handleAiDelta({ operation: 'append', content }) instead
     * @param {object} data - Append data
     * @param {string} data.content - Content to append
     * @returns {Promise<boolean>} - Success status
     */
    async handleScriptAppend (data) {
        try {

            if (!data || !data.content) {
                throw new Error('Invalid append data: content is required');
            }

            // Get the editor content component
            const editorContent = this.editorWidgetInstance?.getComponent('content');
            if (!editorContent) {
                console.warn('[ScriptOrchestrator] Editor content component not available');
                throw new Error('Editor content component not available');
            }

            const normalizedLines = this.normalizeScriptLines(data.content);
            console.log('[ScriptOrchestrator] append line normalization', {
                normalizedLineCount: normalizedLines.length
            });
            const lineItems = normalizedLines
                .map(line => this.buildLineItem(line))
                .filter(Boolean);
            const formatCounts = lineItems.reduce((acc, item) => {
                const key = item.format || 'unknown';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});
            console.log('[ScriptOrchestrator] append format breakdown', {
                formatCounts,
                sample: lineItems.slice(0, 5)
            });

            console.log('[ScriptOrchestrator] append lines', {
                totalLines: lineItems.length,
                chunks: Math.ceil(lineItems.length / AI_APPEND_CHUNK_SIZE)
            });

            // Use chunked append for proper page distribution
            const result = await this._chunkedAppend(editorContent, lineItems, 'script_append');

            if (result.success) {
                // Emit success event
                this.eventManager.publish(EventManager.EVENTS.SCRIPT.APPENDED, {
                    content: data.content,
                    linesAffected: result.linesAffected
                });

                return true;
            } else {
                throw new Error('Append operation failed');
            }
        } catch (error) {
            console.error('[ScriptOrchestrator] Script append failed:', error);
            this.handleError(error, 'handleScriptAppend');
            return false;
        }
    }

    /**
     * Determine the appropriate format for content
     * @param {string} content - The content to analyze
     * @returns {string} - The determined format
     */
    determineContentFormat (content) {
        if (!content || typeof content !== 'string') {
            return 'action';
        }

        const trimmedContent = content.trim();

        // Check for scene headers (usually in caps)
        if (trimmedContent.match(/^(INT\.|EXT\.|INTERIOR|EXTERIOR)/i)) {
            return 'header';
        }

        // Check for speaker names (usually in caps, short)
        if (trimmedContent.match(/^[A-Z][A-Z\s]+$/)) {
            return 'speaker';
        }

        // Check for dialogue (usually in quotes or starts with lowercase)
        if (trimmedContent.match(/^["'].*["']$/) || trimmedContent.match(/^[a-z]/)) {
            return 'dialog';
        }

        // Check for directions (usually in parentheses)
        if (trimmedContent.match(/^\(.*\)$/)) {
            return 'directions';
        }

        // Default to action
        return 'action';
    }

    parseTaggedLine (line) {
        if (typeof line !== 'string') {
            return null;
        }
        const trimmedLine = line.trim();
        if (!trimmedLine) {
            return null;
        }
        const selfClosingMatch = trimmedLine.match(/^<([\w-]+)\s*\/>$/);
        if (selfClosingMatch) {
            const format = selfClosingMatch[1].toLowerCase();
            if (!isValidFormat(format)) {
                return null;
            }
            if (format !== 'chapter-break') {
                return null;
            }
            return {
                format,
                content: ''
            };
        }
        const match = trimmedLine.match(/^<([\w-]+)>([\s\S]*)<\/\1>$/);
        if (!match) {
            return null;
        }
        const format = match[1].toLowerCase();
        if (!isValidFormat(format)) {
            return null;
        }
        return {
            format,
            content: match[2].trim()
        };
    }

    normalizeScriptLines (content, { preserveEmpty = true } = {}) {
        if (!content && content !== 0) {
            return [];
        }
        const normalized = String(content)
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');

        const lines = normalized.split('\n').map(line => line.trim());

        if (!preserveEmpty) {
            return lines.filter(line => line.length > 0);
        }

        // Preserve empty lines but collapse multiple consecutive empties to one
        const result = [];
        let lastWasEmpty = false;
        for (const line of lines) {
            if (line.length === 0) {
                if (!lastWasEmpty) {
                    result.push(''); // Keep one empty line
                    lastWasEmpty = true;
                }
                // Skip consecutive empties
            } else {
                result.push(line);
                lastWasEmpty = false;
            }
        }
        // Trim leading/trailing empty lines
        while (result.length > 0 && result[0] === '') {
            result.shift();
        }
        while (result.length > 0 && result[result.length - 1] === '') {
            result.pop();
        }
        return result;
    }

    /**
     * PRE-SEMANTIC AI HYGIENE.
     *
     * This is the ONLY place where tagged strings are tolerable because:
     *   - It operates BEFORE semantic parsing
     *   - It's an AI-specific hygiene step
     *
     * DO NOT use this for user edits.
     * DO NOT let this creep into other paths.
     *
     * @param {string} content - Raw AI content
     * @param {number} maxLength - Max line length
     * @returns {string} - Content with long lines split
     */
    splitLongAiLines (content, maxLength = AI_MAX_LINE_LENGTH) {
        if (typeof content !== 'string') {
            return content;
        }
        const normalized = content
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');
        const lines = normalized.split('\n');
        const result = [];

        for (const rawLine of lines) {
            const trimmedLine = rawLine.trim();
            if (!trimmedLine) {
                continue;
            }
            const normalizedLine = this.normalizeTagNames(trimmedLine);
            const parsed = this.parseTaggedLine(normalizedLine);
            if (parsed && parsed.format === 'chapter-break') {
                result.push('<chapter-break />');
                continue;
            }
            if (parsed) {
                const chunks = this._splitLineByLength(parsed.content, maxLength);
                if (chunks.length === 0) {
                    result.push(normalizedLine);
                } else {
                    chunks.forEach(chunk => {
                        result.push(`<${parsed.format}>${chunk}</${parsed.format}>`);
                    });
                }
                continue;
            }
            const chunks = this._splitLineByLength(trimmedLine, maxLength);
            if (chunks.length > 0) {
                result.push(...chunks);
            }
        }

        return result.join('\n');
    }

    _splitLineByLength (text, maxLength) {
        if (!text || typeof text !== 'string') {
            return [];
        }
        if (!Number.isFinite(maxLength) || maxLength <= 0) {
            return [text.trim()];
        }
        const trimmed = text.trim();
        if (!trimmed) {
            return [];
        }
        if (trimmed.length <= maxLength) {
            return [trimmed];
        }
        const chunks = [];
        let remaining = trimmed;
        while (remaining.length > maxLength) {
            let splitAt = remaining.lastIndexOf(' ', maxLength);
            if (splitAt <= 0) {
                splitAt = maxLength;
            }
            const chunk = remaining.slice(0, splitAt).trim();
            if (chunk) {
                chunks.push(chunk);
            }
            remaining = remaining.slice(splitAt).trim();
        }
        if (remaining) {
            chunks.push(remaining);
        }
        return chunks;
    }

    buildLineItem (line) {
        // Handle empty lines explicitly
        if (!line || (typeof line === 'string' && line.trim() === '')) {
            return { format: DEFAULT_FORMAT, content: '' };
        }

        const normalizedLine = this.normalizeTagNames(line);
        const parsed = this.parseTaggedLine(normalizedLine);

        // Use centralized format resolver
        const format = resolveLineFormat(
            parsed?.format,
            { content: parsed?.content || normalizedLine }
        );
        const content = parsed?.content ?? normalizedLine;

        return this.ensureValidLineItem({ format, content }, normalizedLine);
    }

    normalizeTagNames (line) {
        if (!line || typeof line !== 'string') {
            return '';
        }
        let normalized = line.trim();
        normalized = normalized.replace(/<\s*\/\s*([A-Za-z-]+)[^>]*>/g, (_, tag) => `</${tag.toLowerCase()}>`);
        normalized = normalized.replace(/<\s*([A-Za-z-]+)\s*\/\s*>/g, (_, tag) => `<${tag.toLowerCase()} />`);
        normalized = normalized.replace(/<\s*([A-Za-z-]+)(?![^>]*\/>)[^>]*>/g, (_, tag) => `<${tag.toLowerCase()}>`);
        return normalized;
    }

    ensureValidLineItem (item, rawLine = '') {
        if (!item || typeof item !== 'object') {
            return null;
        }
        // Use centralized format resolver - SINGLE SOURCE OF TRUTH
        const format = resolveLineFormat(item.format, { content: item.content });
        const content = format === 'chapter-break' ? '' : (item.content ?? '');
        return { format, content };
    }

    /**
     * Handle script prepend operations from AI
     * Thin adapter - delegates to insertLines at index 0
     * @param {object} data - Prepend data
     * @param {string} data.content - Content to prepend
     * @returns {Promise<boolean>} - Success status
     */
    async handleScriptPrepend (data) {
        return this.handleScriptInsert({ ...data, position: 0 });
    }

    /**
     * Handle script insert operations from AI
     * @param {object} data - Insert data
     * @param {string} data.content - Content to insert
     * @param {number} data.position - Position to insert at (defaults to 0 for prepend)
     * @returns {Promise<boolean>} - Success status
     */
    async handleScriptInsert (data) {
        try {
            if (!data || !data.content) {
                throw new Error('Invalid insert data: content is required');
            }

            const position = data.position ?? 0;

            const editorContent = this.editorWidgetInstance?.getComponent('content');
            if (!editorContent) {
                throw new Error('Editor content component not available');
            }

            // Use same normalization as append - NO TAGGED STRINGS
            const normalizedLines = this.normalizeScriptLines(data.content);
            const lineItems = normalizedLines
                .map(line => this.buildLineItem(line))
                .filter(Boolean);

            if (lineItems.length === 0) {
                return { success: true, linesInserted: 0 };
            }

            // Build structured commands - NO string serialization
            const commands = lineItems.map((item, i) => ({
                command: 'ADD',
                lineNumber: position + i,
                data: { format: item.format, content: item.content }
            }));

            const result = await editorContent.applyCommands(commands, {
                source: position === 0 ? 'script_prepend' : 'script_insert'
            });

            if (result.success) {
                const eventType = position === 0
                    ? EventManager.EVENTS.SCRIPT.PREPENDED
                    : EventManager.EVENTS.SCRIPT.INSERTED;

                this.eventManager.publish(eventType, {
                    content: data.content,
                    lineCount: lineItems.length,
                    position,
                    element: null
                });

                return true;
            } else {
                throw new Error('Insert operation failed');
            }
        } catch (error) {
            console.error('[ScriptOrchestrator] Script insert failed:', error);
            this.handleError(error, 'handleScriptInsert');
            return false;
        }
    }

    /**
     * Handle errors in script operations
     * @param {Error} error - The error object
     * @param {string} context - The context where the error occurred
     */
    handleError (error, context) {
        const errorDetails = {
            context,
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        };

        console.error(`[ScriptOrchestrator] Error in ${context}:`, errorDetails);

        // Emit error event
        this.eventManager.publish(EventManager.EVENTS.SCRIPT.ERROR, errorDetails);
    }
}
