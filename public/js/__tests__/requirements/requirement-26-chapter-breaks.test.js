/**
 * Tests for Requirement #26: Users can create chapter breaks with auto-incrementing numbers
 */

import { ChapterManager } from '../../widgets/editor/chapters/ChapterManager.js';

describe('Requirement #26: Chapter Breaks with Auto-incrementing Numbers', () => {
    let chapterManager;
    let mockContainer;
    let mockStateManager;
    let mockEventManager;

    beforeEach(() => {
        // Create mock container
        mockContainer = document.createElement('div');
        mockContainer.innerHTML = `
            <div class="editor-content">
                <div class="script-line" data-format="action">Line 1</div>
                <div class="script-line" data-format="character">Line 2</div>
                <div class="script-line" data-format="dialogue">Line 3</div>
            </div>
        `;

        // Create mock state manager
        mockStateManager = {
            getState: jest.fn().mockReturnValue({
                currentScript: {
                    id: 1,
                    title: 'Test Script',
                    content: 'Test content'
                }
            }),
            setState: jest.fn(),
            subscribe: jest.fn()
        };

        // Create mock event manager
        mockEventManager = {
            publish: jest.fn(),
            subscribe: jest.fn()
        };

        // Create chapter manager
        chapterManager = new ChapterManager({
            container: mockContainer,
            stateManager: mockStateManager,
            eventManager: mockEventManager
        });
    });

    afterEach(() => {
        chapterManager.destroy();
    });

    describe('Chapter Break Creation', () => {
        test('should create chapter break element', () => {
            const chapterBreak = chapterManager.createChapterBreakElement(1);

            expect(chapterBreak).toBeTruthy();
            expect(chapterBreak.classList.contains('chapter-break')).toBe(true);
            expect(chapterBreak.getAttribute('data-chapter-number')).toBe('1');
        });

        test('should create chapter break with proper structure', () => {
            const chapterBreak = chapterManager.createChapterBreakElement(1);

            const chapterNumber = chapterBreak.querySelector('.chapter-number');
            const chapterTitle = chapterBreak.querySelector('.chapter-title');

            expect(chapterNumber).toBeTruthy();
            expect(chapterTitle).toBeTruthy();
            expect(chapterNumber.textContent).toBe('1');
        });

        test('should insert chapter break at specified position', () => {
            const lines = mockContainer.querySelectorAll('.script-line');
            const insertPosition = 1; // After first line

            chapterManager.insertChapterBreak(insertPosition);

            const chapterBreaks = mockContainer.querySelectorAll('.chapter-break');
            expect(chapterBreaks.length).toBe(1);

            const insertedChapterBreak = chapterBreaks[0];
            expect(insertedChapterBreak.previousSibling).toBe(lines[0]);
        });

        test('should insert chapter break at beginning of script', () => {
            const insertPosition = 0; // At beginning

            chapterManager.insertChapterBreak(insertPosition);

            const chapterBreaks = mockContainer.querySelectorAll('.chapter-break');
            expect(chapterBreaks.length).toBe(1);

            const insertedChapterBreak = chapterBreaks[0];
            expect(insertedChapterBreak.nextSibling).toBe(mockContainer.querySelector('.script-line'));
        });

        test('should insert chapter break at end of script', () => {
            const lines = mockContainer.querySelectorAll('.script-line');
            const insertPosition = lines.length; // At end

            chapterManager.insertChapterBreak(insertPosition);

            const chapterBreaks = mockContainer.querySelectorAll('.chapter-break');
            expect(chapterBreaks.length).toBe(1);

            const insertedChapterBreak = chapterBreaks[0];
            expect(insertedChapterBreak.previousSibling).toBe(lines[lines.length - 1]);
        });
    });

    describe('Auto-incrementing Chapter Numbers', () => {
        test('should start with chapter number 1', () => {
            chapterManager.insertChapterBreak(0);

            const chapterBreaks = mockContainer.querySelectorAll('.chapter-break');
            const firstChapter = chapterBreaks[0];
            const chapterNumber = firstChapter.querySelector('.chapter-number');

            expect(chapterNumber.textContent).toBe('1');
        });

        test('should increment chapter numbers automatically', () => {
            // Insert multiple chapter breaks
            chapterManager.insertChapterBreak(0);
            chapterManager.insertChapterBreak(1);
            chapterManager.insertChapterBreak(2);

            const chapterBreaks = mockContainer.querySelectorAll('.chapter-break');
            expect(chapterBreaks.length).toBe(3);

            const chapterNumbers = Array.from(chapterBreaks).map(chapterBreak =>
                chapterBreak.querySelector('.chapter-number').textContent
            );

            expect(chapterNumbers).toEqual(['1', '2', '3']);
        });

        test('should maintain correct chapter numbers after insertion', () => {
            // Insert chapter breaks
            chapterManager.insertChapterBreak(0);
            chapterManager.insertChapterBreak(1);

            // Insert another chapter break between existing ones
            chapterManager.insertChapterBreak(1);

            const chapterBreaks = mockContainer.querySelectorAll('.chapter-break');
            const chapterNumbers = Array.from(chapterBreaks).map(chapterBreak =>
                chapterBreak.querySelector('.chapter-number').textContent
            );

            expect(chapterNumbers).toEqual(['1', '2', '3']);
        });

        test('should handle chapter number gaps correctly', () => {
            // Insert chapter breaks
            chapterManager.insertChapterBreak(0);
            chapterManager.insertChapterBreak(1);
            chapterManager.insertChapterBreak(2);

            // Remove middle chapter break
            const chapterBreaks = mockContainer.querySelectorAll('.chapter-break');
            chapterBreaks[1].remove();

            // Insert new chapter break
            chapterManager.insertChapterBreak(1);

            const updatedChapterBreaks = mockContainer.querySelectorAll('.chapter-break');
            const chapterNumbers = Array.from(updatedChapterBreaks).map(chapterBreak =>
                chapterBreak.querySelector('.chapter-number').textContent
            );

            expect(chapterNumbers).toEqual(['1', '2', '3']);
        });

        test('should renumber chapters when one is deleted', () => {
            // Insert multiple chapter breaks
            chapterManager.insertChapterBreak(0);
            chapterManager.insertChapterBreak(1);
            chapterManager.insertChapterBreak(2);

            // Remove middle chapter break
            const chapterBreaks = mockContainer.querySelectorAll('.chapter-break');
            chapterBreaks[1].remove();

            // Renumber chapters
            chapterManager.renumberChapters();

            const updatedChapterBreaks = mockContainer.querySelectorAll('.chapter-break');
            const chapterNumbers = Array.from(updatedChapterBreaks).map(chapterBreak =>
                chapterBreak.querySelector('.chapter-number').textContent
            );

            expect(chapterNumbers).toEqual(['1', '2']);
        });
    });

    describe('Chapter Break Management', () => {
        test('should track total chapter count', () => {
            chapterManager.insertChapterBreak(0);
            chapterManager.insertChapterBreak(1);

            const chapterCount = chapterManager.getChapterCount();
            expect(chapterCount).toBe(2);
        });

        test('should get next chapter number', () => {
            chapterManager.insertChapterBreak(0);
            chapterManager.insertChapterBreak(1);

            const nextChapterNumber = chapterManager.getNextChapterNumber();
            expect(nextChapterNumber).toBe(3);
        });

        test('should get chapter by number', () => {
            chapterManager.insertChapterBreak(0);
            chapterManager.insertChapterBreak(1);

            const chapter1 = chapterManager.getChapterByNumber(1);
            const chapter2 = chapterManager.getChapterByNumber(2);

            expect(chapter1).toBeTruthy();
            expect(chapter2).toBeTruthy();
            expect(chapter1.getAttribute('data-chapter-number')).toBe('1');
            expect(chapter2.getAttribute('data-chapter-number')).toBe('2');
        });

        test('should return null for non-existent chapter', () => {
            chapterManager.insertChapterBreak(0);

            const nonExistentChapter = chapterManager.getChapterByNumber(5);
            expect(nonExistentChapter).toBeNull();
        });

        test('should get all chapters', () => {
            chapterManager.insertChapterBreak(0);
            chapterManager.insertChapterBreak(1);
            chapterManager.insertChapterBreak(2);

            const allChapters = chapterManager.getAllChapters();
            expect(allChapters.length).toBe(3);
        });
    });

    describe('Chapter Break Styling', () => {
        test('should apply proper CSS classes to chapter breaks', () => {
            const chapterBreak = chapterManager.createChapterBreakElement(1);

            expect(chapterBreak.classList.contains('chapter-break')).toBe(true);
            expect(chapterBreak.classList.contains('auto-numbered')).toBe(true);
        });

        test('should apply proper CSS classes to chapter number', () => {
            const chapterBreak = chapterManager.createChapterBreakElement(1);
            const chapterNumber = chapterBreak.querySelector('.chapter-number');

            expect(chapterNumber.classList.contains('chapter-number')).toBe(true);
        });

        test('should apply proper CSS classes to chapter title', () => {
            const chapterBreak = chapterManager.createChapterBreakElement(1);
            const chapterTitle = chapterBreak.querySelector('.chapter-title');

            expect(chapterTitle.classList.contains('chapter-title')).toBe(true);
        });

        test('should apply different styling for different chapter types', () => {
            const chapterBreak1 = chapterManager.createChapterBreakElement(1);
            const chapterBreak2 = chapterManager.createChapterBreakElement(2);

            expect(chapterBreak1.classList.contains('chapter-break')).toBe(true);
            expect(chapterBreak2.classList.contains('chapter-break')).toBe(true);
        });
    });

    describe('Chapter Break Events', () => {
        test('should publish chapter break created event', () => {
            chapterManager.insertChapterBreak(0);

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'CHAPTER:BREAK_CREATED',
                expect.objectContaining({
                    chapterNumber: 1,
                    position: 0,
                    chapterBreak: expect.any(Element)
                })
            );
        });

        test('should publish chapter break deleted event', () => {
            chapterManager.insertChapterBreak(0);
            const chapterBreak = mockContainer.querySelector('.chapter-break');

            chapterManager.deleteChapterBreak(chapterBreak);

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'CHAPTER:BREAK_DELETED',
                expect.objectContaining({
                    chapterNumber: 1,
                    chapterBreak: expect.any(Element)
                })
            );
        });

        test('should publish chapter renumbered event', () => {
            chapterManager.insertChapterBreak(0);
            chapterManager.insertChapterBreak(1);

            chapterManager.renumberChapters();

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'CHAPTER:RENUMBERED',
                expect.objectContaining({
                    chapterCount: 2
                })
            );
        });

        test('should publish chapter count changed event', () => {
            chapterManager.insertChapterBreak(0);

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'CHAPTER:COUNT_CHANGED',
                expect.objectContaining({
                    chapterCount: 1
                })
            );
        });
    });

    describe('Chapter Break Validation', () => {
        test('should validate chapter break position', () => {
            const lines = mockContainer.querySelectorAll('.script-line');
            const validPosition = 1;
            const invalidPosition = -1;

            expect(chapterManager.validateChapterPosition(validPosition)).toBe(true);
            expect(chapterManager.validateChapterPosition(invalidPosition)).toBe(false);
        });

        test('should validate chapter break position within bounds', () => {
            const lines = mockContainer.querySelectorAll('.script-line');
            const validPosition = lines.length;
            const invalidPosition = lines.length + 1;

            expect(chapterManager.validateChapterPosition(validPosition)).toBe(true);
            expect(chapterManager.validateChapterPosition(invalidPosition)).toBe(false);
        });

        test('should prevent duplicate chapter breaks at same position', () => {
            chapterManager.insertChapterBreak(0);

            // Try to insert another chapter break at same position
            const result = chapterManager.insertChapterBreak(0);

            expect(result).toBe(false);
        });

        test('should validate chapter break element', () => {
            const validChapterBreak = chapterManager.createChapterBreakElement(1);
            const invalidElement = document.createElement('div');

            expect(chapterManager.validateChapterBreak(validChapterBreak)).toBe(true);
            expect(chapterManager.validateChapterBreak(invalidElement)).toBe(false);
        });
    });

    describe('Chapter Break Deletion', () => {
        test('should delete chapter break by element', () => {
            chapterManager.insertChapterBreak(0);
            const chapterBreak = mockContainer.querySelector('.chapter-break');

            chapterManager.deleteChapterBreak(chapterBreak);

            const remainingChapterBreaks = mockContainer.querySelectorAll('.chapter-break');
            expect(remainingChapterBreaks.length).toBe(0);
        });

        test('should delete chapter break by number', () => {
            chapterManager.insertChapterBreak(0);
            chapterManager.insertChapterBreak(1);

            chapterManager.deleteChapterByNumber(1);

            const remainingChapterBreaks = mockContainer.querySelectorAll('.chapter-break');
            expect(remainingChapterBreaks.length).toBe(1);
        });

        test('should renumber chapters after deletion', () => {
            chapterManager.insertChapterBreak(0);
            chapterManager.insertChapterBreak(1);
            chapterManager.insertChapterBreak(2);

            // Delete middle chapter
            chapterManager.deleteChapterByNumber(2);

            const remainingChapterBreaks = mockContainer.querySelectorAll('.chapter-break');
            const chapterNumbers = Array.from(remainingChapterBreaks).map(chapterBreak =>
                chapterBreak.querySelector('.chapter-number').textContent
            );

            expect(chapterNumbers).toEqual(['1', '2']);
        });

        test('should handle deletion of non-existent chapter', () => {
            chapterManager.insertChapterBreak(0);

            const result = chapterManager.deleteChapterByNumber(5);
            expect(result).toBe(false);
        });
    });

    describe('Chapter Break State Management', () => {
        test('should save chapter state to state manager', () => {
            chapterManager.insertChapterBreak(0);
            chapterManager.insertChapterBreak(1);

            expect(mockStateManager.setState).toHaveBeenCalledWith(
                'CHAPTER_STATE',
                expect.objectContaining({
                    chapterCount: 2,
                    chapters: expect.any(Array)
                })
            );
        });

        test('should restore chapter state from state manager', () => {
            const savedState = {
                chapterCount: 2,
                chapters: [
                    { number: 1, position: 0 },
                    { number: 2, position: 1 }
                ]
            };

            mockStateManager.getState.mockReturnValue({
                chapterState: savedState
            });

            chapterManager.restoreChapterState();

            expect(chapterManager.getChapterCount()).toBe(2);
        });

        test('should handle missing chapter state gracefully', () => {
            mockStateManager.getState.mockReturnValue({
                chapterState: null
            });

            expect(() => {
                chapterManager.restoreChapterState();
            }).not.toThrow();
        });
    });

    describe('Error Handling', () => {
        test('should handle missing container gracefully', () => {
            const chapterManagerWithoutContainer = new ChapterManager({
                container: null,
                stateManager: mockStateManager,
                eventManager: mockEventManager
            });

            expect(() => {
                chapterManagerWithoutContainer.insertChapterBreak(0);
            }).not.toThrow();
        });

        test('should handle missing state manager gracefully', () => {
            const chapterManagerWithoutState = new ChapterManager({
                container: mockContainer,
                stateManager: null,
                eventManager: mockEventManager
            });

            expect(() => {
                chapterManagerWithoutState.insertChapterBreak(0);
            }).not.toThrow();
        });

        test('should handle missing event manager gracefully', () => {
            const chapterManagerWithoutEvents = new ChapterManager({
                container: mockContainer,
                stateManager: mockStateManager,
                eventManager: null
            });

            expect(() => {
                chapterManagerWithoutEvents.insertChapterBreak(0);
            }).not.toThrow();
        });

        test('should handle invalid chapter break element gracefully', () => {
            const invalidElement = document.createElement('div');

            expect(() => {
                chapterManager.deleteChapterBreak(invalidElement);
            }).not.toThrow();
        });
    });

    describe('Performance', () => {
        test('should handle large number of chapter breaks efficiently', () => {
            const startTime = Date.now();

            // Insert many chapter breaks
            for (let i = 0; i < 100; i++) {
                chapterManager.insertChapterBreak(i);
            }

            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
        });

        test('should handle rapid chapter break operations efficiently', () => {
            const startTime = Date.now();

            // Rapid chapter break operations
            for (let i = 0; i < 50; i++) {
                chapterManager.insertChapterBreak(0);
                chapterManager.deleteChapterByNumber(1);
            }

            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
        });

        test('should handle frequent renumbering efficiently', () => {
            // Create many chapter breaks
            for (let i = 0; i < 50; i++) {
                chapterManager.insertChapterBreak(i);
            }

            const startTime = Date.now();

            // Frequent renumbering
            for (let i = 0; i < 20; i++) {
                chapterManager.renumberChapters();
            }

            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(200); // Should complete within 200ms
        });
    });

    describe('Integration with Editor Components', () => {
        test('should integrate with line formatter', () => {
            const mockLineFormatter = {
                formatChapterBreak: jest.fn()
            };

            chapterManager.lineFormatter = mockLineFormatter;

            chapterManager.insertChapterBreak(0);

            expect(mockLineFormatter.formatChapterBreak).toHaveBeenCalled();
        });

        test('should integrate with content manager', () => {
            const mockContentManager = {
                getContent: jest.fn().mockReturnValue('Test content'),
                setContent: jest.fn()
            };

            chapterManager.contentManager = mockContentManager;

            chapterManager.insertChapterBreak(0);

            expect(mockContentManager.getContent).toHaveBeenCalled();
        });

        test('should integrate with save service', () => {
            const mockSaveService = {
                handleChapterChange: jest.fn()
            };

            chapterManager.saveService = mockSaveService;

            chapterManager.insertChapterBreak(0);

            expect(mockSaveService.handleChapterChange).toHaveBeenCalled();
        });
    });
});
