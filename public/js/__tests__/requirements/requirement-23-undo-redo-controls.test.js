/**
 * Tests for Requirement #23: Users can undo and redo script changes
 */

import { EditorToolbar } from '../../widgets/editor/EditorToolbar.js';
import { EditorHistory } from '../../widgets/editor/history/EditorHistory.js';

describe('Requirement #23: Undo/Redo Controls', () => {
    let editorHistory;
    let editorToolbar;
    let mockStateManager;
    let mockEventManager;
    let mockContainer;

    beforeEach(() => {
        // Create mock container
        mockContainer = document.createElement('div');
        mockContainer.innerHTML = `
            <div class="editor-toolbar">
                <button class="undo-button" disabled>Undo</button>
                <button class="redo-button" disabled>Redo</button>
            </div>
        `;

        // Create mock state manager
        mockStateManager = {
            getState: jest.fn().mockReturnValue({
                currentScript: {
                    id: 1,
                    title: 'Test Script',
                    content: 'Initial content'
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

        // Create editor history
        editorHistory = new EditorHistory({
            stateManager: mockStateManager,
            eventManager: mockEventManager
        });

        // Create editor toolbar
        editorToolbar = new EditorToolbar({
            container: mockContainer,
            stateManager: mockStateManager,
            eventManager: mockEventManager
        });
    });

    afterEach(() => {
        editorHistory.destroy();
        editorToolbar.destroy();
    });

    describe('Undo Functionality', () => {
        test('should undo to previous state', () => {
            const states = [
                { content: 'Initial content' },
                { content: 'Modified content' },
                { content: 'Final content' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            const undoState = editorHistory.undo();

            expect(undoState.content).toBe('Modified content');
        });

        test('should update undo button state when undo is available', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            editorToolbar.updateHistoryState(editorHistory);

            const undoButton = mockContainer.querySelector('.undo-button');
            expect(undoButton.disabled).toBe(false);
        });

        test('should disable undo button when no previous state exists', () => {
            const state = { content: 'Only state' };
            editorHistory.saveState(state);

            editorToolbar.updateHistoryState(editorHistory);

            const undoButton = mockContainer.querySelector('.undo-button');
            expect(undoButton.disabled).toBe(true);
        });

        test('should handle undo button click', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            const undoButton = mockContainer.querySelector('.undo-button');
            undoButton.click();

            expect(editorHistory.getCurrentIndex()).toBe(0);
        });

        test('should publish undo event', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            editorHistory.undo();

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'EDITOR:UNDO',
                expect.objectContaining({
                    previousState: expect.any(Object)
                })
            );
        });
    });

    describe('Redo Functionality', () => {
        test('should redo to next state', () => {
            const states = [
                { content: 'Initial content' },
                { content: 'Modified content' },
                { content: 'Final content' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            // Undo first
            editorHistory.undo();
            editorHistory.undo();

            // Then redo
            const redoState = editorHistory.redo();

            expect(redoState.content).toBe('Modified content');
        });

        test('should update redo button state when redo is available', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' },
                { content: 'State 3' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            // Undo to make redo available
            editorHistory.undo();

            editorToolbar.updateHistoryState(editorHistory);

            const redoButton = mockContainer.querySelector('.redo-button');
            expect(redoButton.disabled).toBe(false);
        });

        test('should disable redo button when no next state exists', () => {
            const state = { content: 'Only state' };
            editorHistory.saveState(state);

            editorToolbar.updateHistoryState(editorHistory);

            const redoButton = mockContainer.querySelector('.redo-button');
            expect(redoButton.disabled).toBe(true);
        });

        test('should handle redo button click', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            // Undo first
            editorHistory.undo();

            const redoButton = mockContainer.querySelector('.redo-button');
            redoButton.click();

            expect(editorHistory.getCurrentIndex()).toBe(1);
        });

        test('should publish redo event', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            // Undo first
            editorHistory.undo();

            // Then redo
            editorHistory.redo();

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'EDITOR:REDO',
                expect.objectContaining({
                    nextState: expect.any(Object)
                })
            );
        });
    });

    describe('Button State Management', () => {
        test('should enable undo button when history exists', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            editorToolbar.updateHistoryState(editorHistory);

            const undoButton = mockContainer.querySelector('.undo-button');
            expect(undoButton.disabled).toBe(false);
        });

        test('should disable undo button when at beginning of history', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            // Undo to beginning
            editorHistory.undo();
            editorHistory.undo();

            editorToolbar.updateHistoryState(editorHistory);

            const undoButton = mockContainer.querySelector('.undo-button');
            expect(undoButton.disabled).toBe(true);
        });

        test('should enable redo button when undo has been performed', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' },
                { content: 'State 3' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            // Undo to make redo available
            editorHistory.undo();

            editorToolbar.updateHistoryState(editorHistory);

            const redoButton = mockContainer.querySelector('.redo-button');
            expect(redoButton.disabled).toBe(false);
        });

        test('should disable redo button when at end of history', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            editorToolbar.updateHistoryState(editorHistory);

            const redoButton = mockContainer.querySelector('.redo-button');
            expect(redoButton.disabled).toBe(true);
        });

        test('should update button states after new state is saved', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            // Undo to make redo available
            editorHistory.undo();
            editorToolbar.updateHistoryState(editorHistory);

            let redoButton = mockContainer.querySelector('.redo-button');
            expect(redoButton.disabled).toBe(false);

            // Save new state (should clear redo)
            editorHistory.saveState({ content: 'New state' });
            editorToolbar.updateHistoryState(editorHistory);

            redoButton = mockContainer.querySelector('.redo-button');
            expect(redoButton.disabled).toBe(true);
        });
    });

    describe('Keyboard Shortcuts', () => {
        test('should handle Ctrl+Z for undo', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            const undoSpy = jest.spyOn(editorHistory, 'undo');

            const ctrlZEvent = new KeyboardEvent('keydown', {
                key: 'z',
                ctrlKey: true,
                bubbles: true
            });
            document.dispatchEvent(ctrlZEvent);

            expect(undoSpy).toHaveBeenCalled();
        });

        test('should handle Ctrl+Y for redo', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            // Undo first
            editorHistory.undo();

            const redoSpy = jest.spyOn(editorHistory, 'redo');

            const ctrlYEvent = new KeyboardEvent('keydown', {
                key: 'y',
                ctrlKey: true,
                bubbles: true
            });
            document.dispatchEvent(ctrlYEvent);

            expect(redoSpy).toHaveBeenCalled();
        });

        test('should handle Ctrl+Shift+Z for redo (alternative)', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            // Undo first
            editorHistory.undo();

            const redoSpy = jest.spyOn(editorHistory, 'redo');

            const ctrlShiftZEvent = new KeyboardEvent('keydown', {
                key: 'z',
                ctrlKey: true,
                shiftKey: true,
                bubbles: true
            });
            document.dispatchEvent(ctrlShiftZEvent);

            expect(redoSpy).toHaveBeenCalled();
        });

        test('should prevent default behavior for undo/redo shortcuts', () => {
            const ctrlZEvent = new KeyboardEvent('keydown', {
                key: 'z',
                ctrlKey: true,
                bubbles: true
            });
            const preventDefaultSpy = jest.spyOn(ctrlZEvent, 'preventDefault');

            document.dispatchEvent(ctrlZEvent);

            expect(preventDefaultSpy).toHaveBeenCalled();
        });
    });

    describe('History Integration', () => {
        test('should integrate with editor history for state management', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            const undoState = editorHistory.undo();
            expect(undoState).toBeTruthy();
            expect(undoState.content).toBe('State 1');
        });

        test('should maintain history consistency during undo/redo', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' },
                { content: 'State 3' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            // Undo twice
            editorHistory.undo();
            editorHistory.undo();

            // Redo once
            editorHistory.redo();

            const currentState = editorHistory.getCurrentStateInfo();
            expect(currentState.content).toBe('State 2');
        });

        test('should clear redo history when new state is saved', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' },
                { content: 'State 3' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            // Undo to create redo history
            editorHistory.undo();
            editorHistory.undo();

            // Save new state (should clear redo)
            editorHistory.saveState({ content: 'New state' });

            const redoState = editorHistory.redo();
            expect(redoState).toBeNull();
        });
    });

    describe('UI Feedback', () => {
        test('should provide visual feedback for undo button', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            editorToolbar.updateHistoryState(editorHistory);

            const undoButton = mockContainer.querySelector('.undo-button');
            expect(undoButton.classList.contains('enabled')).toBe(true);
        });

        test('should provide visual feedback for redo button', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            // Undo to make redo available
            editorHistory.undo();

            editorToolbar.updateHistoryState(editorHistory);

            const redoButton = mockContainer.querySelector('.redo-button');
            expect(redoButton.classList.contains('enabled')).toBe(true);
        });

        test('should show tooltip for undo button', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            editorToolbar.updateHistoryState(editorHistory);

            const undoButton = mockContainer.querySelector('.undo-button');
            expect(undoButton.getAttribute('title')).toContain('Undo');
        });

        test('should show tooltip for redo button', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            // Undo to make redo available
            editorHistory.undo();

            editorToolbar.updateHistoryState(editorHistory);

            const redoButton = mockContainer.querySelector('.redo-button');
            expect(redoButton.getAttribute('title')).toContain('Redo');
        });
    });

    describe('Error Handling', () => {
        test('should handle undo when no history exists', () => {
            const undoState = editorHistory.undo();
            expect(undoState).toBeNull();
        });

        test('should handle redo when no redo history exists', () => {
            const redoState = editorHistory.redo();
            expect(redoState).toBeNull();
        });

        test('should handle missing history manager gracefully', () => {
            const editorToolbarWithoutHistory = new EditorToolbar({
                container: mockContainer,
                stateManager: mockStateManager,
                eventManager: mockEventManager
            });

            expect(() => {
                editorToolbarWithoutHistory.updateHistoryState(null);
            }).not.toThrow();
        });

        test('should handle missing event manager gracefully', () => {
            const editorHistoryWithoutEvents = new EditorHistory({
                stateManager: mockStateManager,
                eventManager: null
            });

            expect(() => {
                editorHistoryWithoutEvents.undo();
            }).not.toThrow();
        });
    });

    describe('Performance', () => {
        test('should handle rapid undo/redo operations efficiently', () => {
            // Create history
            for (let i = 0; i < 20; i++) {
                editorHistory.saveState({ content: `State ${i}` });
            }

            const startTime = Date.now();

            // Rapid undo/redo operations
            for (let i = 0; i < 50; i++) {
                editorHistory.undo();
                editorHistory.redo();
            }

            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(200); // Should complete within 200ms
        });

        test('should handle large history efficiently', () => {
            const startTime = Date.now();

            // Create large history
            for (let i = 0; i < 100; i++) {
                editorHistory.saveState({ content: `State ${i}` });
            }

            // Perform undo/redo operations
            editorHistory.undo();
            editorHistory.redo();

            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
        });
    });

    describe('Integration with Editor Components', () => {
        test('should integrate with keyboard manager', () => {
            const mockKeyboardManager = {
                handleUndo: jest.fn(),
                handleRedo: jest.fn()
            };

            editorToolbar.keyboardManager = mockKeyboardManager;

            const undoButton = mockContainer.querySelector('.undo-button');
            const redoButton = mockContainer.querySelector('.redo-button');

            undoButton.click();
            redoButton.click();

            expect(mockKeyboardManager.handleUndo).toHaveBeenCalled();
            expect(mockKeyboardManager.handleRedo).toHaveBeenCalled();
        });

        test('should integrate with content manager', () => {
            const mockContentManager = {
                setContent: jest.fn(),
                getContent: jest.fn().mockReturnValue('Current content')
            };

            editorToolbar.contentManager = mockContentManager;

            const states = [
                { content: 'State 1' },
                { content: 'State 2' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            editorHistory.undo();

            expect(mockContentManager.setContent).toHaveBeenCalledWith('State 1');
        });

        test('should integrate with save service', () => {
            const mockSaveService = {
                handleContentChange: jest.fn()
            };

            editorToolbar.saveService = mockSaveService;

            const states = [
                { content: 'State 1' },
                { content: 'State 2' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            editorHistory.undo();

            expect(mockSaveService.handleContentChange).toHaveBeenCalled();
        });
    });
});
