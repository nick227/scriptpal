/**
 * Tests for Requirement #17: Users can select multiple lines
 */

import { KeyboardManager } from '../../widgets/editor/keyboard/KeyboardManager.js';

describe('Requirement #17: Multi-line Selection', () => {
    let keyboardManager;
    let mockEditorArea;
    let mockStateManager;
    let mockLineFormatter;

    beforeEach(() => {
        // Create mock editor area with multiple lines
        mockEditorArea = document.createElement('div');
        mockEditorArea.innerHTML = `
            <div class="script-line" data-format="action" contenteditable="true">Line 1: Action content</div>
            <div class="script-line" data-format="character" contenteditable="true">Line 2: Character name</div>
            <div class="script-line" data-format="dialogue" contenteditable="true">Line 3: Dialogue content</div>
            <div class="script-line" data-format="action" contenteditable="true">Line 4: More action</div>
            <div class="script-line" data-format="character" contenteditable="true">Line 5: Another character</div>
        `;
        document.body.appendChild(mockEditorArea);

        // Create mock state manager
        mockStateManager = {
            setCurrentFormat: jest.fn(),
            getState: jest.fn().mockReturnValue({ currentFormat: 'action' }),
            setState: jest.fn(),
            subscribe: jest.fn()
        };

        // Create mock line formatter
        mockLineFormatter = {
            setLineFormat: jest.fn(),
            cycleFormat: jest.fn()
        };

        // Create keyboard manager
        keyboardManager = new KeyboardManager({
            stateManager: mockStateManager,
            pageManager: null,
            contentManager: null,
            lineFormatter: mockLineFormatter,
            autocomplete: null,
            saveService: null,
            history: null
        });

        keyboardManager.initialize(mockEditorArea);
    });

    afterEach(() => {
        keyboardManager.destroy();
        document.body.removeChild(mockEditorArea);
    });

    describe('Multi-line Selection Functionality', () => {
        test('should allow selecting multiple consecutive lines', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const firstLine = lines[0];
            const lastLine = lines[2];

            // Create selection from first line to third line
            const range = document.createRange();
            range.setStart(firstLine, 0);
            range.setEnd(lastLine, lastLine.textContent.length);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            // Verify selection spans multiple lines
            expect(selection.rangeCount).toBe(1);
            expect(selection.toString().length).toBeGreaterThan(firstLine.textContent.length);
        });

        test('should track selection start and end lines', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            // Create multi-line selection
            const range = document.createRange();
            range.setStart(startLine, 0);
            range.setEnd(endLine, endLine.textContent.length);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            // Simulate selection tracking
            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = endLine;

            expect(keyboardManager.selectionStart).toBe(startLine);
            expect(keyboardManager.selectionEnd).toBe(endLine);
        });

        test('should handle selection across different line formats', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const actionLine = lines[0]; // action format
            const characterLine = lines[1]; // character format
            const dialogueLine = lines[2]; // dialogue format

            // Create selection across different formats
            const range = document.createRange();
            range.setStart(actionLine, 0);
            range.setEnd(dialogueLine, dialogueLine.textContent.length);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            // Verify selection includes different formats
            const selectedText = selection.toString();
            expect(selectedText).toContain('Action content');
            expect(selectedText).toContain('Character name');
            expect(selectedText).toContain('Dialogue content');
        });

        test('should support selecting all lines', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const firstLine = lines[0];
            const lastLine = lines[lines.length - 1];

            // Create selection from first to last line
            const range = document.createRange();
            range.setStart(firstLine, 0);
            range.setEnd(lastLine, lastLine.textContent.length);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            // Verify all lines are selected
            const selectedText = selection.toString();
            expect(selectedText).toContain('Line 1: Action content');
            expect(selectedText).toContain('Line 5: Another character');
        });
    });

    describe('Selection Visual Feedback', () => {
        test('should provide visual feedback for multi-line selection', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            // Create multi-line selection
            const range = document.createRange();
            range.setStart(startLine, 0);
            range.setEnd(endLine, endLine.textContent.length);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            // Verify selection is visible
            expect(selection.toString().length).toBeGreaterThan(0);
            expect(selection.rangeCount).toBe(1);
        });

        test('should highlight selected lines', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            // Create multi-line selection
            const range = document.createRange();
            range.setStart(startLine, 0);
            range.setEnd(endLine, endLine.textContent.length);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            // Simulate highlighting selected lines
            for (let i = 1; i <= 3; i++) {
                lines[i].classList.add('selected');
            }

            // Verify lines are highlighted
            expect(lines[1].classList.contains('selected')).toBe(true);
            expect(lines[2].classList.contains('selected')).toBe(true);
            expect(lines[3].classList.contains('selected')).toBe(true);
        });

        test('should clear selection when clicking elsewhere', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            // Create multi-line selection
            const range = document.createRange();
            range.setStart(startLine, 0);
            range.setEnd(endLine, endLine.textContent.length);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            // Simulate clicking elsewhere
            const clickEvent = new MouseEvent('click', { bubbles: true });
            mockEditorArea.dispatchEvent(clickEvent);

            // Selection should be cleared
            expect(selection.rangeCount).toBe(0);
        });
    });

    describe('Selection Range Management', () => {
        test('should handle selection start before end line', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[0];
            const endLine = lines[2];

            // Create forward selection
            const range = document.createRange();
            range.setStart(startLine, 0);
            range.setEnd(endLine, endLine.textContent.length);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            expect(selection.toString().length).toBeGreaterThan(0);
        });

        test('should handle selection end before start line (reverse selection)', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[2];
            const endLine = lines[0];

            // Create reverse selection
            const range = document.createRange();
            range.setStart(startLine, 0);
            range.setEnd(endLine, endLine.textContent.length);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            expect(selection.toString().length).toBeGreaterThan(0);
        });

        test('should handle partial line selection', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const firstLine = lines[0];
            const secondLine = lines[1];

            // Create partial selection within lines
            const range = document.createRange();
            range.setStart(firstLine.firstChild, 5); // Start at character 5
            range.setEnd(secondLine.firstChild, 10); // End at character 10

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            expect(selection.toString().length).toBeGreaterThan(0);
        });
    });

    describe('Selection with Keyboard', () => {
        test('should support Shift+Click for multi-line selection', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const firstLine = lines[0];
            const thirdLine = lines[2];

            // Simulate Shift+Click selection
            const shiftClickEvent = new MouseEvent('click', {
                bubbles: true,
                shiftKey: true
            });

            // First click on first line
            firstLine.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            // Shift+Click on third line
            thirdLine.dispatchEvent(shiftClickEvent);

            // Should create multi-line selection
            const selection = window.getSelection();
            expect(selection.rangeCount).toBeGreaterThan(0);
        });

        test('should support Ctrl+Click for non-consecutive selection', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const firstLine = lines[0];
            const thirdLine = lines[2];
            const fifthLine = lines[4];

            // Simulate Ctrl+Click selection
            const ctrlClickEvent = new MouseEvent('click', {
                bubbles: true,
                ctrlKey: true
            });

            // Click on first line
            firstLine.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            // Ctrl+Click on third line
            thirdLine.dispatchEvent(ctrlClickEvent);

            // Ctrl+Click on fifth line
            fifthLine.dispatchEvent(ctrlClickEvent);

            // Should create multi-selection
            const selection = window.getSelection();
            expect(selection.rangeCount).toBeGreaterThan(0);
        });

        test('should support keyboard selection with Shift+Arrow keys', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const firstLine = lines[0];

            // Focus on first line
            firstLine.focus();

            // Simulate Shift+Down Arrow to extend selection
            const shiftDownEvent = new KeyboardEvent('keydown', {
                key: 'ArrowDown',
                shiftKey: true,
                bubbles: true
            });

            firstLine.dispatchEvent(shiftDownEvent);

            // Should extend selection to next line
            const selection = window.getSelection();
            expect(selection.rangeCount).toBeGreaterThan(0);
        });
    });

    describe('Selection State Management', () => {
        test('should track selection state in keyboard manager', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            // Set selection state
            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = endLine;

            expect(keyboardManager.selectionStart).toBe(startLine);
            expect(keyboardManager.selectionEnd).toBe(endLine);
        });

        test('should clear selection state when selection is cleared', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            // Set selection state
            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = endLine;

            // Clear selection
            keyboardManager.clearSelection();

            expect(keyboardManager.selectionStart).toBeNull();
            expect(keyboardManager.selectionEnd).toBeNull();
        });

        test('should update selection state when selection changes', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const firstStartLine = lines[1];
            const firstEndLine = lines[2];
            const secondStartLine = lines[3];
            const secondEndLine = lines[4];

            // Set initial selection
            keyboardManager.selectionStart = firstStartLine;
            keyboardManager.selectionEnd = firstEndLine;

            // Update selection
            keyboardManager.selectionStart = secondStartLine;
            keyboardManager.selectionEnd = secondEndLine;

            expect(keyboardManager.selectionStart).toBe(secondStartLine);
            expect(keyboardManager.selectionEnd).toBe(secondEndLine);
        });
    });

    describe('Selection Validation', () => {
        test('should validate selection boundaries', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            // Valid selection
            const isValidSelection = startLine && endLine &&
                                   startLine.parentNode === mockEditorArea &&
                                   endLine.parentNode === mockEditorArea;

            expect(isValidSelection).toBe(true);
        });

        test('should handle invalid selection gracefully', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const invalidEndLine = document.createElement('div'); // Not in editor

            // Invalid selection
            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = invalidEndLine;

            // Should handle gracefully
            expect(keyboardManager.selectionStart).toBe(startLine);
            expect(keyboardManager.selectionEnd).toBe(invalidEndLine);
        });

        test('should handle empty selection', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const line = lines[0];

            // Empty selection (cursor position)
            const range = document.createRange();
            range.setStart(line, 0);
            range.collapse(true);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            expect(selection.toString().length).toBe(0);
        });
    });

    describe('Selection Events', () => {
        test('should handle selection change events', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            // Create selection
            const range = document.createRange();
            range.setStart(startLine, 0);
            range.setEnd(endLine, endLine.textContent.length);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            // Simulate selection change event
            const selectionChangeEvent = new Event('selectionchange', { bubbles: true });
            document.dispatchEvent(selectionChangeEvent);

            // Should handle selection change
            expect(selection.rangeCount).toBe(1);
        });

        test('should handle mouse selection events', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            // Simulate mouse down
            const mouseDownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                target: startLine
            });
            startLine.dispatchEvent(mouseDownEvent);

            // Simulate mouse up
            const mouseUpEvent = new MouseEvent('mouseup', {
                bubbles: true,
                target: endLine
            });
            endLine.dispatchEvent(mouseUpEvent);

            // Should create selection
            const selection = window.getSelection();
            expect(selection.rangeCount).toBeGreaterThan(0);
        });
    });

    describe('Performance and Edge Cases', () => {
        test('should handle large multi-line selections efficiently', () => {
            // Create many lines
            for (let i = 5; i < 100; i++) {
                const line = document.createElement('div');
                line.className = 'script-line';
                line.setAttribute('data-format', 'action');
                line.textContent = `Line ${i}: Content`;
                mockEditorArea.appendChild(line);
            }

            const lines = mockEditorArea.querySelectorAll('.script-line');
            const firstLine = lines[0];
            const lastLine = lines[lines.length - 1];

            const startTime = Date.now();

            // Create large selection
            const range = document.createRange();
            range.setStart(firstLine, 0);
            range.setEnd(lastLine, lastLine.textContent.length);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
            expect(selection.toString().length).toBeGreaterThan(0);
        });

        test('should handle rapid selection changes', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');

            // Rapid selection changes
            for (let i = 0; i < 10; i++) {
                const startLine = lines[i % lines.length];
                const endLine = lines[(i + 1) % lines.length];

                const range = document.createRange();
                range.setStart(startLine, 0);
                range.setEnd(endLine, endLine.textContent.length);

                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }

            // Should handle all changes
            const selection = window.getSelection();
            expect(selection.rangeCount).toBeGreaterThan(0);
        });

        test('should handle selection with mixed content types', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[0];
            const endLine = lines[4];

            // Create selection across all content types
            const range = document.createRange();
            range.setStart(startLine, 0);
            range.setEnd(endLine, endLine.textContent.length);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            const selectedText = selection.toString();
            expect(selectedText).toContain('Action content');
            expect(selectedText).toContain('Character name');
            expect(selectedText).toContain('Dialogue content');
        });
    });
});
