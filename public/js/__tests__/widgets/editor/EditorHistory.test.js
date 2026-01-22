/**
 * Tests for EditorHistory Undo/Redo functionality
 */

import { EDITOR_EVENTS } from '../../../widgets/editor/constants.js';
import { EditorHistory } from '../../../widgets/editor/history/EditorHistory.js';

describe('EditorHistory - Undo/Redo System', () => {
    let editorHistory;
    let mockStateManager;

    beforeEach(() => {
        // Create mock state manager
        mockStateManager = {
            getCurrentState: jest.fn().mockReturnValue({
                content: 'Initial content',
                cursorPosition: 0,
                format: 'action'
            }),
            applyState: jest.fn()
        };

        // Create editor history
        editorHistory = new EditorHistory(mockStateManager);
    });

    afterEach(() => {
        editorHistory.destroy();
    });

    describe('Initialization', () => {
        test('should initialize with initial state', async () => {
            await editorHistory.initialize();

            expect(mockStateManager.getCurrentState).toHaveBeenCalled();
            expect(editorHistory.history.length).toBe(1);
            expect(editorHistory.currentIndex).toBe(0);
        });

        test('should handle missing initial state', async () => {
            mockStateManager.getCurrentState.mockReturnValue(null);

            await editorHistory.initialize();

            expect(editorHistory.history.length).toBe(0);
            expect(editorHistory.currentIndex).toBe(-1);
        });
    });

    describe('State Management', () => {
        test('should save new state', () => {
            const newState = {
                content: 'New content',
                cursorPosition: 5,
                format: 'dialog'
            };

            editorHistory.saveState(newState);

            expect(editorHistory.history.length).toBe(1);
            expect(editorHistory.currentIndex).toBe(0);
            expect(editorHistory.history[0]).toMatchObject(newState);
            expect(editorHistory.history[0].timestamp).toBeDefined();
        });

        test('should remove future states when saving new state', () => {
            // Add initial state
            editorHistory.saveState({ content: 'State 1' });
            editorHistory.saveState({ content: 'State 2' });
            editorHistory.saveState({ content: 'State 3' });

            // Go back one state
            editorHistory.undo();

            // Save new state - should remove future states
            editorHistory.saveState({ content: 'New state' });

            expect(editorHistory.history.length).toBe(3);
            expect(editorHistory.currentIndex).toBe(2);
            expect(editorHistory.history[2].content).toBe('New state');
        });

        test('should limit history size', () => {
            // Set small max history for testing
            editorHistory.maxHistory = 3;

            // Add more states than max
            editorHistory.saveState({ content: 'State 1' });
            editorHistory.saveState({ content: 'State 2' });
            editorHistory.saveState({ content: 'State 3' });
            editorHistory.saveState({ content: 'State 4' });

            expect(editorHistory.history.length).toBe(3);
            expect(editorHistory.history[0].content).toBe('State 2'); // First state removed
            expect(editorHistory.history[2].content).toBe('State 4'); // Latest state
        });
    });

    describe('Undo Functionality', () => {
        test('should undo to previous state', () => {
            const state1 = { content: 'State 1', cursorPosition: 0 };
            const state2 = { content: 'State 2', cursorPosition: 5 };

            editorHistory.saveState(state1);
            editorHistory.saveState(state2);

            const result = editorHistory.undo();

            expect(result).toBe(true);
            expect(editorHistory.currentIndex).toBe(0);
            expect(mockStateManager.applyState).toHaveBeenCalledWith(state1);
        });

        test('should not undo when at beginning', () => {
            editorHistory.saveState({ content: 'Only state' });

            const result = editorHistory.undo();

            expect(result).toBe(false);
            expect(editorHistory.currentIndex).toBe(0);
            expect(mockStateManager.applyState).not.toHaveBeenCalled();
        });

        test('should emit undo event', () => {
            const undoHandler = jest.fn();
            editorHistory.on(EDITOR_EVENTS.UNDO, undoHandler);

            editorHistory.saveState({ content: 'State 1' });
            editorHistory.saveState({ content: 'State 2' });
            editorHistory.undo();

            expect(undoHandler).toHaveBeenCalled();
        });

        test('should check if undo is possible', () => {
            expect(editorHistory.canUndo()).toBe(false);

            editorHistory.saveState({ content: 'State 1' });
            expect(editorHistory.canUndo()).toBe(false); // Only one state

            editorHistory.saveState({ content: 'State 2' });
            expect(editorHistory.canUndo()).toBe(true);
        });
    });

    describe('Redo Functionality', () => {
        test('should redo to next state', () => {
            const state1 = { content: 'State 1', cursorPosition: 0 };
            const state2 = { content: 'State 2', cursorPosition: 5 };

            editorHistory.saveState(state1);
            editorHistory.saveState(state2);
            editorHistory.undo(); // Go back to state1

            const result = editorHistory.redo();

            expect(result).toBe(true);
            expect(editorHistory.currentIndex).toBe(1);
            expect(mockStateManager.applyState).toHaveBeenCalledWith(state2);
        });

        test('should not redo when at end', () => {
            editorHistory.saveState({ content: 'Only state' });

            const result = editorHistory.redo();

            expect(result).toBe(false);
            expect(editorHistory.currentIndex).toBe(0);
            expect(mockStateManager.applyState).not.toHaveBeenCalled();
        });

        test('should emit redo event', () => {
            const redoHandler = jest.fn();
            editorHistory.on(EDITOR_EVENTS.REDO, redoHandler);

            editorHistory.saveState({ content: 'State 1' });
            editorHistory.saveState({ content: 'State 2' });
            editorHistory.undo();
            editorHistory.redo();

            expect(redoHandler).toHaveBeenCalled();
        });

        test('should check if redo is possible', () => {
            expect(editorHistory.canRedo()).toBe(false);

            editorHistory.saveState({ content: 'State 1' });
            expect(editorHistory.canRedo()).toBe(false); // Only one state

            editorHistory.saveState({ content: 'State 2' });
            expect(editorHistory.canRedo()).toBe(false); // At end

            editorHistory.undo();
            expect(editorHistory.canRedo()).toBe(true);
        });
    });

    describe('Event Handling', () => {
        test('should register event handlers', () => {
            const handler1 = jest.fn();
            const handler2 = jest.fn();

            editorHistory.on('test-event', handler1);
            editorHistory.on('test-event', handler2);

            editorHistory.emit('test-event', { data: 'test' });

            expect(handler1).toHaveBeenCalledWith({ data: 'test' });
            expect(handler2).toHaveBeenCalledWith({ data: 'test' });
        });

        test('should handle multiple event types', () => {
            const undoHandler = jest.fn();
            const redoHandler = jest.fn();

            editorHistory.on(EDITOR_EVENTS.UNDO, undoHandler);
            editorHistory.on(EDITOR_EVENTS.REDO, redoHandler);

            editorHistory.saveState({ content: 'State 1' });
            editorHistory.saveState({ content: 'State 2' });
            editorHistory.undo();
            editorHistory.redo();

            expect(undoHandler).toHaveBeenCalled();
            expect(redoHandler).toHaveBeenCalled();
        });
    });

    describe('Content Integration', () => {
        test('should set content reference', () => {
            const mockContent = { getContent: jest.fn() };

            editorHistory.setContent(mockContent);

            expect(editorHistory.content).toBe(mockContent);
        });

        test('should set state manager reference', () => {
            const newStateManager = { getCurrentState: jest.fn() };

            editorHistory.setStateManager(newStateManager);

            expect(editorHistory.stateManager).toBe(newStateManager);
        });
    });

    describe('History Management', () => {
        test('should clear history', () => {
            editorHistory.saveState({ content: 'State 1' });
            editorHistory.saveState({ content: 'State 2' });

            editorHistory.clear();

            expect(editorHistory.history.length).toBe(0);
            expect(editorHistory.currentIndex).toBe(-1);
        });

        test('should handle complex undo/redo sequence', () => {
            // Create a sequence of states
            const states = [
                { content: 'Initial', cursorPosition: 0 },
                { content: 'Added text', cursorPosition: 5 },
                { content: 'More text', cursorPosition: 10 },
                { content: 'Final text', cursorPosition: 15 }
            ];

            // Save all states
            states.forEach(state => editorHistory.saveState(state));

            // Undo twice
            editorHistory.undo();
            editorHistory.undo();

            expect(editorHistory.currentIndex).toBe(1);
            expect(mockStateManager.applyState).toHaveBeenCalledWith(states[1]);

            // Redo once
            editorHistory.redo();

            expect(editorHistory.currentIndex).toBe(2);
            expect(mockStateManager.applyState).toHaveBeenCalledWith(states[2]);

            // Save new state (should clear future)
            editorHistory.saveState({ content: 'New branch', cursorPosition: 20 });

            expect(editorHistory.history.length).toBe(4);
            expect(editorHistory.currentIndex).toBe(3);
            expect(editorHistory.canRedo()).toBe(false);
        });
    });

    describe('Error Handling', () => {
        test('should handle missing state manager in constructor', () => {
            expect(() => {
                new EditorHistory(null);
            }).toThrow('StateManager is required');
        });

        test('should handle state manager errors gracefully', () => {
            mockStateManager.applyState.mockImplementation(() => {
                throw new Error('Apply state failed');
            });

            editorHistory.saveState({ content: 'State 1' });
            editorHistory.saveState({ content: 'State 2' });

            // Should not throw
            expect(() => {
                editorHistory.undo();
            }).not.toThrow();
        });

        test('should handle missing state in history', () => {
            // Manually create invalid state
            editorHistory.history = [null];
            editorHistory.currentIndex = 0;

            const result = editorHistory.undo();

            expect(result).toBe(false);
        });
    });

    describe('Performance', () => {
        test('should handle large history efficiently', () => {
            const startTime = Date.now();

            // Add many states
            for (let i = 0; i < 1000; i++) {
                editorHistory.saveState({ content: `State ${i}`, cursorPosition: i });
            }

            const saveTime = Date.now() - startTime;

            // Should complete quickly
            expect(saveTime).toBeLessThan(1000); // Less than 1 second
            expect(editorHistory.history.length).toBe(100); // Max history size
        });

        test('should handle rapid undo/redo operations', () => {
            // Add states
            for (let i = 0; i < 10; i++) {
                editorHistory.saveState({ content: `State ${i}` });
            }

            const startTime = Date.now();

            // Rapid undo/redo
            for (let i = 0; i < 100; i++) {
                editorHistory.undo();
                editorHistory.redo();
            }

            const operationTime = Date.now() - startTime;

            // Should complete quickly
            expect(operationTime).toBeLessThan(500); // Less than 500ms
        });
    });
});
