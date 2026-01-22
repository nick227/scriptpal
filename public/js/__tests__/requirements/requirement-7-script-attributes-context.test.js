/**
 * Tests for Requirement #7: System retains script attributes and includes it as AI context on a script by script basis
 */

import { ScriptContextManager } from '../../widgets/editor/context/ScriptContextManager.js';

describe('Requirement #7: Script Attributes as AI Context', () => {
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
                id: 1,
                title: 'Test Script',
                content: 'Test script content',
                author: 'Test Author',
                status: 'draft',
                created_at: '2023-01-01T00:00:00Z',
                updated_at: '2023-01-02T00:00:00Z'
            }),
            setState: jest.fn(),
            subscribe: jest.fn()
        };

        // Create mock event manager
        mockEventManager = {
            publish: jest.fn(),
            subscribe: jest.fn()
        };

        // Create mock content manager
        mockContentManager = {
            getContent: jest.fn().mockReturnValue('Test script content'),
            getLineCount: jest.fn().mockReturnValue(10),
            getWordCount: jest.fn().mockReturnValue(50),
            getCharacterCount: jest.fn().mockReturnValue(200)
        };

        // Create mock page manager
        mockPageManager = {
            getPageCount: jest.fn().mockReturnValue(3),
            getCurrentPage: jest.fn().mockReturnValue(1),
            getTotalLines: jest.fn().mockReturnValue(10)
        };

        // Create mock chapter manager
        mockChapterManager = {
            getChapterCount: jest.fn().mockReturnValue(2),
            getChapters: jest.fn().mockReturnValue([
                { id: 1, title: 'Chapter 1', lineNumber: 1 },
                { id: 2, title: 'Chapter 2', lineNumber: 5 }
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

    describe('Script Metadata Context', () => {
        test('should retain and provide script attributes as AI context', () => {
            const scriptMetadata = scriptContextManager.getScriptMetadata();

            expect(scriptMetadata).toEqual({
                id: 1,
                title: 'Test Script',
                author: 'Test Author',
                status: 'draft',
                created_at: '2023-01-01T00:00:00Z',
                updated_at: '2023-01-02T00:00:00Z'
            });
        });

        test('should include script title in AI context', () => {
            const scriptMetadata = scriptContextManager.getScriptMetadata();

            expect(scriptMetadata.title).toBe('Test Script');
        });

        test('should include script author in AI context', () => {
            const scriptMetadata = scriptContextManager.getScriptMetadata();

            expect(scriptMetadata.author).toBe('Test Author');
        });

        test('should include script status in AI context', () => {
            const scriptMetadata = scriptContextManager.getScriptMetadata();

            expect(scriptMetadata.status).toBe('draft');
        });

        test('should include creation and update timestamps in AI context', () => {
            const scriptMetadata = scriptContextManager.getScriptMetadata();

            expect(scriptMetadata.created_at).toBe('2023-01-01T00:00:00Z');
            expect(scriptMetadata.updated_at).toBe('2023-01-02T00:00:00Z');
        });
    });

    describe('Content Information Context', () => {
        test('should include content statistics in AI context', () => {
            const contentInfo = scriptContextManager.getContentInfo();

            expect(contentInfo).toEqual({
                content: 'Test script content',
                lineCount: 10,
                wordCount: 50,
                characterCount: 200
            });
        });

        test('should provide line count for AI context', () => {
            const contentInfo = scriptContextManager.getContentInfo();

            expect(contentInfo.lineCount).toBe(10);
        });

        test('should provide word count for AI context', () => {
            const contentInfo = scriptContextManager.getContentInfo();

            expect(contentInfo.wordCount).toBe(50);
        });

        test('should provide character count for AI context', () => {
            const contentInfo = scriptContextManager.getContentInfo();

            expect(contentInfo.characterCount).toBe(200);
        });
    });

    describe('Page Information Context', () => {
        test('should include page information in AI context', () => {
            const pageInfo = scriptContextManager.getPageInfo();

            expect(pageInfo).toEqual({
                pageCount: 3,
                currentPage: 1,
                totalLines: 10
            });
        });

        test('should provide page count for AI context', () => {
            const pageInfo = scriptContextManager.getPageInfo();

            expect(pageInfo.pageCount).toBe(3);
        });

        test('should provide current page for AI context', () => {
            const pageInfo = scriptContextManager.getPageInfo();

            expect(pageInfo.currentPage).toBe(1);
        });
    });

    describe('Chapter Information Context', () => {
        test('should include chapter information in AI context', () => {
            const chapterInfo = scriptContextManager.getChapterInfo();

            expect(chapterInfo).toEqual({
                chapterCount: 2,
                chapters: [
                    { id: 1, title: 'Chapter 1', lineNumber: 1 },
                    { id: 2, title: 'Chapter 2', lineNumber: 5 }
                ]
            });
        });

        test('should provide chapter count for AI context', () => {
            const chapterInfo = scriptContextManager.getChapterInfo();

            expect(chapterInfo.chapterCount).toBe(2);
        });

        test('should provide chapter details for AI context', () => {
            const chapterInfo = scriptContextManager.getChapterInfo();

            expect(chapterInfo.chapters).toHaveLength(2);
            expect(chapterInfo.chapters[0]).toEqual({
                id: 1,
                title: 'Chapter 1',
                lineNumber: 1
            });
        });
    });

    describe('Comprehensive AI Context', () => {
        test('should provide complete script context for AI', async () => {
            const context = await scriptContextManager.getScriptContext();

            expect(context).toEqual({
                script: {
                    id: 1,
                    title: 'Test Script',
                    author: 'Test Author',
                    status: 'draft',
                    created_at: '2023-01-01T00:00:00Z',
                    updated_at: '2023-01-02T00:00:00Z'
                },
                content: {
                    content: 'Test script content',
                    lineCount: 10,
                    wordCount: 50,
                    characterCount: 200
                },
                pages: {
                    pageCount: 3,
                    currentPage: 1,
                    totalLines: 10
                },
                chapters: {
                    chapterCount: 2,
                    chapters: [
                        { id: 1, title: 'Chapter 1', lineNumber: 1 },
                        { id: 2, title: 'Chapter 2', lineNumber: 5 }
                    ]
                },
                stats: {
                    lineCount: 10,
                    wordCount: 50,
                    characterCount: 200,
                    pageCount: 3,
                    chapterCount: 2
                }
            });
        });

        test('should provide AI chat context with script attributes', async () => {
            const chatContext = await scriptContextManager.getAIChatContext();

            expect(chatContext).toHaveProperty('script');
            expect(chatContext).toHaveProperty('content');
            expect(chatContext).toHaveProperty('pages');
            expect(chatContext).toHaveProperty('chapters');
            expect(chatContext).toHaveProperty('stats');
        });

        test('should provide AI script operation context', async () => {
            const operationContext = await scriptContextManager.getAIScriptOperationContext();

            expect(operationContext).toHaveProperty('script');
            expect(operationContext).toHaveProperty('content');
            expect(operationContext).toHaveProperty('pages');
            expect(operationContext).toHaveProperty('chapters');
        });
    });

    describe('Script-by-Script Context Management', () => {
        test('should handle script changes and update context', () => {
            const newScript = {
                id: 2,
                title: 'New Script',
                author: 'New Author',
                status: 'active',
                content: 'New script content'
            };

            scriptContextManager.handleScriptChange(newScript);

            const scriptMetadata = scriptContextManager.getScriptMetadata();
            expect(scriptMetadata.id).toBe(2);
            expect(scriptMetadata.title).toBe('New Script');
            expect(scriptMetadata.author).toBe('New Author');
        });

        test('should invalidate cache when script changes', () => {
            // Set up initial context
            scriptContextManager.getScriptMetadata();

            // Change script
            const newScript = {
                id: 2,
                title: 'New Script',
                content: 'New content'
            };

            scriptContextManager.handleScriptChange(newScript);
            scriptContextManager.invalidateCache();

            // Context should be updated
            const scriptMetadata = scriptContextManager.getScriptMetadata();
            expect(scriptMetadata.id).toBe(2);
        });

        test('should maintain separate context for different scripts', () => {
            // First script
            const script1 = {
                id: 1,
                title: 'Script 1',
                author: 'Author 1',
                content: 'Content 1'
            };

            scriptContextManager.handleScriptChange(script1);
            const context1 = scriptContextManager.getScriptMetadata();

            // Second script
            const script2 = {
                id: 2,
                title: 'Script 2',
                author: 'Author 2',
                content: 'Content 2'
            };

            scriptContextManager.handleScriptChange(script2);
            const context2 = scriptContextManager.getScriptMetadata();

            expect(context1.id).toBe(1);
            expect(context2.id).toBe(2);
            expect(context1.title).toBe('Script 1');
            expect(context2.title).toBe('Script 2');
        });
    });

    describe('Context Caching and Performance', () => {
        test('should cache context information for performance', () => {
            // First call should populate cache
            const context1 = scriptContextManager.getScriptMetadata();

            // Second call should use cache
            const context2 = scriptContextManager.getScriptMetadata();

            expect(context1).toEqual(context2);
            expect(mockStateManager.getState).toHaveBeenCalledTimes(1);
        });

        test('should invalidate cache when needed', () => {
            // Get initial context
            scriptContextManager.getScriptMetadata();

            // Invalidate cache
            scriptContextManager.invalidateCache();

            // Next call should fetch fresh data
            scriptContextManager.getScriptMetadata();

            expect(mockStateManager.getState).toHaveBeenCalledTimes(2);
        });
    });

    describe('Error Handling', () => {
        test('should handle missing script data gracefully', () => {
            mockStateManager.getState.mockReturnValue(null);

            const scriptMetadata = scriptContextManager.getScriptMetadata();

            expect(scriptMetadata).toBeNull();
        });

        test('should handle missing content manager gracefully', () => {
            scriptContextManager.contentManager = null;

            const contentInfo = scriptContextManager.getContentInfo();

            expect(contentInfo).toEqual({
                content: null,
                lineCount: 0,
                wordCount: 0,
                characterCount: 0
            });
        });

        test('should handle missing page manager gracefully', () => {
            scriptContextManager.pageManager = null;

            const pageInfo = scriptContextManager.getPageInfo();

            expect(pageInfo).toEqual({
                pageCount: 0,
                currentPage: 0,
                totalLines: 0
            });
        });

        test('should handle missing chapter manager gracefully', () => {
            scriptContextManager.chapterManager = null;

            const chapterInfo = scriptContextManager.getChapterInfo();

            expect(chapterInfo).toEqual({
                chapterCount: 0,
                chapters: []
            });
        });
    });
});
