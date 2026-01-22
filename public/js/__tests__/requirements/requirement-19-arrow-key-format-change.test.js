/**
 * Tests for Requirement #19: Users can change the line format using right and left arrow keys
 */

import { KeyboardManager } from '../../widgets/editor/keyboard/KeyboardManager.js';

describe('Requirement #19: Arrow Key Format Change', () => {
    let keyboardManager;
    let mockEditorArea;
    let mockStateManager;
    let mockLineFormatter;

    beforeEach(() => {
        // Create mock editor area
        mockEditorArea = document.createElement('div');
        mockEditorArea.innerHTML = `
            <div class="script-line" data-format="action" contenteditable="true">Test content</div>
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

    describe('Left Arrow Key Format Change', () => {
        test('should change format to previous format on Left Arrow key', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'dialogue');
            const leftArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });

            // Mock line formatter to return previous format
            mockLineFormatter.cycleFormat.mockReturnValue('character');

            const result = keyboardManager._handleArrowFormatChange(leftArrowEvent, scriptLine);

            expect(result).toBe(true);
            expect(mockLineFormatter.cycleFormat).toHaveBeenCalledWith(scriptLine, -1);
        });

        test('should cycle from dialogue to character on Left Arrow', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'dialogue');
            const leftArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });

            mockLineFormatter.cycleFormat.mockReturnValue('character');

            keyboardManager._handleArrowFormatChange(leftArrowEvent, scriptLine);

            expect(mockLineFormatter.cycleFormat).toHaveBeenCalledWith(scriptLine, -1);
            expect(mockStateManager.setCurrentFormat).toHaveBeenCalledWith('character');
        });

        test('should cycle from character to action on Left Arrow', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'character');
            const leftArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });

            mockLineFormatter.cycleFormat.mockReturnValue('action');

            keyboardManager._handleArrowFormatChange(leftArrowEvent, scriptLine);

            expect(mockLineFormatter.cycleFormat).toHaveBeenCalledWith(scriptLine, -1);
            expect(mockStateManager.setCurrentFormat).toHaveBeenCalledWith('action');
        });

        test('should cycle from action to parenthetical on Left Arrow', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'action');
            const leftArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });

            mockLineFormatter.cycleFormat.mockReturnValue('parenthetical');

            keyboardManager._handleArrowFormatChange(leftArrowEvent, scriptLine);

            expect(mockLineFormatter.cycleFormat).toHaveBeenCalledWith(scriptLine, -1);
            expect(mockStateManager.setCurrentFormat).toHaveBeenCalledWith('parenthetical');
        });
    });

    describe('Right Arrow Key Format Change', () => {
        test('should change format to next format on Right Arrow key', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'action');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            // Mock line formatter to return next format
            mockLineFormatter.cycleFormat.mockReturnValue('character');

            const result = keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            expect(result).toBe(true);
            expect(mockLineFormatter.cycleFormat).toHaveBeenCalledWith(scriptLine, 1);
        });

        test('should cycle from action to character on Right Arrow', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'action');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            mockLineFormatter.cycleFormat.mockReturnValue('character');

            keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            expect(mockLineFormatter.cycleFormat).toHaveBeenCalledWith(scriptLine, 1);
            expect(mockStateManager.setCurrentFormat).toHaveBeenCalledWith('character');
        });

        test('should cycle from character to dialogue on Right Arrow', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'character');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            mockLineFormatter.cycleFormat.mockReturnValue('dialogue');

            keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            expect(mockLineFormatter.cycleFormat).toHaveBeenCalledWith(scriptLine, 1);
            expect(mockStateManager.setCurrentFormat).toHaveBeenCalledWith('dialogue');
        });

        test('should cycle from dialogue to parenthetical on Right Arrow', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'dialogue');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            mockLineFormatter.cycleFormat.mockReturnValue('parenthetical');

            keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            expect(mockLineFormatter.cycleFormat).toHaveBeenCalledWith(scriptLine, 1);
            expect(mockStateManager.setCurrentFormat).toHaveBeenCalledWith('parenthetical');
        });
    });

    describe('Format Cycling Direction', () => {
        test('should use -1 direction for Left Arrow (previous format)', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'dialogue');
            const leftArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });

            keyboardManager._handleArrowFormatChange(leftArrowEvent, scriptLine);

            expect(mockLineFormatter.cycleFormat).toHaveBeenCalledWith(scriptLine, -1);
        });

        test('should use +1 direction for Right Arrow (next format)', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'action');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            expect(mockLineFormatter.cycleFormat).toHaveBeenCalledWith(scriptLine, 1);
        });

        test('should handle format cycling in both directions', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'character');

            // Right Arrow - forward cycle
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            mockLineFormatter.cycleFormat.mockReturnValue('dialogue');
            keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            expect(mockLineFormatter.cycleFormat).toHaveBeenCalledWith(scriptLine, 1);

            // Left Arrow - backward cycle
            const leftArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
            mockLineFormatter.cycleFormat.mockReturnValue('character');
            keyboardManager._handleArrowFormatChange(leftArrowEvent, scriptLine);

            expect(mockLineFormatter.cycleFormat).toHaveBeenCalledWith(scriptLine, -1);
        });
    });

    describe('State Management', () => {
        test('should update state manager with new format', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'action');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            mockLineFormatter.cycleFormat.mockReturnValue('character');

            keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            expect(mockStateManager.setCurrentFormat).toHaveBeenCalledWith('character');
        });

        test('should update line format attribute', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'action');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            mockLineFormatter.cycleFormat.mockReturnValue('character');

            keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            expect(mockLineFormatter.setLineFormat).toHaveBeenCalledWith(scriptLine, 'character');
        });

        test('should maintain format consistency across components', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'dialogue');
            const leftArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });

            mockLineFormatter.cycleFormat.mockReturnValue('character');

            keyboardManager._handleArrowFormatChange(leftArrowEvent, scriptLine);

            // Should update both line formatter and state manager
            expect(mockLineFormatter.cycleFormat).toHaveBeenCalled();
            expect(mockStateManager.setCurrentFormat).toHaveBeenCalledWith('character');
        });
    });

    describe('Event Handling', () => {
        test('should prevent default behavior on arrow key format change', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            const preventDefaultSpy = jest.spyOn(rightArrowEvent, 'preventDefault');

            keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            expect(preventDefaultSpy).toHaveBeenCalled();
        });

        test('should handle arrow key events with modifiers', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const rightArrowEvent = new KeyboardEvent('keydown', {
                key: 'ArrowRight',
                ctrlKey: true,
                shiftKey: false,
                altKey: false
            });

            mockLineFormatter.cycleFormat.mockReturnValue('character');

            const result = keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            expect(result).toBe(true);
            expect(mockLineFormatter.cycleFormat).toHaveBeenCalled();
        });

        test('should return true when format change is successful', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            mockLineFormatter.cycleFormat.mockReturnValue('character');

            const result = keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            expect(result).toBe(true);
        });

        test('should return false when format change fails', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            mockLineFormatter.cycleFormat.mockReturnValue(null);

            const result = keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            expect(result).toBe(false);
        });
    });

    describe('Format Validation', () => {
        test('should handle all valid format types', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            const validFormats = ['action', 'character', 'dialogue', 'parenthetical', 'transition'];

            for (const format of validFormats) {
                scriptLine.setAttribute('data-format', format);
                mockLineFormatter.cycleFormat.mockReturnValue('next_format');

                const result = keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

                expect(result).toBe(true);
                expect(mockLineFormatter.cycleFormat).toHaveBeenCalledWith(scriptLine, 1);
            }
        });

        test('should handle unknown format gracefully', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'unknown_format');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            mockLineFormatter.cycleFormat.mockReturnValue('action');

            const result = keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            expect(result).toBe(true);
            expect(mockLineFormatter.cycleFormat).toHaveBeenCalled();
        });

        test('should handle missing format attribute', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.removeAttribute('data-format');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            mockLineFormatter.cycleFormat.mockReturnValue('action');

            const result = keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            expect(result).toBe(true);
            expect(mockLineFormatter.cycleFormat).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        test('should handle line formatter errors gracefully', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            mockLineFormatter.cycleFormat.mockImplementation(() => {
                throw new Error('Format cycle failed');
            });

            const result = keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            expect(result).toBe(false);
        });

        test('should handle missing line formatter gracefully', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            keyboardManager.lineFormatter = null;

            const result = keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            expect(result).toBe(false);
        });

        test('should handle null script line gracefully', () => {
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            const result = keyboardManager._handleArrowFormatChange(rightArrowEvent, null);

            expect(result).toBe(false);
        });

        test('should handle missing state manager gracefully', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            keyboardManager.stateManager = null;
            mockLineFormatter.cycleFormat.mockReturnValue('character');

            const result = keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            expect(result).toBe(true);
            expect(mockLineFormatter.cycleFormat).toHaveBeenCalled();
        });
    });

    describe('Performance and Efficiency', () => {
        test('should handle format changes quickly', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            mockLineFormatter.cycleFormat.mockReturnValue('character');

            const startTime = Date.now();
            keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(50); // Should complete within 50ms
        });

        test('should handle rapid arrow key presses efficiently', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            mockLineFormatter.cycleFormat.mockReturnValue('character');

            // Rapid arrow key presses
            for (let i = 0; i < 10; i++) {
                keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);
            }

            expect(mockLineFormatter.cycleFormat).toHaveBeenCalledTimes(10);
        });

        test('should not cause memory leaks with repeated format changes', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            mockLineFormatter.cycleFormat.mockReturnValue('character');

            // Many format changes
            for (let i = 0; i < 100; i++) {
                keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);
            }

            // Should handle all changes without issues
            expect(mockLineFormatter.cycleFormat).toHaveBeenCalledTimes(100);
        });
    });

    describe('Integration with Editor Components', () => {
        test('should integrate with line formatter for format changes', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            mockLineFormatter.cycleFormat.mockReturnValue('character');

            keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            expect(mockLineFormatter.cycleFormat).toHaveBeenCalledWith(scriptLine, 1);
            expect(mockLineFormatter.setLineFormat).toHaveBeenCalledWith(scriptLine, 'character');
        });

        test('should integrate with state manager for format tracking', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const leftArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });

            mockLineFormatter.cycleFormat.mockReturnValue('action');

            keyboardManager._handleArrowFormatChange(leftArrowEvent, scriptLine);

            expect(mockStateManager.setCurrentFormat).toHaveBeenCalledWith('action');
        });

        test('should work with different line types', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'dialogue');
            const rightArrowEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

            mockLineFormatter.cycleFormat.mockReturnValue('parenthetical');

            const result = keyboardManager._handleArrowFormatChange(rightArrowEvent, scriptLine);

            expect(result).toBe(true);
            expect(mockLineFormatter.cycleFormat).toHaveBeenCalledWith(scriptLine, 1);
        });
    });
});
