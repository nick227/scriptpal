/**
 * Tests for Requirement #5: AI can change and replace sections of script
 */

import { AICommandManager } from '../../widgets/editor/ai/AICommandManager.js';

describe('Requirement #5: AI Change and Replace Sections', () => {
    let aiCommandManager;
    let mockStateManager;
    let mockContentManager;

    beforeEach(() => {
        // Create mock state manager
        mockStateManager = {
            getState: jest.fn().mockReturnValue({
                id: 1,
                title: 'Test Script',
                content: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5'
            }),
            setState: jest.fn(),
            subscribe: jest.fn()
        };

        // Create mock content manager
        mockContentManager = {
            getContent: jest.fn().mockReturnValue('Line 1\nLine 2\nLine 3\nLine 4\nLine 5'),
            getLine: jest.fn().mockReturnValue({
                id: 'line-1',
                textContent: 'Line 1',
                setAttribute: jest.fn(),
                getAttribute: jest.fn().mockReturnValue('action')
            }),
            updateLine: jest.fn(),
            replaceContent: jest.fn(),
            insertContentAt: jest.fn(),
            appendContent: jest.fn(),
            prependContent: jest.fn()
        };

        // Create AI command manager
        aiCommandManager = new AICommandManager(mockStateManager);
        aiCommandManager.content = mockContentManager;
    });

    afterEach(() => {
        aiCommandManager.destroy();
    });

    describe('Replace Range Command', () => {
        test('should replace single line with new content', async () => {
            const commandData = {
                startLine: 2,
                endLine: 2,
                content: 'New line content',
                format: 'dialogue'
            };

            const result = await aiCommandManager.handleReplaceRangeCommand(commandData);

            expect(result.success).toBe(true);
            expect(mockContentManager.replaceContent).toHaveBeenCalledWith(
                commandData.startLine,
                commandData.endLine,
                commandData.content,
                commandData.format
            );
        });

        test('should replace multiple lines with new content', async () => {
            const commandData = {
                startLine: 2,
                endLine: 4,
                content: 'New multi-line content\nLine 2\nLine 3',
                format: 'action'
            };

            const result = await aiCommandManager.handleReplaceRangeCommand(commandData);

            expect(result.success).toBe(true);
            expect(mockContentManager.replaceContent).toHaveBeenCalledWith(
                commandData.startLine,
                commandData.endLine,
                commandData.content,
                commandData.format
            );
        });

        test('should handle replace command with proper validation', async () => {
            const commandData = {
                startLine: 1,
                endLine: 3,
                content: 'Replaced content',
                format: 'character'
            };

            const result = await aiCommandManager.handleReplaceRangeCommand(commandData);

            expect(result.success).toBe(true);
            expect(result.startLine).toBe(commandData.startLine);
            expect(result.endLine).toBe(commandData.endLine);
        });

        test('should validate line numbers for replace operations', async () => {
            const commandData = {
                startLine: 0, // Invalid line number
                endLine: 2,
                content: 'Test content',
                format: 'action'
            };

            await expect(aiCommandManager.handleReplaceRangeCommand(commandData))
                .rejects.toThrow('Invalid line numbers');
        });

        test('should handle replace operations with different formats', async () => {
            const formats = ['action', 'character', 'dialogue', 'parenthetical', 'transition'];

            for (const format of formats) {
                const commandData = {
                    startLine: 2,
                    endLine: 2,
                    content: `Content in ${format} format`,
                    format: format
                };

                const result = await aiCommandManager.handleReplaceRangeCommand(commandData);
                expect(result.success).toBe(true);
            }
        });
    });

    describe('Edit Command', () => {
        test('should edit specific line content', async () => {
            const commandData = {
                lineId: 'line-1',
                text: 'Edited line content'
            };

            const result = await aiCommandManager.handleEditCommand(commandData);

            expect(result.success).toBe(true);
            expect(mockContentManager.getLine).toHaveBeenCalledWith(commandData.lineId);
            expect(mockContentManager.updateLine).toHaveBeenCalled();
        });

        test('should handle edit command with line ID validation', async () => {
            const commandData = {
                lineId: 'invalid-line-id',
                text: 'Test content'
            };

            mockContentManager.getLine.mockReturnValue(null);

            await expect(aiCommandManager.handleEditCommand(commandData))
                .rejects.toThrow('Line not found');
        });

        test('should update line content and maintain format', async () => {
            const commandData = {
                lineId: 'line-1',
                text: 'New line content'
            };

            const mockLine = {
                id: 'line-1',
                textContent: 'Old content',
                setAttribute: jest.fn(),
                getAttribute: jest.fn().mockReturnValue('action')
            };

            mockContentManager.getLine.mockReturnValue(mockLine);

            const result = await aiCommandManager.handleEditCommand(commandData);

            expect(result.success).toBe(true);
            expect(mockLine.textContent).toBe(commandData.text);
            expect(mockContentManager.updateLine).toHaveBeenCalledWith(mockLine);
        });
    });

    describe('Delete Command', () => {
        test('should delete specific line', async () => {
            const commandData = {
                lineId: 'line-1'
            };

            const result = await aiCommandManager.handleDeleteCommand(commandData);

            expect(result.success).toBe(true);
            expect(mockContentManager.getLine).toHaveBeenCalledWith(commandData.lineId);
        });

        test('should handle delete command with validation', async () => {
            const commandData = {
                lineId: 'invalid-line-id'
            };

            mockContentManager.getLine.mockReturnValue(null);

            await expect(aiCommandManager.handleDeleteCommand(commandData))
                .rejects.toThrow('Line not found');
        });
    });

    describe('AI Command Execution', () => {
        test('should execute replace command through command handler', async () => {
            const commandData = {
                command: 'replaceRange',
                startLine: 2,
                endLine: 2,
                content: 'New content',
                format: 'dialogue'
            };

            const result = await aiCommandManager.executeCommand('replaceRange', commandData);

            expect(result.success).toBe(true);
        });

        test('should execute edit command through command handler', async () => {
            const commandData = {
                command: 'edit',
                lineId: 'line-1',
                text: 'Edited content'
            };

            const result = await aiCommandManager.executeCommand('edit', commandData);

            expect(result.success).toBe(true);
        });

        test('should execute delete command through command handler', async () => {
            const commandData = {
                command: 'delete',
                lineId: 'line-1'
            };

            const result = await aiCommandManager.executeCommand('delete', commandData);

            expect(result.success).toBe(true);
        });

        test('should handle unknown commands gracefully', async () => {
            const commandData = {
                command: 'unknownCommand',
                data: 'test'
            };

            await expect(aiCommandManager.executeCommand('unknownCommand', commandData))
                .rejects.toThrow('Unknown command: unknownCommand');
        });
    });

    describe('Section Replacement Scenarios', () => {
        test('should replace dialogue section with new dialogue', async () => {
            const commandData = {
                startLine: 2,
                endLine: 3,
                content: '<speaker>JOHN</speaker>\n<dialog>New dialogue content</dialog>',
                format: 'dialogue'
            };

            const result = await aiCommandManager.handleReplaceRangeCommand(commandData);

            expect(result.success).toBe(true);
            expect(mockContentManager.replaceContent).toHaveBeenCalledWith(
                2, 3, commandData.content, 'dialogue'
            );
        });

        test('should replace action section with new action', async () => {
            const commandData = {
                startLine: 1,
                endLine: 1,
                content: 'New action description',
                format: 'action'
            };

            const result = await aiCommandManager.handleReplaceRangeCommand(commandData);

            expect(result.success).toBe(true);
            expect(mockContentManager.replaceContent).toHaveBeenCalledWith(
                1, 1, commandData.content, 'action'
            );
        });

        test('should replace character section with new character', async () => {
            const commandData = {
                startLine: 2,
                endLine: 2,
                content: 'SARAH',
                format: 'character'
            };

            const result = await aiCommandManager.handleReplaceRangeCommand(commandData);

            expect(result.success).toBe(true);
            expect(mockContentManager.replaceContent).toHaveBeenCalledWith(
                2, 2, commandData.content, 'character'
            );
        });

        test('should handle complex multi-line replacements', async () => {
            const commandData = {
                startLine: 2,
                endLine: 5,
                content: '<speaker>JOHN</speaker>\n<dialog>Hello there!</dialog>\n<directions>(smiling)</directions>\n<speaker>SARAH</speaker>\n<dialog>Hi John!</dialog>',
                format: 'dialogue'
            };

            const result = await aiCommandManager.handleReplaceRangeCommand(commandData);

            expect(result.success).toBe(true);
            expect(mockContentManager.replaceContent).toHaveBeenCalledWith(
                2, 5, commandData.content, 'dialogue'
            );
        });
    });

    describe('Error Handling', () => {
        test('should handle content manager errors gracefully', async () => {
            mockContentManager.replaceContent.mockRejectedValue(new Error('Content manager error'));

            const commandData = {
                startLine: 2,
                endLine: 2,
                content: 'Test content',
                format: 'action'
            };

            await expect(aiCommandManager.handleReplaceRangeCommand(commandData))
                .rejects.toThrow('Content manager error');
        });

        test('should validate command data before execution', async () => {
            const invalidCommandData = {
                // Missing required fields
                content: 'Test content'
            };

            await expect(aiCommandManager.handleReplaceRangeCommand(invalidCommandData))
                .rejects.toThrow('Invalid replace command data');
        });

        test('should handle edge cases in line numbers', async () => {
            const commandData = {
                startLine: 5,
                endLine: 2, // End before start
                content: 'Test content',
                format: 'action'
            };

            await expect(aiCommandManager.handleReplaceRangeCommand(commandData))
                .rejects.toThrow('Invalid line numbers');
        });
    });
});
