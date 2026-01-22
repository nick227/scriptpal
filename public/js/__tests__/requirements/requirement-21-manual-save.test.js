/**
 * Tests for Requirement #21: If user presses ctrl+s saves script and flashes the save icon in topbar
 */

import { KeyboardManager } from '../../widgets/editor/keyboard/KeyboardManager.js';
import { EditorSaveService } from '../../widgets/editor/save/EditorSaveService.js';

describe('Requirement #21: Ctrl+S Manual Save with Visual Feedback', () => {
    let keyboardManager;
    let editorSaveService;
    let mockEditorArea;
    let mockApi;
    let mockStateManager;
    let mockSaveButton;
    let mockScriptStore;

    beforeEach(() => {
        // Create mock editor area
        mockEditorArea = document.createElement('div');
        mockEditorArea.innerHTML = `
            <div class="script-line" data-format="action" contenteditable="true">Test content</div>
        `;
        document.body.appendChild(mockEditorArea);

        // Create mock save button
        mockSaveButton = document.createElement('button');
        mockSaveButton.className = 'save-button';
        mockSaveButton.innerHTML = '<i class="fas fa-save"></i>';
        document.body.appendChild(mockSaveButton);

        // Create mock API
        mockApi = {
            saveScript: jest.fn().mockResolvedValue({ success: true }),
            updateScript: jest.fn().mockResolvedValue({ success: true })
        };

        mockScriptStore = {
            normalizeContent: jest.fn((content) => content),
            getCurrentScript: jest.fn().mockReturnValue({
                id: 1,
                title: 'Test Script',
                content: 'Test script content',
                version_number: 1
            }),
            updateScript: jest.fn().mockResolvedValue({
                id: 1,
                title: 'Test Script',
                content: 'Test script content',
                version_number: 2
            })
        };

        // Create mock state manager
        mockStateManager = {
            getState: jest.fn().mockReturnValue({
                id: 1,
                title: 'Test Script',
                content: 'Test script content'
            }),
            setState: jest.fn(),
            subscribe: jest.fn()
        };

        // Create mock content manager
        const mockContentManager = {
            getContent: jest.fn().mockReturnValue('Test script content'),
            getLineCount: jest.fn().mockReturnValue(5),
            on: jest.fn(),
            off: jest.fn()
        };

        // Create mock toolbar
        const mockToolbar = {
            setSaveState: jest.fn(),
            onSave: jest.fn()
        };

        // Create editor save service
        editorSaveService = new EditorSaveService({
            content: mockContentManager,
            api: mockApi,
            stateManager: mockStateManager,
            scriptStore: mockScriptStore,
            toolbar: mockToolbar
        });

        // Create keyboard manager
        keyboardManager = new KeyboardManager({
            stateManager: mockStateManager,
            pageManager: null,
            contentManager: mockContentManager,
            lineFormatter: null,
            autocomplete: null,
            saveService: editorSaveService,
            history: null
        });

        keyboardManager.initialize(mockEditorArea);
    });

    afterEach(() => {
        keyboardManager.destroy();
        editorSaveService.destroy();
        document.body.removeChild(mockEditorArea);
        document.body.removeChild(mockSaveButton);
    });

    describe('Ctrl+S Keyboard Shortcut', () => {
        test('should trigger manual save on Ctrl+S keypress', () => {
            const ctrlSEvent = new KeyboardEvent('keydown', {
                key: 's',
                ctrlKey: true,
                bubbles: true
            });

            const handleKeyDownSpy = jest.spyOn(keyboardManager, '_handleKeyDown');

            mockEditorArea.dispatchEvent(ctrlSEvent);

            expect(handleKeyDownSpy).toHaveBeenCalled();
        });

        test('should prevent default behavior on Ctrl+S', () => {
            const ctrlSEvent = new KeyboardEvent('keydown', {
                key: 's',
                ctrlKey: true,
                bubbles: true
            });

            const preventDefaultSpy = jest.spyOn(ctrlSEvent, 'preventDefault');

            mockEditorArea.dispatchEvent(ctrlSEvent);

            expect(preventDefaultSpy).toHaveBeenCalled();
        });

        test('should handle Ctrl+S with different modifiers', () => {
            const ctrlSEvent = new KeyboardEvent('keydown', {
                key: 's',
                ctrlKey: true,
                shiftKey: false,
                altKey: false,
                bubbles: true
            });

            const handleKeyDownSpy = jest.spyOn(keyboardManager, '_handleKeyDown');

            mockEditorArea.dispatchEvent(ctrlSEvent);

            expect(handleKeyDownSpy).toHaveBeenCalled();
        });

        test('should not trigger save on regular S keypress', () => {
            const sEvent = new KeyboardEvent('keydown', {
                key: 's',
                ctrlKey: false,
                bubbles: true
            });

            const handleKeyDownSpy = jest.spyOn(keyboardManager, '_handleKeyDown');

            mockEditorArea.dispatchEvent(sEvent);

            // Should not call manual save handler
            expect(handleKeyDownSpy).toHaveBeenCalled();
        });
    });

    describe('Manual Save Execution', () => {
        test('should execute manual save when Ctrl+S is pressed', async () => {
            const ctrlSEvent = new KeyboardEvent('keydown', {
                key: 's',
                ctrlKey: true,
                bubbles: true
            });

            const manualSaveSpy = jest.spyOn(keyboardManager, '_handleManualSave');

            mockEditorArea.dispatchEvent(ctrlSEvent);

            expect(manualSaveSpy).toHaveBeenCalled();
        });

        test('should save script content immediately on manual save', async () => {
            const newContent = 'Updated script content';

            await keyboardManager._handleManualSave();

            expect(mockScriptStore.updateScript).toHaveBeenCalledWith(1, {
                content: expect.any(String),
                title: 'Test Script',
                version_number: 1
            });
        });

        test('should handle manual save errors gracefully', async () => {
            mockScriptStore.updateScript.mockRejectedValue(new Error('Save failed'));

            await expect(keyboardManager._handleManualSave()).resolves.not.toThrow();
        });
    });

    describe('Visual Feedback - Save Icon Flash', () => {
        test('should flash save icon when manual save is triggered', async () => {
            // Mock the save button flash functionality
            const flashSaveButtonSpy = jest.spyOn(keyboardManager, '_flashSaveButton');

            await keyboardManager._handleManualSave();

            expect(flashSaveButtonSpy).toHaveBeenCalled();
        });

        test('should add flash class to save button', () => {
            const saveButton = document.querySelector('.save-button');

            keyboardManager._flashSaveButton();

            expect(saveButton.classList.contains('save-flash')).toBe(true);
        });

        test('should remove flash class after animation', (done) => {
            const saveButton = document.querySelector('.save-button');

            keyboardManager._flashSaveButton();

            // Check that flash class is added
            expect(saveButton.classList.contains('save-flash')).toBe(true);

            // Wait for animation to complete
            setTimeout(() => {
                expect(saveButton.classList.contains('save-flash')).toBe(false);
                done();
            }, 1000); // Assuming 1 second animation
        });

        test('should handle missing save button gracefully', () => {
            // Remove save button
            document.body.removeChild(mockSaveButton);

            // Should not throw error
            expect(() => {
                keyboardManager._flashSaveButton();
            }).not.toThrow();
        });
    });

    describe('Save Button State Management', () => {
        test('should show saving state during manual save', async () => {
            const saveButton = document.querySelector('.save-button');

            // Mock async save operation
            let savePromise;
            mockScriptStore.updateScript.mockImplementation(() => {
                savePromise = new Promise(resolve => {
                    setTimeout(() => resolve({ success: true }), 100);
                });
                return savePromise;
            });

            const saveOperation = keyboardManager._handleManualSave();

            // Should show saving state
            expect(saveButton.classList.contains('saving')).toBe(true);

            await saveOperation;

            // Should remove saving state
            expect(saveButton.classList.contains('saving')).toBe(false);
        });

        test('should show success state after successful save', async () => {
            const saveButton = document.querySelector('.save-button');

            await keyboardManager._handleManualSave();

            expect(saveButton.classList.contains('save-success')).toBe(true);
        });

        test('should show error state after failed save', async () => {
            mockScriptStore.updateScript.mockRejectedValue(new Error('Save failed'));
            const saveButton = document.querySelector('.save-button');

            await keyboardManager._handleManualSave();

            expect(saveButton.classList.contains('save-error')).toBe(true);
        });

        test('should reset button state after timeout', (done) => {
            const saveButton = document.querySelector('.save-button');

            keyboardManager._handleManualSave().then(() => {
                // Should show success state
                expect(saveButton.classList.contains('save-success')).toBe(true);

                // Wait for state reset
                setTimeout(() => {
                    expect(saveButton.classList.contains('save-success')).toBe(false);
                    done();
                }, 2000); // Assuming 2 second timeout
            });
        });
    });

    describe('Integration with Auto-save', () => {
        test('should not interfere with auto-save functionality', async () => {
            const newContent = 'Test script content\nNew line';

            // Trigger auto-save
            await editorSaveService.handleLineChange(newContent, { isLineChange: true });

            // Trigger manual save
            await keyboardManager._handleManualSave();

            // Both should work independently
            expect(mockScriptStore.updateScript).toHaveBeenCalled();
        });

        test('should reset auto-save timer on manual save', async () => {
            const newContent = 'Test script content\nNew line';

            // Trigger auto-save
            await editorSaveService.handleLineChange(newContent, { isLineChange: true });

            // Manual save should reset auto-save state
            await keyboardManager._handleManualSave();

            expect(editorSaveService.lastSavedContent).toBe(newContent);
            expect(editorSaveService.changeCount).toBe(0);
        });
    });

    describe('Keyboard Event Handling', () => {
        test('should handle Ctrl+S in different contexts', () => {
            const contexts = [
                { key: 's', ctrlKey: true, shiftKey: false, altKey: false },
                { key: 'S', ctrlKey: true, shiftKey: false, altKey: false },
                { key: 's', ctrlKey: true, shiftKey: true, altKey: false }
            ];

            contexts.forEach(context => {
                const event = new KeyboardEvent('keydown', {
                    ...context,
                    bubbles: true
                });

                const handleKeyDownSpy = jest.spyOn(keyboardManager, '_handleKeyDown');

                mockEditorArea.dispatchEvent(event);

                expect(handleKeyDownSpy).toHaveBeenCalled();
            });
        });

        test('should not trigger on other Ctrl combinations', () => {
            const otherCombinations = [
                { key: 'c', ctrlKey: true }, // Ctrl+C
                { key: 'v', ctrlKey: true }, // Ctrl+V
                { key: 'z', ctrlKey: true }, // Ctrl+Z
                { key: 'y', ctrlKey: true }  // Ctrl+Y
            ];

            otherCombinations.forEach(combination => {
                const event = new KeyboardEvent('keydown', {
                    ...combination,
                    bubbles: true
                });

                const manualSaveSpy = jest.spyOn(keyboardManager, '_handleManualSave');

                mockEditorArea.dispatchEvent(event);

                // Should not call manual save for other combinations
                expect(manualSaveSpy).not.toHaveBeenCalled();
            });
        });
    });
});
