/**
 * Tests for AILineInsertionManager - AI Line Insertion Management
 */

import { AILineInsertionManager } from '../../../../widgets/editor/ai/AILineInsertionManager.js';

describe('Requirement #4: AI Append to Target Locations', () => {
    let aiLineInsertionManager;
    let mockStateManager;
    let mockEventManager;
    let mockContentManager;
    let mockAICommandManager;

    beforeEach(() => {
        // Create mock state manager
        mockStateManager = {
            getState: jest.fn().mockReturnValue({
                id: 1,
                title: 'Test Script',
                content: 'Line 1\nLine 2\nLine 3'
            }),
            setState: jest.fn(),
            subscribe: jest.fn()
        };

        // Create mock event manager
        mockEventManager = {
            publish: jest.fn(),
            subscribe: jest.fn()
        };

        // Create mock content manager
        mockContentManager = {
            getContent: jest.fn().mockReturnValue('Line 1\nLine 2\nLine 3'),
            insertContentAt: jest.fn().mockResolvedValue({ success: true }),
            replaceContent: jest.fn().mockResolvedValue({ success: true })
        };

        // Create mock AI command manager
        mockAICommandManager = {
            executeCommand: jest.fn().mockResolvedValue({ success: true })
        };

        // Create AI line insertion manager
        aiLineInsertionManager = new AILineInsertionManager({
            stateManager: mockStateManager,
            eventManager: mockEventManager,
            contentManager: mockContentManager,
            aiCommandManager: mockAICommandManager
        });
    });

    afterEach(() => {
        aiLineInsertionManager.destroy();
    });

    describe('Initialization', () => {
        test('should initialize with required dependencies', () => {
            expect(aiLineInsertionManager.stateManager).toBe(mockStateManager);
            expect(aiLineInsertionManager.eventManager).toBe(mockEventManager);
            expect(aiLineInsertionManager.contentManager).toBe(mockContentManager);
            expect(aiLineInsertionManager.aiCommandManager).toBe(mockAICommandManager);
        });

        test('should require state manager', () => {
            expect(() => {
                new AILineInsertionManager({
                    eventManager: mockEventManager,
                    contentManager: mockContentManager,
                    aiCommandManager: mockAICommandManager
                });
            }).toThrow('StateManager is required for AILineInsertionManager');
        });

        test('should require event manager', () => {
            expect(() => {
                new AILineInsertionManager({
                    stateManager: mockStateManager,
                    contentManager: mockContentManager,
                    aiCommandManager: mockAICommandManager
                });
            }).toThrow('EventManager is required for AILineInsertionManager');
        });

        test('should require content manager', () => {
            expect(() => {
                new AILineInsertionManager({
                    stateManager: mockStateManager,
                    eventManager: mockEventManager,
                    aiCommandManager: mockAICommandManager
                });
            }).toThrow('ContentManager is required for AILineInsertionManager');
        });

        test('should require AI command manager', () => {
            expect(() => {
                new AILineInsertionManager({
                    stateManager: mockStateManager,
                    eventManager: mockEventManager,
                    contentManager: mockContentManager
                });
            }).toThrow('AICommandManager is required for AILineInsertionManager');
        });

        test('should set up event listeners', () => {
            expect(mockStateManager.subscribe).toHaveBeenCalled();
            expect(mockEventManager.subscribe).toHaveBeenCalled();
        });
    });

    describe('Requirement #4: AI Append to Target Locations', () => {
        test('should append AI generated script to current script at target locations', async () => {
            const aiResponse = {
                content: 'Insert this dialogue after line 5:\n\n```script\nJOHN\nHello, how are you?\n```'
            };

            const event = { response: aiResponse };
            await aiLineInsertionManager.handleAIResponse(event);

            expect(mockAICommandManager.executeCommand).toHaveBeenCalledWith(
                'insertAt',
                expect.objectContaining({
                    position: 5,
                    content: 'JOHN',
                    format: 'character'
                })
            );
        });

        test('should handle multiple target locations in single AI response', async () => {
            const aiResponse = {
                content: 'Add dialogue at line 3 and line 7:\n\n```script\nSARAH\nI need to tell you something.\n\nMIKE\nWhat is it?\n```'
            };

            const event = { response: aiResponse };
            await aiLineInsertionManager.handleAIResponse(event);

            // Should handle the first target location found
            expect(mockAICommandManager.executeCommand).toHaveBeenCalled();
        });

        test('should append content after specified line number', async () => {
            const insertionData = {
                lineNumber: 10,
                content: 'JOHN\nHello world',
                format: 'dialogue',
                type: 'after'
            };

            await aiLineInsertionManager.executeLineInsertion(insertionData);

            expect(mockAICommandManager.executeCommand).toHaveBeenCalledWith(
                'insertAt',
                expect.objectContaining({
                    position: 10,
                    content: 'JOHN',
                    format: 'character'
                })
            );
        });

        test('should handle append operations with proper formatting', async () => {
            const insertionData = {
                lineNumber: 5,
                content: '<speaker>JOHN</speaker>\n<dialog>Hello there!</dialog>',
                format: 'dialogue',
                type: 'after'
            };

            await aiLineInsertionManager.executeLineInsertion(insertionData);

            // Should parse and format the content properly
            expect(mockAICommandManager.executeCommand).toHaveBeenCalled();
        });

        test('should validate target line numbers before appending', async () => {
            mockContentManager.getContent.mockReturnValue('Line 1\nLine 2\nLine 3');

            const insertionData = {
                lineNumber: 10, // Exceeds total lines
                content: 'JOHN\nHello',
                format: 'dialogue',
                type: 'after'
            };

            await aiLineInsertionManager.executeLineInsertion(insertionData);

            // Should adjust to valid line number
            expect(mockAICommandManager.executeCommand).toHaveBeenCalledWith(
                'insertAt',
                expect.objectContaining({
                    position: 3 // Adjusted to total lines
                })
            );
        });
    });

    describe('AI Response Parsing', () => {
        test('should parse AI response with line number', () => {
            const response = {
                content: 'Insert this dialogue at line 5:\n\n```script\nJOHN\nHello, how are you?\n```'
            };

            const result = aiLineInsertionManager.parseAIResponse(response);

            expect(result).toBeTruthy();
            expect(result.lineNumber).toBe(5);
            expect(result.content).toContain('JOHN');
            expect(result.content).toContain('Hello, how are you?');
            expect(result.type).toBe('after');
        });

        test('should extract line number from various patterns', () => {
            const patterns = [
                'Insert at line 10',
                'After line 15',
                'Before line 20',
                'Position 25',
                '[line 30]',
                '(line 35)'
            ];

            patterns.forEach((pattern, index) => {
                const response = { content: pattern };
                const result = aiLineInsertionManager.parseAIResponse(response);
                expect(result).toBeTruthy();
            });
        });

        test('should extract script content from code blocks', () => {
            const response = {
                content: 'Add this at line 3:\n\n```script\nSARAH\nI need to tell you something important.\n```'
            };

            const result = aiLineInsertionManager.parseAIResponse(response);

            expect(result).toBeTruthy();
            expect(result.content).toBe('SARAH\nI need to tell you something important.');
        });

        test('should determine insertion type from content', () => {
            const afterResponse = { content: 'Insert after line 5:\n\n```script\nNew content\n```' };
            const beforeResponse = { content: 'Insert before line 5:\n\n```script\nNew content\n```' };
            const replaceResponse = { content: 'Replace line 5:\n\n```script\nNew content\n```' };

            expect(aiLineInsertionManager.parseAIResponse(afterResponse).type).toBe('after');
            expect(aiLineInsertionManager.parseAIResponse(beforeResponse).type).toBe('before');
            expect(aiLineInsertionManager.parseAIResponse(replaceResponse).type).toBe('replace');
        });

        test('should extract format from response', () => {
            const response = {
                content: 'Insert at line 5 with format dialogue:\n\n```script\nHello world\n```'
            };

            const result = aiLineInsertionManager.parseAIResponse(response);

            expect(result).toBeTruthy();
            expect(result.format).toBe('dialogue');
        });

        test('should return null for invalid responses', () => {
            const invalidResponses = [
                { content: 'Just a regular response' },
                { content: 'Insert at line abc' },
                { content: 'Insert at line 5' }, // No content
                { content: null },
                { content: '' }
            ];

            invalidResponses.forEach(response => {
                const result = aiLineInsertionManager.parseAIResponse(response);
                expect(result).toBeNull();
            });
        });
    });

    describe('Line Number Extraction', () => {
        test('should extract line numbers from various patterns', () => {
            const testCases = [
                { input: 'line 5', expected: 5 },
                { input: 'at line 10', expected: 10 },
                { input: 'insert at line 15', expected: 15 },
                { input: 'after line 20', expected: 20 },
                { input: 'before line 25', expected: 25 },
                { input: 'position 30', expected: 30 },
                { input: '[line 35]', expected: 35 },
                { input: '(line 40)', expected: 40 }
            ];

            testCases.forEach(({ input, expected }) => {
                const result = aiLineInsertionManager.extractLineNumber(input);
                expect(result).toBe(expected);
            });
        });

        test('should return null for invalid line numbers', () => {
            const invalidInputs = [
                'line abc',
                'line 0',
                'line -5',
                'no line number',
                ''
            ];

            invalidInputs.forEach(input => {
                const result = aiLineInsertionManager.extractLineNumber(input);
                expect(result).toBeNull();
            });
        });
    });

    describe('Content Extraction', () => {
        test('should extract content from code blocks', () => {
            const testCases = [
                {
                    input: '```script\nJOHN\nHello\n```',
                    expected: 'JOHN\nHello'
                },
                {
                    input: '```\nSARAH\nHow are you?\n```',
                    expected: 'SARAH\nHow are you?'
                },
                {
                    input: '<script>\nMIKE\nGood morning\n</script>',
                    expected: 'MIKE\nGood morning'
                }
            ];

            testCases.forEach(({ input, expected }) => {
                const result = aiLineInsertionManager.extractScriptContent(input);
                expect(result).toBe(expected);
            });
        });

        test('should extract content after line number', () => {
            const input = 'Insert at line 5:\n\nJOHN\nThis is the dialogue content.';
            const result = aiLineInsertionManager.extractScriptContent(input);

            expect(result).toBe('JOHN\nThis is the dialogue content.');
        });

        test('should return null for no content', () => {
            const inputs = [
                'Insert at line 5',
                'No content here',
                ''
            ];

            inputs.forEach(input => {
                const result = aiLineInsertionManager.extractScriptContent(input);
                expect(result).toBeNull();
            });
        });
    });

    describe('Line Insertion Execution', () => {
        test('should execute after line insertion', async () => {
            const insertionData = {
                lineNumber: 2,
                content: 'JOHN\nHello world',
                format: 'dialogue',
                type: 'after'
            };

            await aiLineInsertionManager.executeLineInsertion(insertionData);

            expect(mockAICommandManager.executeCommand).toHaveBeenCalledWith(
                'insertAt',
                expect.objectContaining({
                    position: 2,
                    content: 'JOHN',
                    format: 'character'
                })
            );
        });

        test('should execute before line insertion', async () => {
            const insertionData = {
                lineNumber: 2,
                content: 'JOHN\nHello world',
                format: 'dialogue',
                type: 'before'
            };

            await aiLineInsertionManager.executeLineInsertion(insertionData);

            expect(mockAICommandManager.executeCommand).toHaveBeenCalledWith(
                'insertAt',
                expect.objectContaining({
                    position: 2,
                    content: 'JOHN',
                    format: 'character'
                })
            );
        });

        test('should execute line replacement', async () => {
            const insertionData = {
                lineNumber: 2,
                content: 'JOHN\nHello world',
                format: 'dialogue',
                type: 'replace'
            };

            await aiLineInsertionManager.executeLineInsertion(insertionData);

            expect(mockAICommandManager.executeCommand).toHaveBeenCalledWith(
                'replaceRange',
                expect.objectContaining({
                    startLine: 2,
                    endLine: 2,
                    content: 'JOHN',
                    format: 'character'
                })
            );
        });

        test('should handle line number exceeding total lines', async () => {
            mockContentManager.getContent.mockReturnValue('Line 1\nLine 2\nLine 3');

            const insertionData = {
                lineNumber: 10,
                content: 'JOHN\nHello world',
                format: 'dialogue',
                type: 'after'
            };

            await aiLineInsertionManager.executeLineInsertion(insertionData);

            expect(mockAICommandManager.executeCommand).toHaveBeenCalledWith(
                'insertAt',
                expect.objectContaining({
                    position: 3 // Should be adjusted to total lines
                })
            );
        });
    });

    describe('Content Parsing', () => {
        test('should parse content to lines with format detection', () => {
            const content = 'JOHN\nHello, how are you?\n(Smiling)\nI am fine.';
            const lines = aiLineInsertionManager.parseContentToLines(content, 'action');

            expect(lines).toHaveLength(4);
            expect(lines[0]).toEqual({ content: 'JOHN', format: 'character' });
            expect(lines[1]).toEqual({ content: 'Hello, how are you?', format: 'dialogue' });
            expect(lines[2]).toEqual({ content: '(Smiling)', format: 'parenthetical' });
            expect(lines[3]).toEqual({ content: 'I am fine.', format: 'dialogue' });
        });

        test('should detect line formats correctly', () => {
            const testCases = [
                { input: 'JOHN:', expected: 'character' },
                { input: 'The room is dark.', expected: 'action' },
                { input: 'hello world', expected: 'dialogue' },
                { input: '(whispering)', expected: 'parenthetical' },
                { input: 'CUT TO:', expected: 'transition' }
            ];

            testCases.forEach(({ input, expected }) => {
                const result = aiLineInsertionManager.detectLineFormat(input);
                expect(result).toBe(expected);
            });
        });

        test('should filter out empty lines', () => {
            const content = 'JOHN\n\n\nHello world\n\n';
            const lines = aiLineInsertionManager.parseContentToLines(content, 'action');

            expect(lines).toHaveLength(2);
            expect(lines[0].content).toBe('JOHN');
            expect(lines[1].content).toBe('Hello world');
        });
    });

    describe('History Management', () => {
        test('should record insertion in history', async () => {
            const insertionData = {
                lineNumber: 2,
                content: 'JOHN\nHello',
                format: 'dialogue',
                type: 'after'
            };

            await aiLineInsertionManager.executeLineInsertion(insertionData);

            const history = aiLineInsertionManager.getInsertionHistory();
            expect(history).toHaveLength(1);
            expect(history[0].lineNumber).toBe(2);
        });

        test('should limit history size', async () => {
            // Insert more than max history size
            for (let i = 0; i < 60; i++) {
                const insertionData = {
                    lineNumber: i + 1,
                    content: `Line ${i}`,
                    format: 'action',
                    type: 'after'
                };
                await aiLineInsertionManager.executeLineInsertion(insertionData);
            }

            const history = aiLineInsertionManager.getInsertionHistory();
            expect(history.length).toBeLessThanOrEqual(50);
        });

        test('should clear history on script change', () => {
            // Add some history
            aiLineInsertionManager.recordInsertion({ lineNumber: 1 }, { success: true });

            // Change script
            aiLineInsertionManager.handleScriptChange({ id: 2, title: 'New Script' });

            const history = aiLineInsertionManager.getInsertionHistory();
            expect(history).toHaveLength(0);
        });

        test('should get insertion statistics', async () => {
            const insertions = [
                { lineNumber: 1, type: 'after' },
                { lineNumber: 2, type: 'before' },
                { lineNumber: 3, type: 'after' }
            ];

            for (const insertion of insertions) {
                await aiLineInsertionManager.executeLineInsertion(insertion);
            }

            const stats = aiLineInsertionManager.getInsertionStats();
            expect(stats.totalInsertions).toBe(3);
            expect(stats.typeCounts.after).toBe(2);
            expect(stats.typeCounts.before).toBe(1);
        });
    });

    describe('Error Handling', () => {
        test('should handle AI response errors', async () => {
            mockAICommandManager.executeCommand.mockRejectedValue(new Error('Command failed'));

            const insertionData = {
                lineNumber: 2,
                content: 'JOHN\nHello',
                format: 'dialogue',
                type: 'after'
            };

            await aiLineInsertionManager.executeLineInsertion(insertionData);

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'AI.LINE_INSERTION_ERROR',
                expect.objectContaining({
                    context: 'executeLineInsertion'
                })
            );
        });

        test('should handle invalid AI responses', () => {
            const invalidResponse = { content: 'Invalid response' };

            expect(() => {
                aiLineInsertionManager.handleAIResponse({ response: invalidResponse });
            }).not.toThrow();
        });
    });

    describe('Event Handling', () => {
        test('should handle AI response events', async () => {
            const event = {
                response: {
                    content: 'Insert at line 5:\n\n```script\nJOHN\nHello\n```'
                }
            };

            await aiLineInsertionManager.handleAIResponse(event);

            expect(mockAICommandManager.executeCommand).toHaveBeenCalled();
        });

        test('should emit insertion completed events', async () => {
            const insertionData = {
                lineNumber: 2,
                content: 'JOHN\nHello',
                format: 'dialogue',
                type: 'after'
            };

            await aiLineInsertionManager.executeLineInsertion(insertionData);

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'AI.LINE_INSERTION_COMPLETED',
                expect.objectContaining({
                    insertionData,
                    result: expect.any(Object)
                })
            );
        });
    });

    describe('Utility Methods', () => {
        test('should get total lines', () => {
            mockContentManager.getContent.mockReturnValue('Line 1\nLine 2\nLine 3');

            const totalLines = aiLineInsertionManager.getTotalLines();
            expect(totalLines).toBe(3);
        });

        test('should clear insertion history', () => {
            aiLineInsertionManager.recordInsertion({ lineNumber: 1 }, { success: true });
            aiLineInsertionManager.clearInsertionHistory();

            const history = aiLineInsertionManager.getInsertionHistory();
            expect(history).toHaveLength(0);
        });
    });

    describe('Cleanup', () => {
        test('should destroy properly', () => {
            aiLineInsertionManager.destroy();

            expect(aiLineInsertionManager.stateManager).toBeNull();
            expect(aiLineInsertionManager.eventManager).toBeNull();
            expect(aiLineInsertionManager.contentManager).toBeNull();
            expect(aiLineInsertionManager.aiCommandManager).toBeNull();
            expect(aiLineInsertionManager.insertionHistory).toHaveLength(0);
        });
    });
});
