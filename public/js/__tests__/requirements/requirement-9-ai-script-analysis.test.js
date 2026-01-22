/**
 * Tests for Requirement #9: The user can ask the AI to tell them about the script and get a valuable response
 */

import { AICommandManager } from '../../widgets/editor/ai/AICommandManager.js';

describe('Requirement #9: AI Script Analysis', () => {
    let aiCommandManager;
    let mockStateManager;
    let mockContentManager;

    beforeEach(() => {
        // Create mock state manager
        mockStateManager = {
            getState: jest.fn().mockReturnValue({
                id: 1,
                title: 'Test Script',
                content: `INT. COFFEE SHOP - MORNING

JOHN sits at a table, reading a newspaper. He looks up as SARAH enters.

SARAH
Good morning, John.

JOHN
Morning, Sarah. How are you?

SARAH
I'm doing well, thanks. I wanted to talk to you about the project.

JOHN
Of course. What's on your mind?

SARAH
I think we need to reconsider our approach. The current plan isn't working.

JOHN
(surprised)
Really? I thought we were making good progress.

SARAH
The numbers don't lie. We're behind schedule and over budget.

JOHN
I see. What do you suggest we do?

SARAH
I think we need to go back to the drawing board. Start fresh with a new strategy.

JOHN
That's a big decision. Are you sure?

SARAH
I am. Sometimes you have to tear down to build up.

JOHN
You're right. Let's do it.

FADE OUT.`,
                author: 'Test Author',
                status: 'draft'
            }),
            setState: jest.fn(),
            subscribe: jest.fn()
        };

        // Create mock content manager
        mockContentManager = {
            getContent: jest.fn().mockReturnValue(`INT. COFFEE SHOP - MORNING

JOHN sits at a table, reading a newspaper. He looks up as SARAH enters.

SARAH
Good morning, John.

JOHN
Morning, Sarah. How are you?

SARAH
I'm doing well, thanks. I wanted to talk to you about the project.

JOHN
Of course. What's on your mind?

SARAH
I think we need to reconsider our approach. The current plan isn't working.

JOHN
(surprised)
Really? I thought we were making good progress.

SARAH
The numbers don't lie. We're behind schedule and over budget.

JOHN
I see. What do you suggest we do?

SARAH
I think we need to go back to the drawing board. Start fresh with a new strategy.

JOHN
That's a big decision. Are you sure?

SARAH
I am. Sometimes you have to tear down to build up.

JOHN
You're right. Let's do it.

FADE OUT.`),
            getLineCount: jest.fn().mockReturnValue(25),
            getWordCount: jest.fn().mockReturnValue(150),
            getCharacterCount: jest.fn().mockReturnValue(800)
        };

        // Create AI command manager
        aiCommandManager = new AICommandManager(mockStateManager);
        aiCommandManager.content = mockContentManager;
    });

    afterEach(() => {
        aiCommandManager.destroy();
    });

    describe('Script Structure Analysis', () => {
        test('should analyze script structure and provide valuable insights', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult).toHaveProperty('structure');
            expect(analysisResult).toHaveProperty('characters');
            expect(analysisResult).toHaveProperty('scenes');
            expect(analysisResult).toHaveProperty('dialogue');
            expect(analysisResult).toHaveProperty('format');
        });

        test('should identify script elements and their distribution', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult.structure).toHaveProperty('totalLines');
            expect(analysisResult.structure).toHaveProperty('actionLines');
            expect(analysisResult.structure).toHaveProperty('dialogueLines');
            expect(analysisResult.structure).toHaveProperty('characterLines');
            expect(analysisResult.structure).toHaveProperty('parentheticalLines');
        });

        test('should analyze character presence and dialogue distribution', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult.characters).toHaveProperty('count');
            expect(analysisResult.characters).toHaveProperty('list');
            expect(analysisResult.characters).toHaveProperty('dialogueDistribution');
        });

        test('should identify scene structure and transitions', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult.scenes).toHaveProperty('count');
            expect(analysisResult.scenes).toHaveProperty('locations');
            expect(analysisResult.scenes).toHaveProperty('transitions');
        });
    });

    describe('Script Content Analysis', () => {
        test('should analyze dialogue quality and character voice', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult.dialogue).toHaveProperty('totalWords');
            expect(analysisResult.dialogue).toHaveProperty('averageWordsPerLine');
            expect(analysisResult.dialogue).toHaveProperty('characterVoice');
        });

        test('should analyze action line effectiveness', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult.format).toHaveProperty('actionLines');
            expect(analysisResult.format).toHaveProperty('actionEffectiveness');
            expect(analysisResult.format).toHaveProperty('visualElements');
        });

        test('should provide formatting analysis and suggestions', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult.format).toHaveProperty('compliance');
            expect(analysisResult.format).toHaveProperty('suggestions');
            expect(analysisResult.format).toHaveProperty('errors');
        });
    });

    describe('AI Analysis Commands', () => {
        test('should execute analyze structure command', async () => {
            const commandData = {
                type: 'structure',
                options: { includeStats: true }
            };

            const result = await aiCommandManager.handleAnalyzeStructureCommand(commandData);

            expect(result.success).toBe(true);
            expect(result.analysis).toHaveProperty('structure');
            expect(result.analysis).toHaveProperty('stats');
        });

        test('should execute analyze format command', async () => {
            const commandData = {
                type: 'format',
                options: { checkCompliance: true }
            };

            const result = await aiCommandManager.handleAnalyzeFormatCommand(commandData);

            expect(result.success).toBe(true);
            expect(result.analysis).toHaveProperty('format');
            expect(result.analysis).toHaveProperty('compliance');
        });

        test('should execute analyze content command', async () => {
            const commandData = {
                type: 'content',
                options: { includeSuggestions: true }
            };

            const result = await aiCommandManager.handleAnalyzeContentCommand(commandData);

            expect(result.success).toBe(true);
            expect(result.analysis).toHaveProperty('content');
            expect(result.analysis).toHaveProperty('suggestions');
        });
    });

    describe('Valuable Response Generation', () => {
        test('should provide actionable insights about script structure', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult.insights).toBeDefined();
            expect(Array.isArray(analysisResult.insights)).toBe(true);
            expect(analysisResult.insights.length).toBeGreaterThan(0);
        });

        test('should identify strengths and weaknesses', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult).toHaveProperty('strengths');
            expect(analysisResult).toHaveProperty('weaknesses');
            expect(analysisResult).toHaveProperty('recommendations');
        });

        test('should provide specific improvement suggestions', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult.recommendations).toBeDefined();
            expect(Array.isArray(analysisResult.recommendations)).toBe(true);

            analysisResult.recommendations.forEach(recommendation => {
                expect(recommendation).toHaveProperty('type');
                expect(recommendation).toHaveProperty('description');
                expect(recommendation).toHaveProperty('priority');
            });
        });

        test('should analyze character development and dialogue', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult.characters).toHaveProperty('development');
            expect(analysisResult.characters).toHaveProperty('voiceConsistency');
            expect(analysisResult.characters).toHaveProperty('dialogueQuality');
        });
    });

    describe('Script Metrics and Statistics', () => {
        test('should calculate comprehensive script metrics', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult.metrics).toHaveProperty('totalLines');
            expect(analysisResult.metrics).toHaveProperty('totalWords');
            expect(analysisResult.metrics).toHaveProperty('totalCharacters');
            expect(analysisResult.metrics).toHaveProperty('averageWordsPerLine');
            expect(analysisResult.metrics).toHaveProperty('dialoguePercentage');
        });

        test('should analyze pacing and rhythm', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult.pacing).toHaveProperty('overall');
            expect(analysisResult.pacing).toHaveProperty('sceneTransitions');
            expect(analysisResult.pacing).toHaveProperty('dialogueFlow');
        });

        test('should provide genre-specific analysis', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult.genre).toHaveProperty('type');
            expect(analysisResult.genre).toHaveProperty('conventions');
            expect(analysisResult.genre).toHaveProperty('compliance');
        });
    });

    describe('AI Response Quality', () => {
        test('should provide detailed and specific feedback', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult.feedback).toBeDefined();
            expect(analysisResult.feedback).toHaveProperty('overall');
            expect(analysisResult.feedback).toHaveProperty('specific');
            expect(analysisResult.feedback).toHaveProperty('actionable');
        });

        test('should identify specific script elements for improvement', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult.improvements).toBeDefined();
            expect(Array.isArray(analysisResult.improvements)).toBe(true);

            analysisResult.improvements.forEach(improvement => {
                expect(improvement).toHaveProperty('element');
                expect(improvement).toHaveProperty('issue');
                expect(improvement).toHaveProperty('suggestion');
                expect(improvement).toHaveProperty('lineNumber');
            });
        });

        test('should provide positive reinforcement for good elements', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult.strengths).toBeDefined();
            expect(Array.isArray(analysisResult.strengths)).toBe(true);

            analysisResult.strengths.forEach(strength => {
                expect(strength).toHaveProperty('element');
                expect(strength).toHaveProperty('description');
                expect(strength).toHaveProperty('impact');
            });
        });
    });

    describe('Context-Aware Analysis', () => {
        test('should consider script title and author in analysis', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult.context).toHaveProperty('title');
            expect(analysisResult.context).toHaveProperty('author');
            expect(analysisResult.context).toHaveProperty('status');
        });

        test('should adapt analysis based on script length and complexity', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult.complexity).toHaveProperty('level');
            expect(analysisResult.complexity).toHaveProperty('factors');
            expect(analysisResult.complexity).toHaveProperty('recommendations');
        });

        test('should provide appropriate analysis for script status', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult.status).toHaveProperty('current');
            expect(analysisResult.status).toHaveProperty('suggestions');
            expect(analysisResult.status).toHaveProperty('nextSteps');
        });
    });

    describe('Error Handling', () => {
        test('should handle missing script content gracefully', async () => {
            mockContentManager.getContent.mockReturnValue('');

            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult).toBeDefined();
            expect(analysisResult.error).toBeUndefined();
        });

        test('should handle malformed script content', async () => {
            mockContentManager.getContent.mockReturnValue('Invalid script format without proper structure');

            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult).toBeDefined();
            expect(analysisResult.format).toHaveProperty('errors');
        });

        test('should handle analysis command errors', async () => {
            const invalidCommandData = {
                type: 'invalid',
                options: {}
            };

            await expect(aiCommandManager.handleAnalyzeStructureCommand(invalidCommandData))
                .rejects.toThrow();
        });
    });

    describe('Performance and Efficiency', () => {
        test('should complete analysis within reasonable time', async () => {
            const startTime = Date.now();

            await aiCommandManager.analyzeStats();

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(1000); // Should complete within 1 second
        });

        test('should cache analysis results for performance', async () => {
            // First analysis
            const result1 = await aiCommandManager.analyzeStats();

            // Second analysis (should use cache)
            const result2 = await aiCommandManager.analyzeStats();

            expect(result1).toEqual(result2);
        });

        test('should handle large scripts efficiently', async () => {
            // Mock large script content
            const largeContent = 'INT. SCENE - DAY\n'.repeat(1000) + 'JOHN\nHello world.';
            mockContentManager.getContent.mockReturnValue(largeContent);
            mockContentManager.getLineCount.mockReturnValue(1000);

            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult).toBeDefined();
            expect(analysisResult.metrics.totalLines).toBe(1000);
        });
    });

    describe('Integration with AI Services', () => {
        test('should provide analysis data for AI processing', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult.aiData).toBeDefined();
            expect(analysisResult.aiData).toHaveProperty('summary');
            expect(analysisResult.aiData).toHaveProperty('keyPoints');
            expect(analysisResult.aiData).toHaveProperty('context');
        });

        test('should format analysis for AI response generation', async () => {
            const analysisResult = await aiCommandManager.analyzeStats();

            expect(analysisResult.aiResponse).toBeDefined();
            expect(analysisResult.aiResponse).toHaveProperty('format');
            expect(analysisResult.aiResponse).toHaveProperty('tone');
            expect(analysisResult.aiResponse).toHaveProperty('structure');
        });
    });
});
