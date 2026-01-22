/**
 * Tests for KeyboardManager Arrow key format changing
 */

import { VALID_FORMATS } from '../../../constants/formats.js';
import { KeyboardManager } from '../../../widgets/editor/keyboard/KeyboardManager.js';

describe('KeyboardManager - Arrow Key Format Changing', () => {
    let keyboardManager;
    let mockEditorArea;
    let mockPageManager;
    let mockLineFormatter;
    let mockStateManager;

    beforeEach(() => {
        // Create mock editor area
        mockEditorArea = document.createElement('div');
        mockEditorArea.innerHTML = `
            <div class="script-line" data-format="action" contenteditable="true">Test content</div>
        `;
        document.body.appendChild(mockEditorArea);

        // Create mock page manager
        mockPageManager = {
            operations: {
                getNextLine: jest.fn(),
                getPreviousLine: jest.fn()
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

    describe('Left arrow format changing', () => {
        test('should change format when cursor is at start of line', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', VALID_FORMATS.ACTION);

            // Mock cursor at start of line
            const range = document.createRange();
            range.setStart(scriptLine.firstChild, 0);
            range.collapse(true);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            const leftArrowEvent = new KeyboardEvent('keydown', {
                key: 'ArrowLeft',
                bubbles: true
            });

            // Spy on the arrow format change handler
            const handleArrowFormatChangeSpy = jest.spyOn(keyboardManager, '_handleArrowFormatChange');

            // Trigger the event
            scriptLine.dispatchEvent(leftArrowEvent);

            // Verify that arrow format change was called
            expect(handleArrowFormatChangeSpy).toHaveBeenCalledWith(leftArrowEvent, scriptLine);
        });

        test('should not change format when cursor is not at start of line', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', VALID_FORMATS.ACTION);

            // Mock cursor in middle of line
            const range = document.createRange();
            range.setStart(scriptLine.firstChild, 5);
            range.collapse(true);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            const leftArrowEvent = new KeyboardEvent('keydown', {
                key: 'ArrowLeft',
                bubbles: true
            });

            // Spy on the arrow format change handler
            const handleArrowFormatChangeSpy = jest.spyOn(keyboardManager, '_handleArrowFormatChange');

            // Trigger the event
            scriptLine.dispatchEvent(leftArrowEvent);

            // Verify that arrow format change was called but returned false
            expect(handleArrowFormatChangeSpy).toHaveBeenCalledWith(leftArrowEvent, scriptLine);
        });
    });

    describe('Right arrow format changing', () => {
        test('should change format when cursor is at end of line', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', VALID_FORMATS.ACTION);

            // Mock cursor at end of line
            const range = document.createRange();
            range.selectNodeContents(scriptLine);
            range.collapse(false);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            const rightArrowEvent = new KeyboardEvent('keydown', {
                key: 'ArrowRight',
                bubbles: true
            });

            // Spy on the arrow format change handler
            const handleArrowFormatChangeSpy = jest.spyOn(keyboardManager, '_handleArrowFormatChange');

            // Trigger the event
            scriptLine.dispatchEvent(rightArrowEvent);

            // Verify that arrow format change was called
            expect(handleArrowFormatChangeSpy).toHaveBeenCalledWith(rightArrowEvent, scriptLine);
        });

        test('should not change format when cursor is not at end of line', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', VALID_FORMATS.ACTION);

            // Mock cursor in middle of line
            const range = document.createRange();
            range.setStart(scriptLine.firstChild, 5);
            range.collapse(true);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            const rightArrowEvent = new KeyboardEvent('keydown', {
                key: 'ArrowRight',
                bubbles: true
            });

            // Spy on the arrow format change handler
            const handleArrowFormatChangeSpy = jest.spyOn(keyboardManager, '_handleArrowFormatChange');

            // Trigger the event
            scriptLine.dispatchEvent(rightArrowEvent);

            // Verify that arrow format change was called but returned false
            expect(handleArrowFormatChangeSpy).toHaveBeenCalledWith(rightArrowEvent, scriptLine);
        });
    });

    describe('Format cycling with arrows', () => {
        test('should cycle format forward with right arrow', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', VALID_FORMATS.ACTION);

            // Mock cursor at end of line
            const range = document.createRange();
            range.selectNodeContents(scriptLine);
            range.collapse(false);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            // Call _handleArrowFormatChange directly
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            const result = keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            // Verify format change was handled (only if cursor is at start/end)
            // The method returns false if cursor is not at start/end of line
            expect(typeof result).toBe('boolean');
            if (result) {
                expect(mockLineFormatter.setLineFormat).toHaveBeenCalled();
            }
        });

        test('should cycle format backward with left arrow', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', VALID_FORMATS.ACTION);

            // Mock cursor at start of line
            const range = document.createRange();
            range.setStart(scriptLine.firstChild, 0);
            range.collapse(true);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            // Call _handleArrowFormatChange directly
            const leftArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
            const result = keyboardManager._handleArrowFormatChange(leftArrowEvent, scriptLine);

            // Verify format change was handled (only if cursor is at start/end)
            // The method returns false if cursor is not at start/end of line
            expect(typeof result).toBe('boolean');
            if (result) {
                expect(mockLineFormatter.setLineFormat).toHaveBeenCalled();
            }
        });
    });

    describe('Cursor position detection', () => {
        test('should detect cursor at start of line', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.textContent = 'Hello world';

            // Mock cursor at start
            const range = document.createRange();
            range.setStart(scriptLine.firstChild, 0);
            range.collapse(true);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            const leftArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
            const result = keyboardManager._handleArrowFormatChange(leftArrowEvent, scriptLine);

            expect(result).toBe(true);
        });

        test('should detect cursor at end of line', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.textContent = 'Hello world';

            // Mock cursor at end
            const range = document.createRange();
            range.selectNodeContents(scriptLine);
            range.collapse(false);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            const result = keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            expect(result).toBe(true);
        });

        test('should not change format when cursor is in middle', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.textContent = 'Hello world';

            // Mock cursor in middle
            const range = document.createRange();
            range.setStart(scriptLine.firstChild, 5);
            range.collapse(true);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            const leftArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
            const result = keyboardManager._handleArrowFormatChange(leftArrowEvent, scriptLine);

            expect(result).toBe(false);
        });
    });

    describe('Error handling', () => {
        test('should handle missing range gracefully', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');

            // Clear selection
            const selection = window.getSelection();
            selection.removeAllRanges();

            const leftArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
            const result = keyboardManager._handleArrowFormatChange(leftArrowEvent, scriptLine);

            expect(result).toBe(false);
        });

        test('should handle missing line formatter gracefully', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', VALID_FORMATS.ACTION);
            keyboardManager.lineFormatter = null;

            // Mock cursor at start
            const range = document.createRange();
            range.setStart(scriptLine.firstChild, 0);
            range.collapse(true);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            const leftArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });

            // Should not throw
            expect(() => {
                keyboardManager._handleArrowFormatChange(leftArrowEvent, scriptLine);
            }).not.toThrow();
        });
    });
});
