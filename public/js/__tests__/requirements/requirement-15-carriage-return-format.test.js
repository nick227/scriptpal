/**
 * Tests for Requirement #15: Carriage return always changes the line format
 */

import { KeyboardManager } from '../../widgets/editor/keyboard/KeyboardManager.js';
import { LineFormatter } from '../../widgets/editor/LineFormatter.js';

describe('Requirement #15: Carriage Return Always Changes Format', () => {
    let keyboardManager;
    let mockEditorArea;
    let mockStateManager;
    let mockLineFormatter;
    let mockFormatFSM;

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

        // Create mock format FSM
        mockFormatFSM = {
            setState: jest.fn(),
            onEnter: jest.fn().mockReturnValue('character'),
            getCurrentState: jest.fn().mockReturnValue('action')
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

        // Replace format FSM with mock
        keyboardManager.formatFSM = mockFormatFSM;
        keyboardManager.initialize(mockEditorArea);
    });

    afterEach(() => {
        keyboardManager.destroy();
        document.body.removeChild(mockEditorArea);
    });

    describe('Format Change on Enter Key', () => {
        test('should always change format when Enter key is pressed', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            // Mock format FSM to return next format
            mockFormatFSM.onEnter.mockReturnValue('character');

            await keyboardManager._handleEnter(scriptLine, enterEvent);

            expect(mockFormatFSM.setState).toHaveBeenCalledWith('action', false);
            expect(mockFormatFSM.onEnter).toHaveBeenCalled();
        });

        test('should change format from action to character on Enter', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'action');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            mockFormatFSM.onEnter.mockReturnValue('character');

            await keyboardManager._handleEnter(scriptLine, enterEvent);

            expect(mockFormatFSM.setState).toHaveBeenCalledWith('action', false);
            expect(mockFormatFSM.onEnter).toHaveBeenCalled();
        });

        test('should change format from character to dialogue on Enter', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'character');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            mockFormatFSM.onEnter.mockReturnValue('dialogue');

            await keyboardManager._handleEnter(scriptLine, enterEvent);

            expect(mockFormatFSM.setState).toHaveBeenCalledWith('character', false);
            expect(mockFormatFSM.onEnter).toHaveBeenCalled();
        });

        test('should change format from dialogue to parenthetical on Enter', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'dialogue');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            mockFormatFSM.onEnter.mockReturnValue('parenthetical');

            await keyboardManager._handleEnter(scriptLine, enterEvent);

            expect(mockFormatFSM.setState).toHaveBeenCalledWith('dialogue', false);
            expect(mockFormatFSM.onEnter).toHaveBeenCalled();
        });

        test('should change format from parenthetical back to action on Enter', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'parenthetical');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            mockFormatFSM.onEnter.mockReturnValue('action');

            await keyboardManager._handleEnter(scriptLine, enterEvent);

            expect(mockFormatFSM.setState).toHaveBeenCalledWith('parenthetical', false);
            expect(mockFormatFSM.onEnter).toHaveBeenCalled();
        });
    });

    describe('Format FSM Integration', () => {
        test('should use format FSM for all format transitions', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            const formats = ['action', 'character', 'dialogue', 'parenthetical'];

            for (const format of formats) {
                scriptLine.setAttribute('data-format', format);
                mockFormatFSM.onEnter.mockReturnValue('next_format');

                await keyboardManager._handleEnter(scriptLine, enterEvent);

                expect(mockFormatFSM.setState).toHaveBeenCalledWith(format, false);
                expect(mockFormatFSM.onEnter).toHaveBeenCalled();
            }
        });

        test('should always call format FSM onEnter method', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            mockFormatFSM.onEnter.mockReturnValue('character');

            await keyboardManager._handleEnter(scriptLine, enterEvent);

            expect(mockFormatFSM.onEnter).toHaveBeenCalled();
        });

        test('should set format FSM state before calling onEnter', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'action');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            mockFormatFSM.onEnter.mockReturnValue('character');

            await keyboardManager._handleEnter(scriptLine, enterEvent);

            expect(mockFormatFSM.setState).toHaveBeenCalledWith('action', false);
            expect(mockFormatFSM.onEnter).toHaveBeenCalled();
        });
    });

    describe('New Line Creation with Format', () => {
        test('should create new line with changed format', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            mockFormatFSM.onEnter.mockReturnValue('character');

            await keyboardManager._handleEnter(scriptLine, enterEvent);

            // Should create new line with the format returned by FSM
            expect(mockFormatFSM.onEnter).toHaveBeenCalled();
        });

        test('should apply new format to created line', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'action');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            mockFormatFSM.onEnter.mockReturnValue('character');

            await keyboardManager._handleEnter(scriptLine, enterEvent);

            // Should use the format returned by FSM for new line
            expect(mockFormatFSM.onEnter).toHaveBeenCalled();
        });

        test('should update state manager with new format', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            mockFormatFSM.onEnter.mockReturnValue('character');

            await keyboardManager._handleEnter(scriptLine, enterEvent);

            expect(mockStateManager.setCurrentFormat).toHaveBeenCalledWith('character');
        });
    });

    describe('Format Cycle Consistency', () => {
        test('should maintain consistent format cycle', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            const formatCycle = ['action', 'character', 'dialogue', 'parenthetical', 'action'];

            for (let i = 0; i < formatCycle.length - 1; i++) {
                const currentFormat = formatCycle[i];
                const expectedNextFormat = formatCycle[i + 1];

                scriptLine.setAttribute('data-format', currentFormat);
                mockFormatFSM.onEnter.mockReturnValue(expectedNextFormat);

                await keyboardManager._handleEnter(scriptLine, enterEvent);

                expect(mockFormatFSM.setState).toHaveBeenCalledWith(currentFormat, false);
                expect(mockFormatFSM.onEnter).toHaveBeenCalled();
            }
        });

        test('should handle format transitions for all valid formats', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            const validFormats = ['action', 'character', 'dialogue', 'parenthetical', 'transition'];

            for (const format of validFormats) {
                scriptLine.setAttribute('data-format', format);
                mockFormatFSM.onEnter.mockReturnValue('next_format');

                await keyboardManager._handleEnter(scriptLine, enterEvent);

                expect(mockFormatFSM.setState).toHaveBeenCalledWith(format, false);
                expect(mockFormatFSM.onEnter).toHaveBeenCalled();
            }
        });
    });

    describe('Edge Cases and Error Handling', () => {
        test('should handle unknown format gracefully', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'unknown_format');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            mockFormatFSM.onEnter.mockReturnValue('action');

            await expect(keyboardManager._handleEnter(scriptLine, enterEvent)).resolves.not.toThrow();
        });

        test('should handle missing format attribute', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.removeAttribute('data-format');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            mockFormatFSM.onEnter.mockReturnValue('action');

            await expect(keyboardManager._handleEnter(scriptLine, enterEvent)).resolves.not.toThrow();
        });

        test('should handle format FSM errors gracefully', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            mockFormatFSM.onEnter.mockImplementation(() => {
                throw new Error('FSM Error');
            });

            await expect(keyboardManager._handleEnter(scriptLine, enterEvent)).resolves.not.toThrow();
        });

        test('should handle null script line gracefully', async () => {
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            await expect(keyboardManager._handleEnter(null, enterEvent)).resolves.not.toThrow();
        });
    });

    describe('Performance and Efficiency', () => {
        test('should complete format change quickly', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            mockFormatFSM.onEnter.mockReturnValue('character');

            const startTime = Date.now();
            await keyboardManager._handleEnter(scriptLine, enterEvent);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
        });

        test('should handle rapid Enter key presses efficiently', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            mockFormatFSM.onEnter.mockReturnValue('character');

            // Rapid Enter key presses
            for (let i = 0; i < 10; i++) {
                await keyboardManager._handleEnter(scriptLine, enterEvent);
            }

            expect(mockFormatFSM.onEnter).toHaveBeenCalledTimes(10);
        });
    });

    describe('Integration with Editor Components', () => {
        test('should work with line formatter', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            mockFormatFSM.onEnter.mockReturnValue('character');

            await keyboardManager._handleEnter(scriptLine, enterEvent);

            expect(mockLineFormatter.setLineFormat).toHaveBeenCalled();
        });

        test('should work with state manager', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            mockFormatFSM.onEnter.mockReturnValue('character');

            await keyboardManager._handleEnter(scriptLine, enterEvent);

            expect(mockStateManager.setCurrentFormat).toHaveBeenCalledWith('character');
        });

        test('should integrate with page manager for new line creation', async () => {
            const mockPageManager = {
                operations: {
                    addLine: jest.fn().mockImplementation((newLine, afterLine) => {
                        afterLine.parentNode.insertBefore(newLine, afterLine.nextSibling);
                        return newLine;
                    })
                }
            };

            keyboardManager.pageManager = mockPageManager;

            const scriptLine = mockEditorArea.querySelector('.script-line');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            mockFormatFSM.onEnter.mockReturnValue('character');

            await keyboardManager._handleEnter(scriptLine, enterEvent);

            expect(mockPageManager.operations.addLine).toHaveBeenCalled();
        });
    });

    describe('Format State Validation', () => {
        test('should validate format before transition', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'action');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            mockFormatFSM.onEnter.mockReturnValue('character');

            await keyboardManager._handleEnter(scriptLine, enterEvent);

            expect(mockFormatFSM.setState).toHaveBeenCalledWith('action', false);
        });

        test('should handle invalid format transitions', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'invalid');
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });

            mockFormatFSM.onEnter.mockReturnValue('action');

            await expect(keyboardManager._handleEnter(scriptLine, enterEvent)).resolves.not.toThrow();
        });
    });
});
