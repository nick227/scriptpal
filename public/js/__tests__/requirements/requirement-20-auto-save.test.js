/**
 * Tests for Requirement #20: The script auto-saves after every new line
 */

import { EditorSaveService } from '../../widgets/editor/save/EditorSaveService.js';

describe('Requirement #20: Auto-save After Every New Line', () => {
    let editorSaveService;
    let mockContentManager;
    let mockApi;
    let mockStateManager;
    let mockScriptStore;

    beforeEach(() => {
        // Create mock content manager
        mockContentManager = {
            getContent: jest.fn().mockReturnValue('Test script content'),
            getLineCount: jest.fn().mockReturnValue(5),
            getCurrentLine: jest.fn().mockReturnValue({
                id: 'line-1',
                textContent: 'Current line content'
            }),
            on: jest.fn(),
            off: jest.fn()
        };

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
    });

    afterEach(() => {
        editorSaveService.destroy();
    });

    describe('Line-based Auto-save', () => {
        test('should auto-save after every new line is added', async () => {
            const newContent = 'Test script content\nNew line added';

            // Simulate line change
            await editorSaveService.handleLineChange(newContent, { isLineChange: true });

            // Should schedule save with line-specific delay
            expect(editorSaveService.pendingContent).toBe(newContent);
            expect(editorSaveService.changeCount).toBe(1);
        });

        test('should use shorter delay for line-based changes', async () => {
            const newContent = 'Test script content\nAnother new line';

            await editorSaveService.handleLineChange(newContent, { isLineChange: true });

            // Should use LINE_SAVE_DELAY instead of regular SAVE_DELAY
            expect(editorSaveService.LINE_SAVE_DELAY).toBeLessThan(editorSaveService.SAVE_DELAY);
        });

        test('should trigger save after line change threshold', async () => {
            const newContent = 'Test script content\nNew line';

            // Set change count to threshold
            editorSaveService.changeCount = editorSaveService.MAX_CHANGES_BEFORE_SAVE - 1;

            await editorSaveService.handleLineChange(newContent, { isLineChange: true });

            // Should force save due to high change count
            expect(editorSaveService.changeCount).toBe(0);
        });

        test('should handle multiple line changes efficiently', async () => {
            const contents = [
                'Test script content\nLine 1',
                'Test script content\nLine 1\nLine 2',
                'Test script content\nLine 1\nLine 2\nLine 3'
            ];

            for (const content of contents) {
                await editorSaveService.handleLineChange(content, { isLineChange: true });
            }

            expect(editorSaveService.changeCount).toBe(3);
            expect(editorSaveService.pendingContent).toBe(contents[2]);
        });
    });

    describe('Auto-save Timing', () => {
        test('should debounce rapid line changes', async () => {
            const newContent = 'Test script content\nNew line';

            // Make rapid changes
            await editorSaveService.handleLineChange(newContent, { isLineChange: true });
            await editorSaveService.handleLineChange(newContent + '\nAnother line', { isLineChange: true });
            await editorSaveService.handleLineChange(newContent + '\nAnother line\nThird line', { isLineChange: true });

            // Should only have one pending save
            expect(editorSaveService.pendingContent).toBe(newContent + '\nAnother line\nThird line');
        });

        test('should respect minimum change interval', async () => {
            const newContent = 'Test script content\nNew line';

            // First change
            await editorSaveService.handleLineChange(newContent, { isLineChange: true });
            const firstChangeTime = editorSaveService.lastChangeTime;

            // Immediate second change (within MIN_CHANGE_INTERVAL)
            await editorSaveService.handleLineChange(newContent + '\nAnother line', { isLineChange: true });

            // Should not update lastChangeTime if within interval
            expect(editorSaveService.lastChangeTime).toBe(firstChangeTime);
        });

        test('should force save after maximum changes', async () => {
            const newContent = 'Test script content\nNew line';

            // Set change count to maximum
            editorSaveService.changeCount = editorSaveService.MAX_CHANGES_BEFORE_SAVE;

            await editorSaveService.handleLineChange(newContent, { isLineChange: true });

            // Should force immediate save
            expect(editorSaveService.changeCount).toBe(0);
        });
    });

    describe('Save Execution', () => {
        test('should save script content to API', async () => {
            const newContent = 'Test script content\nNew line added';

            await editorSaveService.handleLineChange(newContent, { isLineChange: true });

            // Wait for save to execute
            await new Promise(resolve => setTimeout(resolve, editorSaveService.LINE_SAVE_DELAY + 100));

            expect(mockScriptStore.updateScript).toHaveBeenCalledWith(1, {
                content: newContent,
                title: 'Test Script',
                version_number: 1
            });
        });

        test('should handle save errors gracefully', async () => {
            mockScriptStore.updateScript.mockRejectedValue(new Error('Save failed'));

            const newContent = 'Test script content\nNew line added';

            await editorSaveService.handleLineChange(newContent, { isLineChange: true });

            // Wait for save to execute
            await new Promise(resolve => setTimeout(resolve, editorSaveService.LINE_SAVE_DELAY + 100));

            // Should not crash and should handle error
            expect(editorSaveService.lastSavedContent).not.toBe(newContent);
        });

        test('should not save if content has not changed', async () => {
            const content = 'Test script content';
            editorSaveService.lastSavedContent = content;

            await editorSaveService.handleLineChange(content, { isLineChange: true });

            // Should not schedule save for unchanged content
            expect(editorSaveService.pendingContent).toBeUndefined();
        });
    });

    describe('Line Change Detection', () => {
        test('should detect when new lines are added', async () => {
            const originalContent = 'Line 1\nLine 2';
            const newContent = 'Line 1\nLine 2\nLine 3';

            mockContentManager.getContent.mockReturnValue(originalContent);
            editorSaveService.lastSavedContent = originalContent;

            await editorSaveService.handleLineChange(newContent, { isLineChange: true });

            expect(editorSaveService.pendingContent).toBe(newContent);
        });

        test('should detect when lines are modified', async () => {
            const originalContent = 'Line 1\nLine 2';
            const newContent = 'Line 1\nModified Line 2';

            mockContentManager.getContent.mockReturnValue(originalContent);
            editorSaveService.lastSavedContent = originalContent;

            await editorSaveService.handleLineChange(newContent, { isLineChange: true });

            expect(editorSaveService.pendingContent).toBe(newContent);
        });

        test('should detect when lines are deleted', async () => {
            const originalContent = 'Line 1\nLine 2\nLine 3';
            const newContent = 'Line 1\nLine 3';

            mockContentManager.getContent.mockReturnValue(originalContent);
            editorSaveService.lastSavedContent = originalContent;

            await editorSaveService.handleLineChange(newContent, { isLineChange: true });

            expect(editorSaveService.pendingContent).toBe(newContent);
        });
    });

    describe('Performance Optimization', () => {
        test('should batch multiple line changes', async () => {
            const changes = [
                'Line 1',
                'Line 1\nLine 2',
                'Line 1\nLine 2\nLine 3'
            ];

            // Make rapid changes
            for (const change of changes) {
                await editorSaveService.handleLineChange(change, { isLineChange: true });
            }

            // Should only have one pending save for the final content
            expect(editorSaveService.pendingContent).toBe(changes[2]);
        });

        test('should use appropriate delay for line changes', () => {
            expect(editorSaveService.LINE_SAVE_DELAY).toBeLessThan(editorSaveService.SAVE_DELAY);
            expect(editorSaveService.LINE_SAVE_DELAY).toBeGreaterThan(0);
        });

        test('should limit save frequency to prevent API overload', () => {
            expect(editorSaveService.MIN_CHANGE_INTERVAL).toBeGreaterThan(0);
            expect(editorSaveService.MAX_CHANGES_BEFORE_SAVE).toBeGreaterThan(0);
        });
    });

    describe('Integration with Editor', () => {
        test('should be triggered by editor line changes', async () => {
            const newContent = 'Test script content\nNew line';

            // Simulate editor triggering line change
            await editorSaveService.handleContentChange(newContent, { isLineChange: true });

            expect(editorSaveService.pendingContent).toBe(newContent);
        });

        test('should work with different line change types', async () => {
            const newContent = 'Test script content\nNew line';

            // Test different line change scenarios
            await editorSaveService.handleLineChange(newContent, { isLineChange: true });
            await editorSaveService.handleContentChange(newContent, { isLineChange: true });

            expect(editorSaveService.pendingContent).toBe(newContent);
        });
    });
});
