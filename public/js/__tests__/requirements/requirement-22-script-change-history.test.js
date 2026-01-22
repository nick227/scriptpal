/**
 * Tests for Requirement #22: The system tracks script change history
 */

import { EditorHistory } from '../../widgets/editor/history/EditorHistory.js';

describe('Requirement #22: Script Change History Tracking', () => {
    let editorHistory;
    let mockStateManager;
    let mockEventManager;

    beforeEach(() => {
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
    });

    afterEach(() => {
        editorHistory.destroy();
    });

    describe('History State Management', () => {
        test('should save initial script state', () => {
            const initialState = {
                content: 'Initial script content',
                title: 'Initial Title',
                author: 'Initial Author'
            };

            editorHistory.saveState(initialState);

            expect(editorHistory.getCurrentStateInfo()).toBeTruthy();
            expect(editorHistory.getCurrentStateInfo().content).toBe('Initial script content');
        });

        test('should track multiple script changes', () => {
            const states = [
                { content: 'Initial content', title: 'Initial Title' },
                { content: 'Modified content', title: 'Modified Title' },
                { content: 'Final content', title: 'Final Title' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            expect(editorHistory.getStats().totalStates).toBe(3);
        });

        test('should maintain chronological order of changes', () => {
            const states = [
                { content: 'State 1', timestamp: '2023-01-01T00:00:00Z' },
                { content: 'State 2', timestamp: '2023-01-01T00:01:00Z' },
                { content: 'State 3', timestamp: '2023-01-01T00:02:00Z' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            const history = editorHistory.getHistory();
            expect(history[0].content).toBe('State 1');
            expect(history[1].content).toBe('State 2');
            expect(history[2].content).toBe('State 3');
        });

        test('should assign unique IDs to each state', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' },
                { content: 'State 3' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            const history = editorHistory.getHistory();
            const ids = history.map(state => state.id);
            const uniqueIds = new Set(ids);

            expect(uniqueIds.size).toBe(3);
        });
    });

    describe('Change Detection', () => {
        test('should detect content changes', () => {
            const initialState = { content: 'Initial content' };
            editorHistory.saveState(initialState);

            const modifiedState = { content: 'Modified content' };
            const hasChanged = editorHistory.hasChanged(modifiedState);

            expect(hasChanged).toBe(true);
        });

        test('should detect title changes', () => {
            const initialState = { title: 'Initial Title' };
            editorHistory.saveState(initialState);

            const modifiedState = { title: 'Modified Title' };
            const hasChanged = editorHistory.hasChanged(modifiedState);

            expect(hasChanged).toBe(true);
        });

        test('should detect author changes', () => {
            const initialState = { author: 'Initial Author' };
            editorHistory.saveState(initialState);

            const modifiedState = { author: 'Modified Author' };
            const hasChanged = editorHistory.hasChanged(modifiedState);

            expect(hasChanged).toBe(true);
        });

        test('should not detect changes for identical states', () => {
            const state = { content: 'Same content', title: 'Same Title' };
            editorHistory.saveState(state);

            const identicalState = { content: 'Same content', title: 'Same Title' };
            const hasChanged = editorHistory.hasChanged(identicalState);

            expect(hasChanged).toBe(false);
        });

        test('should detect partial changes', () => {
            const initialState = {
                content: 'Initial content',
                title: 'Initial Title',
                author: 'Initial Author'
            };
            editorHistory.saveState(initialState);

            const partiallyModifiedState = {
                content: 'Modified content',
                title: 'Initial Title',
                author: 'Initial Author'
            };
            const hasChanged = editorHistory.hasChanged(partiallyModifiedState);

            expect(hasChanged).toBe(true);
        });
    });

    describe('History Navigation', () => {
        test('should navigate to previous state', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' },
                { content: 'State 3' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            const previousState = editorHistory.goToPrevious();

            expect(previousState.content).toBe('State 2');
        });

        test('should navigate to next state', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' },
                { content: 'State 3' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            // Go back first
            editorHistory.goToPrevious();
            editorHistory.goToPrevious();

            // Then go forward
            const nextState = editorHistory.goToNext();

            expect(nextState.content).toBe('State 2');
        });

        test('should return null when no previous state exists', () => {
            const state = { content: 'Only state' };
            editorHistory.saveState(state);

            const previousState = editorHistory.goToPrevious();

            expect(previousState).toBeNull();
        });

        test('should return null when no next state exists', () => {
            const state = { content: 'Only state' };
            editorHistory.saveState(state);

            const nextState = editorHistory.goToNext();

            expect(nextState).toBeNull();
        });

        test('should maintain current position during navigation', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' },
                { content: 'State 3' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            // Navigate back
            editorHistory.goToPrevious();
            expect(editorHistory.getCurrentIndex()).toBe(1);

            // Navigate forward
            editorHistory.goToNext();
            expect(editorHistory.getCurrentIndex()).toBe(2);
        });
    });

    describe('History Statistics', () => {
        test('should track total number of states', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' },
                { content: 'State 3' },
                { content: 'State 4' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            const stats = editorHistory.getStats();
            expect(stats.totalStates).toBe(4);
        });

        test('should track current state index', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' },
                { content: 'State 3' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            const stats = editorHistory.getStats();
            expect(stats.currentIndex).toBe(2); // Last state (0-indexed)
        });

        test('should track undo count', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' },
                { content: 'State 3' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            // Undo twice
            editorHistory.goToPrevious();
            editorHistory.goToPrevious();

            const stats = editorHistory.getStats();
            expect(stats.undoCount).toBe(2);
        });

        test('should track redo count', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' },
                { content: 'State 3' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            // Undo then redo
            editorHistory.goToPrevious();
            editorHistory.goToNext();

            const stats = editorHistory.getStats();
            expect(stats.redoCount).toBe(1);
        });

        test('should track session duration', () => {
            const startTime = Date.now();

            const state = { content: 'Test state' };
            editorHistory.saveState(state);

            const stats = editorHistory.getStats();
            expect(stats.sessionDuration).toBeGreaterThanOrEqual(0);
        });
    });

    describe('History Persistence', () => {
        test('should save history to localStorage', () => {
            const state = { content: 'Persistent state' };
            editorHistory.saveState(state);

            editorHistory.saveToStorage();

            const savedData = localStorage.getItem('scriptpal_editor_history');
            expect(savedData).toBeTruthy();
            expect(JSON.parse(savedData)).toHaveProperty('states');
        });

        test('should load history from localStorage', () => {
            const historyData = {
                states: [
                    { id: '1', content: 'Loaded state 1', timestamp: '2023-01-01T00:00:00Z' },
                    { id: '2', content: 'Loaded state 2', timestamp: '2023-01-01T00:01:00Z' }
                ],
                currentIndex: 1
            };

            const storage = localStorage;
            storage.setItem('scriptpal_editor_history', JSON.stringify(historyData));

            editorHistory.loadFromStorage();

            const stats = editorHistory.getStats();
            expect(stats.totalStates).toBe(2);
            expect(stats.currentIndex).toBe(1);
        });

        test('should handle corrupted localStorage data gracefully', () => {
            const storage = localStorage;
            storage.setItem('scriptpal_editor_history', 'corrupted data');

            expect(() => {
                editorHistory.loadFromStorage();
            }).not.toThrow();
        });

        test('should handle missing localStorage data gracefully', () => {
            localStorage.removeItem('scriptpal_editor_history');

            expect(() => {
                editorHistory.loadFromStorage();
            }).not.toThrow();
        });
    });

    describe('History Events', () => {
        test('should publish state saved event', () => {
            const state = { content: 'Event test state' };
            editorHistory.saveState(state);

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'EDITOR:HISTORY_STATE_SAVED',
                expect.objectContaining({
                    state: expect.objectContaining({
                        content: 'Event test state'
                    })
                })
            );
        });

        test('should publish navigation event', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            editorHistory.goToPrevious();

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'EDITOR:HISTORY_NAVIGATED',
                expect.objectContaining({
                    direction: 'previous',
                    currentIndex: 0
                })
            );
        });

        test('should publish history cleared event', () => {
            const state = { content: 'State to clear' };
            editorHistory.saveState(state);

            editorHistory.clearHistory();

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'EDITOR:HISTORY_CLEARED',
                expect.any(Object)
            );
        });
    });

    describe('History Limits', () => {
        test('should limit history size to prevent memory issues', () => {
            // Create many states
            for (let i = 0; i < 1000; i++) {
                editorHistory.saveState({ content: `State ${i}` });
            }

            const stats = editorHistory.getStats();
            expect(stats.totalStates).toBeLessThanOrEqual(100); // Should be limited
        });

        test('should remove oldest states when limit is reached', () => {
            // Set small limit for testing
            editorHistory.maxHistorySize = 3;

            const states = [
                { content: 'State 1' },
                { content: 'State 2' },
                { content: 'State 3' },
                { content: 'State 4' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            const history = editorHistory.getHistory();
            expect(history.length).toBe(3);
            expect(history[0].content).toBe('State 2'); // State 1 should be removed
        });

        test('should maintain current position when removing old states', () => {
            editorHistory.maxHistorySize = 3;

            const states = [
                { content: 'State 1' },
                { content: 'State 2' },
                { content: 'State 3' },
                { content: 'State 4' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            const stats = editorHistory.getStats();
            expect(stats.currentIndex).toBe(2); // Should be at last state
        });
    });

    describe('Error Handling', () => {
        test('should handle null state gracefully', () => {
            expect(() => {
                editorHistory.saveState(null);
            }).not.toThrow();
        });

        test('should handle undefined state gracefully', () => {
            expect(() => {
                editorHistory.saveState(undefined);
            }).not.toThrow();
        });

        test('should handle missing state manager gracefully', () => {
            const editorHistoryWithoutState = new EditorHistory({
                stateManager: null,
                eventManager: mockEventManager
            });

            expect(() => {
                editorHistoryWithoutState.saveState({ content: 'Test' });
            }).not.toThrow();
        });

        test('should handle missing event manager gracefully', () => {
            const editorHistoryWithoutEvents = new EditorHistory({
                stateManager: mockStateManager,
                eventManager: null
            });

            expect(() => {
                editorHistoryWithoutEvents.saveState({ content: 'Test' });
            }).not.toThrow();
        });
    });

    describe('Performance', () => {
        test('should handle large history efficiently', () => {
            const startTime = Date.now();

            // Create large history
            for (let i = 0; i < 100; i++) {
                editorHistory.saveState({ content: `State ${i}` });
            }

            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
        });

        test('should handle rapid state changes efficiently', () => {
            const startTime = Date.now();

            // Rapid state changes
            for (let i = 0; i < 50; i++) {
                editorHistory.saveState({ content: `Rapid state ${i}` });
            }

            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
        });

        test('should handle frequent navigation efficiently', () => {
            // Create history
            for (let i = 0; i < 20; i++) {
                editorHistory.saveState({ content: `State ${i}` });
            }

            const startTime = Date.now();

            // Rapid navigation
            for (let i = 0; i < 50; i++) {
                editorHistory.goToPrevious();
                editorHistory.goToNext();
            }

            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(200); // Should complete within 200ms
        });
    });

    describe('Integration with Editor', () => {
        test('should integrate with state manager', () => {
            const state = { content: 'Integration test' };
            editorHistory.saveState(state);

            expect(mockStateManager.setState).toHaveBeenCalledWith(
                'EDITOR_HISTORY',
                expect.any(Object)
            );
        });

        test('should integrate with event system', () => {
            const state = { content: 'Event integration test' };
            editorHistory.saveState(state);

            expect(mockEventManager.publish).toHaveBeenCalled();
        });

        test('should work with undo/redo functionality', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' },
                { content: 'State 3' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            // Test undo
            const undoState = editorHistory.undo();
            expect(undoState.content).toBe('State 2');

            // Test redo
            const redoState = editorHistory.redo();
            expect(redoState.content).toBe('State 3');
        });
    });
});
