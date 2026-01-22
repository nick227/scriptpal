/**
 * Tests for Requirement #18: Users delete multi-selected lines
 */

import { KeyboardManager } from '../../widgets/editor/keyboard/KeyboardManager.js';

describe('Requirement #18: Delete Multi-selected Lines', () => {
    let keyboardManager;
    let mockEditorArea;
    let mockStateManager;
    let mockLineFormatter;
    let mockPageManager;

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

        // Create mock page manager
        mockPageManager = {
            operations: {
                removeLine: jest.fn().mockImplementation((line) => {
                    if (line && line.parentNode) {
                        line.parentNode.removeChild(line);
                    }
                }),
                getLineCount: jest.fn().mockReturnValue(5)
            }
        };

        // Create keyboard manager
        keyboardManager = new KeyboardManager({
            stateManager: mockStateManager,
            pageManager: mockPageManager,
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

    describe('Multi-line Deletion Functionality', () => {
        test('should delete multiple selected lines when Delete key is pressed', () => {
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

            // Set selection state in keyboard manager
            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = endLine;

            // Simulate Delete key press
            const deleteEvent = new KeyboardEvent('keydown', { key: 'Delete' });
            mockEditorArea.dispatchEvent(deleteEvent);

            // Should remove selected lines
            expect(mockPageManager.operations.removeLine).toHaveBeenCalled();
        });

        test('should delete multiple consecutive lines', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const linesToDelete = [lines[1], lines[2], lines[3]];

            // Set selection to cover multiple lines
            keyboardManager.selectionStart = lines[1];
            keyboardManager.selectionEnd = lines[3];

            // Simulate deletion
            keyboardManager._handleMultiLineDeletion();

            // Should remove all selected lines
            linesToDelete.forEach(line => {
                expect(mockPageManager.operations.removeLine).toHaveBeenCalledWith(line);
            });
        });

        test('should delete lines in correct order (reverse order to maintain indices)', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const linesToDelete = [lines[1], lines[2], lines[3]];

            // Set selection
            keyboardManager.selectionStart = lines[1];
            keyboardManager.selectionEnd = lines[3];

            // Track deletion order
            const deletionOrder = [];
            mockPageManager.operations.removeLine.mockImplementation((line) => {
                deletionOrder.push(line);
            });

            // Simulate deletion
            keyboardManager._handleMultiLineDeletion();

            // Should delete in reverse order to maintain indices
            expect(deletionOrder[0]).toBe(lines[3]); // Last line first
            expect(deletionOrder[1]).toBe(lines[2]); // Middle line second
            expect(deletionOrder[2]).toBe(lines[1]); // First line last
        });

        test('should handle deletion of all lines', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const firstLine = lines[0];
            const lastLine = lines[lines.length - 1];

            // Select all lines
            keyboardManager.selectionStart = firstLine;
            keyboardManager.selectionEnd = lastLine;

            // Simulate deletion
            keyboardManager._handleMultiLineDeletion();

            // Should remove all lines
            expect(mockPageManager.operations.removeLine).toHaveBeenCalledTimes(lines.length);
        });
    });

    describe('Delete Key Handling', () => {
        test('should detect Delete key press with multi-line selection', () => {
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

            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = endLine;

            // Simulate Delete key
            const deleteEvent = new KeyboardEvent('keydown', { key: 'Delete' });
            const handleKeyDownSpy = jest.spyOn(keyboardManager, '_handleKeyDown');

            mockEditorArea.dispatchEvent(deleteEvent);

            expect(handleKeyDownSpy).toHaveBeenCalled();
        });

        test('should prevent default behavior on Delete key with multi-line selection', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = endLine;

            const deleteEvent = new KeyboardEvent('keydown', { key: 'Delete' });
            const preventDefaultSpy = jest.spyOn(deleteEvent, 'preventDefault');

            mockEditorArea.dispatchEvent(deleteEvent);

            expect(preventDefaultSpy).toHaveBeenCalled();
        });

        test('should handle Backspace key for multi-line deletion', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = endLine;

            // Simulate Backspace key
            const backspaceEvent = new KeyboardEvent('keydown', { key: 'Backspace' });
            const handleKeyDownSpy = jest.spyOn(keyboardManager, '_handleKeyDown');

            mockEditorArea.dispatchEvent(backspaceEvent);

            expect(handleKeyDownSpy).toHaveBeenCalled();
        });
    });

    describe('Selection Validation for Deletion', () => {
        test('should validate selection before deletion', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            // Valid selection
            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = endLine;

            const isValidSelection = keyboardManager._validateSelectionForDeletion();
            expect(isValidSelection).toBe(true);
        });

        test('should handle invalid selection gracefully', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const invalidEndLine = document.createElement('div'); // Not in editor

            // Invalid selection
            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = invalidEndLine;

            const isValidSelection = keyboardManager._validateSelectionForDeletion();
            expect(isValidSelection).toBe(false);
        });

        test('should handle null selection', () => {
            keyboardManager.selectionStart = null;
            keyboardManager.selectionEnd = null;

            const isValidSelection = keyboardManager._validateSelectionForDeletion();
            expect(isValidSelection).toBe(false);
        });

        test('should handle single line selection', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const singleLine = lines[2];

            // Single line selection
            keyboardManager.selectionStart = singleLine;
            keyboardManager.selectionEnd = singleLine;

            const isValidSelection = keyboardManager._validateSelectionForDeletion();
            expect(isValidSelection).toBe(true);
        });
    });

    describe('Deletion State Management', () => {
        test('should clear selection after deletion', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = endLine;

            // Simulate deletion
            keyboardManager._handleMultiLineDeletion();

            // Selection should be cleared
            expect(keyboardManager.selectionStart).toBeNull();
            expect(keyboardManager.selectionEnd).toBeNull();
        });

        test('should update line count after deletion', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = endLine;

            // Mock updated line count
            mockPageManager.operations.getLineCount.mockReturnValue(2); // After deletion

            // Simulate deletion
            keyboardManager._handleMultiLineDeletion();

            // Should update line count
            expect(mockPageManager.operations.getLineCount).toHaveBeenCalled();
        });

        test('should maintain focus after deletion', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = endLine;

            // Simulate deletion
            keyboardManager._handleMultiLineDeletion();

            // Should maintain focus on editor
            expect(document.activeElement).toBe(mockEditorArea);
        });
    });

    describe('Deletion with Different Line Types', () => {
        test('should delete lines with different formats', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const actionLine = lines[0]; // action format
            const characterLine = lines[1]; // character format
            const dialogueLine = lines[2]; // dialogue format

            keyboardManager.selectionStart = actionLine;
            keyboardManager.selectionEnd = dialogueLine;

            // Simulate deletion
            keyboardManager._handleMultiLineDeletion();

            // Should remove all selected lines regardless of format
            expect(mockPageManager.operations.removeLine).toHaveBeenCalledWith(actionLine);
            expect(mockPageManager.operations.removeLine).toHaveBeenCalledWith(characterLine);
            expect(mockPageManager.operations.removeLine).toHaveBeenCalledWith(dialogueLine);
        });

        test('should handle deletion of empty lines', () => {
            // Create empty line
            const emptyLine = document.createElement('div');
            emptyLine.className = 'script-line';
            emptyLine.setAttribute('data-format', 'action');
            emptyLine.textContent = '';
            mockEditorArea.appendChild(emptyLine);

            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[0];
            const endLine = lines[lines.length - 1]; // Empty line

            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = endLine;

            // Simulate deletion
            keyboardManager._handleMultiLineDeletion();

            // Should remove empty line
            expect(mockPageManager.operations.removeLine).toHaveBeenCalledWith(endLine);
        });

        test('should handle deletion of lines with special characters', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const specialLine = lines[2];
            specialLine.textContent = 'Line with special chars: !@#$%^&*()';

            keyboardManager.selectionStart = specialLine;
            keyboardManager.selectionEnd = specialLine;

            // Simulate deletion
            keyboardManager._handleMultiLineDeletion();

            // Should remove line with special characters
            expect(mockPageManager.operations.removeLine).toHaveBeenCalledWith(specialLine);
        });
    });

    describe('Error Handling', () => {
        test('should handle deletion errors gracefully', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = endLine;

            // Mock deletion error
            mockPageManager.operations.removeLine.mockImplementation(() => {
                throw new Error('Deletion failed');
            });

            // Should not throw error
            expect(() => {
                keyboardManager._handleMultiLineDeletion();
            }).not.toThrow();
        });

        test('should handle missing page manager gracefully', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = endLine;
            keyboardManager.pageManager = null;

            // Should not throw error
            expect(() => {
                keyboardManager._handleMultiLineDeletion();
            }).not.toThrow();
        });

        test('should handle lines that are already removed', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = endLine;

            // Remove line from DOM before deletion
            startLine.remove();

            // Should handle gracefully
            expect(() => {
                keyboardManager._handleMultiLineDeletion();
            }).not.toThrow();
        });
    });

    describe('Performance and Efficiency', () => {
        test('should handle large multi-line deletions efficiently', () => {
            // Create many lines
            for (let i = 5; i < 100; i++) {
                const line = document.createElement('div');
                line.className = 'script-line';
                line.setAttribute('data-format', 'action');
                line.textContent = `Line ${i}: Content`;
                mockEditorArea.appendChild(line);
            }

            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[10];
            const endLine = lines[50];

            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = endLine;

            const startTime = Date.now();

            // Simulate deletion
            keyboardManager._handleMultiLineDeletion();

            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(200); // Should complete within 200ms
        });

        test('should batch deletion operations for performance', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = endLine;

            // Track number of operations
            let operationCount = 0;
            mockPageManager.operations.removeLine.mockImplementation(() => {
                operationCount++;
            });

            // Simulate deletion
            keyboardManager._handleMultiLineDeletion();

            // Should perform all deletions
            expect(operationCount).toBe(3);
        });
    });

    describe('Integration with Editor Components', () => {
        test('should integrate with history manager for undo functionality', () => {
            const mockHistory = {
                saveState: jest.fn(),
                undo: jest.fn()
            };

            keyboardManager.history = mockHistory;

            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = endLine;

            // Simulate deletion
            keyboardManager._handleMultiLineDeletion();

            // Should save state for undo
            expect(mockHistory.saveState).toHaveBeenCalled();
        });

        test('should integrate with save service for auto-save', () => {
            const mockSaveService = {
                handleContentChange: jest.fn()
            };

            keyboardManager.saveService = mockSaveService;

            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = endLine;

            // Simulate deletion
            keyboardManager._handleMultiLineDeletion();

            // Should trigger auto-save
            expect(mockSaveService.handleContentChange).toHaveBeenCalled();
        });

        test('should update state manager after deletion', () => {
            const lines = mockEditorArea.querySelectorAll('.script-line');
            const startLine = lines[1];
            const endLine = lines[3];

            keyboardManager.selectionStart = startLine;
            keyboardManager.selectionEnd = endLine;

            // Simulate deletion
            keyboardManager._handleMultiLineDeletion();

            // Should update state
            expect(mockStateManager.setState).toHaveBeenCalled();
        });
    });
});
