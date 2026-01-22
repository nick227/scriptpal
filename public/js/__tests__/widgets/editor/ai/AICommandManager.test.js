/**
 * Tests for AICommandManager - AI Script Operations
 */

import { AICommandManager } from '../../../../widgets/editor/ai/AICommandManager.js';

describe('AICommandManager - AI Script Operations', () => {
    let aiCommandManager;
    let mockStateManager;
    let mockContent;

    beforeEach(() => {
        // Create mock state manager
        mockStateManager = {
            getCurrentState: jest.fn().mockReturnValue({
                content: 'Test script content',
                cursorPosition: 0,
                format: 'action'
            })
        };

        // Create mock content manager
        mockContent = {
            getContent: jest.fn().mockReturnValue('<script><action>Test content</action></script>'),
            appendContent: jest.fn().mockResolvedValue(true),
            prependContent: jest.fn().mockResolvedValue(true),
            insertContentAt: jest.fn().mockResolvedValue(true),
            replaceContentRange: jest.fn().mockResolvedValue(true),
            getLine: jest.fn().mockReturnValue({ textContent: 'Test line' }),
            setLineFormat: jest.fn(),
            createLine: jest.fn().mockReturnValue({ id: 'line-1' }),
            addLine: jest.fn().mockResolvedValue(true),
            removeLine: jest.fn().mockReturnValue(true),
            updateLine: jest.fn(),
            getLineFormat: jest.fn().mockReturnValue('action'),
            getChapterCount: jest.fn().mockReturnValue(1)
        };

        // Create AI command manager
        aiCommandManager = new AICommandManager(mockStateManager);
        aiCommandManager.setContent(mockContent);
    });

    afterEach(() => {
        aiCommandManager.destroy();
    });

    describe('Initialization', () => {
        test('should initialize with required dependencies', () => {
            expect(aiCommandManager.stateManager).toBe(mockStateManager);
            expect(aiCommandManager.isProcessing).toBe(false);
        });

        test('should require state manager', () => {
            expect(() => {
                new AICommandManager(null);
            }).toThrow('StateManager is required');
        });
    });

    describe('Command Execution', () => {
        test('should execute valid commands', async () => {
            const command = {
                type: 'analyze',
                data: { type: 'stats' }
            };

            const result = await aiCommandManager.executeCommand(command);

            expect(result.success).toBe(true);
            expect(result.result).toBeDefined();
        });

        test('should prevent concurrent command execution', async () => {
            const command1 = {
                type: 'analyze',
                data: { type: 'stats' }
            };

            const command2 = {
                type: 'analyze',
                data: { type: 'structure' }
            };

            // Start first command
            const firstPromise = aiCommandManager.executeCommand(command1);

            // Try to execute second command while first is running
            await expect(aiCommandManager.executeCommand(command2)).rejects.toThrow('Another command is currently being processed');

            await firstPromise;
        });

        test('should validate command format', async () => {
            const invalidCommands = [
                null,
                undefined,
                {},
                { type: 'analyze' }, // Missing data
                { data: { type: 'stats' } }, // Missing type
                { type: 123, data: {} }, // Invalid type
                { type: 'analyze', data: null } // Invalid data
            ];

            for (const command of invalidCommands) {
                await expect(aiCommandManager.executeCommand(command)).rejects.toThrow('Invalid command format');
            }
        });

        test('should emit command events', async () => {
            const commandStartHandler = jest.fn();
            const commandCompleteHandler = jest.fn();

            aiCommandManager.on('commandStart', commandStartHandler);
            aiCommandManager.on('commandComplete', commandCompleteHandler);

            const command = {
                type: 'analyze',
                data: { type: 'stats' }
            };

            await aiCommandManager.executeCommand(command);

            expect(commandStartHandler).toHaveBeenCalledWith({ command });
            expect(commandCompleteHandler).toHaveBeenCalledWith({
                command,
                result: expect.objectContaining({ success: true })
            });
        });

        test('should emit error events on failure', async () => {
            const commandErrorHandler = jest.fn();
            aiCommandManager.on('commandError', commandErrorHandler);

            const command = {
                type: 'invalid',
                data: {}
            };

            await expect(aiCommandManager.executeCommand(command)).rejects.toThrow();

            expect(commandErrorHandler).toHaveBeenCalledWith({
                command,
                error: expect.any(Error)
            });
        });
    });

    describe('Script Analysis Commands', () => {
        test('should analyze script structure', async () => {
            const command = {
                type: 'analyzeStructure',
                data: {}
            };

            const result = await aiCommandManager.executeCommand(command);

            expect(result.success).toBe(true);
            expect(result.operation).toBe('analyzeStructure');
            expect(result.result).toHaveProperty('lineCount');
            expect(result.result).toHaveProperty('paragraphCount');
            expect(result.result).toHaveProperty('chapterCount');
        });

        test('should analyze script format', async () => {
            const command = {
                type: 'analyzeFormat',
                data: {}
            };

            const result = await aiCommandManager.executeCommand(command);

            expect(result.success).toBe(true);
            expect(result.operation).toBe('analyzeFormat');
            expect(result.result).toBeDefined();
        });

        test('should analyze script content', async () => {
            const command = {
                type: 'analyzeContent',
                data: {}
            };

            const result = await aiCommandManager.executeCommand(command);

            expect(result.success).toBe(true);
            expect(result.operation).toBe('analyzeContent');
            expect(result.result).toHaveProperty('characters');
            expect(result.result).toHaveProperty('words');
            expect(result.result).toHaveProperty('sentences');
            expect(result.result).toHaveProperty('lines');
        });

        test('should provide detailed statistics', async () => {
            const command = {
                type: 'analyzeContent',
                data: {}
            };

            const result = await aiCommandManager.executeCommand(command);
            const stats = result.result;

            expect(stats.characters).toBeGreaterThan(0);
            expect(stats.charactersNoSpaces).toBeGreaterThan(0);
            expect(stats.words).toBeGreaterThan(0);
            expect(stats.sentences).toBeGreaterThan(0);
            expect(stats.lines).toBeGreaterThan(0);
            expect(stats.paragraphs).toBeGreaterThan(0);
            expect(stats.averageWordsPerSentence).toBeGreaterThan(0);
            expect(stats.averageCharactersPerWord).toBeGreaterThan(0);
        });
    });

    describe('Script Modification Commands', () => {
        test('should append content to script', async () => {
            const command = {
                type: 'append',
                data: {
                    content: 'New content to append',
                    format: 'action'
                }
            };

            const result = await aiCommandManager.executeCommand(command);

            expect(result.success).toBe(true);
            expect(result.operation).toBe('append');
            expect(mockContent.appendContent).toHaveBeenCalledWith('New content to append', 'action');
        });

        test('should prepend content to script', async () => {
            const command = {
                type: 'prepend',
                data: {
                    content: 'New content to prepend',
                    format: 'header'
                }
            };

            const result = await aiCommandManager.executeCommand(command);

            expect(result.success).toBe(true);
            expect(result.operation).toBe('prepend');
            expect(mockContent.prependContent).toHaveBeenCalledWith('New content to prepend', 'header');
        });

        test('should insert content at specific position', async () => {
            const command = {
                type: 'insertAt',
                data: {
                    content: 'Content to insert',
                    position: 10,
                    format: 'dialog'
                }
            };

            const result = await aiCommandManager.executeCommand(command);

            expect(result.success).toBe(true);
            expect(result.operation).toBe('insertAt');
            expect(result.position).toBe(10);
            expect(mockContent.insertContentAt).toHaveBeenCalledWith('Content to insert', 10, 'dialog');
        });

        test('should replace content in range', async () => {
            const command = {
                type: 'replaceRange',
                data: {
                    content: 'New content',
                    startPosition: 5,
                    endPosition: 15,
                    format: 'action'
                }
            };

            const result = await aiCommandManager.executeCommand(command);

            expect(result.success).toBe(true);
            expect(result.operation).toBe('replaceRange');
            expect(result.startPosition).toBe(5);
            expect(result.endPosition).toBe(15);
            expect(mockContent.replaceContentRange).toHaveBeenCalledWith('New content', 5, 15, 'action');
        });
    });

    describe('Command Validation', () => {
        test('should validate append command data', async () => {
            const command = {
                type: 'append',
                data: {} // Missing content
            };

            await expect(aiCommandManager.executeCommand(command)).rejects.toThrow('Content is required for append command');
        });

        test('should validate prepend command data', async () => {
            const command = {
                type: 'prepend',
                data: {} // Missing content
            };

            await expect(aiCommandManager.executeCommand(command)).rejects.toThrow('Content is required for prepend command');
        });

        test('should validate insertAt command data', async () => {
            const command = {
                type: 'insertAt',
                data: {
                    content: 'Test content'
                    // Missing position
                }
            };

            await expect(aiCommandManager.executeCommand(command)).rejects.toThrow('Position must be a number');
        });

        test('should validate replaceRange command data', async () => {
            const command = {
                type: 'replaceRange',
                data: {
                    content: 'Test content',
                    startPosition: 5
                    // Missing endPosition
                }
            };

            await expect(aiCommandManager.executeCommand(command)).rejects.toThrow('End position must be a number');
        });
    });

    describe('Error Handling', () => {
        test('should handle content manager errors', async () => {
            const error = new Error('Content manager error');
            mockContent.appendContent.mockRejectedValue(error);

            const command = {
                type: 'append',
                data: {
                    content: 'Test content',
                    format: 'action'
                }
            };

            await expect(aiCommandManager.executeCommand(command)).rejects.toThrow('Content manager error');
        });

        test('should handle unknown command types', async () => {
            const command = {
                type: 'unknownCommand',
                data: {}
            };

            await expect(aiCommandManager.executeCommand(command)).rejects.toThrow('No handler found for command type: unknownCommand');
        });

        test('should handle content manager not available', async () => {
            aiCommandManager.setContent(null);

            const command = {
                type: 'analyze',
                data: { type: 'stats' }
            };

            await expect(aiCommandManager.executeCommand(command)).rejects.toThrow();
        });
    });

    describe('Legacy Command Support', () => {
        test('should support legacy format command', async () => {
            const command = {
                type: 'format',
                data: {
                    lineId: 'line-1',
                    format: 'dialog'
                }
            };

            const result = await aiCommandManager.executeCommand(command);

            expect(result.success).toBe(true);
            expect(mockContent.setLineFormat).toHaveBeenCalled();
        });

        test('should support legacy insert command', async () => {
            const command = {
                type: 'insert',
                data: {
                    text: 'New line',
                    format: 'action',
                    afterLineId: 'line-1'
                }
            };

            const result = await aiCommandManager.executeCommand(command);

            expect(result.success).toBe(true);
            expect(mockContent.createLine).toHaveBeenCalled();
            expect(mockContent.addLine).toHaveBeenCalled();
        });

        test('should support legacy delete command', async () => {
            const command = {
                type: 'delete',
                data: {
                    lineId: 'line-1'
                }
            };

            const result = await aiCommandManager.executeCommand(command);

            expect(result.success).toBe(true);
            expect(mockContent.removeLine).toHaveBeenCalledWith('line-1');
        });

        test('should support legacy replace command', async () => {
            const command = {
                type: 'replace',
                data: {
                    lineId: 'line-1',
                    text: 'New text'
                }
            };

            const result = await aiCommandManager.executeCommand(command);

            expect(result.success).toBe(true);
            expect(mockContent.updateLine).toHaveBeenCalled();
        });

        test('should support legacy analyze command', async () => {
            const command = {
                type: 'analyze',
                data: {
                    type: 'structure'
                }
            };

            const result = await aiCommandManager.executeCommand(command);

            expect(result.success).toBe(true);
            expect(result.result).toBeDefined();
        });
    });

    describe('Content Integration', () => {
        test('should work with content manager', () => {
            const content = { getContent: jest.fn() };
            aiCommandManager.setContent(content);

            expect(aiCommandManager.content).toBe(content);
        });

        test('should work with state manager', () => {
            const stateManager = { getCurrentState: jest.fn() };
            aiCommandManager.setStateManager(stateManager);

            expect(aiCommandManager.stateManager).toBe(stateManager);
        });
    });

    describe('Event Handling', () => {
        test('should register event handlers', () => {
            const handler = jest.fn();
            aiCommandManager.on('testEvent', handler);

            aiCommandManager.emit('testEvent', { data: 'test' });

            expect(handler).toHaveBeenCalledWith({ data: 'test' });
        });

        test('should handle multiple event handlers', () => {
            const handler1 = jest.fn();
            const handler2 = jest.fn();

            aiCommandManager.on('testEvent', handler1);
            aiCommandManager.on('testEvent', handler2);

            aiCommandManager.emit('testEvent', { data: 'test' });

            expect(handler1).toHaveBeenCalledWith({ data: 'test' });
            expect(handler2).toHaveBeenCalledWith({ data: 'test' });
        });
    });

    describe('Cleanup', () => {
        test('should destroy properly', () => {
            aiCommandManager.destroy();

            expect(aiCommandManager.commands.size).toBe(0);
            expect(aiCommandManager.eventHandlers.size).toBe(0);
            expect(aiCommandManager.content).toBeNull();
            expect(aiCommandManager.stateManager).toBeNull();
            expect(aiCommandManager.isProcessing).toBe(false);
        });
    });
});
