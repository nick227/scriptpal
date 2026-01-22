/**
 * Tests for Requirement #28: AI generated script uses system formatting
 */

import { ScriptFormatter } from '../../services/scriptFormatter.js';
import { AICommandManager } from '../../widgets/editor/ai/AICommandManager.js';

describe('Requirement #28: AI Generated Script Uses System Formatting', () => {
    let aiCommandManager;
    let scriptFormatter;
    let mockStateManager;
    let mockContentManager;

    beforeEach(() => {
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

        // Create mock content manager
        mockContentManager = {
            getContent: jest.fn().mockReturnValue('Test content'),
            setContent: jest.fn(),
            getLineCount: jest.fn().mockReturnValue(10)
        };

        // Create script formatter
        scriptFormatter = new ScriptFormatter();

        // Create AI command manager
        aiCommandManager = new AICommandManager(mockStateManager);
        aiCommandManager.content = mockContentManager;
        aiCommandManager.scriptFormatter = scriptFormatter;
    });

    afterEach(() => {
        aiCommandManager.destroy();
    });

    describe('AI Script Generation with System Formatting', () => {
        test('should generate script with proper action format', async () => {
            const aiResponse = {
                content: 'INT. COFFEE SHOP - MORNING\n\nJOHN sits at a table, reading a newspaper.',
                format: 'action'
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(aiResponse);

            expect(formattedScript).toContain('<action>');
            expect(formattedScript).toContain('</action>');
            expect(formattedScript).toContain('INT. COFFEE SHOP - MORNING');
        });

        test('should generate script with proper character format', async () => {
            const aiResponse = {
                content: 'JOHN\n\nMorning, Sarah. How are you?',
                format: 'character'
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(aiResponse);

            expect(formattedScript).toContain('<speaker>');
            expect(formattedScript).toContain('</speaker>');
            expect(formattedScript).toContain('JOHN');
        });

        test('should generate script with proper dialogue format', async () => {
            const aiResponse = {
                content: 'Morning, Sarah. How are you?',
                format: 'dialogue'
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(aiResponse);

            expect(formattedScript).toContain('<dialog>');
            expect(formattedScript).toContain('</dialog>');
            expect(formattedScript).toContain('Morning, Sarah. How are you?');
        });

        test('should generate script with proper parenthetical format', async () => {
            const aiResponse = {
                content: '(surprised)',
                format: 'parenthetical'
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(aiResponse);

            expect(formattedScript).toContain('<directions>');
            expect(formattedScript).toContain('</directions>');
            expect(formattedScript).toContain('(surprised)');
        });

        test('should generate complete script with mixed formats', async () => {
            const aiResponse = {
                content: `INT. COFFEE SHOP - MORNING

JOHN sits at a table, reading a newspaper. He looks up as SARAH enters.

SARAH
Good morning, John.

JOHN
Morning, Sarah. How are you?

SARAH
I'm doing well, thanks. I wanted to talk to you about the project.

JOHN
(surprised)
Really? I thought we were making good progress.`,
                format: 'mixed'
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(aiResponse);

            expect(formattedScript).toContain('<action>');
            expect(formattedScript).toContain('<speaker>');
            expect(formattedScript).toContain('<dialog>');
            expect(formattedScript).toContain('<directions>');
        });
    });

    describe('Format Detection and Application', () => {
        test('should detect action format from AI response', () => {
            const aiResponse = {
                content: 'INT. COFFEE SHOP - MORNING\n\nJOHN sits at a table.',
                format: 'auto'
            };

            const detectedFormat = aiCommandManager.detectScriptFormat(aiResponse.content);
            expect(detectedFormat).toBe('action');
        });

        test('should detect character format from AI response', () => {
            const aiResponse = {
                content: 'JOHN\n\nMorning, Sarah.',
                format: 'auto'
            };

            const detectedFormat = aiCommandManager.detectScriptFormat(aiResponse.content);
            expect(detectedFormat).toBe('character');
        });

        test('should detect dialogue format from AI response', () => {
            const aiResponse = {
                content: 'Morning, Sarah. How are you?',
                format: 'auto'
            };

            const detectedFormat = aiCommandManager.detectScriptFormat(aiResponse.content);
            expect(detectedFormat).toBe('dialogue');
        });

        test('should detect parenthetical format from AI response', () => {
            const aiResponse = {
                content: '(surprised)',
                format: 'auto'
            };

            const detectedFormat = aiCommandManager.detectScriptFormat(aiResponse.content);
            expect(detectedFormat).toBe('parenthetical');
        });

        test('should apply detected format to script content', async () => {
            const aiResponse = {
                content: 'JOHN\n\nMorning, Sarah.',
                format: 'auto'
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(aiResponse);

            expect(formattedScript).toContain('<speaker>JOHN</speaker>');
            expect(formattedScript).toContain('<dialog>Morning, Sarah.</dialog>');
        });
    });

    describe('System Formatting Rules', () => {
        test('should apply proper capitalization rules for action lines', async () => {
            const aiResponse = {
                content: 'john sits at a table',
                format: 'action'
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(aiResponse);

            expect(formattedScript).toContain('JOHN SITS AT A TABLE');
        });

        test('should apply proper capitalization rules for character names', async () => {
            const aiResponse = {
                content: 'john\n\nMorning, Sarah.',
                format: 'character'
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(aiResponse);

            expect(formattedScript).toContain('<speaker>JOHN</speaker>');
        });

        test('should apply proper punctuation rules for dialogue', async () => {
            const aiResponse = {
                content: 'Morning Sarah How are you',
                format: 'dialogue'
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(aiResponse);

            expect(formattedScript).toContain('Morning, Sarah. How are you?');
        });

        test('should apply proper formatting for parentheticals', async () => {
            const aiResponse = {
                content: 'surprised',
                format: 'parenthetical'
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(aiResponse);

            expect(formattedScript).toContain('<directions>(surprised)</directions>');
        });

        test('should apply proper spacing rules between elements', async () => {
            const aiResponse = {
                content: `JOHN
Morning, Sarah.
SARAH
Good morning, John.`,
                format: 'mixed'
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(aiResponse);

            // Should have proper spacing between elements
            expect(formattedScript).toMatch(/<speaker>JOHN<\/speaker>\s*<dialog>Morning, Sarah\.<\/dialog>\s*<speaker>SARAH<\/speaker>\s*<dialog>Good morning, John\.<\/dialog>/);
        });
    });

    describe('Format Validation', () => {
        test('should validate generated script format', async () => {
            const aiResponse = {
                content: 'JOHN\n\nMorning, Sarah.',
                format: 'character'
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(aiResponse);
            const isValid = aiCommandManager.validateScriptFormat(formattedScript);

            expect(isValid).toBe(true);
        });

        test('should detect invalid script format', async () => {
            const aiResponse = {
                content: 'Invalid script format without proper tags',
                format: 'action'
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(aiResponse);
            const isValid = aiCommandManager.validateScriptFormat(formattedScript);

            expect(isValid).toBe(false);
        });

        test('should validate mixed format script', async () => {
            const aiResponse = {
                content: `INT. COFFEE SHOP - MORNING

JOHN sits at a table.

SARAH
Good morning, John.

JOHN
Morning, Sarah.`,
                format: 'mixed'
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(aiResponse);
            const isValid = aiCommandManager.validateScriptFormat(formattedScript);

            expect(isValid).toBe(true);
        });

        test('should provide format validation errors', async () => {
            const aiResponse = {
                content: 'Invalid script format',
                format: 'action'
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(aiResponse);
            const validationErrors = aiCommandManager.getFormatValidationErrors(formattedScript);

            expect(validationErrors).toBeDefined();
            expect(Array.isArray(validationErrors)).toBe(true);
        });
    });

    describe('Format Conversion', () => {
        test('should convert AI response to system format', async () => {
            const aiResponse = {
                content: 'JOHN\n\nMorning, Sarah.',
                format: 'character'
            };

            const systemFormat = await aiCommandManager.convertToSystemFormat(aiResponse);

            expect(systemFormat).toContain('<speaker>');
            expect(systemFormat).toContain('<dialog>');
            expect(systemFormat).toContain('</speaker>');
            expect(systemFormat).toContain('</dialog>');
        });

        test('should convert mixed format AI response', async () => {
            const aiResponse = {
                content: `INT. COFFEE SHOP - MORNING

JOHN sits at a table.

SARAH
Good morning, John.`,
                format: 'mixed'
            };

            const systemFormat = await aiCommandManager.convertToSystemFormat(aiResponse);

            expect(systemFormat).toContain('<action>');
            expect(systemFormat).toContain('<speaker>');
            expect(systemFormat).toContain('<dialog>');
        });

        test('should handle format conversion errors gracefully', async () => {
            const aiResponse = {
                content: 'Invalid format content',
                format: 'unknown'
            };

            const systemFormat = await aiCommandManager.convertToSystemFormat(aiResponse);

            expect(systemFormat).toBeDefined();
            expect(systemFormat).toContain('Invalid format content');
        });
    });

    describe('Format Consistency', () => {
        test('should maintain format consistency across script elements', async () => {
            const aiResponse = {
                content: `JOHN
Morning, Sarah.

SARAH
Good morning, John.

JOHN
How are you?`,
                format: 'mixed'
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(aiResponse);

            // All character names should be in speaker tags
            const speakerTags = formattedScript.match(/<speaker>.*?<\/speaker>/g);
            expect(speakerTags).toHaveLength(3);

            // All dialogue should be in dialog tags
            const dialogTags = formattedScript.match(/<dialog>.*?<\/dialog>/g);
            expect(dialogTags).toHaveLength(3);
        });

        test('should maintain proper format hierarchy', async () => {
            const aiResponse = {
                content: `INT. COFFEE SHOP - MORNING

JOHN sits at a table.

SARAH
Good morning, John.

JOHN
(surprised)
Really?`,
                format: 'mixed'
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(aiResponse);

            // Should maintain proper order: action -> speaker -> dialog -> directions
            expect(formattedScript).toMatch(/<action>.*?<\/action>\s*<speaker>.*?<\/speaker>\s*<dialog>.*?<\/dialog>\s*<speaker>.*?<\/speaker>\s*<directions>.*?<\/directions>\s*<dialog>.*?<\/dialog>/);
        });

        test('should handle format transitions correctly', async () => {
            const aiResponse = {
                content: `JOHN
Morning, Sarah.

SARAH
Good morning, John.

JOHN
(surprised)
Really?`,
                format: 'mixed'
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(aiResponse);

            // Should handle transitions between different formats
            expect(formattedScript).toContain('<speaker>JOHN</speaker>');
            expect(formattedScript).toContain('<dialog>Morning, Sarah.</dialog>');
            expect(formattedScript).toContain('<speaker>SARAH</speaker>');
            expect(formattedScript).toContain('<dialog>Good morning, John.</dialog>');
            expect(formattedScript).toContain('<directions>(surprised)</directions>');
            expect(formattedScript).toContain('<dialog>Really?</dialog>');
        });
    });

    describe('Error Handling', () => {
        test('should handle malformed AI response gracefully', async () => {
            const malformedResponse = {
                content: 'Malformed response'
                // Missing format field
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(malformedResponse);

            expect(formattedScript).toBeDefined();
            expect(formattedScript).toContain('Malformed response');
        });

        test('should handle null AI response gracefully', async () => {
            const formattedScript = await aiCommandManager.formatAIGeneratedScript(null);

            expect(formattedScript).toBeDefined();
        });

        test('should handle undefined AI response gracefully', async () => {
            const formattedScript = await aiCommandManager.formatAIGeneratedScript(undefined);

            expect(formattedScript).toBeDefined();
        });

        test('should handle missing script formatter gracefully', () => {
            const aiCommandManagerWithoutFormatter = new AICommandManager(mockStateManager);
            aiCommandManagerWithoutFormatter.content = mockContentManager;
            aiCommandManagerWithoutFormatter.scriptFormatter = null;

            const aiResponse = {
                content: 'Test content',
                format: 'action'
            };

            expect(async () => {
                await aiCommandManagerWithoutFormatter.formatAIGeneratedScript(aiResponse);
            }).not.toThrow();
        });
    });

    describe('Performance', () => {
        test('should handle large AI responses efficiently', async () => {
            const largeResponse = {
                content: 'Large script content '.repeat(1000),
                format: 'mixed'
            };

            const startTime = Date.now();
            const formattedScript = await aiCommandManager.formatAIGeneratedScript(largeResponse);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
            expect(formattedScript).toBeDefined();
        });

        test('should handle rapid format conversions efficiently', async () => {
            const responses = Array.from({ length: 50 }, (_, i) => ({
                content: `Response ${i}`,
                format: 'action'
            }));

            const startTime = Date.now();

            for (const response of responses) {
                await aiCommandManager.formatAIGeneratedScript(response);
            }

            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
        });

        test('should handle complex format detection efficiently', () => {
            const complexContent = `INT. COFFEE SHOP - MORNING

JOHN sits at a table, reading a newspaper. He looks up as SARAH enters.

SARAH
Good morning, John.

JOHN
Morning, Sarah. How are you?

SARAH
I'm doing well, thanks. I wanted to talk to you about the project.

JOHN
(surprised)
Really? I thought we were making good progress.`;

            const startTime = Date.now();
            const detectedFormat = aiCommandManager.detectScriptFormat(complexContent);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
            expect(detectedFormat).toBeDefined();
        });
    });

    describe('Integration with Editor Components', () => {
        test('should integrate with content manager for script insertion', async () => {
            const aiResponse = {
                content: 'JOHN\n\nMorning, Sarah.',
                format: 'character'
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(aiResponse);

            expect(mockContentManager.setContent).toHaveBeenCalledWith(formattedScript);
        });

        test('should integrate with state manager for state updates', async () => {
            const aiResponse = {
                content: 'Test content',
                format: 'action'
            };

            await aiCommandManager.formatAIGeneratedScript(aiResponse);

            expect(mockStateManager.setState).toHaveBeenCalledWith(
                'CONTENT_MODIFIED',
                expect.any(Object)
            );
        });

        test('should integrate with script formatter for formatting rules', async () => {
            const aiResponse = {
                content: 'john sits at a table',
                format: 'action'
            };

            const formattedScript = await aiCommandManager.formatAIGeneratedScript(aiResponse);

            expect(formattedScript).toContain('JOHN SITS AT A TABLE');
        });

        test('should integrate with save service for auto-save', async () => {
            const mockSaveService = {
                handleContentChange: jest.fn()
            };

            aiCommandManager.saveService = mockSaveService;

            const aiResponse = {
                content: 'Test content',
                format: 'action'
            };

            await aiCommandManager.formatAIGeneratedScript(aiResponse);

            expect(mockSaveService.handleContentChange).toHaveBeenCalled();
        });
    });
});
