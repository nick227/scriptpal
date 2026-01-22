/**
 * Tests for ChapterManager functionality
 */

import { ChapterManager } from '../../../widgets/editor/chapters/ChapterManager.js';

describe('ChapterManager - Chapter Breaks', () => {
    let chapterManager;
    let mockStateManager;
    let mockContent;

    beforeEach(() => {
        // Create mock state manager
        mockStateManager = {
            getCurrentPage: jest.fn().mockReturnValue(1)
        };

        // Create mock content manager
        mockContent = {
            getCurrentLine: jest.fn().mockReturnValue(null)
        };

        // Create chapter manager
        chapterManager = new ChapterManager(mockStateManager);
    });

    afterEach(() => {
        chapterManager.destroy();
    });

    describe('Initialization', () => {
        test('should initialize with empty chapters', () => {
            expect(chapterManager.getChapterCount()).toBe(0);
            expect(chapterManager.getAllChapters()).toEqual([]);
        });

        test('should require state manager', () => {
            expect(() => {
                new ChapterManager(null);
            }).toThrow('StateManager is required');
        });
    });

    describe('Chapter creation', () => {
        test('should create chapter with auto-increment number', () => {
            const chapterId = chapterManager.addChapter('Test Chapter', 1);

            expect(chapterId).toBeDefined();
            expect(chapterManager.getChapterCount()).toBe(1);

            const chapter = chapterManager.getChapter(chapterId);
            expect(chapter.title).toBe('Test Chapter');
            expect(chapter.chapterNumber).toBe(1);
            expect(chapter.pageNumber).toBe(1);
        });

        test('should auto-increment chapter numbers', () => {
            const chapterId1 = chapterManager.addChapter('Chapter 1', 1);
            const chapterId2 = chapterManager.addChapter('Chapter 2', 5);

            const chapter1 = chapterManager.getChapter(chapterId1);
            const chapter2 = chapterManager.getChapter(chapterId2);

            expect(chapter1.chapterNumber).toBe(1);
            expect(chapter2.chapterNumber).toBe(2);
        });

        test('should create chapter with default title if none provided', () => {
            const chapterId = chapterManager.addChapter(null, 1);

            const chapter = chapterManager.getChapter(chapterId);
            expect(chapter.title).toBe('Chapter 1');
        });

        test('should emit chapter added event', () => {
            const chapterAddedHandler = jest.fn();
            chapterManager.on('chapterAdded', chapterAddedHandler);

            const chapterId = chapterManager.addChapter('Test Chapter', 1);

            expect(chapterAddedHandler).toHaveBeenCalledWith({
                id: chapterId,
                title: 'Test Chapter',
                pageNumber: 1,
                chapterNumber: 1,
                timestamp: expect.any(Number)
            });
        });
    });

    describe('Chapter break element creation', () => {
        test('should create chapter break element with correct structure', () => {
            const chapterBreak = chapterManager.createChapterBreakElement('Test Chapter');

            expect(chapterBreak).toBeTruthy();
            expect(chapterBreak.classList.contains('script-line')).toBe(true);
            expect(chapterBreak.classList.contains('chapter-break')).toBe(true);
            expect(chapterBreak.getAttribute('data-format')).toBe('chapter-break');
            expect(chapterBreak.getAttribute('data-chapter-number')).toBe('1');
        });

        test('should create chapter break with default title', () => {
            const chapterBreak = chapterManager.createChapterBreakElement();

            expect(chapterBreak.textContent).toContain('Chapter 1');
        });

        test('should create chapter break with custom title', () => {
            const chapterBreak = chapterManager.createChapterBreakElement('Custom Title');

            expect(chapterBreak.textContent).toContain('Custom Title');
        });

        test('should increment chapter numbers correctly', () => {
            // Add a chapter first
            chapterManager.addChapter('Chapter 1', 1);

            // Create chapter break element
            const chapterBreak = chapterManager.createChapterBreakElement('Chapter 2');

            expect(chapterBreak.getAttribute('data-chapter-number')).toBe('2');
            expect(chapterBreak.textContent).toContain('Chapter 2');
        });
    });

    describe('Chapter break insertion', () => {
        beforeEach(() => {
            chapterManager.setContent(mockContent);
        });

        test('should insert chapter break successfully', () => {
            // Mock current line
            const mockCurrentLine = document.createElement('div');
            mockCurrentLine.className = 'script-line';
            mockContent.getCurrentLine.mockReturnValue(mockCurrentLine);

            // Mock parent node
            const mockParent = document.createElement('div');
            mockParent.appendChild(mockCurrentLine);
            // parentNode is read-only, so we'll mock the insertBefore method instead
            mockParent.insertBefore = jest.fn();

            const success = chapterManager.insertChapterBreak('Test Chapter');

            expect(success).toBe(true);
            expect(chapterManager.getChapterCount()).toBe(1);
        });

        test('should handle missing content manager', () => {
            chapterManager.setContent(null);

            const success = chapterManager.insertChapterBreak('Test Chapter');

            expect(success).toBe(false);
        });

        test('should handle missing current line', () => {
            mockContent.getCurrentLine.mockReturnValue(null);

            const success = chapterManager.insertChapterBreak('Test Chapter');

            expect(success).toBe(false);
        });

        test('should insert chapter break after current line', () => {
            // Create mock DOM structure
            const mockParent = document.createElement('div');
            const mockCurrentLine = document.createElement('div');
            mockCurrentLine.className = 'script-line';
            const mockNextLine = document.createElement('div');
            mockNextLine.className = 'script-line';

            mockParent.appendChild(mockCurrentLine);
            mockParent.appendChild(mockNextLine);
            // parentNode is read-only, so we'll mock the insertBefore method instead
            mockParent.insertBefore = jest.fn();
            // nextElementSibling is read-only, so we'll use a different approach
            // Mock the DOM traversal by creating a proper parent-child relationship
            Object.defineProperty(mockCurrentLine, 'nextElementSibling', {
                value: mockNextLine,
                writable: false,
                configurable: true
            });

            mockContent.getCurrentLine.mockReturnValue(mockCurrentLine);

            const success = chapterManager.insertChapterBreak('Test Chapter');

            expect(success).toBe(true);
            expect(mockParent.children.length).toBe(3); // Original + chapter break + next line
            expect(mockParent.children[1].classList.contains('chapter-break')).toBe(true);
        });

        test('should append chapter break if no next line', () => {
            // Create mock DOM structure
            const mockParent = document.createElement('div');
            const mockCurrentLine = document.createElement('div');
            mockCurrentLine.className = 'script-line';

            mockParent.appendChild(mockCurrentLine);
            // parentNode is read-only, so we'll mock the insertBefore method instead
            mockParent.insertBefore = jest.fn();
            // nextElementSibling is read-only, so we'll use a different approach
            Object.defineProperty(mockCurrentLine, 'nextElementSibling', {
                value: null,
                writable: false,
                configurable: true
            });

            mockContent.getCurrentLine.mockReturnValue(mockCurrentLine);

            const success = chapterManager.insertChapterBreak('Test Chapter');

            expect(success).toBe(true);
            expect(mockParent.children.length).toBe(2); // Original + chapter break
            expect(mockParent.children[1].classList.contains('chapter-break')).toBe(true);
        });
    });

    describe('Chapter management', () => {
        test('should get all chapters sorted by page number', () => {
            const chapterId1 = chapterManager.addChapter('Chapter 1', 5);
            const chapterId2 = chapterManager.addChapter('Chapter 2', 1);
            const chapterId3 = chapterManager.addChapter('Chapter 3', 3);

            const chapters = chapterManager.getAllChapters();

            expect(chapters).toHaveLength(3);
            expect(chapters[0].pageNumber).toBe(1);
            expect(chapters[1].pageNumber).toBe(3);
            expect(chapters[2].pageNumber).toBe(5);
        });

        test('should get chapter at specific page', () => {
            chapterManager.addChapter('Chapter 1', 1);
            chapterManager.addChapter('Chapter 2', 5);

            const chapterAtPage1 = chapterManager.getChapterAtPage(1);
            const chapterAtPage5 = chapterManager.getChapterAtPage(5);
            const chapterAtPage3 = chapterManager.getChapterAtPage(3);

            expect(chapterAtPage1.title).toBe('Chapter 1');
            expect(chapterAtPage5.title).toBe('Chapter 2');
            expect(chapterAtPage3).toBeUndefined();
        });

        test('should update chapter', () => {
            const chapterId = chapterManager.addChapter('Original Title', 1);

            const success = chapterManager.updateChapter(chapterId, {
                title: 'Updated Title',
                pageNumber: 2
            });

            expect(success).toBe(true);

            const chapter = chapterManager.getChapter(chapterId);
            expect(chapter.title).toBe('Updated Title');
            expect(chapter.pageNumber).toBe(2);
        });

        test('should remove chapter', () => {
            const chapterId = chapterManager.addChapter('Test Chapter', 1);

            const success = chapterManager.removeChapter(chapterId);

            expect(success).toBe(true);
            expect(chapterManager.getChapterCount()).toBe(0);
            expect(chapterManager.getChapter(chapterId)).toBeUndefined();
        });

        test('should emit chapter events', () => {
            const chapterUpdatedHandler = jest.fn();
            const chapterRemovedHandler = jest.fn();

            chapterManager.on('chapterUpdated', chapterUpdatedHandler);
            chapterManager.on('chapterRemoved', chapterRemovedHandler);

            const chapterId = chapterManager.addChapter('Test Chapter', 1);

            chapterManager.updateChapter(chapterId, { title: 'Updated' });
            expect(chapterUpdatedHandler).toHaveBeenCalled();

            chapterManager.removeChapter(chapterId);
            expect(chapterRemovedHandler).toHaveBeenCalled();
        });
    });

    describe('Error handling', () => {
        test('should handle chapter break insertion errors gracefully', () => {
            // Mock content manager to throw error
            mockContent.getCurrentLine.mockImplementation(() => {
                throw new Error('DOM error');
            });
            chapterManager.setContent(mockContent);

            const success = chapterManager.insertChapterBreak('Test Chapter');

            expect(success).toBe(false);
        });

        test('should handle invalid chapter operations', () => {
            const success = chapterManager.updateChapter('invalid-id', { title: 'Test' });
            expect(success).toBe(false);

            const removed = chapterManager.removeChapter('invalid-id');
            expect(removed).toBe(false);
        });
    });

    describe('Integration', () => {
        test('should work with content manager', () => {
            const mockContent = {
                getCurrentLine: jest.fn().mockReturnValue(null)
            };

            chapterManager.setContent(mockContent);

            expect(chapterManager.content).toBe(mockContent);
        });

        test('should work with state manager', () => {
            const mockStateManager = {
                getCurrentPage: jest.fn().mockReturnValue(5)
            };

            chapterManager.setStateManager(mockStateManager);

            expect(chapterManager.stateManager).toBe(mockStateManager);
        });
    });
});
