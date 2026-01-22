/**
 * Tests for ScriptFormatter
 */

import { ScriptFormatter } from '../../services/scriptFormatter.js';

describe('ScriptFormatter', () => {
    let formatter;

    beforeEach(() => {
        formatter = new ScriptFormatter();
    });

    afterEach(() => {
        formatter = null;
    });

    describe('constructor', () => {
        it('should initialize with valid tags', () => {
            expect(formatter.validTags).toEqual([
                'header',
                'speaker',
                'dialog',
                'action',
                'directions',
                'chapter-break'
            ]);
        });
    });

    describe('format', () => {
        it('should format content with markup', () => {
            const content = '<header>FADE IN:</header><action>EXT. PARK - DAY</action>';
            const result = formatter.format(content);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
        });

        it('should format content without markup', () => {
            const content = 'FADE IN:\n\nEXT. PARK - DAY';
            const result = formatter.format(content);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
        });

        it('should handle empty content', () => {
            expect(() => {
                formatter.format('');
            }).toThrow();
        });

        it('should handle null content', () => {
            expect(() => {
                formatter.format(null);
            }).toThrow();
        });

        it('should handle undefined content', () => {
            expect(() => {
                formatter.format(undefined);
            }).toThrow();
        });
    });

    describe('validateInput', () => {
        it('should accept valid string input', () => {
            expect(() => {
                formatter.validateInput('valid content');
            }).not.toThrow();
        });

        it('should reject null input', () => {
            expect(() => {
                formatter.validateInput(null);
            }).toThrow('Content must be a string');
        });

        it('should reject undefined input', () => {
            expect(() => {
                formatter.validateInput(undefined);
            }).toThrow('Content must be a string');
        });

        it('should reject non-string input', () => {
            expect(() => {
                formatter.validateInput(123);
            }).toThrow('Content must be a string');
        });
    });

    describe('containsMarkup', () => {
        it('should detect markup in content', () => {
            const content = '<header>FADE IN:</header>';
            expect(formatter.containsMarkup(content)).toBe(true);
        });

        it('should detect no markup in content', () => {
            const content = 'FADE IN:\n\nEXT. PARK - DAY';
            expect(formatter.containsMarkup(content)).toBe(false);
        });

        it('should handle empty content', () => {
            expect(formatter.containsMarkup('')).toBe(false);
        });
    });

    describe('formatExistingMarkup', () => {
        it('should format content with existing markup', () => {
            const content = '<header>FADE IN:</header><action>EXT. PARK - DAY</action>';
            const result = formatter.formatExistingMarkup(content);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
        });

        it('should handle content with invalid tags', () => {
            const content = '<invalid>content</invalid><header>valid</header>';
            const result = formatter.formatExistingMarkup(content);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
        });
    });

    describe('formatPlainText', () => {
        it('should format plain text content', () => {
            const content = 'FADE IN:\n\nEXT. PARK - DAY\n\nJOHN\nHello world.';
            const result = formatter.formatPlainText(content);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
        });

        it('should handle empty content', () => {
            const result = formatter.formatPlainText('');
            expect(result).toBe('');
            expect(typeof result).toBe('string');
        });

        it('should handle single line content', () => {
            const content = 'FADE IN:';
            const result = formatter.formatPlainText(content);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
        });

        // Carriage return tests
        it('should handle content with carriage returns (\\r)', () => {
            const content = 'FADE IN:\r\rEXT. PARK - DAY\r\rJOHN\rHello world.';
            const result = formatter.formatPlainText(content);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(result).toContain('<action>FADE IN:</action>');
            expect(result).toContain('<action>EXT. PARK - DAY</action>');
            expect(result).toContain('<action>JOHN</action>');
            expect(result).toContain('<action>Hello world.</action>');
        });

        it('should handle content with Windows line endings (\\r\\n)', () => {
            const content = 'FADE IN:\r\n\r\nEXT. PARK - DAY\r\n\r\nJOHN\r\nHello world.';
            const result = formatter.formatPlainText(content);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(result).toContain('<action>FADE IN:</action>');
            expect(result).toContain('<action>EXT. PARK - DAY</action>');
            expect(result).toContain('<action>JOHN</action>');
            expect(result).toContain('<action>Hello world.</action>');
        });

        it('should handle mixed line endings (\\n and \\r\\n)', () => {
            const content = 'FADE IN:\n\r\nEXT. PARK - DAY\r\n\nJOHN\r\nHello world.';
            const result = formatter.formatPlainText(content);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(result).toContain('<action>FADE IN:</action>');
            expect(result).toContain('<action>EXT. PARK - DAY</action>');
            expect(result).toContain('<action>JOHN</action>');
            expect(result).toContain('<action>Hello world.</action>');
        });

        it('should handle content with only carriage returns', () => {
            const content = 'FADE IN:\rEXT. PARK - DAY\rJOHN\rHello world.';
            const result = formatter.formatPlainText(content);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(result).toContain('<action>FADE IN:</action>');
            expect(result).toContain('<action>EXT. PARK - DAY</action>');
            expect(result).toContain('<action>JOHN</action>');
            expect(result).toContain('<action>Hello world.</action>');
        });

        it('should handle content with prefixed lines and carriage returns', () => {
            const content = 'HEADER:FADE IN:\r\nSPEAKER:JOHN\r\nDIALOG:Hello world.\r\nACTION:John smiles.';
            const result = formatter.formatPlainText(content);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(result).toContain('<header>FADE IN:</header>');
            expect(result).toContain('<speaker>JOHN</speaker>');
            expect(result).toContain('<dialog>Hello world.</dialog>');
            expect(result).toContain('<action>John smiles.</action>');
        });

        it('should handle content with chapter breaks and carriage returns', () => {
            const content = 'FADE IN:\r\n\r\n---\r\n\r\nEXT. PARK - DAY';
            const result = formatter.formatPlainText(content);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(result).toContain('<action>FADE IN:</action>');
            expect(result).toContain('<chapter-break/>');
            expect(result).toContain('<action>EXT. PARK - DAY</action>');
        });

        it('should handle empty lines with carriage returns', () => {
            const content = 'FADE IN:\r\n\r\n\r\nEXT. PARK - DAY\r\n\r\n\r\nJOHN';
            const result = formatter.formatPlainText(content);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(result).toContain('<action>FADE IN:</action>');
            expect(result).toContain('<action>EXT. PARK - DAY</action>');
            expect(result).toContain('<action>JOHN</action>');
            // Should not contain empty lines in the result
            expect(result.split('\n').every(line => line.trim().length > 0)).toBe(true);
        });

        it('should handle content with only carriage returns and no newlines', () => {
            const content = 'FADE IN:\rEXT. PARK - DAY\rJOHN\rHello world.';
            const result = formatter.formatPlainText(content);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(result).toContain('<action>FADE IN:</action>');
            expect(result).toContain('<action>EXT. PARK - DAY</action>');
            expect(result).toContain('<action>JOHN</action>');
            expect(result).toContain('<action>Hello world.</action>');
        });

        it('should handle content with mixed line endings and special characters', () => {
            const content = 'HEADER:FADE IN:\r\nSPEAKER:JOHN\rDIALOG:Hello & "world"!\nACTION:John smiles.';
            const result = formatter.formatPlainText(content);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(result).toContain('<header>FADE IN:</header>');
            expect(result).toContain('<speaker>JOHN</speaker>');
            expect(result).toContain('<dialog>Hello &amp; &quot;world&quot;!</dialog>');
            expect(result).toContain('<action>John smiles.</action>');
        });

        it('should handle content with trailing carriage returns', () => {
            const content = 'FADE IN:\r\nEXT. PARK - DAY\r\nJOHN\r\n\r\n';
            const result = formatter.formatPlainText(content);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(result).toContain('<action>FADE IN:</action>');
            expect(result).toContain('<action>EXT. PARK - DAY</action>');
            expect(result).toContain('<action>JOHN</action>');
            // Should not contain empty lines in the result
            expect(result.split('\n').every(line => line.trim().length > 0)).toBe(true);
        });
    });

    describe('formatLine', () => {
        it('should format header lines', () => {
            const result = formatter.formatLine('HEADER:FADE IN:');
            expect(result).toContain('<header>');
            expect(result).toContain('FADE IN:');
        });

        it('should format speaker lines', () => {
            const result = formatter.formatLine('SPEAKER:JOHN');
            expect(result).toContain('<speaker>');
            expect(result).toContain('JOHN');
        });

        it('should format dialog lines', () => {
            const result = formatter.formatLine('DIALOG:Hello, world!');
            expect(result).toContain('<dialog>');
            expect(result).toContain('Hello, world!');
        });

        it('should format action lines', () => {
            const result = formatter.formatLine('ACTION:John walks into the room.');
            expect(result).toContain('<action>');
            expect(result).toContain('John walks into the room.');
        });

        it('should handle chapter breaks', () => {
            const result = formatter.formatLine('---');
            expect(result).toBe('<chapter-break/>');
        });

        it('should default to action for unknown lines', () => {
            const result = formatter.formatLine('Some random text');
            expect(result).toContain('<action>');
            expect(result).toContain('Some random text');
        });
    });

    describe('createTaggedLine', () => {
        it('should create tagged line with content', () => {
            const result = formatter.createTaggedLine('header', 'FADE IN:');
            expect(result).toBe('<header>FADE IN:</header>');
        });

        it('should handle empty content', () => {
            const result = formatter.createTaggedLine('header', '');
            expect(result).toBe('<header></header>');
        });

        it('should escape XML characters', () => {
            const result = formatter.createTaggedLine('header', 'Content & "quotes"');
            expect(result).toContain('&amp;');
            expect(result).toContain('&quot;');
        });
    });

    describe('escapeXML', () => {
        it('should escape XML characters', () => {
            const result = formatter.escapeXML('Content & "quotes" < > \'');
            expect(result).toBe('Content &amp; &quot;quotes&quot; &lt; &gt; &apos;');
        });

        it('should handle empty string', () => {
            const result = formatter.escapeXML('');
            expect(result).toBe('');
        });

        it('should handle null/undefined', () => {
            const result = formatter.escapeXML(null);
            expect(result).toBe('');
        });
    });

    describe('validateFormat', () => {
        it('should validate valid content', () => {
            const content = '<header>FADE IN:</header>';
            const result = formatter.validateFormat(content);
            expect(result).toBe(true);
        });

        it('should reject invalid content', () => {
            const content = 'Invalid content without tags';
            const result = formatter.validateFormat(content);
            expect(result).toBe(false);
        });

        it('should handle null content', () => {
            const result = formatter.validateFormat(null);
            expect(result).toBe(false);
        });
    });

    describe('validateContentStructure', () => {
        it('should validate content with valid tags', () => {
            const content = '<header>FADE IN:</header><action>EXT. PARK - DAY</action>';
            const result = formatter.validateContentStructure(content);
            expect(result).toBe(true);
        });

        it('should handle content without valid tags', () => {
            const content = 'Plain text content';
            const result = formatter.validateContentStructure(content);
            expect(result).toBe(false);
        });
    });

    describe('validateTextContent', () => {
        it('should validate text content with valid tags', () => {
            const content = '<header>FADE IN:</header>\n<action>EXT. PARK - DAY</action>';
            const result = formatter.validateTextContent(content);
            expect(result).toBe(true);
        });

        it('should reject text content without valid tags', () => {
            const content = 'Plain text content\nMore plain text';
            const result = formatter.validateTextContent(content);
            expect(result).toBe(false);
        });
    });

    describe('isValidTagLine', () => {
        it('should validate valid tag lines', () => {
            expect(formatter.isValidTagLine('<header>FADE IN:</header>')).toBe(true);
            expect(formatter.isValidTagLine('<action>EXT. PARK - DAY</action>')).toBe(true);
        });

        it('should reject invalid tag lines', () => {
            expect(formatter.isValidTagLine('<invalid>content</invalid>')).toBe(false);
            expect(formatter.isValidTagLine('Plain text')).toBe(false);
        });
    });

    describe('getValidTags', () => {
        it('should return valid tags', () => {
            const tags = formatter.getValidTags();
            expect(tags).toEqual([
                'header',
                'speaker',
                'dialog',
                'action',
                'directions',
                'chapter-break'
            ]);
        });
    });

    describe('logFormatStart', () => {
        it('should log format start without throwing', () => {
            expect(() => {
                formatter.logFormatStart('test content');
            }).not.toThrow();
        });
    });

    describe('logValidationResult', () => {
        it('should log validation result without throwing', () => {
            expect(() => {
                formatter.logValidationResult(true);
            }).not.toThrow();
        });
    });

    describe('handleFormatError', () => {
        it('should handle format error', () => {
            expect(() => {
                formatter.handleFormatError(new Error('Test error'), 'test content');
            }).toThrow('Invalid script format: Test error');
        });
    });

    describe('integration tests', () => {
        it('should format a complete screenplay', () => {
            const screenplay = `
FADE IN:

EXT. PARK - DAY

John walks into the park.

JOHN
Hello, how are you?

MARY
I am fine, thank you.

John smiles.

=== CHAPTER 2 ===

INT. HOUSE - NIGHT

The door opens.
            `;

            const result = formatter.format(screenplay);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should format content with mixed markup and plain text', () => {
            const content = '<header>FADE IN:</header>\n\nEXT. PARK - DAY\n\n<speaker>JOHN</speaker>\n<dialog>Hello, world!</dialog>';
            const result = formatter.format(content);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
        });

        it('should format content with carriage returns through main format method', () => {
            const content = 'FADE IN:\r\n\r\nEXT. PARK - DAY\r\n\r\nJOHN\r\nHello world.';
            const result = formatter.format(content);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(result).toContain('<action>FADE IN:</action>');
            expect(result).toContain('<action>EXT. PARK - DAY</action>');
            expect(result).toContain('<action>JOHN</action>');
            expect(result).toContain('<action>Hello world.</action>');
        });
    });
});

