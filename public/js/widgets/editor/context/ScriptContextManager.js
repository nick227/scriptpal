/**
 * ScriptContextManager - Manages script context for AI interactions
 * Provides comprehensive script context including content, metadata, and analysis
 */

import { EventManager } from '../../../core/EventManager.js';
import { StateManager } from '../../../core/StateManager.js';

/**
 * ScriptContextManager class for managing script context
 */
export class ScriptContextManager {
    /**
     * Constructor
     * @param {object} options - Configuration options
     * @param {object} options.stateManager - State manager for current script tracking
     * @param {object} options.eventManager - Event manager for notifications
     * @param {object} options.contentManager - Content manager for script content access
     * @param {object} options.pageManager - Page manager for page information
     * @param {object} options.chapterManager - Chapter manager for chapter information
     */
    constructor (options) {
        if (!options.stateManager) {
            throw new Error('StateManager is required');
        }
        if (!options.eventManager) {
            throw new Error('EventManager is required');
        }

        this.stateManager = options.stateManager;
        this.eventManager = options.eventManager;
        this.contentManager = options.contentManager || null;
        this.pageManager = options.pageManager || null;
        this.chapterManager = options.chapterManager || null;
        this.currentScript = null;

        // Context cache
        this.contextCache = new Map();
        this.cacheTimeout = 5000; // 5 seconds
        this.lastContextUpdate = 0;

        // Event handlers
        this.eventHandlers = new Map();

        // Initialize
        this.initialize();
    }

    /**
     * Initialize the script context manager
     */
    async initialize () {

        // Set up event listeners
        this.setupEventListeners();

        // Load initial context if script is available
        await this.loadCurrentScriptContext();

    }

    /**
     * Set up event listeners for script changes
     */
    setupEventListeners () {
        // Listen for script changes
        this.stateManager.subscribe(StateManager.KEYS.CURRENT_SCRIPT, this.handleScriptChange.bind(this));

        // Listen for content changes
        this.eventManager.subscribe(EventManager.EVENTS.EDITOR.CONTENT_CHANGE, this.handleContentChange.bind(this));

        // Listen for page changes
        this.eventManager.subscribe(EventManager.EVENTS.EDITOR.PAGE_CHANGE, this.handlePageChange.bind(this));
    }

    /**
     * Handle changes to the current script
     * @param {object} script - The new current script
     */
    async handleScriptChange (script) {
        this.currentScript = script || null;

        // Clear cache when script changes
        this.contextCache.clear();
        this.lastContextUpdate = 0;

        // Load new context
        await this.loadCurrentScriptContext();

        // Emit context updated event
        this.eventManager.publish(EventManager.EVENTS.SCRIPT.CONTEXT_UPDATED, {
            scriptId: script?.id,
            context: await this.getScriptContext()
        });
    }

    /**
     * Handle content changes
     * @param {object} event - Content change event
     */
    handleContentChange (event) {
        // Invalidate cache on content changes
        this.contextCache.clear();
        this.lastContextUpdate = 0;

        // Emit context updated event
        this.eventManager.publish(EventManager.EVENTS.SCRIPT.CONTEXT_UPDATED, {
            scriptId: this.getCurrentScriptId(),
            context: this.getScriptContext()
        });
    }

    /**
     * Handle page changes
     * @param {object} event - Page change event
     */
    handlePageChange (event) {
        // Invalidate cache on page changes
        this.contextCache.delete('pageInfo');
    }

    /**
     * Handle chapter changes
     * @param {object} event - Chapter change event
     */
    handleChapterChange (event) {
        // Invalidate cache on chapter changes
        this.contextCache.delete('chapterInfo');
    }

    /**
     * Load context for the current script
     */
    async loadCurrentScriptContext () {
        const scriptId = this.getCurrentScriptId();
        if (!scriptId) {
            return;
        }

        try {
            // Load script context
            return await this.getScriptContext();
        } catch (error) {
            console.error('[ScriptContextManager] Failed to load script context:', error);
            throw error;
        }
    }

