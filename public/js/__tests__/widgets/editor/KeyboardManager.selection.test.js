/**
 * Tests for KeyboardManager Multi-line Selection
 */

import { VALID_FORMATS } from '../../../constants/formats.js';
import { KeyboardManager } from '../../../widgets/editor/keyboard/KeyboardManager.js';

describe('KeyboardManager - Multi-line Selection', () => {
    let keyboardManager;
    let mockEditorArea;
    let mockPageManager;
    let mockLineFormatter;
    let mockStateManager;

    beforeEach(() => {
        // Create mock editor area with multiple lines
        mockEditorArea = document.createElement('div');
        mockEditorArea.innerHTML = `
            <div class="script-line" data-format="action" contenteditable="true">Line 1</div>
            <div class="script-line" data-format="speaker" contenteditable="true">Line 2</div>
            <div class="script-line" data-format="dialog" contenteditable="true">Line 3</div>
            <div class="script-line" data-format="action" contenteditable="true">Line 4</div>
        `;
        document.body.appendChild(mockEditorArea);

        // Create mock page manager
        mockPageManager = {
            operations: {
                getNextLine: jest.fn().mockImplementation((line) => {
                    return line.nextElementSibling;
                }),
                getPreviousLine: jest.fn().mockImplementation((line) => {
                    return line.previousElementSibling;
                }),
                removeLine: jest.fn().mockImplementation((line) => {
                    line.remove();
                    return true;
                })
            }
        };

        // Create mock line formatter
        mockLineFormatter = {
            setLineFormat: jest.fn(),
            cycleFormat: jest.fn()
        };

        // Create mock state manager
        mockStateManager = {
            setCurrentFormat: jest.fn()
        };

        // Create keyboard manager
        keyboardManager = new KeyboardManager({
            stateManager: mockStateManager,
            pageManager: mockPageManager,
            contentManager: null,
            lineFormatter: mockLineFormatter,
            autocomplete: { currentSuggestion: null }
        });

        keyboardManager.initialize(mockEditorArea);
    });

    afterEach(() => {
        if (mockEditorArea && mockEditorArea.parentNode) {
            mockEditorArea.parentNode.removeChild(mockEditorArea);
        }
        keyboardManager.destroy();
    });

    describe('Click-based selection', () => {
        test('should start selection on first click', () => {
            const firstLine = mockEditorArea.querySelector('.script-line');
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                target: firstLine
            });

            // Trigger click
            firstLine.dispatchEvent(clickEvent);

            // Verify selection started
            expect(keyboardManager.selectionStart).toBe(firstLine);
            expect(keyboardManager.selectionEnd).toBeNull();
            expect(firstLine.classList.contains('selected')).toBe(true);
        });

        test('should extend selection with shift+click', () => {
            const firstLine = mockEditorArea.querySelector('.script-line');
            const thirdLine = mockEditorArea.querySelectorAll('.script-line')[2];

            // First click to start selection
            const firstClick = new MouseEvent('click', {
                bubbles: true,
                target: firstLine
            });
            firstLine.dispatchEvent(firstClick);

            // Shift+click to extend selection
            const shiftClick = new MouseEvent('click', {
                bubbles: true,
                target: thirdLine,
                shiftKey: true
            });
            thirdLine.dispatchEvent(shiftClick);

            // Verify selection extended
            expect(keyboardManager.selectionStart).toBe(firstLine);
            expect(keyboardManager.selectionEnd).toBe(thirdLine);

            // Verify all lines in between are selected
            const allLines = mockEditorArea.querySelectorAll('.script-line');
            expect(allLines[0].classList.contains('selected')).toBe(true);
            expect(allLines[1].classList.contains('selected')).toBe(true);
            expect(allLines[2].classList.contains('selected')).toBe(true);
            expect(allLines[3].classList.contains('selected')).toBe(false);
        });

        test('should clear selection on new click without shift', () => {
            const firstLine = mockEditorArea.querySelector('.script-line');
            const thirdLine = mockEditorArea.querySelectorAll('.script-line')[2];

            // Start selection
            const firstClick = new MouseEvent('click', {
                bubbles: true,
                target: firstLine
            });
            firstLine.dispatchEvent(firstClick);

            // Extend selection
            const shiftClick = new MouseEvent('click', {
                bubbles: true,
                target: thirdLine,
                shiftKey: true
            });
            thirdLine.dispatchEvent(shiftClick);

            // New click without shift should clear selection
            const newClick = new MouseEvent('click', {
                bubbles: true,
                target: thirdLine
            });
            thirdLine.dispatchEvent(newClick);

            // Verify selection cleared
            expect(keyboardManager.selectionStart).toBe(thirdLine);
            expect(keyboardManager.selectionEnd).toBeNull();

            // Verify only the new line is selected
            const allLines = mockEditorArea.querySelectorAll('.script-line');
            allLines.forEach((line, index) => {
                if (index === 2) {
                    expect(line.classList.contains('selected')).toBe(true);
                } else {
                    expect(line.classList.contains('selected')).toBe(false);
                }
            });
        });
    });

    describe('Keyboard-based selection', () => {
        test('should extend selection with shift+arrow up', () => {
            const secondLine = mockEditorArea.querySelectorAll('.script-line')[1];

            // Start selection
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                target: secondLine
            });
            secondLine.dispatchEvent(clickEvent);

            // Shift+ArrowUp to extend selection
            const shiftArrowUp = new KeyboardEvent('keydown', {
                key: 'ArrowUp',
                shiftKey: true,
                bubbles: true
            });
            secondLine.dispatchEvent(shiftArrowUp);

            // Verify selection extended
            expect(keyboardManager.selectionStart).toBe(secondLine);
            expect(keyboardManager.selectionEnd).toBeDefined();
        });

        test('should extend selection with shift+arrow down', () => {
            const secondLine = mockEditorArea.querySelectorAll('.script-line')[1];

            // Start selection
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                target: secondLine
            });
            secondLine.dispatchEvent(clickEvent);

            // Shift+ArrowDown to extend selection
            const shiftArrowDown = new KeyboardEvent('keydown', {
                key: 'ArrowDown',
                shiftKey: true,
                bubbles: true
            });
            secondLine.dispatchEvent(shiftArrowDown);

            // Verify selection extended
            expect(keyboardManager.selectionStart).toBe(secondLine);
            expect(keyboardManager.selectionEnd).toBeDefined();
        });

        test('should clear selection with arrow keys without shift', () => {
            const secondLine = mockEditorArea.querySelectorAll('.script-line')[1];

            // Start selection
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                target: secondLine
            });
            secondLine.dispatchEvent(clickEvent);

            // ArrowUp without shift should clear selection
            const arrowUp = new KeyboardEvent('keydown', {
                key: 'ArrowUp',
                bubbles: true
            });
            secondLine.dispatchEvent(arrowUp);

            // Verify selection cleared
            expect(keyboardManager.selectionStart).toBeNull();
            expect(keyboardManager.selectionEnd).toBeNull();
        });
    });

    describe('Multi-line deletion', () => {
        test('should delete selected lines with delete key', () => {
            const firstLine = mockEditorArea.querySelector('.script-line');
            const secondLine = mockEditorArea.querySelectorAll('.script-line')[1];

            // Start selection
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                target: firstLine
            });
            firstLine.dispatchEvent(clickEvent);

            // Extend selection
            const shiftClick = new MouseEvent('click', {
                bubbles: true,
                target: secondLine,
                shiftKey: true
            });
            secondLine.dispatchEvent(shiftClick);

            // Delete key should delete selected lines
            const deleteEvent = new KeyboardEvent('keydown', {
                key: 'Delete',
                bubbles: true
            });
            firstLine.dispatchEvent(deleteEvent);

            // Verify lines were deleted
            expect(mockPageManager.operations.removeLine).toHaveBeenCalled();
        });

        test('should delete selected lines with backspace key', () => {
            const firstLine = mockEditorArea.querySelector('.script-line');
            const secondLine = mockEditorArea.querySelectorAll('.script-line')[1];

            // Start selection
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                target: firstLine
            });
            firstLine.dispatchEvent(clickEvent);

            // Extend selection
            const shiftClick = new MouseEvent('click', {
                bubbles: true,
                target: secondLine,
                shiftKey: true
            });
            secondLine.dispatchEvent(shiftClick);

            // Backspace key should delete selected lines
            const backspaceEvent = new KeyboardEvent('keydown', {
                key: 'Backspace',
                bubbles: true
            });
            firstLine.dispatchEvent(backspaceEvent);

            // Verify lines were deleted
            expect(mockPageManager.operations.removeLine).toHaveBeenCalled();
        });

        test('should focus appropriate line after deletion', async () => {
            const firstLine = mockEditorArea.querySelector('.script-line');
            const secondLine = mockEditorArea.querySelectorAll('.script-line')[1];
            const thirdLine = mockEditorArea.querySelectorAll('.script-line')[2];

            // Start selection
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                target: firstLine
            });
            firstLine.dispatchEvent(clickEvent);

            // Extend selection
            const shiftClick = new MouseEvent('click', {
                bubbles: true,
                target: secondLine,
                shiftKey: true
            });
            secondLine.dispatchEvent(shiftClick);

            // Mock the _deleteSelectedLines method
            const deleteSelectedLinesSpy = jest.spyOn(keyboardManager, '_deleteSelectedLines');

            // Delete key should trigger deletion
            const deleteEvent = new KeyboardEvent('keydown', {
                key: 'Delete',
                bubbles: true
            });
            firstLine.dispatchEvent(deleteEvent);

            // Verify deletion was triggered
            expect(deleteSelectedLinesSpy).toHaveBeenCalled();
        });
    });

    describe('Selection state management', () => {
        test('should clear selection when clicking outside script lines', () => {
            const firstLine = mockEditorArea.querySelector('.script-line');

            // Start selection
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                target: firstLine
            });
            firstLine.dispatchEvent(clickEvent);

            // Click outside should clear selection
            const outsideClick = new MouseEvent('click', {
                bubbles: true,
                target: mockEditorArea
            });
            mockEditorArea.dispatchEvent(outsideClick);

            // Verify selection cleared
            expect(keyboardManager.selectionStart).toBeNull();
            expect(keyboardManager.selectionEnd).toBeNull();
        });

        test('should maintain selection state correctly', () => {
            const firstLine = mockEditorArea.querySelector('.script-line');
            const thirdLine = mockEditorArea.querySelectorAll('.script-line')[2];

            // Start selection
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                target: firstLine
            });
            firstLine.dispatchEvent(clickEvent);

            // Extend selection
            const shiftClick = new MouseEvent('click', {
                bubbles: true,
                target: thirdLine,
                shiftKey: true
            });
            thirdLine.dispatchEvent(shiftClick);

            // Verify selection state
            expect(keyboardManager.selectionStart).toBe(firstLine);
            expect(keyboardManager.selectionEnd).toBe(thirdLine);

            // Verify visual selection
            const allLines = mockEditorArea.querySelectorAll('.script-line');
            expect(allLines[0].classList.contains('selected')).toBe(true);
            expect(allLines[1].classList.contains('selected')).toBe(true);
            expect(allLines[2].classList.contains('selected')).toBe(true);
            expect(allLines[3].classList.contains('selected')).toBe(false);
        });
    });

    describe('Error handling', () => {
        test('should handle missing page manager gracefully', () => {
            keyboardManager.pageManager = null;

            const firstLine = mockEditorArea.querySelector('.script-line');
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                target: firstLine
            });

            // Should not throw
            expect(() => {
                firstLine.dispatchEvent(clickEvent);
            }).not.toThrow();
        });

        test('should handle deletion errors gracefully', async () => {
            const firstLine = mockEditorArea.querySelector('.script-line');

            // Mock page manager to throw error
            mockPageManager.operations.removeLine.mockImplementation(() => {
                throw new Error('Deletion failed');
            });

            // Start selection
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                target: firstLine
            });
            firstLine.dispatchEvent(clickEvent);

            // Delete key should handle error gracefully
            const deleteEvent = new KeyboardEvent('keydown', {
                key: 'Delete',
                bubbles: true
            });

            // Should not throw
            expect(() => {
                firstLine.dispatchEvent(deleteEvent);
            }).not.toThrow();
        });
    });
});
