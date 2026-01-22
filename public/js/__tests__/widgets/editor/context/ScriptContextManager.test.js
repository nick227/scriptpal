/**
 * Tests for ScriptContextManager - Script Context Management
 */

import { ScriptContextManager } from '../../../../widgets/editor/context/ScriptContextManager.js';

describe('ScriptContextManager - Script Context Management', () => {
    let scriptContextManager;
    let mockStateManager;
    let mockEventManager;
    let mockContentManager;
    let mockPageManager;
    let mockChapterManager;

    beforeEach(() => {
        // Create mock state manager
        mockStateManager = {
            getState: jest.fn().mockReturnValue({
                id: 'script-1',
                title: 'Test Script',
                status: 'active',
                version_number: 1,
                created_at: '2023-01-01T00:00:00Z',
                updated_at: '2023-01-02T00:00:00Z',
                user_id: 'user-1'
            }),
            subscribe: jest.fn()
        };

        // Create mock event manager
        mockEventManager = {
            subscribe: jest.fn(),
            publish: jest.fn()
        };

        // Create mock content manager
        mockContentManager = {
            getContent: jest.fn().mockResolvedValue('<script><action>Test content</action></script>')
        };

        // Create mock page manager
        mockPageManager = {
            getPageCount: jest.fn().mockReturnValue(5),
            getCurrentPage: jest.fn().mockReturnValue(2)
        };

        // Create mock chapter manager
        mockChapterManager = {
            getChapterCount: jest.fn().mockReturnValue(3),
            getChapters: jest.fn().mockReturnValue([
                { id: 'chapter-1', title: 'Chapter 1', number: 1 },
                { id: 'chapter-2', title: 'Chapter 2', number: 2 },
                { id: 'chapter-3', title: 'Chapter 3', number: 3 }
            ])
        };

        // Create script context manager
        scriptContextManager = new ScriptContextManager({
            stateManager: mockStateManager,
            eventManager: mockEventManager,
            contentManager: mockContentManager,
            pageManager: mockPageManager,
            chapterManager: mockChapterManager
        });
    });

    afterEach(() => {
        scriptContextManager.destroy();
    });

    describe('Initialization', () => {
        test('should initialize with required dependencies', () => {
            expect(scriptContextManager.stateManager).toBe(mockStateManager);
            expect(scriptContextManager.eventManager).toBe(mockEventManager);
            expect(scriptContextManager.contentManager).toBe(mockContentManager);
            expect(scriptContextManager.pageManager).toBe(mockPageManager);
            expect(scriptContextManager.chapterManager).toBe(mockChapterManager);
        });

        test('should require state manager', () => {
            expect(() => {
                new ScriptContextManager({
                    eventManager: mockEventManager
                });
            }).toThrow('StateManager is required');
        });

        test('should require event manager', () => {
            expect(() => {
                new ScriptContextManager({
                    stateManager: mockStateManager
                });
            }).toThrow('EventManager is required');
        });

        test('should set up event listeners', () => {
            expect(mockStateManager.subscribe).toHaveBeenCalled();
            expect(mockEventManager.subscribe).toHaveBeenCalled();
        });
    });

    describe('Script Context Retrieval', () => {
        test('should get comprehensive script context', async () => {
            const context = await scriptContextManager.getScriptContext();

            expect(context).toHaveProperty('scriptId', 'script-1');
            expect(context).toHaveProperty('timestamp');
            expect(context).toHaveProperty('title', 'Test Script');
            expect(context).toHaveProperty('status', 'active');
            expect(context).toHaveProperty('version', 1);
            expect(context).toHaveProperty('content');
            expect(context).toHaveProperty('contentLength');
            expect(context).toHaveProperty('hasContent', true);
            expect(context).toHaveProperty('pageInfo');
            expect(context).toHaveProperty('chapterInfo');
            expect(context).toHaveProperty('contentStats');
        });

        test('should get script metadata', async () => {
            const metadata = await scriptContextManager.getScriptMetadata();

            expect(metadata).toEqual({
                title: 'Test Script',
                status: 'active',
                version: 1,
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-02T00:00:00Z',
                userId: 'user-1'
            });
        });

        test('should get script content', async () => {
            const content = await scriptContextManager.getScriptContent();

            expect(content).toHaveProperty('content');
            expect(content).toHaveProperty('contentLength');
            expect(content).toHaveProperty('hasContent', true);
            expect(mockContentManager.getContent).toHaveBeenCalled();
        });

        test('should get script analysis', async () => {
            const analysis = await scriptContextManager.getScriptAnalysis();

            expect(analysis).toHaveProperty('pageInfo');
            expect(analysis).toHaveProperty('chapterInfo');
            expect(analysis).toHaveProperty('contentStats');
        });

        test('should get page information', async () => {
            const pageInfo = await scriptContextManager.getPageInfo();

            expect(pageInfo).toEqual({
                pageCount: 5,
                currentPage: 2,
                hasPages: true
            });
            expect(mockPageManager.getPageCount).toHaveBeenCalled();
            expect(mockPageManager.getCurrentPage).toHaveBeenCalled();
        });

        test('should get chapter information', async () => {
            const chapterInfo = await scriptContextManager.getChapterInfo();

            expect(chapterInfo).toEqual({
                chapterCount: 3,
                chapters: [
                    { id: 'chapter-1', title: 'Chapter 1', number: 1 },
                    { id: 'chapter-2', title: 'Chapter 2', number: 2 },
                    { id: 'chapter-3', title: 'Chapter 3', number: 3 }
                ],
                hasChapters: true
            });
            expect(mockChapterManager.getChapterCount).toHaveBeenCalled();
            expect(mockChapterManager.getChapters).toHaveBeenCalled();
        });

        test('should get content statistics', async () => {
            const stats = await scriptContextManager.getContentStats();

            expect(stats).toHaveProperty('lines');
            expect(stats).toHaveProperty('words');
            expect(stats).toHaveProperty('characters');
            expect(stats).toHaveProperty('charactersNoSpaces');
            expect(stats).toHaveProperty('averageWordsPerLine');
            expect(stats).toHaveProperty('averageCharactersPerWord');
        });
    });

    describe('AI Chat Context', () => {
        test('should get AI chat context', async () => {
            const aiContext = await scriptContextManager.getAIChatContext();

            expect(aiContext).toHaveProperty('scriptId', 'script-1');
            expect(aiContext).toHaveProperty('ai');
            expect(aiContext.ai).toHaveProperty('timestamp');
            expect(aiContext.ai).toHaveProperty('contextVersion', '1.0');
        });

        test('should get AI chat context with options', async () => {
            const options = { includeHistory: true, maxTokens: 1000 };
            const aiContext = await scriptContextManager.getAIChatContext(options);

            expect(aiContext.ai).toHaveProperty('includeHistory', true);
            expect(aiContext.ai).toHaveProperty('maxTokens', 1000);
        });
    });

    describe('Operation Context', () => {
        test('should get operation context', async () => {
            const operationContext = await scriptContextManager.getOperationContext('analyze');

            expect(operationContext).toHaveProperty('scriptId', 'script-1');
            expect(operationContext).toHaveProperty('operation', 'analyze');
            expect(operationContext).toHaveProperty('timestamp');
        });
    });

    describe('Context Options', () => {
        test('should respect includeContent option', async () => {
            const context = await scriptContextManager.getScriptContext({ includeContent: false });

            expect(context).not.toHaveProperty('content');
            expect(context).not.toHaveProperty('contentLength');
            expect(context).not.toHaveProperty('hasContent');
        });

        test('should respect includeAnalysis option', async () => {
            const context = await scriptContextManager.getScriptContext({ includeAnalysis: false });

            expect(context).not.toHaveProperty('pageInfo');
            expect(context).not.toHaveProperty('chapterInfo');
            expect(context).not.toHaveProperty('contentStats');
        });

        test('should respect includeMetadata option', async () => {
            const context = await scriptContextManager.getScriptContext({ includeMetadata: false });

            expect(context).not.toHaveProperty('title');
            expect(context).not.toHaveProperty('status');
            expect(context).not.toHaveProperty('version');
        });
    });

    describe('Empty Context', () => {
        test('should return empty context when no script is available', async () => {
            mockStateManager.getState.mockReturnValue(null);

            const context = await scriptContextManager.getScriptContext();

            expect(context).toHaveProperty('scriptId', null);
            expect(context).toHaveProperty('title', 'No Script');
            expect(context).toHaveProperty('status', 'none');
            expect(context).toHaveProperty('version', 0);
            expect(context).toHaveProperty('content', '');
            expect(context).toHaveProperty('hasContent', false);
        });

        test('should get empty context', () => {
            const emptyContext = scriptContextManager.getEmptyContext();

            expect(emptyContext).toHaveProperty('scriptId', null);
            expect(emptyContext).toHaveProperty('title', 'No Script');
            expect(emptyContext).toHaveProperty('status', 'none');
            expect(emptyContext).toHaveProperty('version', 0);
        });
    });

    describe('Current Script ID', () => {
        test('should get current script ID', () => {
            const scriptId = scriptContextManager.getCurrentScriptId();

            expect(scriptId).toBe('script-1');
        });

        test('should return null when no script is available', () => {
            mockStateManager.getState.mockReturnValue(null);

            const scriptId = scriptContextManager.getCurrentScriptId();

            expect(scriptId).toBeNull();
        });
    });

    describe('Context Caching', () => {
        test('should cache context results', async () => {
            const context1 = await scriptContextManager.getScriptContext();
            const context2 = await scriptContextManager.getScriptContext();

            expect(context1).toBe(context2); // Same object reference
        });

        test('should clear cache', () => {
            scriptContextManager.clearCache();

            expect(scriptContextManager.contextCache.size).toBe(0);
            expect(scriptContextManager.lastContextUpdate).toBe(0);
        });

        test('should invalidate cache on content changes', async () => {
            // Get initial context
            await scriptContextManager.getScriptContext();

            // Simulate content change
            scriptContextManager.handleContentChange({});

            // Cache should be cleared
            expect(scriptContextManager.contextCache.size).toBe(0);
        });
    });

    describe('Manager Integration', () => {
        test('should set content manager', () => {
            const newContentManager = { getContent: jest.fn() };
            scriptContextManager.setContentManager(newContentManager);

            expect(scriptContextManager.contentManager).toBe(newContentManager);
        });

        test('should set page manager', () => {
            const newPageManager = { getPageCount: jest.fn() };
            scriptContextManager.setPageManager(newPageManager);

            expect(scriptContextManager.pageManager).toBe(newPageManager);
        });

        test('should set chapter manager', () => {
            const newChapterManager = { getChapterCount: jest.fn() };
            scriptContextManager.setChapterManager(newChapterManager);

            expect(scriptContextManager.chapterManager).toBe(newChapterManager);
        });
    });

    describe('Error Handling', () => {
        test('should handle content manager errors', async () => {
            mockContentManager.getContent.mockRejectedValue(new Error('Content error'));

            const content = await scriptContextManager.getScriptContent();

            expect(content).toEqual({
                content: '',
                contentLength: 0,
                hasContent: false
            });
        });

        test('should handle page manager errors', async () => {
            mockPageManager.getPageCount.mockImplementation(() => {
                throw new Error('Page error');
            });

            const pageInfo = await scriptContextManager.getPageInfo();

            expect(pageInfo).toEqual({
                pageCount: 0,
                currentPage: 0,
                hasPages: false
            });
        });

        test('should handle chapter manager errors', async () => {
            mockChapterManager.getChapterCount.mockImplementation(() => {
                throw new Error('Chapter error');
            });

            const chapterInfo = await scriptContextManager.getChapterInfo();

            expect(chapterInfo).toEqual({
                chapterCount: 0,
                chapters: [],
                hasChapters: false
            });
        });

        test('should handle missing managers', async () => {
            scriptContextManager.setContentManager(null);
            scriptContextManager.setPageManager(null);
            scriptContextManager.setChapterManager(null);

            const context = await scriptContextManager.getScriptContext();

            expect(context).toHaveProperty('content', '');
            expect(context).toHaveProperty('pageInfo', { pageCount: 0, currentPage: 0, hasPages: false });
            expect(context).toHaveProperty('chapterInfo', { chapterCount: 0, chapters: [], hasChapters: false });
        });
    });

    describe('Event Handling', () => {
        test('should handle script changes', async () => {
            const newScript = { id: 'script-2', title: 'New Script' };
            mockStateManager.getState.mockReturnValue(newScript);

            await scriptContextManager.handleScriptChange(newScript);

            expect(scriptContextManager.contextCache.size).toBe(0);
            expect(scriptContextManager.lastContextUpdate).toBe(0);
        });

        test('should handle content changes', () => {
            scriptContextManager.handleContentChange({});

            expect(scriptContextManager.contextCache.size).toBe(0);
            expect(scriptContextManager.lastContextUpdate).toBe(0);
        });

        test('should handle page changes', () => {
            scriptContextManager.handlePageChange({});

            expect(scriptContextManager.contextCache.has('pageInfo')).toBe(false);
        });

        test('should handle chapter changes', () => {
            scriptContextManager.handleChapterChange({});

            expect(scriptContextManager.contextCache.has('chapterInfo')).toBe(false);
        });
    });

    describe('Cleanup', () => {
        test('should destroy properly', () => {
            scriptContextManager.destroy();

            expect(scriptContextManager.stateManager).toBeNull();
            expect(scriptContextManager.eventManager).toBeNull();
            expect(scriptContextManager.contentManager).toBeNull();
            expect(scriptContextManager.pageManager).toBeNull();
            expect(scriptContextManager.chapterManager).toBeNull();
            expect(scriptContextManager.contextCache.size).toBe(0);
            expect(scriptContextManager.eventHandlers.size).toBe(0);
        });
    });
});