    /**
     * Get comprehensive script context
     * @param {object} options - Context options
     * @param {boolean} options.includeContent - Whether to include full content
     * @param {boolean} options.includeAnalysis - Whether to include analysis
     * @param {boolean} options.includeMetadata - Whether to include metadata
     * @returns {Promise<object>} - Script context
     */
    async getScriptContext (options = {}) {
        const {
            includeContent = true,
            includeAnalysis = true,
            includeMetadata = true
        } = options;

        const scriptId = this.getCurrentScriptId();
        if (!scriptId) {
            return this.getEmptyContext();
        }

        // Check cache first
        const cacheKey = this.getCacheKey(options);
        const cached = this.contextCache.get(cacheKey);
        if (cached && this.isCacheValid()) {
            return cached;
        }

        try {
            const context = {
                scriptId,
                timestamp: new Date().toISOString(),
                ...(includeMetadata && await this.getScriptMetadata()),
                ...(includeContent && await this.getScriptContent()),
                ...(includeAnalysis && await this.getScriptAnalysis())
            };

            const normalizedContext = {
                ...context,
                scriptContent: context.content || '',
                scriptTitle: context.title || 'Untitled Script'
            };

            // Cache the context
            this.contextCache.set(cacheKey, normalizedContext);
            this.lastContextUpdate = Date.now();

            return normalizedContext;
        } catch (error) {
            console.error('[ScriptContextManager] Failed to get script context:', error);
            throw error;
        }
    }

    /**
     * Get script metadata
     * @returns {Promise<object>} - Script metadata
     */
    async getScriptMetadata () {
        const script = this.currentScript || this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
        if (!script) {
            return {};
        }

        return {
            id: script.id,
            scriptId: script.id,
            title: script.title || 'Untitled Script',
            scriptTitle: script.title || 'Untitled Script',
            status: script.status || 'active',
            version: script.versionNumber || 1,
            createdAt: script.createdAt,
            updatedAt: script.updatedAt,
            userId: script.userId
        };
    }

    /**
     * Get script content information
     * @returns {Promise<object>} - Script content info
     */
    async getScriptContent () {
        if (!this.contentManager) {
            return { content: '', contentLength: 0 };
        }

        try {
            const content = this.contentManager.getPlainText
                ? await this.contentManager.getPlainText()
                : await this.contentManager.getContent();
            const contentLength = content ? content.length : 0;

            return {
                content: content || '',
                contentLength,
                hasContent: contentLength > 0
            };
        } catch (error) {
            console.error('[ScriptContextManager] Failed to get script content:', error);
            return { content: '', contentLength: 0, hasContent: false };
        }
    }

    /**
     * Get script analysis information
     * @returns {Promise<object>} - Script analysis
     */
    async getScriptAnalysis () {
        try {
            return {
                pageInfo: await this.getPageInfo(),
                chapterInfo: await this.getChapterInfo(),
                contentStats: await this.getContentStats()
            };
        } catch (error) {
            console.error('[ScriptContextManager] Failed to get script analysis:', error);
            return {};
        }
    }

    /**
     * Get page information
     * @returns {Promise<object>} - Page information
     */
    async getPageInfo () {
        if (!this.pageManager) {
            return { pageCount: 0, currentPage: 0 };
        }

        try {
            const pageCount = this.pageManager.getPageCount();
            const currentPage = this.pageManager.getCurrentPage();

            return {
                pageCount,
                currentPage,
                hasPages: pageCount > 0
            };
        } catch (error) {
            console.error('[ScriptContextManager] Failed to get page info:', error);
            return { pageCount: 0, currentPage: 0, hasPages: false };
        }
    }

    /**
     * Get chapter information
     * @returns {Promise<object>} - Chapter information
     */
    async getChapterInfo () {
        if (!this.chapterManager) {
            return { chapterCount: 0, chapters: [] };
        }

        try {
            const chapterCount = this.chapterManager.getChapterCount();
            const chapters = this.chapterManager.getChapters();

            return {
                chapterCount,
                chapters: chapters || [],
                hasChapters: chapterCount > 0
            };
        } catch (error) {
            console.error('[ScriptContextManager] Failed to get chapter info:', error);
            return { chapterCount: 0, chapters: [], hasChapters: false };
        }
    }

