/**
 * Tests for EditorSaveService Auto-save functionality
 */

import { EDITOR_EVENTS } from '../../../widgets/editor/constants.js';
import { EditorSaveService } from '../../../widgets/editor/save/EditorSaveService.js';

describe('EditorSaveService - Auto-save', () => {
    let saveService;
    let mockContent;
    let mockToolbar;
    let mockScriptStore;

    beforeEach(() => {
        // Create mock content manager
        mockContent = {
            on: jest.fn(),
            off: jest.fn(),
            getContent: jest.fn().mockReturnValue('<script><action>Test content</action></script>')
        };

        // Create mock toolbar
        mockToolbar = {
            setSaveState: jest.fn(),
            onSave: jest.fn()
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

        // Create save service
        saveService = new EditorSaveService({
            content: mockContent,
            toolbar: mockToolbar,
            scriptStore: mockScriptStore
        });
    });

    afterEach(() => {
        saveService.destroy();
    });

    describe('Auto-save triggering', () => {
        test('should trigger auto-save on content change', (done) => {
            const testContent = '<script><action>New content</action></script>';

            // Mock the save method to resolve after a delay
            const originalSave = saveService.save;
            saveService.save = jest.fn().mockImplementation(async (content) => {
                expect(content).toBe(testContent);
                return true;
            });

            // Trigger content change
            saveService.handleContentChange(testContent);

            // Wait for the debounced save to trigger
            setTimeout(() => {
                expect(saveService.save).toHaveBeenCalledWith(testContent);
                done();
            }, 2500); // Wait longer than SAVE_DELAY (2000ms)
        });

        test('should not save if content is unchanged', () => {
            const testContent = '<script><action>Test content</action></script>';

            // Set last saved content
            saveService.setLastSavedContent(testContent);

            // Mock save method
            const saveSpy = jest.spyOn(saveService, 'save');

            // Trigger content change with same content
            saveService.handleContentChange(testContent);

            // Should not trigger save
            expect(saveSpy).not.toHaveBeenCalled();
        });

        test('should force save after maximum changes', () => {
            const testContent = '<script><action>Test content</action></script>';

            // Mock save method
            const saveSpy = jest.spyOn(saveService, 'save').mockResolvedValue(true);

            // Trigger multiple content changes
            for (let i = 0; i < 11; i++) { // MAX_CHANGES_BEFORE_SAVE is 10
                saveService.handleContentChange(testContent + i);
            }

            // Should trigger immediate save
            expect(saveSpy).toHaveBeenCalled();
        });

        test('should save on focus out with pending changes', () => {
            const testContent = '<script><action>Test content</action></script>';

            // Mock save method
            const saveSpy = jest.spyOn(saveService, 'save').mockResolvedValue(true);

            // Set pending content
            saveService.pendingContent = testContent;
            saveService.lastSavedContent = 'different content';

            // Trigger focus out
            saveService.handleFocusOut();

            // Should trigger immediate save
            expect(saveSpy).toHaveBeenCalledWith(testContent);
        });
    });

    describe('Save functionality', () => {
        test('should save content successfully', async () => {
            const testContent = '<script><action>Test content</action></script>';

            const result = await saveService.save(testContent);

            expect(result).toBe(true);
            expect(mockScriptStore.updateScript).toHaveBeenCalledWith('test-script-id', {
                content: testContent,
                title: 'Test Script',
                version_number: 1
            });
            expect(mockToolbar.setSaveState).toHaveBeenCalledWith('saved');
        });

        test('should handle save errors gracefully', async () => {
            const testContent = '<script><action>Test content</action></script>';

            // Mock API to throw error
            mockScriptStore.updateScript.mockRejectedValue(new Error('Save failed'));

            const result = await saveService.save(testContent);

            expect(result).toBe(false);
            expect(mockToolbar.setSaveState).toHaveBeenCalledWith('error');
        });

        test('should validate content before saving', async () => {
            const invalidContent = '<foo>invalid</foo>';

            const result = await saveService.save(invalidContent);

            expect(result).toBe(false);
            expect(mockScriptStore.updateScript).not.toHaveBeenCalled();
            expect(mockToolbar.setSaveState).toHaveBeenCalledWith('error');
        });

        test('should not save empty content', async () => {
            const result = await saveService.save('');

            expect(result).toBe(false);
            expect(mockScriptStore.updateScript).not.toHaveBeenCalled();
        });

        test('should not save if already saving', async () => {
            const testContent = '<script><action>Test content</action></script>';

            // Set saving state
            saveService.isSaving = true;

            const result = await saveService.save(testContent);

            expect(result).toBe(false);
            expect(mockScriptStore.updateScript).not.toHaveBeenCalled();
        });
    });

    describe('Manual save', () => {
        test('should handle manual save', async () => {
            const testContent = '<script><action>Test content</action></script>';

            // Mock getContent to return different content
            mockContent.getContent.mockReturnValue(testContent);
            saveService.lastSavedContent = 'different content';

            const result = await saveService.handleManualSave();

            expect(result).toBe(true);
            expect(mockScriptStore.updateScript).toHaveBeenCalledWith('test-script-id', {
                content: testContent,
                title: 'Test Script',
                version_number: 1
            });
        });

        test('should not save if no changes', async () => {
            const testContent = '<script><action>Test content</action></script>';

            // Mock getContent to return same content
            mockContent.getContent.mockReturnValue(testContent);
            saveService.lastSavedContent = testContent;

            const result = await saveService.handleManualSave();

            expect(result).toBe(true);
            expect(mockScriptStore.updateScript).not.toHaveBeenCalled();
        });
    });

    describe('Content validation', () => {
        test('should validate content with script tags', () => {
            const validContent = '<script><action>Test content</action></script>';

            const result = saveService.validateContent(validContent);

            expect(result).toBe(true);
        });

        test('should validate content without script tags by adding them', () => {
            const contentWithoutTags = '<action>Test content</action>';

            const result = saveService.validateContent(contentWithoutTags);

            expect(result).toBe(true);
        });

        test('should reject invalid content', () => {
            const invalidContent = '<foo>invalid</foo>';

            const result = saveService.validateContent(invalidContent);

            expect(result).toBe(false);
        });

        test('should reject non-string content', () => {
            const result = saveService.validateContent(null);

            expect(result).toBe(false);
        });
    });

    describe('Debouncing', () => {
        test('should debounce multiple rapid changes', (done) => {
            const testContent = '<script><action>Test content</action></script>';

            // Mock save method
            const saveSpy = jest.spyOn(saveService, 'save').mockResolvedValue(true);

            // Trigger multiple rapid changes
            saveService.handleContentChange(testContent + '1');
            saveService.handleContentChange(testContent + '2');
            saveService.handleContentChange(testContent + '3');

            // Should only save once after debounce
            setTimeout(() => {
                expect(saveSpy).toHaveBeenCalledTimes(1);
                done();
            }, 2500);
        });

        test('should respect minimum change interval', () => {
            const testContent = '<script><action>Test content</action></script>';

            // Mock save method
            const saveSpy = jest.spyOn(saveService, 'save').mockResolvedValue(true);

            // Trigger changes within minimum interval
            saveService.handleContentChange(testContent + '1');
            saveService.handleContentChange(testContent + '2');

            // Should not trigger save yet
            expect(saveSpy).not.toHaveBeenCalled();
        });
    });

    describe('Error handling', () => {
        test('should handle missing script ID', async () => {
            mockScriptStore.getCurrentScript.mockReturnValue(null);

            const testContent = '<script><action>Test content</action></script>';
            const result = await saveService.save(testContent);

            expect(result).toBe(false);
            expect(mockScriptStore.updateScript).not.toHaveBeenCalled();
        });

        test('should handle API errors', async () => {
            const testContent = '<script><action>Test content</action></script>';

            // Mock store to return invalid response
            mockScriptStore.updateScript.mockResolvedValue(null);

            const result = await saveService.save(testContent);

            expect(result).toBe(false);
            expect(mockToolbar.setSaveState).toHaveBeenCalledWith('error');
        });
    });
});
