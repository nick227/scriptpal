/**
 * Tests for Requirement #16: Shift+carriage return creates a normal new line
 */

import { KeyboardManager } from '../../widgets/editor/keyboard/KeyboardManager.js';

describe('Requirement #16: Shift+Enter Creates Normal New Line', () => {
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

    describe('Shift+Enter Behavior', () => {
        test('should create normal new line with same format on Shift+Enter', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'action');
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true
            });

            await keyboardManager._handleEnter(scriptLine, shiftEnterEvent);

            // Should NOT call format FSM for Shift+Enter
            expect(mockFormatFSM.setState).not.toHaveBeenCalled();
            expect(mockFormatFSM.onEnter).not.toHaveBeenCalled();
        });

        test('should keep same format for Shift+Enter regardless of current format', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true
            });

            const formats = ['action', 'character', 'dialogue', 'parenthetical'];

            for (const format of formats) {
                scriptLine.setAttribute('data-format', format);

                await keyboardManager._handleEnter(scriptLine, shiftEnterEvent);

                // Should not change format for Shift+Enter
                expect(mockFormatFSM.setState).not.toHaveBeenCalled();
                expect(mockFormatFSM.onEnter).not.toHaveBeenCalled();
            }
        });

        test('should create new line without format transition on Shift+Enter', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'dialogue');
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true
            });

            await keyboardManager._handleEnter(scriptLine, shiftEnterEvent);

            // Should not trigger format FSM
            expect(mockFormatFSM.setState).not.toHaveBeenCalled();
            expect(mockFormatFSM.onEnter).not.toHaveBeenCalled();
        });
    });

    describe('Format Preservation', () => {
        test('should preserve current format when using Shift+Enter', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'character');
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true
            });

            await keyboardManager._handleEnter(scriptLine, shiftEnterEvent);

            // Should not change the current format
            expect(mockStateManager.setCurrentFormat).not.toHaveBeenCalled();
        });

        test('should maintain format consistency across Shift+Enter operations', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'action');
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true
            });

            // Multiple Shift+Enter operations
            for (let i = 0; i < 5; i++) {
                await keyboardManager._handleEnter(scriptLine, shiftEnterEvent);
            }

            // Should not change format for any of them
            expect(mockFormatFSM.setState).not.toHaveBeenCalled();
            expect(mockFormatFSM.onEnter).not.toHaveBeenCalled();
        });

        test('should not update state manager format on Shift+Enter', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'dialogue');
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true
            });

            await keyboardManager._handleEnter(scriptLine, shiftEnterEvent);

            expect(mockStateManager.setCurrentFormat).not.toHaveBeenCalled();
        });
    });

    describe('Comparison with Regular Enter', () => {
        test('should behave differently from regular Enter key', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'action');

            const regularEnterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true
            });

            // Regular Enter should change format
            await keyboardManager._handleEnter(scriptLine, regularEnterEvent);
            expect(mockFormatFSM.setState).toHaveBeenCalledWith('action', false);
            expect(mockFormatFSM.onEnter).toHaveBeenCalled();

            // Reset mocks
            mockFormatFSM.setState.mockClear();
            mockFormatFSM.onEnter.mockClear();

            // Shift+Enter should NOT change format
            await keyboardManager._handleEnter(scriptLine, shiftEnterEvent);
            expect(mockFormatFSM.setState).not.toHaveBeenCalled();
            expect(mockFormatFSM.onEnter).not.toHaveBeenCalled();
        });

        test('should create new line in both cases but with different format behavior', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'character');

            const regularEnterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true
            });

            // Regular Enter - should change format
            await keyboardManager._handleEnter(scriptLine, regularEnterEvent);
            expect(mockFormatFSM.onEnter).toHaveBeenCalled();

            // Reset mocks
            mockFormatFSM.onEnter.mockClear();

            // Shift+Enter - should keep same format
            await keyboardManager._handleEnter(scriptLine, shiftEnterEvent);
            expect(mockFormatFSM.onEnter).not.toHaveBeenCalled();
        });
    });

    describe('Event Detection', () => {
        test('should detect Shift+Enter key combination correctly', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true,
                ctrlKey: false,
                altKey: false
            });

            await keyboardManager._handleEnter(scriptLine, shiftEnterEvent);

            // Should not trigger format change
            expect(mockFormatFSM.setState).not.toHaveBeenCalled();
        });

        test('should handle Shift+Enter with other modifiers', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true,
                ctrlKey: true, // Ctrl+Shift+Enter
                altKey: false
            });

            await keyboardManager._handleEnter(scriptLine, shiftEnterEvent);

            // Should still not change format for Shift+Enter
            expect(mockFormatFSM.setState).not.toHaveBeenCalled();
        });

        test('should distinguish between Enter and Shift+Enter', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'action');

            // Test regular Enter
            const regularEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: false
            });
            await keyboardManager._handleEnter(scriptLine, regularEnterEvent);
            expect(mockFormatFSM.onEnter).toHaveBeenCalled();

            // Reset mocks
            mockFormatFSM.onEnter.mockClear();

            // Test Shift+Enter
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true
            });
            await keyboardManager._handleEnter(scriptLine, shiftEnterEvent);
            expect(mockFormatFSM.onEnter).not.toHaveBeenCalled();
        });
    });

    describe('New Line Creation', () => {
        test('should create new line element on Shift+Enter', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true
            });

            // Mock page manager for line creation
            const mockPageManager = {
                operations: {
                    addLine: jest.fn().mockImplementation((newLine, afterLine) => {
                        afterLine.parentNode.insertBefore(newLine, afterLine.nextSibling);
                        return newLine;
                    })
                }
            };

            keyboardManager.pageManager = mockPageManager;

            await keyboardManager._handleEnter(scriptLine, shiftEnterEvent);

            expect(mockPageManager.operations.addLine).toHaveBeenCalled();
        });

        test('should create new line with same format as current line', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.setAttribute('data-format', 'dialogue');
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true
            });

            await keyboardManager._handleEnter(scriptLine, shiftEnterEvent);

            // Should not change format, keeping the same as current line
            expect(mockFormatFSM.onEnter).not.toHaveBeenCalled();
        });

        test('should handle cursor position correctly on Shift+Enter', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.textContent = 'Test content';
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true
            });

            // Mock selection
            const range = document.createRange();
            range.selectNodeContents(scriptLine);
            range.collapse(false);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            await keyboardManager._handleEnter(scriptLine, shiftEnterEvent);

            // Should handle cursor position without format change
            expect(mockFormatFSM.onEnter).not.toHaveBeenCalled();
        });
    });

    describe('Content Splitting', () => {
        test('should split content at cursor position on Shift+Enter', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.textContent = 'Test content';
            scriptLine.setAttribute('data-format', 'action');
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true
            });

            // Mock selection at middle of content
            const range = document.createRange();
            range.setStart(scriptLine.firstChild, 5); // After "Test "
            range.collapse(true);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            await keyboardManager._handleEnter(scriptLine, shiftEnterEvent);

            // Should split content but not change format
            expect(mockFormatFSM.onEnter).not.toHaveBeenCalled();
        });

        test('should handle empty line creation on Shift+Enter', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.textContent = '';
            scriptLine.setAttribute('data-format', 'character');
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true
            });

            await keyboardManager._handleEnter(scriptLine, shiftEnterEvent);

            // Should create new line without format change
            expect(mockFormatFSM.onEnter).not.toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        test('should handle Shift+Enter gracefully with missing format FSM', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            keyboardManager.formatFSM = null;
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true
            });

            await expect(keyboardManager._handleEnter(scriptLine, shiftEnterEvent)).resolves.not.toThrow();
        });

        test('should handle Shift+Enter with invalid script line', async () => {
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true
            });

            await expect(keyboardManager._handleEnter(null, shiftEnterEvent)).resolves.not.toThrow();
        });

        test('should handle Shift+Enter with missing format attribute', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            scriptLine.removeAttribute('data-format');
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true
            });

            await expect(keyboardManager._handleEnter(scriptLine, shiftEnterEvent)).resolves.not.toThrow();
        });
    });

    describe('Performance', () => {
        test('should handle Shift+Enter efficiently', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true
            });

            const startTime = Date.now();
            await keyboardManager._handleEnter(scriptLine, shiftEnterEvent);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
        });

        test('should handle rapid Shift+Enter operations', async () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const shiftEnterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                shiftKey: true
            });

            // Rapid Shift+Enter operations
            for (let i = 0; i < 10; i++) {
                await keyboardManager._handleEnter(scriptLine, shiftEnterEvent);
            }

            // Should not make any format FSM calls
            expect(mockFormatFSM.onEnter).not.toHaveBeenCalled();
        });
    });
});