    /**
     * Get content statistics
     * @returns {Promise<object>} - Content statistics
     */
    async getContentStats () {
        if (!this.contentManager) {
            return {};
        }

        try {
            const content = this.contentManager.getPlainText
                ? await this.contentManager.getPlainText()
                : await this.contentManager.getContent();
            if (!content) {
                return {};
            }

            // Basic content analysis
            const lines = content.split('\n').filter(line => line.trim().length > 0);
            const words = content.split(/\s+/).filter(word => word.length > 0);
            const characters = content.length;
            const charactersNoSpaces = content.replace(/\s/g, '').length;

            return {
                lines: lines.length,
                words: words.length,
                characters,
                charactersNoSpaces,
                averageWordsPerLine: lines.length > 0 ? Math.round(words.length / lines.length) : 0,
                averageCharactersPerWord: words.length > 0 ? Math.round(characters / words.length) : 0
            };
        } catch (error) {
            console.error('[ScriptContextManager] Failed to get content stats:', error);
            return {};
        }
    }

    /**
     * Get context for AI chat requests
     * @param {object} options - Context options
     * @returns {Promise<object>} - AI chat context
     */
    async getAIChatContext (options = {}) {
        const context = await this.getScriptContext({
            includeContent: true,
            includeAnalysis: true,
            includeMetadata: true
        });

        // Add AI-specific context
        return {
            ...context,
            ai: {
                timestamp: new Date().toISOString(),
                contextVersion: '1.0',
                ...options
            }
        };
    }

    /**
     * Get context for script operations
     * @param {string} operation - The operation type
     * @returns {Promise<object>} - Operation context
     */
    async getOperationContext (operation) {
        const context = await this.getScriptContext({
            includeContent: true,
            includeAnalysis: true,
            includeMetadata: true
        });

        return {
            ...context,
            operation,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get current script ID
     * @returns {string|null} - Current script ID
     */
    getCurrentScriptId () {
        const script = this.currentScript || this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
        return script ? script.id : null;
    }

    /**
     * Get empty context for when no script is available
     * @returns {object} - Empty context
     */
    getEmptyContext () {
        return {
            scriptId: null,
            timestamp: new Date().toISOString(),
            title: 'No Script',
            scriptTitle: 'No Script',
            status: 'none',
            version: 0,
            content: '',
            scriptContent: '',
            contentLength: 0,
            hasContent: false,
            pageInfo: { pageCount: 0, currentPage: 0, hasPages: false },
            chapterInfo: { chapterCount: 0, chapters: [], hasChapters: false },
            contentStats: {}
        };
    }

    /**
     * Get cache key for options
     * @param {object} options - Context options
     * @returns {string} - Cache key
     */
    getCacheKey (options) {
        return JSON.stringify(options);
    }

    /**
     * Check if cache is still valid
     * @returns {boolean} - Whether cache is valid
     */
    isCacheValid () {
        return Date.now() - this.lastContextUpdate < this.cacheTimeout;
    }

    /**
     * Clear context cache
     */
    clearCache () {
        this.contextCache.clear();
        this.lastContextUpdate = 0;
    }

    invalidateCache () {
        this.clearCache();
    }

    /**
     * Set content manager
     * @param {object} contentManager - Content manager instance
     */
    setContentManager (contentManager) {
        this.contentManager = contentManager;
    }

    /**
     * Set page manager
     * @param {object} pageManager - Page manager instance
     */
    setPageManager (pageManager) {
        this.pageManager = pageManager;
    }

    /**
     * Set chapter manager
     * @param {object} chapterManager - Chapter manager instance
     */
    setChapterManager (chapterManager) {
        this.chapterManager = chapterManager;
    }

    /**
     * Destroy the context manager
     */
    destroy () {
        // Clear cache
        this.contextCache.clear();

        // Remove event listeners
        this.eventHandlers.clear();

        // Clear references
        this.stateManager = null;
        this.eventManager = null;
        this.contentManager = null;
        this.pageManager = null;
        this.chapterManager = null;

    }
}
