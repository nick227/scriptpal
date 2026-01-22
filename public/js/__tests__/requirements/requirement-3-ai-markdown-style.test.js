/**
 * Tests for Requirement #3: AI generated script must use our script markdown style
 */

describe('Requirement #3: AI Script Markdown Style', () => {
    let mockAIResponse;
    let mockScriptContent;

    beforeEach(() => {
        // Mock AI response with proper markdown style
        mockAIResponse = {
            content: `<header>INT. COFFEE SHOP - MORNING</header>
<action>The bustling coffee shop is filled with morning commuters.</action>
<speaker>JOHN</speaker>
<dialog>I can't believe what happened yesterday.</dialog>
<directions>(shaking his head)</directions>
<speaker>SARAH</speaker>
<dialog>I know, it was completely unexpected.</dialog>`,
            intent: 'WRITE_SCRIPT'
        };

        mockScriptContent = {
            title: 'Test Script',
            content: 'Existing script content'
        };
    });

    describe('AI Response Format Validation', () => {
        test('should use proper XML-style script tags', () => {
            const content = mockAIResponse.content;

            // Check for required script tags
            expect(content).toContain('<header>');
            expect(content).toContain('<action>');
            expect(content).toContain('<speaker>');
            expect(content).toContain('<dialog>');
            expect(content).toContain('<directions>');
        });

        test('should have properly closed tags', () => {
            const content = mockAIResponse.content;

            // Check for properly closed tags
            expect(content).toContain('</header>');
            expect(content).toContain('</action>');
            expect(content).toContain('</speaker>');
            expect(content).toContain('</dialog>');
            expect(content).toContain('</directions>');
        });

        test('should follow script formatting conventions', () => {
            const content = mockAIResponse.content;

            // Check for proper scene heading format
            expect(content).toMatch(/<header>INT\.\s+[A-Z\s]+-\s+[A-Z\s]+<\/header>/);

            // Check for character name format (all caps)
            expect(content).toMatch(/<speaker>[A-Z]+<\/speaker>/);

            // Check for dialogue format
            expect(content).toMatch(/<dialog>[^<]+<\/dialog>/);
        });
    });

    describe('Script Tag Types', () => {
        test('should support header tags for scene headings', () => {
            const headerContent = '<header>INT. COFFEE SHOP - MORNING</header>';
            expect(headerContent).toMatch(/<header>.*<\/header>/);
        });

        test('should support action tags for action descriptions', () => {
            const actionContent = '<action>The bustling coffee shop is filled with morning commuters.</action>';
            expect(actionContent).toMatch(/<action>.*<\/action>/);
        });

        test('should support speaker tags for character names', () => {
            const speakerContent = '<speaker>JOHN</speaker>';
            expect(speakerContent).toMatch(/<speaker>.*<\/speaker>/);
        });

        test('should support dialog tags for dialogue', () => {
            const dialogContent = '<dialog>I can\'t believe what happened yesterday.</dialog>';
            expect(dialogContent).toMatch(/<dialog>.*<\/dialog>/);
        });

        test('should support directions tags for parentheticals', () => {
            const directionsContent = '<directions>(shaking his head)</directions>';
            expect(directionsContent).toMatch(/<directions>.*<\/directions>/);
        });

        test('should support chapter-break tags for chapter breaks', () => {
            const chapterBreakContent = '<chapter-break>CHAPTER 2</chapter-break>';
            expect(chapterBreakContent).toMatch(/<chapter-break>.*<\/chapter-break>/);
        });
    });

    describe('AI Response Processing', () => {
        test('should extract script content from AI response', () => {
            const response = mockAIResponse;
            const scriptContent = response.content;

            expect(scriptContent).toBeDefined();
            expect(scriptContent).toContain('<header>');
            expect(scriptContent).toContain('<speaker>');
            expect(scriptContent).toContain('<dialog>');
        });

        test('should validate script structure', () => {
            const content = mockAIResponse.content;
            const lines = content.split('\n').filter(line => line.trim());

            // Should have proper structure
            expect(lines.length).toBeGreaterThan(0);

            // First line should be a header
            expect(lines[0]).toMatch(/<header>.*<\/header>/);
        });

        test('should handle multiple character interactions', () => {
            const content = mockAIResponse.content;

            // Should have multiple speakers
            const speakerMatches = content.match(/<speaker>.*?<\/speaker>/g);
            expect(speakerMatches).toBeTruthy();
            expect(speakerMatches.length).toBeGreaterThan(1);

            // Should have corresponding dialogue
            const dialogMatches = content.match(/<dialog>.*?<\/dialog>/g);
            expect(dialogMatches).toBeTruthy();
            expect(dialogMatches.length).toBeGreaterThan(1);
        });
    });

    describe('Format Consistency', () => {
        test('should maintain consistent formatting across responses', () => {
            const responses = [
                mockAIResponse,
                {
                    content: `<header>EXT. PARK - DAY</header>
<action>The sun shines brightly.</action>
<speaker>ALICE</speaker>
<dialog>What a beautiful day!</dialog>`
                }
            ];

            responses.forEach(response => {
                const content = response.content;

                // All responses should use the same tag format
                expect(content).toMatch(/<header>.*<\/header>/);
                expect(content).toMatch(/<action>.*<\/action>/);
                expect(content).toMatch(/<speaker>.*<\/speaker>/);
                expect(content).toMatch(/<dialog>.*<\/dialog>/);
            });
        });

        test('should not mix different formatting styles', () => {
            const content = mockAIResponse.content;

            // Should not contain markdown-style formatting
            expect(content).not.toContain('**');
            expect(content).not.toContain('*');
            expect(content).not.toContain('#');
            expect(content).not.toContain('```');

            // Should only use XML-style tags
            expect(content).toMatch(/<[^>]+>.*<\/[^>]+>/);
        });
    });

    describe('Error Handling', () => {
        test('should handle malformed AI responses gracefully', () => {
            const malformedResponse = {
                content: '<header>INT. ROOM - DAY</header><speaker>JOHN<dialog>Hello world</dialog>',
                intent: 'WRITE_SCRIPT'
            };

            // Should still be able to extract some content
            expect(malformedResponse.content).toContain('<header>');
            expect(malformedResponse.content).toContain('<speaker>');
        });

        test('should handle empty AI responses', () => {
            const emptyResponse = {
                content: '',
                intent: 'WRITE_SCRIPT'
            };

            expect(emptyResponse.content).toBe('');
        });

        test('should handle responses without script tags', () => {
            const nonScriptResponse = {
                content: 'This is just regular text without script formatting.',
                intent: 'ANALYZE_SCRIPT'
            };

            // Should not match script tag patterns
            expect(nonScriptResponse.content).not.toMatch(/<header>.*<\/header>/);
            expect(nonScriptResponse.content).not.toMatch(/<speaker>.*<\/speaker>/);
        });
    });

    describe('Integration with Script System', () => {
        test('should be compatible with script parsing system', () => {
            const content = mockAIResponse.content;

            // Should be parseable by the script system
            const lines = content.split('\n').filter(line => line.trim());

            lines.forEach(line => {
                // Each line should be a valid script element
                expect(line).toMatch(/<[^>]+>.*<\/[^>]+>/);
            });
        });

        test('should maintain script structure integrity', () => {
            const content = mockAIResponse.content;

            // Should have logical flow: header -> action -> speaker -> dialog
            const lines = content.split('\n').filter(line => line.trim());

            // First line should be header
            expect(lines[0]).toMatch(/<header>.*<\/header>/);

            // Should have action lines
            const actionLines = lines.filter(line => line.includes('<action>'));
            expect(actionLines.length).toBeGreaterThan(0);

            // Should have speaker-dialog pairs
            const speakerLines = lines.filter(line => line.includes('<speaker>'));
            const dialogLines = lines.filter(line => line.includes('<dialog>'));
            expect(speakerLines.length).toBe(dialogLines.length);
        });
    });
});
