/**
 * Tests for Requirement #27: AI response with target line number insertion
 */

import { AILineInsertionManager } from '../../widgets/editor/ai/AILineInsertionManager.js';

describe('Requirement #27: AI Response with Target Line Number', () => {
    let aiLineInsertionManager;
    let mockContainer;
    let mockStateManager;
    let mockEventManager;
    let mockContentManager;

    beforeEach(() => {
        // Create mock container
        mockContainer = document.createElement('div');
        mockContainer.innerHTML = `
            <div class="editor-content">
                <div class="script-line" data-format="action">Line 1</div>
                <div class="script-line" data-format="character">Line 2</div>
                <div class="script-line" data-format="dialogue">Line 3</div>
                <div class="script-line" data-format="action">Line 4</div>
                <div class="script-line" data-format="character">Line 5</div>
            </div>
        `;

        // Create mock state manager
        mockStateManager = {
            getState: jest.fn().mockReturnValue({
                currentScript: {
                    id: 1,
                    title: 'Test Script',
                    content: 'Test content'
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

        // Create mock content manager
        mockContentManager = {
            getContent: jest.fn().mockReturnValue('Test content'),
            setContent: jest.fn(),
            insertLineAt: jest.fn(),
            getLineCount: jest.fn().mockReturnValue(5)
        };

        // Create AI line insertion manager
        aiLineInsertionManager = new AILineInsertionManager({
            container: mockContainer,
            stateManager: mockStateManager,
            eventManager: mockEventManager,
            contentManager: mockContentManager
        });
    });

    afterEach(() => {
        aiLineInsertionManager.destroy();
    });

    describe('AI Response Parsing', () => {
        test('should parse AI response with target line number', () => {
            const aiResponse = {
                content: 'Insert this dialogue at line 3',
                targetLine: 3,
                insertionType: 'insert'
            };

            const parsedResponse = aiLineInsertionManager.parseAIResponse(aiResponse);

            expect(parsedResponse).toHaveProperty('targetLine');
            expect(parsedResponse).toHaveProperty('content');
            expect(parsedResponse).toHaveProperty('insertionType');
            expect(parsedResponse.targetLine).toBe(3);
        });

        test('should parse AI response with multiple target lines', () => {
            const aiResponse = {
                content: 'Insert dialogue at lines 2 and 4',
                targetLines: [2, 4],
                insertionType: 'insert'
            };

            const parsedResponse = aiLineInsertionManager.parseAIResponse(aiResponse);

            expect(parsedResponse).toHaveProperty('targetLines');
            expect(parsedResponse.targetLines).toEqual([2, 4]);
        });

        test('should parse AI response with append instruction', () => {
            const aiResponse = {
                content: 'Append this action line',
                targetLine: 'end',
                insertionType: 'append'
            };

            const parsedResponse = aiLineInsertionManager.parseAIResponse(aiResponse);

            expect(parsedResponse.insertionType).toBe('append');
            expect(parsedResponse.targetLine).toBe('end');
        });

        test('should parse AI response with prepend instruction', () => {
            const aiResponse = {
                content: 'Prepend this character line',
                targetLine: 'start',
                insertionType: 'prepend'
            };

            const parsedResponse = aiLineInsertionManager.parseAIResponse(aiResponse);

            expect(parsedResponse.insertionType).toBe('prepend');
            expect(parsedResponse.targetLine).toBe('start');
        });

        test('should handle AI response without target line', () => {
            const aiResponse = {
                content: 'General script feedback',
                insertionType: 'feedback'
            };

            const parsedResponse = aiLineInsertionManager.parseAIResponse(aiResponse);

            expect(parsedResponse.insertionType).toBe('feedback');
            expect(parsedResponse.targetLine).toBeUndefined();
        });
    });

    describe('Line Insertion at Target Location', () => {
        test('should insert line at specified target line number', () => {
            const aiResponse = {
                content: 'New dialogue line',
                targetLine: 3,
                insertionType: 'insert'
            };

            aiLineInsertionManager.handleAIResponse(aiResponse);

            expect(mockContentManager.insertLineAt).toHaveBeenCalledWith(
                3,
                'New dialogue line'
            );
        });

        test('should insert line after target line number', () => {
            const aiResponse = {
                content: 'New action line',
                targetLine: 2,
                insertionType: 'insert_after'
            };

            aiLineInsertionManager.handleAIResponse(aiResponse);

            expect(mockContentManager.insertLineAt).toHaveBeenCalledWith(
                3, // After line 2
                'New action line'
            );
        });

        test('should insert line before target line number', () => {
            const aiResponse = {
                content: 'New character line',
                targetLine: 4,
                insertionType: 'insert_before'
            };

            aiLineInsertionManager.handleAIResponse(aiResponse);

            expect(mockContentManager.insertLineAt).toHaveBeenCalledWith(
                4, // Before line 4
                'New character line'
            );
        });

        test('should append line at end of script', () => {
            const aiResponse = {
                content: 'Final action line',
                targetLine: 'end',
                insertionType: 'append'
            };

            aiLineInsertionManager.handleAIResponse(aiResponse);

            expect(mockContentManager.insertLineAt).toHaveBeenCalledWith(
                5, // End of script
                'Final action line'
            );
        });

        test('should prepend line at start of script', () => {
            const aiResponse = {
                content: 'Opening action line',
                targetLine: 'start',
                insertionType: 'prepend'
            };

            aiLineInsertionManager.handleAIResponse(aiResponse);

            expect(mockContentManager.insertLineAt).toHaveBeenCalledWith(
                0, // Start of script
                'Opening action line'
            );
        });
    });

    describe('Multiple Line Insertion', () => {
        test('should insert multiple lines at different target locations', () => {
            const aiResponse = {
                content: 'Multiple dialogue lines',
                targetLines: [2, 4],
                insertionType: 'insert_multiple',
                lines: [
                    { content: 'First dialogue', format: 'dialogue' },
                    { content: 'Second dialogue', format: 'dialogue' }
                ]
            };

            aiLineInsertionManager.handleAIResponse(aiResponse);

            expect(mockContentManager.insertLineAt).toHaveBeenCalledTimes(2);
            expect(mockContentManager.insertLineAt).toHaveBeenCalledWith(2, 'First dialogue');
            expect(mockContentManager.insertLineAt).toHaveBeenCalledWith(4, 'Second dialogue');
        });

        test('should insert multiple lines at same target location', () => {
            const aiResponse = {
                content: 'Multiple lines at same location',
                targetLine: 3,
                insertionType: 'insert_multiple',
                lines: [
                    { content: 'First line', format: 'action' },
                    { content: 'Second line', format: 'action' }
                ]
            };

            aiLineInsertionManager.handleAIResponse(aiResponse);

            expect(mockContentManager.insertLineAt).toHaveBeenCalledTimes(2);
            expect(mockContentManager.insertLineAt).toHaveBeenCalledWith(3, 'First line');
            expect(mockContentManager.insertLineAt).toHaveBeenCalledWith(4, 'Second line');
        });

        test('should handle mixed insertion types', () => {
            const aiResponse = {
                content: 'Mixed insertion types',
                insertions: [
                    { targetLine: 2, content: 'Insert at line 2', type: 'insert' },
                    { targetLine: 'end', content: 'Append at end', type: 'append' },
                    { targetLine: 'start', content: 'Prepend at start', type: 'prepend' }
                ]
            };

            aiLineInsertionManager.handleAIResponse(aiResponse);

            expect(mockContentManager.insertLineAt).toHaveBeenCalledTimes(3);
        });
    });

    describe('Target Line Validation', () => {
        test('should validate target line number within bounds', () => {
            const aiResponse = {
                content: 'Valid target line',
                targetLine: 3,
                insertionType: 'insert'
            };

            const isValid = aiLineInsertionManager.validateTargetLine(3);
            expect(isValid).toBe(true);
        });

        test('should handle target line number out of bounds', () => {
            const aiResponse = {
                content: 'Invalid target line',
                targetLine: 10,
                insertionType: 'insert'
            };

            const isValid = aiLineInsertionManager.validateTargetLine(10);
            expect(isValid).toBe(false);
        });

        test('should handle negative target line number', () => {
            const aiResponse = {
                content: 'Negative target line',
                targetLine: -1,
                insertionType: 'insert'
            };

            const isValid = aiLineInsertionManager.validateTargetLine(-1);
            expect(isValid).toBe(false);
        });

        test('should handle zero target line number', () => {
            const aiResponse = {
                content: 'Zero target line',
                targetLine: 0,
                insertionType: 'insert'
            };

            const isValid = aiLineInsertionManager.validateTargetLine(0);
            expect(isValid).toBe(true); // 0 is valid for prepend
        });

        test('should adjust target line number if out of bounds', () => {
            const aiResponse = {
                content: 'Adjusted target line',
                targetLine: 10,
                insertionType: 'insert'
            };

            const adjustedLine = aiLineInsertionManager.adjustTargetLine(10);
            expect(adjustedLine).toBe(5); // Should be adjusted to last line
        });
    });

    describe('Content Formatting', () => {
        test('should format inserted content according to target line format', () => {
            const aiResponse = {
                content: 'New dialogue line',
                targetLine: 3,
                insertionType: 'insert',
                format: 'dialogue'
            };

            aiLineInsertionManager.handleAIResponse(aiResponse);

            expect(mockContentManager.insertLineAt).toHaveBeenCalledWith(
                3,
                'New dialogue line',
                'dialogue'
            );
        });

        test('should maintain format consistency with surrounding lines', () => {
            const aiResponse = {
                content: 'New action line',
                targetLine: 2,
                insertionType: 'insert',
                format: 'auto'
            };

            aiLineInsertionManager.handleAIResponse(aiResponse);

            // Should determine format based on surrounding lines
            expect(mockContentManager.insertLineAt).toHaveBeenCalled();
        });

        test('should handle format inheritance from target line', () => {
            const aiResponse = {
                content: 'New line with inherited format',
                targetLine: 3,
                insertionType: 'insert',
                format: 'inherit'
            };

            aiLineInsertionManager.handleAIResponse(aiResponse);

            expect(mockContentManager.insertLineAt).toHaveBeenCalled();
        });
    });

    describe('AI Response Events', () => {
        test('should publish line insertion event', () => {
            const aiResponse = {
                content: 'New line',
                targetLine: 3,
                insertionType: 'insert'
            };

            aiLineInsertionManager.handleAIResponse(aiResponse);

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'AI:LINE_INSERTED',
                expect.objectContaining({
                    targetLine: 3,
                    content: 'New line',
                    insertionType: 'insert'
                })
            );
        });

        test('should publish multiple line insertion event', () => {
            const aiResponse = {
                content: 'Multiple lines',
                targetLines: [2, 4],
                insertionType: 'insert_multiple'
            };

            aiLineInsertionManager.handleAIResponse(aiResponse);

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'AI:MULTIPLE_LINES_INSERTED',
                expect.objectContaining({
                    targetLines: [2, 4],
                    insertionType: 'insert_multiple'
                })
            );
        });

        test('should publish insertion error event', () => {
            const aiResponse = {
                content: 'Invalid line',
                targetLine: 10,
                insertionType: 'insert'
            };

            aiLineInsertionManager.handleAIResponse(aiResponse);

            expect(mockEventManager.publish).toHaveBeenCalledWith(
                'AI:INSERTION_ERROR',
                expect.objectContaining({
                    error: expect.any(String),
                    targetLine: 10
                })
            );
        });
    });

    describe('Error Handling', () => {
        test('should handle malformed AI response gracefully', () => {
            const malformedResponse = {
                content: 'Malformed response'
                // Missing required fields
            };

            expect(() => {
                aiLineInsertionManager.handleAIResponse(malformedResponse);
            }).not.toThrow();
        });

        test('should handle null AI response gracefully', () => {
            expect(() => {
                aiLineInsertionManager.handleAIResponse(null);
            }).not.toThrow();
        });

        test('should handle undefined AI response gracefully', () => {
            expect(() => {
                aiLineInsertionManager.handleAIResponse(undefined);
            }).not.toThrow();
        });

        test('should handle missing content manager gracefully', () => {
            const aiLineInsertionManagerWithoutContent = new AILineInsertionManager({
                container: mockContainer,
                stateManager: mockStateManager,
                eventManager: mockEventManager,
                contentManager: null
            });

            const aiResponse = {
                content: 'Test line',
                targetLine: 3,
                insertionType: 'insert'
            };

            expect(() => {
                aiLineInsertionManagerWithoutContent.handleAIResponse(aiResponse);
            }).not.toThrow();
        });

        test('should handle content manager errors gracefully', () => {
            mockContentManager.insertLineAt.mockImplementation(() => {
                throw new Error('Insertion failed');
            });

            const aiResponse = {
                content: 'Test line',
                targetLine: 3,
                insertionType: 'insert'
            };

            expect(() => {
                aiLineInsertionManager.handleAIResponse(aiResponse);
            }).not.toThrow();
        });
    });

    describe('Performance', () => {
        test('should handle large number of line insertions efficiently', () => {
            const startTime = Date.now();

            // Insert many lines
            for (let i = 0; i < 100; i++) {
                const aiResponse = {
                    content: `Line ${i}`,
                    targetLine: i % 5 + 1,
                    insertionType: 'insert'
                };
                aiLineInsertionManager.handleAIResponse(aiResponse);
            }

            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
        });

        test('should handle rapid line insertions efficiently', () => {
            const startTime = Date.now();

            // Rapid line insertions
            for (let i = 0; i < 50; i++) {
                const aiResponse = {
                    content: `Rapid line ${i}`,
                    targetLine: 3,
                    insertionType: 'insert'
                };
                aiLineInsertionManager.handleAIResponse(aiResponse);
            }

            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
        });

        test('should handle complex AI responses efficiently', () => {
            const complexResponse = {
                content: 'Complex response',
                insertions: Array.from({ length: 20 }, (_, i) => ({
                    targetLine: i + 1,
                    content: `Complex line ${i}`,
                    type: 'insert'
                }))
            };

            const startTime = Date.now();
            aiLineInsertionManager.handleAIResponse(complexResponse);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(200); // Should complete within 200ms
        });
    });

    describe('Integration with Editor Components', () => {
        test('should integrate with content manager for line insertion', () => {
            const aiResponse = {
                content: 'Integrated line',
                targetLine: 3,
                insertionType: 'insert'
            };

            aiLineInsertionManager.handleAIResponse(aiResponse);

            expect(mockContentManager.insertLineAt).toHaveBeenCalledWith(
                3,
                'Integrated line'
            );
        });

        test('should integrate with state manager for state updates', () => {
            const aiResponse = {
                content: 'State update line',
                targetLine: 3,
                insertionType: 'insert'
            };

            aiLineInsertionManager.handleAIResponse(aiResponse);

            expect(mockStateManager.setState).toHaveBeenCalledWith(
                'CONTENT_MODIFIED',
                expect.any(Object)
            );
        });

        test('should integrate with event system for notifications', () => {
            const aiResponse = {
                content: 'Event notification line',
                targetLine: 3,
                insertionType: 'insert'
            };

            aiLineInsertionManager.handleAIResponse(aiResponse);

            expect(mockEventManager.publish).toHaveBeenCalled();
        });

        test('should integrate with save service for auto-save', () => {
            const mockSaveService = {
                handleContentChange: jest.fn()
            };

            aiLineInsertionManager.saveService = mockSaveService;

            const aiResponse = {
                content: 'Auto-save line',
                targetLine: 3,
                insertionType: 'insert'
            };

            aiLineInsertionManager.handleAIResponse(aiResponse);

            expect(mockSaveService.handleContentChange).toHaveBeenCalled();
        });
    });
});
