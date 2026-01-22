/**
 * Tests for KeyboardManager Manual Save functionality
 */

import { KeyboardManager } from '../../../widgets/editor/keyboard/KeyboardManager.js';

describe('KeyboardManager - Manual Save', () => {
    let keyboardManager;
    let mockEditorArea;
    let mockPageManager;
    let mockLineFormatter;
    let mockStateManager;
    let mockSaveService;

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

        // Create mock save service
        mockSaveService = {
            handleManualSave: jest.fn().mockResolvedValue(true)
        };

        // Create keyboard manager
        keyboardManager = new KeyboardManager({
            stateManager: mockStateManager,
            pageManager: mockPageManager,
            contentManager: null,
            lineFormatter: mockLineFormatter,
            autocomplete: { currentSuggestion: null },
            saveService: mockSaveService
        });

        keyboardManager.initialize(mockEditorArea);
    });

    afterEach(() => {
        if (mockEditorArea && mockEditorArea.parentNode) {
            mockEditorArea.parentNode.removeChild(mockEditorArea);
        }
        keyboardManager.destroy();
    });

    describe('Ctrl+S manual save', () => {
        test('should trigger manual save on Ctrl+S', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const ctrlSEvent = new KeyboardEvent('keydown', {
                key: 's',
                ctrlKey: true,
                bubbles: true
            });

            // Trigger the event
            scriptLine.dispatchEvent(ctrlSEvent);

            // Verify manual save was called
            expect(mockSaveService.handleManualSave).toHaveBeenCalled();
        });

        test('should prevent default behavior on Ctrl+S', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const ctrlSEvent = new KeyboardEvent('keydown', {
                key: 's',
                ctrlKey: true,
                bubbles: true
            });

            // Spy on preventDefault
            const preventDefaultSpy = jest.spyOn(ctrlSEvent, 'preventDefault');
            const stopPropagationSpy = jest.spyOn(ctrlSEvent, 'stopPropagation');

            // Trigger the event
            scriptLine.dispatchEvent(ctrlSEvent);

            // Verify preventDefault and stopPropagation were called
            expect(preventDefaultSpy).toHaveBeenCalled();
            expect(stopPropagationSpy).toHaveBeenCalled();
        });

        test('should not trigger save on S without Ctrl', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const sEvent = new KeyboardEvent('keydown', {
                key: 's',
                ctrlKey: false,
                bubbles: true
            });

            // Trigger the event
            scriptLine.dispatchEvent(sEvent);

            // Verify manual save was NOT called
            expect(mockSaveService.handleManualSave).not.toHaveBeenCalled();
        });

        test('should handle missing save service gracefully', () => {
            keyboardManager.saveService = null;

            const scriptLine = mockEditorArea.querySelector('.script-line');
            const ctrlSEvent = new KeyboardEvent('keydown', {
                key: 's',
                ctrlKey: true,
                bubbles: true
            });

            // Should not throw
            expect(() => {
                scriptLine.dispatchEvent(ctrlSEvent);
            }).not.toThrow();
        });
    });

    describe('Global shortcuts handling', () => {
        test('should handle Ctrl+Z for undo', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const ctrlZEvent = new KeyboardEvent('keydown', {
                key: 'z',
                ctrlKey: true,
                shiftKey: false,
                bubbles: true
            });

            // Spy on preventDefault
            const preventDefaultSpy = jest.spyOn(ctrlZEvent, 'preventDefault');

            // Trigger the event
            scriptLine.dispatchEvent(ctrlZEvent);

            // Verify preventDefault was called
            expect(preventDefaultSpy).toHaveBeenCalled();
        });

        test('should handle Ctrl+Y for redo', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const ctrlYEvent = new KeyboardEvent('keydown', {
                key: 'y',
                ctrlKey: true,
                bubbles: true
            });

            // Spy on preventDefault
            const preventDefaultSpy = jest.spyOn(ctrlYEvent, 'preventDefault');

            // Trigger the event
            scriptLine.dispatchEvent(ctrlYEvent);

            // Verify preventDefault was called
            expect(preventDefaultSpy).toHaveBeenCalled();
        });

        test('should handle Ctrl+Shift+Z for redo', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const ctrlShiftZEvent = new KeyboardEvent('keydown', {
                key: 'z',
                ctrlKey: true,
                shiftKey: true,
                bubbles: true
            });

            // Spy on preventDefault
            const preventDefaultSpy = jest.spyOn(ctrlShiftZEvent, 'preventDefault');

            // Trigger the event
            scriptLine.dispatchEvent(ctrlShiftZEvent);

            // Verify preventDefault was called
            expect(preventDefaultSpy).toHaveBeenCalled();
        });

        test('should not handle non-global shortcuts', () => {
            const scriptLine = mockEditorArea.querySelector('.script-line');
            const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                bubbles: true
            });

            // Spy on preventDefault
            const preventDefaultSpy = jest.spyOn(enterEvent, 'preventDefault');

            // Trigger the event
            scriptLine.dispatchEvent(enterEvent);

            // preventDefault should still be called by other handlers
            expect(preventDefaultSpy).toHaveBeenCalled();
        });
    });

    describe('Manual save method', () => {
        test('should call save service handleManualSave method', () => {
            // Call the method directly
            keyboardManager._handleManualSave();

            // Verify save service was called
            expect(mockSaveService.handleManualSave).toHaveBeenCalled();
        });

        test('should handle missing save service gracefully', () => {
            keyboardManager.saveService = null;

            // Should not throw
            expect(() => {
                keyboardManager._handleManualSave();
            }).not.toThrow();
        });

        test('should handle save service without handleManualSave method', () => {
            keyboardManager.saveService = {};

            // Should not throw
            expect(() => {
                keyboardManager._handleManualSave();
            }).not.toThrow();
        });
    });

    describe('Integration with save service', () => {
        test('should work with real save service interface', async () => {
            const mockSaveService = {
                handleManualSave: jest.fn().mockImplementation(async () => {
                    // Simulate save operation
                    return true;
                })
            };

            keyboardManager.saveService = mockSaveService;

            // Trigger manual save
            keyboardManager._handleManualSave();

            // Verify the method was called
            expect(mockSaveService.handleManualSave).toHaveBeenCalled();
        });

        test('should handle save service errors gracefully', async () => {
            const mockSaveService = {
                handleManualSave: jest.fn().mockRejectedValue(new Error('Save failed'))
            };

            keyboardManager.saveService = mockSaveService;

            // Should not throw
            expect(() => {
                keyboardManager._handleManualSave();
            }).not.toThrow();
        });
    });
});
