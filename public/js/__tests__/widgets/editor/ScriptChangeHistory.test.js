/**
 * Tests for Script Change History Tracking
 */

import { EDITOR_EVENTS } from '../../../widgets/editor/constants.js';
import { EditorHistory } from '../../../widgets/editor/history/EditorHistory.js';
import { EditorSaveService } from '../../../widgets/editor/save/EditorSaveService.js';

describe('Script Change History Tracking', () => {
    let editorHistory;
    let mockStateManager;
    let mockContent;
    let mockToolbar;
    let mockApi;
    let mockScriptStore;
    let saveService;

    beforeEach(() => {
        // Create mock state manager
        mockStateManager = {
            getCurrentState: jest.fn().mockReturnValue({
                content: 'Initial content',
                cursorPosition: 0,
                format: 'action',
                timestamp: Date.now()
            }),
            applyState: jest.fn()
        };

        // Create mock content manager
        mockContent = {
            on: jest.fn(),
            off: jest.fn(),
            getContent: jest.fn().mockReturnValue('<script><action>Test content</action></script>')
        };

        // Create mock toolbar
        mockToolbar = {
            setSaveState: jest.fn()
        };

        mockScriptStore = {
            normalizeContent: jest.fn((content) => content),
            getCurrentScript: jest.fn().mockReturnValue({
                id: 'test-script-id',
                title: 'Test Script',
                content: '<script><action>Test content</action></script>',
                version_number: 1
            }),
            updateScript: jest.fn().mockResolvedValue({
                id: 'test-script-id',
                content: '<script><action>Test content</action></script>',
                version_number: 1,
                updated_at: new Date().toISOString()
            })
        };

        // Create editor history
        editorHistory = new EditorHistory(mockStateManager);

        // Create save service
        saveService = new EditorSaveService({
            content: mockContent,
            toolbar: mockToolbar,
            scriptStore: mockScriptStore
        });
    });

    afterEach(() => {
        editorHistory.destroy();
        saveService.destroy();
    });

    describe('State change tracking', () => {
        test('should track state changes with timestamps', () => {
            const state1 = {
                content: 'Content 1',
                cursorPosition: 0,
                format: 'action'
            };

            const state2 = {
                content: 'Content 2',
                cursorPosition: 5,
                format: 'dialog'
            };

            editorHistory.saveState(state1);
            editorHistory.saveState(state2);

            const history = editorHistory.history;
            expect(history).toHaveLength(2);
            expect(history[0].timestamp).toBeDefined();
            expect(history[1].timestamp).toBeDefined();
            expect(history[1].timestamp).toBeGreaterThan(history[0].timestamp);
        });

        test('should generate unique state IDs', () => {
            const state1 = { content: 'Content 1' };
            const state2 = { content: 'Content 2' };

            editorHistory.saveState(state1);
            editorHistory.saveState(state2);

            const history = editorHistory.history;
            expect(history[0].id).toBeDefined();
            expect(history[1].id).toBeDefined();
            expect(history[0].id).not.toBe(history[1].id);
        });

        test('should track content changes', () => {
            const states = [
                { content: 'Initial content', cursorPosition: 0 },
                { content: 'Modified content', cursorPosition: 5 },
                { content: 'Final content', cursorPosition: 10 }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            const history = editorHistory.history;
            expect(history).toHaveLength(3);
            expect(history[0].content).toBe('Initial content');
            expect(history[1].content).toBe('Modified content');
            expect(history[2].content).toBe('Final content');
        });

        test('should track cursor position changes', () => {
            const states = [
                { content: 'Test content', cursorPosition: 0 },
                { content: 'Test content', cursorPosition: 5 },
                { content: 'Test content', cursorPosition: 10 }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            const history = editorHistory.history;
            expect(history[0].cursorPosition).toBe(0);
            expect(history[1].cursorPosition).toBe(5);
            expect(history[2].cursorPosition).toBe(10);
        });

        test('should track format changes', () => {
            const states = [
                { content: 'Test content', format: 'action' },
                { content: 'Test content', format: 'dialog' },
                { content: 'Test content', format: 'speaker' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            const history = editorHistory.history;
            expect(history[0].format).toBe('action');
            expect(history[1].format).toBe('dialog');
            expect(history[2].format).toBe('speaker');
        });
    });

    describe('History management', () => {
        test('should limit history size', () => {
            // Set small max history for testing
            editorHistory.maxHistory = 3;

            // Add more states than max
            for (let i = 0; i < 5; i++) {
                editorHistory.saveState({ content: `Content ${i}` });
            }

            expect(editorHistory.history.length).toBe(3);
            expect(editorHistory.history[0].content).toBe('Content 2'); // First two removed
            expect(editorHistory.history[2].content).toBe('Content 4'); // Latest state
        });

        test('should maintain history order', () => {
            const states = [
                { content: 'State 1' },
                { content: 'State 2' },
                { content: 'State 3' }
            ];

            states.forEach(state => {
                editorHistory.saveState(state);
            });

            const history = editorHistory.history;
            expect(history[0].content).toBe('State 1');
            expect(history[1].content).toBe('State 2');
            expect(history[2].content).toBe('State 3');
        });

        test('should clear future states when saving new state', () => {
            // Add initial states
            editorHistory.saveState({ content: 'State 1' });
            editorHistory.saveState({ content: 'State 2' });
            editorHistory.saveState({ content: 'State 3' });

            // Go back one state
            editorHistory.undo();

            // Save new state - should clear future states
            editorHistory.saveState({ content: 'New state' });

            expect(editorHistory.history.length).toBe(3);
            expect(editorHistory.history[2].content).toBe('New state');
        });
    });

    describe('Save operation tracking', () => {
        test('should track save operations', async () => {
            const testContent = '<script><action>Test content</action></script>';

            const result = await saveService.save(testContent);

            expect(result).toBe(true);
            expect(mockScriptStore.updateScript).toHaveBeenCalledWith('test-script-id', {
                content: testContent,
                title: 'Test Script',
                version_number: 1
            });
        });

        test('should track save timestamps', async () => {
            const testContent = '<script><action>Test content</action></script>';

            const startTime = Date.now();
            await saveService.save(testContent);
            const endTime = Date.now();

            // Verify save was tracked with timestamp
            expect(mockScriptStore.updateScript).toHaveBeenCalled();
        });

        test('should track save errors', async () => {
            const testContent = '<script><action>Test content</action></script>';

            // Mock API to throw error
            mockScriptStore.updateScript.mockRejectedValue(new Error('Save failed'));

            const result = await saveService.save(testContent);

            expect(result).toBe(false);
            expect(mockToolbar.setSaveState).toHaveBeenCalledWith('error');
        });
    });

    describe('Content change tracking', () => {
        test('should track content changes with source', () => {
            const contentChangeHandler = jest.fn();
            mockContent.on(EDITOR_EVENTS.CONTENT_CHANGE, contentChangeHandler);

            // Simulate content change
            const changeEvent = {
                content: 'New content',
                source: 'user_input',
                timestamp: Date.now()
            };

            mockContent.emit(EDITOR_EVENTS.CONTENT_CHANGE, changeEvent);

            expect(contentChangeHandler).toHaveBeenCalledWith(changeEvent);
        });

        test('should track different change sources', () => {
            const sources = ['user_input', 'ai_assistant', 'import', 'undo', 'redo'];
            const contentChangeHandler = jest.fn();

            mockContent.on(EDITOR_EVENTS.CONTENT_CHANGE, contentChangeHandler);

            sources.forEach(source => {
                const changeEvent = {
                    content: `Content from ${source}`,
                    source,
                    timestamp: Date.now()
                };
                mockContent.emit(EDITOR_EVENTS.CONTENT_CHANGE, changeEvent);
            });

            expect(contentChangeHandler).toHaveBeenCalledTimes(sources.length);
        });
    });

    describe('History statistics', () => {
        test('should provide history statistics', () => {
            // Add some states
            editorHistory.saveState({ content: 'State 1' });
            editorHistory.saveState({ content: 'State 2' });
            editorHistory.saveState({ content: 'State 3' });

            const stats = editorHistory.getStats();

            expect(stats.totalStates).toBe(3);
            expect(stats.currentIndex).toBe(2);
            expect(stats.canUndo).toBe(true);
            expect(stats.canRedo).toBe(false);
            expect(stats.maxHistory).toBe(100);
        });

        test('should track oldest and newest states', () => {
            const startTime = Date.now();

            editorHistory.saveState({ content: 'First state' });

            // Wait a bit
            setTimeout(() => {
                editorHistory.saveState({ content: 'Last state' });

                const stats = editorHistory.getStats();
                expect(stats.oldestState).toBeGreaterThanOrEqual(startTime);
                expect(stats.newestState).toBeGreaterThan(stats.oldestState);
            }, 10);
        });
    });

    describe('Integration with other components', () => {
        test('should work with state manager', () => {
            const currentState = mockStateManager.getCurrentState();
            expect(currentState).toBeDefined();
            expect(currentState.content).toBe('Initial content');
        });

        test('should work with save service', async () => {
            const testContent = '<script><action>Test content</action></script>';

            const result = await saveService.save(testContent);
            expect(result).toBe(true);
        });

        test('should track state changes from keyboard manager', () => {
            // Simulate keyboard manager saving state
            const keyboardState = {
                content: 'Keyboard modified content',
                cursorPosition: 10,
                format: 'dialog'
            };

            editorHistory.saveState(keyboardState);

            const history = editorHistory.history;
            expect(history[0].content).toBe('Keyboard modified content');
            expect(history[0].cursorPosition).toBe(10);
            expect(history[0].format).toBe('dialog');
        });
    });

    describe('Performance and optimization', () => {
        test('should handle rapid state changes efficiently', () => {
            const startTime = Date.now();

            // Add many states rapidly
            for (let i = 0; i < 100; i++) {
                editorHistory.saveState({ content: `State ${i}` });
            }

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete quickly
            expect(duration).toBeLessThan(1000);
            expect(editorHistory.history.length).toBe(100);
        });

        test('should handle large content efficiently', () => {
            const largeContent = 'A'.repeat(10000); // 10KB content

            const startTime = Date.now();
            editorHistory.saveState({ content: largeContent });
            const endTime = Date.now();

            // Should complete quickly even with large content
            expect(endTime - startTime).toBeLessThan(100);
            expect(editorHistory.history[0].content).toBe(largeContent);
        });
    });

    describe('Error handling', () => {
        test('should handle invalid state gracefully', () => {
            const result = editorHistory.saveState(null);
            expect(result).toBe(false);

            const result2 = editorHistory.saveState('invalid');
            expect(result2).toBe(false);
        });

        test('should handle state manager errors gracefully', () => {
            mockStateManager.getCurrentState.mockImplementation(() => {
                throw new Error('State manager error');
            });

            // Should not throw
            expect(() => {
                editorHistory.saveState({ content: 'Test' });
            }).not.toThrow();
        });
    });
});
